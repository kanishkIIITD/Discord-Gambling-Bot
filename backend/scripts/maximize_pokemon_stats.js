const mongoose = require('mongoose');
const Pokemon = require('../models/Pokemon');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI;

if (process.argv.length < 4) {
  console.error('Usage: node maximize_pokemon_stats.js <discordId> <guildId>');
  process.exit(1);
}

const discordId = process.argv[2];
const guildId = process.argv[3];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const query = { discordId, guildId };
  const update = {
    $set: {
      'ivs.hp': 31,
      'ivs.attack': 31,
      'ivs.defense': 31,
      'ivs.spAttack': 31,
      'ivs.spDefense': 31,
      'ivs.speed': 31,
      'evs.hp': 252,
      'evs.attack': 252,
      'evs.defense': 252,
      'evs.spAttack': 252,
      'evs.spDefense': 252,
      'evs.speed': 252
    }
  };

  const result = await Pokemon.updateMany(query, update);
  console.log(`Updated ${result.nModified || result.modifiedCount || 0} Pokémon for discordId=${discordId}, guildId=${guildId}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

main().catch(err => {
  console.error('Error:', err);
  mongoose.disconnect();
}); 