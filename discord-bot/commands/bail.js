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
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('all')
        .setDescription('Bail all jailed users in the server')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const target = interaction.options.getUser('user');
      const bailAll = interaction.options.getBoolean('all') || false;
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;

      // Validate input
      if (!bailAll && !target) {
        await ResponseHandler.handleError(interaction, { message: 'Please specify either a user to bail or set "all" to true to bail all jailed users.' }, 'Bail');
        return;
      }

      if (bailAll && target) {
        await ResponseHandler.handleError(interaction, { message: 'Cannot specify both a user and "all" option. Please choose one or the other.' }, 'Bail');
        return;
      }

      if (bailAll) {
        // Bail all jailed users
        logger.info(`[BAIL] Attempting to bail all jailed users by ${userId}`);
        const response = await axios.post(`${backendUrl}/users/${userId}/bail-all`, { guildId }, { headers: { 'x-guild-id': guildId } });
        logger.info('[BAIL] Backend call succeeded. Preparing embed.');
        const { message, totalCost, bailedUsers, failedUsers } = response.data;
        
        let embed;
        if (bailedUsers.length > 0) {
          embed = {
            color: 0x0099ff,
            title: '🪙 Mass Bail Result',
            description: message,
            fields: [
              { name: 'Total Cost', value: `${totalCost?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || 'N/A'} points`, inline: true },
              { name: 'Users Bailed', value: `${bailedUsers?.length || 0}`, inline: true },
              { name: 'Failed Bails', value: `${failedUsers?.length || 0}`, inline: true }
            ],
            timestamp: new Date(),
            footer: { text: `Requested by ${interaction.user.tag}` }
          };
          // Add details about bailed users if any
          if (bailedUsers && bailedUsers.length > 0) {
            const bailedList = bailedUsers.map(u => `<@${u.discordId}>`).join(', ');
            embed.fields.push({ name: 'Successfully Bailed', value: bailedList, inline: false });
          }
          // Add details about failed bails if any
          if (failedUsers && failedUsers.length > 0) {
            const failedList = failedUsers.map(u => `<@${u.discordId}>: ${u.reason}`).join('\n');
            embed.fields.push({ name: 'Failed Bails', value: failedList, inline: false });
          }
        } else {
          // All failed
          embed = {
            color: 0xff7675,
            title: '❌ Mass Bail Failed',
            description: 'Failed to bail out any users.',
            fields: [
              { name: 'Total Cost', value: `${totalCost?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || 'N/A'} points`, inline: true },
              { name: 'Users Bailed', value: '0', inline: true },
              { name: 'Failed Bails', value: `${failedUsers?.length || 0}`, inline: true }
            ],
            timestamp: new Date(),
            footer: { text: `Requested by ${interaction.user.tag}` }
          };
          if (failedUsers && failedUsers.length > 0) {
            const failedList = failedUsers.map(u => `<@${u.discordId}>: ${u.reason}`).join('\n');
            embed.fields.push({ name: 'Failed Bails', value: failedList, inline: false });
          }
        }
        await interaction.editReply({ embeds: [embed] });
        logger.info('[BAIL] Reply sent successfully.');
        return;
      } else {
        // Bail single user (original functionality)
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
      }
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