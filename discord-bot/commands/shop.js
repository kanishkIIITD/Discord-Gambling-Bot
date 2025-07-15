const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const SHOP_ITEMS = [
  { key: 'rare', name: 'Rare Poké Ball', level: 5, price: 150, effect: '1.25x catch rate', cooldownField: 'poke_rareball_ts' },
  { key: 'ultra', name: 'Ultra Poké Ball', level: 10, price: 200, effect: '1.5x catch rate', cooldownField: 'poke_ultraball_ts' },
  { key: 'xp', name: 'XP Booster', level: 15, price: 100, effect: '2x XP (1 battle/catch)', cooldownField: 'poke_xp_booster_ts' },
  { key: 'evolution', name: "Evolver's Ring", level: 20, price: 200, effect: 'Evolve with duplicates', cooldownField: 'poke_daily_ring_ts' },
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
      if (level <= 1) return 100;
      let xp = 100;
      for (let i = 2; i <= level; i++) {
        xp = Math.round(xp * 1.4);
      }
      return xp;
    }
    const nextLevelXp = getNextLevelXp(currentLevel);
    // Build shop embed
    const embed = new EmbedBuilder()
      .setTitle('🛒 Poké Shop')
      .setDescription('Buy special items with Stardust!')
      .setColor(0x3498db)
      .addFields(
        { name: 'Your Level', value: String(currentLevel), inline: true },
        { name: 'Stardust', value: String(user.poke_stardust || 0), inline: true },
        { name: 'XP to level up', value: `${currentXp} / ${nextLevelXp}`, inline: true },
      );
    const rows = [new ActionRowBuilder()];
    SHOP_ITEMS.forEach((item, idx) => {
      const unlocked = (user.poke_level || 1) >= item.level;
      const lastTs = user[item.cooldownField];
      let cooldownMsg = '';
      if (lastTs && now - new Date(lastTs).getTime() < 24 * 60 * 60 * 1000) {
        const msLeft = 24 * 60 * 60 * 1000 - (now - new Date(lastTs).getTime());
        const hours = Math.floor(msLeft / 3600000);
        const mins = Math.floor((msLeft % 3600000) / 60000);
        cooldownMsg = `Cooldown: ${hours}h ${mins}m left`;
      }
      embed.addFields({
        name: `${item.name} (Lvl ${item.level}+) — ${item.price} Stardust`,
        value: `${item.effect}\n${unlocked ? (cooldownMsg || 'Available!') : '🔒 Locked'}${!unlocked ? '' : (user.poke_stardust < item.price ? '\n❌ Not enough Stardust' : '')}`,
        inline: false
      });
      rows[0].addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_buy_${item.key}`)
          .setLabel(`Buy ${item.name}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!unlocked || (user.poke_stardust < item.price) || !!cooldownMsg)
      );
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
      rows[0].components.forEach(btn => btn.setDisabled(true));
      interaction.editReply({ components: rows }).catch(() => {});
    });
  }
}; 