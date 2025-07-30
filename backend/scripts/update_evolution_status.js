const fs = require('fs');
const path = require('path');
const { getNextEvolutionIds } = require('../utils/pokeApi');

// Helper function to fetch JSON from URL
async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

// Helper function to get Pokémon name by ID
async function getPokemonNameById(id) {
  try {
    const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}/`);
    return data?.name?.toLowerCase();
  } catch (error) {
    console.error(`Error getting name for ID ${id}:`, error.message);
    return null;
  }
}

// Helper function to normalize Pokémon name
function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Create a mapping from Pokémon names to their IDs
async function createPokemonNameToIdMapping() {
  console.log('Creating Pokémon name to ID mapping...');
  const nameToId = {};
  
  // Fetch all Pokémon from the API (limit to first 151 for Gen 1)
  try {
    const data = await fetchJson('https://pokeapi.co/api/v2/pokemon?limit=151');
    if (!data || !data.results) {
      throw new Error('Failed to fetch Pokémon list');
    }
    
    for (const pokemon of data.results) {
      const id = parseInt(pokemon.url.split('/').filter(Boolean).pop());
      const name = pokemon.name.toLowerCase();
      nameToId[name] = id;
    }
    
    console.log(`Created mapping for ${Object.keys(nameToId).length} Pokémon`);
    return nameToId;
  } catch (error) {
    console.error('Error creating Pokémon mapping:', error.message);
    return {};
  }
}

async function updateEvolutionStatus() {
  console.log('Starting evolution status update...');
  
  // Read the current custom spawn rates
  const backendPath = path.join(__dirname, '../utils/customSpawnRates.json');
  const discordBotPath = path.join(__dirname, '../../discord-bot/data/customSpawnRates.json');
  
  let backendData, discordBotData;
  
  try {
    backendData = JSON.parse(fs.readFileSync(backendPath, 'utf8'));
    discordBotData = JSON.parse(fs.readFileSync(discordBotPath, 'utf8'));
  } catch (error) {
    console.error('Error reading custom spawn rates files:', error.message);
    return;
  }
  
  // Create Pokémon name to ID mapping
  const nameToId = await createPokemonNameToIdMapping();
  
  const pokemonNames = Object.keys(backendData);
  const evolutionResults = {};
  
  console.log(`Processing ${pokemonNames.length} Pokémon...`);
  
  // Process each Pokémon to determine if it can evolve
  for (let i = 0; i < pokemonNames.length; i++) {
    const pokemonName = pokemonNames[i];
    const pokemonData = backendData[pokemonName];
    
    // Get Pokémon ID from the mapping
    const pokemonId = nameToId[pokemonName];
    if (!pokemonId) {
      console.log(`Skipping ${pokemonName}: no ID found in mapping`);
      continue;
    }
    
    console.log(`Processing ${pokemonName} (ID: ${pokemonId}) (${i + 1}/${pokemonNames.length})...`);
    
    try {
      // Use getNextEvolutionIds to check if this Pokémon can evolve
      const nextEvolutions = await getNextEvolutionIds(pokemonId, 1);
      const canEvolve = nextEvolutions.length > 0;
      
      evolutionResults[pokemonName] = {
        pokemonId,
        canEvolve,
        nextEvolutions
      };
      
      console.log(`  ${pokemonName}: canEvolve = ${canEvolve}, next evolutions: ${nextEvolutions.length}`);
      
      // Add small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Error processing ${pokemonName}:`, error.message);
      evolutionResults[pokemonName] = {
        pokemonId,
        canEvolve: false,
        nextEvolutions: [],
        error: error.message
      };
    }
  }
  
  // Update backend custom spawn rates
  console.log('\nUpdating backend custom spawn rates...');
  for (const pokemonName of pokemonNames) {
    if (backendData[pokemonName] && evolutionResults[pokemonName]) {
      backendData[pokemonName].canEvolve = evolutionResults[pokemonName].canEvolve;
    }
  }
  
  // Update discord-bot custom spawn rates
  console.log('Updating discord-bot custom spawn rates...');
  for (const pokemonName of pokemonNames) {
    if (discordBotData[pokemonName] && evolutionResults[pokemonName]) {
      discordBotData[pokemonName].canEvolve = evolutionResults[pokemonName].canEvolve;
    }
  }
  
  // Write updated files
  try {
    fs.writeFileSync(backendPath, JSON.stringify(backendData, null, 2));
    fs.writeFileSync(discordBotPath, JSON.stringify(discordBotData, null, 2));
    console.log('Successfully updated both custom spawn rates files!');
  } catch (error) {
    console.error('Error writing files:', error.message);
    return;
  }
  
  // Print summary
  console.log('\n=== Evolution Status Summary ===');
  const canEvolveCount = Object.values(evolutionResults).filter(r => r.canEvolve).length;
  const cannotEvolveCount = Object.values(evolutionResults).filter(r => !r.canEvolve).length;
  const errorCount = Object.values(evolutionResults).filter(r => r.error).length;
  
  console.log(`Total Pokémon processed: ${Object.keys(evolutionResults).length}`);
  console.log(`Can evolve: ${canEvolveCount}`);
  console.log(`Cannot evolve: ${cannotEvolveCount}`);
  console.log(`Errors: ${errorCount}`);
  
  // Show some examples
  console.log('\n=== Examples ===');
  const canEvolveExamples = Object.entries(evolutionResults)
    .filter(([name, data]) => data.canEvolve)
    .slice(0, 5);
  
  const cannotEvolveExamples = Object.entries(evolutionResults)
    .filter(([name, data]) => !data.canEvolve)
    .slice(0, 5);
  
  console.log('Can evolve examples:');
  canEvolveExamples.forEach(([name, data]) => {
    console.log(`  ${name} (ID: ${data.pokemonId}) -> ${data.nextEvolutions.length} possible evolutions`);
  });
  
  console.log('\nCannot evolve examples:');
  cannotEvolveExamples.forEach(([name, data]) => {
    console.log(`  ${name} (ID: ${data.pokemonId})`);
  });
  
  console.log('\nScript completed successfully!');
}

// Run the script
if (require.main === module) {
  updateEvolutionStatus().catch(console.error);
}

module.exports = { updateEvolutionStatus }; 