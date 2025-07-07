const fetch = require('node-fetch');

// In-memory caches
let kantoSpecies = [];
let encounterRates = {};
let weightedSpawnPool = [];
let pokemonDataCache = {};

const KANTO_GENERATION_ID = 1; // /generation/1/
const KANTO_POKEDEX_ID = 2;    // /pokedex/2/ (Kanto)

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function buildKantoCache() {
  // 1. Fetch Kanto species list
  const genData = await fetchJson(`https://pokeapi.co/api/v2/generation/${KANTO_GENERATION_ID}/`);
  kantoSpecies = genData.pokemon_species
    .map(s => ({
      name: s.name,
      url: s.url,
      id: parseInt(s.url.match(/\/(\d+)\/?$/)[1], 10)
    }))
    .sort((a, b) => a.id - b.id); // Sort by ID

  // 2. For each, fetch encounter data and calculate rate
  encounterRates = {};
  weightedSpawnPool = [];
  for (const species of kantoSpecies) {
    try {
      const encounters = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${species.id}/encounters`);
      let totalRate = 0;
      let count = 0;
      for (const loc of encounters) {
        for (const ver of loc.version_details) {
          for (const enc of ver.encounter_details) {
            totalRate += enc.chance || 0;
            count++;
          }
        }
      }
      // Average encounter rate (or 1 if not found)
      const avgRate = count > 0 ? totalRate / count : 1;
      encounterRates[species.id] = avgRate;
      // Add to weighted pool (min 1 entry)
      const weight = Math.max(Math.round(avgRate), 1);
      for (let i = 0; i < weight; i++) {
        weightedSpawnPool.push(species.id);
      }
    } catch (e) {
      // If no encounter data, treat as ultra-rare
      encounterRates[species.id] = 0.1;
      weightedSpawnPool.push(species.id); // At least 1 entry
    }
  }
}

function getRandomKantoPokemonId() {
  if (weightedSpawnPool.length === 0) throw new Error('Kanto cache not built!');
  const idx = Math.floor(Math.random() * weightedSpawnPool.length);
  return weightedSpawnPool[idx];
}

async function getPokemonDataById(id) {
  if (pokemonDataCache[id]) return pokemonDataCache[id];
  const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}/`);
  pokemonDataCache[id] = data;
  return data;
}

module.exports = {
  buildKantoCache,
  getRandomKantoPokemonId,
  getPokemonDataById,
  kantoSpecies,
  encounterRates,
  weightedSpawnPool,
}; 