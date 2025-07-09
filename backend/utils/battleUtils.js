// battleUtils.js

/**
 * Calculate real Pokémon stats at a given level using base stats from PokéAPI.
 * @param {Object} pokeApiStats - Array from PokéAPI's pokemon.stats
 * @param {number} level - Level to calculate stats for (default 50)
 * @returns {Object} stats: { hp, attack, defense, spAttack, spDefense, speed }
 */
function calculateStats(pokeApiStats, level = 50) {
  // IV = 31, EV = 0, neutral nature
  const IV = 31;
  const EV = 0;
  const nature = 1.0; // neutral

  // Helper to get base stat by name
  const getBase = (name) => {
    const statObj = pokeApiStats.find(s => s.stat.name === name);
    return statObj ? statObj.base_stat : 0;
  };

  const baseHP = getBase('hp');
  const baseAtk = getBase('attack');
  const baseDef = getBase('defense');
  const baseSpA = getBase('special-attack');
  const baseSpD = getBase('special-defense');
  const baseSpe = getBase('speed');

  // HP formula
  const hp = Math.floor(((2 * baseHP + IV + Math.floor(EV / 4)) * level) / 100) + level + 10;
  // Other stats formula
  const stat = (base) => Math.floor(( (2 * base + IV + Math.floor(EV / 4)) * level ) / 100 ) + 5;

  return {
    hp,
    attack: Math.floor(stat(baseAtk) * nature),
    defense: Math.floor(stat(baseDef) * nature),
    spAttack: Math.floor(stat(baseSpA) * nature),
    spDefense: Math.floor(stat(baseSpD) * nature),
    speed: Math.floor(stat(baseSpe) * nature),
  };
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
  level = 50,
  battleSize = 5,
  versionGroup = 'red-blue'
) {
  // Fetch Pokémon data
  const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName.toLowerCase()}`);
  const data = res.data;
  // Allow both level-up and TM/tutor moves
  const methods = ['level-up'];
  const levelUpMoves = data.moves
    .map(m => {
      // Find the highest level_learned_at for this version group and allowed methods
      const details = m.version_group_details.filter(d =>
        methods.includes(d.move_learn_method.name) &&
        d.version_group.name === versionGroup &&
        d.level_learned_at <= level // TM/tutor entries often have level_learned_at = 0
      );
      if (details.length === 0) return null;
      return {
        name: m.move.name,
        url: m.move.url,
        learnedAt: Math.max(...details.map(d => d.level_learned_at)),
      };
    })
    .filter(Boolean);
  // Fetch move details for all moves
  const moveDetails = await Promise.all(levelUpMoves.map(async (move) => {
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
    };
  }));
  // Only damaging moves, sort by power, then learnedAt
  return moveDetails
    .filter(m => m.power > 0)
    .sort((a, b) => b.power - a.power || b.learnedAt - a.learnedAt)
    .slice(0, 4);
}

/**
 * Calculate damage using the official Pokémon formula.
 * @param {Object} attacker - { level, stats: {attack, spAttack}, types: [string] }
 * @param {Object} defender - { stats: {defense, spDefense}, types: [string] }
 * @param {Object} move - { power, type, category }
 * @param {number} [typeEffectiveness=1.0] - Multiplier for type effectiveness
 * @returns {Object} { damage, breakdown }
 */
function calculateDamage(attacker, defender, move, typeEffectiveness = 1.0) {
  const level = attacker.level || 50;
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
  // Base damage
  const base = Math.floor(
    ((2 * level / 5 + 2) * power * A / D) / 50 + 2
  );
  // Modifier
  const modifier = stab * typeEffectiveness * critical * random;
  const damage = Math.max(1, Math.floor(base * modifier));
  return {
    damage,
    breakdown: {
      base,
      stab,
      typeEffectiveness,
      critical,
      random,
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

module.exports = {
  calculateStats,
  getLegalMoveset,
  calculateDamage,
  getTypeEffectiveness,
}; 