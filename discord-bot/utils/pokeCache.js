const fetch = require('node-fetch');

// In-memory caches
let kantoSpecies = [];
let gen2Species = [];
let gen3Species = [];
let gen4Species = [];
let encounterRates = {};
let weightedSpawnPool = [];
let gen2WeightedSpawnPool = [];
let gen3WeightedSpawnPool = [];
let gen4WeightedSpawnPool = [];
// Adjusted pools for previous-gen spawns (commons halved)
let weightedSpawnPoolPrev = [];
let gen2WeightedSpawnPoolPrev = [];
let gen3WeightedSpawnPoolPrev = [];
let gen4WeightedSpawnPoolPrev = [];
// Combined pool for all previous generations with new rules
let combinedPreviousGenPool = [];
let pokemonDataCache = {};
let kantoCacheReady = false;
let gen2CacheReady = false;
let gen3CacheReady = false;
let gen4CacheReady = false;

const KANTO_GENERATION_ID = 1; // /generation/1/
const GEN2_GENERATION_ID = 2;  // /generation/2/
const GEN3_GENERATION_ID = 3;  // /generation/3/
const GEN4_GENERATION_ID = 4;  // /generation/4/
const KANTO_POKEDEX_ID = 2;    // /pokedex/2/ (Kanto)

const customSpawnRates = require('../data/customSpawnRates.json');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function buildKantoCache() {
  // 1. Fetch Kanto region data to know which versions & areas are valid
  const regionData = await fetchJson(`https://pokeapi.co/api/v2/region/1/`);
  // e.g. version_groups: [{ name: "red-blue" }, { name: "yellow" }]
  const validVersions = regionData.version_groups
    .map(g => g.name.split('-'))  // [["red","blue"], ["yellow"]]
    .flat();                      // ["red","blue","yellow"]

  // e.g. locations: [{ name: "viridian-forest" }, { name: "mt-moon" }, …]
  const validLocations = regionData.locations.map(l => l.name);

  // 2. Fetch all Kanto species from Gen 1
  const genData = await fetchJson(`https://pokeapi.co/api/v2/generation/1/`);
  kantoSpecies = genData.pokemon_species
    .map(s => ({
      id: +s.url.match(/\/(\d+)\/?$/)[1],
      name: s.name
    }))
    .sort((a, b) => a.id - b.id);

  // --- Use custom spawn rates for Gen 1 ---
  weightedSpawnPool = [];
  weightedSpawnPoolPrev = [];
  for (const [name, { spawn, gen }] of Object.entries(customSpawnRates)) {
    if (gen === 1) {
      const species = kantoSpecies.find(s => s.name === name);
      if (!species) {
        console.warn(`[CustomSpawnRates] Pokémon name '${name}' not found in Kanto species, skipping.`);
        continue;
      }
      for (let i = 0; i < spawn; i++) {
        weightedSpawnPool.push(species.id);
      }
      // Build adjusted pool: halve commons
      const rarity = customSpawnRates[name]?.rarity;
      const adjustedSpawn = rarity === 'common' ? Math.max(1, Math.floor(spawn / 2)) : spawn;
      for (let i = 0; i < adjustedSpawn; i++) {
        weightedSpawnPoolPrev.push(species.id);
      }
    }
  }
  kantoCacheReady = true;
}

async function buildGen2Cache() {
  // Fetch all Gen 2 species
  const genData = await fetchJson(`https://pokeapi.co/api/v2/generation/2/`);
  gen2Species = genData.pokemon_species
    .map(s => ({
      id: +s.url.match(/\/(\d+)\/?$/)[1],
      name: s.name
    }))
    .sort((a, b) => a.id - b.id);

  // --- Use custom spawn rates for Gen 2 ---
  gen2WeightedSpawnPool = [];
  gen2WeightedSpawnPoolPrev = [];
  for (const [name, { spawn, gen }] of Object.entries(customSpawnRates)) {
    if (gen === 2) {
      const species = gen2Species.find(s => s.name === name);
      if (!species) {
        console.warn(`[CustomSpawnRates] Pokémon name '${name}' not found in Gen 2 species, skipping.`);
        continue;
      }
      for (let i = 0; i < spawn; i++) {
        gen2WeightedSpawnPool.push(species.id);
      }
      // Adjusted pool for previous-gen spawn bias
      const rarity = customSpawnRates[name]?.rarity;
      const adjustedSpawn = rarity === 'common' ? Math.max(1, Math.floor(spawn / 2)) : spawn;
      for (let i = 0; i < adjustedSpawn; i++) {
        gen2WeightedSpawnPoolPrev.push(species.id);
      }
    }
  }
  gen2CacheReady = true;
}

async function buildGen3Cache() {
  // Fetch all Gen 3 species
  const genData = await fetchJson(`https://pokeapi.co/api/v2/generation/${GEN3_GENERATION_ID}/`);
  gen3Species = genData.pokemon_species
    .map(s => ({
      id: +s.url.match(/\/(\d+)\/?$/)[1],
      name: s.name
    }))
    .sort((a, b) => a.id - b.id);

  // --- Use custom spawn rates for Gen 3 ---
  gen3WeightedSpawnPool = [];
  gen3WeightedSpawnPoolPrev = [];
  for (const [name, { spawn, gen }] of Object.entries(customSpawnRates)) {
    if (gen === 3) {
      const species = gen3Species.find(s => s.name === name);
      if (!species) {
        console.warn(`[CustomSpawnRates] Pokémon name '${name}' not found in Gen 3 species, skipping.`);
        continue;
      }
      for (let i = 0; i < spawn; i++) {
        gen3WeightedSpawnPool.push(species.id);
      }
      const rarity = customSpawnRates[name]?.rarity;
      const adjustedSpawn = rarity === 'common' ? Math.max(1, Math.floor(spawn / 2)) : spawn;
      for (let i = 0; i < adjustedSpawn; i++) {
        gen3WeightedSpawnPoolPrev.push(species.id);
      }
    }
  }
  gen3CacheReady = true;
}

async function buildGen4Cache() {
  // Fetch all Gen 4 species
  const genData = await fetchJson(`https://pokeapi.co/api/v2/generation/${GEN4_GENERATION_ID}/`);
  gen4Species = genData.pokemon_species
    .map(s => ({
      id: +s.url.match(/\/(\d+)\/?$/)[1],
      name: s.name
    }))
    .sort((a, b) => a.id - b.id);

  // --- Use custom spawn rates for Gen 4 ---
  gen4WeightedSpawnPool = [];
  gen4WeightedSpawnPoolPrev = [];
  for (const [name, { spawn, gen }] of Object.entries(customSpawnRates)) {
    if (gen === 4) {
      const species = gen4Species.find(s => s.name === name);
      if (!species) {
        console.warn(`[CustomSpawnRates] Pokémon name '${name}' not found in Gen 4 species, skipping.`);
        continue;
      }
      for (let i = 0; i < spawn; i++) {
        gen4WeightedSpawnPool.push(species.id);
      }
      const rarity = customSpawnRates[name]?.rarity;
      const adjustedSpawn = rarity === 'common' ? Math.max(1, Math.floor(spawn / 2)) : spawn;
      for (let i = 0; i < adjustedSpawn; i++) {
        gen4WeightedSpawnPoolPrev.push(species.id);
      }
    }
  }
  gen4CacheReady = true;
}

// Build combined pool for all previous generations with new rules
async function buildCombinedPreviousGenPool() {
  const { getCurrentGenInfo, getPreviousGenInfo } = require('../config/generationConfig');
  const currentGen = getCurrentGenInfo().number;
  const previousGen = getPreviousGenInfo().number;
  
  combinedPreviousGenPool = [];
  
  // Get all generations that are previous to current
  const previousGenerations = [];
  for (let gen = 1; gen < currentGen; gen++) {
    previousGenerations.push(gen);
  }
  
  // For each previous generation, add Pokémon based on rules
  for (const gen of previousGenerations) {
    const speciesList = (
      gen === 1 ? kantoSpecies :
      gen === 2 ? gen2Species :
      gen === 3 ? gen3Species :
      gen === 4 ? gen4Species :
      []
    );
    
    for (const [name, { spawn, gen: pokemonGen, rarity }] of Object.entries(customSpawnRates)) {
      if (pokemonGen === gen) {
        const species = speciesList.find(s => s.name === name);
        if (!species) {
          console.warn(`[CombinedPreviousGenPool] Pokémon name '${name}' not found in Gen ${gen} species, skipping.`);
          continue;
        }
        
        // Apply rules:
        // 1. For 1 previous gen (Gen 2 for current Gen 3), commons have 1/2 spawn rate
        // 2. For all previous gens, commons are excluded
        let adjustedSpawn = 0;
        
        if (rarity === 'common') {
          if (gen === previousGen) {
            // 1 previous gen: halve commons
            adjustedSpawn = Math.max(1, Math.floor(spawn / 2));
          } else {
            // 2+ previous gens: exclude commons
            adjustedSpawn = 0;
          }
        } else {
          // Non-commons: keep original spawn rate
          adjustedSpawn = spawn;
        }
        
        // Add to combined pool
        for (let i = 0; i < adjustedSpawn; i++) {
          combinedPreviousGenPool.push(species.id);
        }
      }
    }
  }
  
  console.log(`[CombinedPreviousGenPool] Built combined pool with ${combinedPreviousGenPool.length} Pokémon from generations ${previousGenerations.join(', ')}`);
}

function getRandomKantoPokemonId() {
  if (weightedSpawnPool.length === 0) throw new Error('Kanto cache not built!');
  const idx = Math.floor(Math.random() * weightedSpawnPool.length);
  return weightedSpawnPool[idx];
}

function getRandomGen2PokemonId() {
  if (gen2WeightedSpawnPool.length === 0) throw new Error('Gen 2 cache not built!');
  const idx = Math.floor(Math.random() * gen2WeightedSpawnPool.length);
  return gen2WeightedSpawnPool[idx];
}

function getRandomGen3PokemonId() {
  if (gen3WeightedSpawnPool.length === 0) throw new Error('Gen 3 cache not built!');
  const idx = Math.floor(Math.random() * gen3WeightedSpawnPool.length);
  return gen3WeightedSpawnPool[idx];
}

function getRandomGen4PokemonId() {
  if (gen4WeightedSpawnPool.length === 0) throw new Error('Gen 4 cache not built!');
  const idx = Math.floor(Math.random() * gen4WeightedSpawnPool.length);
  return gen4WeightedSpawnPool[idx];
}

function getRandomPokemonIdByGenerationPreviousBias(generation) {
  // Use combined pool for all previous generations
  if (combinedPreviousGenPool.length === 0) {
    throw new Error('Combined previous generation pool not built! Call buildCombinedPreviousGenPool() first.');
  }
  const idx = Math.floor(Math.random() * combinedPreviousGenPool.length);
  return combinedPreviousGenPool[idx];
}

// Get random Pokémon ID based on generation
function getRandomPokemonIdByGeneration(generation) {
  if (generation === 1) {
    return getRandomKantoPokemonId();
  } else if (generation === 2) {
    return getRandomGen2PokemonId();
  } else if (generation === 3) {
    return getRandomGen3PokemonId();
  } else if (generation === 4) {
    return getRandomGen4PokemonId();
  } else {
    throw new Error(`Unsupported generation: ${generation}`);
  }
}

async function getPokemonDataById(id) {
  if (pokemonDataCache[id]) return pokemonDataCache[id];
  const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}/`);
  pokemonDataCache[id] = data;
  return data;
}

function isKantoCacheReady() {
  return kantoCacheReady;
}

function isGen2CacheReady() {
  return gen2CacheReady;
}

function isGen3CacheReady() {
  return gen3CacheReady;
}

function isGen4CacheReady() {
  return gen4CacheReady;
}

function isCombinedPreviousGenPoolReady() {
  return combinedPreviousGenPool.length > 0;
}

module.exports = {
  buildKantoCache,
  buildGen2Cache,
  buildGen3Cache,
  buildGen4Cache,
  buildCombinedPreviousGenPool,
  getRandomKantoPokemonId,
  getRandomGen2PokemonId,
  getRandomGen3PokemonId,
  getRandomGen4PokemonId,
  getRandomPokemonIdByGeneration,
  getPokemonDataById,
  kantoSpecies,
  gen2Species,
  gen3Species,
  gen4Species,
  encounterRates,
  weightedSpawnPool,
  gen2WeightedSpawnPool,
  gen3WeightedSpawnPool,
  gen4WeightedSpawnPool,
  weightedSpawnPoolPrev,
  gen2WeightedSpawnPoolPrev,
  gen3WeightedSpawnPoolPrev,
  gen4WeightedSpawnPoolPrev,
  combinedPreviousGenPool,
  isKantoCacheReady,
  isGen2CacheReady,
  isGen3CacheReady,
  isGen4CacheReady,
  isCombinedPreviousGenPoolReady,
  getRandomPokemonIdByGenerationPreviousBias,
}; 