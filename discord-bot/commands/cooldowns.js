const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cooldowns')
    .setDescription('View all your current cooldowns'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const backendUrl = process.env.BACKEND_API_URL;

      const response = await axios.get(`${backendUrl}/users/${userId}/cooldowns`, {
        headers: { 'x-guild-id': guildId }
      });

      const cooldowns = response.data;
      const now = new Date();
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('⏰ Your Cooldowns')
        .setTimestamp();

      // Helper function to format cooldown time
      const formatCooldown = (cooldownDate, isDaily = false) => {
        if (!cooldownDate) return 'Ready';
        const cooldownTime = new Date(cooldownDate).getTime();
        // For daily claim, add 24 hours to the last claim time
        const effectiveCooldownTime = isDaily ? cooldownTime + (24 * 60 * 60 * 1000) : cooldownTime;
        if (effectiveCooldownTime <= now.getTime()) return 'Ready';
        
        const timeRemaining = effectiveCooldownTime - now.getTime();
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
      };

      // Add fields for each cooldown
      const fields = [
        { name: `${formatCooldown(cooldowns.crimeCooldown)}`, value: '🧙 Crime', inline: false },
        { name: `${formatCooldown(cooldowns.workCooldown)}`, value: '💼 Work', inline: false },
        { name: `${formatCooldown(cooldowns.fishCooldown)}`, value: '🎣 Fish', inline: false },
        { name: `${formatCooldown(cooldowns.huntCooldown)}`, value: '🏹 Hunt', inline: false },
        { name: `${formatCooldown(cooldowns.begCooldown)}`, value: '🙏 Beg', inline: false },
        { name: `${formatCooldown(cooldowns.mysteryboxCooldown)}`, value: '🎁 Free Mystery Box', inline: false },
        { name: `${formatCooldown(cooldowns.lastDailyClaim, true)}`, value: '💰 Daily Bonus', inline: false }
      ];

      // Add jail status if applicable
      if (cooldowns.jailedUntil) {
        const jailTime = new Date(cooldowns.jailedUntil).getTime();
        if (jailTime > now.getTime()) {
          const timeRemaining = jailTime - now.getTime();
          const minutes = Math.floor(timeRemaining / 60000);
          const seconds = Math.floor((timeRemaining % 60000) / 1000);
          fields.push({ 
            name: `${minutes}m ${seconds}s remaining`, 
            value: '🚔 Jail Time', 
            inline: false 
          });
        }
      }

      // Create a description with all cooldowns
      const description = fields.map(field => `${field.value}: ${field.name}`).join('\n');
      embed.setDescription(`Here are all your current cooldowns:\n${description}`);

      // Clear fields since we're using description instead
      embed.setFields([]);

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      await ResponseHandler.handleError(interaction, error, 'Cooldowns');
    }
  }
}; 