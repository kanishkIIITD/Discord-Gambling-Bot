const fetch = require('node-fetch');

// In-memory caches
let kantoSpecies = [];
let encounterRates = {};
let weightedSpawnPool = [];
let pokemonDataCache = {};
let kantoCacheReady = false;

const KANTO_GENERATION_ID = 1; // /generation/1/
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

  // --- Use custom spawn rates ---
  weightedSpawnPool = [];
  for (const [name, { spawn }] of Object.entries(customSpawnRates)) {
    const species = kantoSpecies.find(s => s.name === name);
    if (!species) {
      console.warn(`[CustomSpawnRates] Pokémon name '${name}' not found in Kanto species, skipping.`);
      continue;
    }
    for (let i = 0; i < spawn; i++) {
      weightedSpawnPool.push(species.id);
    }
  }
  kantoCacheReady = true;
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

function isKantoCacheReady() {
  return kantoCacheReady;
}

module.exports = {
  buildKantoCache,
  getRandomKantoPokemonId,
  getPokemonDataById,
  kantoSpecies,
  encounterRates,
  weightedSpawnPool,
  isKantoCacheReady,
}; 