const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jailed')
    .setDescription('View all currently jailed users in this server'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;
      const response = await axios.get(`${backendUrl}/users/jailed-users`, {
        headers: { 'x-guild-id': guildId }
      });
      let jailedUsers = response.data.jailedUsers || [];
      if (jailedUsers.length === 0) {
        const embed = {
          color: 0xffbe76,
          title: '🚔 Jailed Users',
          description: 'No users are currently jailed in this server.',
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      // Sort by remaining jail time (soonest release first)
      jailedUsers = jailedUsers.sort((a, b) => new Date(a.jailedUntil) - new Date(b.jailedUntil));
      // Fetch Discord user objects for better display
      const fields = await Promise.all(jailedUsers.map(async u => {
        let displayName = u.username;
        try {
          const userObj = await interaction.client.users.fetch(u.discordId);
          displayName = `${userObj.tag}`;
        } catch (e) {
          // fallback to backend username
        }
        const timeLeft = Math.max(0, new Date(u.jailedUntil) - new Date());
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        return {
          name: `${displayName}`,
          value: `Jailed for another ${minutes}m ${seconds}s (until <t:${Math.floor(new Date(u.jailedUntil).getTime()/1000)}:R>)`,
          inline: false
        };
      }));
      const embed = {
        color: 0xff7675,
        title: '🚔 Jailed Users',
        description: `These users are currently jailed in this server:`,
        fields,
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      await interaction.editReply('Failed to fetch jailed users.');
      return;
    }
  }
}; 