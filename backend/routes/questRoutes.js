const mongoose = require('mongoose');
const User = require('../models/User');
const express = require('express');
require('dotenv').config();

const router = express.Router();

// In your Express app (backend/routes/userRoutes.js or similar)
// DAILY RESET
router.post('/quests/reset-daily', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const now = new Date();
  let dailyCount = 0;
  const users = await User.find();
  for (const user of users) {
    const lastDaily = user.poke_quest_daily_last_reset;
    if (!lastDaily || lastDaily.toDateString() !== now.toDateString()) {
      user.resetDailyQuests();
      user.poke_quest_daily_claimed = false;
      dailyCount++;
      await user.save();
    }
  }
  console.log(`Reset daily quests for ${dailyCount} users.`);
  res.json({ message: `Reset daily quests for ${dailyCount} users.` });
});

// WEEKLY RESET
router.post('/quests/reset-weekly', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const now = new Date();
  let weeklyCount = 0;
  const getWeek = d => {
    const date = new Date(d.getTime());
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + 4 - (date.getDay()||7));
    const yearStart = new Date(date.getFullYear(),0,1);
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
    return `${date.getFullYear()}-W${weekNo}`;
  };
  const users = await User.find();
  for (const user of users) {
    const lastWeekly = user.poke_quest_weekly_last_reset;
    if (!lastWeekly || getWeek(lastWeekly) !== getWeek(now)) {
      user.resetWeeklyQuests();
      user.poke_quest_weekly_claimed = false;
      weeklyCount++;
      await user.save();
    }
  }
  console.log(`Reset weekly quests for ${weeklyCount} users.`);
  res.json({ message: `Reset weekly quests for ${weeklyCount} users.` });
});

module.exports = router;