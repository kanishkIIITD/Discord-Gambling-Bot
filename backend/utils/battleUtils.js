// battleUtils.js

/**
 * Calculate real Pokémon stats at a given level using base stats, IVs, EVs, nature, and ability multipliers.
 * @param {Object} pokeApiStats - Array from PokéAPI's pokemon.stats
 * @param {number} level - Level to calculate stats for (default 50)
 * @param {Object} [ivs] - { hp, attack, defense, spAttack, spDefense, speed } (0-31)
 * @param {Object} [evs] - { hp, attack, defense, spAttack, spDefense, speed } (0-252)
 * @param {string} [nature] - Nature name (e.g. 'adamant')
 * @param {string} [ability] - Ability name (optional)
 * @returns {Object} stats: { hp, attack, defense, spAttack, spDefense, speed }
 */
function calculateStats(pokeApiStats, level = 50, ivs = {}, evs = {}, nature = 'hardy', ability = '') {
  // Default IV/EV if not provided
  const IV = (stat, fallback = 31) => typeof ivs[stat] === 'number' ? ivs[stat] : fallback;
  const EV = (stat, fallback = 0) => typeof evs[stat] === 'number' ? evs[stat] : fallback;

  // Helper to get base stat by name, mapping to stat keys
  const statKeyMap = {
    'hp': 'hp',
    'attack': 'attack',
    'defense': 'defense',
    'special-attack': 'spAttack',
    'special-defense': 'spDefense',
    'speed': 'speed',
  };
  const getBase = (name) => {
    const statObj = pokeApiStats.find(s => s.stat.name === name);
    return statObj ? statObj.base_stat : 0;
  };

  // Nature chart: maps nature to per-stat multipliers
  const natureChart = {
    hardy:   { attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
    lonely:  { attack: 1.1, defense: 0.9, spAttack: 1, spDefense: 1, speed: 1 },
    brave:   { attack: 1.1, defense: 1, spAttack: 1, spDefense: 1, speed: 0.9 },
    adamant: { attack: 1.1, defense: 1, spAttack: 0.9, spDefense: 1, speed: 1 },
    naughty: { attack: 1.1, defense: 1, spAttack: 1, spDefense: 0.9, speed: 1 },
    bold:    { attack: 0.9, defense: 1.1, spAttack: 1, spDefense: 1, speed: 1 },
    docile:  { attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
    relaxed: { attack: 1, defense: 1.1, spAttack: 1, spDefense: 1, speed: 0.9 },
    impish:  { attack: 1, defense: 1.1, spAttack: 0.9, spDefense: 1, speed: 1 },
    lax:     { attack: 1, defense: 1.1, spAttack: 1, spDefense: 0.9, speed: 1 },
    timid:   { attack: 0.9, defense: 1, spAttack: 1, spDefense: 1, speed: 1.1 },
    hasty:   { attack: 1, defense: 0.9, spAttack: 1, spDefense: 1, speed: 1.1 },
    serious: { attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
    jolly:   { attack: 1, defense: 1, spAttack: 0.9, spDefense: 1, speed: 1.1 },
    naive:   { attack: 1, defense: 1, spAttack: 1, spDefense: 0.9, speed: 1.1 },
    modest:  { attack: 0.9, defense: 1, spAttack: 1.1, spDefense: 1, speed: 1 },
    mild:    { attack: 1, defense: 0.9, spAttack: 1.1, spDefense: 1, speed: 1 },
    quiet:   { attack: 1, defense: 1, spAttack: 1.1, spDefense: 1, speed: 0.9 },
    bashful: { attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
    rash:    { attack: 1, defense: 1, spAttack: 1.1, spDefense: 0.9, speed: 1 },
    calm:    { attack: 0.9, defense: 1, spAttack: 1, spDefense: 1.1, speed: 1 },
    gentle:  { attack: 1, defense: 0.9, spAttack: 1, spDefense: 1.1, speed: 1 },
    sassy:   { attack: 1, defense: 1, spAttack: 1, spDefense: 1.1, speed: 0.9 },
    careful: { attack: 1, defense: 1, spAttack: 0.9, spDefense: 1.1, speed: 1 },
    quirky:  { attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
  };
  const nat = natureChart[nature?.toLowerCase()] || natureChart['hardy'];

  // Ability multipliers
  let abilityMultipliers = {};
  if (ability && typeof ability === 'string') {
    const ab = abilityRegistry?.[ability.toLowerCase?.()];
    if (ab && ab.staticMultipliers) abilityMultipliers = ab.staticMultipliers;
  }

  // Calculate stats
  const stats = {};
  for (const [pokeKey, statKey] of Object.entries(statKeyMap)) {
    if (pokeKey === 'hp') {
      stats.hp = Math.floor(((2 * getBase('hp') + IV('hp') + Math.floor(EV('hp') / 4)) * level) / 100) + level + 10;
    } else {
      // e.g., statKey = 'spAttack', pokeKey = 'special-attack'
      const base = getBase(pokeKey);
      const natMult = nat[statKey] || 1;
      const abMult = abilityMultipliers[statKey] || 1;
      stats[statKey] = Math.floor(( (2 * base + IV(statKey) + Math.floor(EV(statKey) / 4)) * level ) / 100 + 5) * natMult * abMult;
      stats[statKey] = Math.floor(stats[statKey]);
    }
  }
  return stats;
}

/**
 * Convert stat stage (-6 to +6) to multiplier.
 * @param {number} stage
 * @returns {number}
 */
function stageMultiplier(stage) {
  if (stage === 0) return 1;
  if (stage > 0) return (2 + stage) / 2;
  return 2 / (2 - stage);
}

const axios = require('axios');

/**
 * Fetch all level-up moves for a Pokémon at a given level and version group.
 * Returns up to 4 highest-power damaging moves (with power > 0).
 * @param {string} pokemonName - Name of the Pokémon (lowercase)
 * @param {number} level - Level to check (default 50)
 * @param {string} versionGroup - PokéAPI version group (default 'red-blue')
 * @param {number} battleSize - Number of Pokémon per team (default 5)
 * @returns {Promise<Array>} Array of move objects: { name, power, moveType, category, accuracy, effectivePP, currentPP, learnedAt }
 */
async function getLegalMoveset(
  pokemonName,
  level = 100,
  battleSize = 5
) {
  const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName.toLowerCase()}`);
  const data = res.data;

  const allowedMethods = ['level-up', 'machine', 'tutor', 'egg'];

  const allMoves = data.moves
    .map(m => {
      // Filter version_group_details that use allowed learning methods
      const details = m.version_group_details.filter(d =>
        allowedMethods.includes(d.move_learn_method.name)
      );
      if (details.length === 0) return null;
      return {
        name: m.move.name,
        url: m.move.url,
        learnedAt: Math.max(...details.map(d => d.level_learned_at || 0)), // some methods may have level 0
      };
    })
    .filter(Boolean);

  // Fetch move details and effect info
  const moveDetails = await Promise.all(allMoves.map(async (move) => {
    try {
      const moveRes = await axios.get(move.url);
      const moveData = moveRes.data;
      const basePP = moveData.pp || 5;
      const effectivePP = Math.ceil(basePP * (battleSize / 5));
      return {
        name: move.name,
        power: moveData.power || 0,
        moveType: moveData.type.name,
        category: moveData.damage_class.name,
        accuracy: moveData.accuracy || 100,
        effectivePP,
        currentPP: effectivePP,
        learnedAt: move.learnedAt,
        effectType: moveEffectRegistry[move.name]?.type || null,
      };
    } catch (err) {
      return null; // skip failed fetches
    }
  }));

  // Separate damaging and effect moves
  const damagingMoves = moveDetails
    .filter(m => m && m.power > 0)
    .sort((a, b) => b.power - a.power || b.learnedAt - a.learnedAt);
  const effectMoves = moveDetails
    .filter(m => m && m.power === 0 && m.effectType)
    .sort((a, b) => b.learnedAt - a.learnedAt);

  // Pick up to 2 of each for a balanced set
  const selectedMoves = [
    ...damagingMoves.slice(0, 2),
    ...effectMoves.slice(0, 2)
  ].slice(0, 4);

  return selectedMoves;
}


/**
 * Calculate damage using the official Pokémon formula, with weather and terrain modifiers.
 * @param {Object} attacker - { level, stats: {attack, spAttack}, types: [string] }
 * @param {Object} defender - { stats: {defense, spDefense}, types: [string] }
 * @param {Object} move - { power, type, category }
 * @param {number} [typeEffectiveness=1.0] - Multiplier for type effectiveness
 * @param {string|null} [weather] - Current weather condition
 * @param {string|null} [terrain] - Current terrain condition
 * @returns {Object} { damage, breakdown }
 */
function calculateDamage(attacker, defender, move, typeEffectiveness = 1.0, weather = null, terrain = null) {
  const level = attacker.level || 100;
  const power = move.power;
  if (!power) return { damage: 0, breakdown: { reason: 'No power' } };
  // Determine if move is physical or special
  const isPhysical = move.category === 'physical';
  const A = isPhysical ? attacker.stats.attack : attacker.stats.spAttack;
  const D = isPhysical ? defender.stats.defense : defender.stats.spDefense;
  // STAB
  const stab = attacker.types.includes(move.type) ? 1.5 : 1.0;
  // Critical hit (6.25% chance)
  const critical = Math.random() < 0.0625 ? 1.5 : 1.0;
  // Random factor
  const random = 0.85 + Math.random() * 0.15;
  // Weather modifier
  let weatherMod = 1.0;
  if (weather === 'rain') {
    if (move.type === 'water') weatherMod = 1.5;
    if (move.type === 'fire') weatherMod = 0.5;
  } else if (weather === 'sunny') {
    if (move.type === 'fire') weatherMod = 1.5;
    if (move.type === 'water') weatherMod = 0.5;
  }
  // Terrain modifier
  let terrainMod = 1.0;
  if (terrain === 'electric' && move.type === 'electric') terrainMod = 1.3;
  // Add more terrain effects as needed
  // Base damage
  const base = Math.floor(
    ((2 * level / 5 + 2) * power * A / D) / 50 + 2
  );
  // Modifier
  const modifier = stab * typeEffectiveness * critical * random * weatherMod * terrainMod;
  const damage = Math.max(1, Math.floor(base * modifier));
  return {
    damage,
    breakdown: {
      base,
      stab,
      typeEffectiveness,
      critical,
      random,
      weather,
      weatherMod,
      terrain,
      terrainMod,
      modifier,
      A,
      D,
      level,
      power,
      isPhysical,
    }
  };
}

// --- Static type effectiveness chart (Gen 9, simplified) ---
// typeChart[attackingType][defendingType] = multiplier
const typeChart = {
  normal:    { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:      { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:     { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric:  { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:     { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:       { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting:  { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, ghost: 0, fairy: 0.5 },
  poison:    { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:    { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:    { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:   { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:       { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:      { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:     { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:    { dragon: 2, steel: 0.5, fairy: 0 },
  dark:      { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:     { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, fairy: 2, steel: 0.5 },
  fairy:     { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5, fairy: 1 },
};

/**
 * Get type effectiveness multiplier for a move type against defender types.
 * @param {string} moveType - Attacking move type
 * @param {string[]} defenderTypes - Array of defender's types
 * @returns {number} Effectiveness multiplier (e.g., 2, 0.5, 0)
 */
function getTypeEffectiveness(moveType, defenderTypes) {
  let multiplier = 1.0;
  for (const defType of defenderTypes) {
    if (typeChart[moveType] && typeChart[moveType][defType] !== undefined) {
      multiplier *= typeChart[moveType][defType];
    }
  }
  return multiplier;
}

/**
 * Get the accuracy/evasion multiplier for a given stage (-6 to +6).
 * @param {number} stage
 * @returns {number}
 */
function accuracyEvasionMultiplier(stage) {
  if (stage === 0) return 1;
  if (stage > 0) return (3 + stage) / 3;
  return 3 / (3 - stage);
}

/**
 * Calculate the final hit chance for a move, factoring in accuracy/evasion boosts.
 * @param {number} baseAccuracy - The move's base accuracy (e.g., 90)
 * @param {number} userAccuracyStage - The user's accuracy boost stage
 * @param {number} targetEvasionStage - The target's evasion boost stage
 * @returns {number} - Final hit chance as a percentage (0-100)
 */
function calcFinalAccuracy(baseAccuracy, userAccuracyStage = 0, targetEvasionStage = 0) {
  const accMult = accuracyEvasionMultiplier(userAccuracyStage);
  const evaMult = accuracyEvasionMultiplier(-targetEvasionStage); // evasion is inverted
  return Math.max(1, Math.min(100, Math.round(baseAccuracy * accMult * evaMult)));
}

// --- Move Effect Registry ---
// Maps move names (lowercase, hyphenated) to effect metadata
const moveEffectRegistry = {
  // Stat-boosting moves
  "swords-dance": {
    type: "boost",
    stat: "attack",
    delta: 2,
    target: "self",
    message: "Attack sharply rose!"
  },
  "growl": {
    type: "boost",
    stat: "attack",
    delta: -1,
    target: "foe",
    message: "Attack fell!"
  },
  "tail-whip": {
    type: "boost",
    stat: "defense",
    delta: -1,
    target: "foe",
    message: "Defense fell!"
  },
  // Status-inflicting moves
  "thunder-wave": {
    type: "status",
    status: "paralyzed",
    target: "foe",
    chance: 100,
    message: "was paralyzed! It may be unable to move!"
  },
  "toxic": {
    type: "status",
    status: "badly-poisoned",
    target: "foe",
    chance: 90,
    message: "was badly poisoned!"
  },
  // Weather/terrain moves
  "rain-dance": {
    type: "weather",
    weather: "rain",
    duration: 5,
    message: "It started to rain!"
  },
  "sunny-day": {
    type: "weather",
    weather: "sunny",
    duration: 5,
    message: "The sunlight turned harsh!"
  },
  "electric-terrain": {
    type: "terrain",
    terrain: "electric",
    duration: 5,
    message: "An electric current runs across the battlefield!"
  },
  // Multi-boost example
  "cosmic-power": {
    type: "multi-boost",
    boosts: [
      { stat: "defense", delta: 1 },
      { stat: "spDefense", delta: 1 }
    ],
    target: "self",
    message: "Defense and Sp. Def rose!"
  },
  // Damage + status example
  "scald": {
    type: "damage+status",
    status: "burned",
    target: "foe",
    chance: 30,
    message: "was burned!"
  },
};

// --- Ability Registry ---
// Maps ability names (lowercase, hyphenated) to effect metadata and event handlers
const abilityRegistry = {
  // Huge Power: doubles attack stat
  "huge-power": {
    staticMultipliers: { attack: 2 },
    description: "Doubles the Pokémon's Attack stat.",
  },
  // Pure Power: doubles attack stat
  "pure-power": {
    staticMultipliers: { attack: 2 },
    description: "Doubles the Pokémon's Attack stat.",
  },
  // Intimidate: lowers opponent's attack by 1 stage on switch-in
  "intimidate": {
    onSwitch: (self, target, session, log) => {
      target.boosts = target.boosts || {};
      target.boosts.attack = Math.max(-6, (target.boosts.attack || 0) - 1);
      log.push({ side: 'user', userId: self.ownerId, text: `${self.name}'s Intimidate lowered ${target.name}'s Attack!` });
    },
    description: "Lowers the opponent's Attack by 1 stage on switch-in.",
  },
  // Rough Skin: damages attacker on contact (for future onDamage)
  "rough-skin": {
    onDamage: (self, attacker, move, session, log) => {
      // Example: deal 1/8 max HP to attacker if move is contact
      if (move.category === 'physical') {
        const dmg = Math.max(1, Math.floor(self.maxHp / 8));
        attacker.currentHp = Math.max(0, (attacker.currentHp || attacker.maxHp) - dmg);
        log.push({ side: 'user', userId: self.ownerId, text: `${attacker.name} was hurt by ${self.name}'s Rough Skin!` });
      }
    },
    description: "Damages attacker on contact.",
  },
  // Add more abilities as needed
};

module.exports = {
  calculateStats,
  getLegalMoveset,
  calculateDamage,
  getTypeEffectiveness,
  stageMultiplier,
  moveEffectRegistry,
  abilityRegistry,
  accuracyEvasionMultiplier,
  calcFinalAccuracy,
}; 