const fetch = require('node-fetch');

// In-memory caches
let kantoSpecies = [];
let encounterRates = {};
let weightedSpawnPool = [];
let pokemonDataCache = {};
let kantoCacheReady = false;

const KANTO_GENERATION_ID = 1; // /generation/1/
const KANTO_POKEDEX_ID = 2;    // /pokedex/2/ (Kanto)

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

  const rates = {};

  // 3. For each species, fetch its encounters and filter strictly
  for (const { id, name } of kantoSpecies) {
    const encounters = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}/encounters`);
    let totalChance = 0, count = 0;

    // If encounters array is empty, treat as ultra-rare (but include)
    if (!encounters || encounters.length === 0) {
      rates[id] = 0.0001; // ultra-rare
      continue;
    }

    // Walk through each location-area block
    for (const loc of encounters) {
      // accept any location_area that begins with a Kanto location name
      if (!validLocations.some(name => loc.location_area.name.startsWith(name))) continue;

      for (const verDetail of loc.version_details) {
        // Skip any non‑Gen 1 version
        if (!validVersions.includes(verDetail.version.name)) continue;

        // Accumulate only the true Gen 1 wild-encounter chances
        for (const enc of verDetail.encounter_details) {
          totalChance += enc.chance || 0;
          count++;
        }
      }
    }

    // If none found, treat as ultra‑rare (but include)
    const avgRate = count > 0
      ? totalChance / count
      : 0.0001; // ultra-rare
    rates[id] = avgRate;
  }

  // Normalize the pool so each Pokémon's slots are proportional to its true Kanto wild encounter rate
  const POOL_SIZE = 1000;
  const fractions = kantoSpecies.map(s => rates[s.id] / 100);
  const sumFractions = fractions.reduce((a, b) => a + b, 0);
  weightedSpawnPool = [];
  for (const { id } of kantoSpecies) {
    const fraction = rates[id] / 100;
    const slots = Math.max(
      Math.round((fraction / sumFractions) * POOL_SIZE),
      1
    );
    for (let i = 0; i < slots; i++) {
      weightedSpawnPool.push(id);
    }
  }

  kantoCacheReady = true;
  // return { kantoSpecies, rates, weightedSpawnPool };
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