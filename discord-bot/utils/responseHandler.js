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

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
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

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [successEmbed] });
        } else {
            await interaction.reply({ embeds: [successEmbed] });
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

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [infoEmbed] });
        } else {
            await interaction.reply({ embeds: [infoEmbed] });
        }
    }
}

module.exports = ResponseHandler; 