const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const { getCurrentGenInfo, getPreviousGenInfo } = require('../config/generationConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpokechannel')
    .setDescription('Set this channel as the Pokémon spawn channel for your server (admin only).')
    .addStringOption(option =>
      option.setName('generation')
        .setDescription('Which generation of Pokémon to spawn in this channel')
        .setRequired(true)
        .addChoices(
          { name: `Current Generation (${getCurrentGenInfo().description})`, value: 'current' },
          { name: `Previous Generation (${getPreviousGenInfo().description})`, value: 'previous' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only admins can use this command.', ephemeral: true });
    }
    
    const generation = interaction.options.getString('generation');
    const backendUrl = process.env.BACKEND_API_URL;
    
    try {
      const response = await axios.post(`${backendUrl}/servers/${interaction.guildId}/pokechannel`, {
        channelId: interaction.channelId,
        generation: generation
      });
      
      const genName = generation === 'current' 
        ? `Current Generation (${getCurrentGenInfo().description})` 
        : `Previous Generation (${getPreviousGenInfo().description})`;
      await interaction.reply({ 
        content: `This channel is now set as the ${genName} Pokémon spawn channel!`, 
        ephemeral: true 
      });
    } catch (err) {
      console.error('Failed to set Pokémon spawn channel:', err);
      await interaction.reply({ content: 'Failed to set the Pokémon spawn channel. Please try again later.', ephemeral: true });
    }
  },
}; 