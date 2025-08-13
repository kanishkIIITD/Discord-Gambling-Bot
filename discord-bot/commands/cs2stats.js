const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
    // The interaction is already deferred as PUBLIC by the main handler
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

      // Send the message without buttons
      await interaction.editReply({
        embeds: [mainEmbed]
      });

    } catch (error) {
      console.error('Error fetching CS2 stats:', error);
      await interaction.editReply('❌ **Failed to load statistics.** Please try again later.');
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
