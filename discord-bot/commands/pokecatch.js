const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const pokeCache = require('../utils/pokeCache');
const { activeSpawns } = require('./pokespawn');
const { manualDespawnTimers } = require('./pokespawn');
const axios = require('axios');

const SHINY_ODDS = 1 / 1024;

// Helper function to get display name for Pokémon
function getDisplayName(pokemonName) {
  if (pokemonName.toLowerCase() === 'rattata') {
    return 'joanatta';
  }
  else if (pokemonName.toLowerCase() === 'bellsprout') {
    return 'mohasprout';
  }
  return pokemonName;
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokecatch')
    .setDescription('Try to catch the wild Pokémon in this channel!'),

  async execute(interaction) {
    if (!pokeCache.isKantoCacheReady()) {
      return interaction.reply({
        content: 'Pokémon data is still loading. Please try again in a few seconds!',
        ephemeral: true
      });
    }
    const channelId = interaction.channelId;
    let spawn = activeSpawns.get(channelId);
    if (!spawn) {
      return interaction.reply({ content: 'There is no wild Pokémon to catch in this channel. Ask an admin to use /pokespawn!', ephemeral: true });
    }
    // ATOMICITY: re-fetch spawn from activeSpawns after any async operation
    // (No need to check spawn.caughtBy for single-catch logic anymore)
    // Prevent same user from trying more than once per spawn
    if (!spawn.attemptedBy) spawn.attemptedBy = [];
    if (!spawn.caughtBy) spawn.caughtBy = [];
    if (spawn.attemptedBy.includes(interaction.user.id)) {
      return interaction.reply({ content: 'You have already tried to catch this Pokémon. Wait for the next spawn!', ephemeral: true });
    }
    // If despawned (should not happen, but just in case)
    if (!activeSpawns.has(channelId)) {
      return interaction.reply({ content: 'The Pokémon has already run away!', ephemeral: true });
    }
    const pokemonId = spawn.pokemonId;
    const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
    const backendUrl = process.env.BACKEND_API_URL;
    // Fetch user's Poké Ball inventory
    let user;
    try {
      const userRes = await axios.get(`${backendUrl}/users/${interaction.user.id}`, { headers: { 'x-guild-id': interaction.guildId } });
      user = userRes.data.user || userRes.data;
    } catch (e) {
      return interaction.reply({ content: 'Failed to fetch your Poké Ball inventory. Please try again later.', ephemeral: true });
    }
    // Build Poké Ball selection buttons
    const buttons = [];
    buttons.push(new ButtonBuilder()
      .setCustomId('pokecatch_normal')
      .setLabel('Poké Ball')
      .setStyle(ButtonStyle.Primary)
    );
    if ((user.poke_rareball_uses || 0) > 0) {
      buttons.push(new ButtonBuilder()
        .setCustomId('pokecatch_rare')
        .setLabel(`Rare Ball (${user.poke_rareball_uses})`)
        .setStyle(ButtonStyle.Success)
      );
    }
    if ((user.poke_ultraball_uses || 0) > 0) {
      buttons.push(new ButtonBuilder()
        .setCustomId('pokecatch_ultra')
        .setLabel(`Ultra Ball (${user.poke_ultraball_uses})`)
        .setStyle(ButtonStyle.Danger)
      );
    }
    const row = new ActionRowBuilder().addComponents(buttons);
    // Show artwork and ask for ball selection
    const artwork = pokemonData.sprites.other['official-artwork'].front_default;
    const displayName = capitalizeFirst(getDisplayName(pokemonData.name));
    const promptEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`A wild ${displayName} appeared!`)
      .setImage(artwork)
      .setDescription('Which Poké Ball would you like to use?');
    await interaction.reply({ embeds: [promptEmbed], components: [row], ephemeral: true });
    // Wait for button interaction
    const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('pokecatch_');
    try {
      const buttonInt = await interaction.channel.awaitMessageComponent({ filter, time: 20000, componentType: ComponentType.Button });
      await buttonInt.deferUpdate();
      // --- FIX: Re-check if the Pokémon is still present after button selection ---
      if (!activeSpawns.has(channelId)) {
        return interaction.followUp({ content: 'The Pokémon has already run away!', ephemeral: true });
      }
      // Mark as attempted
      spawn.attemptedBy.push(interaction.user.id);
      spawn.attempts = (spawn.attempts || 0) + 1;
      activeSpawns.set(channelId, spawn);
      // Re-fetch spawn after asyncs to ensure no one else has caught it
      spawn = activeSpawns.get(channelId);
      // Determine ball type
      let ballType = 'normal';
      if (buttonInt.customId === 'pokecatch_rare') ballType = 'rare';
      if (buttonInt.customId === 'pokecatch_ultra') ballType = 'ultra';
      // Random shiny roll (keep in bot for now)
      const isShiny = Math.random() < SHINY_ODDS;
      // Call backend catch endpoint
      let result;
      try {
        result = await axios.post(`${backendUrl}/users/${interaction.user.id}/pokemon/attempt-catch`, {
          pokemonId,
          name: pokemonData.name,
          isShiny,
          ballType
        }, {
          headers: { 'x-guild-id': interaction.guildId }
        });
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to attempt catch.';
        return interaction.followUp({ content: `❌ ${msg}`, ephemeral: true });
      }
      const data = result.data;
      // Calculate attempts left
      const attemptsLeft = 5 - spawn.attempts;
      // Build result embed
      const types = pokemonData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
      const region = 'Kanto';
      // Select artwork: shiny if shiny, else normal
      let resultArtwork = artwork;
      if (data.embedData?.isShiny) {
        if (pokemonData.sprites.other?.['official-artwork']?.front_shiny) {
          resultArtwork = pokemonData.sprites.other['official-artwork'].front_shiny;
        } else if (pokemonData.sprites.front_shiny) {
          resultArtwork = pokemonData.sprites.front_shiny;
        }
      }
      const embed = new EmbedBuilder()
        .setColor(data.success ? 0x2ecc71 : 0xe74c3c)
        .setTitle(data.embedData?.title || (data.success ? 'Pokémon Caught!' : 'Catch Failed'))
        .setImage(resultArtwork)
        .addFields(
          { name: 'Type', value: types, inline: true },
          { name: 'Region', value: region, inline: true },
          { name: 'Ball Used', value: data.ballUsed || ballType, inline: true },
          { name: 'Catch Chance', value: data.embedData?.catchChance || '?', inline: true },
          { name: 'Shiny', value: data.embedData?.isShiny ? 'Yes ✨' : 'No', inline: true }
        )
        .setFooter({ text: 'Gotta catch \'em all!' });
      // Add extra fields if present
      if (data.xpAward) embed.addFields({ name: 'XP Gained', value: `${data.xpAward}`, inline: true });
      if (data.dustAward) embed.addFields({ name: 'Dust Gained', value: `${data.dustAward}`, inline: true });
      if (data.xpBoosterUsed) embed.addFields({ name: 'XP Booster', value: '2x XP!', inline: true });
      
      // Check for double weekend event
      if (data.doubleWeekendActive) {
        embed.addFields({ name: '🎉 Double Weekend', value: `${data.doubleWeekendMultiplier}x Rewards!`, inline: true });
      }
      if (data.isDuplicate) embed.addFields({ name: 'Duplicate', value: 'Yes', inline: true });
      if (data.newLevel) embed.addFields({ name: 'Level Up!', value: `Level ${data.newLevel}`, inline: true });
      if (data.newlyUnlocked && data.newlyUnlocked.length > 0) embed.addFields({ name: 'Unlocked', value: data.newlyUnlocked.join(', '), inline: false });
      // Set description to mention the user who caught it
      if (data.success) {
        embed.setDescription(`<@${interaction.user.id}> caught the wild Pokémon!`);
      } else {
        embed.setDescription(data.embedData?.description || 'Better luck next time!');
      }
      // Mark as caught if successful
      if (data.success) {
        spawn = activeSpawns.get(channelId);
        if (!spawn.caughtBy.includes(interaction.user.id)) {
          spawn.caughtBy.push(interaction.user.id);
          activeSpawns.set(channelId, spawn);
        }
      } else {
        activeSpawns.set(channelId, spawn);
      }
      await interaction.followUp({ embeds: [embed], ephemeral: false });
    } catch (e) {
      return interaction.followUp({ content: 'No Poké Ball selected or time expired. Try again!', ephemeral: true });
    }
  },
}; 