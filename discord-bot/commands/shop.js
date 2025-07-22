const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const SHOP_ITEMS = [
  { key: 'rare', name: '5 Rare Poké Balls', level: 5, price: 250, effect: '1.25x catch rate', cooldownField: 'poke_rareball_ts' },
  { key: 'ultra', name: '3 Ultra Poké Balls', level: 10, price: 225, effect: '1.5x catch rate', cooldownField: 'poke_ultraball_ts' },
  { key: 'xp', name: 'XP Booster', level: 15, price: 100, effect: '2x XP (1 battle/catch)', cooldownField: 'poke_xp_booster_ts' },
  { key: 'evolution', name: "Evolver's Ring", level: 20, price: 200, effect: 'Evolve with duplicates', cooldownField: 'poke_daily_ring_ts' },
  // EV-boosting items
  { key: 'hp_up', name: 'HP Up', level: 25, price: 150, effect: '+10 HP EVs (max 252)', cooldownField: 'poke_hp_up_ts' },
  { key: 'protein', name: 'Protein', level: 25, price: 150, effect: '+10 Attack EVs (max 252)', cooldownField: 'poke_protein_ts' },
  { key: 'iron', name: 'Iron', level: 25, price: 150, effect: '+10 Defense EVs (max 252)', cooldownField: 'poke_iron_ts' },
  { key: 'calcium', name: 'Calcium', level: 25, price: 150, effect: '+10 Sp. Attack EVs (max 252)', cooldownField: 'poke_calcium_ts' },
  { key: 'zinc', name: 'Zinc', level: 25, price: 150, effect: '+10 Sp. Defense EVs (max 252)', cooldownField: 'poke_zinc_ts' },
  { key: 'carbos', name: 'Carbos', level: 25, price: 150, effect: '+10 Speed EVs (max 252)', cooldownField: 'poke_carbos_ts' },
  { key: 'rare_candy', name: 'Rare Candy', level: 30, price: 500, effect: '+4 EVs to all stats (max 252 each)', cooldownField: 'poke_rare_candy_ts' },
  { key: 'master_ball', name: 'Master Ball', level: 35, price: 1000, effect: '+8 EVs to all stats (max 252 each)', cooldownField: 'poke_master_ball_ts' },
  { key: 'reset_bag', name: 'Reset Bag', level: 20, price: 300, effect: 'Reset all EVs to 0', cooldownField: 'poke_reset_bag_ts' },
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
    // --- XP to next level calculation ---
    const currentXp = user.poke_xp || 0;
    const currentLevel = user.poke_level || 1;
    // Replicate backend getNextLevelXp logic
    function getNextLevelXp(level) {
      if (level <= 1) return 0;
      // XP required to reach this level (cumulative): sum of 100 * i for i = 2 to level
      let xp = 0;
      for (let i = 2; i <= level; i++) {
        xp += 100 * i;
      }
      return xp;
    }
    // Fix: For level 1, xpForCurrentLevel should be 0
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
        if (item.key === 'rare_candy') cooldownHours = 12;
        else if (item.key === 'master_ball') cooldownHours = 24;
        else if (item.key === 'reset_bag') cooldownHours = 48;
        else cooldownHours = 6; // Vitamins: 6 hours
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
    collector.on('collect', async i => {
      const itemKey = i.customId.replace('shop_buy_', '');
      await i.deferUpdate();
      try {
        const res = await axios.post(`${backendUrl}/users/${userId}/shop/buy`, { item: itemKey }, { headers: { 'x-guild-id': guildId } });
        await interaction.followUp({ content: `✅ ${res.data.message}`, ephemeral: true });
      } catch (e) {
        const msg = e.response?.data?.message || 'Failed to buy item.';
        await interaction.followUp({ content: `❌ ${msg}`, ephemeral: true });
      }
      collector.stop();
    });
    collector.on('end', () => {
      // Disable buttons after timeout
      rows.forEach(row => {
        row.components.forEach(btn => btn.setDisabled(true));
      });
      interaction.editReply({ components: rows }).catch(() => {});
    });
  }
}; 