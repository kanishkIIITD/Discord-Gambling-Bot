const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveawaypokemonleaderboard')
    .setDescription('View the Pokémon giveaway leaderboard')
    .addStringOption(option =>
      option.setName('sort')
        .setDescription('Sort by: won, hosted, entries (default: won)')
        .setRequired(false)
        .addChoices(
          { name: 'Wins', value: 'won' },
          { name: 'Hosted', value: 'hosted' },
          { name: 'Entries', value: 'entries' },
        )
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of users to show (5-25, default 10)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const guildId = interaction.guildId;
    const sortBy = interaction.options.getString('sort') || 'won';
    const limit = interaction.options.getInteger('limit') || 10;

    const backendUrl = process.env.BACKEND_API_URL;
    const metric = sortBy === 'hosted' ? 'hosted' : sortBy === 'entries' ? 'entries' : 'wins';
    const res = await axios.get(`${backendUrl}/users/leaderboard/giveaway?metric=${metric}&limit=${limit}`, { headers: { 'x-guild-id': guildId } });
    let top = (res.data && res.data.data) || [];
    // Filter out users with no recorded activity (wins, hosted, and entries all zero/null)
    top = top.filter(u => (u.pokeGiveawayWins || 0) + (u.pokeGiveawayHosted || 0) + (u.pokeGiveawayEntries || 0) > 0);

    if (!top || top.length === 0) {
      const empty = new EmbedBuilder()
        .setTitle('🎉 Pokémon Giveaway Leaderboard')
        .setDescription('No giveaway stats recorded yet!')
        .setColor(0x808080);
      return interaction.editReply({ embeds: [empty] });
    }

    const titleMap = { won: 'Wins', hosted: 'Hosted', entries: 'Entries' };
    const embed = new EmbedBuilder()
      .setTitle(`🎉 Pokémon Giveaway Leaderboard — ${titleMap[sortBy] || 'Wins'}`)
      .setColor(0xffd700)
      .setFooter({ text: `Sorted by ${titleMap[sortBy] || 'Wins'}` });

    for (let i = 0; i < top.length; i++) {
      const row = top[i];
      let username = row.username || `User ${row.discordId}`;
      try {
        const member = await interaction.guild.members.fetch(row.discordId).catch(() => null);
        if (member?.user?.username) username = member.user.username;
      } catch {}
      const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
      embed.addFields({
        name: `${rankEmoji} ${i + 1}. ${username}`,
        value: `🏆 Wins: ${row.pokeGiveawayWins || 0} • 🎁 Hosted: ${row.pokeGiveawayHosted || 0} • 🙋 Entries: ${row.pokeGiveawayEntries || 0}`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};


