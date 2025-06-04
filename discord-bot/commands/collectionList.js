const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'transcendent'];
const rarityEmojis = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡',
  mythical: '🟠',
  transcendent: '🌟'
};

// Add rarity colors for embed
const rarityColors = {
  common: 0x95a5a6,        // Gray
  uncommon: 0x2ecc71,      // Green
  rare: 0x3498db,          // Blue
  epic: 0x9b59b6,          // Purple
  legendary: 0xf1c40f,     // Gold
  mythical: 0xe67e22,      // Orange
  transcendent: 0xFFFFFF   // White
};

// Helper to split long text into multiple fields
function splitIntoFields(title, fullText) {
  const chunks = [];
  let current = '';

  // Ensure we don't start with an empty line if fullText is long
  const lines = fullText.split('\n').filter(line => line.trim() !== '');

  for (const line of lines) {
    // Check if adding the next line would exceed the field value limit (1024 characters)
    // Allow some buffer for formatting
    if ((current + (current ? '\n' : '') + line).length > 1000) { // Use 1000 for safety
      chunks.push({ name: title, value: current.trim(), inline: false });
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) {
    chunks.push({ name: title, value: current.trim(), inline: false });
  }

  return chunks;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection-list')
    .setDescription('View all possible fish and animal names in the collection.'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.get(`${backendUrl}/users/collection-list`);
      const { fish, animals } = response.data;

      // Group by rarity
      function groupByRarity(items) {
        const grouped = {};
        for (const rarity of rarityOrder) grouped[rarity] = [];
        for (const item of items) {
          if (grouped[item.rarity]) grouped[item.rarity].push(item.name);
        }
        return grouped;
      }
      const fishByRarity = groupByRarity(fish);
      const animalsByRarity = groupByRarity(animals);

      // Prepare pages based on rarity
      const allPages = [];
      for (const rarity of rarityOrder) {
        const fishNames = fishByRarity[rarity] || [];
        const animalNames = animalsByRarity[rarity] || [];
        const combinedNames = [
          ...(fishNames.length > 0 ? fishNames.map(name => `🐟 ${name}`) : []),
          ...(animalNames.length > 0 ? animalNames.map(name => `🦌 ${name}`) : [])
        ].sort(); // Sort combined list alphabetically

        if (combinedNames.length === 0) continue; // Skip if no items for this rarity

        const header = `__${rarityEmojis[rarity] || ''} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} (${combinedNames.length})__`;
        const fullText = combinedNames.join('\n');

        // Split potentially long list into multiple fields if needed
        const rarityFields = splitIntoFields(header, fullText);

        // Add a page for this rarity (could span multiple fields if split)
        allPages.push({ rarity, fields: rarityFields });
      }

      if (allPages.length === 0) {
        const noItemsEmbed = {
          color: 0x95a5a6,
          title: 'Collection List',
          description: 'No items found in the collection list.',
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [noItemsEmbed] });
        return;
      }

      let currentPage = 0;
      const getEmbed = (pageIdx) => {
        const page = allPages[pageIdx];
        return {
          color: rarityColors[page.rarity] || 0x0099ff, // Use rarity color
          title: `Collection List — ${page.rarity.charAt(0).toUpperCase() + page.rarity.slice(1)} (${pageIdx + 1}/${allPages.length})`,
          fields: page.fields,
          timestamp: new Date(),
          footer: { text: `Page ${pageIdx + 1} of ${allPages.length} • Requested by ${interaction.user.tag}` }
        };
      };

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
          .setDisabled(allPages.length <= 1)
      );

      const message = await interaction.editReply({
        embeds: [getEmbed(currentPage)],
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
        row.components[1].setDisabled(currentPage === allPages.length - 1);
        await i.update({
          embeds: [getEmbed(currentPage)],
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
      logger.error('Error in /collection-list command:', error);
      await ResponseHandler.handleError(interaction, error, 'Collection List');
    }
  }
}; 