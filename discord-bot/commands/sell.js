const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('Sell an item from your collection for points!')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of item (fish or animal)')
        .setRequired(true)
        .addChoices(
          { name: 'Fish', value: 'fish' },
          { name: 'Animal', value: 'animal' }
        )
    )
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the item to sell')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('How many to sell')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const type = interaction.options.getString('type');
      const name = interaction.options.getString('name');
      const count = interaction.options.getInteger('count');
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;

      // Fetch inventory to validate (case-insensitive name check)
      const invRes = await axios.get(`${backendUrl}/users/${userId}/collection`, { params: { guildId }, headers: { 'x-guild-id': guildId } });
      const inventory = invRes.data.inventory || [];
      const item = inventory.find(i => i.type === type && i.name.toLowerCase() === name.toLowerCase()); // Case-insensitive check

      if (!item) {
        await ResponseHandler.handleError(interaction, { message: 'You do not own this item.' }, 'Sell');
        return;
      }
      if (item.count < count) {
        await ResponseHandler.handleError(interaction, { message: `You only own ${item.count} of this item.` }, 'Sell');
        return;
      }

      // Call backend to sell
      const response = await axios.post(`${backendUrl}/users/${userId}/sell`, { type, name: item.name, count, guildId }, { headers: { 'x-guild-id': guildId } }); // Use the exact item.name from inventory
      const { message, newBalance } = response.data;

      const embed = {
        color: 0x27ae60,
        title: '🪙 Sell Result',
        description: message,
        fields: [
          { name: 'New Balance', value: `${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`, inline: true }
        ],
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in /sell command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Sell');
        return;
      } else {
        await ResponseHandler.handleError(interaction, error, 'Sell');
        return;
      }
    }
  },
}; 