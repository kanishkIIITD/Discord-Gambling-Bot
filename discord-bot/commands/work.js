const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const jobs = [
  'streamer',
  'pizza delivery',
  'mercenary',
  'taxi driver',
  'street musician',
  'dog walker',
  'barista',
  'construction worker',
  'social media influencer',
  'private investigator',
  'collector'
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work a job for a chance to earn points and rare bonuses!')
    .addSubcommand(sub =>
      sub.setName('do')
        .setDescription('Work a job!')
        .addStringOption(option =>
          option.setName('job')
            .setDescription('Choose a job or leave blank for random')
            .setRequired(false)
            .addChoices(...jobs.map(j => ({ name: j.charAt(0).toUpperCase() + j.slice(1), value: j })))
        )
    )
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View your work/job stats')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'stats') {
      try {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const backendUrl = process.env.BACKEND_API_URL;
        const guildId = interaction.guildId;
        const statsRes = await axios.get(`${backendUrl}/users/${userId}/work-stats`, { params: { guildId }, headers: { 'x-guild-id': guildId } });
        const workStats = statsRes.data.workStats || [];
        let totalEarned = 0;
        const fields = workStats.map(stat => {
          const jobName = stat.job ? stat.job.charAt(0).toUpperCase() + stat.job.slice(1) : 'Unknown';
          const timesWorked = typeof stat.times === 'number' ? stat.times : 0;
          const earned = typeof stat.earned === 'number' ? stat.earned : 0;
          const bonus = typeof stat.bonus === 'number' ? stat.bonus : 0;
          totalEarned += earned;
          return {
            name: jobName,
            value: `Times Worked: ${timesWorked}\nTotal Earned: ${earned.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points` +
                   (bonus > 0 ? `\nTotal Bonus: ${bonus.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points` : ''),
            inline: false
          };
        });
        const embed = {
          color: 0x0099ff,
          title: '🏃 Work Stats',
          description: `Total Earned: **${totalEarned.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} points**`,
          fields: fields.length > 0 ? fields : [{ name: 'No jobs yet', value: 'Try working to start your job history!' }],
          timestamp: new Date(),
          footer: { text: `Requested by ${interaction.user.tag}` }
        };
        await interaction.editReply({ embeds: [embed] });
        return;
      } catch (error) {
        logger.error('Error in /work stats:', error);
        await ResponseHandler.handleError(interaction, error, 'Work Stats');
        return;
      }
    }
    // Default: perform work
    try {
      await interaction.deferReply();
      const userId = interaction.user.id;
      const backendUrl = process.env.BACKEND_API_URL;
      const guildId = interaction.guildId;
      const job = interaction.options.getString('job');
      const response = await axios.post(`${backendUrl}/users/${userId}/work`, job ? { job, guildId } : { guildId }, { headers: { 'x-guild-id': guildId } });
      const { job: jobResult, amount, cooldown, message } = response.data;

      // Extract buff messages from the main message
      let mainMessage = message;
      let buffMessages = [];
      
      // Extract work buff
      const workMatch = message.match(/\((work_\w+ buff used: (\dx) POINTS!)\)/i);
      if (workMatch) {
        buffMessages.push(workMatch[1]);
        mainMessage = mainMessage.replace(workMatch[0], '').trim();
      }

      // Extract earnings buff
      const earningsMatch = message.match(/\((earnings_x\d buff active: (\dx) POINTS!)\)/i);
      if (earningsMatch) {
        buffMessages.push(earningsMatch[1]);
        mainMessage = mainMessage.replace(earningsMatch[0], '').trim();
      }

      const embed = {
        color: 0x00ff00,
        title: '💼 Work Result',
        description: mainMessage,
        fields: [
          { name: 'Job', value: jobResult, inline: true },
          { name: 'Amount', value: `${amount.toLocaleString('en-US')} points`, inline: true },
          { name: 'Next Work Available', value: `<t:${Math.floor(new Date(cooldown).getTime()/1000)}:R>`, inline: true }
        ],
        timestamp: new Date(),
        footer: { text: `Requested by ${interaction.user.tag}` }
      };

      // Add buffs field if there are any buffs
      if (buffMessages.length > 0) {
        embed.fields.push({
          name: '✨ Buffs Used',
          value: buffMessages.join('\n'),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    } catch (error) {
      logger.error('Error in /work command:', error);
      if (error.response && error.response.data && error.response.data.message) {
        await ResponseHandler.handleError(interaction, { message: error.response.data.message }, 'Work');
        return;
      } else {
        await ResponseHandler.handleError(interaction, error, 'Work');
        return;
      }
    }
  },
}; 