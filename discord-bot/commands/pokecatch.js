const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pokeCache = require('../utils/pokeCache');
const { activeSpawns } = require('./pokespawn');
const fetch = require('node-fetch');
const axios = require('axios');

const SHINY_ODDS = 1 / 512;

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
    const spawn = activeSpawns.get(channelId);
    if (!spawn) {
      return interaction.reply({ content: 'There is no wild Pokémon to catch in this channel. Ask an admin to use /pokespawn!', ephemeral: true });
    }
    if (spawn.caughtBy) {
      return interaction.reply({ content: `This Pokémon has already been caught by <@${spawn.caughtBy}>!`, ephemeral: true });
    }
    // Prevent same user from trying more than once per spawn
    if (!spawn.attemptedBy) spawn.attemptedBy = [];
    if (spawn.attemptedBy.includes(interaction.user.id)) {
      return interaction.reply({ content: 'You have already tried to catch this Pokémon. Wait for the next spawn!', ephemeral: true });
    }
    const pokemonId = spawn.pokemonId;
    const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
    // Fetch species data for capture_rate, dex number, and flavor text
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}/`);
    const speciesData = await speciesRes.json();
    const captureRate = speciesData.capture_rate;
    const dexNum = speciesData.id;
    // Get random English flavor text
    const flavorEntries = speciesData.flavor_text_entries.filter(e => e.language.name === 'en');
    const flavorText = flavorEntries.length > 0
      ? flavorEntries[Math.floor(Math.random() * flavorEntries.length)].flavor_text.replace(/\f/g, ' ')
      : '';
    // Calculate catch chance (normalize 0-1)
    const baseChance = captureRate / 255;
    const finalChance = Math.min(baseChance, 0.95); // Cap at 95%
    const roll = Math.random();
    const isShiny = Math.random() < SHINY_ODDS;
    // Get types
    const types = pokemonData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
    // Use official artwork for large image
    const artwork = isShiny && pokemonData.sprites.other['official-artwork'].front_shiny ? pokemonData.sprites.other['official-artwork'].front_shiny : pokemonData.sprites.other['official-artwork'].front_default;
    let embed;
    if (roll < finalChance) {
      // Success
      // Save to backend
      try {
        const backendUrl = process.env.BACKEND_API_URL;
        await axios.post(`${backendUrl}/users/${interaction.user.id}/pokemon/catch`, {
          pokemonId,
          name: pokemonData.name,
          isShiny
        }, {
          headers: { 'x-guild-id': interaction.guildId }
        });
      } catch (err) {
        console.error('Failed to save caught Pokémon:', err);
        // Continue, but inform user
        embed = new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle(`⚠️ You caught ${isShiny ? 'a SHINY ' : ''}#${dexNum.toString().padStart(3, '0')} ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)}!`)
          .setImage(artwork)
          .addFields(
            { name: 'Type', value: types, inline: true },
            { name: 'Region', value: 'Kanto', inline: true },
            { name: 'Catch Chance', value: `${Math.round(finalChance * 100)}%`, inline: true },
            { name: 'Shiny', value: isShiny ? 'Yes ✨' : 'No', inline: true }
          )
          .setDescription('You caught the Pokémon, but there was an error saving it to your collection. Please contact an admin.')
          .setFooter({ text: 'Gotta catch ’em all!' });
        activeSpawns.delete(channelId);
        return await interaction.reply({ embeds: [embed] });
      }
      // Mark as caught
      spawn.caughtBy = interaction.user.id;
      spawn.attemptedBy.push(interaction.user.id);
      activeSpawns.set(channelId, spawn);
      activeSpawns.delete(channelId);
      embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`🎉 You caught ${isShiny ? 'a SHINY ' : ''}#${dexNum.toString().padStart(3, '0')} ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)}!`)
        .setImage(artwork)
        .addFields(
          { name: 'Type', value: types, inline: true },
          { name: 'Region', value: 'Kanto', inline: true },
          { name: 'Catch Chance', value: `${Math.round(finalChance * 100)}%`, inline: true },
          { name: 'Shiny', value: isShiny ? 'Yes ✨' : 'No', inline: true }
        )
        .setDescription(flavorText || (isShiny ? '✨ Incredible! You caught a shiny Pokémon! ✨' : 'Congratulations! The wild Pokémon is now yours.'))
        .setFooter({ text: 'Gotta catch ’em all!' });
      return await interaction.reply({ embeds: [embed] });
    } else {
      // Failure
      // Increment attempts
      spawn.attempts = (spawn.attempts || 0) + 1;
      spawn.attemptedBy.push(interaction.user.id);
      if (spawn.attempts >= 3) {
        // Despawn and update message
        const goneEmbed = new EmbedBuilder()
          .setColor(0x636e72)
          .setTitle(`The wild #${dexNum.toString().padStart(3, '0')} ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} ran away!`)
          .setDescription(`No one was able to catch ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} after 3 attempts.`)
          .setImage(artwork);
        // Try to update the original spawn message if possible
        try {
          const channel = await interaction.client.channels.fetch(channelId);
          const msg = await channel.messages.fetch(spawn.messageId);
          await msg.edit({ embeds: [goneEmbed] });
        } catch (e) { /* ignore */ }
        activeSpawns.delete(channelId);
        embed = goneEmbed;
        return await interaction.reply({ embeds: [embed] });
      } else {
        // Update the spawn with incremented attempts
        activeSpawns.set(channelId, spawn);
        embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`Oh no! The #${dexNum.toString().padStart(3, '0')} ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} broke free!`)
          .setImage(artwork)
          .addFields(
            { name: 'Type', value: types, inline: true },
            { name: 'Region', value: 'Kanto', inline: true },
            { name: 'Catch Chance', value: `${Math.round(finalChance * 100)}%`, inline: true },
            { name: 'Attempts Left', value: `${3 - spawn.attempts}`, inline: true }
          )
          .setDescription(flavorText || 'Better luck next time! The wild Pokémon is still here, but will run after 3 failed attempts.')
          .setFooter({ text: 'Wait for another wild Pokémon.' });
        return await interaction.reply({ embeds: [embed] });
      }
    }
  },
}; 