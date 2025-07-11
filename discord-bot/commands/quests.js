const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const DAILY_GOALS = { catch: 10, battle: 3, evolve: 2 };
const WEEKLY_GOALS = { catch: 50, battle: 15, evolve: 7 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokequests')
    .setDescription('View your daily and weekly Pokémon quest progress and claim rewards!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;
    let user;
    try {
      const res = await axios.get(`${backendUrl}/users/${userId}`, { headers: { 'x-guild-id': guildId } });
      user = res.data.user || res.data;
    } catch (e) {
      return interaction.editReply('Failed to fetch your user data. Please try again later.');
    }
    // Build quest progress embed
    const daily = [
      `Catch: ${user.poke_quest_daily_catch || 0} / ${DAILY_GOALS.catch}`,
      `Battle Wins: ${user.poke_quest_daily_battle || 0} / ${DAILY_GOALS.battle}`,
      `Evolve: ${user.poke_quest_daily_evolve || 0} / ${DAILY_GOALS.evolve}`
    ];
    const weekly = [
      `Catch: ${user.poke_quest_weekly_catch || 0} / ${WEEKLY_GOALS.catch}`,
      `Battle Wins: ${user.poke_quest_weekly_battle || 0} / ${WEEKLY_GOALS.battle}`,
      `Evolve: ${user.poke_quest_weekly_evolve || 0} / ${WEEKLY_GOALS.evolve}`
    ];
    const embed = new EmbedBuilder()
      .setTitle('Pokémon Quests')
      .setDescription('Complete daily and weekly quests for rewards!')
      .addFields(
        { name: 'Daily Quests', value: daily.join('\n'), inline: false },
        { name: 'Status', value: user.poke_quest_daily_completed ? (user.poke_quest_daily_claimed ? '✅ Claimed' : '✅ Completed! Claim your reward!') : '❌ Incomplete', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: 'Weekly Quests', value: weekly.join('\n'), inline: false },
        { name: 'Status', value: user.poke_quest_weekly_completed ? (user.poke_quest_weekly_claimed ? '✅ Claimed' : '✅ Completed! Claim your reward!') : '❌ Incomplete', inline: true }
      )
      .setColor(0x3498db);
    // Add claim buttons (always show, but disable if not eligible)
    const dailyEligible = user.poke_quest_daily_completed && !user.poke_quest_daily_claimed;
    const weeklyEligible = user.poke_quest_weekly_completed && !user.poke_quest_weekly_claimed;
    const dailyButton = new ButtonBuilder()
      .setCustomId('claim_daily')
      .setLabel(
        user.poke_quest_daily_claimed ? 'Daily Claimed' : (user.poke_quest_daily_completed ? 'Claim Daily Reward' : 'Daily Incomplete')
      )
      .setStyle(ButtonStyle.Success)
      .setDisabled(!dailyEligible);
    const weeklyButton = new ButtonBuilder()
      .setCustomId('claim_weekly')
      .setLabel(
        user.poke_quest_weekly_claimed ? 'Weekly Claimed' : (user.poke_quest_weekly_completed ? 'Claim Weekly Reward' : 'Weekly Incomplete')
      )
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!weeklyEligible);
    const row = new ActionRowBuilder().addComponents(dailyButton, weeklyButton);
    await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    if (!row) return;
    // Button collector for claim actions
    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This button is not for you!', ephemeral: true });
      }
      if (i.customId === 'claim_daily') {
        try {
          const res = await axios.post(`${backendUrl}/users/${userId}/quests/claim-daily`, {}, { headers: { 'x-guild-id': guildId } });
          await i.reply({ content: `🎉 ${res.data.message} (+${res.data.reward} Stardust)`, ephemeral: true });
        } catch (err) {
          await i.reply({ content: `❌ ${err.response?.data?.message || 'Failed to claim daily reward.'}`, ephemeral: true });
        }
      } else if (i.customId === 'claim_weekly') {
        try {
          const res = await axios.post(`${backendUrl}/users/${userId}/quests/claim-weekly`, {}, { headers: { 'x-guild-id': guildId } });
          await i.reply({ content: `🎉 ${res.data.message} (+${res.data.reward} Stardust)`, ephemeral: true });
        } catch (err) {
          await i.reply({ content: `❌ ${err.response?.data?.message || 'Failed to claim weekly reward.'}`, ephemeral: true });
        }
      }
      collector.stop();
    });
    collector.on('end', async () => {
      try { await msg.edit({ components: [] }); } catch {}
    });
  }
}; 