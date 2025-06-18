const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('Sell items from your collection for points!')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('What to sell')
        .setRequired(true)
        .addChoices(
          { name: 'Specific Item', value: 'specific' },
          { name: 'All Fish', value: 'all_fish' },
          { name: 'All Animals', value: 'all_animals' },
          { name: 'All Items', value: 'all_items' },
          { name: 'All Common', value: 'all_common' },
          { name: 'All Uncommon', value: 'all_uncommon' },
          { name: 'All Rare+', value: 'all_rare_plus' },
          { name: 'Everything', value: 'everything' }
        )
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of item (fish, animal, or item) - only for specific items')
        .setRequired(false)
        .addChoices(
          { name: 'Fish', value: 'fish' },
          { name: 'Animal', value: 'animal' },
          { name: 'Item', value: 'item' }
        )
    )
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the item to sell - only for specific items')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('How many to sell - only for specific items')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const userId = interaction.user.id;
      const action = interaction.options.getString('action');
      const type = interaction.options.getString('type');
      const name = interaction.options.getString('name');
      const count = interaction.options.getInteger('count');
      const guildId = interaction.guildId;

      // For specific items, validate required parameters
      if (action === 'specific') {
        if (!type || !name || !count) {
          return interaction.editReply({
            content: '❌ For specific items, you must provide type, name, and count.',
            ephemeral: true
          });
        }
      }

      // Get preview from backend
      const previewResponse = await axios.post(`${process.env.BACKEND_API_URL}/users/${userId}/sell-preview`, {
        action,
        type,
        name,
        count,
        guildId
      }, {
        headers: { 'x-guild-id': guildId }
      });

      const { itemsToPreview, totalValue, actionDescription, needsConfirmation } = previewResponse.data;

      if (itemsToPreview.length === 0) {
        return interaction.editReply({
          content: '❌ No items found to sell with the selected criteria.',
          ephemeral: true
        });
      }

      // Create preview embed
      const previewEmbed = new EmbedBuilder()
        .setColor(needsConfirmation ? 0xff6b6b : 0xffa500)
        .setTitle(needsConfirmation ? '⚠️ High-Value Sale Preview' : '📋 Sale Preview')
        .setDescription(actionDescription)
        .addFields(
          { name: 'Total Value', value: `${totalValue.toLocaleString()} points`, inline: true },
          { name: 'Items to Sell', value: itemsToPreview.slice(0, 10).map(item => `${item.count}x ${item.name} (${item.value.toLocaleString()} pts)`).join('\n'), inline: false }
        )
        .setTimestamp();

      if (itemsToPreview.length > 10) {
        previewEmbed.addFields({
          name: 'And more...',
          value: `...and ${itemsToPreview.length - 10} more items`,
          inline: false
        });
      }

      if (needsConfirmation) {
        previewEmbed.setDescription(`**WARNING:** This sale includes high-value items totaling **${totalValue.toLocaleString()}** points.\n\n${actionDescription}`);
      }

      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId(`sell_confirm_${action}`)
        .setLabel('✅ Accept')
        .setStyle(ButtonStyle.Success);

      const cancelButton = new ButtonBuilder()
        .setCustomId('sell_cancel')
        .setLabel('❌ Deny')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      // Store the preview data for the confirmation
      interaction.client.sellPreviews = interaction.client.sellPreviews || new Map();
      interaction.client.sellPreviews.set(interaction.user.id, {
        action,
        type,
        name,
        count,
        guildId,
        userId,
        totalValue,
        itemsToPreview
      });

      return interaction.editReply({
        embeds: [previewEmbed],
        components: [row],
        ephemeral: true
      });

    } catch (error) {
      logger.error('Error in /sell command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Sell');
        return;
      } else {
        await ResponseHandler.handleError(interaction, error, 'Sell');
        return;
      }
    }
  }
}; 