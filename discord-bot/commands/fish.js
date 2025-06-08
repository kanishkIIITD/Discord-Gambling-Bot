const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const flavorTexts = {
  common: [
    "You caught a lively {name}! Not bad for a day's work.",
    "A wild {name} took the bait. Nice catch!",
    "You snagged a humble {name}. A decent haul for any angler.",
    "Nothing fancy, but this {name} will do just fine.",
    // New
    "Just another {name}, but every little bit counts!",
    "You scoop up a {name} without breaking a sweat.",
    "Even the small ones like the {name} have their charm.",
    "The {name} practically jumped into your hands!"
  ],
  uncommon: [
    "You reel in a feisty {name}! That's a good one.",
    "The water splashes—a {name} is yours!",
    "You hooked a spirited {name}. Things are heating up!",
    "Not rare, but this {name} put up a solid fight.",
    // New
    "This {name} gave you a little chase—worth it!",
    "Solid pull! The {name} makes for a good trophy.",
    "That {name} wasn't easy, but you earned it!",
    "The line danced wildly before you landed the {name}."
  ],
  rare: [
    "Wow! You landed a rare {name}! Fisherfolk will be jealous.",
    "A shimmering {name} leaps from the water. What luck!",
    "This {name} isn't seen every day — great pull!",
    "A glint beneath the surface… it's a rare {name}!",
    // New
    "You felt it in your bones—this rare {name} was meant for you.",
    "Even the winds pause as the rare {name} emerges.",
    "They'll be telling stories about that {name} at the docks.",
    "You barely believed it until you held the {name} in your hands."
  ],
  epic: [
    "🌊 EPIC CATCH! The magnificent {name} fights hard but you prevail!",
    "Your rod bends dangerously... It's an EPIC {name}! Incredible!",
    "The sea churns as the epic {name} surfaces. You tame the tides!",
    "An epic battle ends in your favor. The {name} is yours!",
    // New
    "⚔️ After a fierce struggle, the {name} yields to your skill!",
    "This isn't just luck—your instincts landed the epic {name}.",
    "Your name will echo for that catch. The {name} is a prize!",
    "You clutched the rod like a hero—then came the {name}."
  ],
  legendary: [
    "🌟 LEGENDARY! The mythical {name} is yours! The whole server is in awe.",
    "You feel a massive tug... It's the legendary {name}! This will be talked about for ages.",
    "Old sailors speak of the {name}—and now it's in your hands.",
    "A timeless tale now belongs to you. The legendary {name} is real!",
    // New
    "You stared into the abyss—and the {name} stared back.",
    "The legend lives... and it's the {name} in your grasp.",
    "Even the skies changed color when the {name} appeared.",
    "A roar of waves and fate itself delivers the {name} to you."
  ],
  mythical: [
    "🌀 MYTHICAL! You've fished the impossible: a {name}. This moment is historic!",
    "Time stops for a second... The {name} rises from the deep. You are now a legend.",
    "Legends whisper of the {name}. Now it whispers back to *you*.",
    "Reality flickers as the mythical {name} surfaces. Are you dreaming?",
    // New
    "The {name} comes from forgotten realms—and chose you.",
    "You feel something ancient stir as you pull in the {name}.",
    "The world slows down as the {name} breaks the surface.",
    "You cross into legend as the mythical {name} joins your collection."
  ],
  transcendent: [
    "✨ TRANSCENDENCE! You've caught the {name}. The ocean itself bows in reverence.",
    "Beyond rarity, beyond reason—the {name} is now yours. You are eternal.",
    "🌌 The stars ripple as you reel in the transcendent {name}. Are you even mortal?",
    "You didn't just fish. You rewrote destiny with the {name}.",
    // New
    "💫 The cosmos shifts. The {name} now exists in your reality.",
    "Transcendence achieved—the {name} sings the universe's song to you.",
    "The moment you touched the {name}, you left the mortal plane behind.",
    "The {name} is not just a catch—it's a key to the beyond."
  ]
};




const rarityColors = {
  common: 0x95a5a6,        // Gray
  uncommon: 0x2ecc71,      // Green
  rare: 0x3498db,          // Blue
  epic: 0x9b59b6,          // Purple
  legendary: 0xf1c40f,     // Gold
  mythical: 0xe67e22,      // Orange
  transcendent: 0xFF1493   // Pink
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