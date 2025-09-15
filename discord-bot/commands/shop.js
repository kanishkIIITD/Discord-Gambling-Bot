const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { getEmoji } = require('../utils/emojiConfig');

const SHOP_ITEMS = [
  { key: 'rare', name: '5x Great Poké Balls', emoji: 'pokeball_great', level: 5, price: 250, effect: '1.75x catch rate', cooldownField: 'poke_rareball_ts' },
  { key: 'ultra', name: '3x Ultra Poké Balls', emoji: 'pokeball_ultra', level: 10, price: 225, effect: '2x catch rate', cooldownField: 'poke_ultraball_ts' },
  { key: 'xp', name: '6x XP Booster', emoji: null, level: 15, price: 100, effect: '2x XP (1 battle/catch)', cooldownField: 'poke_xp_booster_ts' },
  { key: 'evolution', name: "Evolver's Ring", emoji: null, level: 20, price: 200, effect: 'Evolve with duplicates', cooldownField: 'poke_daily_ring_ts' },
  // EV-boosting items
  { key: 'hp_up', name: '4x HP Up', emoji: null, level: 25, price: 150, effect: '+10 HP EVs (max 252)', cooldownField: 'poke_hp_up_ts' },
  { key: 'protein', name: '4x Protein', emoji: 'protein', level: 25, price: 150, effect: '+10 Attack EVs (max 252)', cooldownField: 'poke_protein_ts' },
  { key: 'iron', name: '4x Iron', emoji: 'iron', level: 25, price: 150, effect: '+10 Defense EVs (max 252)', cooldownField: 'poke_iron_ts' },
  { key: 'calcium', name: '4x Calcium', emoji: 'calcium', level: 25, price: 150, effect: '+10 Sp. Attack EVs (max 252)', cooldownField: 'poke_calcium_ts' },
  { key: 'zinc', name: '4x Zinc', emoji: 'zinc', level: 25, price: 150, effect: '+10 Sp. Defense EVs (max 252)', cooldownField: 'poke_zinc_ts' },
  { key: 'carbos', name: '4x Carbos', emoji: 'carbos', level: 25, price: 150, effect: '+10 Speed EVs (max 252)', cooldownField: 'poke_carbos_ts' },
  { key: 'rare_candy', name: '3x Rare Candy', emoji: 'rarecandy', level: 30, price: 500, effect: '+4 EVs to all stats (max 252 each)', cooldownField: 'poke_rare_candy_ts' },
  { key: 'master_ball', name: '1 Effort Candy', emoji: null, level: 35, price: 1000, effect: '+8 EVs to all stats (max 252 each)', cooldownField: 'poke_master_ball_ts' },
  // Form evolution item
  { key: 'form_stone', name: 'Form Stone', emoji: null, level: 35, price: 3000, effect: 'Transform any Pokémon to its special form', cooldownField: 'poke_form_stone_ts' },
  { key: 'masterball', name: '1 Master Poké Ball', emoji: 'pokeball_master', level: 40, price: 5000, effect: '100% catch rate', cooldownField: 'poke_masterball_ts' },
  { key: 'reset_bag', name: '1 Reset Bag', emoji: null, level: 20, price: 300, effect: 'Reset all EVs to 0', cooldownField: 'poke_reset_bag_ts' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokeshop')
    .setDescription('View and buy special progression items (Poké Balls, XP Booster, Evolver\'s Ring)!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;
    let user;
    try {
      // Fetch user info to get level, stardust, and cooldowns
      const userRes = await axios.get(`${backendUrl}/users/${userId}`, { headers: { 'x-guild-id': guildId } });
      user = userRes.data.user || userRes.data;
    } catch (e) {
      return interaction.editReply('Failed to fetch your user data. Please try again later.');
    }
    const now = Date.now();
    // --- XP to next level calculation (match backend helpers) ---
    const currentXp = user.poke_xp || 0;
    const currentLevel = user.poke_level || 1;
    const getNextLevelXp = (level) => {
      if (level <= 1) return 0;
      // sum_{i=2..level} 100*i = 100 * (level(level+1)/2 - 1)
      return Math.floor(100 * ((level * (level + 1)) / 2 - 1));
    };
    const xpForCurrentLevel = getNextLevelXp(currentLevel);
    const xpForNextLevel = getNextLevelXp(currentLevel + 1);
    const xpThisLevel = currentXp - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    // Build shop embed
    const embed = new EmbedBuilder()
      .setTitle('🛒 Poké Shop')
      .setDescription('Buy special items with Stardust!')
      .setColor(0x3498db)
      .addFields(
        { name: 'Your Level', value: String(currentLevel), inline: true },
        { name: 'Stardust', value: String(user.poke_stardust || 0), inline: true },
        { name: 'XP to level up', value: `${xpThisLevel} / ${xpNeeded}`, inline: true },
      );
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;
    
    SHOP_ITEMS.forEach((item, idx) => {
      const unlocked = (user.poke_level || 1) >= item.level;
      const lastTs = user[item.cooldownField];
      let cooldownMsg = '';
      // Calculate cooldown based on item type
      let cooldownHours = 12; // Default cooldown
      
      // Set different cooldowns for EV items
      if (item.key.includes('_')) {
        if (item.key === 'rare_candy') cooldownHours = 4;
        else if (item.key === 'master_ball') cooldownHours = 4; // Effort Candy
        else if (item.key === 'reset_bag') cooldownHours = 48;
        else cooldownHours = 4; // Vitamins: 4 hours
      }
      
      // Special cooldown for Evolver's Ring (12 hours)
      if (item.key === 'evolution') {
        cooldownHours = 12; // 12 hours
      }
      
      // Special cooldown for Master Poké Ball (7 days)
      if (item.key === 'masterball') {
        cooldownHours = 24 * 7; // 7 days
      }
      
      if (lastTs && now - new Date(lastTs).getTime() < cooldownHours * 60 * 60 * 1000) {
        const msLeft = cooldownHours * 60 * 60 * 1000 - (now - new Date(lastTs).getTime());
        const hours = Math.floor(msLeft / 3600000);
        const mins = Math.floor((msLeft % 3600000) / 60000);
        cooldownMsg = `Cooldown: ${hours}h ${mins}m left`;
      }
      embed.addFields({
        name: `${item.name} (Lvl ${item.level}+) — ${item.price} Stardust`,
        value: `${item.effect}\n${unlocked ? (cooldownMsg || 'Available!') : '🔒 Locked'}${!unlocked ? '' : (user.poke_stardust < item.price ? '\n❌ Not enough Stardust' : '')}`,
        inline: false
      });
      
      // Create button
      const button = new ButtonBuilder()
          .setCustomId(`shop_buy_${item.key}`)
          .setLabel(`Buy ${item.name}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!unlocked || (user.poke_stardust < item.price) || !!cooldownMsg);
      if (item.emoji) {
        button.setEmoji(getEmoji(item.emoji));
      }
      
      // Add button to current row
      currentRow.addComponents(button);
      buttonCount++;
      
      // If we've reached 5 buttons or this is the last item, add the row
      if (buttonCount === 5 || idx === SHOP_ITEMS.length - 1) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
        buttonCount = 0;
      }
    });
    await interaction.editReply({ embeds: [embed], components: rows });
    // Button collector for buy actions
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id && i.customId.startsWith('shop_buy_'),
      time: 60000
    });
    
    // Track which buttons have been clicked
    const clickedButtons = new Set();
    
    collector.on('collect', async i => {
      const itemKey = i.customId.replace('shop_buy_', '');
      
      // Check if button was already clicked
      if (clickedButtons.has(itemKey)) {
        await i.reply({ content: '❌ You already purchased this item!', ephemeral: true });
        return;
      }
      
      await i.deferUpdate();
      
      try {
        const res = await axios.post(`${backendUrl}/users/${userId}/shop/buy`, { item: itemKey }, { headers: { 'x-guild-id': guildId } });
        
        // Mark button as clicked
        clickedButtons.add(itemKey);
        
        // Disable the specific button that was clicked
        rows.forEach(row => {
          row.components.forEach(btn => {
            if (btn.data.custom_id === i.customId) {
              btn.setDisabled(true);
              btn.setLabel('✅ Purchased');
            }
          });
        });
        
        // Refresh user data to get updated stardust and cooldowns
        try {
          const userRes = await axios.get(`${backendUrl}/users/${userId}`, { headers: { 'x-guild-id': guildId } });
          user = userRes.data.user || userRes.data;
          
          // Update embed with new stardust balance
          const currentXp = user.poke_xp || 0;
          const currentLevel = user.poke_level || 1;
          const xpForCurrentLevel = getNextLevelXp(currentLevel);
          const xpForNextLevel = getNextLevelXp(currentLevel + 1);
          const xpThisLevel = currentXp - xpForCurrentLevel;
          const xpNeeded = xpForNextLevel - xpForCurrentLevel;
          
          embed.spliceFields(0, 3, 
            { name: 'Your Level', value: String(currentLevel), inline: true },
            { name: 'Stardust', value: String(user.poke_stardust || 0), inline: true },
            { name: 'XP to level up', value: `${xpThisLevel} / ${xpNeeded}`, inline: true }
          );
          
          // Update button states based on new data
          rows.forEach((row, rowIndex) => {
            row.components.forEach((btn, btnIndex) => {
              const itemKey = btn.data.custom_id.replace('shop_buy_', '');
              const item = SHOP_ITEMS.find(item => item.key === itemKey);
              
              if (item) {
                const unlocked = (user.poke_level || 1) >= item.level;
                const lastTs = user[item.cooldownField];
                let cooldownMsg = '';
                
                // Calculate cooldown based on item type
                let cooldownHours = 12; // Default cooldown
                
                // Set different cooldowns for EV items
                if (item.key.includes('_')) {
                  if (item.key === 'rare_candy') cooldownHours = 4;
                  else if (item.key === 'master_ball') cooldownHours = 4; // Effort Candy
                  else if (item.key === 'reset_bag') cooldownHours = 48;
                  else cooldownHours = 4; // Vitamins: 4 hours
                }
                
                // Special cooldown for Evolver's Ring (12 hours)
                if (item.key === 'evolution') {
                  cooldownHours = 12; // 12 hours
                }
                
                // Special cooldown for Master Poké Ball (7 days)
                if (item.key === 'masterball') {
                  cooldownHours = 24 * 7; // 7 days
                }
                
                if (lastTs && now - new Date(lastTs).getTime() < cooldownHours * 60 * 60 * 1000) {
                  const msLeft = cooldownHours * 60 * 60 * 1000 - (now - new Date(lastTs).getTime());
                  const hours = Math.floor(msLeft / 3600000);
                  const mins = Math.floor((msLeft % 3600000) / 60000);
                  cooldownMsg = `Cooldown: ${hours}h ${mins}m left`;
                }
                
                // Only update if not already clicked
                if (!clickedButtons.has(itemKey)) {
                  btn.setDisabled(!unlocked || (user.poke_stardust < item.price) || !!cooldownMsg);
                }
              }
            });
          });
        } catch (refreshError) {
          console.error('Failed to refresh user data:', refreshError);
        }
        
        // Update the message with disabled button and refreshed data
        await interaction.editReply({ embeds: [embed], components: rows });
        
        await i.followUp({ content: `✅ ${res.data.message}`, ephemeral: true });
        
      } catch (e) {
        const msg = e.response?.data?.message || 'Failed to buy item.';
        await i.followUp({ content: `❌ ${msg}`, ephemeral: true });
      }
    });
    
    collector.on('end', () => {
      // Disable all remaining buttons after timeout
      rows.forEach(row => {
        row.components.forEach(btn => {
          if (!clickedButtons.has(btn.data.custom_id.replace('shop_buy_', ''))) {
            btn.setDisabled(true);
          }
        });
      });
      interaction.editReply({ components: rows }).catch(() => {});
    });
  }
}; 