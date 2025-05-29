const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

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
      // Group by type
      const fish = inventory.filter(i => i.type === 'fish');
      const animals = inventory.filter(i => i.type === 'animal');
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
        fields.push({
          name: '🐟 Fish',
          value: fish.map(f => `**${f.name}** (${f.rarity}, x${f.count}) — ${f.value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`).join('\n'),
          inline: false
        });
      }
      if (animals.length > 0) {
        fields.push({
          name: '🦌 Animals',
          value: animals.map(a => `**${a.name}** (${a.rarity}, x${a.count}) — ${a.value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`).join('\n'),
          inline: false
        });
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