const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2sell')
    .setDescription('Sell a CS2 skin from your inventory'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Get user's inventory
      const inventoryResponse = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = inventoryResponse.data;
      const { skins } = inventory;
      
      if (!skins || skins.length === 0) {
        return interaction.editReply('❌ **No skins found!** You need to open some cases first to get skins to sell.');
      }

      // Debug logging
      console.log(`CS2 Sell - User ${userId} has ${skins.length} skins`);
      console.log('Sample skins:', skins.slice(0, 3).map(s => ({ 
        skinId: s.skinId, 
        name: s.formattedName, 
        rarity: s.rarity 
      })));
      
      // Check for duplicate skinIds
      const skinIds = skins.map(s => s.skinId);
      const uniqueIds = new Set(skinIds);
      if (skinIds.length !== uniqueIds.size) {
        console.warn(`Duplicate skinIds detected: ${skinIds.length} total, ${uniqueIds.size} unique`);
        const duplicates = skinIds.filter((id, index) => skinIds.indexOf(id) !== index);
        console.warn('Duplicate skinIds:', [...new Set(duplicates)]);
      }

      // Create paginated select menu
      const embed = new EmbedBuilder()
        .setTitle('💰 Sell CS2 Skin')
        .setDescription(`Select a skin to sell from your inventory (${skins.length} total skins)`)
        .setColor(0x00ff00)
        .setFooter({ 
          text: `Page 1 of ${Math.ceil(skins.length / 25)} • Use the menu below to select a skin`,
          iconURL: interaction.user.displayAvatarURL()
        });

      // Create select menu with first 25 skins
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('cs2_sell_select')
        .setPlaceholder('Choose a skin to sell...')
        .addOptions(this.createSkinOptions(skins.slice(0, 25), 0));

      // Validate that we have valid options
      if (selectMenu.options.length === 0) {
        return interaction.editReply('❌ **No valid skins found!** There was an issue processing your inventory.');
      }

      if (selectMenu.options.length > 25) {
        console.warn(`Too many options: ${selectMenu.options.length}, truncating to 25`);
        selectMenu.options = selectMenu.options.slice(0, 25);
      }

      const actionRow = new ActionRowBuilder().addComponents(selectMenu);

      // Add navigation buttons if there are more than 25 skins
      const navigationRow = this.createNavigationRow(skins.length, 0);

      await interaction.editReply({
        embeds: [embed],
        components: navigationRow ? [actionRow, navigationRow] : [actionRow]
      });

      // Set up collector for the select menu
      const filter = i => i.customId === 'cs2_sell_select' && i.user.id === userId;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 }); // 5 minutes

      collector.on('collect', async (i) => {
        const selectedSkinId = i.values[0];
        const selectedSkin = skins.find(skin => skin.skinId === selectedSkinId);
        
        if (!selectedSkin) {
          await i.reply({ content: '❌ Skin not found. Please try again.', ephemeral: true });
          return;
        }

        // Show confirmation
        await this.showSaleConfirmation(i, selectedSkin, userId, guildId, backendUrl);
      });

      collector.on('end', () => {
        // Disable components when collector expires
        const disabledRow = new ActionRowBuilder().addComponents(
          selectMenu.setDisabled(true)
        );
        const disabledNavRow = navigationRow ? new ActionRowBuilder().addComponents(
          ...navigationRow.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
        ) : null;
        
        interaction.editReply({
          components: disabledNavRow ? [disabledRow, disabledNavRow] : [disabledRow]
        }).catch(() => {});
      });

    } catch (error) {
      console.error('Error in cs2sell:', error);
      await interaction.editReply('❌ **Error loading inventory!** Please try again later.');
    }
  },

  createSkinOptions(skins, pageOffset) {
    // Ensure unique skinIds by using a Map to deduplicate
    const uniqueSkins = new Map();
    
    skins.forEach((skin, index) => {
      // Skip skins without valid skinId
      if (!skin.skinId) {
        console.warn(`Skin without skinId found:`, skin);
        return;
      }
      
      // Use skinId as key, if duplicate exists, keep the first one
      if (!uniqueSkins.has(skin.skinId)) {
        uniqueSkins.set(skin.skinId, skin);
      } else {
        console.warn(`Duplicate skinId found: ${skin.skinId}, keeping first occurrence`);
      }
    });

    // Convert back to array and create options
    const uniqueSkinsArray = Array.from(uniqueSkins.values());
    
    console.log(`Creating skin options: ${uniqueSkinsArray.length} unique skins from ${skins.length} total`);
    console.log('Sample skinIds:', uniqueSkinsArray.slice(0, 5).map(s => s.skinId));
    
    // Debug: Log the first few skins to see what fields are available
    console.log('First 3 skins with all fields:', uniqueSkinsArray.slice(0, 3).map(s => ({
      skinId: s.skinId,
      allFields: Object.keys(s),
      name: s.name,
      formattedName: s.formattedName,
      weapon: s.weapon,
      rarity: s.rarity
    })));
    
    // Additional validation - ensure all options have valid values
    // Use skinId as the primary identifier and create a readable name from skinId if needed
    const validOptions = uniqueSkinsArray
      .filter(skin => skin.skinId) // Only require skinId
      .map((skin, index) => {
        // Create a readable name from skinId if formattedName is not available
        const displayName = skin.formattedName || skin.name || this.formatSkinId(skin.skinId);
        
        return {
          label: `${displayName} (${skin.rarity || 'Unknown'})`,
          description: `${skin.weapon || this.extractWeaponFromSkinId(skin.skinId)} • ${skin.wear || 'Unknown'} • ${skin.marketValue || 0} points`,
          value: skin.skinId,
          emoji: this.getRarityEmoji(skin.rarity)
        };
      });
    
    console.log(`Final valid options: ${validOptions.length}`);
    return validOptions;
  },

  // Helper method to format skinId into a readable name
  formatSkinId(skinId) {
    if (!skinId) return 'Unknown Skin';
    
    // Convert skinId like "sg-553-ultraviolet" to "SG-553 Ultraviolet"
    return skinId
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  },

  // Helper method to extract weapon from skinId
  extractWeaponFromSkinId(skinId) {
    if (!skinId) return 'Unknown';
    
    // Extract weapon part (usually the first part before the first dash)
    const parts = skinId.split('-');
    if (parts.length >= 1) {
      return parts[0].toUpperCase();
    }
    return 'Unknown';
  },

  createNavigationRow(totalSkins, currentPage) {
    if (totalSkins <= 25) return null;

    const totalPages = Math.ceil(totalSkins / 25);
    const row = new ActionRowBuilder();

    // Previous page button
    if (currentPage > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_sell_prev_${currentPage}`)
          .setLabel('◀️ Previous')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // Page indicator
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('cs2_sell_page_info')
        .setLabel(`Page ${currentPage + 1} of ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // Next page button
    if (currentPage < totalPages - 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_sell_next_${currentPage}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Next ▶️')
      );
    }

    return row;
  },

  async showSaleConfirmation(interaction, skin, userId, guildId, backendUrl) {
    // Create a readable name from skinId if formattedName is not available
    const displayName = skin.formattedName || skin.name || this.formatSkinId(skin.skinId);
    
    const confirmationEmbed = new EmbedBuilder()
      .setTitle('💰 Confirm Sale')
      .setDescription(`Are you sure you want to sell this skin?`)
      .setColor(0xffaa00)
      .setThumbnail(skin.imageUrl || 'https://via.placeholder.com/150x150?text=Skin')
      .addFields(
        { name: '🎨 Skin', value: displayName, inline: false },
        { name: '⭐ Rarity', value: this.getRarityEmoji(skin.rarity) + ' ' + skin.rarity, inline: true },
        { name: '🔍 Wear', value: this.getWearEmoji(skin.wear) + ' ' + skin.wear, inline: true },
        { name: '💰 Market Value', value: `**${skin.marketValue}** points`, inline: true }
      )
      .setFooter({ 
        text: `Selling will give you ${skin.marketValue} points`,
        iconURL: interaction.user.displayAvatarURL()
      });

    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_sell_confirm_${skin.skinId}`)
          .setLabel('✅ Confirm Sale')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cs2_sell_cancel')
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      embeds: [confirmationEmbed],
      components: [actionRow],
      ephemeral: true
    });
  },

  getRarityEmoji(rarity) {
    const rarityEmojis = {
      'consumer-grade': '⚪',
      'industrial-grade': '🔵',
      'mil-spec': '🔷',
      'restricted': '🟣',
      'classified': '🩷',
      'covert': '🔴',
      'special': '🟡'
    };
    return rarityEmojis[rarity] || '⚪';
  },

  getWearEmoji(wear) {
    const wearEmojis = {
      'Factory New': '✨',
      'Minimal Wear': '🌟',
      'Field-Tested': '⭐',
      'Well-Worn': '💫',
      'Battle-Scarred': '💥'
    };
    return wearEmojis[wear] || '🔍';
  }
};
