const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/discordUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlogchannel')
        .setDescription('Set the channel where moderation logs will be sent')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send logs to')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Check if the user has Administrator permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const errorEmbed = createErrorEmbed('Permission Error')
                .setDescription('You need Administrator permission to use this command.');
            return interaction.reply({ embeds: [errorEmbed]});
        }

        await interaction.deferReply();

        const channel = interaction.options.getChannel('channel');

        // Verify the channel is a text channel
        if (!channel.isTextBased()) {
            const errorEmbed = createErrorEmbed('Invalid Channel')
                .setDescription('Please select a text channel for logs.');
            return interaction.editReply({ embeds: [errorEmbed] });
        }

        try {
            // Check if the bot has permission to send messages in the channel
            const permissions = channel.permissionsFor(interaction.client.user);
            if (!permissions.has(PermissionFlagsBits.SendMessages)) {
                const errorEmbed = createErrorEmbed('Permission Error')
                    .setDescription('I need permission to send messages in the selected channel.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // Update the log channel in the database
            await axios.post(
                `${process.env.BACKEND_API_URL}/servers/${interaction.guildId}/settings`,
                {
                    logChannelId: channel.id
                },
                {
                    headers: {
                        'x-guild-id': interaction.guildId
                    }
                }
            );

            const successEmbed = createSuccessEmbed('Log Channel Set')
                .setDescription(`Logs will now be sent to ${channel}`);

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            const errorEmbed = createErrorEmbed('Command Error')
                .setDescription('Failed to set the log channel. Please try again later.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
}; 