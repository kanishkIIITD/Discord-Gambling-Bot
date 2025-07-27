const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekend')
    .setDescription('Manage automatic weekend events (admin or authorized users only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check automatic weekend event status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Manually start a weekend event (admin or authorized users only)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Manually stop the current weekend event (admin or authorized users only)')
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
      if (subcommand === 'status') {
        const response = await axios.get(`${backendUrl}/events/weekend/status`);
        const status = response.data;

        const embed = new EmbedBuilder()
          .setColor(status.isActive ? 0x00ff00 : 0x808080)
          .setTitle('📅 Automatic Weekend Event Status')
          .setDescription(status.isActive ? 
            '🎉 **Automatic weekend event is currently active!**' : 
            '⏰ **No automatic weekend event is currently active.**'
          );

        if (status.isActive && status.activeEvent) {
          const event = status.activeEvent;
          const timeRemaining = new Date(event.endTime) - new Date();
          const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
          const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

          embed.addFields(
            { name: 'Event Description', value: event.description, inline: false },
            { name: 'Multiplier', value: `${event.multiplier}x`, inline: true },
            { name: 'Start Time', value: new Date(event.startTime).toLocaleString(), inline: true },
            { name: 'End Time', value: new Date(event.endTime).toLocaleString(), inline: true },
            { name: 'Time Remaining', value: `${hoursRemaining}h ${minutesRemaining}m`, inline: true }
          );
        } else {
          const nextWeekend = new Date(status.nextWeekendStart);
          const timeUntilNext = status.timeUntilNextWeekend;
          const daysUntilNext = Math.floor(timeUntilNext / (1000 * 60 * 60 * 24));
          const hoursUntilNext = Math.floor((timeUntilNext % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          embed.addFields(
            { name: 'Next Automatic Weekend', value: nextWeekend.toLocaleString(), inline: true },
            { name: 'Time Until Next', value: `${daysUntilNext}d ${hoursUntilNext}h`, inline: true },
            { name: 'Schedule', value: 'Every Friday 6:00 PM - Sunday 11:59 PM', inline: false }
          );
        }

        embed.setTimestamp();
        await interaction.reply({ embeds: [embed] });

      } else if (subcommand === 'start') {
        const response = await axios.post(`${backendUrl}/events/weekend/start`, {}, {
          headers: { 'x-guild-id': interaction.guildId }
        });

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🎉 Weekend Event Started!')
          .setDescription('Automatic weekend event has been manually started.')
          .addFields(
            { name: 'Duration', value: 'Friday 6 PM - Sunday 11:59 PM', inline: true },
            { name: 'Multiplier', value: '2x XP & Stardust', inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Send announcement to all spawn channels
        await sendWeekendAnnouncement(interaction.client, 'start');

      } else if (subcommand === 'stop') {
        const response = await axios.post(`${backendUrl}/events/weekend/stop`, {}, {
          headers: { 'x-guild-id': interaction.guildId }
        });

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🔚 Weekend Event Stopped')
          .setDescription('Automatic weekend event has been manually stopped.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Send announcement to all spawn channels
        await sendWeekendAnnouncement(interaction.client, 'end');
      }

    } catch (error) {
      console.error('Error in weekend command:', error);
      const errorMessage = error.response?.data?.message || 'An error occurred while processing the command.';
      await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true });
    }
  }
};

// Helper function to send weekend announcements to all spawn channels
async function sendWeekendAnnouncement(client, type) {
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
              .setTitle(type === 'start' ? '🎉 Weekend Event Started!' : '🔚 Weekend Event Ended')
              .setDescription(type === 'start' ? 
                '**Automatic weekend event is now active!**\n\nAll XP and Stardust rewards are now **2x**!\n\nThis event runs until Sunday 11:59 PM.' :
                '**Automatic weekend event has ended.**\n\nXP and Stardust rewards are back to normal.\n\nNext automatic weekend: Friday 6:00 PM'
              )
              .addFields(
                { name: 'Schedule', value: 'Every Friday 6:00 PM - Sunday 11:59 PM', inline: true },
                { name: 'Multiplier', value: type === 'start' ? '2x Rewards' : 'Normal Rewards', inline: true }
              )
              .setTimestamp();

            await channel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error(`Failed to send weekend announcement to channel ${server.pokeSpawnChannelId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error sending weekend announcements:', error);
  }
} 