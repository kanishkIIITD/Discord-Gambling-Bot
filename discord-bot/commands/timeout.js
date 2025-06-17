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
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
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

            // Apply timeout in Discord using the total duration from the backend
            await timeoutUser(interaction.guild, targetUser.id, response.data.totalDuration * 60, reason);

            // Calculate cooldown time from cooldownTime
            const lastTimeoutAt = new Date(response.data.cooldownTime);
            const now = new Date();
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
                    { name: 'Remaining Balance', value: `${response.data.remainingBalance.toLocaleString()} points`, inline: true },
                    { name: 'Cooldown', value: cooldownString, inline: true }
                );

            if (reason !== 'No reason provided') {
                embed.addFields({ name: 'Reason', value: reason });
            }

            await interaction.editReply({ embeds: [embed] });

            // Send log to log channel
            await sendLogToChannel(interaction.client, interaction.guildId, {
                color: 0x00ff00,
                title: '⏰ Timeout Executed',
                description: `A user has been timed out`,
                fields: [
                    { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Duration Added', value: `${duration} minute(s)`, inline: true },
                    { name: 'Total Duration', value: `${response.data.totalDuration} minute(s)`, inline: true },
                    { name: 'Points Spent', value: `${response.data.cost.toLocaleString()} points`, inline: true }
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
                    errorEmbed.setDescription(`💰 ${error.response.data.message}`);
                } else if (message.includes('not found') || message.includes('does not exist')) {
                    errorEmbed.setDescription(`❌ ${error.response.data.message}`);
                } else if (message.includes('admin') || message.includes('superadmin')) {
                    errorEmbed.setDescription(`👑 ${error.response.data.message}`);
                } else if (message.includes('invalid') || message.includes('invalid duration')) {
                    errorEmbed.setDescription(`⚠️ ${error.response.data.message}`);
                } else {
                    // For any other error message from the backend
                    errorEmbed.setDescription(error.response.data.message);
                }
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
                    { name: 'Error', value: error.response?.data?.message || 'An unexpected error occurred' }
                ],
                footer: { text: `Reason: ${reason}` }
            });
        }
    },
}; 