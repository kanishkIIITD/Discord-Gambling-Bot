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
            .setCustomId(`cs2_view_skins_${userId}_0`)
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
            .setEmoji('🏆'),
          new ButtonBuilder()
            .setCustomId(`cs2_rarest_drops_${userId}`)
            .setLabel('Rarest Drops')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('💎')
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
      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      let skins = inventory.skins;
      
      if (skins.length === 0) {
        await interaction.reply({ content: 'No skins found in inventory.', ephemeral: true });
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
          await interaction.reply({ 
            content: `🔍 No skins found matching "${searchQuery}"\n\n💡 **Search Tips:**\n• Try searching by weapon name (e.g., "AK-47")\n• Search by skin name (e.g., "Dragon Tattoo")\n• Filter by rarity (e.g., "mil-spec", "covert")\n• Search by wear condition (e.g., "factory new")`, 
            ephemeral: true 
          });
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
            ? `🔍 Search results for "${searchQuery}"\nShowing ${displaySkins.length} of ${skins.length} matching skins\n\n💡 **Search Tips:**\n• Weapon: "AK-47", "M4A4", "Glock"\n• Skin: "Dragon Tattoo", "Asiimov"\n• Rarity: "mil-spec", "covert", "special"\n• Wear: "factory new", "battle-scarred"`
            : `Showing ${displaySkins.length} of ${inventory.skins.length} total skins`
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
        
        embed.addFields({
          name: `${startIndex + index + 1}. ${skin.weapon} | ${skin.skinName}`,
          value: `${rarityEmoji} **${skin.rarity}** • ${wearEmoji} **${skin.wear}** • 💰 **${skin.marketValue}** currency ${statTrakIcon}${souvenirIcon}`,
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

      // Check if this is a new interaction or an update
      let message;
      if (interaction.replied || interaction.deferred) {
        // Update the existing message
        message = await interaction.editReply({ 
          embeds: [embed], 
          components: [buttonRow]
        });
      } else {
        // Send a new reply
        message = await interaction.reply({ 
          embeds: [embed], 
          components: [buttonRow],
          ephemeral: true 
        });
      }

      // Note: Button interactions are now handled globally in index.js
      // No need for local collectors here
      
      // Set a timeout to disable buttons after 5 minutes
      setTimeout(async () => {
        try {
          buttonRow.components.forEach(btn => btn.setDisabled(true));
          if (message && message.edit) {
            await message.edit({ components: [buttonRow] });
          }
        } catch (error) {
          console.error('Error disabling skins buttons after timeout:', error);
        }
      }, 300000); // 5 minutes

    } catch (error) {
      console.error('Error showing skins:', error);
      await interaction.reply({ 
        content: '❌ Failed to load skins. Please try again later.', 
        ephemeral: true 
      });
    }
  },

  async showSearchModal(interaction, userId, guildId, backendUrl, currentPage, currentSearch) {
    try {
      // Create a modal for search input
      const modal = new ModalBuilder()
        .setCustomId(`cs2_search_modal_${userId}_${currentPage}_${encodeURIComponent(currentSearch)}`)
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

  async showStats(interaction, userId, guildId, backendUrl) {
    try {
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

      // Check if this is a new interaction or an update
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: '❌ Failed to load stats.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Failed to load stats.', ephemeral: true });
      }
    }
  },

  async showBestDrops(interaction, userId, guildId, backendUrl) {
    try {
      const response = await axios.get(`${backendUrl}/cs2/drops/${userId}/best`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { drops } = response.data;
      
      if (drops.length === 0) {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: 'No case openings found.', ephemeral: true });
        } else {
          await interaction.reply({ content: 'No case openings found.', ephemeral: true });
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

      // Check if this is a new interaction or an update
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (error) {
      console.error('Error loading best drops:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: '❌ Failed to load best drops.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Failed to load best drops.', ephemeral: true });
      }
    }
  },

  async showRarestDrops(interaction, userId, guildId, backendUrl) {
    try {
      const response = await axios.get(`${backendUrl}/cs2/drops/${userId}/rarest`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { drops } = response.data;
      
      if (drops.length === 0) {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: 'No case openings found.', ephemeral: true });
        } else {
          await interaction.reply({ content: 'No case openings found.', ephemeral: true });
        }
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('💎 Rarest CS2 Drops')
        .setDescription(`Top ${drops.length} rarest skins by rarity`)
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

      // Check if this is a new interaction or an update
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (error) {
      console.error('Error loading rarest drops:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: '❌ Failed to load rarest drops.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Failed to load rarest drops.', ephemeral: true });
      }
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
