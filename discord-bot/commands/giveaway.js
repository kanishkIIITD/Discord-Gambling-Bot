const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway for points!')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of points to give away')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000000000)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Optional description for the giveaway')
        .setRequired(false)
        .setMaxLength(200)
    ),

  async execute(interaction) {
    const backendUrl = process.env.BACKEND_API_URL;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const amount = interaction.options.getInteger('amount');
    const description = interaction.options.getString('description') || 'No description provided';

    // Validate amount
    if (amount < 1 || amount > 1000000000) {
      return interaction.reply({
        content: '❌ Giveaway amount must be between 1 and 1,000,000,000 points. (1 billion)',
        ephemeral: true
      });
    }

    try {
      // Check if user has enough points
      const walletRes = await axios.get(`${backendUrl}/users/${userId}/wallet`, {
        headers: { 'x-guild-id': guildId }
      });
      const balance = walletRes.data.balance;

      if (balance < amount) {
        return interaction.reply({
          content: `❌ You don't have enough points to start this giveaway. You have ${balance.toLocaleString('en-US')} points.`,
          ephemeral: true
        });
      }

      // Create giveaway embed
      const embed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY! 🎉')
        .setDescription(`${description}\n\n**Prize:** ${amount.toLocaleString('en-US')} points\n\nReact with 🎉 to enter!\n\n**Time remaining:** 5 minutes`)
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: `Hosted by ${interaction.user.username}` });

      // Get gamblers role for ping
      const guild = interaction.guild;
      let gamblersRole;
      let content = '';
      if (guild?.roles?.cache) {
        gamblersRole = guild.roles.cache.find(role => role.name === 'Gamblers');
        if (gamblersRole) {
          content = `<@&${gamblersRole.id}> A new giveaway has started!`;
        }
      }

      // Send the giveaway message (reactions only)
      const giveawayMessage = await interaction.reply({
        content: content || 'A new giveaway has started!',
        embeds: [embed],
        allowedMentions: gamblersRole ? { roles: [gamblersRole.id] } : undefined,
        fetchReply: true
      });

      // Add reaction to the message
      await giveawayMessage.react('🎉');

      // Store giveaway data
      const giveawayData = {
        messageId: giveawayMessage.id,
        channelId: interaction.channelId,
        guildId: guildId,
        hostId: userId,
        amount: amount,
        description: description,
        participants: new Set(),
        endTime: Date.now() + (5 * 60 * 1000), // 5 minutes
        active: true
      };

      // Store in global giveaways map (you'll need to add this to your index.js)
      if (!global.activeGiveaways) {
        global.activeGiveaways = new Map();
      }
      global.activeGiveaways.set(giveawayMessage.id, giveawayData);

      // Set timeout to end the giveaway
      setTimeout(async () => {
        try {
          await endGiveaway(giveawayMessage.id, interaction.client);
        } catch (error) {
          console.error('[Giveaway] Error ending giveaway:', error);
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error('Error starting giveaway:', error);
      await interaction.reply({
        content: '❌ Failed to start the giveaway. Please try again later.',
        ephemeral: true
      });
    }
  }
};

async function endGiveaway(messageId, client) {
  try {
    const giveaway = global.activeGiveaways.get(messageId);
    if (!giveaway || !giveaway.active) {
      return;
    }

    // Mark as inactive
    giveaway.active = false;
    global.activeGiveaways.set(messageId, giveaway);

    // Get the channel and message
    const channel = await client.channels.fetch(giveaway.channelId);
    if (!channel) {
      console.error('[Giveaway] Could not fetch channel for giveaway:', giveaway.channelId);
      return;
    }

    const message = await channel.messages.fetch(messageId);
    if (!message) {
      console.error('[Giveaway] Could not fetch message for giveaway:', messageId);
      return;
    }

    // Get participants from reactions, excluding the host
    const reaction = message.reactions.cache.get('🎉');
    let participants = [];
    if (reaction) {
      const users = await reaction.users.fetch();
      participants = users.filter(user => !user.bot && user.id !== giveaway.hostId).map(user => user.id);
    }

    if (participants.length === 0) {
      await announceNoParticipants(channel, giveaway, client);
      return;
    }

    // Pick a random winner
    const winnerId = participants[Math.floor(Math.random() * participants.length)];
    const winner = await client.users.fetch(winnerId);

    // Transfer points to winner
    const backendUrl = process.env.BACKEND_API_URL;
    const guildId = giveaway.guildId;

    try {
      // Gift points from host to winner
      await axios.post(`${backendUrl}/users/${giveaway.hostId}/gift`, {
        recipientDiscordId: winnerId,
        amount: giveaway.amount
      }, { headers: { 'x-guild-id': guildId } });

      // Get gamblers role for announcement
      const guild = await client.guilds.fetch(giveaway.guildId);
      const gamblersRole = guild.roles.cache.find(role => role.name === 'Gamblers');
      const announcementContent = gamblersRole ? `<@&${gamblersRole.id}>` : '';

      // Announce winner in a new message
      const winnerEmbed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY ENDED! 🎉')
        .setDescription(`**Winner:** <@${winnerId}>\n\n**Prize:** ${giveaway.amount.toLocaleString()} points\n\n**Total participants:** ${participants.length}`)
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ text: `Hosted by ${(await client.users.fetch(giveaway.hostId)).username}` });

      await channel.send({
        content: `${announcementContent} 🎉 Congratulations <@${winnerId}>! You won ${giveaway.amount.toLocaleString()} points!`,
        embeds: [winnerEmbed],
        allowedMentions: gamblersRole ? { roles: [gamblersRole.id] } : undefined
      });

    } catch (error) {
      console.error('[Giveaway] Error transferring giveaway prize:', error);
      await channel.send({
        content: '❌ Error occurred while transferring the prize. Please contact an administrator.',
        embeds: []
      });
    }

  } catch (error) {
    console.error('[Giveaway] Error ending giveaway:', error);
  }
}

async function announceNoParticipants(channel, giveaway, client) {
  // Get gamblers role for announcement
  const guild = await client.guilds.fetch(giveaway.guildId);
  const gamblersRole = guild.roles.cache.find(role => role.name === 'Gamblers');
  const announcementContent = gamblersRole ? `<@&${gamblersRole.id}>` : '';

  const noParticipantsEmbed = new EmbedBuilder()
    .setTitle('🎉 GIVEAWAY ENDED! 🎉')
    .setDescription('**No one participated in this giveaway.**\n\nThe prize has been returned to the host.')
    .setColor(0xff0000)
    .setTimestamp()
    .setFooter({ text: `Hosted by ${(await client.users.fetch(giveaway.hostId)).username}` });

  await channel.send({
    content: `${announcementContent} No participants joined the giveaway.`,
    embeds: [noParticipantsEmbed],
    allowedMentions: gamblersRole ? { roles: [gamblersRole.id] } : undefined
  });
} 