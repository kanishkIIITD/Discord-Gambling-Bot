const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2stats')
    .setDescription('View your CS2 case opening statistics and performance!')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User whose stats to view (leave empty for your own)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Get user's CS2 statistics
      const response = await axios.get(`${backendUrl}/cs2/stats/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { stats } = response.data;
      
      if (!stats || stats.totalOpenings === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle('📊 CS2 Statistics')
          .setDescription(`${targetUser.username} hasn't opened any CS2 cases yet!`)
          .setColor(0x808080)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: '📦 Cases Opened', value: '0', inline: true },
            { name: '💰 Total Spent', value: '0 currency', inline: true },
            { name: '💎 Total Value', value: '0 currency', inline: true },
            { name: '💵 Total Profit', value: '0 currency', inline: true },
            { name: '📈 Profit Margin', value: '0%', inline: true },
            { name: '🎯 Profitable Opens', value: '0/0', inline: true }
          );

        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      // Create main stats embed
      const mainEmbed = new EmbedBuilder()
        .setTitle(`📊 ${targetUser.username}'s CS2 Statistics`)
        .setDescription(`Comprehensive overview of case opening performance`)
        .setColor(0x00ff00)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: '📦 Cases Opened', value: stats.totalOpenings.toString(), inline: true },
          { name: '💰 Total Spent', value: `${stats.totalSpent} currency`, inline: true },
          { name: '💎 Total Value', value: `${stats.totalValue} currency`, inline: true },
          { name: '💵 Total Profit', value: `${stats.totalProfit} currency`, inline: true },
          { name: '📈 Profit Margin', value: `${stats.profitMargin.toFixed(2)}%`, inline: true },
          { name: '🎯 Profitable Opens', value: `${stats.profitableOpenings}/${stats.totalOpenings}`, inline: true }
        );

      // Add performance indicators
      const profitMargin = stats.profitMargin;
      let performanceEmoji, performanceText;
      
      if (profitMargin > 20) {
        performanceEmoji = '🟢';
        performanceText = 'Excellent';
      } else if (profitMargin > 0) {
        performanceEmoji = '🟡';
        performanceText = 'Good';
      } else if (profitMargin > -20) {
        performanceEmoji = '🟠';
        performanceText = 'Fair';
      } else {
        performanceEmoji = '🔴';
        performanceText = 'Poor';
      }

      mainEmbed.addFields({
        name: '📊 Performance Rating',
        value: `${performanceEmoji} **${performanceText}** (${profitMargin > 0 ? '+' : ''}${profitMargin.toFixed(2)}%)`,
        inline: false
      });

      // Add rarest drop info if available
      if (stats.rarestDrop) {
        const rarityNames = {
          1: 'Consumer Grade',
          2: 'Industrial Grade',
          3: 'Mil-Spec',
          4: 'Restricted',
          5: 'Classified',
          6: 'Covert',
          7: 'Special'
        };

        const rarityEmoji = {
          1: '⚪',
          2: '🔵',
          3: '🔷',
          4: '🟣',
          5: '🩷',
          6: '🔴',
          7: '🟡'
        };

        mainEmbed.addFields({
          name: '💎 Rarest Drop',
          value: `${rarityEmoji[stats.rarestDrop]} **${rarityNames[stats.rarestDrop]}**`,
          inline: true
        });
      }

      // Create navigation buttons
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_recent_openings_${userId}`)
            .setLabel('Recent Openings')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📅'),
          new ButtonBuilder()
            .setCustomId(`cs2_best_drops_${userId}`)
            .setLabel('Best Drops')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🏆'),
          new ButtonBuilder()
            .setCustomId(`cs2_rarest_drops_${userId}`)
            .setLabel('Rarest Drops')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('💎'),
          new ButtonBuilder()
            .setCustomId(`cs2_inventory_${userId}`)
            .setLabel('View Inventory')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎒')
        );

      const message = await interaction.editReply({
        embeds: [mainEmbed],
        components: [buttonRow]
      });

      // Create button collector
      const collector = message.createMessageComponentCollector({
        filter: i => i.customId.startsWith('cs2_'),
        time: 300000 // 5 minutes
      });

      collector.on('collect', async i => {
        const customId = i.customId;
        
        if (customId.startsWith('cs2_recent_openings_')) {
          await this.showRecentOpenings(i, userId, guildId, backendUrl);
        } else if (customId.startsWith('cs2_best_drops_')) {
          await this.showBestDrops(i, userId, guildId, backendUrl);
        } else if (customId.startsWith('cs2_rarest_drops_')) {
          await this.showRarestDrops(i, userId, guildId, backendUrl);
        } else if (customId.startsWith('cs2_inventory_')) {
          await this.showInventory(i, userId, guildId, backendUrl);
        }
      });

      collector.on('end', () => {
        // Disable all buttons after timeout
        buttonRow.components.forEach(btn => btn.setDisabled(true));
        
        interaction.editReply({
          embeds: [mainEmbed],
          components: [buttonRow]
        }).catch(console.error);
      });

    } catch (error) {
      console.error('Error fetching CS2 stats:', error);
      await interaction.editReply('❌ **Failed to load statistics.** Please try again later.');
    }
  },

  async showRecentOpenings(interaction, userId, guildId, backendUrl) {
    try {
      const response = await axios.get(`${backendUrl}/cs2/openings/${userId}?limit=10`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { openings } = response.data;
      
      if (openings.length === 0) {
        await interaction.reply({ content: 'No case openings found.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📅 Recent CS2 Openings')
        .setDescription(`Last ${openings.length} case openings`)
        .setColor(0x00ff00);

      openings.forEach((opening, index) => {
        const rarityEmoji = this.getRarityEmoji(opening.result.rarity);
        const profitEmoji = opening.profit > 0 ? '🟢' : opening.profit < 0 ? '🔴' : '⚪';
        const date = new Date(opening.openedAt).toLocaleDateString();
        
        embed.addFields({
          name: `${index + 1}. ${opening.result.name}`,
          value: `${rarityEmoji} **${opening.result.rarity}** • 💰 **${opening.result.marketValue}** currency • ${profitEmoji} **${opening.profit}** profit\n📦 ${opening.caseName} • 📅 ${date}`,
          inline: false
        });
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to load recent openings.', ephemeral: true });
    }
  },

  async showBestDrops(interaction, userId, guildId, backendUrl) {
    try {
      const response = await axios.get(`${backendUrl}/cs2/drops/${userId}/best`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { drops } = response.data;
      
      if (drops.length === 0) {
        await interaction.reply({ content: 'No case openings found.', ephemeral: true });
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

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to load best drops.', ephemeral: true });
    }
  },

  async showRarestDrops(interaction, userId, guildId, backendUrl) {
    try {
      const response = await axios.get(`${backendUrl}/cs2/drops/${userId}/rarest`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { drops } = response.data;
      
      if (drops.length === 0) {
        await interaction.reply({ content: 'No case openings found.', ephemeral: true });
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

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to load rarest drops.', ephemeral: true });
    }
  },

  async showInventory(interaction, userId, guildId, backendUrl) {
    try {
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
          const rarityName = rarity.replace(/([A-Z])/g, ' $1');
          return `${rarityEmoji} **${rarityName}**: ${count}`;
        })
        .join('\n');

      if (rarityBreakdown) {
        embed.addFields({
          name: '🎨 Rarity Breakdown',
          value: rarityBreakdown,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to load inventory.', ephemeral: true });
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
  }
};
