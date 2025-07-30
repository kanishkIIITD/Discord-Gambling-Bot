const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const customSpawnRates = require('../data/customSpawnRates.json');
const pokeCache = require('../utils/pokeCache');
const { getEmojiString } = require('../utils/emojiConfig');

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
      common: 6,
      uncommon: 5,
      rare: 4,
      legendary: null // lockout
    };
    const baseValue = 1;
    const calcNeededDupes = (isShiny, rarity) =>
      isShiny
        ? 2
        : baseValue * rarityMultipliers[rarity];
    // Filter eligible Pokémon (duplicates, can evolve, etc.)
    const eligible = pokedex.filter(mon => {
      const pokeName = mon.name.toLowerCase();
      const rarity    = customSpawnRates[pokeName]?.rarity || 'common';
      const canEvolve = customSpawnRates[pokeName]?.canEvolve || false;
      const multiplier = rarityMultipliers[rarity];
      if (!canEvolve) return false; // cannot evolve
    
      const requiredDupes = calcNeededDupes(mon.isShiny, rarity);
      return (mon.count || 1) >= requiredDupes;
    });
    if (eligible.length === 0) {
      return interaction.editReply('You do not have any eligible duplicate Pokémon to evolve. You need enough duplicates of a Pokémon that can evolve.');
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
    const msg = await interaction.editReply({ content: `Select a Pokémon to evolve using your Evolver's Ring (${ringCharges} charges left):`, components: [selectRow], ephemeral: true });
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
      const count = calcNeededDupes(isShiny, rarity);
      await i.deferUpdate();
      // Call backend evolution endpoint
      try {
        console.log('[pokeevolve] Sending evolve-duplicate request:', {
          pokemonId: Number(pokemonId),
          isShiny,
          count,
          stage: 1
        });
        const res = await axios.post(`${backendUrl}/users/${userId}/evolve-duplicate`, {
          pokemonId: Number(pokemonId),
          isShiny,
          count,
          stage: 1 // backend ignores this
        }, { headers: { 'x-guild-id': guildId } });
        console.log('[pokeevolve] evolve-duplicate response:', res.data);
        // If multiple possible evolutions, show a select menu for the user to choose
        if (res.data && res.data.possibleEvolutions) {
          // Fetch names and images for each possible evolution
          const evoOptions = await Promise.all(res.data.possibleEvolutions.map(async evoId => {
            const evoData = await pokeCache.getPokemonDataById(evoId);
            return {
              label: `#${evoData.id.toString().padStart(3, '0')} ${evoData.name.charAt(0).toUpperCase() + evoData.name.slice(1)}`,
              value: String(evoId),
              description: evoData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ')
              // Removed emoji property with custom URL, as Discord.js select menus do not support arbitrary image URLs for emoji
            };
          }));
          const evoSelectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('pokeevolve_evo_select')
              .setPlaceholder('Select an evolution')
              .addOptions(evoOptions)
          );
          await interaction.followUp({ content: 'Select which evolution you want:', components: [evoSelectRow], ephemeral: true });
          // Collector for evolution select
          const evoCollector = interaction.channel.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });
          evoCollector.on('collect', async evoI => {
            if (evoI.user.id !== interaction.user.id) {
              return evoI.reply({ content: 'This select menu is not for you!', ephemeral: true });
            }
            const chosenEvoId = Number(evoI.values[0]);
            console.log('[pokeevolve] User selected evolutionId:', chosenEvoId);
            await evoI.deferUpdate();
            // Call backend again with chosen evolutionId
            try {
              console.log('[pokeevolve] Sending evolve-duplicate request with evolutionId:', {
                pokemonId: Number(pokemonId),
                isShiny,
                count,
                stage: 1,
                evolutionId: chosenEvoId
              });
              const finalRes = await axios.post(`${backendUrl}/users/${userId}/evolve-duplicate`, {
                pokemonId: Number(pokemonId),
                isShiny,
                count,
                stage: 1,
                evolutionId: chosenEvoId
              }, { headers: { 'x-guild-id': guildId } });
              console.log('[pokeevolve] evolve-duplicate response (with evolutionId):', finalRes.data);
              const { evolved, ringCharges } = finalRes.data;
              let artwork = null, types = '', dexNum = evolved?.pokemonId;
              try {
                const pokeData = await pokeCache.getPokemonDataById(evolved.pokemonId);
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
              // Place shinyMark logic before embed creation
              const shinyMark = evolved && evolved.isShiny ? ' ✨' : '';
              const embed = new EmbedBuilder()
                .setTitle(`${getEmojiString('pokeball')} Evolution Successful!${shinyMark}`)
                .setDescription(`<@${interaction.user.id}> evolved their Pokémon!${shinyMark}\nYour Pokémon evolved to the next stage!${shinyMark}\nRing charges left: ${ringCharges}`)
                .setColor(0x2ecc71);
              if (evolved && evolved.pokemonId) {
                embed.addFields({ name: 'New Pokémon', value: `#${dexNum} ${evolved.name || ''}${shinyMark}` });
              }
              if (types) embed.addFields({ name: 'Type', value: types, inline: true });
              if (artwork) embed.setImage(artwork);
              await interaction.followUp({ embeds: [embed], ephemeral: false });
            } catch (err) {
              console.error('[pokeevolve] Error in evolve-duplicate (with evolutionId):', err?.response?.data || err);
              const msg = err.response?.data?.message || 'Failed to evolve Pokémon.';
              await interaction.followUp({ content: `❌ ${msg}`, ephemeral: true });
            }
            evoCollector.stop();
          });
          evoCollector.on('end', async () => {
            try { await interaction.editReply({ components: [] }); } catch {}
          });
          return;
        }
        // Otherwise, proceed as before
        const { evolved, ringCharges } = res.data;
        let artwork = null, types = '', dexNum = evolved?.pokemonId;
        try {
          const pokeData = await pokeCache.getPokemonDataById(evolved.pokemonId);
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
        // Place shinyMark logic before embed creation
        const shinyMark = evolved && evolved.isShiny ? ' ✨' : '';
        const embed = new EmbedBuilder()
          .setTitle(`${getEmojiString('pokeball')} Evolution Successful!${shinyMark}`)
          .setDescription(`<@${interaction.user.id}> evolved their Pokémon!${shinyMark}\nYour Pokémon evolved to the next stage!${shinyMark}\nRing charges left: ${ringCharges}`)
          .setColor(0x2ecc71);
        if (evolved && evolved.pokemonId) {
          embed.addFields({ name: 'New Pokémon', value: `#${dexNum} ${evolved.name || ''}${shinyMark}` });
        }
        if (types) embed.addFields({ name: 'Type', value: types, inline: true });
        if (artwork) embed.setImage(artwork);
        await interaction.followUp({ embeds: [embed], ephemeral: false });
      } catch (err) {
        console.error('[pokeevolve] Error in evolve-duplicate:', err?.response?.data || err);
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