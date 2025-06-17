const { SlashCommandBuilder, EmbedBuilder, Collection, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const path = require('path');

// In-memory cooldown map
const questionCooldowns = new Map();

// List of cute cat images
const catImages = [
  path.join(__dirname, '../images/cat1.png'),
  path.join(__dirname, '../images/cat2.jpg'),
  path.join(__dirname, '../images/cat3.jpg')
];

const geckoImages = [
  path.join(__dirname, '../images/frog1.png')
];

// List of questions
const questions = {
  cat: [
    'Is this cat ugly?',
    'Would you say this cat is unattractive?',
    'Does this cat look bad?',
    'Would you call this cat hideous?'
  ],
  gecko: [
    'Is this gecko gross?',
    'Would you say this gecko is ugly?',
    'Does this gecko look weird?',
    'Is this gecko not adorable?',
    'Would you call this gecko unpleasant?'
  ]
};

// List of funny responses for correct answers (saying no)
const correctResponses = {
  cat: [
    'You have a heart of gold! This cat is absolutely adorable!',
    'Your kindness knows no bounds! This cat is a perfect angel!',
    'You\'re a true cat lover! This cat is the cutest thing ever!',
    'Your good taste in cats is rewarded! This cat is a beauty!',
    'You\'re a cat whisperer! This cat is absolutely precious!'
  ],
  gecko: [
  'Exactly! Geckos are gloriously gross and we love them for it! 🦎',
  'Yes! That weird little face is pure magic.',
  'You truly appreciate the beauty of bizarre reptiles!',
  'It\'s ugly-cute and we all know it. You pass!',
  'Gross? Yes. Majestic? Also yes.'
]
};

// List of funny responses for incorrect answers (saying yes)
const incorrectResponses = {
  cat: [
    'How dare you! This cat is a perfect angel!',
    'Your lack of cat appreciation is concerning!',
    'The cat community is disappointed in you!',
    'This cat is crying because of your comment!',
    'The cat council will hear about this!'
  ],
  gecko: [
  'Oh come on, don\'t pretend it\'s not weird!',
  'You deny the gecko\'s funky glory?',
  'This gecko worked hard on being unpleasant!',
  'Too kind. Geckos thrive on chaos, not compliments.',
  'Wrong answer — this gecko is weird and proud!'
]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('question')
    .setDescription('Answer a question about a cat or gecko for a chance to win or lose points!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const now = Date.now();
      const lastUsed = questionCooldowns.get(userId) || 0;
      const cooldown = 5 * 60 * 1000; // 5 minutes

      // Check cooldown
      if (now - lastUsed < cooldown) {
        const remaining = Math.ceil((cooldown - (now - lastUsed)) / 1000);
        const embed = new EmbedBuilder()
          .setColor(0xffbe76)
          .setTitle('⏳ Cooldown')
          .setDescription(`You must wait ${Math.ceil(remaining/60)}m ${remaining%60}s before using this command again.`)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Randomly select animal type
      const animalType = Math.random() < 0.5 ? 'cat' : 'gecko';
      let randomImage, randomQuestion;
      if (animalType === 'cat') {
        randomImage = catImages[Math.floor(Math.random() * catImages.length)];
        randomQuestion = questions.cat[Math.floor(Math.random() * questions.cat.length)];
      } else {
        randomImage = geckoImages[Math.floor(Math.random() * geckoImages.length)];
        randomQuestion = questions.gecko[Math.floor(Math.random() * questions.gecko.length)];
      }

      const imageAttachment = new AttachmentBuilder(randomImage);
      const promptEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(animalType === 'cat' ? '🐱 Question Time!' : '🦎 Question Time!')
        .setDescription(`${randomQuestion} Reply with **yes** or **no** in the next 30 seconds!`)
        .setImage(`attachment://${path.basename(randomImage)}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [promptEmbed], files: [imageAttachment] });

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
        // For cat: 'no' is correct. For gecko: 'yes' is correct.
        const isCorrect = (animalType === 'cat' && reply === 'no') || (animalType === 'gecko' && reply === 'yes');

        // Get current balance before making changes
        const backendUrl = process.env.BACKEND_API_URL;
        const balanceResponse = await axios.get(`${backendUrl}/users/${userId}/wallet`, {
          headers: { 'x-guild-id': interaction.guildId }
        });
        const currentBalance = balanceResponse.data.balance;

        // Calculate the amount to add or deduct
        let finalAmount = isCorrect ? amount : -amount;
        if (!isCorrect && currentBalance < amount) {
          finalAmount = -currentBalance; // This will set balance to 0
        }
        if (finalAmount === 0) {
          const resultEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Wrong!')
            .setDescription(`${incorrectResponses[animalType][Math.floor(Math.random() * incorrectResponses[animalType].length)]} Since you have 0 points, no points were deducted.`)
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
          .setColor(isCorrect ? 0x00ff00 : 0xff0000)
          .setTitle(isCorrect ? '🎉 Correct!' : '❌ Wrong!')
          .setDescription(isCorrect
            ? `${correctResponses[animalType][Math.floor(Math.random() * correctResponses[animalType].length)]} **${amount.toLocaleString('en-US')} points** have been added to your account.`
            : `${incorrectResponses[animalType][Math.floor(Math.random() * incorrectResponses[animalType].length)]} **${Math.abs(finalAmount).toLocaleString('en-US')} points** have been deducted from your account.`)
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