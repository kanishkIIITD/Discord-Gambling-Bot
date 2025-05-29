const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mysterybox')
    .setDescription('Open a mystery box for a random reward!')
    .addBooleanOption(option =>
      option.setName('paid')
        .setDescription('Pay coins to open a box (no cooldown)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const paid = interaction.options.getBoolean('paid') || false;
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.post(`${backendUrl}/users/${userId}/mysterybox`, { paid, guildId }, { headers: { 'x-guild-id': guildId } });
      const { rewardType, amount, item, message, cooldown } = response.data;
      let color = 0x0099ff;
      if (rewardType === 'coins') color = 0x2ecc71;
      else if (rewardType === 'item') color = 0xf1c40f;
      else if (rewardType === 'buff') color = 0x8e44ad;
      else if (rewardType === 'jackpot') color = 0xffd700;
      const fields = [
        { name: 'Next Free Box', value: `<t:${Math.floor(new Date(cooldown).getTime()/1000)}:R>`, inline: true }
      ];
      if (rewardType === 'coins' || rewardType === 'jackpot') {
        fields.unshift({ name: 'Points', value: `${amount.toLocaleString('en-US')} points`, inline: true });
      }
      if (rewardType === 'item' && item) {
        fields.unshift({ name: 'Item', value: `**${item.name}** (${item.rarity})`, inline: true });
      }
      if (rewardType === 'buff') {
        fields.unshift({ name: 'Buff', value: message.match(/\*\*(.+)\*\*/)?.[1] || message, inline: true });
      }
      const embed = {
        color,
        title: '🎁 Mystery Box',
        description: message,
        fields,
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      logger.error('Error in /mysterybox command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Mystery Box');
        return;
      } else {
        await ResponseHandler.handleError(interaction, error, 'Mystery Box');
        return;
      }
    }
  },
}; 