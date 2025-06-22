const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('refund')
    .setDescription('Refund all bets for a specific bet (Creator/Admin/Superadmin only).')
    .addStringOption(option =>
      option.setName('bet_id')
        .setDescription('The ID of the bet to refund')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const userId = interaction.user.id;
    const backendUrl = process.env.BACKEND_API_URL;
    const guildId = interaction.guildId;
    try {
      // Fetch unresolved bets where user is creator or user is admin/superadmin
      const response = await axios.get(`${backendUrl}/bets/unresolved`, {
        params: { guildId },
        headers: { 'x-guild-id': guildId }
      });
      const bets = response.data;
      // Optionally filter bets by creator or admin role
      // For now, show all unresolved bets (permission checked on execute)
      await interaction.respond(
        bets.slice(0, 25).map(bet => ({
          name: `${bet.description} (${bet._id})`,
          value: bet._id
        }))
      );
    } catch (err) {
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const betId = interaction.options.getString('bet_id');
    const backendUrl = process.env.BACKEND_API_URL;
    const guildId = interaction.guildId;
    try {
      // Fetch bet details to check creator
      const betRes = await axios.get(`${backendUrl}/bets/${betId}`, {
        params: { guildId },
        headers: { 'x-guild-id': guildId }
      });
      const bet = betRes.data;
      // Fetch user role
      const userRes = await axios.get(`${backendUrl}/users/discord/${userId}`, {
        headers: { 'x-guild-id': guildId }
      });
      const userRole = userRes.data.role;
      const isCreator = bet.creator && bet.creator.discordId === userId;
      const isAdmin = userRole === 'admin' || userRole === 'superadmin';
      if (!isCreator && !isAdmin) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Permission Denied')
          .setDescription('Only the bet creator, an admin, or a superadmin can refund this bet.')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      // Call backend to process refund
      const refundRes = await axios.post(`${backendUrl}/bets/${betId}/refund`, {
        creatorDiscordId: userId,
        guildId
      }, {
        headers: { 'x-guild-id': guildId }
      });
      const { refundedCount } = refundRes.data;
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('💸 Bet Refunded')
        .setDescription(`All bets for **${bet.description}** have been refunded. (${refundedCount} refunds processed)`) 
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'An error occurred while processing the refund.';
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Refund Failed')
        .setDescription(msg)
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
  }
}; 