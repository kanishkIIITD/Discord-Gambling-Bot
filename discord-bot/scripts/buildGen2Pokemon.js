const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Constants
const GEN1_GENERATION_ID = 1;
const GEN2_GENERATION_ID = 2;
const CUSTOM_SPAWN_RATES_PATH = path.join(__dirname, '../data/customSpawnRates.json');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function getGen1Species() {
  console.log('Fetching Gen 1 species...');
  const genData = await fetchJson(`https://pokeapi.co/api/v2/generation/${GEN1_GENERATION_ID}/`);
  return genData.pokemon_species
    .map(s => ({
      id: +s.url.match(/\/(\d+)\/?$/)[1],
      name: s.name
    }))
    .sort((a, b) => a.id - b.id);
}

async function getGen2Species() {
  console.log('Fetching Gen 2 species...');
  const genData = await fetchJson(`https://pokeapi.co/api/v2/generation/${GEN2_GENERATION_ID}/`);
  return genData.pokemon_species
    .map(s => ({
      id: +s.url.match(/\/(\d+)\/?$/)[1],
      name: s.name
    }))
    .sort((a, b) => a.id - b.id);
}

async function getPokemonDetails(species) {
  console.log(`Fetching details for ${species.name} (ID: ${species.id})...`);
  const pokemonData = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${species.id}/`);
  const speciesData = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${species.id}/`);
  
  return {
    id: species.id,
    name: species.name,
    types: pokemonData.types.map(t => t.type.name),
    baseStats: {
      hp: pokemonData.stats.find(s => s.stat.name === 'hp')?.base_stat || 0,
      attack: pokemonData.stats.find(s => s.stat.name === 'attack')?.base_stat || 0,
      defense: pokemonData.stats.find(s => s.stat.name === 'defense')?.base_stat || 0,
      specialAttack: pokemonData.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0,
      specialDefense: pokemonData.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 0,
      speed: pokemonData.stats.find(s => s.stat.name === 'speed')?.base_stat || 0
    },
    catchRate: speciesData.capture_rate || 45,
    evolutionChain: speciesData.evolution_chain?.url ? speciesData.evolution_chain.url.match(/\/(\d+)\/?$/)[1] : null
  };
}

function determineRarity(baseStats) {
  const totalStats = Object.values(baseStats).reduce((sum, stat) => sum + stat, 0);
  
  if (totalStats >= 600) return 'legendary';
  if (totalStats >= 500) return 'rare';
  if (totalStats >= 400) return 'uncommon';
  return 'common';
}

function determineSpawnRate(rarity) {
  switch (rarity) {
    case 'legendary': return 1;
    case 'rare': return 2;
    case 'uncommon': return 6;
    case 'common': return 28;
    default: return 28;
  }
}

function determineCatchRate(baseCatchRate, rarity) {
  // Adjust catch rate based on rarity
  switch (rarity) {
    case 'legendary': return Math.max(0.01, baseCatchRate / 100);
    case 'rare': return Math.max(0.07, baseCatchRate / 100);
    case 'uncommon': return Math.max(0.18, baseCatchRate / 100);
    case 'common': return Math.max(0.29, baseCatchRate / 100);
    default: return Math.max(0.29, baseCatchRate / 100);
  }
}

function determineXpYield(rarity) {
  switch (rarity) {
    case 'legendary': return 150;
    case 'rare': return 60;
    case 'uncommon': return 35;
    case 'common': return 20;
    default: return 20;
  }
}

function determineDustYield(rarity) {
  switch (rarity) {
    case 'legendary': return 150;
    case 'rare': return 60;
    case 'uncommon': return 30;
    case 'common': return 15;
    default: return 15;
  }
}

async function buildGen2PokemonData() {
  try {
    console.log('Starting Gen 2 Pokémon data build...');
    
    // Load existing custom spawn rates
    const existingSpawnRates = JSON.parse(fs.readFileSync(CUSTOM_SPAWN_RATES_PATH, 'utf8'));
    
    // Get Gen 1 and Gen 2 species
    const gen1Species = await getGen1Species();
    const gen2Species = await getGen2Species();
    
    console.log(`Found ${gen1Species.length} Gen 1 species and ${gen2Species.length} Gen 2 species`);
    
    // Update existing Gen 1 Pokémon with generation info
    console.log('Updating Gen 1 Pokémon with generation info...');
    for (const [name, data] of Object.entries(existingSpawnRates)) {
      const gen1SpeciesFound = gen1Species.find(s => s.name === name);
      if (gen1SpeciesFound) {
        existingSpawnRates[name].gen = 1;
      }
    }
    
    // Build Gen 2 Pokémon data
    console.log('Building Gen 2 Pokémon data...');
    const gen2PokemonData = {};
    
    for (const species of gen2Species) {
      try {
        const details = await getPokemonDetails(species);
        const rarity = determineRarity(details.baseStats);
        
        gen2PokemonData[species.name] = {
          spawn: determineSpawnRate(rarity),
          catchRate: determineCatchRate(details.catchRate, rarity),
          rarity: rarity,
          xpYield: determineXpYield(rarity),
          dustYield: determineDustYield(rarity),
          evolutionStage: 1, // Default, will be updated based on evolution chain
          canEvolve: true, // Default, will be updated based on evolution chain
          gen: 2
        };
        
        // Add a small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing ${species.name}:`, error.message);
      }
    }
    
    // Merge Gen 1 and Gen 2 data
    const updatedSpawnRates = {
      ...existingSpawnRates,
      ...gen2PokemonData
    };
    
    // Write the updated data back to the file
    fs.writeFileSync(
      CUSTOM_SPAWN_RATES_PATH,
      JSON.stringify(updatedSpawnRates, null, 2),
      'utf8'
    );
    
    console.log(`Successfully updated spawn rates with ${Object.keys(gen2PokemonData).length} Gen 2 Pokémon`);
    console.log(`Total Pokémon in config: ${Object.keys(updatedSpawnRates).length}`);
    
    // Generate a summary report
    const gen1Count = Object.values(updatedSpawnRates).filter(p => p.gen === 1).length;
    const gen2Count = Object.values(updatedSpawnRates).filter(p => p.gen === 2).length;
    
    console.log('\n=== SUMMARY ===');
    console.log(`Gen 1 Pokémon: ${gen1Count}`);
    console.log(`Gen 2 Pokémon: ${gen2Count}`);
    console.log(`Total Pokémon: ${gen1Count + gen2Count}`);
    
    // Rarity breakdown for Gen 2
    const gen2Rarities = {};
    Object.values(gen2PokemonData).forEach(pokemon => {
      gen2Rarities[pokemon.rarity] = (gen2Rarities[pokemon.rarity] || 0) + 1;
    });
    
    console.log('\nGen 2 Rarity Breakdown:');
    Object.entries(gen2Rarities).forEach(([rarity, count]) => {
      console.log(`  ${rarity}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error building Gen 2 Pokémon data:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  buildGen2PokemonData();
}

module.exports = { buildGen2PokemonData }; 