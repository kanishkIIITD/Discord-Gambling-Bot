const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('redeem-golden-ticket')
    .setDescription('Redeem a golden ticket for 10% of the jackpot pool (7-day cooldown).'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.post(`${backendUrl}/gambling/${userId}/redeem-golden-ticket`, {}, {
        headers: { 'x-guild-id': guildId }
      });
      const { payout, newBalance, jackpotPool, message } = response.data;
      const embed = {
        color: 0xf1c40f,
        title: '🎫 Golden Ticket Redeemed!',
        description: message || `You redeemed a Golden Ticket for ${payout?.toLocaleString('en-US')} points!`,
        fields: [
          { name: 'Payout', value: `${payout?.toLocaleString('en-US') || 'N/A'} points`, inline: true },
          { name: 'New Balance', value: `${newBalance?.toLocaleString('en-US') || 'N/A'} points`, inline: true },
          { name: 'Jackpot Pool', value: `${jackpotPool?.toLocaleString('en-US') || 'N/A'} points`, inline: true }
        ],
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Cooldown error
        await interaction.editReply({
          embeds: [{
            title: '⏳ Cooldown',
            description: error.response.data.message,
            color: 0xffcc00,
            footer: { text: `Requested by ${interaction.user.tag}` },
            timestamp: new Date()
          }]
        });
        return;
      }
      if (error.response && error.response.data && error.response.data.message) {
        // Known backend error (like no ticket, empty jackpot, etc.)
        await interaction.editReply({
          embeds: [{
            title: '❌ Error',
            description: error.response.data.message,
            color: 0xff7675,
            footer: { text: `Requested by ${interaction.user.tag}` },
            timestamp: new Date()
          }]
        });
        return;
      }
      // Only call the generic handler for truly unexpected errors
      await ResponseHandler.handleError(interaction, error, 'Redeem Golden Ticket');
    }
  }
}; 