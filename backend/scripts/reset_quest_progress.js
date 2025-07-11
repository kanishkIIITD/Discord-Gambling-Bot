// Script to reset daily and weekly quest progress for all users
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);
  const now = new Date();
  let dailyCount = 0, weeklyCount = 0;
  // Reset daily quests for all users
  const users = await User.find();
  for (const user of users) {
    // Daily reset: if last reset is not today
    const lastDaily = user.poke_quest_daily_last_reset;
    if (!lastDaily || lastDaily.toDateString() !== now.toDateString()) {
      user.resetDailyQuests();
      dailyCount++;
    }
    // Weekly reset: if last reset is not this week (ISO week)
    const lastWeekly = user.poke_quest_weekly_last_reset;
    const getWeek = d => {
      const date = new Date(d.getTime());
      date.setHours(0,0,0,0);
      date.setDate(date.getDate() + 4 - (date.getDay()||7));
      const yearStart = new Date(date.getFullYear(),0,1);
      const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
      return `${date.getFullYear()}-W${weekNo}`;
    };
    if (!lastWeekly || getWeek(lastWeekly) !== getWeek(now)) {
      user.resetWeeklyQuests();
      weeklyCount++;
    }
    await user.save();
  }
  console.log(`Reset daily quests for ${dailyCount} users.`);
  console.log(`Reset weekly quests for ${weeklyCount} users.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Quest reset script failed:', err);
  process.exit(1);
}); 