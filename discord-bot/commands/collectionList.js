const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'transcendent', 'og'];
const rarityEmojis = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡',
  mythical: '🟠',
  transcendent: '🌟',
  og: '🕶️'
};

// Add rarity colors for embed
const rarityColors = {
  common: 0x95a5a6,        // Gray
  uncommon: 0x2ecc71,      // Green
  rare: 0x3498db,          // Blue
  epic: 0x9b59b6,          // Purple
  legendary: 0xf1c40f,     // Gold
  mythical: 0xe67e22,      // Orange
  transcendent: 0xFF1493,  // Pink
  og: 0xC0392B            // Red
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
      const { fish, animals, items } = response.data;

      // Group by rarity
      function groupByRarity(items) {
        const grouped = {};
        for (const rarity of rarityOrder) {
          const fish = items.filter(i => i.rarity === rarity && i.type === 'fish');
          const animals = items.filter(i => i.rarity === rarity && i.type === 'animal');
          const collectibles = items.filter(i => i.rarity === rarity && i.type === 'item');
          if (fish.length > 0 || animals.length > 0 || collectibles.length > 0) {
            grouped[rarity] = {
              fish,
              animals,
              collectibles,
              fields: []
            };
          }
        }
        return grouped;
      }

      // Combine all items into one array
      const allItems = [...(fish || []), ...(animals || []), ...(items || [])];
      const groupedItems = groupByRarity(allItems);

      const allPages = [];
      for (const rarity of rarityOrder) {
        const group = groupedItems[rarity];
        if (!group) continue;

        const fishLines = group.fish.map(f => `🐟 **${f.name}**`);
        const animalLines = group.animals.map(a => `🦁 **${a.name}**`);
        const collectibleLines = group.collectibles.map(c => `🎁 **${c.name}**`);

        // Sort all lines alphabetically within their type groups
        const combinedText = [
          ...(fishLines.length > 0 ? [...fishLines] : []),
          ...(animalLines.length > 0 ? [...animalLines] : []),
          ...(collectibleLines.length > 0 ? [...collectibleLines] : [])
        ].join('\n') || 'No items in this rarity.';

        const fields = splitIntoFields(`${rarityEmojis[rarity]} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`, combinedText);

        allPages.push({
          rarity,
          fields
        });
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
          color: rarityColors[page.rarity] || 0x0099ff,
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