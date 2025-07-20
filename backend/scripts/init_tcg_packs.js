require('dotenv').config();
const mongoose = require('mongoose');
const CardPack = require('../models/CardPack');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    return initializePacks();
  })
  .then(() => {
    console.log('TCG packs initialized successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error initializing TCG packs:', err);
    process.exit(1);
  });

async function initializePacks() {
  try {
    console.log('Creating default TCG packs...');
    
    // Create default packs
    await CardPack.createDefaultPacks();
    // After creation, update classic packs to 9 cards, no energy, and new descriptions
    await CardPack.updateOne({ packId: 'base1' }, {
      cardCount: 9,
      description: 'The original Pokémon TCG expansion (1999). Features the core 150 Pokémon including iconic cards like Charizard and Blastoise! Each pack contains 9 cards: 1 Rare (33% chance holo), 3 Uncommon, and 5 Common cards. No energy cards.',
      'rarityDistribution.common': 5,
      'rarityDistribution.uncommon': 3,
      'rarityDistribution.rare': 1,
      'rarityDistribution.holo-rare': 0,
      'rarityDistribution.ultra-rare': 0,
      dailyLimit: 0,
      weeklyLimit: 0
    });
    await CardPack.updateOne({ packId: 'base2' }, {
      cardCount: 9,
      description: 'The first true expansion (1999). Introduces favorites like Vileplume and Scyther with non-holo vs holo rare variants! Each pack contains 9 cards: 1 Rare (33% chance holo), 3 Uncommon, and 5 Common cards. No energy cards.',
      'rarityDistribution.common': 5,
      'rarityDistribution.uncommon': 3,
      'rarityDistribution.rare': 1,
      'rarityDistribution.holo-rare': 0,
      'rarityDistribution.ultra-rare': 0,
      dailyLimit: 0,
      weeklyLimit: 0
    });
    await CardPack.updateOne({ packId: 'base3' }, {
      cardCount: 9,
      description: 'The Fossil expansion (1999). Features fossil Pokémon like Aerodactyl and Ditto with the classic Starlight holo pattern! Each pack contains 9 cards: 1 Rare (33% chance holo), 3 Uncommon, and 5 Common cards. No energy cards.',
      'rarityDistribution.common': 5,
      'rarityDistribution.uncommon': 3,
      'rarityDistribution.rare': 1,
      'rarityDistribution.holo-rare': 0,
      'rarityDistribution.ultra-rare': 0,
      dailyLimit: 0,
      weeklyLimit: 0
    });
    
    // Verify packs were created
    const packs = await CardPack.find({});
    console.log(`Created ${packs.length} packs:`);
    
    packs.forEach(pack => {
      console.log(`- ${pack.name} (${pack.packId}): ${pack.price} points, ${pack.cardCount} cards`);
    });
    
  } catch (error) {
    console.error('Error in initializePacks:', error);
    throw error;
  }
} 