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
    .addStringOption(option =>
      option.setName('count')
        .setDescription('How many to sell')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const type = interaction.options.getString('type');
      const nameRaw = interaction.options.getString('name');
      const countRaw = interaction.options.getString('count');
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;

      // Support comma-separated lists for bulk sell
      const nameList = nameRaw.split(',').map(s => s.trim()).filter(Boolean);
      const countList = countRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      let typeList = [type];
      if (type.includes(',')) {
        typeList = type.split(',').map(s => s.trim());
      }
      // If multiple names/counts, build items array
      let items = [];
      if (nameList.length > 1 || countList.length > 1 || typeList.length > 1) {
        // If only one type, repeat it for all names
        if (typeList.length === 1) {
          typeList = Array(nameList.length).fill(typeList[0]);
        }
        for (let i = 0; i < nameList.length; i++) {
          items.push({
            type: typeList[i] || typeList[0],
            name: nameList[i],
            count: countList[i] || countList[0] || 1
          });
        }
      }

      if (items.length > 0) {
        // Bulk sell
        console.log('[SELL] Payload to backend:', { items, guildId });
        const response = await axios.post(`${backendUrl}/users/${userId}/sell`, { items, guildId }, { headers: { 'x-guild-id': guildId } });
        const { results, newBalance } = response.data;
        const fields = results.map(r => {
          if (r.success) {
            return {
              name: `✅ Sold ${r.count}x ${r.name} (${r.type})`,
              value: `+${r.value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points`,
              inline: false
            };
          } else {
            return {
              name: `❌ ${r.name} (${r.type})`,
              value: r.error || 'Unknown error',
              inline: false
            };
          }
        });
        const embed = {
          color: 0x27ae60,
          title: '🪙 Sell Result',
          description: 'Bulk sell summary:',
          fields: fields.length > 0 ? fields : [{ name: 'No items processed', value: 'Nothing was sold.' }],
          footer: { text: `New Balance: ${newBalance?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points` },
          timestamp: new Date()
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Fallback: single item logic
      // Fetch inventory to validate (case-insensitive name check)
      const invRes = await axios.get(`${backendUrl}/users/${userId}/collection`, { params: { guildId }, headers: { 'x-guild-id': guildId } });
      const inventory = invRes.data.inventory || [];
      const item = inventory.find(i => i.type === type && i.name.toLowerCase() === nameRaw.toLowerCase()); // Case-insensitive check

      if (!item) {
        await ResponseHandler.handleError(interaction, { message: 'You do not own this item.' }, 'Sell');
        return;
      }
      if (item.count < (countList[0] || 1)) {
        await ResponseHandler.handleError(interaction, { message: `You only own ${item.count} of this item.` }, 'Sell');
        return;
      }

      // Call backend to sell
      console.log('[SELL] Payload to backend:', { type, name: item.name, count: countList[0] || 1, guildId });
      const response = await axios.post(`${backendUrl}/users/${userId}/sell`, { type, name: item.name, count: countList[0] || 1, guildId }, { headers: { 'x-guild-id': guildId } });
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