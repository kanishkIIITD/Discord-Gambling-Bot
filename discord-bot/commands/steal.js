const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/discordUtils');

const rarityEmojis = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡',
  mythical: '🟠',
  transcendent: '🌟',
  og: '🕶️'
};

const typeEmojis = {
  points: '💰',
  fish: '🐟',
  animal: '🦊',
  item: '🎁'
};

const punishmentEmojis = {
  jail: '🚔',
  fine: '💸',
  itemLoss: '📦',
  cooldown: '⏰',
  // TODO: Implement these punishment types later
  // bounty: '🏷️',
  // marked: '👤',
  // penalty: '⚠️',
  // ban: '🚫'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steal')
        .setDescription('Enhanced stealing system with multiple targets and punishments')
        .addSubcommand(sub =>
            sub.setName('points')
                .setDescription('Attempt to steal points from another user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to steal from')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('fish')
                .setDescription('Attempt to steal fish from another user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to steal from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rarity')
                        .setDescription('Specific rarity to target (optional)')
                        .addChoices(
                            { name: 'Common', value: 'common' },
                            { name: 'Uncommon', value: 'uncommon' },
                            { name: 'Rare', value: 'rare' },
                            { name: 'Epic', value: 'epic' },
                            { name: 'Legendary', value: 'legendary' },
                            { name: 'Mythical', value: 'mythical' },
                            { name: 'Transcendent', value: 'transcendent' },
                            { name: 'OG', value: 'og' }
                        ))
        )
        .addSubcommand(sub =>
            sub.setName('animal')
                .setDescription('Attempt to steal animals from another user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to steal from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rarity')
                        .setDescription('Specific rarity to target (optional)')
                        .addChoices(
                            { name: 'Common', value: 'common' },
                            { name: 'Uncommon', value: 'uncommon' },
                            { name: 'Rare', value: 'rare' },
                            { name: 'Epic', value: 'epic' },
                            { name: 'Legendary', value: 'legendary' },
                            { name: 'Mythical', value: 'mythical' },
                            { name: 'Transcendent', value: 'transcendent' },
                            { name: 'OG', value: 'og' }
                        ))
        )
        .addSubcommand(sub =>
            sub.setName('item')
                .setDescription('Attempt to steal items from another user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to steal from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rarity')
                        .setDescription('Specific rarity to target (optional)')
                        .addChoices(
                            { name: 'Common', value: 'common' },
                            { name: 'Uncommon', value: 'uncommon' },
                            { name: 'Rare', value: 'rare' },
                            { name: 'Epic', value: 'epic' },
                            { name: 'Legendary', value: 'legendary' },
                            { name: 'Mythical', value: 'mythical' },
                            { name: 'Transcendent', value: 'transcendent' },
                            { name: 'OG', value: 'og' }
                        ))
        )
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('View your enhanced steal statistics')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'stats') {
            await this.showStats(interaction);
        } else {
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
            const embed = createSuccessEmbed('🦹 Enhanced Steal Statistics')
                .addFields(
                    { name: 'Overall Stats', value: 
                        `**Total Attempts:** ${stealStats.totalAttempts}\n` +
                        `**Success Rate:** ${stealStats.successRate}%\n` +
                        `**Total Stolen:** ${stealStats.totalStolen.toLocaleString('en-US')} points\n` +
                        `**Failure Count:** ${stealStats.failureCount || 0}`, 
                        inline: false 
                    }
                );

            // Add type-specific stats
            if (stealStats.typeStats) {
                const typeStatsText = Object.entries(stealStats.typeStats)
                    .map(([type, stats]) => {
                        if (stats.total === 0) return null;
                        return `${typeEmojis[type]} **${type.charAt(0).toUpperCase() + type.slice(1)}:** ${stats.success}/${stats.total} (${stats.successRate}%)`;
                    })
                    .filter(Boolean)
                    .join('\n');
                
                if (typeStatsText) {
                    embed.addFields({ name: 'Type Breakdown', value: typeStatsText, inline: false });
                }
            }

            // Add active punishments if any
            if (stealStats.activePunishments && stealStats.activePunishments.length > 0) {
                const punishmentsText = stealStats.activePunishments
                    .map(p => `${punishmentEmojis[p.type] || '⚠️'} ${p.description} (${p.severity})`)
                    .join('\n');
                embed.addFields({ name: 'Active Punishments', value: punishmentsText, inline: false });
            }

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
        const stealType = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('target');
        const rarity = interaction.options.getString('rarity');
        const start = Date.now();

        try {
            const requestBody = {
                targetDiscordId: targetUser.id,
                stealType: stealType
            };

            if (rarity) {
                requestBody.rarity = rarity;
            }

            const response = await axios.post(
                `${process.env.BACKEND_API_URL}/users/${interaction.user.id}/steal`,
                requestBody,
                {
                    headers: {
                        'x-guild-id': interaction.guildId
                    }
                }
            );

            const duration = Date.now() - start;

            const {
                success, stolenItems, stolenAmount, totalValue, newBalance, newCollectionValue,
                punishment, bailInfo, jailInfo, buffMessage, stealType: responseStealType
            } = response.data;

            if (success) {
                const embed = createSuccessEmbed(`${typeEmojis[stealType]} Steal Successful!`)
                    .addFields(
                        { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Type', value: stealType.charAt(0).toUpperCase() + stealType.slice(1), inline: true }
                    );

                if (stealType === 'points') {
                    embed.addFields(
                        { name: 'Amount Stolen', value: `${stolenAmount.toLocaleString('en-US')} points`, inline: true },
                        { name: 'New Balance', value: `${newBalance.toLocaleString('en-US')} points`, inline: true }
                    );
                } else if (stolenItems && stolenItems.length > 0) {
                    const itemsText = stolenItems.map(item => 
                        `${rarityEmojis[item.rarity] || '⚪'} **${item.name}** (x${item.count}) - ${item.value.toLocaleString('en-US')} pts`
                    ).join('\n');
                    embed.addFields(
                        { name: 'Items Stolen', value: itemsText, inline: false },
                        { name: 'Total Value', value: `${totalValue.toLocaleString('en-US')} points`, inline: true },
                        { name: 'New Collection Value', value: `${(newCollectionValue || totalValue).toLocaleString('en-US')} points`, inline: true }
                    );
                }

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
                const embed = createErrorEmbed(`${punishmentEmojis[punishment?.type] || '🚔'} Steal Failed!`)
                    .setColor(0xffa500)
                    .addFields(
                        { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Type', value: stealType.charAt(0).toUpperCase() + stealType.slice(1), inline: true }
                    );

                if (punishment) {
                    const punishmentText = `${punishmentEmojis[punishment.type] || '⚠️'} **${punishment.type.toUpperCase()}** (${punishment.severity})`;
                    if (punishment.description) {
                        embed.addFields({ 
                            name: 'Punishment', 
                            value: `${punishmentText}\n${punishment.description}`, 
                            inline: false 
                        });
                    } else {
                        embed.addFields({ name: 'Punishment', value: punishmentText, inline: false });
                    }
                    
                    // Add jail time if jailed
                    if (punishment.type === 'jail' && jailInfo) {
                        const jailText = `⏰ **Jail Time:** ${jailInfo.minutes} minutes`;
                        embed.addFields({ 
                            name: 'Jail Time', 
                            value: jailText, 
                            inline: false 
                        });
                    }
                    
                    // Add bail information if jailed
                    if (punishment.type === 'jail' && bailInfo) {
                        const bailText = `💰 **Bail Amount:** ${bailInfo.bailAmount.toLocaleString('en-US')} points`;
                        const additionalJailText = bailInfo.additionalJailTime > 0 ? 
                            `\n⏰ **Additional Jail Time:** +${bailInfo.additionalJailTime} minutes` : '';
                        embed.addFields({ 
                            name: 'Bail Information', 
                            value: bailText + additionalJailText, 
                            inline: false 
                        });
                    }
                }

                if (buffMessage) {
                    embed.addFields({ name: 'Buff Used', value: buffMessage, inline: false });
                }

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
                } else if (msg.includes('no') && msg.includes('to steal')) {
                    errorEmbed.setDescription(`📦 ${error.response.data.message}`);
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