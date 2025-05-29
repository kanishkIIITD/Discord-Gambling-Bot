const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection-leaderboard')
    .setDescription('View the top collectors by collection value!')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of users to show (default: 5)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const backendUrl = process.env.BACKEND_API_URL;
      const limit = interaction.options.getInteger('limit') || 5;
      const guildId = interaction.guildId;
      const response = await axios.get(`${backendUrl}/users/collection-leaderboard`, { params: { limit, guildId }, headers: { 'x-guild-id': guildId } });
      const leaderboard = response.data.data || [];
      if (leaderboard.length === 0) {
        const embed = {
          color: 0x95a5a6,
          title: '🏆 Collection Leaderboard',
          description: 'No collections found yet! Try `/fish` or `/hunt` to start collecting.',
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      const fields = leaderboard.map((u, i) => ({
        name: `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`} ${u.username}`,
        value: `Total Value: **${u.totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** points\nItems: **${u.itemCount}**\n<@${u.discordId}>`,
        inline: false
      }));
      const embed = {
        color: 0xf1c40f,
        title: '🏆 Collection Leaderboard',
        description: `Top collectors by total collection value:`,
        fields,
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      logger.error('Error in /collection-leaderboard command:', error);
      await ResponseHandler.handleError(interaction, error, 'Collection Leaderboard');
      return;
    }
  },
}; 