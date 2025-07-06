const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

class ResponseHandler {
    static async handleError(interaction, error, context = '') {
        logger.error(`Error in ${context}:`, error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Error')
            .setDescription('An error occurred while processing your request.')
            .addFields(
                { name: 'Context', value: context || 'Unknown' },
                { name: 'Error', value: error.message || 'Unknown error' }
            )
            .setTimestamp();

        try {
            // Check if interaction exists and is valid
            if (!interaction) {
                logger.error('Interaction object is null or undefined');
                return;
            }

            // Handle different interaction states
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else if (!interaction.replied && interaction.reply) {
                // If not replied and can reply directly
                await interaction.reply({ embeds: [errorEmbed] });
            } else if (interaction.followUp) {
                // Last resort - try followUp if the method exists
                await interaction.followUp({ embeds: [errorEmbed] });
            } else {
                logger.error('Could not respond to interaction - no valid response method available');
            }
        } catch (err) {
            logger.error('Failed to send error reply:', err);
        }
    }

    static async handleSuccess(interaction, message, data = null) {
        const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Success')
            .setDescription(message)
            .setTimestamp();

        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                successEmbed.addFields({ name: key, value: value.toString() });
            });
        }

        try {
            // Check if interaction exists and is valid
            if (!interaction) {
                logger.error('Interaction object is null or undefined');
                return;
            }

            // Handle different interaction states
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ embeds: [successEmbed] });
            } else if (!interaction.replied && interaction.reply) {
                // If not replied and can reply directly
                await interaction.reply({ embeds: [successEmbed] });
            } else if (interaction.followUp) {
                // Last resort - try followUp if the method exists
                await interaction.followUp({ embeds: [successEmbed] });
            } else {
                logger.error('Could not respond to interaction - no valid response method available');
            }
        } catch (err) {
            logger.error('Failed to send success reply:', err);
        }
    }

    static async handleInfo(interaction, message, data = null) {
        const infoEmbed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('Information')
            .setDescription(message)
            .setTimestamp();

        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                infoEmbed.addFields({ name: key, value: value.toString() });
            });
        }

        try {
            // Check if interaction exists and is valid
            if (!interaction) {
                logger.error('Interaction object is null or undefined');
                return;
            }

            // Handle different interaction states
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ embeds: [infoEmbed] });
            } else if (!interaction.replied && interaction.reply) {
                // If not replied and can reply directly
                await interaction.reply({ embeds: [infoEmbed] });
            } else if (interaction.followUp) {
                // Last resort - try followUp if the method exists
                await interaction.followUp({ embeds: [infoEmbed] });
            } else {
                logger.error('Could not respond to interaction - no valid response method available');
            }
        } catch (err) {
            logger.error('Failed to send info reply:', err);
        }
    }
}

module.exports = ResponseHandler;