const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const moment = require('moment');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transactions')
        .setDescription('View your transaction history')
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of transactions to show (default: 10)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Filter transactions by type')
                .setRequired(false)
                .addChoices(
                    { name: 'All', value: 'all' },
                    { name: 'Bets', value: 'bet' },
                    { name: 'Daily Bonus', value: 'daily' },
                    { name: 'Gifts', value: 'gift' }
                )),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const userId = interaction.user.id;
            const limit = interaction.options.getInteger('limit') || 10;
            const type = interaction.options.getString('type') || 'all';

            logger.info(`Fetching transactions for user ${userId} with limit ${limit} and type ${type}`);

            const response = await axios.get(`${process.env.BACKEND_API_URL}/users/${userId}/transactions`, {
                params: { limit, type }
            });

            const transactions = response.data;

            if (transactions.length === 0) {
                await ResponseHandler.handleInfo(interaction, 'No transactions found.');
                return;
            }

            const embed = {
                color: 0x0099FF,
                title: 'Transaction History',
                description: `Showing last ${transactions.length} transactions`,
                fields: transactions.map(tx => ({
                    name: `${tx.type.toUpperCase()} - ${moment(tx.timestamp).format('MMM D, YYYY HH:mm')}`,
                    value: `Amount: ${tx.amount} points\nDescription: ${tx.description || 'No description'}`,
                    inline: false
                })),
                timestamp: new Date(),
                footer: {
                    text: `Requested by ${interaction.user.tag}`
                }
            };

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Error in transaction history command:', error);
            await ResponseHandler.handleError(interaction, error, 'Transaction History');
        }
    },
}; 