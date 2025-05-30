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
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
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
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ embeds: [successEmbed] });
            } else {
                await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
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
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ embeds: [infoEmbed] });
            } else {
                await interaction.followUp({ embeds: [infoEmbed], ephemeral: true });
            }
        } catch (err) {
            logger.error('Failed to send info reply:', err);
        }
    }
}

module.exports = ResponseHandler; 