const { SlashCommandBuilder, EmbedBuilder, Collection } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');

// In-memory cooldown map
const questionCooldowns = new Map();

// List of cute cat images
const catImages = [
  'https://cdn.discordapp.com/attachments/1383875172850733106/1384202315573231736/IMG_4396.jpg?ex=6851925d&is=685040dd&hm=3c13c2ae06a792608a0963b694f90a25441c7a949c7c5dd4d8369a97d905706f&'
];

// List of questions
const questions = [
  'Is this cat ugly?',
  'Would you say this cat is unattractive?',
  'Does this cat look bad?',
  'Is this cat not cute?',
  'Would you call this cat hideous?'
];

// List of funny responses for correct answers (saying no)
const correctResponses = [
  'You have a heart of gold! This cat is absolutely adorable!',
  'Your kindness knows no bounds! This cat is a perfect angel!',
  'You\'re a true cat lover! This cat is the cutest thing ever!',
  'Your good taste in cats is rewarded! This cat is a beauty!',
  'You\'re a cat whisperer! This cat is absolutely precious!'
];

// List of funny responses for incorrect answers (saying yes)
const incorrectResponses = [
  'How dare you! This cat is a perfect angel!',
  'Your lack of cat appreciation is concerning!',
  'The cat community is disappointed in you!',
  'This cat is crying because of your comment!',
  'The cat council will hear about this!'
];

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

      // Check cooldown
      // if (now - lastUsed < cooldown) {
      //   const remaining = Math.ceil((cooldown - (now - lastUsed)) / 1000);
      //   const embed = new EmbedBuilder()
      //     .setColor(0xffbe76)
      //     .setTitle('⏳ Cooldown')
      //     .setDescription(`You must wait ${Math.ceil(remaining/60)}m ${remaining%60}s before using this command again.`)
      //     .setTimestamp();
      //   await interaction.editReply({ embeds: [embed] });
      //   return;
      // }

      // Get random question and cat image
      const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
      const randomCatImage = catImages[Math.floor(Math.random() * catImages.length)];

      const promptEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🐱 Question Time!')
        .setDescription(`${randomQuestion} Reply with **yes** or **no** in the next 30 seconds!`)
        .setImage(randomCatImage)
        .setTimestamp();

      await interaction.editReply({ embeds: [promptEmbed] });

      if (!interaction.channel) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff7675)
          .setTitle('❌ Error')
          .setDescription('This command requires being run in a channel where the bot can read messages.')
          .setTimestamp();
        await safeErrorReply(interaction, errorEmbed);
        return;
      }

      const filter = m => m.author.id === userId && ['yes', 'no'].includes(m.content.toLowerCase());
      questionCooldowns.set(userId, Date.now());

      try {
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
        const reply = collected.first().content.toLowerCase();
        const amount = 1000000; // 1 million points
        const isNo = reply === 'no'; // Reversed logic - no is now correct

        // Get current balance before making changes
        const backendUrl = process.env.BACKEND_API_URL;
        const balanceResponse = await axios.get(`${backendUrl}/users/${userId}/wallet`, {
          headers: { 'x-guild-id': interaction.guildId }
        });
        
        const currentBalance = balanceResponse.data.balance;

        // Calculate the amount to deduct (if yes) or add (if no)
        let finalAmount = isNo ? amount : -amount;
        
        // If answering yes and balance is less than 1 million, set balance to 0
        if (!isNo && currentBalance < amount) {
          finalAmount = -currentBalance; // This will set balance to 0
        }

        // Skip API call if amount is 0 (user has 0 balance and answered yes)
        if (finalAmount === 0) {
          const resultEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Wrong!')
            .setDescription(`${incorrectResponses[Math.floor(Math.random() * incorrectResponses.length)]} Since you have 0 points, no points were deducted.`)
            .setTimestamp();

          await interaction.followUp({ embeds: [resultEmbed] });
          return;
        }
        
        // Make API call to update balance
        await axios.post(`${backendUrl}/users/${userId}/question`, {
          amount: finalAmount,
          guildId: interaction.guildId
        }, {
          headers: { 'x-guild-id': interaction.guildId }
        });

        const resultEmbed = new EmbedBuilder()
          .setColor(isNo ? 0x00ff00 : 0xff0000)
          .setTitle(isNo ? '🎉 Correct!' : '❌ Wrong!')
          .setDescription(isNo 
            ? `${correctResponses[Math.floor(Math.random() * correctResponses.length)]} **${amount.toLocaleString('en-US')} points** have been added to your account.`
            : `${incorrectResponses[Math.floor(Math.random() * incorrectResponses.length)]} **${Math.abs(finalAmount).toLocaleString('en-US')} points** have been deducted from your account.`)
          .setTimestamp();

        await interaction.followUp({ embeds: [resultEmbed] });
        return;
      } catch (err) {
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
      if (!interaction.replied) {
        await safeErrorReply(interaction, new EmbedBuilder()
          .setColor(0xff7675)
          .setTitle('❌ Error')
          .setDescription('Something went wrong. Please try again later.')
          .setTimestamp()
        );
      }
    }
  },
}; 