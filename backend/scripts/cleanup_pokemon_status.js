const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Import the Pokemon model
const Pokemon = require('../models/Pokemon');

async function cleanupPokemonStatus() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all Pokémon with non-null status
    const pokemonsWithStatus = await Pokemon.find({ status: { $ne: null } });
    
    console.log(`Found ${pokemonsWithStatus.length} Pokémon with status conditions that need to be cleared.`);

    if (pokemonsWithStatus.length > 0) {
      // Update all Pokémon to have null status
      const result = await Pokemon.updateMany(
        { status: { $ne: null } },
        { $set: { status: null } }
      );

      console.log(`Cleared status conditions from ${result.modifiedCount} Pokémon.`);
      
      // Log some examples of what was cleared
      const examples = pokemonsWithStatus.slice(0, 5);
      console.log('Examples of Pokémon that had status conditions:');
      examples.forEach(p => {
        console.log(`- ${p.name} (ID: ${p.pokemonId}) had status: ${p.status}`);
      });
    } else {
      console.log('No Pokémon with status conditions found.');
    }

    await mongoose.disconnect();
    console.log('Cleanup completed successfully.');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupPokemonStatus();
