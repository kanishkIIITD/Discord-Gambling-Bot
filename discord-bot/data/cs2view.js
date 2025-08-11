const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2view')
    .setDescription('View detailed information about CS2 skins with search and pagination!')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User whose skins to view (leave empty for your own)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Get user's CS2 inventory
      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      
      if (!inventory || inventory.skins.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle('🎨 CS2 Skin Viewer')
          .setDescription(`${targetUser.username} hasn't opened any CS2 cases yet!`)
          .setColor(0x808080)
          .setThumbnail(targetUser.displayAvatarURL());

        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      // Show the first page of skins
      await this.showSkinPage(interaction, userId, guildId, backendUrl, inventory.skins, 0, '');

    } catch (error) {
      console.error('Error fetching CS2 inventory for view:', error);
      await interaction.editReply('❌ **Failed to load skins.** Please try again later.');
    }
  },

  async showSkinPage(interaction, userId, guildId, backendUrl, allSkins = null, page = 0, searchQuery = '') {
    try {
      let skins = allSkins;
      
      // If no skins provided, fetch from inventory
      if (!skins) {
        const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
          headers: { 'x-guild-id': guildId }
        });
        skins = response.data.inventory.skins;
      }
      
      // Apply search filter if query exists
      if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        skins = skins.filter(skin => 
          skin.weapon?.toLowerCase().includes(query) ||
          skin.skinName?.toLowerCase().includes(query) ||
          skin.rarity?.toLowerCase().includes(query) ||
          skin.wear?.toLowerCase().includes(query) ||
          (skin.formattedName && skin.formattedName.toLowerCase().includes(query))
        );
        
        if (skins.length === 0) {
          await interaction.editReply({ 
            content: `🔍 No skins found matching "${searchQuery}"\n\n💡 **Search Tips:**\n• Try searching by weapon name (e.g., "AK-47")\n• Search by skin name (e.g., "Dragon Tattoo")\n• Filter by rarity (e.g., "mil-spec", "covert")\n• Search by wear condition (e.g., "factory new")`, 
            embeds: [],
            components: []
          });
          return;
        }
        
        // Reset to first page when searching
        page = 0;
      }

      const skinsPerPage = 25; // Discord select menus can have up to 25 options
      const totalPages = Math.ceil(skins.length / skinsPerPage);
      const startIndex = page * skinsPerPage;
      const endIndex = startIndex + skinsPerPage;
      const displaySkins = skins.slice(startIndex, endIndex);

      // Create select menu options
      const selectOptions = displaySkins.map((skin, index) => ({
        label: `${skin.weapon} | ${skin.skinName}`,
        value: `skin_${startIndex + index}_${skin.skinId || 'unknown'}`,
        description: `${this.getRarityEmoji(skin.rarity)} ${skin.rarity} • ${this.getWearEmoji(skin.wear)} ${skin.wear} • 💰 ${skin.marketValue} currency`,
        emoji: this.getRarityEmoji(skin.rarity)
      }));

      // Create select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`cs2_view_select_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
        .setPlaceholder('Select a skin to view details...')
        .addOptions(selectOptions);

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);

      // Create pagination and search buttons
      const buttonRow = new ActionRowBuilder();
      
      // Navigation buttons
      if (page > 0) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_view_prev_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      if (page < totalPages - 1) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_view_next_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      // Search button
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_view_search_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
          .setLabel('🔍 Search')
          .setStyle(ButtonStyle.Primary)
      );

      // Clear search button (only show if there's a search query)
      if (searchQuery) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_view_clear_${userId}_0_`)
            .setLabel('❌ Clear Search')
            .setStyle(ButtonStyle.Danger)
        );
      }

      // Close button
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_view_close_${userId}`)
          .setLabel('❌ Close')
          .setStyle(ButtonStyle.Secondary)
      );

      const embed = new EmbedBuilder()
        .setTitle('🎨 CS2 Skin Viewer')
        .setDescription(
          searchQuery 
            ? `🔍 Search results for "${searchQuery}"\nShowing ${displaySkins.length} of ${skins.length} matching skins\n\nSelect a skin from the menu below to view detailed information:`
            : `Showing ${displaySkins.length} of ${skins.length} total skins\n\nSelect a skin from the menu below to view detailed information:`
        )
        .setColor(0x00ff00)
        .setFooter({ 
          text: `Page ${page + 1} of ${totalPages}${searchQuery ? ` • Search: "${searchQuery}"` : ''}`,
          iconURL: interaction.user.displayAvatarURL()
        });

      // Check if this is a new interaction or an update
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ 
          embeds: [embed], 
          components: [selectRow, buttonRow]
        });
      } else {
        await interaction.reply({ 
          embeds: [embed], 
          components: [selectRow, buttonRow],
          ephemeral: true 
        });
      }

      // Set a timeout to disable components after 5 minutes
      setTimeout(async () => {
        try {
          selectMenu.setDisabled(true);
          buttonRow.components.forEach(btn => btn.setDisabled(true));
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ 
              embeds: [embed], 
              components: [selectRow, buttonRow]
            });
          }
        } catch (error) {
          console.error('Error disabling components after timeout:', error);
        }
      }, 300000); // 5 minutes

    } catch (error) {
      console.error('Error showing skin page:', error);
      await interaction.editReply({ 
        content: '❌ Failed to load skins. Please try again later.', 
        embeds: [],
        components: []
      });
    }
  },

  async showSkinDetails(interaction, userId, guildId, backendUrl, skinId, page, searchQuery) {
    try {
      // Get user's CS2 inventory to find the specific skin
      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      
      // Extract the actual skinId from the value format: "skin_${index}_${skinId}"
      let actualSkinId = skinId;
      if (skinId.startsWith('skin_')) {
        const parts = skinId.split('_');
        if (parts.length >= 3) {
          actualSkinId = parts.slice(2).join('_'); // Get everything after "skin_index_"
        }
      }
      
      const skin = inventory.skins.find(s => s.skinId === actualSkinId);
      
      if (!skin) {
        await interaction.reply({ 
          content: '❌ Skin not found. It may have been removed or the ID is invalid.',
          ephemeral: true 
        });
        return;
      }

      // Create detailed skin embed
      const embed = new EmbedBuilder()
        .setTitle(`🎨 ${skin.weapon} | ${skin.skinName}`)
        .setColor(this.getRarityColor(skin.rarity))
        .setThumbnail(skin.imageUrl || 'https://via.placeholder.com/150x150/2f3136/ffffff?text=No+Image')
        .addFields(
          { 
            name: '⭐ Rarity', 
            value: `${this.getRarityEmoji(skin.rarity)} **${skin.rarity}**`, 
            inline: true 
          },
          { 
            name: '🔍 Wear', 
            value: `${this.getWearEmoji(skin.wear)} **${skin.wear}**`, 
            inline: true 
          },
          { 
            name: '💰 Market Value', 
            value: `**${skin.marketValue}** currency`, 
            inline: true 
          }
        );

      // Add additional details if available
      if (skin.isStatTrak) {
        embed.addFields({ name: '📊 StatTrak', value: '✅ Enabled', inline: true });
      }
      
      if (skin.isSouvenir) {
        embed.addFields({ name: '🏆 Souvenir', value: '✅ Yes', inline: true });
      }

      if (skin.formattedName) {
        embed.addFields({ name: '📝 Full Name', value: skin.formattedName, inline: false });
      }

      // Add navigation buttons
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_view_back_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
            .setLabel('◀️ Back to List')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`cs2_view_close_${userId}`)
            .setLabel('❌ Close')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({ 
        embeds: [embed], 
        components: [buttonRow],
        ephemeral: true 
      });

    } catch (error) {
      console.error('Error showing skin details:', error);
      await interaction.reply({ 
        content: '❌ Failed to load skin details. Please try again later.',
        ephemeral: true 
      });
    }
  },

  async showSearchModal(interaction, userId, guildId, backendUrl, currentPage, currentSearch) {
    try {
      // Create a modal for search input
      const modal = new ModalBuilder()
        .setCustomId(`cs2_view_search_modal_${userId}_${currentPage}_${encodeURIComponent(currentSearch)}`)
        .setTitle('🔍 Search CS2 Skins');

      const searchInput = new TextInputBuilder()
        .setCustomId('search_query')
        .setLabel('Search skins (weapon, skin, rarity, wear)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., AK-47, Dragon Tattoo, mil-spec, factory new')
        .setValue(currentSearch)
        .setRequired(false)
        .setMaxLength(100);

      const firstActionRow = new ActionRowBuilder().addComponents(searchInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Error showing search modal:', error);
      await interaction.reply({ 
        content: '❌ Failed to show search modal. Please try again.',
        ephemeral: true 
      });
    }
  },

  getRarityEmoji(rarity) {
    const emojis = {
      'consumer grade': '⚪',
      'industrial grade': '🔵',
      'mil-spec': '🔷',
      'restricted': '🟣',
      'classified': '🩷',
      'covert': '🔴',
      'special': '🟡'
    };
    return emojis[rarity] || '⚪';
  },

  getRarityColor(rarity) {
    const colors = {
      'consumer grade': 0x808080, // Gray
      'industrial grade': 0x4B9CD3, // Blue
      'mil-spec': 0x4B69FF, // Blue
      'restricted': 0x8847FF, // Purple
      'classified': 0xD32CE6, // Pink
      'covert': 0xEB4B4B, // Red
      'special': 0xFFD700  // Gold
    };
    return colors[rarity] || 0x808080;
  },

  getWearEmoji(wear) {
    const wearEmojis = {
      'factory new': '✨',
      'minimal wear': '🌟',
      'field-tested': '⭐',
      'well-worn': '💫',
      'battle-scarred': '🌙'
    };
    return wearEmojis[wear] || '⭐';
  }
};
