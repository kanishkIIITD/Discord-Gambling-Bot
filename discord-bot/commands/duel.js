const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Challenge another user to a duel for points!')
    .addSubcommand(sub =>
      sub.setName('challenge')
        .setDescription('Challenge a user to a duel!')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to duel')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Amount to stake in the duel')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('accept')
        .setDescription('Accept a pending duel')
        .addStringOption(option =>
          option.setName('duel_id')
            .setDescription('The ID of the duel to accept')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('decline')
        .setDescription('Decline a pending duel')
        .addStringOption(option =>
          option.setName('duel_id')
            .setDescription('The ID of the duel to decline')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View your duel win/loss record')
    ),

  async autocomplete(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'accept' || sub === 'decline') {
      const userId = interaction.user.id;
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;
      try {
        // Fetch pending duels where user is opponent
        const res = await axios.get(`${backendUrl}/users/${userId}/pending-duels`, { params: { guildId }, headers: { 'x-guild-id': guildId } });
        const duels = res.data.duels || [];
        await interaction.respond(
          duels.slice(0, 25).map(duel => ({
            name: `From <@${duel.challengerDiscordId}> for ${duel.amount} points (ID: ${duel._id})`,
            value: duel._id
          }))
        );
      } catch (err) {
        await interaction.respond([]);
      }
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const backendUrl = process.env.BACKEND_API_URL;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    if (sub === 'challenge') {
      try {
        await interaction.deferReply();
        const opponent = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        if (opponent.bot) {
          await ResponseHandler.handleError(interaction, { message: 'You cannot duel a bot.' }, 'Duel');
          return;
        }
        // Initiate duel in backend
        const duelRes = await axios.post(`${backendUrl}/users/${userId}/duel`, { opponentDiscordId: opponent.id, amount, guildId }, { headers: { 'x-guild-id': guildId } });
        const { duelId } = duelRes.data;
        const embed = {
          color: 0xe17055,
          title: '⚔️ Duel Challenge!',
          description: `<@${userId}> has challenged <@${opponent.id}> to a duel for **${amount.toLocaleString('en-US')} points**!\n\n<@${opponent.id}>, use \`/duel accept duel_id:${duelId}\` to accept or \`/duel decline duel_id:${duelId}\` to decline.`,
          timestamp: new Date(),
          footer: { text: `Duel ID: ${duelId}` }
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      } catch (error) {
        logger.error('Error in /duel challenge:', error);
        if (error.response && error.response.data && error.response.data.message) {
          await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Duel');
          return;
        } else {
          await ResponseHandler.handleError(interaction, error, 'Duel');
          return;
        }
      }
    } else if (sub === 'accept' || sub === 'decline') {
      try {
        await interaction.deferReply();
        const duelId = interaction.options.getString('duel_id');
        const accept = sub === 'accept';
        // Respond to duel
        const response = await axios.post(`${backendUrl}/users/${userId}/duel/respond`, { duelId, accept, guildId }, { headers: { 'x-guild-id': guildId } });
        if (accept) {
          const { winner, loser, actionText } = response.data;
          const winnerMention = `<@${winner}>`;
          const loserMention = `<@${loser}>`;
          const resultEmbed = {
            color: 0x00b894,
            title: '⚔️ Duel Result',
            description: `${winnerMention} ${actionText}\n\n**Winner:** ${winnerMention}\n**Loser:** ${loserMention}`,
            timestamp: new Date(),
            footer: { text: `Duel ID: ${duelId}` }
          };
          await interaction.editReply({ embeds: [resultEmbed] });
          return;
        } else {
          const resultEmbed = {
            color: 0xff7675,
            title: 'Duel Declined',
            description: `You declined the duel. Stakes refunded.`,
            timestamp: new Date(),
            footer: { text: `Duel ID: ${duelId}` }
          };
          await interaction.editReply({ embeds: [resultEmbed] });
          return;
        }
      } catch (error) {
        logger.error('Error in /duel accept/decline:', error);
        if (error.response && error.response.data && error.response.data.message) {
          await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Duel');
          return;
        } else {
          await ResponseHandler.handleError(interaction, error, 'Duel');
          return;
        }
      }
    } else if (sub === 'stats') {
      try {
        await interaction.deferReply();
        const statsRes = await axios.get(`${backendUrl}/users/${userId}/duel-stats`, { params: { guildId }, headers: { 'x-guild-id': guildId } });
        const { wins, losses } = statsRes.data;
        const embed = {
          color: 0x8e44ad,
          title: '⚔️ Duel Stats',
          fields: [
            { name: 'Wins', value: wins.toString(), inline: true },
            { name: 'Losses', value: losses.toString(), inline: true }
          ],
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      } catch (error) {
        logger.error('Error in /duel stats:', error);
        await ResponseHandler.handleError(interaction, error, 'Duel Stats');
        return;
      }
    }
  },
}; 