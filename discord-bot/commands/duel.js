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
      sub.setName('stats')
        .setDescription('View your duel win/loss record')
    ),

  async autocomplete(interaction) {
    // Only needed for legacy, now no-op
    return;
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
        let duelRes;
        try {
          duelRes = await axios.post(
            `${backendUrl}/users/${userId}/duel`,
            { opponentDiscordId: opponent.id, amount, guildId },
            { headers: { 'x-guild-id': guildId } }
          );
        } catch (error) {
          // --- Always show a clear error message to the user ---
          const msg = error.response?.data?.message || error.message || 'An error occurred while creating the duel.';
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
          } else {
            await interaction.followUp({ content: `❌ ${msg}`, ephemeral: true });
          }
          return;
        }
        const duration = Date.now() - start;
  
        const { duelId } = duelRes.data;
  
        const embed = {
          color: 0xe17055,
          title: '⚔️ Duel Challenge!',
          description: `<@${userId}> has challenged <@${opponent.id}> to a duel for **${amount.toLocaleString('en-US')} points**!\n\n` +
            `**You must respond using the buttons below within 1 minute or the duel will be cancelled and stakes refunded.**`,
          timestamp: new Date(),
          footer: { text: `Duel ID: ${duelId}` }
        };
  
        const pingContent = `<@${userId}> <@${opponent.id}>`;

        // Add Accept/Decline buttons with opponentId in customId
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`duel_accept_${duelId}_${opponent.id}`)
            .setLabel('✅ Accept')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`duel_decline_${duelId}_${opponent.id}`)
            .setLabel('❌ Decline')
            .setStyle(ButtonStyle.Danger)
        );
  
        let sentMessage;
        if (duration < 2500) {
          sentMessage = await interaction.reply({
            content: pingContent,
            embeds: [embed],
            components: [row],
            allowedMentions: { users: [userId, opponent.id] }
          }).then(() => interaction.fetchReply());
        } else {
          await interaction.deferReply();
          sentMessage = await interaction.editReply({ embeds: [embed], components: [row] }).then(() => interaction.fetchReply());
          await interaction.followUp({
            content: pingContent,
            allowedMentions: { users: [userId, opponent.id] }
          });
        }

        // --- Auto-disable duel buttons after 1 minute ---
        if (!interaction.client.activeDuelMessages) interaction.client.activeDuelMessages = new Map();
        interaction.client.activeDuelMessages.set(duelId, { message: sentMessage, channelId: sentMessage.channelId, guildId });
        setTimeout(async () => {
          try {
            // console.log(`[DUEL TIMEOUT] Attempting to disable buttons for duelId: ${duelId}`);
            // --- Check if duel is still pending ---
            let duelStatus = null;
            try {
              const duelRes = await axios.get(`${backendUrl}/users/duel/${duelId}`, {
                headers: { 'x-guild-id': guildId }
              });
              duelStatus = duelRes.data.status;
            } catch (statusErr) {
              console.warn(`[DUEL TIMEOUT] Could not fetch duel status for duelId: ${duelId}:`, statusErr?.response?.data?.message || statusErr.message);
            }
            if (duelStatus !== 'pending') {
              // console.log(`[DUEL TIMEOUT] Duel ${duelId} is not pending (status: ${duelStatus}), skipping button disable.`);
              return;
            }
            // Disable buttons
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`duel_accept_${duelId}_${opponent.id}`)
                .setLabel('✅ Accept')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(`duel_decline_${duelId}_${opponent.id}`)
                .setLabel('❌ Decline')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
            );
            await sentMessage.edit({ components: [disabledRow], embeds: [
              { ...embed, color: 0x636e72, title: '⏰ Duel Expired', description: 'No response in time. Duel cancelled and stakes refunded.' }
            ] });
            // --- Call backend to refund stakes on expiry ---
            try {
              await axios.post(`${backendUrl}/users/${opponent.id}/duel/respond`, {
                duelId,
                accept: false,
                guildId
              }, {
                headers: { 'x-guild-id': guildId }
              });
            } catch (refundErr) {
              console.warn(`[DUEL TIMEOUT] Backend refund failed or duel already resolved for duelId: ${duelId}:`, refundErr?.response?.data?.message || refundErr.message);
            }
            // console.log(`[DUEL TIMEOUT] Disabled buttons for duelId: ${duelId}`);
          } catch (err) {
            console.warn(`[DUEL TIMEOUT] Failed to disable buttons for duelId: ${duelId}:`, err.message);
          }
        }, 60000);
      } catch (error) {
        // This catch is now only for unexpected errors
        logger.error('Error in /duel challenge:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ An unexpected error occurred while creating the duel.', ephemeral: true });
        } else {
          await interaction.followUp({ content: '❌ An unexpected error occurred while creating the duel.', ephemeral: true });
        }
      }
    } else if (sub === 'stats') {
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