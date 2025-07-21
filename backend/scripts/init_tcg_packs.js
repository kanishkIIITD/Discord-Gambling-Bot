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
    console.log('Clearing all existing TCG packs...');
    await CardPack.deleteMany({});
    console.log('Creating default TCG packs...');
    await CardPack.createDefaultPacks();
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