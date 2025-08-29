const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Constants
const GEN1_GENERATION_ID = 1;
const GEN3_GENERATION_ID = 3;
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

async function getGen3Species() {
  console.log('Fetching Gen 3 species...');
  const genData = await fetchJson(`https://pokeapi.co/api/v2/generation/${GEN3_GENERATION_ID}/`);
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
    evolutionChainId: speciesData.evolution_chain?.url ? speciesData.evolution_chain.url.match(/\/(\d+)\/?$/)[1] : null
  };
}

async function analyzeEvolutionChain(chainId) {
  try {
    const chainData = await fetchJson(`https://pokeapi.co/api/v2/evolution-chain/${chainId}/`);
    const evolutionMap = new Map();
    const evolutionStages = [];
    function processChain(chain, stage = 0) {
      const speciesName = chain.species.name;
      evolutionMap.set(speciesName, stage);
      evolutionStages[stage] = evolutionStages[stage] || [];
      evolutionStages[stage].push(speciesName);
      if (chain.evolves_to && chain.evolves_to.length > 0) {
        chain.evolves_to.forEach(evolution => processChain(evolution, stage + 1));
      }
    }
    processChain(chainData.chain);
    return { evolutionMap, maxStage: evolutionStages.length - 1, evolutionStages };
  } catch (error) {
    console.error(`Error analyzing evolution chain ${chainId}:`, error.message);
    return null;
  }
}

async function getEvolutionInfoForSpecies(speciesName, evolutionChainId) {
  if (!evolutionChainId) {
    return { evolutionStage: 1, canEvolve: false };
  }
  try {
    const chainData = await fetchJson(`https://pokeapi.co/api/v2/evolution-chain/${evolutionChainId}/`);
    function dfs(node, depth) {
      if (!node) return null;
      if (node.species?.name === speciesName) {
        return { evolutionStage: depth, canEvolve: Array.isArray(node.evolves_to) && node.evolves_to.length > 0 };
      }
      if (Array.isArray(node.evolves_to)) {
        for (const next of node.evolves_to) {
          const found = dfs(next, depth + 1);
          if (found) return found;
        }
      }
      return null;
    }
    const info = dfs(chainData.chain, 1);
    if (info) return info;
    // Fallback if not found in chain
    return { evolutionStage: 1, canEvolve: false };
  } catch (_) {
    return { evolutionStage: 1, canEvolve: false };
  }
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
    case 'legendary': return Math.max(0.01, baseCatchRate / 255);
    case 'rare': return Math.max(0.07, baseCatchRate / 255);
    case 'uncommon': return Math.max(0.18, baseCatchRate / 255);
    case 'common': return Math.max(0.29, baseCatchRate / 255);
    default: return Math.max(0.29, baseCatchRate / 255);
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

async function buildGen3PokemonData() {
  try {
    console.log('Starting Gen 3 Pokémon data build...');
    
    // Load existing custom spawn rates
    const existingSpawnRates = JSON.parse(fs.readFileSync(CUSTOM_SPAWN_RATES_PATH, 'utf8'));
    
    // Ensure existing Gen 1 entries are marked with gen: 1
    const gen1Species = await getGen1Species();
    for (const [name] of Object.entries(existingSpawnRates)) {
      const found = gen1Species.find(s => s.name === name);
      if (found) existingSpawnRates[name].gen = 1;
    }
    
    // Build Gen 3 Pokémon data
    const gen3Species = await getGen3Species();
    console.log(`Found ${gen3Species.length} Gen 3 species`);
    
    const gen3PokemonData = {};
    const evolutionChains = new Map();
    for (const species of gen3Species) {
      try {
        const details = await getPokemonDetails(species);
        const rarity = determineRarity(details.baseStats);
        // Analyze evolution chain with caching
        let evolutionInfo = null;
        if (details.evolutionChainId) {
          if (!evolutionChains.has(details.evolutionChainId)) {
            evolutionInfo = await analyzeEvolutionChain(details.evolutionChainId);
            evolutionChains.set(details.evolutionChainId, evolutionInfo);
          } else {
            evolutionInfo = evolutionChains.get(details.evolutionChainId);
          }
        }
        // Determine evolution stage and ability to evolve
        let evolutionStage = 1;
        let canEvolve = false;
        if (evolutionInfo && evolutionInfo.evolutionMap.has(species.name)) {
          evolutionStage = evolutionInfo.evolutionMap.get(species.name) + 1;
          canEvolve = evolutionStage < evolutionInfo.maxStage + 1;
        }
        
        gen3PokemonData[species.name] = {
          spawn: determineSpawnRate(rarity),
          catchRate: determineCatchRate(details.catchRate, rarity),
          rarity: rarity,
          xpYield: determineXpYield(rarity),
          dustYield: determineDustYield(rarity),
          evolutionStage: evolutionStage,
          canEvolve: canEvolve,
          gen: 3
        };
        
        // Be polite to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing ${species.name}:`, error.message);
      }
    }
    
    // Merge and write
    const updatedSpawnRates = {
      ...existingSpawnRates,
      ...gen3PokemonData
    };
    fs.writeFileSync(CUSTOM_SPAWN_RATES_PATH, JSON.stringify(updatedSpawnRates, null, 2), 'utf8');
    
    console.log(`Successfully added ${Object.keys(gen3PokemonData).length} Gen 3 Pokémon to spawn rates.`);
    const gen3Count = Object.values(updatedSpawnRates).filter(p => p.gen === 3).length;
    console.log(`Total Gen 3 entries now: ${gen3Count}`);
  } catch (error) {
    console.error('Error building Gen 3 Pokémon data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  buildGen3PokemonData();
}

module.exports = { buildGen3PokemonData };


