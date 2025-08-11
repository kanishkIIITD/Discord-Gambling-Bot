const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

      // Create button collector
      const collector = message.createMessageComponentCollector({
        filter: i => i.customId.startsWith('cs2_'),
        time: 300000 // 5 minutes
      });

      collector.on('collect', async i => {
        const customId = i.customId;
        
        if (customId.startsWith('cs2_view_skins_')) {
          await this.showSkins(i, userId, guildId, backendUrl);
        } else if (customId.startsWith('cs2_stats_')) {
          await this.showStats(i, userId, guildId, backendUrl);
        } else if (customId.startsWith('cs2_best_drops_')) {
          await this.showBestDrops(i, userId, guildId, backendUrl);
        } else if (customId.startsWith('cs2_rarest_drops_')) {
          await this.showRarestDrops(i, userId, guildId, backendUrl);
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

  async showSkins(interaction, userId, guildId, backendUrl) {
    try {
      const response = await axios.get(`${backendUrl}/cs2/inventory/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { inventory } = response.data;
      const skins = inventory.skins;
      
      if (skins.length === 0) {
        await interaction.reply({ content: 'No skins found in inventory.', ephemeral: true });
        return;
      }

      // Show first 10 skins
      const displaySkins = skins.slice(0, 10);
      const embed = new EmbedBuilder()
        .setTitle('🎨 CS2 Skins')
        .setDescription(`Showing ${displaySkins.length} of ${skins.length} skins`)
        .setColor(0x00ff00);

      displaySkins.forEach((skin, index) => {
        const rarityEmoji = this.getRarityEmoji(skin.rarity);
        const wearEmoji = this.getWearEmoji(skin.wear);
        const statTrakIcon = skin.isStatTrak ? '📊' : '';
        const souvenirIcon = skin.isSouvenir ? '🏆' : '';
        
        embed.addFields({
          name: `${index + 1}. ${skin.weapon} | ${skin.skinName}`,
          value: `${rarityEmoji} **${skin.rarity}** • ${wearEmoji} **${skin.wear}** • 💰 **${skin.marketValue}** currency ${statTrakIcon}${souvenirIcon}`,
          inline: false
        });
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to load skins.', ephemeral: true });
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

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Failed to load stats.', ephemeral: true });
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
