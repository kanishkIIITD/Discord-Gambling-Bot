const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const { timeoutUser, createErrorEmbed, createSuccessEmbed, sendLogToChannel } = require('../utils/discordUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a user for a specified duration (costs points)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in minutes (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the timeout (optional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Check if the bot has permission to timeout users
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            const errorEmbed = createErrorEmbed('Permission Error')
                .setDescription('I need the "Timeout Members" permission to help you with this. Please ask a server administrator to grant me this permission.');
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        // Check if the target user is timeoutable
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (error) {
            if (error.code === 10007) {
                // Unknown Member error - user is no longer in the server
                const errorEmbed = createErrorEmbed('User Not Found')
                    .setDescription(`❌ Cannot timeout ${targetUser.username} because they are no longer a member of this server.\n\nThis can happen if:\n• They were banned from the server\n• They left the server\n• They were removed from the server\n\n**Note:** Your points have not been deducted.`);
                return interaction.editReply({ embeds: [errorEmbed] });
            } else {
                // Re-throw other errors
                throw error;
            }
        }

        if (!targetMember.moderatable) {
            const errorEmbed = createErrorEmbed('Permission Error')
                .setDescription(`I cannot timeout ${targetUser.username} as they have higher permissions than me. Please contact a server administrator for assistance.`);
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        try {
            const response = await axios.post(
                `${process.env.BACKEND_API_URL}/users/${interaction.user.id}/timeout`,
                {
                    targetDiscordId: targetUser.id,
                    duration,
                    reason
                },
                {
                    headers: {
                        'x-guild-id': interaction.guildId
                    }
                }
            );

            // Apply timeout in Discord using the additional duration from the backend
            // The timeoutUser function will handle adding to existing timeouts
            const timeoutResult = await timeoutUser(interaction.guild, targetUser.id, response.data.additionalDuration * 60, reason);

            // Calculate cooldown time from cooldownTime
            const now = Date.now();
            const lastTimeoutAt = new Date(response.data.cooldownTime);
            const cooldownEndTime = new Date(lastTimeoutAt.getTime() + (5 * 60 * 1000)); // 5 minutes cooldown
            const timeRemaining = Math.max(0, cooldownEndTime - now);
            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = Math.floor((timeRemaining % 60000) / 1000);
            const cooldownString = `${minutes}m ${seconds}s`;

            // Create success embed
            const embed = createSuccessEmbed('Timeout Executed')
                .addFields(
                    { name: 'Target User', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Duration Added', value: `${duration} minute(s)`, inline: true },
                    { name: 'Total Duration', value: `${response.data.totalDuration} minute(s)`, inline: true },
                    { name: 'Cost', value: `${response.data.cost.toLocaleString()} points`, inline: true },
                );

            // Add note if Discord timeout was extended from existing timeout
            if (timeoutResult.existingTimeout) {
                embed.addFields({ 
                    name: '⏰ Timeout Extended', 
                    value: `User already had ${timeoutResult.existingTimeout} minute(s) remaining. Total Discord timeout is now ${timeoutResult.totalTimeout} minute(s).`,
                    inline: false 
                });
            }

            if (reason !== 'No reason provided') {
                embed.addFields({ name: 'Reason', value: reason });
            }

            await interaction.editReply({ embeds: [embed] });

            // Send log to log channel
            await sendLogToChannel(interaction.client, interaction.guildId, {
                color: 0x00ff00, // Always green since timeout is always applied
                title: timeoutResult.existingTimeout ? '⏰ Timeout Extended' : '⏰ Timeout Executed',
                description: timeoutResult.existingTimeout ? 'A user\'s timeout has been extended' : 'A user has been timed out',
                fields: [
                    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Duration Added', value: `${duration} minute(s)`, inline: true },
                    { name: 'Total Duration', value: `${response.data.totalDuration} minute(s)`, inline: true },
                    { name: 'Points Spent', value: `${response.data.cost.toLocaleString()} points`, inline: true },
                    ...(timeoutResult.existingTimeout ? [
                        { name: 'Previous Timeout', value: `${timeoutResult.existingTimeout} minute(s) remaining`, inline: true },
                        { name: 'New Total Timeout', value: `${timeoutResult.totalTimeout} minute(s)`, inline: true }
                    ] : [])
                ],
                footer: { text: `Reason: ${reason}` }
            });

        } catch (error) {
            // Create error embed
            const errorEmbed = createErrorEmbed('Command Error');
            
            if (error.response?.status === 429) {
                // Rate limiting error
                errorEmbed.setDescription(`⏰ ${error.response.data.message}`);
            } else if (error.response?.data?.message) {
                const message = error.response.data.message.toLowerCase();
                
                // Handle specific error cases with appropriate emojis
                if (message.includes('cooldown') || message.includes('wait')) {
                    errorEmbed.setDescription(`⏰ ${error.response.data.message}`);
                } else if (message.includes('insufficient balance') || message.includes('not enough points')) {
                    const brokeMessages = [
                        `Nice try, but you're too broke to silence anyone right now 💸.`,
                        `<@${targetUser.id}> lives to speak another day… because you couldn’t afford their silence 😂.`,
                        `You pulled out your wallet… and moths flew out 🪰. Timeout failed!`,
                        `That timeout attempt bounced like your bank account 📉.`,
                        `You tried to flex your power, but your balance said 'nah' 💀.`,
                        `Even the timeout gods require coin. And you, friend, are bankrupt.`,
                        `Imagine being so broke, you can’t even afford 5 minutes of peace 😬.`,
                        `Timeout failed. Poverty won 🏚️.`,
                        `You're all bark and no balance. Timeout rejected 🐶.`,
                        `You wanted silence... but your wallet said 'speak freely.' 🎤`
                    ];
                
                    const funMessage = brokeMessages[Math.floor(Math.random() * brokeMessages.length)];
                    const brokeEmbed = createErrorEmbed('💸 You\'re Broke!')
                        .setDescription(`${funMessage}`)
                        .addFields(
                            { name: 'Target User', value: `<@${targetUser.id}>`, inline: true },
                            { name: 'Duration Attempted', value: `${duration} minute(s)`, inline: true },
                            { name: 'Required Cost', value: `${(100000 * duration).toLocaleString('en-US')} + 2% of balance`, inline: true },
                            { name: 'Reason', value: reason || 'No reason provided', inline: false }
                        )
                        .setFooter({ text: 'Earn more points to timeout users like a boss 💼' });
                
                    await interaction.editReply({ embeds: [brokeEmbed] });
                
                    // Log the failed attempt
                    await sendLogToChannel(interaction.client, interaction.guildId, {
                        color: 0xffa500, // orange for warning/failure
                        title: '❌ Timeout Failed - Broke!',
                        description: `${funMessage}`,
                        fields: [
                            { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                            { name: 'Attempted Duration', value: `${duration} minute(s)`, inline: true },
                            { name: 'Required Cost', value: `${(100000 * duration).toLocaleString('en-US')} + 2% of balance`, inline: true },
                            { name: 'Reason', value: reason || 'No reason provided', inline: false }
                        ],
                    });
                
                    return; // Exit here so no other error handling runs
                }
                 else if (message.includes('not found') || message.includes('does not exist')) {
                    errorEmbed.setDescription(`❌ ${error.response.data.message}`);
                } else if (message.includes('admin') || message.includes('superadmin')) {
                    errorEmbed.setDescription(`👑 ${error.response.data.message}`);
                } else if (message.includes('invalid') || message.includes('invalid duration')) {
                    errorEmbed.setDescription(`⚠️ ${error.response.data.message}`);
                } else {
                    // For any other error message from the backend
                    errorEmbed.setDescription(error.response.data.message);
                }
            } else if (error.message === 'User is no longer a member of this server') {
                // Error from timeoutUser function
                errorEmbed.setDescription(`❌ Cannot timeout ${targetUser.username} because they are no longer a member of this server.\n\nThis can happen if:\n• They were banned from the server\n• They left the server\n• They were removed from the server\n\n**Note:** Your points have not been deducted.`);
            } else {
                // For unexpected errors
                errorEmbed.setDescription('❌ An unexpected error occurred while processing the timeout command.');
            }

            await interaction.editReply({ embeds: [errorEmbed] });

            // Send error log to log channel
            await sendLogToChannel(interaction.client, interaction.guildId, {
                color: 0xff0000,
                title: '❌ Timeout Failed',
                description: `A timeout attempt failed`,
                fields: [
                    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Duration', value: `${duration} minute(s)`, inline: true },
                    { name: 'Error', value: error.response?.data?.message || error.message || 'An unexpected error occurred' }
                ],
                footer: { text: `Reason: ${reason}` }
            });
        }
    },
}; 