const { SlashCommandBuilder, EmbedBuilder, Collection, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const path = require('path');

// In-memory cooldown map: { userId: { [guildId]: lastUsed } }
const questionCooldowns = new Map();

// List of cute cat images
const catImages = [
  path.join(__dirname, '../images/cat1.png'),
  path.join(__dirname, '../images/cat2.jpg'),
  path.join(__dirname, '../images/cat3.jpg')
];

const geckoImages = [
  path.join(__dirname, '../images/frog1.png'),
  path.join(__dirname, '../images/frog2.jpg')
];

// New: Chest and Cursed Idol images (add your own images as needed)
const chestImages = [
  path.join(__dirname, '../images/chest.gif')
];
const idolImages = [
  path.join(__dirname, '../images/cursedIdol.jpg')
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
    'Would you call this gecko unpleasant?'
  ],
  chest: [
    'Would you open this chest?',
    'Do you think this chest is safe?',
    'Would you trust this mysterious box?'
  ],
  cursedIdol: [
    'Would you touch this idol?',
    'Does this idol look harmless?',
    'Would you keep this on your shelf?'
  ]
};

// New: correct answers for each type
const correctAnswers = {
  cat: 'no',
  gecko: 'yes',
  chest: 'no',         // opening is a trap!
  cursedIdol: 'no'     // touching it is bad!
};

// List of funny responses for correct answers
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
  ],
  chest: [
    'Smart choice. Mimics are real.',
    'You live to open another day.',
    'You\'ve avoided a classic RPG trap!',
    'You\'re not falling for that one!'
  ],
  cursedIdol: [
    'Wise. Some things are best left untouched.',
    'You\'ve avoided a lifetime of bad luck.',
    'You resist the urge, and fate smiles on you.',
    'You\'re not easily cursed!'
  ]
};

// List of funny responses for incorrect answers
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
  ],
  chest: [
    'Yikes. It was a mimic. It bit you.',
    'You\'ve been chomped by a chest monster!',
    'Ouch! Never trust a suspicious chest.',
    'It was a trap! You lose some loot.'
  ],
  cursedIdol: [
    'Oh no, you\'re cursed for eternity!',
    'You feel a chill down your spine... bad move.',
    'The idol\'s eyes glow red. Uh oh.',
    'You\'ve unleashed ancient misfortune!'
  ]
};

const typeTitles = {
  cat: '🐱 Question Time!',
  gecko: '🦎 Question Time!',
  chest: '💰 Question Time!',
  cursedIdol: '🗿 Question Time!'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('question')
    .setDescription('Answer a question about a cat or gecko for a chance to win or lose points!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const now = Date.now();
      let userCooldown = questionCooldowns.get(userId) || {};
      const lastUsed = userCooldown[guildId] || 0;
      const cooldown = 5 * 60 * 1000; // 5 minutes

      // Check cooldown
      if (now - lastUsed < cooldown) {
        const remaining = Math.ceil((cooldown - (now - lastUsed)) / 1000);
        const embed = new EmbedBuilder()
          .setColor(0xffbe76)
          .setTitle('⏳ Cooldown')
          .setDescription(`You must wait ${Math.ceil(remaining/60)}m ${remaining%60}s before using this command again in this server.`)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      // Set cooldown immediately to prevent race condition
      userCooldown[guildId] = now;
      questionCooldowns.set(userId, userCooldown);
      // Randomly select animal type
      // const animalType = Math.random() < 0.5 ? 'cat' : 'gecko';
      // New: pick from all types
      const allAnimalTypes = ['cat', 'gecko', 'chest', 'cursedIdol'];
      const animalType = allAnimalTypes[Math.floor(Math.random() * allAnimalTypes.length)];
      let randomImage, randomQuestion;
      switch (animalType) {
        case 'cat':
          randomImage = catImages[Math.floor(Math.random() * catImages.length)];
          break;
        case 'gecko':
          randomImage = geckoImages[Math.floor(Math.random() * geckoImages.length)];
          break;
        case 'chest':
          randomImage = chestImages[Math.floor(Math.random() * chestImages.length)];
          break;
        case 'cursedIdol':
          randomImage = idolImages[Math.floor(Math.random() * idolImages.length)];
          break;
      }
      randomQuestion = questions[animalType][Math.floor(Math.random() * questions[animalType].length)];

      const imageAttachment = new AttachmentBuilder(randomImage);
      const promptEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(typeTitles[animalType])
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
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        // Remove cooldown if we never actually prompted
        questionCooldowns.delete(userId);
        return;
      }

      const filter = m => m.author.id === userId && ['yes', 'no'].includes(m.content.toLowerCase());

      try {
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
        const reply = collected.first().content.toLowerCase();
        const amount = 1000000; // 1 million points
        // For each type, check correct answer
        // const isCorrect = (animalType === 'cat' && reply === 'no') || (animalType === 'gecko' && reply === 'yes');
        const baseCorrect = (reply === correctAnswers[animalType]);
        // Rare logic inversion (5% chance)
        const logicInverted = Math.random() < 0.05;
        const isCorrect = logicInverted ? !baseCorrect : baseCorrect;

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
        // Pick response arrays, invert if logicInverted
        const correctResArr = logicInverted ? incorrectResponses[animalType] : correctResponses[animalType];
        const incorrectResArr = logicInverted ? correctResponses[animalType] : incorrectResponses[animalType];
        if (finalAmount === 0) {
          const resultEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Wrong!')
            .setDescription(`${incorrectResArr[Math.floor(Math.random() * incorrectResArr.length)]} Since you have 0 points, no points were deducted.`)
            .setTimestamp();
          if (logicInverted) {
            resultEmbed.setFooter({ text: '🌀 The world feels... off. Truth and lies swapped places.' });
          }
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
            ? `${correctResArr[Math.floor(Math.random() * correctResArr.length)]} **${amount.toLocaleString('en-US')} points** have been added to your account.`
            : `${incorrectResArr[Math.floor(Math.random() * incorrectResArr.length)]} **${Math.abs(finalAmount).toLocaleString('en-US')} points** have been deducted from your account.`)
          .setTimestamp();
        // Add rare logic inversion footer
        if (logicInverted) {
          resultEmbed.setFooter({ text: '🌀 The world feels... off. Truth and lies swapped places.' });
        }
        await interaction.followUp({ embeds: [resultEmbed] });

        // --- LIE DETECTOR FOR GECKO ---
        if (animalType === 'gecko' && isCorrect) {
          const lieFilter = m => {
            if (m.author.id !== userId) return false;
            const content = m.content.toLowerCase();
            const liePatterns = [
              // Core variations and typos for "lie"
              /\b(lie|lied+|lyed|liy(?:ing|ed)?|lying|liar+)\b/i,
            
              // Joking-related + contractions
              /\b(joking|joke|kidding|kiddin|jk|just kidding|just joking|i['’]?m kidding|i['’]?m joking)\b/i,
            
              // Retractions and reversals
              /\b(not really|actually no|i take it back|i didn'?t mean it|i regret it|i was wrong|wasn'?t serious|not true)\b/i,
            
              // Exaggerated or troll-style "no"
              /^\s*no+[\s!.]*$/i,
            
              // Slang or casual trolling
              /\b(s+i+k+e+|psych+|nah just kidding|lol jk|just messin[g]?|just playin[g]?|nah jk|gottem)\b/i
            ];
            return liePatterns.some(pattern => pattern.test(content));
          };

          const lieCollector = interaction.channel.createMessageCollector({ filter: lieFilter, time: 15000, max: 1 });

          lieCollector.on('collect', async m => {
            try {
              const penaltyResponse = await axios.post(`${backendUrl}/users/${userId}/penalize-liar`, {
                guildId: interaction.guildId
              }, {
                headers: { 'x-guild-id': interaction.guildId }
              });

              const { deductedAmount } = penaltyResponse.data;

              if (deductedAmount > 0) {
                const penaltyFlavorTexts = [
                  `The gecko tilts its head. It knows you lied. As punishment for your deception, it has snatched **${deductedAmount.toLocaleString('en-US')}** points from your wallet.`,
                  `A faint whisper is heard on the wind... *'Liar... liar...'*. You check your balance and notice **${deductedAmount.toLocaleString('en-US')}** points are missing. The gecko is not to be trifled with.`,
                  `You thought you could deceive the gecko? Big mistake. It just hacked your account and transferred **${deductedAmount.toLocaleString('en-US')}** points to its offshore reptile fund.`,
                  `The gecko stares into your soul, sees the deceit within, and shakes its head in disappointment. **${deductedAmount.toLocaleString('en-US')}** points have been confiscated for emotional damages.`
                ];
                const penaltyMessage = penaltyFlavorTexts[Math.floor(Math.random() * penaltyFlavorTexts.length)];
                
                const penaltyEmbed = new EmbedBuilder()
                  .setColor(0x8B0000) // Dark Red
                  .setTitle('🐍 A Lie is Detected!')
                  .setDescription(penaltyMessage)
                  .setTimestamp();
                await interaction.followUp({ embeds: [penaltyEmbed] });
              }
            } catch (penaltyError) {
              console.error('Error during lie penalty:', penaltyError);
              // Fail silently, don't bother the user with another error message
            }
          });
        }
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
      const errorMsg = error.response?.data?.message || error.message || 'Something went wrong. Please try again later.';
      if (!interaction.replied) {
        await interaction.followUp({ embeds: [new EmbedBuilder()
          .setColor(0xff7675)
          .setTitle('❌ Error')
          .setDescription(errorMsg)
          .setTimestamp()
        ], ephemeral: true });
      }
    }
  },
}; 