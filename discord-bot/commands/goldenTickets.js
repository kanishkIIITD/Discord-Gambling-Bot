const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('golden-tickets')
    .setDescription('Check how many golden tickets you have!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.get(`${backendUrl}/gambling/${userId}/golden-tickets`, {
        headers: { 'x-guild-id': guildId }
      });
      const count = response.data.goldenTicketCount || 0;
      const embed = {
        color: 0xf1c40f,
        title: '🎫 Golden Tickets',
        description: `You have **${count}** golden ticket${count === 1 ? '' : 's'}.\nUse /redeem-golden-ticket to redeem one for 10% of the jackpot!`,
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await ResponseHandler.handleError(interaction, error, 'Golden Tickets');
    }
  }
}; 