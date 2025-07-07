const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpokechannel')
    .setDescription('Set this channel as the Pokémon spawn channel for your server (admin only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only admins can use this command.', ephemeral: true });
    }
    const backendUrl = process.env.BACKEND_API_URL;
    try {
      await axios.post(`${backendUrl}/servers/${interaction.guildId}/pokechannel`, {
        channelId: interaction.channelId
      });
      await interaction.reply({ content: 'This channel is now set as the Pokémon spawn channel!', ephemeral: true });
    } catch (err) {
      console.error('Failed to set Pokémon spawn channel:', err);
      await interaction.reply({ content: 'Failed to set the Pokémon spawn channel. Please try again later.', ephemeral: true });
    }
  },
}; 