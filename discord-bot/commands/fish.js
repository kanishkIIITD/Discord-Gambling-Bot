const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const flavorTexts = {
  common: [
    "You caught a lively {name}! Not bad for a day's work.",
    'A wild {name} took the bait. Nice catch!'
  ],
  uncommon: [
    'You reel in a feisty {name}! That\'s a good one.',
    'The water splashes—a {name} is yours!'
  ],
  rare: [
    'Wow! You landed a rare {name}! Fisherfolk will be jealous.',
    'A shimmering {name} leaps from the water. What luck!'
  ],
  legendary: [
    '🌟 LEGENDARY! The mythical {name} is yours! The whole server is in awe.',
    'You feel a massive tug... It\'s the legendary {name}! This will be talked about for ages.'
  ]
};

const rarityColors = {
  common: 0x3498db,
  uncommon: 0x27ae60,
  rare: 0x9b59b6,
  legendary: 0xf1c40f
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('Go fishing for a chance to catch something valuable!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.post(`${backendUrl}/users/${userId}/fish`, { guildId }, { headers: { 'x-guild-id': guildId } });
      const { name, rarity, value, count, cooldown } = response.data;
      const flavorArr = flavorTexts[rarity] || flavorTexts.common;
      const flavor = flavorArr[Math.floor(Math.random() * flavorArr.length)].replace('{name}', name);
      
      // Calculate time remaining for success embed (if cooldown is in the future)
      let cooldownTimeString = 'None';
      if (cooldown) {
        const now = Date.now();
        const cooldownTime = new Date(cooldown).getTime();
        if (cooldownTime > now) {
          let timeRemaining = Math.max(0, cooldownTime - now);
          const minutes = Math.floor(timeRemaining / 60000);
          const seconds = Math.floor((timeRemaining % 60000) / 1000);
          cooldownTimeString = `${minutes}m ${seconds}s`;
        } else {
            cooldownTimeString = 'Now';
        }
      }

      const embed = {
        color: rarityColors[rarity] || 0x3498db,
        title: `🎣 You caught a${rarity === 'uncommon' ? 'n' : ''} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Fish!`,
        description: flavor,
        fields: [
          { name: 'Fish', value: name, inline: true },
          { name: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1), inline: true },
          { name: 'Value', value: `${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
          { name: 'You Own', value: `${count}`, inline: true },
          { name: 'Next Fish Available', value: cooldownTimeString, inline: true }
        ],
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      logger.error('Error in /fish command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        const msg = error.response.data.message;
        // If error is a cooldown, show a custom cooldown embed
        if (error.response.status === 429 || msg.toLowerCase().includes('cooldown') || msg.toLowerCase().includes('try again')) {
            let cooldownTime = 0;
            if (error.response.data.cooldown) {
              cooldownTime = new Date(error.response.data.cooldown).getTime();
            }

            // Calculate time remaining in ms
            const now = Date.now();
            let timeRemaining = Math.max(0, cooldownTime - now);
            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = Math.floor((timeRemaining % 60000) / 1000);
            const timeString = `${minutes}m ${seconds}s`;

            const embed = {
              color: 0xffbe76,
              title: '⏳ Fishing Cooldown',
              description: msg,
              fields: [
                { name: 'Time Remaining', value: timeString, inline: true }
              ],
              timestamp: new Date(),
              footer: { text: `Requested by ${interaction.user.tag}` }
            };
            await interaction.editReply({ embeds: [embed] });
            return; // Prevent calling handleError for cooldown
        } else {
            await ResponseHandler.handleError(interaction, { message: msg }, 'Fish');
            return;
        }
      } else {
        await ResponseHandler.handleError(interaction, error, 'Fish');
        return;
      }
    }
  },
}; 