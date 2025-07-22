const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI;

// Build the level → cumulative XP map
const MAX_LEVEL = 100;
const BASE = 100;
const EXPONENT = 1.2;
const cumulativeXpMap = {};
for (let level = 1; level <= MAX_LEVEL + 1; level++) {
  cumulativeXpMap[level] = level === 1 ? 0 : BASE * level + cumulativeXpMap[level - 1];
}

async function main() {
  // Debug: print cumulative XP for levels 1-20
  console.log('Level\tCumulative XP\tXP for this level');
  for (let i = 1; i <= 35; i++) {
    console.log(i, cumulativeXpMap[i], cumulativeXpMap[i] - cumulativeXpMap[i - 1]);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const users = await User.find({}, 'username poke_xp poke_level').lean();
  let updated = 0;
  for (const user of users) {
    let newLevel = 1;
    for (let level = 1; level <= MAX_LEVEL; level++) {
      if (user.poke_xp >= cumulativeXpMap[level + 1]) {
        newLevel = level + 1;
      } else {
        break;
      }
    }
    if (user.poke_level !== newLevel) {
      await User.updateOne({ _id: user._id }, { $set: { poke_level: newLevel } });
      console.log(`Updated ${user.username}: XP ${user.poke_xp} | Level ${user.poke_level} -> ${newLevel}`);
      updated++;
    }
  }
  console.log(`\nDone. Updated ${updated} users.`);
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

main().catch(err => {
  console.error('Error:', err);
  mongoose.disconnect();
}); 