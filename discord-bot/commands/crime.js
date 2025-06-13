const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Attempt a crime for a chance to win or lose points, or get jailed!')
    .addSubcommand(sub =>
      sub.setName('do')
        .setDescription('Attempt a crime!')
    )
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View your crime stats')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'stats') {
      try {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const backendUrl = process.env.BACKEND_API_URL;
        const guildId = interaction.guildId;
        const statsRes = await axios.get(`${backendUrl}/users/${userId}/crime-stats`, { params: { guildId }, headers: { 'x-guild-id': guildId } });
        const stats = statsRes.data.crimeStats || { success: 0, fail: 0, jail: 0 };
        const embed = {
          color: 0x0099ff,
          title: '🧙 Crime Stats',
          fields: [
            { name: 'Successes', value: stats.success.toString(), inline: true },
            { name: 'Failures', value: stats.fail.toString(), inline: true },
            { name: 'Jailed', value: stats.jail.toString(), inline: true }
          ],
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      } catch (error) {
        logger.error('Error in /crime stats:', error);
        await ResponseHandler.handleError(interaction, error, 'Crime Stats');
        return;
      }
    }
    // Default: attempt a crime
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;
      const response = await axios.post(`${backendUrl}/users/${userId}/crime`, { guildId }, { headers: { 'x-guild-id': guildId } });
      const { outcome, amount, jailMinutes, message, cooldown, jailedUntil } = response.data;

      let color = 0x0099ff;
      if (outcome === 'success') color = 0x00ff00;
      else if (outcome === 'fail') color = 0xffa500;
      else if (outcome === 'jail') color = 0xff0000;

      // Extract buff messages from the main message
      let mainMessage = message;
      let buffMessages = [];
      
      // Extract earnings buff
      const earningsMatch = message.match(/\((earnings_x\d buff active: (\dx) POINTS!)\)/i);
      if (earningsMatch) {
        buffMessages.push(earningsMatch[1]);
        mainMessage = mainMessage.replace(earningsMatch[0], '').trim();
      }

      // Extract crime success buff
      if (message.includes('Your buff guaranteed a successful crime!')) {
        buffMessages.push('Crime Success Buff: Guaranteed success!');
        mainMessage = mainMessage.replace('Your buff guaranteed a successful crime! ', '');
      }

      // Extract jail immunity buff
      if (message.includes('Your jail immunity buff saved you from jail!')) {
        buffMessages.push('Jail Immunity Buff: Saved from jail!');
        mainMessage = mainMessage.replace('Your jail immunity buff saved you from jail! ', '');
      }

      const embed = {
        color,
        title: '🧙 Crime Result',
        description: mainMessage,
        fields: [
          { name: 'Next Crime Available', value: `<t:${Math.floor(new Date(cooldown).getTime()/1000)}:R>`, inline: true }
        ],
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };

      if (outcome === 'jail') {
        embed.fields.push({ name: 'Jailed Until', value: `<t:${Math.floor(new Date(jailedUntil).getTime()/1000)}:R>`, inline: true });
      }

      // Add buffs field if there are any buffs
      if (buffMessages.length > 0) {
        embed.fields.push({
          name: '✨ Buffs Used',
          value: buffMessages.join('\n'),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      logger.error('Error in /crime command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Crime');
        return;
      } else {
        await ResponseHandler.handleError(interaction, error, 'Crime');
        return;
      }
    }
  },
}; 