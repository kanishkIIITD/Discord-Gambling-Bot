const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('beg')
    .setDescription('Beg for coins and see what happens!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;
      const response = await axios.post(`${backendUrl}/users/${userId}/beg`, { guildId }, { headers: { 'x-guild-id': guildId } });
      const { outcome, amount, message, cooldown } = response.data;
      let color = 0x95a5a6;
      if (outcome === 'success') color = 0x2ecc71;
      else if (outcome === 'negative') color = 0xe17055;
      else if (outcome === 'jackpot') color = 0xf1c40f;
      const now = Date.now();
      const cooldownTime = cooldown ? new Date(cooldown).getTime() : 0;
      const fields = [];
      if (cooldownTime > now) {
        // Calculate time remaining in ms
        let timeRemaining = Math.max(0, cooldownTime - now);
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        const timeString = `${minutes}m ${seconds}s`;
        fields.push({ name: 'Next Beg Available', value: timeString, inline: true });
      }
      const embed = {
        color,
        title: '🪙 Beg Result',
        description: message,
        fields,
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      // logger.error('Error in /beg command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        const msg = error.response.data.message;
        // If error is a cooldown, show a cooldown embed instead of error embed
        if (msg.toLowerCase().includes('cooldown') || msg.toLowerCase().includes('wait') || msg.toLowerCase().includes('try again')) {
          // Try to extract cooldown time from error, fallback to 60s
          let cooldownTime = 0;
          if (error.response.data.cooldown) {
            cooldownTime = new Date(error.response.data.cooldown).getTime();
          } else if (error.response.data.nextBeg || error.response.data.nextBegTime) {
            cooldownTime = new Date(error.response.data.nextBeg || error.response.data.nextBegTime).getTime();
          } else {
            cooldownTime = Date.now() + 60000; // fallback 1 min
          }
          // Calculate time remaining in ms
          const now = Date.now();
          let timeRemaining = Math.max(0, cooldownTime - now);
          const minutes = Math.floor(timeRemaining / 60000);
          const seconds = Math.floor((timeRemaining % 60000) / 1000);
          const timeString = `${minutes}m ${seconds}s`;
          const embed = {
            color: 0xffbe76,
            title: '⏳ Beg Cooldown',
            description: msg,
            // fields: [
            //   { name: 'Time Remaining', value: timeString, inline: true }
            // ],
            timestamp: new Date(),
            footer: { text: `Requested by ${interaction.user.tag}` }
          };
          await interaction.editReply({ embeds: [embed] });
          return;
        } else {
          await ResponseHandler.handleError(interaction, { message: msg }, 'Beg');
          return;
        }
      } else {
        await ResponseHandler.handleError(interaction, error, 'Beg');
        return;
      }
    }
  },
}; 