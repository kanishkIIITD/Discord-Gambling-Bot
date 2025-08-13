const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2inventory')
    .setDescription('View your CS2 skin collection and inventory!')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User whose inventory to view (leave empty for your own)')
        .setRequired(false)
    ),

  async execute(interaction) {
    // The interaction is already deferred as PUBLIC by the main handler
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
          .setTitle('🎒 CS2 Inventory')
          .setDescription(`${targetUser.username} hasn't opened any CS2 cases yet!`)
          .setColor(0x808080)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: '📦 Cases Opened', value: '0', inline: true },
            { name: '🎨 Total Skins', value: '0', inline: true },
            { name: '💰 Total Spent', value: '0 currency', inline: true }
          );

        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      // Create main inventory embed
      const mainEmbed = new EmbedBuilder()
        .setTitle(`🎒 ${targetUser.username}'s CS2 Inventory`)
        .setDescription(`**${inventory.totalSkins}** skins • **${inventory.casesOpened}** cases opened`)
        .setColor(0x00ff00)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: '📦 Cases Opened', value: inventory.casesOpened.toString(), inline: true },
          { name: '🎨 Total Skins', value: inventory.totalSkins.toString(), inline: true },
          { name: '💰 Total Spent', value: `${inventory.totalSpent} currency`, inline: true }
        );

      // Add estimated total value if available
      if (inventory.totalValue) {
        mainEmbed.addFields({
          name: '💎 Estimated Value',
          value: `${inventory.totalValue} currency`,
          inline: true
        });
      }

      // Add rarity breakdown
      const rarityBreakdown = Object.entries(inventory.rarityBreakdown)
        .filter(([_, count]) => count > 0)
        .map(([rarity, count]) => {
          const rarityEmoji = this.getRarityEmoji(rarity.replace(/([A-Z])/g, ' $1').toLowerCase());
          const rarityName = rarity.replace(/([A-Z])/g, ' $1');
          return `${rarityEmoji} **${rarityName}**: ${count}`;
        })
        .join('\n');

      if (rarityBreakdown) {
        mainEmbed.addFields({
          name: '🎨 Rarity Breakdown',
          value: rarityBreakdown,
          inline: false
        });
      }

      // Add notable skins
      if (inventory.rarestSkin) {
        mainEmbed.addFields({
          name: '💎 Rarest Skin',
          value: inventory.rarestSkin,
          inline: true
        });
      }

      if (inventory.mostExpensiveSkin) {
        mainEmbed.addFields({
          name: '💰 Most Expensive',
          value: inventory.mostExpensiveSkin,
          inline: true
        });
      }

      // Create navigation buttons
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_inventory_view_skins_${userId}_0`)
            .setLabel('View Skins')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎨'),
          new ButtonBuilder()
            .setCustomId(`cs2_stats_${userId}`)
            .setLabel('View Stats')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId(`cs2_best_drops_${userId}`)
            .setLabel('Best Drops')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🏆')
        );

      const message = await interaction.editReply({
        embeds: [mainEmbed],
        components: [buttonRow]
      });

      // Note: Button and modal interactions are now handled globally in index.js
      // No need for local collectors here
      
      // Set a timeout to disable buttons after 5 minutes
      setTimeout(async () => {
        try {
          buttonRow.components.forEach(btn => btn.setDisabled(true));
          await interaction.editReply({
            embeds: [mainEmbed],
            components: [buttonRow]
          });
        } catch (error) {
          console.error('Error disabling buttons after timeout:', error);
        }
      }, 300000); // 5 minutes

    } catch (error) {
      console.error('Error fetching CS2 inventory:', error);
      await interaction.editReply('❌ **Failed to load inventory.** Please try again later.');
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

  async showSkins(interaction, userId, guildId, backendUrl, page = 0, searchQuery = '') {
    try {
      // This method now only handles updates for pagination and search within an already displayed skins message
      // For button interactions, we don't need to defer since they're already handled
      // For modal interactions, we need to reply since they can't update existing messages
      if (interaction.isModalSubmit() && !interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      let skins = inventory.skins || [];
      
      // If skins array is empty but we have totalSkins count, try to get skins from case openings
      if (skins.length === 0 && inventory.totalSkins > 0) {
        try {
          console.log(`🔍 [showSkins] Skins array empty but totalSkins is ${inventory.totalSkins}, attempting to get skins from case openings`);
          const openingsResponse = await axios.get(`${backendUrl}/cs2/openings/${userId}?limit=100`, {
            headers: { 'x-guild-id': guildId }
          });
          
          if (openingsResponse.data.success && openingsResponse.data.openings) {
            // Convert case openings to skin format
            skins = openingsResponse.data.openings.map(opening => ({
              skinId: opening.result.name, // Use the combined name as skinId
              skinName: opening.result.name.split(' | ')[1] || opening.result.name,
              weapon: opening.result.name.split(' | ')[0] || 'Unknown',
              rarity: opening.result.rarity,
              wear: opening.result.wear,
              float: opening.result.float,
              pattern: opening.result.pattern,
              phase: opening.result.phase,
              isStatTrak: opening.result.isStatTrak,
              isSouvenir: opening.result.isSouvenir,
              marketValue: opening.result.marketValue || 0,
              obtainedAt: opening.openedAt
            }));
            console.log(`🔍 [showSkins] Reconstructed ${skins.length} skins from case openings`);
          }
        } catch (error) {
          console.error('Error getting skins from case openings:', error);
        }
      }
      
      if (skins.length === 0) {
        if (interaction.isButton()) {
          await interaction.update({ content: 'No skins found in inventory.', ephemeral: true });
        } else if (interaction.isModalSubmit()) {
        await interaction.editReply({ content: 'No skins found in inventory.', ephemeral: true });
        }
        return;
      }

      // Apply search filter if query exists
      if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const originalCount = skins.length;
        
        skins = skins.filter(skin => 
          skin.weapon?.toLowerCase().includes(query) ||
          skin.skinName?.toLowerCase().includes(query) ||
          skin.rarity?.toLowerCase().includes(query) ||
          skin.wear?.toLowerCase().includes(query) ||
          (skin.formattedName && skin.formattedName.toLowerCase().includes(query))
        );
        
        if (skins.length === 0) {
          if (interaction.isButton()) {
            await interaction.update({ 
              content: `🔍 No skins found matching "${searchQuery}"\n\n💡 **Search Tips:**\n• Try searching by weapon name (e.g., "AK-47")\n• Search by skin name (e.g., "Dragon Tattoo")\n• Filter by rarity (e.g., "mil-spec", "covert")\n• Search by wear condition (e.g., "factory new")`, 
              ephemeral: true 
            });
          } else if (interaction.isModalSubmit()) {
          await interaction.editReply({ 
            content: `🔍 No skins found matching "${searchQuery}"\n\n💡 **Search Tips:**\n• Try searching by weapon name (e.g., "AK-47")\n• Search by skin name (e.g., "Dragon Tattoo")\n• Filter by rarity (e.g., "mil-spec", "covert")\n• Search by wear condition (e.g., "factory new")`, 
            ephemeral: true 
          });
          }
          return;
        }
        
        // Reset to first page when searching
        page = 0;
      }

      const skinsPerPage = 10;
      const totalPages = Math.ceil(skins.length / skinsPerPage);
      const startIndex = page * skinsPerPage;
      const endIndex = startIndex + skinsPerPage;
      const displaySkins = skins.slice(startIndex, endIndex);

      const embed = new EmbedBuilder()
        .setTitle('🎨 CS2 Skins')
        .setDescription(
          searchQuery 
            ? `🔍 Search results for "${searchQuery}"\nShowing ${displaySkins.length} of ${skins.length} matching skins\n\n💡 **Search Tips:**\n• Weapon: "AK-47", "M4A4", "Glock"\n• Skin: "Dragon Tattoo", "Asiimov"\n• Rarity: "mil-spec", "covert", "special"\n• Wear: "factory new", "battle-scarred"\n• Pattern: "Doppler", "Marble Fade", "Fade"\n• Phase: "Phase 1", "Ruby", "Sapphire"`
            : `Showing ${displaySkins.length} of ${skins.length} total skins`
        )
        .setColor(0x00ff00)
        .setFooter({ 
          text: `Page ${page + 1} of ${totalPages}${searchQuery ? ` • Search: "${searchQuery}"` : ''}`,
          iconURL: interaction.user.displayAvatarURL()
        });

      displaySkins.forEach((skin, index) => {
        const rarityEmoji = this.getRarityEmoji(skin.rarity);
        const wearEmoji = this.getWearEmoji(skin.wear);
        const statTrakIcon = skin.isStatTrak ? '📊' : '';
        const souvenirIcon = skin.isSouvenir ? '🏆' : '';
        
        // Build additional info string for float, pattern, and phase
        let additionalInfo = [];
        if (skin.float !== undefined && skin.float !== null) {
          additionalInfo.push(`📊 **${skin.float.toFixed(6)}**`);
        }
        if (skin.pattern && skin.pattern.trim() !== '') {
          additionalInfo.push(`🎭 **${skin.pattern}**`);
        }
        if (skin.phase && skin.phase.trim() !== '') {
          additionalInfo.push(`🌈 **${skin.phase}**`);
        }
        
        const additionalInfoText = additionalInfo.length > 0 ? `\n${additionalInfo.join(' • ')}` : '';
        
        embed.addFields({
          name: `${startIndex + index + 1}. ${skin.weapon} | ${skin.skinName}`,
          value: `${rarityEmoji} **${skin.rarity}** • ${wearEmoji} **${skin.wear}** • 💰 **${skin.marketValue}** currency ${statTrakIcon}${souvenirIcon}${additionalInfoText}`,
          inline: false
        });
      });

      // Create pagination and search buttons
      const buttonRow = new ActionRowBuilder();
      
      // Navigation buttons
      if (page > 0) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_skins_prev_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      if (page < totalPages - 1) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_skins_next_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      // Search button
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_skins_search_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
          .setLabel('🔍 Search')
          .setStyle(ButtonStyle.Primary)
      );

      // Clear search button (only show if there's a search query)
      if (searchQuery) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_skins_clear_${userId}_0_`)
            .setLabel('❌ Clear Search')
            .setStyle(ButtonStyle.Danger)
        );
      }

      // Close button
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_skins_close_${userId}`)
          .setLabel('❌ Close')
          .setStyle(ButtonStyle.Secondary)
      );

      // Use update for button interactions, editReply for modal interactions
      if (interaction.isButton()) {
        await interaction.update({ 
          embeds: [embed], 
          components: [buttonRow]
        });
      } else if (interaction.isModalSubmit()) {
        // For modal interactions, we need to reply since they can't update existing messages
        await interaction.editReply({ 
        embeds: [embed], 
        components: [buttonRow]
      });
      }

    } catch (error) {
      console.error('Error showing skins:', error);
      if (interaction.isButton()) {
        await interaction.update({ 
          content: '❌ Failed to load skins. Please try again later.', 
          ephemeral: true 
        });
      } else if (interaction.isModalSubmit()) {
      await interaction.editReply({ 
        content: '❌ Failed to load skins. Please try again later.', 
          ephemeral: true 
        });
      }
    }
  },

  async createSearchResultsMessage(interaction, userId, guildId, backendUrl, searchQuery) {
    try {
      // For modal interactions, we need to reply since they can't update existing messages
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      let skins = inventory.skins || [];
      
      // If skins array is empty but we have totalSkins count, try to get skins from case openings
      if (skins.length === 0 && inventory.totalSkins > 0) {
        try {
          console.log(`🔍 [createSearchResultsMessage] Skins array empty but totalSkins is ${inventory.totalSkins}, attempting to get skins from case openings`);
          const openingsResponse = await axios.get(`${backendUrl}/cs2/openings/${userId}?limit=100`, {
            headers: { 'x-guild-id': guildId }
          });
          
          if (openingsResponse.data.success && openingsResponse.data.openings) {
            // Convert case openings to skin format
            skins = openingsResponse.data.openings.map(opening => ({
              skinId: opening.result.name, // Use the combined name as skinId
              skinName: opening.result.name.split(' | ')[1] || opening.result.name,
              weapon: opening.result.name.split(' | ')[0] || 'Unknown',
              rarity: opening.result.rarity,
              wear: opening.result.wear,
              float: opening.result.float,
              pattern: opening.result.pattern,
              phase: opening.result.phase,
              isStatTrak: opening.result.isStatTrak,
              isSouvenir: opening.result.isSouvenir,
              marketValue: opening.result.marketValue || 0,
              obtainedAt: opening.openedAt
            }));
            console.log(`🔍 [createSearchResultsMessage] Reconstructed ${skins.length} skins from case openings`);
          }
        } catch (error) {
          console.error('Error getting skins from case openings:', error);
        }
      }
      
      if (skins.length === 0) {
        await interaction.editReply({ content: 'No skins found in inventory.', ephemeral: true });
        return;
      }

      // Apply search filter
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
            ephemeral: true 
          });
          return;
        }
      }

      const skinsPerPage = 10;
      const totalPages = Math.ceil(skins.length / skinsPerPage);
      const page = 0; // Always start at page 0 for search results
      const startIndex = page * skinsPerPage;
      const endIndex = startIndex + skinsPerPage;
      const displaySkins = skins.slice(startIndex, endIndex);

      const embed = new EmbedBuilder()
        .setTitle('🔍 CS2 Search Results')
        .setDescription(`🔍 Search results for "${searchQuery}"\nShowing ${displaySkins.length} of ${skins.length} matching skins\n\n💡 **Search Tips:**\n• Weapon: "AK-47", "M4A4", "Glock"\n• Skin: "Dragon Tattoo", "Asiimov"\n• Rarity: "mil-spec", "covert", "special"\n• Wear: "factory new", "battle-scarred"\n• Pattern: "Doppler", "Marble Fade", "Fade"\n• Phase: "Phase 1", "Ruby", "Sapphire"`)
        .setColor(0x00ff00)
        .setFooter({ 
          text: `Page ${page + 1} of ${totalPages} • Search: "${searchQuery}"`,
          iconURL: interaction.user.displayAvatarURL()
        });

      displaySkins.forEach((skin, index) => {
        const rarityEmoji = this.getRarityEmoji(skin.rarity);
        const wearEmoji = this.getWearEmoji(skin.wear);
        const statTrakIcon = skin.isStatTrak ? '📊' : '';
        const souvenirIcon = skin.isSouvenir ? '🏆' : '';
        
        // Build additional info string for float, pattern, and phase
        let additionalInfo = [];
        if (skin.float !== undefined && skin.float !== null) {
          additionalInfo.push(`📊 **${skin.float.toFixed(6)}**`);
        }
        if (skin.pattern && skin.pattern.trim() !== '') {
          additionalInfo.push(`🎭 **${skin.pattern}**`);
        }
        if (skin.phase && skin.phase.trim() !== '') {
          additionalInfo.push(`🌈 **${skin.phase}**`);
        }
        
        const additionalInfoText = additionalInfo.length > 0 ? `\n${additionalInfo.join(' • ')}` : '';
        
        embed.addFields({
          name: `${startIndex + index + 1}. ${skin.weapon} | ${skin.skinName}`,
          value: `${rarityEmoji} **${skin.rarity}** • ${wearEmoji} **${skin.wear}** • 💰 **${skin.marketValue}** currency ${statTrakIcon}${souvenirIcon}${additionalInfoText}`,
          inline: false
        });
      });

      // Create pagination and navigation buttons
      const buttonRow = new ActionRowBuilder();
      
      // Navigation buttons
      if (totalPages > 1) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_skins_next_${userId}_${page}_${encodeURIComponent(searchQuery)}`)
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      // Back to main inventory button
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_inventory_view_skins_${userId}_0`)
          .setLabel('◀️ Back to Inventory')
          .setStyle(ButtonStyle.Secondary)
      );

      // Close button
      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_skins_close_${userId}`)
          .setLabel('❌ Close')
          .setStyle(ButtonStyle.Secondary)
      );

      // Create new message for search results
      await interaction.editReply({ 
        embeds: [embed], 
        components: [buttonRow]
      });

    } catch (error) {
      console.error('Error creating search results message:', error);
      await interaction.editReply({ 
        content: '❌ Failed to load search results. Please try again later.', 
        ephemeral: true 
      });
    }
  },

  async showSearchModal(interaction, userId, guildId, backendUrl, currentPage, currentSearch) {
    try {
      // This method now only handles updates for button interactions
      // For modal interactions, we need to reply since they can't update existing messages
      if (interaction.isModalSubmit() && !interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      // Create a modal for search input
      const modal = new ModalBuilder()
        .setCustomId(`cs2_search_modal_${userId}_${currentPage}_${encodeURIComponent(currentSearch)}`)
        .setTitle('🔍 Search CS2 Skins');

      const searchInput = new TextInputBuilder()
        .setCustomId('search_query')
        .setLabel('Search skins by weapon, skin, rarity, wear')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., AK-47, Doppler, Phase 4, Ruby, mil-spec, factory new')
        .setValue(currentSearch)
        .setRequired(false)
        .setMaxLength(100);

      const firstActionRow = new ActionRowBuilder().addComponents(searchInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Error showing search modal:', error);
      if (interaction.isButton()) {
        await interaction.update({ 
          content: '❌ Failed to show search modal. Please try again.', 
          ephemeral: true 
        });
      } else if (interaction.isModalSubmit()) {
      await interaction.editReply({ 
        content: '❌ Failed to show search modal. Please try again.', 
        ephemeral: true 
      });
      }
    }
  },

  async showStats(interaction, userId, guildId, backendUrl) {
    try {
      // This method now only handles updates for button interactions
      // For modal interactions, we need to reply since they can't update existing messages
      if (interaction.isModalSubmit() && !interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const response = await axios.get(`${backendUrl}/cs2/stats/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { stats } = response.data;
      
      const embed = new EmbedBuilder()
        .setTitle('📊 CS2 Statistics')
        .setColor(0x00ff00)
        .addFields(
          { name: '📦 Cases Opened', value: stats.totalOpenings.toString(), inline: true },
          { name: '💰 Total Spent', value: `${stats.totalSpent} currency`, inline: true },
          { name: '💎 Total Value', value: `${stats.totalValue} currency`, inline: true },
          { name: '💵 Total Profit', value: `${stats.totalProfit} currency`, inline: true },
          { name: '📈 Profit Margin', value: `${stats.profitMargin.toFixed(2)}%`, inline: true },
          { name: '🎯 Profitable Opens', value: `${stats.profitableOpenings}/${stats.totalOpenings}`, inline: true }
        );

      if (interaction.isButton()) {
        await interaction.update({ embeds: [embed] });
      } else if (interaction.isModalSubmit()) {
      await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      if (interaction.isButton()) {
        await interaction.update({ content: '❌ Failed to load stats.', ephemeral: true });
      } else if (interaction.isModalSubmit()) {
      await interaction.editReply({ content: '❌ Failed to load stats.', ephemeral: true });
      }
    }
  },

  async showBestDrops(interaction, userId, guildId, backendUrl, createNewMessage = false) {
    try {
      // This method now only handles updates for button interactions
      // For modal interactions, we need to reply since they can't update existing messages
      if (interaction.isModalSubmit() && !interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const response = await axios.get(`${backendUrl}/cs2/drops/${userId}/best`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { drops } = response.data;
      
      if (drops.length === 0) {
        if (interaction.isButton()) {
          await interaction.update({ content: 'No case openings found.', ephemeral: true });
        } else if (interaction.isModalSubmit()) {
          await interaction.editReply({ content: 'No case openings found.', ephemeral: true });
        }
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 Best CS2 Drops')
        .setDescription(`Top ${drops.length} most valuable skins`)
        .setColor(0x00ff00);

      drops.forEach((drop, index) => {
        const rarityEmoji = this.getRarityEmoji(drop.result.rarity);
        const profitEmoji = drop.profit > 0 ? '🟢' : drop.profit < 0 ? '🔴' : '⚪';
        
        embed.addFields({
          name: `${index + 1}. ${drop.result.name}`,
          value: `${rarityEmoji} **${drop.result.rarity}** • 💰 **${drop.result.marketValue}** currency • ${profitEmoji} **${drop.profit}** profit\n📦 From: ${drop.caseName}`,
          inline: false
        });
      });

      if (interaction.isButton()) {
        await interaction.update({ embeds: [embed] });
      } else if (interaction.isModalSubmit()) {
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error loading best drops:', error);
      if (interaction.isButton()) {
        await interaction.update({ content: '❌ Failed to load best drops.', ephemeral: true });
      } else if (interaction.isModalSubmit()) {
        await interaction.editReply({ content: '❌ Failed to load best drops.', ephemeral: true });
      }
    }
  },

  async createBestDropsMessage(interaction, userId, guildId, backendUrl) {
    try {
      // For button interactions, we need to create a new message instead of updating
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const response = await axios.get(`${backendUrl}/cs2/drops/${userId}/best`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { drops } = response.data;
      
      if (drops.length === 0) {
        await interaction.editReply({ content: 'No case openings found.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 Best CS2 Drops')
        .setDescription(`Top ${drops.length} most valuable skins`)
        .setColor(0x00ff00);

      drops.forEach((drop, index) => {
        const rarityEmoji = this.getRarityEmoji(drop.result.rarity);
        const profitEmoji = drop.profit > 0 ? '🟢' : drop.profit < 0 ? '🔴' : '⚪';
        
        embed.addFields({
          name: `${index + 1}. ${drop.result.name}`,
          value: `${rarityEmoji} **${drop.result.rarity}** • 💰 **${drop.result.marketValue}** currency • ${profitEmoji} **${drop.profit}** profit\n📦 From: ${drop.caseName}`,
          inline: false
        });
      });

      // Create navigation buttons
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_inventory_view_skins_${userId}_0`)
            .setLabel('◀️ Back to Inventory')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`cs2_skins_close_${userId}`)
            .setLabel('❌ Close')
            .setStyle(ButtonStyle.Secondary)
        );

      // Create new message for best drops
      await interaction.editReply({ 
        embeds: [embed], 
        components: [buttonRow]
      });

    } catch (error) {
      console.error('Error creating best drops message:', error);
      await interaction.editReply({ 
        content: '❌ Failed to load best drops. Please try again later.', 
        ephemeral: true 
      });
    }
  },

  async createViewSkinsMessage(interaction, userId, guildId, backendUrl) {
    try {
      // For button interactions, we need to create a new message instead of updating
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      let skins = inventory.skins || [];
      
      // If skins array is empty but we have totalSkins count, try to get skins from case openings
      if (skins.length === 0 && inventory.totalSkins > 0) {
        try {
          console.log(`🔍 [createViewSkinsMessage] Skins array empty but totalSkins is ${inventory.totalSkins}, attempting to get skins from case openings`);
          const openingsResponse = await axios.get(`${backendUrl}/cs2/openings/${userId}?limit=100`, {
            headers: { 'x-guild-id': guildId }
          });
          
          if (openingsResponse.data.success && openingsResponse.data.openings) {
            // Convert case openings to skin format
            skins = openingsResponse.data.openings.map(opening => ({
              skinId: opening.result.name, // Use the combined name as skinId
              skinName: opening.result.name.split(' | ')[1] || opening.result.name,
              weapon: opening.result.name.split(' | ')[0] || 'Unknown',
              rarity: opening.result.rarity,
              wear: opening.result.wear,
              float: opening.result.float,
              pattern: opening.result.pattern,
              phase: opening.result.phase,
              isStatTrak: opening.result.isStatTrak,
              isSouvenir: opening.result.isSouvenir,
              marketValue: opening.result.marketValue || 0,
              obtainedAt: opening.openedAt
            }));
            console.log(`🔍 [createViewSkinsMessage] Reconstructed ${skins.length} skins from case openings`);
          }
        } catch (error) {
          console.error('Error getting skins from case openings:', error);
        }
      }
      
      if (skins.length === 0) {
        await interaction.editReply({ content: 'No skins found in your inventory.', ephemeral: true });
        return;
      }

      const itemsPerPage = 10;
      const totalPages = Math.ceil(skins.length / itemsPerPage);
      const currentPage = 0;
      const startIndex = currentPage * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const currentSkins = skins.slice(startIndex, endIndex);

      const embed = new EmbedBuilder()
        .setTitle('🔫 CS2 Skins Inventory')
        .setDescription(`Showing ${startIndex + 1}-${Math.min(endIndex, skins.length)} of ${skins.length} skins`)
        .setColor(0x0099ff);

      currentSkins.forEach((skin, index) => {
        const rarityEmoji = this.getRarityEmoji(skin.rarity);
        const wearEmoji = this.getWearEmoji(skin.wear);
        const statTrakIcon = skin.isStatTrak ? '📊' : '';
        const souvenirIcon = skin.isSouvenir ? '🏆' : '';
        
        // Build additional info string for float, pattern, and phase
        let additionalInfo = [];
        if (skin.float !== undefined && skin.float !== null) {
          additionalInfo.push(`📊 **${skin.float.toFixed(6)}**`);
        }
        if (skin.pattern && skin.pattern.trim() !== '') {
          additionalInfo.push(`🎭 **${skin.pattern}**`);
        }
        if (skin.phase && skin.phase.trim() !== '') {
          additionalInfo.push(`🌈 **${skin.phase}**`);
        }
        
        const additionalInfoText = additionalInfo.length > 0 ? `\n${additionalInfo.join(' • ')}` : '';
        
        embed.addFields({
          name: `${startIndex + index + 1}. ${skin.weapon} | ${skin.skinName}`,
          value: `${rarityEmoji} **${skin.rarity}** • ${wearEmoji} **${skin.wear}** • 💰 **${skin.marketValue}** currency ${statTrakIcon}${souvenirIcon}${additionalInfoText}`,
          inline: false
        });
      });

      // Create navigation buttons
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_skins_prev_${userId}_${currentPage}_`)
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId(`cs2_skins_search_${userId}_${currentPage}_`)
            .setLabel('🔍 Search')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`cs2_skins_next_${userId}_${currentPage + 1}_`)
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage >= totalPages - 1),
          new ButtonBuilder()
            .setCustomId(`cs2_skins_clear_${userId}_0_`)
            .setLabel('🔄 Clear')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`cs2_skins_close_${userId}`)
            .setLabel('❌ Close')
            .setStyle(ButtonStyle.Secondary)
        );

      // Create new message for skins view
      await interaction.editReply({ 
        embeds: [embed], 
        components: [buttonRow]
      });

    } catch (error) {
      console.error('Error creating view skins message:', error);
      await interaction.editReply({ 
        content: '❌ Failed to load skins. Please try again later.', 
        ephemeral: true 
      });
    }
  },

  async createStatsMessage(interaction, userId, guildId, backendUrl) {
    try {
      // For button interactions, we need to create a new message instead of updating
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      let skins = inventory.skins || [];
      
      // If skins array is empty but we have totalSkins count, try to get skins from case openings
      if (skins.length === 0 && inventory.totalSkins > 0) {
        try {
          console.log(`🔍 [createStatsMessage] Skins array empty but totalSkins is ${inventory.totalSkins}, attempting to get skins from case openings`);
          const openingsResponse = await axios.get(`${backendUrl}/cs2/openings/${userId}?limit=100`, {
            headers: { 'x-guild-id': guildId }
          });
          
          if (openingsResponse.data.success && openingsResponse.data.openings) {
            // Convert case openings to skin format
            skins = openingsResponse.data.openings.map(opening => ({
              skinId: opening.result.name, // Use the combined name as skinId
              skinName: opening.result.name.split(' | ')[1] || opening.result.name,
              weapon: opening.result.name.split(' | ')[0] || 'Unknown',
              rarity: opening.result.rarity,
              wear: opening.result.wear,
              float: opening.result.float,
              pattern: opening.result.pattern,
              phase: opening.result.phase,
              isStatTrak: opening.result.isStatTrak,
              isSouvenir: opening.result.isSouvenir,
              marketValue: opening.result.marketValue || 0,
              obtainedAt: opening.openedAt
            }));
            console.log(`🔍 [createStatsMessage] Reconstructed ${skins.length} skins from case openings`);
          }
        } catch (error) {
          console.error('Error getting skins from case openings:', error);
        }
      }
      
      if (skins.length === 0) {
        await interaction.editReply({ content: 'No skins found in your inventory.', ephemeral: true });
        return;
      }

      // Calculate statistics
      const totalValue = skins.reduce((sum, skin) => sum + (skin.marketValue || 0), 0);
      const rarityCounts = {};
      const wearCounts = {};
      
      skins.forEach(skin => {
        rarityCounts[skin.rarity] = (rarityCounts[skin.rarity] || 0) + 1;
        wearCounts[skin.wear] = (wearCounts[skin.wear] || 0) + 1;
      });

      const embed = new EmbedBuilder()
        .setTitle('📊 CS2 Inventory Statistics')
        .setDescription(`Statistics for your CS2 inventory`)
        .setColor(0x00ff00)
        .addFields(
          { name: 'Total Skins', value: `${skins.length}`, inline: true },
          { name: 'Total Value', value: `${totalValue} currency`, inline: true },
          { name: 'Average Value', value: `${Math.round(totalValue / skins.length)} currency`, inline: true }
        );

      // Add rarity breakdown
      const rarityBreakdown = Object.entries(rarityCounts)
        .map(([rarity, count]) => `${this.getRarityEmoji(rarity)} **${rarity}**: ${count}`)
        .join('\n');
      
      if (rarityBreakdown) {
        embed.addFields({ name: 'Rarity Breakdown', value: rarityBreakdown, inline: false });
      }

      // Add wear breakdown
      const wearBreakdown = Object.entries(wearCounts)
        .map(([wear, count]) => `${this.getWearEmoji(wear)} **${wear}**: ${count}`)
        .join('\n');
      
      if (wearBreakdown) {
        embed.addFields({ name: 'Wear Breakdown', value: wearBreakdown, inline: false });
      }

      // Create navigation buttons
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_inventory_view_skins_${userId}_0`)
            .setLabel('🔫 View Skins')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`cs2_best_drops_${userId}`)
            .setLabel('🏆 Best Drops')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`cs2_skins_close_${userId}`)
            .setLabel('❌ Close')
            .setStyle(ButtonStyle.Secondary)
        );

      // Create new message for stats
      await interaction.editReply({ 
        embeds: [embed], 
        components: [buttonRow]
      });

    } catch (error) {
      console.error('Error creating stats message:', error);
      await interaction.editReply({ 
        content: '❌ Failed to load statistics. Please try again later.', 
        ephemeral: true 
      });
    }
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
