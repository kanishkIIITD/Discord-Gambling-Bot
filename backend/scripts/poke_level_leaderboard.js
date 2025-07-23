const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI;

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Fetch all users, sorted by poke_level descending, then username ascending
  const users = await User.find({}, 'username discordId poke_level')
    .sort({ poke_level: -1, username: 1 })
    .lean();

  console.log('--- Pokémon Level Leaderboard ---');
  console.log('Rank\tLevel\tUsername\tDiscord ID');
  users.forEach((user, idx) => {
    console.log(`${idx + 1}\t${user.poke_level}\t${user.username}\t${user.discordId}`);
  });
  console.log(`\nTotal users: ${users.length}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

main().catch(err => {
  console.error('Error:', err);
  mongoose.disconnect();
}); 