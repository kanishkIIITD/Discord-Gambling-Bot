const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auraleaderboard')
    .setDescription('View the aura leaderboard')
    .addStringOption(option =>
      option.setName('sort')
        .setDescription('Sort by positive (desc) or negative (asc) aura')
        .setRequired(false)
        .addChoices(
          { name: 'Positive first', value: 'desc' },
          { name: 'Negative first', value: 'asc' },
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
    const backendUrl = process.env.BACKEND_API_URL;
    const guildId = interaction.guildId;
    const limit = interaction.options.getInteger('limit') || 10;
    const sort = interaction.options.getString('sort') || 'desc';
    try {
      const res = await axios.get(`${backendUrl}/users/leaderboard/aura?limit=${limit}&order=${sort}`, { headers: { 'x-guild-id': guildId } });
      let data = (res.data && res.data.data) || [];
      // Exclude users with zero aura so inactive users don't appear
      data = data.filter(u => (u.aura || 0) !== 0);
      if (!data.length) {
        const empty = new EmbedBuilder().setTitle('✨ Aura Leaderboard').setDescription('No aura recorded yet!').setColor(0x808080);
        return interaction.editReply({ embeds: [empty] });
      }
      const title = sort === 'asc' ? '✨ Aura Leaderboard — Negative First' : '✨ Aura Leaderboard — Positive First';
      const embed = new EmbedBuilder().setTitle(title).setColor(0x00d084);
      for (let i = 0; i < data.length; i++) {
        const u = data[i];
        let username = u.username || `User ${u.discordId}`;
        try {
          const member = await interaction.guild.members.fetch(u.discordId).catch(() => null);
          if (member?.user?.username) username = member.user.username;
        } catch {}
        const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
        embed.addFields({ name: `${rankEmoji} ${i + 1}. ${username}`, value: `Aura: ${u.aura || 0}`, inline: false });
      }
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to fetch aura leaderboard.';
      await interaction.editReply({ content: `❌ ${msg}` });
    }
  }
};


