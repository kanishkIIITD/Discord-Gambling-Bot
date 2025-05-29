const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bail')
    .setDescription('Bail a jailed user out of jail (for a fee)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to bail out')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const target = interaction.options.getUser('user');
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;
      logger.info(`[BAIL] Attempting to bail out user ${target.id} by ${userId}`);
      const response = await axios.post(`${backendUrl}/users/${userId}/bail`, { targetDiscordId: target.id, guildId }, { headers: { 'x-guild-id': guildId } });
      logger.info('[BAIL] Backend call succeeded. Preparing embed.');
      const { message, bailCost, minutesLeft } = response.data;
      const embed = {
        color: 0x0099ff,
        title: '🪙 Bail Result',
        description: message,
        fields: [
          { name: 'Bail Cost', value: `${bailCost?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || 'N/A'} points`, inline: true },
          { name: 'Minutes Left (before bail)', value: `${minutesLeft ?? 'N/A'}`, inline: true }
        ],
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
      logger.info('[BAIL] Reply sent successfully.');
      return;
    } catch (error) {
      logger.error('Error in /bail command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Bail');
        return;
      } else {
        await ResponseHandler.handleError(interaction, error, 'Bail');
        return;
      }
    }
  },
}; 