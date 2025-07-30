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

function getNextLevelXp(level) {
  if (level <= 1) return 0;
  // XP required to reach this level (cumulative): sum of 100 * i for i = 2 to level
  let xp = 0;
  for (let i = 2; i <= level; i++) {
    xp += 100 * i;
  }
  return xp;
}

function getLevelForXp(xp) {
  let level = 1;
  while (xp >= getNextLevelXp(level + 1)) {
    level++;
    if (level > 100) break; // safety cap
  }
  return level;
}

// Shop unlock levels
const SHOP_UNLOCKS = [
  { key: 'rare', name: 'Great Poké Ball', level: 5 },
  { key: 'ultra', name: 'Ultra Poké Ball', level: 10 },
  { key: 'xp', name: 'XP Booster', level: 15 },
  { key: 'evolution', name: "Evolver's Ring", level: 20 },
];

function getUnlockedShopItems(level) {
  return SHOP_UNLOCKS.filter(item => level >= item.level);
}

// Helper to get next evolution IDs for a given Pokémon and stage offset
async function getNextEvolutionIds(currentId, stage = 1) {
  // 1. Fetch species data
  const speciesData = await fetchJson(
    `https://pokeapi.co/api/v2/pokemon-species/${currentId}/`
  );
  if (!speciesData?.evolution_chain?.url) return [];

  // 2. Fetch evolution chain
  const evoChainData = await fetchJson(speciesData.evolution_chain.url);

  // 3. Walk the chain to find the node for currentId
  function findNode(chain, targetId) {
    const extractId = url =>
      parseInt(url.split("/").filter(Boolean).pop(), 10);

    if (extractId(chain.species.url) === targetId) return chain;

    for (const child of chain.evolves_to || []) {
      const found = findNode(child, targetId);
      if (found) return found;
    }
    return null;
  }

  const startNode = findNode(evoChainData.chain, currentId);
  if (!startNode) return [];

  // 4. From that node, step `stage` levels deep over *all* branches
  let frontier = [startNode];
  for (let i = 0; i < stage; i++) {
    frontier = frontier.flatMap((node) => node.evolves_to || []);
    if (frontier.length === 0) return [];
  }

  // 5. Map each resulting node to its Pokémon ID
  const extractId = url =>
    parseInt(url.split("/").filter(Boolean).pop(), 10);

  return frontier.map((node) => extractId(node.species.url));
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
  getNextEvolutionIds,
  randomNature,
}; 