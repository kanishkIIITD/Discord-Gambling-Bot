const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auracheck')
    .setDescription('Check aura for a user (defaults to yourself)')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('User to check')
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    const backendUrl = process.env.BACKEND_API_URL;
    try {
      const res = await axios.get(`${backendUrl}/users/${target.id}/aura`, { headers: { 'x-guild-id': interaction.guildId } });
      const aura = res.data?.aura ?? 0;
      const embed = new EmbedBuilder()
        .setTitle('✨ Aura Check')
        .setDescription(`<@${target.id}> has **${aura}** aura.`)
        .setColor(aura > 0 ? 0x00d084 : aura < 0 ? 0xe74c3c : 0x95a5a6);
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to fetch aura.';
      await interaction.editReply({ content: `❌ ${msg}` });
    }
  }
};


