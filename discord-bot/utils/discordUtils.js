const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

/**
 * Timeout a user in a Discord guild
 * @param {Guild} guild - The Discord guild
 * @param {string} userId - The ID of the user to timeout
 * @param {number} durationSeconds - Duration of timeout in seconds
 * @param {string} reason - Reason for the timeout
 * @returns {Promise<{applied: boolean, existingTimeout?: number, totalTimeout?: number}>} Whether the timeout was applied and timeout info
 */
async function timeoutUser(guild, userId, durationSeconds, reason) {
    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            throw new Error('Member not found');
        }

        const now = Date.now();
        let totalTimeoutDuration;

        // Check if user is already timed out
        if (member.communicationDisabledUntil && member.communicationDisabledUntil.getTime() > now) {
            const existingTimeoutEnd = member.communicationDisabledUntil.getTime();
            const existingTimeoutRemaining = Math.ceil((existingTimeoutEnd - now) / (60 * 1000)); // in minutes
            
            // Add the new timeout duration to the existing timeout
            const newTimeoutEnd = existingTimeoutEnd + (durationSeconds * 1000);
            totalTimeoutDuration = Math.ceil((newTimeoutEnd - now) / (60 * 1000)); // total in minutes
            
            // Apply the extended timeout
            await member.timeout(newTimeoutEnd - now, reason);
            // console.log(`User ${userId} timeout extended: ${existingTimeoutRemaining} + ${Math.ceil(durationSeconds / 60)} = ${totalTimeoutDuration} minutes total`);
            return { applied: true, existingTimeout: existingTimeoutRemaining, totalTimeout: totalTimeoutDuration };
        } else {
            // No existing timeout, apply the new one
            await member.timeout(durationSeconds * 1000, reason);
            totalTimeoutDuration = Math.ceil(durationSeconds / 60);
            // console.log(`User ${userId} new timeout applied: ${totalTimeoutDuration} minutes`);
            return { applied: true, totalTimeout: totalTimeoutDuration };
        }
    } catch (error) {
        if (error.code === 10007) {
            // Unknown Member error - user is no longer in the server
            // console.log(`Cannot timeout user ${userId}: User is no longer a member of the server`);
            throw new Error('User is no longer a member of this server');
        } else {
            console.error('Error timing out user:', error);
            throw error;
        }
    }
}

/**
 * Handle manual timeout removal and update backend
 * @param {Guild} guild - The Discord guild
 * @param {string} userId - The ID of the user whose timeout was removed
 * @returns {Promise<void>}
 */
async function handleTimeoutRemoval(guild, userId) {
    try {
        // Call backend to reset timeout duration
        const response = await axios.post(
            `${process.env.BACKEND_API_URL}/users/${userId}/reset-timeout`,
            {},
            {
                headers: {
                    'x-guild-id': guild.id
                }
            }
        );

        if (response.status !== 200) {
            throw new Error('Failed to reset timeout in backend');
        }

        // Log the manual timeout removal
        await sendLogToChannel(guild.client, guild.id, {
            color: 0xffa500,
            title: '⏰ Timeout Removed',
            description: `A user's timeout was manually removed`,
            fields: [
                { name: 'Target', value: `<@${userId}>`, inline: true }
            ],
            footer: { text: 'Removed by Discord moderator' }
        });
    } catch (error) {
        console.error('Error handling timeout removal:', error);
        // Log the error to the log channel
        await sendLogToChannel(guild.client, guild.id, {
            color: 0xff0000,
            title: '❌ Timeout Reset Failed',
            description: `Failed to reset timeout in backend`,
            fields: [
                { name: 'Target', value: `<@${userId}>`, inline: true },
                { name: 'Error', value: error.message }
            ]
        });
    }
}

/**
 * Create an error embed message
 * @param {string} message - The error message
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('Error')
        .setDescription(message)
        .setTimestamp();
}

/**
 * Create a success embed message
 * @param {string} message - The success message
 * @returns {EmbedBuilder}
 */
function createSuccessEmbed(message) {
    return new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('Success')
        .setDescription(message)
        .setTimestamp();
}

/**
 * Send a log message to the specified log channel
 * @param {Client} client - The Discord client
 * @param {string} guildId - The ID of the guild
 * @param {Object} logData - The log data to send
 * @returns {Promise<void>}
 */
async function sendLogToChannel(client, guildId, logData) {
    try {
        // Fetch server settings to get the log channel ID
        const response = await axios.get(
            `${process.env.BACKEND_API_URL}/servers/${guildId}/settings`,
            {
                headers: {
                    'x-guild-id': guildId
                }
            }
        );

        const logChannelId = response.data?.logChannelId;
        if (!logChannelId) {
            // console.log(`No log channel set for guild ${guildId}`);
            return;
        }

        const channel = await client.channels.fetch(logChannelId);
        if (!channel) {
            // console.log(`Log channel ${logChannelId} not found in guild ${guildId}`);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(logData.color || 0x0099FF)
            .setTitle(logData.title)
            .setDescription(logData.description)
            .setTimestamp();

        if (logData.fields) {
            embed.addFields(logData.fields);
        }

        if (logData.footer) {
            embed.setFooter(logData.footer);
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending log to channel:', error);
    }
}

module.exports = {
    timeoutUser,
    handleTimeoutRemoval,
    createErrorEmbed,
    createSuccessEmbed,
    sendLogToChannel
}; 