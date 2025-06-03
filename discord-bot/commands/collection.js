const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const fishRarityEmojis = {
  common: '🐟', uncommon: '🎣', rare: '🐠',
  epic: '🦑', legendary: '🐉', mythical: '🌊', transcendent: '🪙🐟'
};

const animalRarityEmojis = {
  common: '🐾', uncommon: '🦃', rare: '🦊',
  epic: '🐻', legendary: '🦄', mythical: '🌌', transcendent: '🎩🦫'
};

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'transcendent'];
const sortByRarity = (a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);

// Helper to split long embed values into multiple fields
function splitIntoFields(title, fullText) {
  const chunks = [];
  let current = '';

  for (const line of fullText.split('\n')) {
    if ((current + '\n' + line).length > 1024) {
      chunks.push({ name: title, value: current.trim(), inline: false });
      current = line;
    } else {
      current += '\n' + line;
    }
  }

  if (current) {
    chunks.push({ name: title, value: current.trim(), inline: false });
  }

  return chunks;
}

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
      const response = await axios.get(`${backendUrl}/users/${userId}/collection`, {
        params: { guildId }, headers: { 'x-guild-id': guildId }
      });

      const inventory = response.data.inventory || [];
      const buffs = response.data.buffs || [];

      const fish = inventory.filter(i => i.type === 'fish').sort(sortByRarity);
      const animals = inventory.filter(i => i.type === 'animal').sort(sortByRarity);

      const pages = [];

      // Page 1 - Fish
      const fishText = fish.map(f =>
        `**${fishRarityEmojis[f.rarity]} ${f.name}** (${f.rarity}, x${f.count}) — ${f.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`
      ).join('\n') || 'You have no fish. Try `/fish`!';
      const fishFields = splitIntoFields('🐟 Fish', fishText);
      pages.push({
        color: 0x3498db,
        title: '🎒 Your Collection — Fish',
        fields: fishFields,
        footer: { text: `Requested by ${interaction.user.tag}` },
        timestamp: new Date()
      });

      // Page 2 - Animals
      const animalText = animals.map(a =>
        `**${animalRarityEmojis[a.rarity]} ${a.name}** (${a.rarity}, x${a.count}) — ${a.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`
      ).join('\n') || 'You have no animals. Try `/hunt`!';
      const animalFields = splitIntoFields('🦌 Animals', animalText);
      pages.push({
        color: 0xe67e22,
        title: '🎒 Your Collection — Animals',
        fields: animalFields,
        footer: { text: `Requested by ${interaction.user.tag}` },
        timestamp: new Date()
      });

      // Page 3 - Buffs
      const buffsText = buffs.map(b =>
        `**${b.description}**${b.expiresAt ? ` (expires <t:${Math.floor(new Date(b.expiresAt).getTime() / 1000)}:R>)` : ''}${b.usesLeft ? ` (uses left: ${b.usesLeft})` : ''}`
      ).join('\n') || 'You have no active buffs.';
      const buffsFields = splitIntoFields('🧪 Active Buffs', buffsText);
      pages.push({
        color: 0x9b59b6,
        title: '🎒 Your Collection — Active Buffs',
        fields: buffsFields,
        footer: { text: `Requested by ${interaction.user.tag}` },
        timestamp: new Date()
      });

      let currentPage = 0;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('⬅️ Prev')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next ➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pages.length <= 1)
      );

      const message = await interaction.editReply({
        embeds: [pages[currentPage]],
        components: [row]
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'Only the command user can interact with this.', ephemeral: true });
        }

        if (i.customId === 'prev') currentPage--;
        else if (i.customId === 'next') currentPage++;

        row.components[0].setDisabled(currentPage === 0);
        row.components[1].setDisabled(currentPage === pages.length - 1);

        await i.update({
          embeds: [pages[currentPage]],
          components: [row]
        });
      });

      collector.on('end', () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          row.components.map(btn => btn.setDisabled(true))
        );
        message.edit({ components: [disabledRow] }).catch(() => {});
      });

    } catch (error) {
      logger.error('Error in /collection command:', error);
      await ResponseHandler.handleError(interaction, error, 'Collection');
    }
  }
};

