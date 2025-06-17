const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

/**
 * Timeout a user in a Discord guild
 * @param {Guild} guild - The Discord guild
 * @param {string} userId - The ID of the user to timeout
 * @param {number} durationSeconds - Duration of timeout in seconds
 * @param {string} reason - Reason for the timeout
 * @returns {Promise<void>}
 */
async function timeoutUser(guild, userId, durationSeconds, reason) {
    try {
        const member = await guild.members.fetch(userId);
        if (!member) {
            throw new Error('Member not found');
        }

        // Apply the timeout duration directly from the backend
        // The backend has already calculated the correct total duration
        await member.timeout(durationSeconds * 1000, reason);
    } catch (error) {
        console.error('Error timing out user:', error);
        throw error;
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
            console.log(`No log channel set for guild ${guildId}`);
            return;
        }

        const channel = await client.channels.fetch(logChannelId);
        if (!channel) {
            console.log(`Log channel ${logChannelId} not found in guild ${guildId}`);
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