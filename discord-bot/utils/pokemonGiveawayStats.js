const fs = require('fs/promises');
const path = require('path');

const STATS_FILE = path.resolve(__dirname, '..', 'pokemonGiveawayStats.json');

let statsCache = null;
let saveInFlight = false;

async function loadStats() {
  try {
    const data = await fs.readFile(STATS_FILE, 'utf8');
    statsCache = JSON.parse(data);
  } catch (err) {
    // Initialize empty if file missing or invalid
    statsCache = {};
  }
}

async function saveStats() {
  if (!statsCache) return;
  // Avoid overlapping writes
  if (saveInFlight) return;
  saveInFlight = true;
  try {
    await fs.writeFile(STATS_FILE, JSON.stringify(statsCache, null, 2));
  } catch (err) {
    console.error('[PokemonGiveawayStats] Failed to save stats:', err);
  } finally {
    saveInFlight = false;
  }
}

async function ensureLoaded() {
  if (!statsCache) await loadStats();
}

function ensureUser(guildId, userId) {
  if (!statsCache[guildId]) statsCache[guildId] = {};
  if (!statsCache[guildId][userId]) statsCache[guildId][userId] = { hosted: 0, won: 0, entries: 0 };
}

async function incrementHosted(guildId, userId, amount = 1) {
  await ensureLoaded();
  ensureUser(guildId, userId);
  statsCache[guildId][userId].hosted += amount;
  await saveStats();
}

async function incrementWon(guildId, userId, amount = 1) {
  await ensureLoaded();
  ensureUser(guildId, userId);
  statsCache[guildId][userId].won += amount;
  await saveStats();
}

async function incrementEntries(guildId, userId, amount = 1) {
  await ensureLoaded();
  ensureUser(guildId, userId);
  statsCache[guildId][userId].entries += amount;
  await saveStats();
}

async function getLeaderboard(guildId, sortBy = 'won', limit = 10) {
  await ensureLoaded();
  const guildStats = statsCache[guildId] || {};
  const entries = Object.entries(guildStats).map(([userId, data]) => ({ userId, ...data }));
  const validSort = ['won', 'hosted', 'entries'].includes(sortBy) ? sortBy : 'won';
  entries.sort((a, b) => (b[validSort] || 0) - (a[validSort] || 0));
  return entries.slice(0, Math.max(1, Math.min(limit, 25)));
}

module.exports = {
  incrementHosted,
  incrementWon,
  incrementEntries,
  getLeaderboard,
};


