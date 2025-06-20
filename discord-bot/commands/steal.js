const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/discordUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steal')
        .setDescription('Attempt to steal points from another user (30% success rate, 2-hour cooldown)')
        .addSubcommand(sub =>
            sub.setName('do')
                .setDescription('Attempt to steal points from another user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to steal from')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('View your steal statistics')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'stats') {
            await this.showStats(interaction);
        } else if (subcommand === 'do') {
            await this.attemptSteal(interaction);
        }
    },

    async showStats(interaction) {
        await interaction.deferReply();

        try {
            const response = await axios.get(
                `${process.env.BACKEND_API_URL}/users/${interaction.user.id}/steal-stats`,
                {
                    headers: {
                        'x-guild-id': interaction.guildId
                    }
                }
            );

            const { stealStats } = response.data;
            const embed = createSuccessEmbed('🦹 Steal Statistics')
                .addFields(
                    { name: 'Successful Steals', value: stealStats.success.toString(), inline: true },
                    // { name: 'Failed Attempts', value: stealStats.fail.toString(), inline: true },
                    { name: 'Times Jailed', value: stealStats.jail.toString(), inline: true },
                    { name: 'Total Attempts', value: stealStats.totalAttempts.toString(), inline: true },
                    { name: 'Success Rate', value: `${stealStats.successRate}%`, inline: true },
                    { name: 'Total Stolen', value: `${stealStats.totalStolen.toLocaleString('en-US')} points`, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const errorEmbed = createErrorEmbed('Command Error');
            
            if (error.response?.data?.message) {
                errorEmbed.setDescription(error.response.data.message);
            } else {
                errorEmbed.setDescription('❌ An unexpected error occurred while fetching steal statistics.');
            }

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async attemptSteal(interaction) {
        const targetUser = interaction.options.getUser('target');

        try {
            const response = await axios.post(
                `${process.env.BACKEND_API_URL}/users/${interaction.user.id}/steal`,
                {
                    targetDiscordId: targetUser.id
                },
                {
                    headers: {
                        'x-guild-id': interaction.guildId
                    }
                }
            );

            const { success, stolenAmount, newBalance, jailTimeMinutes, cooldownTime, buffUsed, buffMessage } = response.data;

            if (success) {
                // Success case
                const embed = createSuccessEmbed('🦹 Steal Successful!')
                    .addFields(
                        { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Amount Stolen', value: `${stolenAmount.toLocaleString('en-US')} points`, inline: true },
                        { name: 'New Balance', value: `${newBalance.toLocaleString('en-US')} points`, inline: true },
                        { name: 'Result', value: `You successfully stole from <@${targetUser.id}>!`, inline: false }
                    );

                await interaction.reply({
                    content: `<@${targetUser.id}>`,
                    embeds: [embed],
                    allowedMentions: { users: [targetUser.id] }
                });

            } else {
                // Failure case
                const embed = createErrorEmbed('🚔 Steal Failed!')
                    .setColor(0xffa500) // Orange for failure
                    .addFields(
                        { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Jail Time', value: `${jailTimeMinutes} minutes`, inline: true },
                        { name: 'Result', value: buffMessage ? buffMessage : `You got caught trying to steal from <@${targetUser.id}> and are now jailed!`, inline: false }
                    );

                await interaction.reply({
                    content: `<@${targetUser.id}>`,
                    embeds: [embed],
                    allowedMentions: { users: [targetUser.id] }
                });
            }

        } catch (error) {
            // Create error embed
            const errorEmbed = createErrorEmbed('Command Error');
            
            if (error.response?.status === 429) {
                // Cooldown error
                errorEmbed.setDescription(`⏰ ${error.response.data.message}`);
            } else if (error.response?.data?.message) {
                const message = error.response.data.message.toLowerCase();
                
                // Handle specific error cases with appropriate emojis
                if (message.includes('cooldown') || message.includes('wait')) {
                    errorEmbed.setDescription(`⏰ ${error.response.data.message}`);
                } else if (message.includes('jailed')) {
                    errorEmbed.setDescription(`🚔 ${error.response.data.message}`);
                } else if (message.includes('not found') || message.includes('does not exist')) {
                    errorEmbed.setDescription(`❌ ${error.response.data.message}`);
                } else if (message.includes('insufficient balance')) {
                    errorEmbed.setDescription(`💰 ${error.response.data.message}`);
                } else if (message.includes('cannot steal from yourself')) {
                    errorEmbed.setDescription(`🤦 ${error.response.data.message}`);
                } else {
                    // For any other error message from the backend
                    errorEmbed.setDescription(error.response.data.message);
                }
            } else {
                // For unexpected errors
                errorEmbed.setDescription('❌ An unexpected error occurred while processing the steal command.');
            }

            await interaction.reply({ embeds: [errorEmbed] });
        }
    }
}; 