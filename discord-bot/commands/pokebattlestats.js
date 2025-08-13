const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokebattlestats')
    .setDescription('View Pokémon battle statistics for a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to view battle stats for (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      // The interaction is already deferred as PRIVATE by the main handler
      
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guildId;
      
      // Fetch battle statistics from backend
      const response = await axios.get(`${process.env.BACKEND_API_URL}/users/${targetUser.id}/battle-stats`, {
        headers: { 'x-guild-id': guildId }
      });
      
      const stats = response.data;
      
      // Create embed with battle statistics
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`⚔️ Pokémon Battle Statistics`)
        .setDescription(`Battle stats for **${targetUser.username}**`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: '📊 Overall Stats',
            value: `**Total Battles:** ${stats.totalBattles}\n` +
                   `**Wins:** ${stats.wins}\n` +
                   `**Losses:** ${stats.losses}\n` +
                   `**Win Rate:** ${stats.winRate}%\n` +
                   `**Current Streak:** ${stats.currentStreak}\n` +
                   `**Best Streak:** ${stats.bestStreak}`,
            inline: false
          },
          {
            name: '🏆 Battle Rewards',
            value: `**Total XP Earned:** ${stats.totalXpEarned.toLocaleString()}\n` +
                   `**Total Stardust Earned:** ${stats.totalStardustEarned.toLocaleString()}\n` +
                   `**Average XP per Battle:** ${stats.averageXpPerBattle.toLocaleString()}\n` +
                   `**Average Stardust per Battle:** ${stats.averageStardustPerBattle.toLocaleString()}`,
            inline: false
          },
          {
            name: '⚡ Battle Types',
            value: `**Friendly Battles:** ${stats.friendlyBattles}\n` +
                   `**Competitive Battles:** ${stats.competitiveBattles}\n` +
                   `**Friendly Win Rate:** ${stats.friendlyWinRate}%\n` +
                   `**Competitive Win Rate:** ${stats.competitiveWinRate}%`,
            inline: false
          }
        );

      // Add recent battles if available
      if (stats.recentBattles && stats.recentBattles.length > 0) {
        const recentBattlesText = stats.recentBattles.map(battle => {
          const result = battle.won ? '✅' : '❌';
          const opponent = battle.opponentUsername || 'Unknown';
          const date = new Date(battle.createdAt).toLocaleDateString();
          return `${result} vs **${opponent}** (${date})`;
        }).join('\n');
        
        embed.addFields({
          name: '🕒 Recent Battles',
          value: recentBattlesText,
          inline: false
        });
      }

      // Add favorite Pokémon if available
      if (stats.favoritePokemon && stats.favoritePokemon.length > 0) {
        const favoritePokemonText = stats.favoritePokemon.map(pokemon => {
          const shiny = pokemon.isShiny ? '✨' : '';
          return `${shiny}**${pokemon.name}** - Used ${pokemon.usageCount} times`;
        }).join('\n');
        
        embed.addFields({
          name: '⭐ Favorite Pokémon',
          value: favoritePokemonText,
          inline: false
        });
      }

      embed.setTimestamp();
      embed.setFooter({ text: `Requested by ${interaction.user.username}` });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in pokebattlestats command:', error);
      
      let errorMessage = '❌ Failed to fetch battle statistics.';
      if (error.response?.status === 404) {
        errorMessage = '❌ No battle data found for this user.';
      } else if (error.response?.data?.message) {
        errorMessage = `❌ ${error.response.data.message}`;
      }
      
      await interaction.editReply({ content: errorMessage });
    }
  }
}; 