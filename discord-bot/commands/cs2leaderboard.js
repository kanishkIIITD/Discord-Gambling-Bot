const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cs2leaderboard')
    .setDescription('View the CS2 case opening leaderboard!')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of players to show (default: 10, max: 25)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const guildId = interaction.guildId;
    const limit = interaction.options.getInteger('limit') || 10;
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      // Get CS2 leaderboard
      const response = await axios.get(`${backendUrl}/cs2/leaderboard?limit=${limit}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { leaderboard } = response.data;
      
      if (!leaderboard || leaderboard.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle('🏆 CS2 Leaderboard')
          .setDescription('No case openings have been recorded yet!')
          .setColor(0x808080)
          .setFooter({ text: 'Start opening cases to appear on the leaderboard!' });

        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      // Create main leaderboard embed
      const mainEmbed = new EmbedBuilder()
        .setTitle('🏆 CS2 Case Opening Leaderboard')
        .setDescription(`Top ${leaderboard.length} players by total profit`)
        .setColor(0xffd700)
        .setThumbnail('https://cdn.discordapp.com/emojis/1234567890.png') // Trophy emoji
        .setFooter({ text: `Updated • ${new Date().toLocaleDateString()}` });

      // Add leaderboard entries
      leaderboard.forEach((entry, index) => {
        const rank = index + 1;
        const rankEmoji = this.getRankEmoji(rank);
        const profitEmoji = entry.totalProfit > 0 ? '🟢' : entry.totalProfit < 0 ? '🔴' : '⚪';
        
        // Try to get user info from the guild
        const member = interaction.guild.members.cache.get(entry._id);
        const username = member ? member.user.username : `User ${entry._id}`;
        
        const embedValue = [
          `💰 **Total Profit**: ${profitEmoji} ${entry.totalProfit > 0 ? '+' : ''}${entry.totalProfit} currency`,
          `📦 **Cases Opened**: ${entry.totalOpenings}`,
          `💎 **Total Value**: ${entry.totalValue} currency`,
          `📈 **Profit Margin**: ${entry.profitMargin.toFixed(2)}%`
        ].join('\n');

        mainEmbed.addFields({
          name: `${rankEmoji} ${rank}. ${username}`,
          value: embedValue,
          inline: false
        });
      });

      // Create navigation buttons
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`cs2_leaderboard_profit`)
            .setLabel('Sort by Profit')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💰'),
          new ButtonBuilder()
            .setCustomId(`cs2_leaderboard_openings`)
            .setLabel('Sort by Openings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📦'),
          new ButtonBuilder()
            .setCustomId(`cs2_leaderboard_margin`)
            .setLabel('Sort by Margin')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📈'),
          new ButtonBuilder()
            .setCustomId(`cs2_leaderboard_refresh`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')
        );

      const message = await interaction.editReply({
        embeds: [mainEmbed],
        components: [buttonRow]
      });

      // Create button collector
      const collector = message.createMessageComponentCollector({
        filter: i => i.customId.startsWith('cs2_leaderboard_'),
        time: 300000 // 5 minutes
      });

      collector.on('collect', async i => {
        const sortType = i.customId.replace('cs2_leaderboard_', '');
        
        if (sortType === 'refresh') {
          await this.refreshLeaderboard(i, guildId, limit, backendUrl);
        } else {
          await this.sortLeaderboard(i, guildId, limit, sortType, backendUrl);
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
      console.error('Error fetching CS2 leaderboard:', error);
      await interaction.editReply('❌ **Failed to load leaderboard.** Please try again later.');
    }
  },

  getRankEmoji(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    if (rank <= 10) return '🏅';
    return '🎖️';
  },

  async refreshLeaderboard(interaction, guildId, limit, backendUrl) {
    try {
      await interaction.deferUpdate();
      
      // Fetch fresh data
      const response = await axios.get(`${backendUrl}/cs2/leaderboard?limit=${limit}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { leaderboard } = response.data;
      
      if (!leaderboard || leaderboard.length === 0) {
        await interaction.followUp({ content: 'No case openings found.', ephemeral: true });
        return;
      }

      // Create refreshed embed
      const embed = new EmbedBuilder()
        .setTitle('🏆 CS2 Case Opening Leaderboard (Refreshed)')
        .setDescription(`Top ${leaderboard.length} players by total profit`)
        .setColor(0xffd700)
        .setFooter({ text: `Refreshed • ${new Date().toLocaleDateString()}` });

      leaderboard.forEach((entry, index) => {
        const rank = index + 1;
        const rankEmoji = this.getRankEmoji(rank);
        const profitEmoji = entry.totalProfit > 0 ? '🟢' : entry.totalProfit < 0 ? '🔴' : '⚪';
        
        const member = interaction.guild.members.cache.get(entry._id);
        const username = member ? member.user.username : `User ${entry._id}`;
        
        const embedValue = [
          `💰 **Total Profit**: ${profitEmoji} ${entry.totalProfit > 0 ? '+' : ''}${entry.totalProfit} currency`,
          `📦 **Cases Opened**: ${entry.totalOpenings}`,
          `💎 **Total Value**: ${entry.totalValue} currency`,
          `📈 **Profit Margin**: ${entry.profitMargin.toFixed(2)}%`
        ].join('\n');

        embed.addFields({
          name: `${rankEmoji} ${rank}. ${username}`,
          value: embedValue,
          inline: false
        });
      });

      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.followUp({ content: '❌ Failed to refresh leaderboard.', ephemeral: true });
    }
  },

  async sortLeaderboard(interaction, guildId, limit, sortType, backendUrl) {
    try {
      await interaction.deferUpdate();
      
      // Fetch fresh data
      const response = await axios.get(`${backendUrl}/cs2/leaderboard?limit=${limit}`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const { leaderboard } = response.data;
      
      if (!leaderboard || leaderboard.length === 0) {
        await interaction.followUp({ content: 'No case openings found.', ephemeral: true });
        return;
      }

      // Sort based on sort type
      let sortedLeaderboard = [...leaderboard];
      let sortTitle, sortDescription;

      switch (sortType) {
        case 'profit':
          sortedLeaderboard.sort((a, b) => b.totalProfit - a.totalProfit);
          sortTitle = 'by Total Profit';
          sortDescription = `Top ${limit} players by total profit`;
          break;
        case 'openings':
          sortedLeaderboard.sort((a, b) => b.totalOpenings - a.totalOpenings);
          sortTitle = 'by Cases Opened';
          sortDescription = `Top ${limit} players by cases opened`;
          break;
        case 'margin':
          sortedLeaderboard.sort((a, b) => b.profitMargin - a.profitMargin);
          sortTitle = 'by Profit Margin';
          sortDescription = `Top ${limit} players by profit margin`;
          break;
        default:
          sortedLeaderboard.sort((a, b) => b.totalProfit - a.totalProfit);
          sortTitle = 'by Total Profit';
          sortDescription = `Top ${limit} players by total profit`;
      }

      // Create sorted embed
      const embed = new EmbedBuilder()
        .setTitle(`🏆 CS2 Leaderboard - Sorted ${sortTitle}`)
        .setDescription(sortDescription)
        .setColor(0xffd700)
        .setFooter({ text: `Sorted • ${new Date().toLocaleDateString()}` });

      sortedLeaderboard.forEach((entry, index) => {
        const rank = index + 1;
        const rankEmoji = this.getRankEmoji(rank);
        const profitEmoji = entry.totalProfit > 0 ? '🟢' : entry.totalProfit < 0 ? '🔴' : '⚪';
        
        const member = interaction.guild.members.cache.get(entry._id);
        const username = member ? member.user.username : `User ${entry._id}`;
        
        let embedValue;
        switch (sortType) {
          case 'profit':
            embedValue = [
              `💰 **Total Profit**: ${profitEmoji} ${entry.totalProfit > 0 ? '+' : ''}${entry.totalProfit} currency`,
              `📦 **Cases Opened**: ${entry.totalOpenings}`,
              `💎 **Total Value**: ${entry.totalValue} currency`,
              `📈 **Profit Margin**: ${entry.profitMargin.toFixed(2)}%`
            ].join('\n');
            break;
          case 'openings':
            embedValue = [
              `📦 **Cases Opened**: ${entry.totalOpenings}`,
              `💰 **Total Profit**: ${profitEmoji} ${entry.totalProfit > 0 ? '+' : ''}${entry.totalProfit} currency`,
              `💎 **Total Value**: ${entry.totalValue} currency`,
              `📈 **Profit Margin**: ${entry.profitMargin.toFixed(2)}%`
            ].join('\n');
            break;
          case 'margin':
            embedValue = [
              `📈 **Profit Margin**: ${entry.profitMargin.toFixed(2)}%`,
              `💰 **Total Profit**: ${profitEmoji} ${entry.totalProfit > 0 ? '+' : ''}${entry.totalProfit} currency`,
              `📦 **Cases Opened**: ${entry.totalOpenings}`,
              `💎 **Total Value**: ${entry.totalValue} currency`
            ].join('\n');
            break;
          default:
            embedValue = [
              `💰 **Total Profit**: ${profitEmoji} ${entry.totalProfit > 0 ? '+' : ''}${entry.totalProfit} currency`,
              `📦 **Cases Opened**: ${entry.totalOpenings}`,
              `💎 **Total Value**: ${entry.totalValue} currency`,
              `📈 **Profit Margin**: ${entry.profitMargin.toFixed(2)}%`
            ].join('\n');
        }

        embed.addFields({
          name: `${rankEmoji} ${rank}. ${username}`,
          value: embedValue,
          inline: false
        });
      });

      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.followUp({ content: '❌ Failed to sort leaderboard.', ephemeral: true });
    }
  }
};
