const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const flavorTexts = {
  common: [
    "You quietly track and catch a {name}. Dinner tonight!",
    "A {name} crosses your path. Quick and easy.",
    "Your footsteps are silent… the {name} never saw it coming.",
    "This {name} was no match for your instincts.",
    // New
    "Another day, another {name}. The wild provides.",
    "You pounce with precision — the {name} had no chance.",
    "A quick catch. The {name} barely noticed your presence.",
    "The {name} wanders too close. Bad move."
  ],
  uncommon: [
    "You spot a clever {name} and manage to catch it. Impressive!",
    "With patience, you bag a {name}. Nice shot!",
    "The {name} puts up a chase, but you claim the prize.",
    "You outwit the wily {name}. Well played!",
    // New
    "The {name} bolts, but you're quicker.",
    "A tricky one, but the {name} is yours.",
    "You make the shot — clean and swift. {name} is down.",
    "The {name} sensed danger, just not fast enough."
  ],
  rare: [
    "You stalk through the brush and find a rare {name}! What a trophy.",
    "A {name} appears—rare and beautiful. You claim your prize.",
    "A rare {name} crosses your sights. You act with precision.",
    "Not every hunter gets to see a {name}... but you do.",
    // New
    "Your patience pays off — a rare {name} stands before you.",
    "The {name} hesitates for a second. That's all you need.",
    "They say only the best see a {name}... you're living proof.",
    "A glint in the trees — it's the elusive {name}. You act instantly."
  ],
  epic: [
    "🦌 EPIC! The elusive {name} emerges from the shadows — a true hunter's glory.",
    "The ground trembles as you track the epic {name}. You bring it down with precision!",
    "An epic hunt ends in triumph. The {name} is yours!",
    "The {name} stares into your soul before the final clash. You win.",
    // New
    "This is what legends are made of — the epic {name} falls to your skill.",
    "The {name} charges. You don't flinch.",
    "A thrilling chase ends in silence. The {name} is yours.",
    "You're no longer hunting... you're writing history with the {name}."
  ],
  legendary: [
    "🌟 LEGENDARY! The fabled {name} stands before you. You succeed where others failed!",
    "A hush falls as you encounter the legendary {name}. You bring it home in triumph!",
    "Stories warned of the {name}... You just made one real.",
    "A once-in-a-lifetime moment: the legendary {name} is down!",
    // New
    "The forest holds its breath. The {name} appears. You take the shot.",
    "Legends say the {name} cannot be caught. You disagree.",
    "Time slows. The {name} locks eyes with you. You don't miss.",
    "Even the earth whispers your name after the {name} falls."
  ],
  mythical: [
    "🌀 MYTHICAL! You face the ancient {name} of legend — and win. Tales will be told of this hunt.",
    "Reality blurs... The mythical {name} steps into view. You aim true, and the myth becomes yours.",
    "From beyond the veil, the {name} appears. Your name joins the legends.",
    "A beast of dreams, the {name} yields only to a true hunter.",
    // New
    "The {name} exists between myths — but you reached into the unknown and pulled it out.",
    "It was said only fools hunt the {name}. Or legends. Turns out, you're the latter.",
    "No trail, no prints, no sound — just the {name} and your perfect aim.",
    "Your arrow flies through dimensions. It finds the {name} — and history changes."
  ],
  transcendent: [
    "🧬 Scientists debate its existence. Hunters dream of it. You? You caught the {name} with style.",
    "🌌 The universe holds its breath. The {name} has fallen to you.",
    "You've done the impossible. The {name} was never meant to be caught.",
    "You hunted a being of pure essence: the {name}. You are no longer just human.",
    "🌍 Time bends. A {name} charges through dimensions. You don't run. You win.",
    "🦖 Transcendence achieved! You hunted a {name}. No one will believe this actually happened.",
    // New
    "🌠 The cosmos split for a moment — and you seized the {name} from the stars.",
    "You crossed into realms unknown. The {name} came back with you.",
    "You're not hunting anymore. You're ascending. {name} is yours.",
    "Even gods would hesitate. But the {name} belongs to you now."
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
    .setName('hunt')
    .setDescription('Go hunting for a chance to catch a rare animal!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.post(`${backendUrl}/users/${userId}/hunt`, { guildId }, { headers: { 'x-guild-id': guildId } });
      const { name, rarity, value, count, cooldown, buffMessage } = response.data;
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
        color: rarityColors[rarity] || 0x95a5a6,
        title: `🏹 You caught a${rarity === 'uncommon' ? 'n' : ''} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Animal!`,
        description: flavor + (buffMessage || ''),
        fields: [
          { name: 'Animal', value: name, inline: true },
          { name: 'Rarity', value: rarity.charAt(0).toUpperCase() + rarity.slice(1), inline: true },
          { name: 'Value', value: `${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true },
          { name: 'You Own', value: `${count}`, inline: true },
          { name: 'Next Hunt Available', value: cooldownTimeString, inline: true }
        ],
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      logger.error('Error in /hunt command:', error);
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
              title: '⏳ Hunting Cooldown',
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
            await ResponseHandler.handleError(interaction, { message: msg }, 'Hunt');
            return;
        }
      } else {
        await ResponseHandler.handleError(interaction, error, 'Hunt');
        return;
      }
    }
  },
}; 