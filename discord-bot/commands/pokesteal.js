const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const customSpawnRates = require('../data/customSpawnRates.json');
const { getAnimatedEmojiString } = require('../utils/emojiConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokesteal')
    .setDescription('Superadmin: Steal a random common Pokémon from a user')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to steal a Pokémon from')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('target');
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Check if the user is a superadmin
      const userResponse = await axios.get(`${backendUrl}/users/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const user = userResponse.data.user || userResponse.data;
      
      if (user.role !== 'superadmin') {
        return interaction.editReply({
          content: '❌ You do not have permission to use this command. Only BigDog superadmins can steal Pokémon.',
          ephemeral: true
        });
      }

      // Fetch target user's Pokémon collection
      const targetResponse = await axios.get(`${backendUrl}/users/${targetUser.id}/pokedex`, {
        headers: { 'x-guild-id': guildId }
      });

      const targetPokedex = targetResponse.data.pokedex || [];
      
      if (!targetPokedex || targetPokedex.length === 0) {
        return interaction.editReply({
          content: `❌ ${targetUser.username} has no Pokémon to steal.`,
          ephemeral: true
        });
      }

      // Filter for common Pokémon with count > 0
      const commonPokemon = targetPokedex.filter(mon => {
        const rarity = customSpawnRates[mon.name.toLowerCase()]?.rarity || 'common';
        return rarity === 'common' && (mon.count || 1) > 0;
      });

      if (commonPokemon.length === 0) {
        return interaction.editReply({
          content: `❌ ${targetUser.username} has no common Pokémon to steal.`,
          ephemeral: true
        });
      }

      // Randomly select a common Pokémon
      const randomIndex = Math.floor(Math.random() * commonPokemon.length);
      const stolenPokemon = commonPokemon[randomIndex];

      // Call backend to steal the Pokémon
      const stealResponse = await axios.post(`${backendUrl}/users/${targetUser.id}/pokemon/steal`, {
        pokemonId: stolenPokemon.pokemonId,
        isShiny: stolenPokemon.isShiny || false,
        count: 1,
        stolenBy: userId
      }, {
        headers: { 'x-guild-id': guildId }
      });

      if (stealResponse.data.success) {
        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`${getAnimatedEmojiString('mew_kiss')} Pokémon Stolen!`)
          .setDescription(`**Superadmin:** <@${userId}>\n**Target:** <@${targetUser.id}>\n**Stolen Pokémon:** ${stolenPokemon.name.charAt(0).toUpperCase() + stolenPokemon.name.slice(1)}${stolenPokemon.isShiny ? ' ✨' : ''}`)
          .addFields(
            { name: 'Pokémon ID', value: `#${stolenPokemon.pokemonId.toString().padStart(3, '0')}`, inline: true },
            { name: 'Rarity', value: 'Common', inline: true },
            { name: 'Shiny', value: stolenPokemon.isShiny ? 'Yes' : 'No', inline: true }
          )
          .setFooter({ text: 'Superadmin action logged' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: false });
      } else {
        await interaction.editReply({
          content: `❌ Failed to steal Pokémon: ${stealResponse.data.message || 'Unknown error'}`,
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('[Pokesteal] Error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to steal Pokémon.';
      await interaction.editReply({
        content: `❌ ${errorMessage}`,
        ephemeral: true
      });
    }
  }
}; 