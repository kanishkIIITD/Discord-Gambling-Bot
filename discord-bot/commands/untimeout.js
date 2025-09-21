const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { createErrorEmbed, createSuccessEmbed, sendLogToChannel } = require('../utils/discordUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Reduce a bot-applied timeout for a user (costs points)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to untimeout')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Minutes to reduce (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the untimeout (optional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Check bot permission
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            const errorEmbed = createErrorEmbed('Permission Error')
                .setDescription('I need the "Timeout Members" permission to adjust timeouts.');
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        // Fetch member if possible (for remaining time adjustment)
        let targetMember = null;
        try {
            targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch (e) {
            // ignore; may have left the server
        }

        try {
            const response = await axios.post(
                `${process.env.BACKEND_API_URL}/users/${interaction.user.id}/untimeout`,
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

            const { cost, deltaAppliedMinutes, newTimeoutEndsAt, remainingBalance } = response.data;

            // Adjust Discord timeout to reflect reduction
            if (targetMember && targetMember.communicationDisabledUntil) {
                const now = Date.now();
                const currentEnd = targetMember.communicationDisabledUntil.getTime();
                const newEnd = newTimeoutEndsAt ? new Date(newTimeoutEndsAt).getTime() : now;
                if (!newTimeoutEndsAt || newEnd <= now) {
                    await targetMember.timeout(null, reason);
                } else {
                    await targetMember.timeout(newEnd - now, reason);
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099ff) // Blue color instead of green
                .setTitle('Untimeout Executed')
                .setDescription('Successfully reduced user timeout')
                .setTimestamp()
                .addFields(
                    { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Reduced By', value: `${deltaAppliedMinutes} minute(s)`, inline: true },
                    { name: 'Cost', value: `${cost.toLocaleString('en-US')} points`, inline: true },
                    // { name: 'Your Balance', value: `${remainingBalance.toLocaleString('en-US')} points`, inline: true },
                );

            if (newTimeoutEndsAt) {
                embed.addFields({ name: 'New Timeout Ends', value: `<t:${Math.floor(new Date(newTimeoutEndsAt).getTime() / 1000)}:R>` });
            } else {
                embed.addFields({ name: 'New Timeout Ends', value: 'Timeout cleared' });
            }

            await sendLogToChannel(interaction.client, interaction.guildId, {
                color: 0x00ff00,
                title: '✅ Untimeout Applied',
                description: `${interaction.user} reduced ${targetUser}'s timeout`,
                fields: [
                    { name: 'Reduced By', value: `${deltaAppliedMinutes} minute(s)`, inline: true },
                    { name: 'Cost', value: `${cost.toLocaleString('en-US')}`, inline: true },
                ]
            });

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || 'Failed to apply untimeout.';
            const embed = createErrorEmbed('Untimeout Failed').setDescription(message);
            return interaction.editReply({ embeds: [embed] });
        }
    }
};


