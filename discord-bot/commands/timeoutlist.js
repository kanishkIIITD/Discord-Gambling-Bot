const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/discordUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeoutlist')
        .setDescription('List all currently timed out users in the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const response = await axios.get(
                `${process.env.BACKEND_API_URL}/users/timeout-users`,
                {
                    headers: {
                        'x-guild-id': interaction.guildId
                    }
                }
            );

            const { timeoutUsers } = response.data;

            if (timeoutUsers.length === 0) {
                const embed = createSuccessEmbed('Timeout List')
                    .setDescription('No users are currently timed out!')
                    .setColor(0x00ff00); // Green for no timeouts
                
                return interaction.editReply({ embeds: [embed] });
            }

            // Create embed with timeout list
            const embed = new EmbedBuilder()
                .setColor(0xff6b35) // Orange color for timeout list
                .setTitle('⏰ Currently Timed Out Users')
                .setDescription(`Found ${timeoutUsers.length} user(s) currently timed out:`)
                .setTimestamp();

            // Add each timed out user as a field
            timeoutUsers.forEach((user, index) => {
                const timeoutEndsAt = new Date(user.timeoutEndsAt);
                const timeLeft = user.remainingMinutes > 0 ? 
                    `<t:${Math.floor(timeoutEndsAt.getTime() / 1000)}:R>` : 
                    'Expired';
                
                embed.addFields({
                    name: `${index + 1}. ${user.username}`,
                    value: `**User:** <@${user.discordId}>\n**Duration:** ${user.currentTimeoutDuration} minute(s)\n**Time Left:** ${timeLeft}`,
                    inline: true
                });
            });

            // Add footer with total count
            embed.setFooter({ 
                text: `Total: ${timeoutUsers.length} user(s) timed out` 
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching timeout list:', error);
            
            const errorEmbed = createErrorEmbed('Command Error')
                .setDescription('❌ Failed to fetch the list of timed out users. Please try again later.');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
