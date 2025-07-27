const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('doubleweekend')
    .setDescription('Manage double weekend events (admin or authorized users only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start a double weekend event')
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Duration in hours (default: 48)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(168) // 1 week max
        )
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Custom description for the event')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stop the current double weekend event')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check the current double weekend status')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    // Only restrict start and stop commands, allow status for everyone
    if ((subcommand === 'start' || subcommand === 'stop')) {
      // Allow specific user ID or admin permissions
      const allowedUserId = '294497956348821505';
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator) && interaction.user.id !== allowedUserId) {
        return interaction.reply({ content: 'Only admins or authorized users can use this command.', ephemeral: true });
      }
    }
    const backendUrl = process.env.BACKEND_API_URL;

    try {
      if (subcommand === 'start') {
        const duration = interaction.options.getInteger('duration') || 48;
        const description = interaction.options.getString('description') || 'Double XP and Stardust Weekend!';

        const response = await axios.post(`${backendUrl}/events/double-weekend/start`, {
          durationHours: duration,
          description
        }, {
          headers: { 'x-guild-id': interaction.guildId }
        });

        const event = response.data.event;
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🎉 Double Weekend Started!')
          .setDescription(description)
          .addFields(
            { name: 'Duration', value: `${duration} hours`, inline: true },
            { name: 'Multiplier', value: `${event.multiplier}x`, inline: true },
            { name: 'Start Time', value: new Date(event.startTime).toLocaleString(), inline: true },
            { name: 'End Time', value: new Date(event.endTime).toLocaleString(), inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Send announcement to all spawn channels
        await sendDoubleWeekendAnnouncement(interaction.client, 'start', event);

      } else if (subcommand === 'stop') {
        const response = await axios.post(`${backendUrl}/events/double-weekend/stop`, {}, {
          headers: { 'x-guild-id': interaction.guildId }
        });

        const event = response.data.event;
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🔚 Double Weekend Ended')
          .setDescription('The double weekend event has been stopped.')
          .addFields(
            { name: 'Duration', value: `${Math.round((new Date(event.endTime) - new Date(event.startTime)) / (1000 * 60 * 60))} hours`, inline: true },
            { name: 'Start Time', value: new Date(event.startTime).toLocaleString(), inline: true },
            { name: 'End Time', value: new Date(event.endTime).toLocaleString(), inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Send announcement to all spawn channels
        await sendDoubleWeekendAnnouncement(interaction.client, 'end', event);

      } else if (subcommand === 'status') {
        const response = await axios.get(`${backendUrl}/events/double-weekend/status`);

        const { isActive, event } = response.data;
        
        if (isActive && event) {
          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🎉 Double Weekend Active!')
            .setDescription(event.description)
            .addFields(
              { name: 'Multiplier', value: `${event.multiplier}x`, inline: true },
              { name: 'Start Time', value: new Date(event.startTime).toLocaleString(), inline: true },
              { name: 'End Time', value: new Date(event.endTime).toLocaleString(), inline: true },
              { name: 'Time Remaining', value: getTimeRemaining(new Date(event.endTime)), inline: true }
            )
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          const embed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('📊 Double Weekend Status')
            .setDescription('No double weekend event is currently active.')
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Error in doubleweekend command:', error);
      const errorMessage = error.response?.data?.message || 'An error occurred while processing the command.';
      await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true });
    }
  }
};

// Helper function to send announcements to all spawn channels
async function sendDoubleWeekendAnnouncement(client, type, event) {
  try {
    const backendUrl = process.env.BACKEND_API_URL;
    const response = await axios.get(`${backendUrl}/servers/pokechannels`);
    const servers = response.data.servers || [];

    for (const server of servers) {
      if (server.pokeSpawnChannelId) {
        try {
          const channel = await client.channels.fetch(server.pokeSpawnChannelId);
          if (channel && channel.permissionsFor(client.user).has('SendMessages')) {
            const embed = new EmbedBuilder()
              .setColor(type === 'start' ? 0x00ff00 : 0xff0000)
              .setTitle(type === 'start' ? '🎉 Double Weekend Started!' : '🔚 Double Weekend Ended')
              .setDescription(type === 'start' ? 
                `${event.description}\n\n**All XP and Stardust rewards are now ${event.multiplier}x!**` :
                'The double weekend event has ended.\n\n**XP and Stardust rewards are back to normal.**'
              )
              .addFields(
                { name: 'Multiplier', value: `${event.multiplier}x`, inline: true },
                { name: 'Start Time', value: new Date(event.startTime).toLocaleString(), inline: true },
                { name: 'End Time', value: new Date(event.endTime).toLocaleString(), inline: true }
              )
              .setTimestamp();

            await channel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error(`Failed to send double weekend announcement to channel ${server.pokeSpawnChannelId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error sending double weekend announcements:', error);
  }
}

// Helper function to format time remaining
function getTimeRemaining(endTime) {
  const now = new Date();
  const timeLeft = endTime - now;
  
  if (timeLeft <= 0) {
    return 'Ended';
  }
  
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
} 