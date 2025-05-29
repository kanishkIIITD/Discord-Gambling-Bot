const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Gift or trade an item from your collection to another user!')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to trade with')
        .setRequired(true)
    )
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
        .setDescription('Name of the item to trade (case-sensitive)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('How many to trade')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const target = interaction.options.getUser('user');
      const type = interaction.options.getString('type');
      const name = interaction.options.getString('name');
      const count = interaction.options.getInteger('count');
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;
      // Optionally: fetch inventory to validate
      const invRes = await axios.get(`${backendUrl}/users/${userId}/collection`, { params: { guildId }, headers: { 'x-guild-id': guildId } });
      const inventory = invRes.data.inventory || [];
      const item = inventory.find(i => i.type === type && i.name === name);
      if (!item) {
        await ResponseHandler.handleError(interaction, { message: 'You do not own this item.' }, 'Trade');
        return;
      }
      if (item.count < count) {
        await ResponseHandler.handleError(interaction, { message: `You only own ${item.count} of this item.` }, 'Trade');
        return;
      }
      // Call backend to trade
      const response = await axios.post(`${backendUrl}/users/${userId}/trade`, { targetDiscordId: target.id, type, name, count, guildId }, { headers: { 'x-guild-id': guildId } });
      const { message } = response.data;
      const embed = {
        color: 0x00b894,
        title: '🔄 Trade Result',
        description: message,
        fields: [
          { name: 'Recipient', value: `<@${target.id}>`, inline: true },
          { name: 'Item', value: `${count}x ${name} (${type})`, inline: true }
        ],
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in /trade command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Trade');
        return;
      } else {
        await ResponseHandler.handleError(interaction, error, 'Trade');
        return;
      }
    }
  },
}; 