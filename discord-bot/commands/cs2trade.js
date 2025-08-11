const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2trade')
    .setDescription('Trade a CS2 skin with another user'),

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
        return interaction.editReply('❌ **No skins found!** You need to open some cases first to get skins to trade.');
      }

      // Debug logging
      console.log(`CS2 Trade - User ${userId} has ${skins.length} skins`);
      
      // Check for duplicate skinIds
      const skinIds = skins.map(s => s.skinId);
      const uniqueIds = new Set(skinIds);
      if (skinIds.length !== uniqueIds.size) {
        console.warn(`Duplicate skinIds detected in trade: ${skinIds.length} total, ${uniqueIds.size} unique`);
      }

      // Create paginated select menu for skin selection
      const embed = new EmbedBuilder()
        .setTitle('🤝 Trade CS2 Skin')
        .setDescription(`Select a skin to trade from your inventory (${skins.length} total skins)`)
        .setColor(0x0099ff)
        .setFooter({ 
          text: `Page 1 of ${Math.ceil(skins.length / 25)} • Use the menu below to select a skin`,
          iconURL: interaction.user.displayAvatarURL()
        });

      // Create select menu with first 25 skins
      const skinSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('cs2_trade_skin_select')
        .setPlaceholder('Choose a skin to trade...')
        .addOptions(this.createSkinOptions(skins.slice(0, 25), 0));

      const skinRow = new ActionRowBuilder().addComponents(skinSelectMenu);

      // Add navigation buttons if there are more than 25 skins
      const navigationRow = this.createNavigationRow(skins.length, 0);

      await interaction.editReply({
        embeds: [embed],
        components: navigationRow ? [skinRow, navigationRow] : [skinRow]
      });

      // Set up collector for the skin select menu
      const filter = i => i.customId === 'cs2_trade_skin_select' && i.user.id === userId;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 }); // 5 minutes

      collector.on('collect', async (i) => {
        const selectedSkinId = i.values[0];
        const selectedSkin = skins.find(skin => skin.skinId === selectedSkinId);
        
        if (!selectedSkin) {
          await i.reply({ content: '❌ Skin not found. Please try again.', ephemeral: true });
          return;
        }

        // Show user selection
        await this.showUserSelection(i, selectedSkin, userId, guildId, backendUrl);
      });

      collector.on('end', () => {
        // Disable components when collector expires
        const disabledRow = new ActionRowBuilder().addComponents(
          skinSelectMenu.setDisabled(true)
        );
        const disabledNavRow = navigationRow ? new ActionRowBuilder().addComponents(
          ...navigationRow.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
        ) : null;
        
        interaction.editReply({
          components: disabledNavRow ? [disabledRow, disabledNavRow] : [disabledRow]
        }).catch(() => {});
      });

    } catch (error) {
      console.error('Error in cs2trade:', error);
      await interaction.editReply('❌ **Error loading inventory!** Please try again later.');
    }
  },

  createSkinOptions(skins, pageOffset) {
    // Ensure unique skinIds by using a Map to deduplicate
    const uniqueSkins = new Map();
    
    skins.forEach((skin, index) => {
      // Skip skins without valid skinId
      if (!skin.skinId) {
        console.warn(`Skin without skinId found in trade:`, skin);
        return;
      }
      
      // Use skinId as key, if duplicate exists, keep the first one
      if (!uniqueSkins.has(skin.skinId)) {
        uniqueSkins.set(skin.skinId, skin);
      } else {
        console.warn(`Duplicate skinId found in trade: ${skin.skinId}, keeping first occurrence`);
      }
    });

    // Convert back to array and create options
    const uniqueSkinsArray = Array.from(uniqueSkins.values());
    
    console.log(`Creating trade skin options: ${uniqueSkinsArray.length} unique skins from ${skins.length} total`);
    
    // Debug: Log the first few skins to see what fields are available
    console.log('First 3 trade skins with all fields:', uniqueSkinsArray.slice(0, 3).map(s => ({
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
    
    console.log(`Final valid trade options: ${validOptions.length}`);
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
          .setCustomId(`cs2_trade_prev_${currentPage}`)
          .setLabel('◀️ Previous')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // Page indicator
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('cs2_trade_page_info')
        .setLabel(`Page ${currentPage + 1} of ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // Next page button
    if (currentPage < totalPages - 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_trade_next_${currentPage}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Next ▶️')
      );
    }

    return row;
  },

  async showUserSelection(interaction, skin, userId, guildId, backendUrl) {
    // Create a readable name from skinId if formattedName is not available
    const displayName = skin.formattedName || skin.name || this.formatSkinId(skin.skinId);
    
    const userSelectEmbed = new EmbedBuilder()
      .setTitle('🤝 Select Trade Partner')
      .setDescription(`You selected: **${displayName}**`)
      .setColor(0x0099ff)
      .setThumbnail(skin.imageUrl || 'https://via.placeholder.com/150x150?text=Skin')
      .addFields(
        { name: '🎨 Skin', value: displayName, inline: false },
        { name: '⭐ Rarity', value: this.getRarityEmoji(skin.rarity) + ' ' + skin.rarity, inline: true },
        { name: '🔍 Wear', value: this.getWearEmoji(skin.wear) + ' ' + skin.wear, inline: true },
        { name: '💰 Market Value', value: `**${skin.marketValue}** points`, inline: true }
      )
      .setFooter({ 
        text: 'Select a user to trade with',
        iconURL: interaction.user.displayAvatarURL()
      });

    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId('cs2_trade_user_select')
      .setPlaceholder('Choose a user to trade with...');

    const actionRow = new ActionRowBuilder().addComponents(userSelectMenu);

    await interaction.reply({
      embeds: [userSelectEmbed],
      components: [actionRow],
      ephemeral: true
    });

    // Set up collector for user selection
    const filter = i => i.customId === 'cs2_trade_user_select' && i.user.id === userId;
    const userCollector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 }); // 5 minutes

    userCollector.on('collect', async (i) => {
      const targetUserId = i.values[0];
      
      if (targetUserId === userId) {
        await i.reply({ content: '❌ You cannot trade with yourself!', ephemeral: true });
        return;
      }

      // Show trade proposal
      await this.showTradeProposal(i, skin, userId, targetUserId, guildId, backendUrl);
    });

    userCollector.on('end', () => {
      // Disable user select menu when collector expires
      const disabledRow = new ActionRowBuilder().addComponents(
        userSelectMenu.setDisabled(true)
      );
      
      interaction.editReply({
        components: [disabledRow]
      }).catch(() => {});
    });
  },

  async showTradeProposal(interaction, skin, userId, targetUserId, guildId, backendUrl) {
    const targetUser = interaction.client.users.cache.get(targetUserId);
    const targetUsername = targetUser ? targetUser.username : `User ${targetUserId}`;
    
    // Create a readable name from skinId if formattedName is not available
    const displayName = skin.formattedName || skin.name || this.formatSkinId(skin.skinId);

    const tradeEmbed = new EmbedBuilder()
      .setTitle('🤝 Trade Proposal')
      .setDescription(`**${interaction.user.username}** wants to trade with **${targetUsername}**\n\n*Only ${targetUsername} can use the buttons below*`)
      .setColor(0xffaa00)
      .setThumbnail(skin.imageUrl || 'https://via.placeholder.com/150x150?text=Skin')
      .addFields(
        { name: '🎨 Skin Offered', value: displayName, inline: false },
        { name: '⭐ Rarity', value: this.getRarityEmoji(skin.rarity) + ' ' + skin.rarity, inline: true },
        { name: '🔍 Wear', value: this.getWearEmoji(skin.wear) + ' ' + skin.wear, inline: true },
        { name: '💰 Market Value', value: `**${skin.marketValue}** points`, inline: true },
        { name: '👤 Trade Partner', value: `<@${targetUserId}>`, inline: true }
      )
      .setFooter({ 
        text: `Trade proposed by ${interaction.user.username} • Only ${targetUsername} can respond`,
        iconURL: interaction.user.displayAvatarURL()
      });

    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`cs2_trade_accept_${skin.skinId}_${userId}_${targetUserId}`)
          .setLabel('✅ Accept Trade')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cs2_trade_decline_${skin.skinId}_${userId}_${targetUserId}`)
          .setLabel('❌ Decline Trade')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      content: `<@${targetUserId}> **New Trade Proposal!**`,
      embeds: [tradeEmbed],
      components: [actionRow],
      ephemeral: false // Make trade proposal public so target user can see it
    });
  },

  getRarityEmoji(rarity) {
    const rarityEmojis = {
      'consumerGrade': '⚪',
      'industrialGrade': '🔵',
      'milSpec': '🔷',
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
