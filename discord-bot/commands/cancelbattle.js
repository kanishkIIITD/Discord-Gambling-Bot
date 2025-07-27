const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

const backendApiUrl = process.env.BACKEND_API_URL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancelbattle')
    .setDescription('Cancel your active battle if it\'s stuck'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Check if user has an active battle
      const response = await axios.get(`${backendApiUrl}/battles/active/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });

      const activeBattle = response.data;
      
      if (!activeBattle) {
        await interaction.reply({
          content: '❌ You don\'t have any active battles to cancel.',
          ephemeral: true
        });
        return;
      }

      // Cancel the battle
      await axios.post(`${backendApiUrl}/battles/${activeBattle._id}/cancel`, {
        userId: userId,
        reason: 'User cancelled via command'
      }, {
        headers: { 'x-guild-id': guildId }
      });

      await interaction.reply({
        content: '✅ Your active battle has been cancelled successfully.',
        ephemeral: true
      });

    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to cancel battle.';
      await interaction.reply({
        content: `❌ Could not cancel battle: ${errorMessage}`,
        ephemeral: true
      });
    }
  },
}; 