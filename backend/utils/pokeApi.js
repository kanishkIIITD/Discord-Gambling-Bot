const axios = require('axios');
const path = require('path');
const fs = require('fs');

async function fetchJson(url) {
  const res = await axios.get(url);
  return res.data;
}

async function getPokemonDataById(id) {
  return fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}/`);
}

async function getMoveDataByUrl(url) {
  return fetchJson(url);
}

// Load custom spawn rates JSON once at startup
const customSpawnRatesPath = path.join(__dirname, 'customSpawnRates.json');
let customSpawnRates = {};
try {
  customSpawnRates = JSON.parse(fs.readFileSync(customSpawnRatesPath, 'utf8'));
} catch (e) {
  console.error('Failed to load customSpawnRates.json:', e);
  customSpawnRates = {};
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function getCustomSpawnInfo(name) {
  if (!name) return null;
  const key = normalizeName(name);
  return customSpawnRates[key] || null;
}

// Level curve: Level 1→2: 100 XP, then each next level requires 1.4x previous (rounded)
function getNextLevelXp(level) {
  if (level <= 1) return 0; // Fix: XP required to reach level 1 is 0
  let xp = 100;
  for (let i = 2; i < level; i++) {
    xp = Math.round(xp * 1.4);
  }
  return xp;
}

function getLevelForXp(xp) {
  let level = 1;
  let nextLevelXp = 100;
  let currentLevelXp = 0;
  while (xp >= nextLevelXp) {
    level++;
    currentLevelXp = nextLevelXp;
    nextLevelXp = getNextLevelXp(level + 1);
  }
  return level;
}

// Shop unlock levels
const SHOP_UNLOCKS = [
  { key: 'rare', name: 'Rare Poké Ball', level: 5 },
  { key: 'ultra', name: 'Ultra Poké Ball', level: 10 },
  { key: 'xp', name: 'XP Booster', level: 15 },
  { key: 'evolution', name: "Evolver's Ring", level: 20 },
];

function getUnlockedShopItems(level) {
  return SHOP_UNLOCKS.filter(item => level >= item.level);
}

// Helper to get next evolution ID for a given Pokémon and stage
async function getNextEvolutionId(currentId, stage) {
  // 1. Fetch species data
  const speciesData = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${currentId}/`);
  if (!speciesData || !speciesData.evolution_chain || !speciesData.evolution_chain.url) return null;
  // 2. Fetch evolution chain
  const evoChainData = await fetchJson(speciesData.evolution_chain.url);
  // 3. Walk the chain to find the current Pokémon and its next evolution
  // The chain is a nested structure: chain -> evolves_to[] -> evolves_to[] ...
  function findEvolution(chain, targetId, currentStage = 1) {
    // Get the Pokémon ID from the species URL
    const getId = url => parseInt(url.split('/').filter(Boolean).pop(), 10);
    const thisId = getId(chain.species.url);
    if (thisId === targetId) {
      // Return the next evolution at the requested stage
      let node = chain;
      for (let i = 0; i < stage; i++) {
        if (!node.evolves_to || node.evolves_to.length === 0) return null;
        node = node.evolves_to[0];
      }
      return getId(node.species.url);
    }
    // Recurse into evolves_to
    for (const evo of chain.evolves_to || []) {
      const found = findEvolution(evo, targetId, currentStage + 1);
      if (found) return found;
    }
    return null;
  }
  return findEvolution(evoChainData.chain, currentId, 1);
}

// Helper to generate a random nature
function randomNature() {
  const natures = [
    'hardy', 'lonely', 'brave', 'adamant', 'naughty',
    'bold', 'docile', 'relaxed', 'impish', 'lax',
    'timid', 'hasty', 'serious', 'jolly', 'naive',
    'modest', 'mild', 'quiet', 'bashful', 'rash',
    'calm', 'gentle', 'sassy', 'careful', 'quirky'
  ];
  return natures[Math.floor(Math.random() * natures.length)];
}

module.exports = {
  getPokemonDataById,
  getMoveDataByUrl,
  getCustomSpawnInfo,
  getLevelForXp,
  getNextLevelXp,
  getUnlockedShopItems,
  getNextEvolutionId,
  randomNature,
}; 