const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { handleError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

// --- In-memory cooldown map: { userId: { [guildId]: { premium: timestamp, ultimate: timestamp } } } ---
const boxCooldowns = new Map();

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
        ))
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('The number of boxes to open')
        .setMinValue(1)
        .setMaxValue(20)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const boxType = interaction.options.getString('type');
      let count = interaction.options.getInteger('count') || 1;
      if (boxType === 'basic') count = 1;

      // --- Cooldown logic (per user, per guild, per box type) ---
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const now = Date.now();
      let cooldownSeconds = 0;
      if (boxType === 'premium') cooldownSeconds = 10 * count;
      if (boxType === 'ultimate') cooldownSeconds = 15 * count;
      let userCooldown, guildCooldown, lastUsed, remaining;
      if (cooldownSeconds > 0) {
        userCooldown = boxCooldowns.get(userId) || {};
        guildCooldown = userCooldown[guildId] || {};
        lastUsed = guildCooldown[boxType] || 0;
        remaining = lastUsed - now;
        if (remaining > 0) {
          const seconds = Math.ceil(remaining / 1000);
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xffbe76)
                .setTitle('⏳ Cooldown')
                .setDescription(`You must wait ${seconds}s before opening more ${boxType} boxes in this server. Cooldown: ${cooldownSeconds/count}s per box.`)
                .setTimestamp()
            ]
          });
          return;
        }
      }

      const response = await axios.post(`${process.env.BACKEND_API_URL}/users/${interaction.user.id}/mysterybox`, {
        boxType,
        count,
        guildId: interaction.guildId
      }, {
        headers: { 'x-guild-id': interaction.guildId }
      });

      // --- Set cooldown only after successful backend call ---
      if (cooldownSeconds > 0) {
        userCooldown = boxCooldowns.get(userId) || {};
        guildCooldown = userCooldown[guildId] || {};
        guildCooldown[boxType] = now + cooldownSeconds * 1000;
        userCooldown[guildId] = guildCooldown;
        boxCooldowns.set(userId, userCooldown);
      }

      // Multi-box summary embed
      if (count > 1 && response.data.rewards && Array.isArray(response.data.rewards)) {
        const rewards = response.data.rewards;
        let summaryLines = rewards.map((reward, idx) => {
          if (reward.rewardType === 'jackpot') {
            // Check if message mentions golden ticket
            if (reward.message && /golden ticket/i.test(reward.message)) {
              return `Box ${idx + 1}: 🏆 JACKPOT! 💰 ${reward.amount?.toLocaleString('en-US')} points + 🎫 Golden Ticket (Legendary!)`;
            }
            return `Box ${idx + 1}: 🏆 JACKPOT! 💰 ${reward.amount?.toLocaleString('en-US')} points`;
          } else if (reward.rewardType === 'coins') {
            return `Box ${idx + 1}: 💰 ${reward.amount?.toLocaleString('en-US')} points`;
          } else if (reward.rewardType === 'item' && reward.item) {
            // Check for golden ticket
            if (reward.item.name === 'Golden Ticket') {
              return `Box ${idx + 1}: 🎫 **Golden Ticket** (Legendary!)`;
            }
            return `Box ${idx + 1}: 🎁 ${reward.item.name} (${reward.item.rarity})${typeof reward.item.value === 'number' ? ` - ${reward.item.value.toLocaleString('en-US')} points` : ''}`;
          } else if ((reward.rewardType === 'buffs' || reward.rewardType === 'buff') && reward.message) {
            // Try to extract buff description from message
            const desc = reward.message.replace('You found a buff: ', '').split(' (')[0];
            return `Box ${idx + 1}: ✨ ${desc}`;
          } else if (reward.message && /golden ticket/i.test(reward.message)) {
            // If message mentions golden ticket, highlight it
            return `Box ${idx + 1}: 🎫 **Golden Ticket** (Legendary!)`;
          } else if (reward.message) {
            return `Box ${idx + 1}: ${reward.message}`;
          } else {
            return `Box ${idx + 1}: Unknown reward`;
          }
        });
        const embed = new EmbedBuilder()
          .setColor(0x8e44ad)
          .setTitle('Mystery Boxes')
          .setDescription(`You opened ${count} ${boxType} mystery boxes!\n\n${summaryLines.join('\n')}`)
          .setTimestamp()
          .setFooter({ text: `Requested by ${interaction.user.tag}` });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Existing single-box logic (unchanged)
      const { rewardType, amount, item, message } = response.data;
      let embedColor = 0x8e44ad; // Default purple for normal rewards
      
      if (rewardType === 'buffs' || rewardType === 'buff') {
        embedColor = 0x00FFFF; // Cyan for buffs
      } else if (rewardType === 'coins' && amount >= 1000000) {
        embedColor = 0xFFD700; // Gold for jackpot (1M+ points)
      } else if (rewardType === 'item' && item && ['legendary', 'mythical', 'transcendent', 'og'].includes(item.rarity)) {
        embedColor = 0xFFD700; // Gold for legendary+ items
      }

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Mystery Box')
        .setDescription(`You opened a ${boxType} mystery box!`)
        .setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.tag}` });

      if (rewardType === 'jackpot') {
        embed.addFields({
          name: '🏆 JACKPOT!',
          value: `**${amount.toLocaleString('en-US')} points**`,
          inline: true
        });
      } else if (rewardType === 'coins') {
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