const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const fishRarityEmojis = {
  common: '🐟',
  uncommon: '🎣',
  rare: '🐠',
  epic: '🦑',
  legendary: '🐉',
  mythical: '🌊',
  transcendent: '🪙🐟'
};

const animalRarityEmojis = {
  common: '🐾',
  uncommon: '🦃',
  rare: '🦊',
  epic: '🐻',
  legendary: '🦄',
  mythical: '🌌',
  transcendent: '🎩🦫'
};

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'transcendent'];

const sortByRarity = (a, b) => {
  return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View your fishing and hunting collection!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.get(`${backendUrl}/users/${userId}/collection`, { params: { guildId }, headers: { 'x-guild-id': guildId } });
      const inventory = response.data.inventory || [];
      const buffs = response.data.buffs || [];
      if (inventory.length === 0) {
        const embed = {
          color: 0x95a5a6,
          title: '🎒 Your Collection',
          description: 'You haven\'t caught anything yet! Try `/fish` or `/hunt`.',
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      // Group by type and sort by rarity
      const fish = inventory.filter(i => i.type === 'fish').sort(sortByRarity);
      const animals = inventory.filter(i => i.type === 'animal').sort(sortByRarity);
      const fields = [];
      // Show buffs if any
      if (buffs.length > 0) {
        fields.push({
          name: '🧪 Active Buffs',
          value: buffs.map(b => `**${b.description}**${b.expiresAt ? ` (expires <t:${Math.floor(new Date(b.expiresAt).getTime()/1000)}:R>)` : ''}${b.usesLeft ? ` (uses left: ${b.usesLeft})` : ''}`).join('\n'),
          inline: false
        });
      }
      if (fish.length > 0) {
        for (const rarity of rarityOrder) {
          const filtered = fish.filter(f => f.rarity === rarity);
          if (filtered.length > 0) {
            fields.push({
              name: `🐟 Fish — ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`,
              value: filtered.map(f => `**${fishRarityEmojis[rarity]} ${f.name}** (x${f.count}) — ${f.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} points`).join('\n'),
              inline: false
            });
          }
        }
      }
      
      if (animals.length > 0) {
        for (const rarity of rarityOrder) {
          const filtered = animals.filter(a => a.rarity === rarity);
          if (filtered.length > 0) {
            fields.push({
              name: `🦌 Animals — ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`,
              value: filtered.map(a => `**${animalRarityEmojis[rarity]} ${a.name}** (x${a.count}) — ${a.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} points`).join('\n'),
              inline: false
            });
          }
        }
      }
      
      const embed = {
        color: 0x2ecc71,
        title: '🎒 Your Collection',
        fields,
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      logger.error('Error in /collection command:', error);
      await ResponseHandler.handleError(interaction, error, 'Collection');
      return;
    }
  },
}; 