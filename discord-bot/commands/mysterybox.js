const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { handleError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mysterybox')
    .setDescription('Open a mystery box')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('The type of mystery box to open')
        .setRequired(true)
        .addChoices(
          { name: 'Basic Box (Free once per day)', value: 'basic' },
          { name: 'Premium Box (1,000,000 points)', value: 'premium' },
          { name: 'Ultimate Box (10,000,000 points)', value: 'ultimate' }
        )),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const boxType = interaction.options.getString('type');

      const response = await axios.post(`${process.env.BACKEND_API_URL}/users/${interaction.user.id}/mysterybox`, {
        boxType,
        guildId: interaction.guildId
      }, {
        headers: { 'x-guild-id': interaction.guildId }
      });

      const { rewardType, amount, item, message } = response.data;

      let embedColor = 0x8e44ad; // Default purple for normal rewards
      
      if (rewardType === 'buffs' || rewardType === 'buff') {
        embedColor = 0x00FFFF; // Cyan for buffs
      } else if (rewardType === 'coins' && amount >= 1000000) {
        embedColor = 0xFFD700; // Gold for jackpot (1M+ points)
      } else if (rewardType === 'item' && item && ['legendary', 'mythical', 'transcendent'].includes(item.rarity)) {
        embedColor = 0xFFD700; // Gold for legendary+ items
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('🎁 Mystery Box')
        .setDescription(`You opened a ${boxType} mystery box!`)
        .setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.tag}` });

      if (rewardType === 'coins') {
        embed.addFields({ 
          name: '💰 Reward', 
          value: `**${amount.toLocaleString('en-US')} points**`,
          inline: true 
        });
      } else if (rewardType === 'item' && item) {
        let valueLine = '';
        if (typeof item.value === 'number' && !isNaN(item.value)) {
          valueLine = `\nValue: ${item.value.toLocaleString('en-US')} points`;
        }
        embed.addFields({ 
          name: '🎁 Reward', 
          value: `**${item.name}**\nRarity: ${item.rarity}${valueLine}`,
          inline: true 
        });
      } else if ((rewardType === 'buffs' || rewardType === 'buff') && message) {
        // Extract buff description from message
        const buffDescription = message.replace('You found a buff: ', '').split(' (')[0];
        embed.addFields({ 
          name: '✨ Reward', 
          value: `**${buffDescription}**`,
          inline: true 
        });
      }

      if (message) {
        embed.addFields({ name: 'Additional Info', value: message, inline: false });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in Mystery Box:', error);
      
      // If we haven't replied yet, try to send an error message
      try {
        const backendMsg = error?.response?.data?.message;
        const errorMsg = backendMsg || error.message || 'Unknown error';
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Error')
          .setDescription(errorMsg)
          .addFields({ name: 'Context', value: 'Mystery Box' })
          .setTimestamp();

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [errorEmbed], flags: 64 }); // 64 is the flag for ephemeral
        } else {
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      } catch (followupError) {
        logger.error('Failed to send error message:', followupError);
      }
    }
  }
}; 