const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2open')
    .setDescription('Open a CS2 case and get a random skin!')
    .addStringOption(option =>
      option.setName('case')
        .setDescription('The case to open (use /cs2cases to see available cases)')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      const response = await axios.get(`${backendUrl}/cs2/cases`);
      const { cases } = response.data;

      const filtered = cases
        .filter(caseItem => caseItem.formattedName.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25);

      const choices = filtered.map(caseItem => ({
        name: caseItem.formattedName,
        value: caseItem.caseId
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in autocomplete:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    // The interaction is already deferred as PUBLIC by the main handler
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const caseId = interaction.options.getString('case');
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Get case details first
      let caseData;
      try {
        const caseResponse = await axios.get(`${backendUrl}/cs2/cases/${caseId}`);
        caseData = caseResponse.data.case;
        
        if (!caseData) {
          return interaction.editReply(`❌ **Case not found!** The specified case could not be found.`);
        }
        
        if (!caseData.price || caseData.price <= 0) {
          return interaction.editReply(`❌ **Invalid case!** This case has no price set.`);
        }
      } catch (error) {
        if (error.response?.status === 404) {
          return interaction.editReply(`❌ **Case not found!** The specified case could not be found.`);
        }
        console.error('Error fetching case data:', error);
        return interaction.editReply(`❌ **Error fetching case data.** Please try again later.`);
      }

      // Check if user has enough money
      let balance;
      try {
        const walletResponse = await axios.get(`${backendUrl}/users/${userId}/wallet`, {
          headers: { 'x-guild-id': guildId }
        });
        balance = walletResponse.data.balance;
      } catch (error) {
        if (error.response?.status === 404) {
          return interaction.editReply(`❌ **No wallet found!** <@${interaction.user.id}>, you need to have a wallet to open cases.`);
        }
        console.error('Error fetching wallet:', error);
        return interaction.editReply(`❌ **Error fetching wallet.** Please try again later.`);
      }

      if (balance < caseData.price) {
        return interaction.editReply(`❌ **Insufficient funds!** <@${interaction.user.id}>, you need **${caseData.price}** points to open this case.\nYour balance: **${balance}** points`);
      }
      
      if (balance < 0) {
        return interaction.editReply(`❌ **Invalid balance!** <@${interaction.user.id}>, your wallet has a negative balance. Please contact an administrator.`);
      }

      // Create opening animation embed
      const openingEmbed = new EmbedBuilder()
        .setTitle('🎯 Opening Case...')
        .setDescription(`You are opening **${caseData.formattedName}**...\nPlease wait while we reveal your skin!`)
        .setColor(0xffff00)
        .setThumbnail(caseData.imageUrl)
        .addFields(
          { name: '💰 Cost', value: `${caseData.price} points`, inline: true },
          { name: '📦 Case', value: caseData.formattedName, inline: true }
        );

      let openingMessage;
      try {
        openingMessage = await interaction.editReply({
          content: `<@${interaction.user.id}>`,
          embeds: [openingEmbed],
          components: []
        });
      } catch (replyError) {
        console.error('Failed to create opening message:', replyError);
        // If we can't create the opening message, just proceed without it
        openingMessage = null;
      }

      // Simulate opening delay for suspense
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Open the case
      let openResponse;
      try {
        openResponse = await axios.post(`${backendUrl}/cs2/cases/${caseId}/open`, { userId: userId }, {
          headers: { 'x-guild-id': guildId }
        });
      } catch (error) {
        if (error.response?.status === 400) {
          return interaction.editReply(`❌ **Error opening case:** ${error.response.data.error || 'Unknown error'}`);
        } else if (error.response?.status === 500) {
          return interaction.editReply(`❌ **Server error.** Please try again later.`);
        }
        console.error('Error opening case:', error);
        return interaction.editReply(`❌ **Failed to open case.** Please try again later.`);
      }

      const { result } = openResponse.data;
      
      if (!result || !result.skin) {
        return interaction.editReply(`❌ **Invalid response from server.** Please try again later.`);
      }

      // Create result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle('🎉 Case Opened!')
        .setDescription(`You opened **${caseData.formattedName}** and got:`)
        .setColor(this.getRarityColor(result.skin.rarity));

      // Set large skin image
      if (result.skin.imageUrl) {
        resultEmbed.setImage(result.skin.imageUrl);
      }

      // Add skin details
      const skinName = result.skin.name || 'Unknown Skin'; // Use the full formatted name directly
      const rarityEmoji = this.getRarityEmoji(result.skin.rarity || 'consumer grade');
      const wearEmoji = this.getWearEmoji(result.skin.wear || 'field-tested');
      
      // Debug logging for rarity verification
      console.log(`🎯 Case opened - Skin rarity debug:`);
      console.log(`   Skin: ${skinName}`);
      console.log(`   Rarity from backend: ${result.skin.rarity}`);
      console.log(`   Rarity emoji: ${rarityEmoji}`);
      console.log(`   Wear: ${result.skin.wear}`);
      console.log(`   Float: ${result.skin.float}`);
      console.log(`   Pattern: ${result.skin.pattern}`);
      console.log(`   Phase: ${result.skin.phase}`);
      
      resultEmbed.addFields(
        { 
          name: '🎨 Skin', 
          value: `**${skinName}**`, 
          inline: false 
        },
        { 
          name: '⭐ Rarity', 
          value: `${rarityEmoji} **${result.skin.rarity || 'Unknown'}**`, 
          inline: true 
        },
        { 
          name: '🔍 Wear', 
          value: `${wearEmoji} **${result.skin.wear || 'Unknown'}**`, 
          inline: true 
        },
        { 
          name: '💰 Market Value', 
          value: `**${result.skin.marketValue || 0}** points`, 
          inline: true 
        }
      );

      // Add float, pattern, and phase information if available
      if (result.skin.float !== undefined && result.skin.float !== null) {
        resultEmbed.addFields({
          name: '📊 Float',
          value: `**${result.skin.float.toFixed(6)}**`,
          inline: true
        });
      }

      if (result.skin.pattern && result.skin.pattern.trim() !== '') {
        resultEmbed.addFields({
          name: '🎭 Pattern',
          value: `**${result.skin.pattern}**`,
          inline: true
        });
      }

      if (result.skin.phase && result.skin.phase.trim() !== '') {
        resultEmbed.addFields({
          name: '🌈 Phase',
          value: `**${result.skin.phase}**`,
          inline: true
        });
      }

      // Add special properties if applicable
      if (result.skin.isStatTrak === true) {
        resultEmbed.addFields({
          name: '📊 StatTrak',
          value: '✅ This skin has StatTrak!',
          inline: true
        });
      }

      if (result.skin.isSouvenir === true) {
        resultEmbed.addFields({
          name: '🏆 Souvenir',
          value: '✅ This is a Souvenir skin!',
          inline: true
        });
      }

      // Add profit/loss information
      const profit = result.profit || 0;
      const profitEmoji = profit > 0 ? '🟢' : profit < 0 ? '🔴' : '⚪';
      const profitText = profit > 0 ? `+${profit}` : profit.toString();
      
      resultEmbed.addFields({
        name: '💵 Profit/Loss',
        value: `${profitEmoji} **${profitText}** points`,
        inline: false
      });

      // Add footer with user info
      resultEmbed.setFooter({ 
        text: `Opened by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      });

      // Add timestamp to show when this case was opened
      resultEmbed.setTimestamp();

      // Create action buttons
      const actionRow = new ActionRowBuilder()
        .addComponents(
          // new ButtonBuilder()
          //   .setCustomId(`cs2_inventory_${userId}`)
          //   .setLabel('View Inventory')
          //   .setStyle(ButtonStyle.Primary)
          //   .setEmoji('🎒'),
          // new ButtonBuilder()
          //   .setCustomId(`cs2_stats_${userId}`)
          //   .setLabel('View Stats')
          //   .setStyle(ButtonStyle.Secondary)
          //   .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId(`cs2_open_another_case_${caseId}`)
            .setLabel('Open Another')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎯')
        );

      // Update the message with the result and add real ping in content
      if (openingMessage) {
        try {
          await openingMessage.edit({
            content: `<@${interaction.user.id}>`,
            embeds: [resultEmbed],
            components: [actionRow]
          });
        } catch (editError) {
          console.error('Failed to edit opening message:', editError);
          // Fallback: try to send a new message instead
          try {
            await interaction.followUp({
              content: `<@${interaction.user.id}>`,
              embeds: [resultEmbed],
              components: [actionRow]
            });
          } catch (followUpError) {
            console.error('Failed to send follow-up message:', followUpError);
            // Last resort: just edit the original interaction
            await interaction.editReply({
              content: `<@${interaction.user.id}>`,
              embeds: [resultEmbed],
              components: [actionRow]
            });
          }
        }
      } else {
        // If we don't have an opening message, just edit the original interaction
        await interaction.editReply({
          content: `<@${interaction.user.id}>`,
          embeds: [resultEmbed],
          components: [actionRow]
        });
      }

      // Buttons are now handled globally in index.js
      // No need for local collector

    } catch (error) {
      console.error('Error opening CS2 case:', error);
      
      let errorMessage = '❌ **Failed to open case.** Please try again later.';
      if (error.response?.status === 400) {
        errorMessage = `❌ **Error:** ${error.response.data.error}`;
      } else if (error.response?.status === 404) {
        errorMessage = `❌ **Case not found!** The specified case could not be found.`;
      } else if (error.response?.status === 500) {
        errorMessage = `❌ **Server error.** Please try again later.`;
      }
      
      await interaction.editReply(errorMessage);
    }
  },

  getRarityColor(rarity) {
    const colors = {
      'consumer grade': 0xCCCCCC, // White
      'industrial grade': 0x5E98D9, // Light Blue
      'mil-spec': 0x4B69FF, // Blue
      'restricted': 0x8847FF, // Purple
      'classified': 0xD32CE6, // Pink
      'covert': 0xEB4B4B, // Red
      'special': 0xFFD700 // Gold
    };
    return colors[rarity] || 0xCCCCCC;
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

  async showInventory(interaction, userId, guildId, backendUrl) {
    try {
      // Defer the interaction if it hasn't been handled yet
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: false });
      }

      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      
      const embed = new EmbedBuilder()
        .setTitle('🎒 CS2 Inventory')
        .setDescription(`**${inventory.totalSkins}** skins • **${inventory.casesOpened}** cases opened`)
        .setColor(0x00ff00);

      // Add rarity breakdown
      const rarityBreakdown = Object.entries(inventory.rarityBreakdown)
        .filter(([_, count]) => count > 0)
        .map(([rarity, count]) => {
          const rarityEmoji = this.getRarityEmoji(rarity.replace(/([A-Z])/g, ' $1').toLowerCase());
          return `${rarityEmoji} **${rarity.replace(/([A-Z])/g, ' $1')}**: ${count}`;
        })
        .join('\n');

      if (rarityBreakdown) {
        embed.addFields({
          name: '🎨 Rarity Breakdown',
          value: rarityBreakdown,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error loading inventory:', error);
      let errorMessage = '❌ Failed to load inventory.';
      if (error.response?.status === 404) {
                  errorMessage = `❌ **No inventory found!** <@${interaction.user.id}>, you need to open some cases first.`;
      } else if (error.response?.status === 500) {
        errorMessage = '❌ **Server error.** Please try again later.';
      }
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    }
  },

  async showStats(interaction, userId, guildId, backendUrl) {
    try {
      // Defer the interaction if it hasn't been handled yet
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: false });
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
          { name: '💰 Total Spent', value: `${stats.totalSpent} points`, inline: true },
          { name: '💎 Total Value', value: `${stats.totalValue} points`, inline: true },
          { name: '💵 Total Profit', value: `${stats.totalProfit} points`, inline: true },
          { name: '📈 Profit Margin', value: `${stats.profitMargin.toFixed(2)}%`, inline: true },
          { name: '🎯 Profitable Opens', value: `${stats.profitableOpenings}/${stats.totalOpenings}`, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error loading stats:', error);
      let errorMessage = '❌ Failed to load stats.';
      if (error.response?.status === 404) {
                  errorMessage = `❌ **No stats found!** <@${interaction.user.id}>, you need to open some cases first.`;
      } else if (error.response?.status === 500) {
        errorMessage = '❌ **Server error.** Please try again later.';
      }
      await interaction.editReply({ content: errorMessage, ephemeral: true });
    }
  },

  async openAnotherCase(interaction, caseId, userId, guildId, backendUrl) {
    try {
      // Get case details first
      let caseData;
      try {
        const caseResponse = await axios.get(`${backendUrl}/cs2/cases/${caseId}`);
        caseData = caseResponse.data.case;
        
        if (!caseData) {
          await interaction.editReply({ 
            content: '❌ **Case not found!** The specified case could not be found.',
            ephemeral: true 
          });
          return;
        }
        
        if (!caseData.price || caseData.price <= 0) {
          await interaction.editReply({ 
            content: '❌ **Invalid case!** This case has no price set.',
            ephemeral: true 
          });
          return;
        }
      } catch (error) {
        if (error.response?.status === 404) {
          await interaction.editReply({ 
            content: '❌ **Case not found!** The specified case could not be found.',
            ephemeral: true 
          });
          return;
        }
        console.error('Error fetching case data:', error);
        await interaction.editReply({ 
          content: '❌ **Error fetching case data.** Please try again later.',
          ephemeral: true 
        });
        return;
      }

      // Check balance again
      let balance;
      try {
        const walletResponse = await axios.get(`${backendUrl}/users/${userId}/wallet`, {
          headers: { 'x-guild-id': guildId }
        });
        balance = walletResponse.data.balance;
      } catch (error) {
        if (error.response?.status === 404) {
          await interaction.editReply({ 
            content: `❌ **No wallet found!** <@${interaction.user.id}>, you need to have a wallet to open cases.`,
            ephemeral: true 
          });
          return;
        }
        console.error('Error fetching wallet:', error);
        await interaction.editReply({ 
          content: '❌ **Error fetching wallet.** Please try again later.',
          ephemeral: true 
        });
        return;
      }

      if (balance < caseData.price) {
        await interaction.editReply({ 
          content: `❌ **Insufficient funds!** <@${interaction.user.id}>, you need **${caseData.price}** points to open another case.\nYour balance: **${balance}** points`,
          ephemeral: true 
        });
        return;
      }
      
      if (balance < 0) {
        await interaction.editReply({ 
          content: '❌ **Invalid balance!** Your wallet has a negative balance. Please contact an administrator.',
          ephemeral: true 
        });
        return;
      }

      // Defer the reply to give us time to open the case
      await interaction.deferUpdate();

      // Open the case
      let openResponse;
      try {
        openResponse = await axios.post(`${backendUrl}/cs2/cases/${caseId}/open`, { userId: userId }, {
          headers: { 'x-guild-id': guildId }
        });
      } catch (error) {
        if (error.response?.status === 400) {
          await interaction.followUp({ 
            content: `❌ **Error opening case:** ${error.response.data.error || 'Unknown error'}`,
            ephemeral: true 
          });
          return;
        } else if (error.response?.status === 500) {
          await interaction.followUp({ 
            content: `❌ **Server error.** Please try again later.`,
            ephemeral: true 
          });
          return;
        }
        console.error('Error opening case:', error);
        await interaction.followUp({ 
          content: `❌ **Failed to open case.** Please try again later.`,
          ephemeral: true 
        });
        return;
      }

      const { result } = openResponse.data;
      
      if (!result || !result.skin) {
        await interaction.followUp({ 
          content: `❌ **Invalid response from server.** Please try again later.`,
          ephemeral: true 
        });
        return;
      }

      // Create result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle('🎉 Another Case Opened!')
        .setDescription(`You opened **${caseData.formattedName}** again and got:`)
        .setColor(this.getRarityColor(result.skin.rarity))
        .setTimestamp(); // Add timestamp to show this is the most recent

      // Set large skin image
      if (result.skin.imageUrl) {
        resultEmbed.setImage(result.skin.imageUrl);
      }

      // Add skin details
      const skinName = result.skin.name || 'Unknown Skin';
      const rarityEmoji = this.getRarityEmoji(result.skin.rarity || 'consumer grade');
      const wearEmoji = this.getWearEmoji(result.skin.wear || 'field-tested');
      
      resultEmbed.addFields(
        { 
          name: '🎨 Skin', 
          value: `${rarityEmoji} **${skinName}**`, 
          inline: false 
        },
        { 
          name: '⭐ Rarity', 
          value: `${rarityEmoji} **${result.skin.rarity || 'Unknown'}**`, 
          inline: true 
        },
        { 
          name: '🔍 Wear', 
          value: `${wearEmoji} **${result.skin.wear || 'Unknown'}**`, 
          inline: true 
        },
        { 
          name: '💰 Market Value', 
          value: `**${result.skin.marketValue || 0}** points`, 
          inline: true 
        }
      );

      // Add float, pattern, and phase information if available
      if (result.skin.float !== undefined && result.skin.float !== null) {
        resultEmbed.addFields({
          name: '📊 Float',
          value: `**${result.skin.float.toFixed(6)}**`,
          inline: true
        });
      }

      if (result.skin.pattern && result.skin.pattern.trim() !== '') {
        resultEmbed.addFields({
          name: '🎭 Pattern',
          value: `**${result.skin.pattern}**`,
          inline: true
        });
      }

      if (result.skin.phase && result.skin.phase.trim() !== '') {
        resultEmbed.addFields({
          name: '🌈 Phase',
          value: `**${result.skin.phase}**`,
          inline: true
        });
      }

      // Add special properties if applicable
      if (result.skin.isStatTrak === true) {
        resultEmbed.addFields({
          name: '📊 StatTrak',
          value: '✅ This skin has StatTrak!',
          inline: true
        });
      }

      if (result.skin.isSouvenir === true) {
        resultEmbed.addFields({
          name: '🏆 Souvenir',
          value: '✅ This is a Souvenir skin!',
          inline: true
        });
      }

      // Add profit/loss information
      const profit = result.profit || 0;
      const profitEmoji = profit > 0 ? '🟢' : profit < 0 ? '🔴' : '⚪';
      const profitText = profit > 0 ? `+${profit}` : profit.toString();
      
      resultEmbed.addFields({
        name: '💵 Profit/Loss',
        value: `${profitEmoji} **${profitText}** points`,
        inline: false
      });

      // Add footer with user info
      resultEmbed.setFooter({ 
        text: `Opened by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      });

      // Create action buttons for the new result
      const actionRow = new ActionRowBuilder()
        .addComponents(
          // new ButtonBuilder()
          //   .setCustomId(`cs2_inventory_${userId}`)
          //   .setLabel('View Inventory')
          //   .setStyle(ButtonStyle.Secondary)
          //   .setEmoji('🎒'),
          // new ButtonBuilder()
          //   .setCustomId(`cs2_stats_${userId}`)
          //   .setLabel('View Stats')
          //   .setStyle(ButtonStyle.Secondary)
          //   .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId(`cs2_open_another_case_${caseId}`)
            .setLabel('Open Another')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎯')
        );

      // Note: We don't disable buttons on the previous message as it may not be accessible
      // The "Open Another" button creates a new private message each time

      // Send a new private message with the result
      await interaction.followUp({
        content: `<@${interaction.user.id}>`,
        embeds: [resultEmbed],
        components: [actionRow],
        ephemeral: true
      });

      // Buttons are now handled globally in index.js
      // No need for local collector

    } catch (error) {
      console.error('Error in openAnotherCase:', error);
      await interaction.followUp({ 
        content: '❌ **Error opening another case.** Please try again later.',
        ephemeral: true 
      });
    }
  }
};
