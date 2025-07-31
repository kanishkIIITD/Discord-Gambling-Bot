#!/usr/bin/env node

const { buildGen2PokemonData } = require('./buildGen2PokemonEnhanced');

console.log('🚀 Starting Gen 2 Pokémon data builder...');
console.log('This will:');
console.log('1. Update existing Gen 1 Pokémon with gen: 1');
console.log('2. Add all Gen 2 Pokémon with gen: 2');
console.log('3. Analyze evolution chains for proper evolution stages');
console.log('4. Determine rarity based on base stats');
console.log('5. Set appropriate spawn rates, catch rates, XP, and dust yields');
console.log('');

buildGen2PokemonData()
  .then(() => {
    console.log('\n✅ Gen 2 Pokémon data build completed successfully!');
    console.log('📁 Updated file: discord-bot/data/customSpawnRates.json');
  })
  .catch((error) => {
    console.error('\n❌ Error building Gen 2 Pokémon data:', error);
    process.exit(1);
  }); 