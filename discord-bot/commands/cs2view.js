const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

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
      // Defer the interaction if it hasn't been replied to yet
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: false });
      }
      
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
        console.log(`[cs2view] Searching for "${query}" in ${skins.length} skins`);
        
        // Log a few sample skins for debugging
        if (skins.length > 0) {
          console.log(`[cs2view] Sample skins:`, skins.slice(0, 3).map(s => ({
            weapon: s.weapon,
            skinName: s.skinName,
            fullName: `${s.weapon} | ${s.skinName}`
          })));
        }
        
        skins = skins.filter(skin => 
          skin.weapon?.toLowerCase().includes(query) ||
          skin.skinName?.toLowerCase().includes(query) ||
          skin.rarity?.toLowerCase().includes(query) ||
          skin.wear?.toLowerCase().includes(query) ||
          skin.pattern?.toLowerCase().includes(query) ||
          skin.phase?.toLowerCase().includes(query) ||
          `${skin.weapon} | ${skin.skinName}`.toLowerCase().includes(query)
        );
        
        console.log(`[cs2view] Found ${skins.length} matching skins`);
        
        if (skins.length === 0) {
          // Defer if needed before editing
          if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply({ ephemeral: false });
          }
          
          await interaction.editReply({ 
            content: `🔍 No skins found matching "${searchQuery}"\n\n💡 **Search Tips:**\n• Try searching by weapon name (e.g., "AK-47")\n• Search by skin name (e.g., "Dragon Tattoo")\n• Filter by rarity (e.g., "mil-spec", "covert")\n• Search by wear condition (e.g., "factory new")\n• Search by pattern (e.g., "Doppler", "Marble Fade")\n• Search by phase (e.g., "Phase 4", "Ruby", "Sapphire")`, 
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
          ephemeral: false 
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
      
      // Defer if needed before editing
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: false });
      }
      
      await interaction.editReply({ 
        content: '❌ Failed to load skins. Please try again later.', 
        embeds: [],
        components: []
      });
    }
  },

  async showSkinDetails(interaction, userId, guildId, backendUrl, skinId, page, searchQuery) {
    try {
      // Defer the interaction if it hasn't been replied to yet
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: false });
      }
      
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
        await interaction.editReply({ 
          content: '❌ Skin not found. It may have been removed or the ID is invalid.',
          embeds: [],
          components: []
        });
        return;
      }

      // Get skin image from raw data
      const skinImage = await this.getSkinImage(skin);

      // Create detailed skin embed
      const embed = new EmbedBuilder()
        .setTitle(`🎨 ${skin.weapon} | ${skin.skinName}`)
        .setColor(this.getRarityColor(skin.rarity))
        .setImage(skinImage)
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

      // Add float, pattern, and phase information if available and meaningful
      if (skin.float !== undefined && skin.float !== null && skin.float !== 0.5) {
        embed.addFields({
          name: '📊 Float',
          value: `**${skin.float.toFixed(6)}**`,
          inline: true
        });
      }

      if (skin.pattern && skin.pattern.trim() !== '' && skin.pattern.trim() !== 'None') {
        embed.addFields({
          name: '🎭 Pattern',
          value: `**${skin.pattern}**`,
          inline: true
        });
      }

      if (skin.phase && skin.phase.trim() !== '' && skin.phase.trim() !== 'None') {
        embed.addFields({
          name: '🌈 Phase',
          value: `**${skin.phase}**`,
          inline: true
        });
      }

      // Add StatTrak and Souvenir information
      embed.addFields(
        { 
          name: '📊 StatTrak', 
          value: skin.isStatTrak ? '✅ Enabled' : '❌ Disabled', 
          inline: true 
        },
        { 
          name: '🏆 Souvenir', 
          value: skin.isSouvenir ? '✅ Yes' : '❌ No', 
          inline: true 
        }
      );

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

      await interaction.editReply({ 
        embeds: [embed], 
        components: [buttonRow]
      });

    } catch (error) {
      console.error('Error showing skin details:', error);
      await interaction.editReply({ 
        content: '❌ Failed to load skin details. Please try again later.',
        embeds: [],
        components: []
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
        .setLabel('Search skins (weapon, skin, rarity, wear, pattern, phase)')
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
      await interaction.editReply({ 
        content: '❌ Failed to show search modal. Please try again.',
        embeds: [],
        components: []
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
  },

  async getSkinImage(skin) {
    try {
      console.log(`🔍 [getSkinImage] Looking for skin: ${skin.weapon} | ${skin.skinName}`);
      console.log(`   Pattern: "${skin.pattern}"`);
      console.log(`   Phase: "${skin.phase}"`);
      
      // Look up the skin image from raw skins data
      const rawSkinsPath = path.join(__dirname, '../data/raw_skins.json');
      
      try {
        const rawSkinsData = JSON.parse(await fs.readFile(rawSkinsPath, 'utf8'));
        
        // Try to find the skin by matching weapon and pattern/phase
        for (const [itemId, itemData] of Object.entries(rawSkinsData)) {
          // Handle both weapon object structure and string structure
          let weaponName = '';
          if (typeof itemData.weapon === 'string') {
            weaponName = itemData.weapon;
          } else if (itemData.weapon?.name) {
            weaponName = itemData.weapon.name;
          }
          
          // Check if weapon matches
          const weaponMatch = weaponName === skin.weapon;
          
          if (weaponMatch) {
            // Handle both pattern object structure and string structure
            let patternName = '';
            if (typeof itemData.pattern === 'string') {
              patternName = itemData.pattern;
            } else if (itemData.pattern?.name) {
              patternName = itemData.pattern.name;
            }
            
            // Check if pattern matches
            const patternMatch = patternName === skin.pattern;
            
            // Check if phase matches (if skin has a phase)
            const phaseMatch = !skin.phase || skin.phase.trim() === '' || 
                              itemData.phase === skin.phase;
            
            if (patternMatch && phaseMatch) {
              console.log(`✅ [getSkinImage] Found exact match: ${itemData.name}`);
              console.log(`   Image: ${itemData.image || 'No main image'}`);
              console.log(`   Image URLs: ${itemData.image_urls ? itemData.image_urls.length : 0} available`);
              
              // Found matching skin, return the image URL
              if (itemData.image && itemData.image.trim() !== '' && !itemData.image.includes('placeholder')) {
                return itemData.image.trim();
              }
              
              // Fallback to image_urls array if main image field is not available
              if (itemData.image_urls && itemData.image_urls.length > 0) {
                const validImageUrl = itemData.image_urls.find(url => 
                  url && url.trim() !== '' && !url.includes('placeholder')
                );
                if (validImageUrl) {
                  return validImageUrl.trim();
                }
              }
            }
          }
        }
        
        // If no exact match found, try partial matching
        for (const [itemId, itemData] of Object.entries(rawSkinsData)) {
          // Handle both weapon object structure and string structure
          let weaponName = '';
          if (typeof itemData.weapon === 'string') {
            weaponName = itemData.weapon;
          } else if (itemData.weapon?.name) {
            weaponName = itemData.weapon.name;
          }
          
          if (weaponName && typeof weaponName === 'string') {
            const weaponMatch = weaponName.toLowerCase().includes(skin.weapon.toLowerCase()) ||
                               skin.weapon.toLowerCase().includes(weaponName.toLowerCase());
            
            if (weaponMatch) {
              // Handle both pattern object structure and string structure
              let patternName = '';
              if (typeof itemData.pattern === 'string') {
                patternName = itemData.pattern;
              } else if (itemData.pattern?.name) {
                patternName = itemData.pattern.name;
              }
              
              if (patternName && typeof patternName === 'string') {
                const patternMatch = patternName.toLowerCase().includes(skin.pattern.toLowerCase()) ||
                                   skin.pattern.toLowerCase().includes(patternName.toLowerCase());
                
                if (patternMatch) {
                  if (itemData.image && itemData.image.trim() !== '' && !itemData.image.includes('placeholder')) {
                    return itemData.image.trim();
                  }
                  
                  if (itemData.image_urls && itemData.image_urls.length > 0) {
                    const validImageUrl = itemData.image_urls.find(url => 
                      url && url.trim() !== '' && !url.includes('placeholder')
                    );
                    if (validImageUrl) {
                      return validImageUrl.trim();
                    }
                  }
                }
              }
            }
          }
        }
        
      } catch (fileError) {
        console.error('Error reading raw skins file:', fileError);
      }
      
      // If no image found, return a placeholder
      return 'https://via.placeholder.com/150x150/2f3136/ffffff?text=CS2+Skin';
      
    } catch (error) {
      console.error('Error getting skin image:', error);
      return 'https://via.placeholder.com/150x150/2f3136/ffffff?text=Error';
    }
  }
};
