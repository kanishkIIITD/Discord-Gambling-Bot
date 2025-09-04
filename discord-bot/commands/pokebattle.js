const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const backendApiUrl = process.env.BACKEND_API_URL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokebattle')
    .setDescription('Challenge another user to a Pokémon battle!')
    .addUserOption(option =>
      option.setName('opponent')
        .setDescription('The user you want to challenge')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of Pokémon to battle with (max 5)')
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('battledex')
        .setDescription('Use your preset BattleDex team if available (default: false)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('friendly')
        .setDescription('If false, winner gets 2x rewards and loser loses all Pokémon to winner (default: true)')
        .setRequired(false)),
  async execute(interaction) {
    const challengerId = interaction.user.id;
    const opponent = interaction.options.getUser('opponent');
    const opponentId = opponent.id;
    const guildId = interaction.guildId;
    const count = interaction.options.getInteger('count') || 1;
    const friendly = interaction.options.getBoolean('friendly');
    const battleDex = interaction.options.getBoolean('battledex') || false;
    // Default to true if not specified
    const isFriendly = friendly !== false;

    // Prevent user from battling themselves
    if (challengerId === opponentId) {
      await interaction.reply({
        content: '❌ You cannot battle yourself!',
        ephemeral: true
      });
      return;
    }

    if (count < 1 || count > 5) {
      await interaction.reply({
        content: '❌ Number of Pokémon must be between 1 and 5.',
        ephemeral: true
      });
      return;
    }

    // Acknowledge interaction immediately to avoid token expiry, keep it ephemeral
    await interaction.deferReply({ ephemeral: true });

    const apiPromise = axios.post(`${backendApiUrl}/battles`, {
      challengerId,
      opponentId,
      guildId,
      count,
      friendly: isFriendly,
      battleDex,
    }, {
      headers: { 'x-guild-id': guildId }
    });

    let response;
    try {
      response = await apiPromise;
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create battle session.';
      await interaction.editReply({
        content: `❌ Could not start battle: ${errorMsg}`,
      });
      return;
    }

    const { battleId } = response.data;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pokebattle_accept_${battleId}_${opponentId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`pokebattle_decline_${battleId}_${opponentId}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
    );

    // Confirm to challenger ephemerally
    try {
      await interaction.editReply({ content: `Challenge sent to <@${opponentId}>. Waiting for response...` });
    } catch {}

    // Post public challenge message in the channel so the opponent can interact
    const sentMsg = await interaction.channel.send({
      content: `<@${opponentId}>, you have been challenged by <@${challengerId}> to a Pokémon battle! (Pokémon per side: ${count})`,
      components: [row],
      allowedMentions: { users: [opponentId] },
    });
    // --- Auto-expiry logic ---
    setTimeout(async () => {
      try {
        // Check battle status from backend
        const statusRes = await axios.get(`${backendApiUrl}/battles/${battleId}`);
        if (statusRes.data.session?.status === 'pending') {
          // Disable buttons
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`pokebattle_accept_${battleId}_${opponentId}`)
              .setLabel('Accept')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`pokebattle_decline_${battleId}_${opponentId}`)
              .setLabel('Decline')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );
          await sentMsg.edit({
            content: '⏰ Battle request expired. Please challenge again.',
            components: [disabledRow],
            allowedMentions: { users: [] },
          });
          // Cancel battle in backend
          await axios.post(`${backendApiUrl}/battles/${battleId}/respond`, {
            accept: false,
            userId: opponentId,
            expired: true,
          }, {
            headers: { 'x-guild-id': guildId }
          });
        }
      } catch (err) {
        // Ignore errors (message deleted, already handled, etc.)
      }
    }, 120000);
  },
}; 