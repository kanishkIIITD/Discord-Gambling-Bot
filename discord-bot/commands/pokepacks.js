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
      const selectOptions = [];

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
            // { name: '📊 Rarity', value: formatRarityDistribution(pack.rarityDistribution), inline: false },
            { name: '🎯 Guarantees', value: formatGuarantees(pack), inline: false },
            { name: '✅ Status', value: statusEmoji, inline: false }
          );

        if (pack.imageUrl) {
          packEmbed.setThumbnail(pack.imageUrl);
        }

        packEmbeds.push(packEmbed);

        // Add option for select menu
        selectOptions.push({
          label: `${pack.name} (${pack.price.toLocaleString()} pts)` + (pack.canAfford && pack.withinDailyLimit && pack.withinWeeklyLimit ? '' : ' [Unavailable]'),
          value: pack.packId,
          description: pack.description?.slice(0, 90) || undefined,
          default: false,
          emoji: getRarityEmoji(pack.packRarity),
          disabled: !(pack.canAfford && pack.withinDailyLimit && pack.withinWeeklyLimit)
        });
      });

      // Create select menu
      const { StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('pack_select')
        .setPlaceholder('Select a pack to purchase')
        .addOptions(selectOptions.map(opt => {
          // Discord.js v14 does not support 'disabled' on options, so filter out unavailable packs
          if (opt.disabled) return null;
          return {
            label: opt.label,
            value: opt.value,
            description: opt.description,
            emoji: opt.emoji
          };
        }).filter(Boolean));

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);

      // Combine all embeds
      const allEmbeds = [mainEmbed, ...packEmbeds];
      
      const message = await interaction.editReply({
        embeds: allEmbeds,
        components: [selectRow]
      });

      // Create select menu collector
      const selectCollector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId === 'pack_select',
        time: 60000
      });

      selectCollector.on('collect', async i => {
        const packId = i.values[0];
        const pack = packs.find(p => p.packId === packId);
        if (!pack) {
          await i.reply({ content: 'Pack not found.', ephemeral: true });
          return;
        }

        // Show modal for quantity input
        const modal = new ModalBuilder()
          .setCustomId(`pack_buy_modal_${pack.packId}`)
          .setTitle(`Buy ${pack.name}`);

        const quantityInput = new TextInputBuilder()
          .setCustomId('quantity')
          .setLabel('How many packs do you want to buy?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter a number (e.g. 1)')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(4);

        const modalRow = new ActionRowBuilder().addComponents(quantityInput);
        modal.addComponents(modalRow);

        await i.showModal(modal);

        // Wait for modal submit
        try {
          const submitted = await i.awaitModalSubmit({
            time: 60000,
            filter: (modalInteraction) => modalInteraction.customId === `pack_buy_modal_${pack.packId}` && modalInteraction.user.id === interaction.user.id
          });

          const quantityStr = submitted.fields.getTextInputValue('quantity');
          const quantity = parseInt(quantityStr, 10);
          if (isNaN(quantity) || quantity < 1 || quantity > 9999) {
            await submitted.reply({ content: 'Please enter a valid quantity (1-9999).', ephemeral: true });
            return;
          }
          await submitted.deferUpdate();
          try {
            // Purchase the pack(s)
            const purchaseResponse = await axios.post(`${backendUrl}/tcg/users/${userId}/packs/purchase`, {
              packId: pack.packId,
              quantity
            }, {
              headers: { 'x-guild-id': guildId }
            });

            const { message: purchaseMessage, newBalance, packOpenings } = purchaseResponse.data;

            // Create success embed
            const successEmbed = new EmbedBuilder()
              .setTitle('✅ Pack(s) Purchased!')
              .setDescription(purchaseMessage)
              .setColor(0x2ecc71)
              .addFields(
                { name: 'Pack', value: pack.name, inline: true },
                { name: 'Price', value: `${pack.price.toLocaleString()} points`, inline: true },
                { name: 'Quantity', value: `${quantity}`, inline: true },
                { name: 'Total Spent', value: `${(pack.price * quantity).toLocaleString()} points`, inline: true },
                { name: 'New Balance', value: `${newBalance.toLocaleString()} points`, inline: true },
                { name: 'Next Step', value: 'Use `/pokeopen` to open your pack(s)!', inline: false }
              );

            await interaction.followUp({
              embeds: [successEmbed],
              ephemeral: true
            });
          } catch (error) {
            const errorMessage = error.response?.data?.message || 'Failed to purchase pack(s).';
            await interaction.followUp({
              content: `❌ ${errorMessage}`,
              ephemeral: true
            });
          }
        } catch (modalError) {
          // Modal not submitted in time or error
          await interaction.followUp({ content: 'Modal timed out or something went wrong. Please try again.', ephemeral: true });
        }
        selectCollector.stop();
      });

      selectCollector.on('end', () => {
        // Disable select menu after timeout
        selectRow.components.forEach(comp => comp.setDisabled(true));
        interaction.editReply({ components: [selectRow] }).catch(() => {});
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