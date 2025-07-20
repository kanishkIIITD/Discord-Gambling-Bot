const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokepacks')
    .setDescription('Browse available Pokémon TCG card packs!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Fetch available packs from backend
      const response = await axios.get(`${backendUrl}/tcg/users/${userId}/packs`, {
        headers: { 'x-guild-id': guildId }
      });

      const { packs, userBalance, openingStats } = response.data;

      if (!packs || packs.length === 0) {
        return interaction.editReply('No card packs are currently available.');
      }

      // Create main embed
      const mainEmbed = new EmbedBuilder()
        .setTitle('🎴 Pokémon TCG Card Packs')
        .setDescription('Browse and purchase card packs with your points!')
        .setColor(0x3498db)
        .addFields(
          { name: 'Your Balance', value: `${userBalance.toLocaleString()} points`, inline: true },
          { name: 'Total Openings', value: `${openingStats.totalOpenings} packs`, inline: true },
          { name: 'Total Spent', value: `${openingStats.totalSpent.toLocaleString()} points`, inline: true }
        );

      // Create individual pack embeds
      const packEmbeds = [];
      const buttons = [];

      packs.forEach((pack, index) => {
        const rarityEmoji = getRarityEmoji(pack.packRarity);
        const statusEmoji = getStatusEmoji(pack.canAfford, pack.withinDailyLimit, pack.withinWeeklyLimit);
        
        const packEmbed = new EmbedBuilder()
          .setTitle(`${rarityEmoji} ${pack.name}`)
          .setDescription(pack.description)
          .setColor(getRarityColor(pack.packRarity))
          .addFields(
            { name: '💰 Price', value: `${pack.price.toLocaleString()} points`, inline: true },
            { name: '📦 Cards', value: `${pack.cardCount} cards per pack`, inline: true },
            { name: '📊 Rarity', value: formatRarityDistribution(pack.rarityDistribution), inline: false },
            { name: '🎯 Guarantees', value: formatGuarantees(pack), inline: false },
            { name: '✅ Status', value: statusEmoji, inline: false }
          );

        if (pack.imageUrl) {
          packEmbed.setThumbnail(pack.imageUrl);
        }

        packEmbeds.push(packEmbed);

        // Create button for this pack
        const button = new ButtonBuilder()
          .setCustomId(`pack_buy_${pack.packId}`)
          .setLabel(`Buy ${pack.name} (${pack.price})`)
          .setStyle(pack.canAfford && pack.withinDailyLimit && pack.withinWeeklyLimit ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(!pack.canAfford || !pack.withinDailyLimit || !pack.withinWeeklyLimit);

        buttons.push(button);
      });

      // Create button rows (max 5 buttons per row)
      const buttonRows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
        buttonRows.push(row);
      }

      // Combine all embeds
      const allEmbeds = [mainEmbed, ...packEmbeds];
      
      const message = await interaction.editReply({
        embeds: allEmbeds,
        components: buttonRows
      });

      // Create button collector
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('pack_buy_'),
        time: 60000
      });

      collector.on('collect', async i => {
        const packId = i.customId.replace('pack_buy_', '');
        const pack = packs.find(p => p.packId === packId);
        
        if (!pack) {
          await i.reply({ content: 'Pack not found.', ephemeral: true });
          return;
        }

        await i.deferUpdate();

        try {
          // Purchase the pack
          const purchaseResponse = await axios.post(`${backendUrl}/tcg/users/${userId}/packs/purchase`, {
            packId: pack.packId,
            quantity: 1
          }, {
            headers: { 'x-guild-id': guildId }
          });

          const { message: purchaseMessage, newBalance, packOpenings } = purchaseResponse.data;

          // Create success embed
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Pack Purchased!')
            .setDescription(purchaseMessage)
            .setColor(0x2ecc71)
            .addFields(
              { name: 'Pack', value: pack.name, inline: true },
              { name: 'Price', value: `${pack.price.toLocaleString()} points`, inline: true },
              { name: 'New Balance', value: `${newBalance.toLocaleString()} points`, inline: true },
              { name: 'Next Step', value: 'Use `/pokeopen` to open your pack!', inline: false }
            );

          await interaction.followUp({
            embeds: [successEmbed],
            ephemeral: true
          });

        } catch (error) {
          const errorMessage = error.response?.data?.message || 'Failed to purchase pack.';
          await interaction.followUp({
            content: `❌ ${errorMessage}`,
            ephemeral: true
          });
        }

        collector.stop();
      });

      collector.on('end', () => {
        // Disable buttons after timeout
        buttonRows.forEach(row => {
          row.components.forEach(btn => btn.setDisabled(true));
        });
        interaction.editReply({ components: buttonRows }).catch(() => {});
      });

    } catch (error) {
      console.error('[Pokepacks] Error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch available packs.';
      await interaction.editReply(`❌ ${errorMessage}`);
    }
  }
};

// Helper functions
function getRarityEmoji(rarity) {
  const emojis = {
    'common': '⚪',
    'uncommon': '🟢',
    'rare': '🔵',
    'epic': '🟣',
    'legendary': '🟡'
  };
  return emojis[rarity] || '⚪';
}

function getRarityColor(rarity) {
  const colors = {
    'common': 0x95a5a6,
    'uncommon': 0x2ecc71,
    'rare': 0x3498db,
    'epic': 0x9b59b6,
    'legendary': 0xf1c40f
  };
  return colors[rarity] || 0x95a5a6;
}

function getStatusEmoji(canAfford, withinDailyLimit, withinWeeklyLimit) {
  if (!canAfford) return '❌ **Not enough points**';
  if (!withinDailyLimit) return '⏰ **Daily limit reached**';
  if (!withinWeeklyLimit) return '📅 **Weekly limit reached**';
  return '✅ **Available to purchase**';
}

function formatRarityDistribution(distribution) {
  const parts = [];
  Object.entries(distribution).forEach(([rarity, count]) => {
    if (count > 0) {
      const emoji = getRarityEmoji(rarity);
      parts.push(`${emoji} ${count}x ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`);
    }
  });
  return parts.join(', ') || 'No cards';
}

function formatGuarantees(pack) {
  const guarantees = [];
  if (pack.guaranteedRare) guarantees.push('🎯 Guaranteed Rare');
  if (pack.guaranteedHolo) guarantees.push('✨ Guaranteed Holo');
  return guarantees.length > 0 ? guarantees.join(', ') : 'No guarantees';
} 