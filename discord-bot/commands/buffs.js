const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buffs')
    .setDescription('View your active buffs and their remaining time/uses.'),

  async execute(interaction) {
    logger.info('[BUFFS] Command started');
    try {
      logger.info('[BUFFS] Deferring reply');
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      const backendUrl = process.env.BACKEND_API_URL;
      
      logger.info('[BUFFS] Environment check', { 
        hasBackendUrl: !!backendUrl,
        userId,
        guildId
      });

      if (!backendUrl) {
        logger.error('[BUFFS] Backend URL not configured');
        await interaction.editReply('Backend URL is not configured. Please contact an admin.');
        return;
      }

      const url = `${backendUrl}/users/${userId}/buffs`;
      logger.info('[BUFFS] Making request to:', url);

      let response;
      try {
        response = await axios.get(url, {
          headers: { 'x-guild-id': guildId },
          timeout: 4000 // 4 seconds
        });
        logger.info('[BUFFS] Received response from backend');
      } catch (err) {
        logger.error('[BUFFS] Backend request failed:', {
          error: err.message,
          code: err.code,
          response: err.response?.data
        });

        if (err.code === 'ECONNABORTED') {
          await interaction.editReply('The backend did not respond in time. Please try again later.');
        } else if (err.response?.data?.message) {
          await interaction.editReply(`Error: ${err.response.data.message}`);
        } else {
          await interaction.editReply('Could not reach the backend. Please try again later.');
        }
        return;
      }

      logger.info('[BUFFS] Processing response data');
      const { buffs } = response.data;
      
      if (!buffs || buffs.length === 0) {
        logger.info('[BUFFS] No active buffs found');
        const embed = {
          color: 0x8e44ad,
          title: '🎭 Active Buffs',
          description: 'You have no active buffs.',
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      logger.info('[BUFFS] Creating embed with buffs:', { count: buffs.length });
      const fields = buffs.map(buff => {
        let value = '';
        if (buff.expiresAt) {
          const timeLeft = Math.max(0, new Date(buff.expiresAt) - new Date());
          const minutes = Math.floor(timeLeft / (60 * 1000));
          const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
          value = `Expires in: ${minutes}m ${seconds}s`;
        } else if (buff.usesLeft) {
          value = `Uses left: ${buff.usesLeft}`;
        }
        return { name: buff.description, value };
      });

      const embed = {
        color: 0x8e44ad,
        title: '🎭 Active Buffs',
        description: 'Your current active buffs:',
        fields,
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };

      logger.info('[BUFFS] Sending response to Discord');
      await interaction.editReply({ embeds: [embed] });
      logger.info('[BUFFS] Command completed successfully');
      return;
    } catch (error) {
      logger.error('[BUFFS] Unexpected error:', {
        error: error.message,
        stack: error.stack
      });
      
      try {
        await ResponseHandler.handleError(interaction, error, 'Buffs');
      } catch (err2) {
        logger.error('[BUFFS] Error handler failed:', {
          error: err2.message,
          stack: err2.stack
        });
        await interaction.editReply('An unexpected error occurred while processing your request.');
      }
      return;
    }
  }
}; 