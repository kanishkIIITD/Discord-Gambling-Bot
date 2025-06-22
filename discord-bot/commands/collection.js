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

const fishRarityEmojis = {
  common: '🐟', uncommon: '🎣', rare: '🐠',
  epic: '🦑', legendary: '🐉', mythical: '🌊', transcendent: '🪙🐟', og: '🔱'
};

const animalRarityEmojis = {
  common: '🐾', uncommon: '🦃', rare: '🦊',
  epic: '🐻', legendary: '🦄', mythical: '🌌', transcendent: '🎩🦫', og: '👑'
};

const collectibleRarityEmojis = {
  common: '🎁', uncommon: '🎀', rare: '🎊',
  epic: '🎉', legendary: '💫', mythical: '✨', transcendent: '🌟', og: '👑'
};

const rarityColors = {
  common: 0x95a5a6,
  uncommon: 0x2ecc71,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf1c40f,
  mythical: 0xe67e22,
  transcendent: 0xFF1493,
  og: 0xC0392B
};

function splitIntoFields(title, fullText) {
  const chunks = [];
  let current = '';
  const lines = fullText.split('\n').filter(Boolean);
  let first = true;
  for (const line of lines) {
    if ((current + '\n' + line).length > 1000) {
      chunks.push({ name: first ? title : '\u200B', value: current.trim(), inline: false });
      current = line;
      first = false;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current) {
    chunks.push({ name: first ? title : '\u200B', value: current.trim(), inline: false });
  }
  return chunks;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collection')
    .setDescription('View your fishing, hunting, and collectible items collection!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.get(`${backendUrl}/users/${userId}/collection`, {
        params: { guildId },
        headers: { 'x-guild-id': guildId }
      });

      const inventory = response.data.inventory || [];

      // Check if inventory is empty
      if (inventory.length === 0) {
        const emptyEmbed = {
          color: 0x95a5a6,
          title: '🎒 Your Collection',
          description: 'Your collection is empty! Try `/fish` or `/hunt` to start collecting items.',
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [emptyEmbed] });
        return;
      }

      const pages = [];

      for (const rarity of rarityOrder) {
        const fish = inventory.filter(i => i.rarity === rarity && i.type === 'fish');
        const animals = inventory.filter(i => i.rarity === rarity && i.type === 'animal');
        const collectibles = inventory.filter(i => i.rarity === rarity && i.type === 'item');

        if (fish.length === 0 && animals.length === 0 && collectibles.length === 0) continue;

        const fishLines = fish.map(f =>
          `**${fishRarityEmojis[f.rarity] || ''} ${f.name}** (x${f.count}) — ${f.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} pts`
        );
        const animalLines = animals.map(a =>
          `**${animalRarityEmojis[a.rarity] || ''} ${a.name}** (x${a.count}) — ${a.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} pts`
        );
        const collectibleLines = collectibles.map(c =>
          `**${collectibleRarityEmojis[c.rarity] || ''} ${c.name}** (x${c.count})${c.value > 0 ? ` — ${c.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} pts` : ''}`
        );

        // Sort all lines alphabetically
        const combinedText = [...fishLines, ...animalLines, ...collectibleLines].sort().join('\n') || 'Nothing collected yet.';
        const fields = splitIntoFields(`${rarityEmojis[rarity]} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`, combinedText);

        pages.push({
          color: rarityColors[rarity] || 0x0099ff,
          title: `🎒 Your Collection — ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`,
          fields,
          footer: { text: `Requested by ${interaction.user.tag}` },
          timestamp: new Date()
        });
      }

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
