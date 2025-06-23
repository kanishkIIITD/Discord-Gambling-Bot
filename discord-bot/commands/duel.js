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
        const opponent = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
  
        if (opponent.bot) {
          await ResponseHandler.handleError(interaction, { message: 'You cannot duel a bot.' }, 'Duel');
          return;
        }
  
        const start = Date.now();
        const duelRes = await axios.post(
          `${backendUrl}/users/${userId}/duel`,
          { opponentDiscordId: opponent.id, amount, guildId },
          { headers: { 'x-guild-id': guildId } }
        );
        const duration = Date.now() - start;
  
        const { duelId } = duelRes.data;
  
        const embed = {
          color: 0xe17055,
          title: '⚔️ Duel Challenge!',
          description: `<@${userId}> has challenged <@${opponent.id}> to a duel for **${amount.toLocaleString('en-US')} points**!\n\n<@${opponent.id}>, use \`/duel accept duel_id:${duelId}\` to accept or \`/duel decline duel_id:${duelId}\` to decline.\n\n**You must accept within 1 minute or the duel will be cancelled and stakes refunded.**`,
          timestamp: new Date(),
          footer: { text: `Duel ID: ${duelId}` }
        };
  
        const pingContent = `<@${userId}> <@${opponent.id}>`;
  
        if (duration < 2500) {
          await interaction.reply({
            content: pingContent,
            embeds: [embed],
            allowedMentions: { users: [userId, opponent.id] }
          });
        } else {
          await interaction.deferReply();
          await interaction.editReply({ embeds: [embed] });
          await interaction.followUp({
            content: pingContent,
            allowedMentions: { users: [userId, opponent.id] }
          });
        }
      } catch (error) {
        logger.error('Error in /duel challenge:', error);
        await ResponseHandler.handleError(interaction, error.response?.data || error, 'Duel');
      }
    }
  
    else if (sub === 'accept' || sub === 'decline') {
      try {
        const duelId = interaction.options.getString('duel_id');
        const accept = sub === 'accept';
  
        const start = Date.now();
        const response = await axios.post(
          `${backendUrl}/users/${userId}/duel/respond`,
          { duelId, accept, guildId },
          { headers: { 'x-guild-id': guildId } }
        );
        const duration = Date.now() - start;
  
        let embed;
        let pingContent;
  
        if (accept) {
          const { winner, loser, actionText } = response.data;
          embed = {
            color: 0x00b894,
            title: '⚔️ Duel Result',
            description: `<@${winner}> ${actionText}\n\n**Winner:** <@${winner}>\n**Loser:** <@${loser}>`,
            timestamp: new Date(),
            footer: { text: `Duel ID: ${duelId}` }
          };
          pingContent = `<@${winner}> <@${loser}>`;
        } else {
          embed = {
            color: 0xff7675,
            title: '❌ Duel Declined',
            description: `You declined the duel. Stakes refunded.`,
            timestamp: new Date(),
            footer: { text: `Duel ID: ${duelId}` }
          };
        }
  
        if (duration < 2500) {
          await interaction.reply({
            content: pingContent || null,
            embeds: [embed],
            allowedMentions: pingContent ? { parse: ['users'] } : undefined
          });
        } else {
          await interaction.deferReply();
          await interaction.editReply({ embeds: [embed] });
          if (pingContent) {
            await interaction.followUp({
              content: pingContent,
              allowedMentions: { parse: ['users'] }
            });
          }
        }
  
      } catch (error) {
        logger.error('Error in /duel accept/decline:', error);
        await ResponseHandler.handleError(interaction, error.response?.data || error, 'Duel');
      }
    }
  
    else if (sub === 'stats') {
      try {
        const start = Date.now();
        const statsRes = await axios.get(`${backendUrl}/users/${userId}/duel-stats`, {
          params: { guildId },
          headers: { 'x-guild-id': guildId }
        });
  
        const duration = Date.now() - start;
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
  
        if (duration < 2500) {
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.deferReply();
          await interaction.editReply({ embeds: [embed] });
        }
  
      } catch (error) {
        logger.error('Error in /duel stats:', error);
        await ResponseHandler.handleError(interaction, error.response?.data || error, 'Duel Stats');
      }
    }
  }  
}; 