const { SlashCommandBuilder, EmbedBuilder, Collection } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');

// In-memory cooldown map
const questionCooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('question')
    .setDescription('Answer a question about a cat for a chance to win or lose points!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const now = Date.now();
      const lastUsed = questionCooldowns.get(userId) || 0;
      const cooldown = 5 * 60 * 1000; // 5 minutes

      const promptEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🐱 Question Time!')
        .setDescription('Is this cat ugly? Reply with **yes** or **no** in the next 30 seconds!')
        .setImage('https://cdn.discordapp.com/attachments/1383875172850733106/1384202315573231736/IMG_4396.jpg?ex=6851925d&is=685040dd&hm=3c13c2ae06a792608a0963b694f90a25441c7a949c7c5dd4d8369a97d905706f&')
        .setTimestamp();

      await interaction.editReply({ embeds: [promptEmbed] });

      if (!interaction.channel) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff7675)
          .setTitle('❌ Error')
          .setDescription('This command requires being run in a channel where the bot can read messages.')
          .setTimestamp();
        await interaction.followUp({ embeds: [errorEmbed] });
        return;
      }

      const filter = m => m.author.id === userId && ['yes', 'no'].includes(m.content.toLowerCase());
      questionCooldowns.set(userId, Date.now());

      try {
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
        const reply = collected.first().content.toLowerCase();
        const amount = 1000000; // 1 million points
        const isYes = reply === 'yes';

        // Get current balance before making changes
        const backendUrl = process.env.BACKEND_API_URL;
        const balanceResponse = await axios.get(`${backendUrl}/users/${userId}/wallet`, {
          headers: { 'x-guild-id': interaction.guildId }
        });
        
        const currentBalance = balanceResponse.data.balance;

        // Calculate the amount to deduct (if no) or add (if yes)
        let finalAmount = isYes ? amount : -amount;
        
        // If answering no and balance is less than 1 million, set balance to 0
        if (!isYes && currentBalance < amount) {
          finalAmount = -currentBalance; // This will set balance to 0
        }

        // Skip API call if amount is 0 (user has 0 balance and answered no)
        if (finalAmount === 0) {
          const resultEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Wrong!')
            .setDescription('You said the cat is not ugly! Since you have 0 points, no points were deducted.')
            .setTimestamp();

          await interaction.followUp({ embeds: [resultEmbed] });
          return;
        }
        
        // Make API call to update balance
        const response = await axios.post(`${backendUrl}/users/${userId}/question`, {
          amount: finalAmount,
          guildId: interaction.guildId
        }, {
          headers: { 'x-guild-id': interaction.guildId }
        });

        logger.info(`[QUESTION] API response received for user ${userId}:`, response.data);

        const resultEmbed = new EmbedBuilder()
          .setColor(isYes ? 0x00ff00 : 0xff0000)
          .setTitle(isYes ? '🎉 Correct!' : '❌ Wrong!')
          .setDescription(isYes 
            ? `You said the cat is ugly! **${amount.toLocaleString('en-US')} points** have been added to your account.`
            : `You said the cat is not ugly! **${Math.abs(finalAmount).toLocaleString('en-US')} points** have been deducted from your account.`)
          .setTimestamp();

        await interaction.followUp({ embeds: [resultEmbed] });
        return;
      } catch (err) {
        logger.error('[QUESTION] Error in message collection or API call:', err);
        
        if (err instanceof Collection || (err && err.code === 'COLLECTION_MAX_TIME') || (err instanceof Error && err.message === 'time')) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xffbe76)
            .setTitle('⏰ Time\'s Up!')
            .setDescription('You did not answer in time. Try again later.')
            .setTimestamp();
          await interaction.followUp({ embeds: [timeoutEmbed] });
          return;
        } else if (err.response) {
          // Handle API error response
          logger.error('[QUESTION] API Error:', {
            status: err.response.status,
            data: err.response.data
          });
          
          const errorEmbed = new EmbedBuilder()
            .setColor(0xff7675)
            .setTitle('❌ Error')
            .setDescription(err.response.data?.message || 'Something went wrong with the API call. Please try again later.')
            .setTimestamp();
          await interaction.followUp({ embeds: [errorEmbed] });
          return;
        } else {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xff7675)
            .setTitle('❌ Error')
            .setDescription('Something went wrong. Please try again later.')
            .setTimestamp();
          await interaction.followUp({ embeds: [errorEmbed] });
          return;
        }
      }
    } catch (error) {
      logger.error('[QUESTION] Unexpected error:', error);
      if (!interaction.replied) {
        await ResponseHandler.handleError(interaction, error, 'Question');
      }
    }
  },
}; 