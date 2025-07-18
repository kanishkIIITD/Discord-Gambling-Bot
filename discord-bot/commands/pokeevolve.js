const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const customSpawnRates = require('../data/customSpawnRates.json');
const pokeCache = require('../utils/pokeCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokeevolve')
    .setDescription('Evolve a Pokémon using the Evolver\'s Ring and duplicates!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;
    // Fetch user info and pokedex
    let user, pokedex;
    try {
      const [userRes, pokedexRes] = await Promise.all([
        axios.get(`${backendUrl}/users/${userId}`, { headers: { 'x-guild-id': guildId } }),
        axios.get(`${backendUrl}/users/${userId}/pokedex`, { headers: { 'x-guild-id': guildId } })
      ]);
      user = userRes.data.user || userRes.data;
      pokedex = pokedexRes.data.pokedex || [];
    } catch (e) {
      return interaction.editReply('Failed to fetch your user data. Please try again later.');
    }
    // Check for Evolver's Ring and cooldown
    const now = Date.now();
    const ringTs = user.poke_daily_ring_ts;
    const ringCharges = user.poke_ring_charges || 0;
    const hasRing = !!ringTs && (now - new Date(ringTs).getTime() < 24 * 60 * 60 * 1000);
    if (!hasRing || ringCharges <= 0) {
      return interaction.editReply('You do not have an active Evolver\'s Ring or you are out of charges. Buy one from /pokeshop!');
    }
    // Rarity-based requirements
    const rarityMultipliers = {
      common: 1,
      uncommon: 2,
      rare: 4,
      legendary: null // lockout
    };
    const baseValue = 3;
    // Filter eligible Pokémon (duplicates, not legendary, not final stage, etc.)
    const eligible = pokedex.filter(mon => {
      const pokeName = mon.name?.toLowerCase();
      const rarity = customSpawnRates[pokeName]?.rarity || 'common';
      const multiplier = rarityMultipliers[rarity];
      if (multiplier == null) return false; // legendary lockout
      const requiredDupes = baseValue * multiplier;
      return (mon.count || 1) >= requiredDupes;
    });
    if (eligible.length === 0) {
      return interaction.editReply('You do not have any eligible duplicate Pokémon to evolve. You need enough duplicates of a non-legendary Pokémon.');
    }
    // Build select menu
    const options = eligible.map(mon => ({
      label: `#${mon.pokemonId.toString().padStart(3, '0')} ${mon.name.charAt(0).toUpperCase() + mon.name.slice(1)}${mon.isShiny ? ' ✨' : ''} x${mon.count}`,
      value: `${mon.pokemonId}:${mon.isShiny ? 'shiny' : 'normal'}`
    }));
    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('pokeevolve_select')
        .setPlaceholder('Select a Pokémon to evolve')
        .addOptions(options)
    );
    const msg = await interaction.editReply({ content: 'Select a Pokémon to evolve using your Evolver\'s Ring:', components: [selectRow], ephemeral: true });
    // Collector for select menu
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This select menu is not for you!', ephemeral: true });
      }
      const [pokemonId, shinyStr] = i.values[0].split(':');
      const isShiny = shinyStr === 'shiny';
      // Find the selected Pokémon in pokedex
      const selected = pokedex.find(mon => String(mon.pokemonId) === String(pokemonId) && !!mon.isShiny === isShiny);
      // Get name for config lookup
      const pokeName = selected?.name?.toLowerCase();
      const rarity = customSpawnRates[pokeName]?.rarity || 'common';
      const multiplier = rarityMultipliers[rarity];
      const count = baseValue * multiplier;
      await i.deferUpdate();
      // Call backend evolution endpoint
      try {
        const res = await axios.post(`${backendUrl}/users/${userId}/evolve-duplicate`, {
          pokemonId: Number(pokemonId),
          isShiny,
          count,
          stage: 1 // backend ignores this
        }, { headers: { 'x-guild-id': guildId } });
        const { evolved, ringCharges } = res.data;
        // Fetch evolved Pokémon data for art and details
        let artwork = null, types = '', dexNum = evolved?.pokemonId;
        try {
          const pokeData = await pokeCache.getPokemonDataById(evolved.pokemonId);
          // Use shiny artwork if shiny, else normal
          if (evolved.isShiny && pokeData.sprites.other['official-artwork'].front_shiny) {
            artwork = pokeData.sprites.other['official-artwork'].front_shiny;
          } else if (pokeData.sprites.other['official-artwork'].front_default) {
            artwork = pokeData.sprites.other['official-artwork'].front_default;
          } else if (evolved.isShiny && pokeData.sprites.front_shiny) {
            artwork = pokeData.sprites.front_shiny;
          } else if (pokeData.sprites.front_default) {
            artwork = pokeData.sprites.front_default;
          }
          types = pokeData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
          dexNum = pokeData.id;
        } catch {}
        const embed = new EmbedBuilder()
          .setTitle('Evolution Successful!')
          .setDescription(`Your Pokémon evolved to the next stage!\nRing charges left: ${ringCharges}`)
          .setColor(0x2ecc71);
        if (evolved && evolved.pokemonId) {
          embed.addFields({ name: 'New Pokémon', value: `#${dexNum} ${evolved.name || ''}` });
        }
        if (types) embed.addFields({ name: 'Type', value: types, inline: true });
        if (artwork) embed.setImage(artwork);
        await interaction.followUp({ embeds: [embed], ephemeral: false });
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to evolve Pokémon.';
        await interaction.followUp({ content: `❌ ${msg}`, ephemeral: true });
      }
      collector.stop();
    });
    collector.on('end', async () => {
      try { await msg.edit({ components: [] }); } catch {}
    });
  }
}; 