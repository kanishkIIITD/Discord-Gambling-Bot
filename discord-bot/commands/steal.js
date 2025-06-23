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
        const start = Date.now();

        try {
            const response = await axios.get(
                `${process.env.BACKEND_API_URL}/users/${interaction.user.id}/steal-stats`,
                {
                    headers: {
                        'x-guild-id': interaction.guildId
                    }
                }
            );

            const duration = Date.now() - start;

            const { stealStats } = response.data;
            const embed = createSuccessEmbed('🦹 Steal Statistics')
                .addFields(
                    { name: 'Successful Steals', value: stealStats.success.toString(), inline: true },
                    { name: 'Times Jailed', value: stealStats.jail.toString(), inline: true },
                    { name: 'Total Attempts', value: stealStats.totalAttempts.toString(), inline: true },
                    { name: 'Success Rate', value: `${stealStats.successRate}%`, inline: true },
                    { name: 'Total Stolen', value: `${stealStats.totalStolen.toLocaleString('en-US')} points`, inline: true }
                );

            if (duration < 2500) {
                await interaction.reply({ embeds: [embed] });
            } else {
                await interaction.deferReply();
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            const errorEmbed = createErrorEmbed('Command Error');
            
            if (error.response?.data?.message) {
                errorEmbed.setDescription(error.response.data.message);
            } else {
                errorEmbed.setDescription('❌ An unexpected error occurred while fetching steal statistics.');
            }

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errorEmbed] });
            } else {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    },

    async attemptSteal(interaction) {
        const targetUser = interaction.options.getUser('target');
        const start = Date.now();

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

            const duration = Date.now() - start;

            const {
                success, stolenAmount, newBalance,
                jailTimeMinutes, buffMessage
            } = response.data;

            if (success) {
                const embed = createSuccessEmbed('🦹 Steal Successful!')
                    .addFields(
                        { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Amount Stolen', value: `${stolenAmount.toLocaleString('en-US')} points`, inline: true },
                        { name: 'New Balance', value: `${newBalance.toLocaleString('en-US')} points`, inline: true },
                        { name: 'Result', value: `You successfully stole from <@${targetUser.id}>!`, inline: false }
                    );

                const messageData = {
                    embeds: [embed],
                    allowedMentions: { users: [targetUser.id] }
                };

                if (duration < 2500) {
                    await interaction.reply({
                        content: `<@${targetUser.id}>`,
                        ...messageData
                    });
                } else {
                    await interaction.deferReply();
                    await interaction.editReply(messageData);
                    await interaction.followUp({
                        content: `<@${targetUser.id}>`,
                        allowedMentions: { users: [targetUser.id] }
                    });
                }
            } else {
                const embed = createErrorEmbed('🚔 Steal Failed!')
                    .setColor(0xffa500)
                    .addFields(
                        { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Jail Time', value: `${jailTimeMinutes} minutes`, inline: true },
                        { name: 'Result', value: buffMessage || `You got caught trying to steal from <@${targetUser.id}> and are now jailed!`, inline: false }
                    );

                const messageData = {
                    embeds: [embed],
                    allowedMentions: { users: [targetUser.id] }
                };

                if (duration < 2500) {
                    await interaction.reply({
                        content: `<@${targetUser.id}>`,
                        ...messageData
                    });
                } else {
                    await interaction.deferReply();
                    await interaction.editReply(messageData);
                    await interaction.followUp({
                        content: `<@${targetUser.id}>`,
                        allowedMentions: { users: [targetUser.id] }
                    });
                }
            }

        } catch (error) {
            const errorEmbed = createErrorEmbed('Command Error');
            
            if (error.response?.status === 429) {
                errorEmbed.setDescription(`⏰ ${error.response.data.message}`);
            } else if (error.response?.data?.message) {
                const msg = error.response.data.message.toLowerCase();
                
                if (msg.includes('cooldown') || msg.includes('wait')) {
                    errorEmbed.setDescription(`⏰ ${error.response.data.message}`);
                } else if (msg.includes('jailed')) {
                    errorEmbed.setDescription(`🚔 ${error.response.data.message}`);
                } else if (msg.includes('not found') || msg.includes('does not exist')) {
                    errorEmbed.setDescription(`❌ ${error.response.data.message}`);
                } else if (msg.includes('insufficient balance')) {
                    errorEmbed.setDescription(`💰 ${error.response.data.message}`);
                } else if (msg.includes('cannot steal from yourself')) {
                    errorEmbed.setDescription(`🤦 ${error.response.data.message}`);
                } else {
                    errorEmbed.setDescription(error.response.data.message);
                }
            } else {
                errorEmbed.setDescription('❌ An unexpected error occurred while processing the steal command.');
            }

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errorEmbed] });
            } else {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    }
}; 