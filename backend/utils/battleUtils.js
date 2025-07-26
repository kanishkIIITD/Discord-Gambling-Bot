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
const { VERSION_GROUPS } = require('./versionGroupConfig');

/**
 * Determine a Pokémon's combat style based on IV, EV, and nature.
 * @param {Object} params
 * @param {Array} params.iv - IVs array [HP, Atk, Def, SpA, SpD, Spe]
 * @param {Array} params.ev - EVs array [HP, Atk, Def, SpA, SpD, Spe]
 * @param {string} params.nature - Nature name (e.g. 'adamant')
 * @returns {string} Combat style: 'physical', 'special', 'defensive', 'speedster', or 'balanced'
 */
function getCombatStyle({ iv = [31,31,31,31,31,31], ev = [0,0,0,0,0,0], nature = 'hardy' }) {
  // Biases: [HP, Atk, Def, SpA, SpD, Spe]
  let phyBias = (iv[1] || 0) + (ev[1] || 0);
  let spaBias = (iv[3] || 0) + (ev[3] || 0);
  const defBias = (iv[2] || 0) + (ev[2] || 0) + (iv[4] || 0) + (ev[4] || 0);
  const spdBias = (iv[5] || 0) + (ev[5] || 0);
  // Apply nature multipliers to physical and special bias
  const nat = natureChart[nature?.toLowerCase()] || natureChart['hardy'];
  phyBias *= nat.attack || 1;
  spaBias *= nat.spAttack || 1;
  if (phyBias > spaBias + 30) return 'physical';
  if (spaBias > phyBias + 30) return 'special';
  if (defBias > phyBias + spaBias) return 'defensive';
  if (spdBias > 100) return 'speedster';
  return 'balanced';
}

/**
 * Fetch all level-up moves for a Pokémon at a given level and version group.
 * Returns up to 4 highest-power damaging moves (with power > 0).
 * @param {string} pokemonName - Name of the Pokémon (lowercase)
 * @param {number} level - Level to check (default 50)
 * @param {number} battleSize - Number of Pokémon per team (default 5)
 * @param {string} [ability] - Pokémon's ability (optional)
 * @param {string} [nature] - Pokémon's nature (optional)
 * @param {Array} [iv] - IVs array [HP, Atk, Def, SpA, SpD, Spe] (optional)
 * @param {Array} [ev] - EVs array [HP, Atk, Def, SpA, SpD, Spe] (optional)
 * @param {string} [ownerId] - Discord user ID (optional)
 * @param {string} [pokemonUniqueId] - Unique per-captured-mon identifier (optional)
 * @returns {Promise<Array>} Array of move objects: { name, power, moveType, category, accuracy, effectivePP, currentPP, learnedAt }
 */
async function getLegalMoveset(
  pokemonName,
  level = 50,
  battleSize = 5,
  ability = '',
  nature = 'hardy',
  iv = [31, 31, 31, 31, 31, 31],
  ev = [0, 0, 0, 0, 0, 0],
  ownerId = '',
  pokemonUniqueId = ''
) {
  const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName.toLowerCase()}`);
  const data = res.data;
  const allowedMethods = ['level-up', 'machine', 'tutor', 'egg'];
  let allMoves = [];
  let usedVersionGroups = [];
  let damagingMoves = [];
  let effectMoves = [];
  const uniqueByName = arr => Object.values(arr.reduce((acc, m) => { if (m && !acc[m.name]) acc[m.name] = m; return acc; }, {}));
  for (const vg of VERSION_GROUPS) {
    usedVersionGroups.push(vg.key);
    const filteredMoves = data.moves
      .map(m => {
        const details = m.version_group_details.filter(d =>
          allowedMethods.includes(d.move_learn_method.name) &&
          usedVersionGroups.includes(d.version_group.name)
        );
        if (details.length === 0) return null;
        const learnedAt = Math.max(...details.map(d => d.level_learned_at || 0));
        if (learnedAt > level) return null;
        return {
          name: m.move.name,
          url: m.move.url,
          learnedAt,
        };
      })
      .filter(Boolean);
    allMoves = [...allMoves, ...filteredMoves];
    const moveDetails = await Promise.all(filteredMoves.map(async (move) => {
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
          effectType: moveEffectRegistry[move.name.toLowerCase()]?.type || null,
          effectEntries: moveData.effect_entries || [],
          meta: moveData.meta || {},
        };
      } catch (err) {
        return null;
      }
    }));
    damagingMoves = uniqueByName([...damagingMoves, ...moveDetails.filter(m => m && m.power > 0)]);
    effectMoves = uniqueByName([...effectMoves, ...moveDetails.filter(m => m && m.power === 0 && m.effectType)]);
    if (damagingMoves.length >= 3) break;
  }
  // --- Categorize move pools ---
  // Use existing pokemonTypes if already declared above
  // If not, declare it here
  // (Check if pokemonTypes is already declared in the function scope)
  // For now, assume it's not declared above in this function
  const pokemonTypes = data.types.map(t => t.type.name);
  let normalPool = damagingMoves.filter(m => m.moveType === 'normal' || m.moveType === 'none' || m.moveType === 'typeless');
  let stabPool = damagingMoves.filter(m => pokemonTypes.includes(m.moveType));
  let altPool = damagingMoves.filter(m => !pokemonTypes.includes(m.moveType) && m.moveType !== 'normal' && m.moveType !== 'none' && m.moveType !== 'typeless');
  let effectPool = effectMoves;
  // --- Expose categorized arrays for future logic ---
  // normalPool, stabPool, altPool, effectPool

  // --- Filter by ability (onTryHit) ---
  const abObj = abilityRegistry[ability?.toLowerCase?.()];
  if (abObj && typeof abObj.onTryHit === 'function') {
    // For each move pool, filter out moves that would be blocked by the ability
    const self = { types: pokemonTypes, ability };
    // Target is a dummy for now (move type as type array)
    const filterByAbility = (pool) => pool.filter(m => abObj.onTryHit(self, m, { types: m.moveType ? [m.moveType] : [] }, {}, []) !== false);
    normalPool = filterByAbility(normalPool);
    stabPool = filterByAbility(stabPool);
    altPool = filterByAbility(altPool);
    // effectPool is not filtered here
  }

  // --- Compute effective stats and expected damage for each move ---
  // Calculate user's stats (using calculateStats)
  const baseStats = data.stats;
  const stats = calculateStats(
    baseStats,
    level,
    { hp: iv[0], attack: iv[1], defense: iv[2], spAttack: iv[3], spDefense: iv[4], speed: iv[5] },
    { hp: ev[0], attack: ev[1], defense: ev[2], spAttack: ev[3], spDefense: ev[4], speed: ev[5] },
    nature,
    ability
  );
  // Assume a generic defender: level 50, all base stats 80, no IV/EV, neutral nature
  const genericDefender = {
    level: 50,
    stats: { attack: 80, defense: 80, spAttack: 80, spDefense: 80, speed: 80 },
    types: ['normal']
  };
  // Helper to compute expected damage for a move
  function computeExpectedDamage(move) {
    if (!move.power) return 0;
    const isPhysical = move.category === 'physical';
    const atk = isPhysical ? stats.attack : stats.spAttack;
    const def = isPhysical ? genericDefender.stats.defense : genericDefender.stats.spDefense;
    const stab = pokemonTypes.includes(move.moveType) ? 1.5 : 1.0;
    const typeEff = 1.0; // Assume neutral for now
    const base = Math.floor(((2 * level / 5 + 2) * move.power * atk / def) / 50 + 2);
    const modifier = stab * typeEff * (move.accuracy / 100);
    return Math.max(1, Math.floor(base * modifier));
  }
  // Add expectedDamage to each move in the pools
  for (const pool of [normalPool, stabPool, altPool]) {
    for (const move of pool) {
      move.expectedDamage = computeExpectedDamage(move);
    }
  }

  // --- Apply nature bias to move selection (weighted scoring) ---
  const nat = natureChart[nature?.toLowerCase()] || natureChart['hardy'];
  for (const pool of [normalPool, stabPool, altPool]) {
    for (const move of pool) {
      if (move.category === 'physical') {
        move.expectedDamage *= nat.attack || 1;
      } else if (move.category === 'special') {
        move.expectedDamage *= nat.spAttack || 1;
      }
    }
  }

  // --- Advanced competitive move selection ---
  // Build allBattleMoves pool for advanced selection
  const allBattleMoves = [...stabPool, ...altPool, ...normalPool, ...effectPool];
  // Build explicit pools
  const primaryStab = allBattleMoves
    .filter(m => isSameType(m, pokemonTypes))
    .sort((a, b) => b.expectedDamage - a.expectedDamage);
  const secondaryStab = primaryStab.filter((m, i) => i > 0);
  // Coverage: maximize marginal coverage gain
  let threatened = getThreatenedTypes([primaryStab[0]].filter(Boolean));
  const coverageCandidates = allBattleMoves.filter(m => !primaryStab.slice(0, 2).includes(m));
  const coverage = coverageCandidates
    .map(m => ({ move: m, gain: marginalCoverageGain(m, threatened, defaultOpponentTypeDistribution) }))
    .sort((a, b) => b.gain - a.gain)[0]?.move;
  // Priority moves
  const priorityPool = allBattleMoves.filter(m => m.priority > 0);
  // Recovery moves
  const recoveryPool = allBattleMoves.filter(m => m.effectType === 'heal' || m.meta?.heal);
  // Field control: hazards, weather, terrain
  const fieldPool = allBattleMoves.filter(m => ['hazard', 'weather', 'terrain'].includes(m.effectType));
  // Setup/boosters
  const setupPool = allBattleMoves.filter(m => ['boost', 'multi-boost'].includes(m.effectType));
  // Utility/status
  const utilityPool = allBattleMoves.filter(m => ['status'].includes(m.effectType));
  // Filler: any remaining effect moves
  const fillerPool = allBattleMoves.filter(m => ![
    ...primaryStab.slice(0, 2),
    coverage,
    ...priorityPool,
    ...recoveryPool,
    ...fieldPool,
    ...setupPool,
    ...utilityPool
  ].includes(m));

  // Use combat style to bias setup
  const combatStyle = getCombatStyle({ iv, ev, nature });

  // Selection order: primaryStab, secondaryStab, coverage, priority, recovery, field, setup (if style), utility, filler
  const selectedMoves = [];
  // 1. Primary STAB
  if (primaryStab.length) {
    const move = pickRandomTopN(primaryStab, 5);
    if (move) selectedMoves.push(move);
  }
  // 2. Secondary STAB
  if (secondaryStab.length) {
    const move = pickRandomTopN(secondaryStab, 5);
    if (move && !selectedMoves.some(m => m.name === move.name)) selectedMoves.push(move);
  }
  // 3. Coverage
  if (coverageCandidates && coverageCandidates.length) {
    const move = pickRandomTopN(coverageCandidates, 5);
    if (move && !selectedMoves.some(m => m.name === move.name)) selectedMoves.push(move);
  }
  // 4. Priority
  if (priorityPool.length) {
    const move = pickRandomTopN(priorityPool, 5);
    if (move && !selectedMoves.some(m => m.name === move.name)) selectedMoves.push(move);
  }
  // 5. Recovery
  if (recoveryPool.length) {
    const move = pickRandomTopN(recoveryPool, 5);
    if (move && !selectedMoves.some(m => m.name === move.name)) selectedMoves.push(move);
  }
  // 6. Field control
  if (fieldPool.length) {
    const move = pickRandomTopN(fieldPool, 5);
    if (move && !selectedMoves.some(m => m.name === move.name)) selectedMoves.push(move);
  }
  // 7. Setup/booster if style matches
  if ((combatStyle === 'physical' || combatStyle === 'special') && setupPool.length) {
    const move = pickRandomTopN(setupPool, 5);
    if (move && !selectedMoves.some(m => m.name === move.name)) selectedMoves.push(move);
  }
  // 8. Utility/status
  if (utilityPool.length) {
    const move = pickRandomTopN(utilityPool, 5);
    if (move && !selectedMoves.some(m => m.name === move.name)) selectedMoves.push(move);
  }
  // 9. Filler/backfill: prefer high-PP, avoid redundancy and low-PP stacking
  const fillerSorted = [...fillerPool].sort((a, b) => (b.effectivePP || 0) - (a.effectivePP || 0));
  if (fillerSorted.length) {
    const move = pickRandomTopN(fillerSorted, 5);
    if (move && !selectedMoves.some(m => m.name === move.name) && (move.effectivePP || 0) > 2) selectedMoves.push(move);
  }
  // If still less than 6, allow any remaining moves
  if (selectedMoves.length < 6) {
    for (const move of allBattleMoves) {
      if (selectedMoves.length >= 6) break;
      if (!selectedMoves.some(m => m.name === move.name)) selectedMoves.push(move);
    }
  }
  return selectedMoves.slice(0, 6);
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
  const level = attacker.level || 50;
  const power = move.power;
  if (!power) return { damage: 0, breakdown: { reason: 'No power' } };
  // Determine if move is physical or special
  const isPhysical = move.category === 'physical';
  let A = isPhysical ? attacker.stats.attack : attacker.stats.spAttack;
  let D = isPhysical ? defender.stats.defense : defender.stats.spDefense;
  // --- Sandstorm: Rock-type Sp. Def boost ---
  if (weather === 'sandstorm' && defender.types && defender.types.includes('rock') && !isPhysical) {
    D = Math.floor(D * 1.5);
  }
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
  } else if (weather === 'hail') {
    // Optional: In Gen 9, Blizzard does not always hit, but in older gens it does
    if (move.name === 'blizzard') move.accuracy = 100;
    // Optional: Ice-type moves can be boosted in hail (not in Gen 9, but some formats use it)
    if (move.type === 'ice') weatherMod = 1.5;
  } else if (weather === 'sandstorm') {
    // No direct damage boost, but Rock-type Sp. Def boost is handled above
    // (Per-turn chip damage is handled elsewhere)
  }
  // Terrain modifier
  let terrainMod = 1.0;
  if (terrain === 'electric' && move.type === 'electric') terrainMod = 1.3;
  // Grassy Terrain: boost Grass-type moves
  if (terrain === 'grassy' && move.type === 'grass') terrainMod = 1.3;
  // Grassy Terrain: weaken Earthquake, Magnitude, Bulldoze
  if (terrain === 'grassy' && ['earthquake','magnitude','bulldoze'].includes(move.name)) terrainMod = 0.5;
  // Misty Terrain: halve Dragon-type move damage
  if (terrain === 'misty' && move.type === 'dragon') terrainMod = 0.5;
  // Psychic Terrain: boost Psychic-type moves
  if (terrain === 'psychic' && move.type === 'psychic') terrainMod = 1.3;
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
  "swords-dance":    { type: "boost",      stat: "attack",       delta: 2, target: "self", message: "Attack sharply rose!" },
  "growl":           { type: "boost",      stat: "attack",       delta: -1, target: "foe",  message: "Attack fell!" },
  "tail-whip":       { type: "boost",      stat: "defense",      delta: -1, target: "foe",  message: "Defense fell!" },
  "calm-mind":       { type: "multi-boost", boosts: [{ stat: "specialAttack", delta: 1 }, { stat: "specialDefense", delta: 1 }], target: "self", message: "Sp. Atk and Sp. Def rose!" },
  // --- Added Stat-Altering Moves ---
  "leer":            { type: "boost",      stat: "defense",      delta: -1, target: "foe",  message: "Defense fell!" },
  "howl":            { type: "boost",      stat: "attack",       delta: 1, target: "self", message: "Attack rose!" },
  "work-up":         { type: "multi-boost", boosts: [{ stat: "attack", delta: 1 }, { stat: "specialAttack", delta: 1 }], target: "self", message: "Attack and Sp. Atk rose!" },
  "agility":         { type: "boost",      stat: "speed",        delta: 2, target: "self", message: "Speed sharply rose!" },
  "iron-defense":    { type: "boost",      stat: "defense",      delta: 2, target: "self", message: "Defense sharply rose!" },
  "nasty-plot":      { type: "boost",      stat: "specialAttack", delta: 2, target: "self", message: "Sp. Atk sharply rose!" },
  "amnesia":         { type: "boost",      stat: "specialDefense", delta: 2, target: "self", message: "Sp. Def sharply rose!" },
  "cotton-guard":    { type: "boost",      stat: "defense",      delta: 3, target: "self", message: "Defense drastically rose!" },
  "baby-doll-eyes":  { type: "boost",      stat: "attack",       delta: -1, target: "foe",  message: "Attack fell! (Priority)" },
  // Status Infliction
  "thunder-wave":    { type: "status",     status: "paralyzed",     target: "foe", chance: 100, message: "was paralyzed! It may be unable to move!" },
  "toxic":           { type: "status",     status: "badly-poisoned", target: "foe", chance: 90,  message: "was badly poisoned!" },
  "will-o-wisp":     { type: "status",     status: "burned",        target: "foe", chance: 100, message: "was burned!" },
  // --- Added Status Infliction Moves ---
  "sleep-powder":    { type: "status",     status: "asleep",        target: "foe", chance: 75,  message: "fell asleep!" },
  "hypnosis":        { type: "status",     status: "asleep",        target: "foe", chance: 60,  message: "fell asleep!" },
  "poison-powder":   { type: "status",     status: "poisoned",      target: "foe", chance: 75,  message: "was poisoned!" },
  "stun-spore":      { type: "status",     status: "paralyzed",     target: "foe", chance: 75,  message: "was paralyzed!" },
  "glare":           { type: "status",     status: "paralyzed",     target: "foe", chance: 100, message: "was paralyzed!" },
  "spore":           { type: "status",     status: "asleep",        target: "foe", chance: 100, message: "fell asleep!" },
  "lovely-kiss":     { type: "status",     status: "asleep",        target: "foe", chance: 75,  message: "fell asleep!" },
  // Recovery / Heal
  "rest":            { type: "heal",       amount: "full",            target: "self", message: "fell asleep and restored HP!" },
  "drain-punch":     { type: "drain",      percent: 50,               target: "foe",  message: "had its health drained!" },

  // Recoil moves
  "double-edge":     { type: "damage+recoil", recoil: 25,   target: "foe", message: "was hurt by recoil!" },

  // Self-fainting moves
  "self-destruct":   { type: "user-faints", message: "used Self-Destruct! It fainted!" },
  "explosion":       { type: "user-faints", message: "used Explosion! It fainted!" },

  // Stealth and hazards
  "spikes":          { type: "hazard",     hazard: "spikes",          layers: 1, duration: null, message: "Spikes were scattered on the foe's side!" },
  "toxic-spikes":    { type: "hazard",     hazard: "toxic-spikes",    layers: 1, duration: null, message: "Toxic Spikes were scattered around the foe!" },
  // --- Added Recovery / Heal Moves ---
  "recover":         { type: "heal",       amount: 50, target: "self", message: "restored its HP by half!" },
  "soft-boiled":     { type: "heal",       amount: 50, target: "self", message: "restored its HP by half!" },
  // Weather / Terrain
  "rain-dance":      { type: "weather",    weather: "rain",   duration: 5, message: "It started to rain!" },
  "sunny-day":       { type: "weather",    weather: "sunny",  duration: 5, message: "The sunlight turned harsh!" },
  "sandstorm":       { type: "weather",    weather: "sandstorm", duration: 5, message: "A sandstorm brewed!" },
  "electric-terrain":{ type: "terrain",   terrain: "electric", duration: 5, message: "An electric current runs across the battlefield!" },
  "hail":            { type: "weather",    weather: "hail", duration: 5, message: "It started to hail!" },
  // Damage + status example
  "scald":           { type: "damage+status", status: "burned",   target: "foe", chance: 30, message: "was burned!" },

  // Sound-based moves
  "hyper-voice":     { type: "sound",      damage: "normal", target: "foe", message: "was hit by a hyper voice!" },

  // Example multi-turn moves
  "solar-beam":      { type: "charge-attack", chargeTurns: 1, damageType: "special", message: "absorbed sunlight!" },

  // Entry move example
  "stealth-rock":    { type: "hazard",     hazard: "stealth-rock", layers: 1, duration: null, message: "Pointed stones float in the air around the foe!" },
  // --- Field Control & Hazard Removal ---
  "rapid-spin":      { type: "hazard-remove", removes: ["spikes","toxic-spikes","stealth-rock","sticky-web"], target: "self", message: "cleared hazards with Rapid Spin!" },
  "defog":           { type: "hazard-remove", removes: ["spikes","toxic-spikes","stealth-rock","sticky-web"], clearsBoosts: true, target: "self", message: "blew away hazards with Defog!" },
  "tailwind":        { type: "field", field: "tailwind", duration: 4, message: "A tailwind blew from behind! Team's Speed doubled!" },
  "trick-room":      { type: "field", field: "trick-room", duration: 5, message: "Dimensions twisted! Move order reversed!" },
  // --- Status-Curing & Team Support ---
  "heal-bell":       { type: "cure-team", cures: ["all-status"], target: "self", message: "calmed the party with Heal Bell!" },
  "aromatherapy":    { type: "cure-team", cures: ["all-status"], target: "self", message: "healed status with Aromatherapy!" },
  // --- Taunt / Encore / Disable ---
  "taunt":           { type: "prevent-status", prevents: ["boost","status"], target: "foe", duration: 3, message: "fell for Taunt! It can’t use status moves!" },
  "encore":          { type: "lock", lockedMove: true, target: "foe", duration: 3, message: "was trapped in Encore!" },
  "disable":         { type: "disable", disables: true, target: "foe", duration: 2, message: "had a move disabled!" },
  // --- Multi-Hit & Partial Trap Moves ---
  "double-hit":      { type: "multi-hit", hits: 2, damageType: "physical", target: "foe", message: "was struck twice!" },
  "fury-cutter":     { type: "multi-hit", hits: "2-5", damageType: "physical", target: "foe", message: "was shredded by Fury Cutter!" },
  "wrap":            { type: "partial-trap", minTurns: 2, maxTurns: 5, damageType: "physical", target: "foe", message: "was trapped by Wrap!" },
  "fire-spin":       { type: "partial-trap", minTurns: 2, maxTurns: 5, damageType: "special", target: "foe", message: "was trapped in Fire Spin!" },
  // --- Protect & Priority Variants ---
  "protect":         { type: "protect", successRate: 1, priority: 4, target: "self", message: "protected itself!" },
  "detect":          { type: "protect", successRate: 1, priority: 4, target: "self", message: "detected the attack!" },
  // --- Counter Moves ---
  "counter":         { type: "counter", reflectType: "physical", target: "foe", message: "struck back with Counter!" },
  "mirror-coat":     { type: "counter", reflectType: "special",  target: "foe", message: "struck back with Mirror Coat!" },
  // --- Confusion Moves ---
  "confuse-ray":     { type: "status",     status: "confused",      target: "foe", chance: 100, message: "became confused!" },
  "swagger":         { type: "status",     status: "confused",      target: "foe", chance: 90,  message: "became confused! (Attack rose!)" },
  "supersonic":      { type: "status",     status: "confused",      target: "foe", chance: 55,  message: "became confused!" },
  // --- Delayed Sleep ---
  "yawn":            { type: "status",     status: "asleep",        target: "foe", chance: 100, delayed: true, message: "became drowsy! Will fall asleep next turn." },
  // --- Delayed Healing ---
  "wish":            { type: "heal",       amount: 50, target: "self", delayed: true, message: "made a wish! HP will be restored next turn." },
  // --- Roost (Flying type removal for 1 turn) ---
  "roost":           { type: "heal",       amount: 50, target: "self", removeType: "flying", duration: 1, message: "restored its HP by half! (Flying type removed for 1 turn)" },
  // --- Remaining Terrains ---
  "grassy-terrain":  { type: "terrain",   terrain: "grassy", duration: 5, message: "The battlefield became grassy!" },
  "misty-terrain":   { type: "terrain",   terrain: "misty", duration: 5, message: "A mist swirled around the battlefield!" },
  "psychic-terrain": { type: "terrain",   terrain: "psychic", duration: 5, message: "A psychic aura enveloped the battlefield!" },
  // --- Screens & Team-Wide Buffs ---
  "light-screen":  { type: "team-field", field: "light-screen", duration: 5, target: "self", message: "light is reflected! (Light Screen)" },
  "reflect":       { type: "team-field", field: "reflect", duration: 5, target: "self", message: "reflecting moves! (Reflect)" },
  "aurora-veil":   { type: "team-field", field: "aurora-veil", duration: 5, target: "self", message: "a veil of aurora reduces damage! (Aurora Veil)" },
  "safeguard":     { type: "team-field", field: "safeguard", duration: 5, target: "self", message: "protected the team from status! (Safeguard)" },
  // --- Seed & Leech Effects ---
  "leech-seed":    { type: "leech", percent: 1/8, target: "foe", duration: null, message: "was seeded! HP will be drained each turn." },
  // --- Pivot & Disruption Moves ---
  "u-turn":        { type: "pivot", damageType: "physical", target: "foe", message: "hurt the foe then switched out! (U-Turn)" },
  "volt-switch":   { type: "pivot", damageType: "special",  target: "foe", message: "zapped the foe then switched out! (Volt Switch)" },
  // --- Spread & Area-of-Effect Moves ---
  "surf":          { type: "spread", damageType: "special", targets: "all-opponents", message: "hit all opponents with Surf!" },
  "earthquake":    { type: "spread", damageType: "physical", targets: "all-opponents", message: "shook the ground under all foes!" },
  // --- Niche Mechanics & Field Effects ---
  "haze":          { type: "clear-boosts", target: "all", message: "erased all stat changes! (Haze)" },
  "transform":     { type: "transform", target: "self", message: "transformed into the target!" },
};

// --- Ability Registry ---
// Maps ability names (lowercase, hyphenated) to effect metadata and event handlers
const abilityRegistry = {
  // Huge Power & Pure Power: doubles attack stat
  "huge-power": {
    staticMultipliers: { attack: 2 },
    description: "Doubles the Pokémon's Attack stat."
  },
  "pure-power": {
    staticMultipliers: { attack: 2 },
    description: "Doubles the Pokémon's Attack stat."
  },

  // Intimidate: lowers opponent's attack by 1 stage on switch-in
  "intimidate": {
    onSwitch: (self, target, session, log) => {
      target.boosts = target.boosts || {};
      target.boosts.attack = Math.max(-6, (target.boosts.attack || 0) - 1);
      log.push({ side: 'user', userId: self.ownerId, text: `${self.name}'s Intimidate lowered ${target.name}'s Attack!` });
    },
    description: "Lowers the opponent's Attack by 1 stage on switch-in."
  },

  // Rough Skin: damages attacker on contact
  "rough-skin": {
    onDamage: (self, attacker, move, session, log) => {
      if (move.category === 'physical') {
        const dmg = Math.max(1, Math.floor(self.maxHp / 8));
        attacker.currentHp = Math.max(0, (attacker.currentHp || attacker.maxHp) - dmg);
        log.push({ side: 'user', userId: self.ownerId, text: `${attacker.name} was hurt by ${self.name}'s Rough Skin!` });
      }
    },
    description: "Damages attacker on contact."
  },

  // Levitate: immune to Ground-type moves
  "levitate": {
    onTryHit: (self, move, target, session, log) => {
      if (move.type === 'ground') {
        log.push({ side: 'user', userId: self.ownerId, text: `${self.name} is immune to Ground moves due to Levitate!` });
        return false;
      }
      return true;
    },
    description: "Grants immunity to Ground-type moves."
  },

  // Sturdy: withstands one-hit KO from full HP
  "sturdy": {
    onDamage: (self, attacker, move, session, log) => {
      if (self.currentHp === self.maxHp && move.damage >= self.currentHp) {
        self.currentHp = 1;
        log.push({ side: 'user', userId: self.ownerId, text: `${self.name} hung on with Sturdy!` });
        return false;
      }
    },
    description: "Prevents being knocked out in one hit from full HP."
  },

  // Immunity: prevent poison
  "immunity": {
    onStatus: (self, status, target, session, log) => {
      if (status === 'poisoned' || status === 'badly-poisoned') {
        log.push({ side: 'user', userId: self.ownerId, text: `${self.name} is immune to poisoning due to Immunity!` });
        return false;
      }
      return true;
    },
    description: "Prevents the Pokémon from being poisoned."
  },

  // Wonder Guard: only super-effective damage
  "wonder-guard": {
    onTryHit: (self, move, target, session, log) => {
      if (!move.isSuperEffective) {
        log.push({ side: 'user', userId: target.ownerId, text: `${self.name} avoided the attack with Wonder Guard!` });
        return false;
      }
      return true;
    },
    description: "Only allows super-effective moves to hit."
  },
  // Multiscale: halve damage at full HP
  "multiscale": {
    onModifyDamage: (self, damage) => {
      return self.currentHp === self.maxHp ? Math.floor(damage / 2) : damage;
    },
    description: "Halves damage taken when at full HP."
  },
  // Regenerator: heal 1/3 max HP on switch-out
  "regenerator": {
    onSwitchOut: (self, _, session, log) => {
      const heal = Math.ceil(self.maxHp / 3);
      self.currentHp = Math.min(self.maxHp, self.currentHp + heal);
      log.push({ text: `${self.name} restored HP with Regenerator!` });
    },
    description: "Restores 1/3 max HP when switching out."
  },
  // Magic Guard: immune to indirect damage
  "magic-guard": {
    onDamage: (self, amount, source) => {
      // block all indirect damage types
      if (source !== 'direct') return 0;
      return amount;
    },
    description: "Only takes direct damage from attacks."
  },
  // Moxie: boost Attack after KO
  "moxie": {
    onAfterMove: (self, target, move, session, log) => {
      if (move.category !== 'Status' && target.currentHp === 0) {
        self.boosts = self.boosts || {};
        self.boosts.attack = (self.boosts.attack || 0) + 1;
        log.push({ text: `${self.name}'s Moxie boosted its Attack!` });
      }
    },
    description: "Boosts Attack after knocking out a target."
  },
  // Chlorophyll: double Speed in sun
  "chlorophyll": {
    onModifySpe: (self, speed, session) => {
      return session.weather === 'sunny' ? speed * 2 : speed;
    },
    description: "Doubles Speed in sunshine."
  },
  // Pressure: doubles PP usage of moves targeting this Pokémon
  "pressure": {
    onDeductPP: (move, source) => {
      // Deduct an extra PP whenever foe uses a move against you
      move.pp = Math.max(0, move.pp - 1);
    },
    description: "Doubles PP usage of moves targeting this Pokémon."
  },
  // Mold Breaker: ignore target's ability immunities
  "mold-breaker": {
    onTryHit: (self, move, target, session, log) => {
      // bypass target ability immunities
      return true; // effectively ignore target.onTryHit
    },
    description: "Moves ignore other Pokémon’s abilities."
  },
};

// --- Nature chart: maps nature to per-stat multipliers ---
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

// Helper: check if move is same type as Pokémon
function isSameType(move, pokemonTypes) {
  return pokemonTypes.includes(move.moveType);
}
// Helper: get types threatened by a set of moves (types they are super effective against)
function getThreatenedTypes(moves) {
  const threatened = new Set();
  for (const move of moves) {
    if (!move || !move.moveType) continue;
    // For each type, check if move is super effective
    for (const defType in typeChart) {
      if (typeChart[move.moveType] && typeChart[move.moveType][defType] > 1) {
        threatened.add(defType);
      }
    }
  }
  return threatened;
}
// Helper: marginal coverage gain for a move
function marginalCoverageGain(move, threatened, opponentTypeDistribution) {
  let gain = 0;
  for (const defType in typeChart[move.moveType] || {}) {
    if (typeChart[move.moveType][defType] > 1 && !threatened.has(defType)) {
      gain += opponentTypeDistribution[defType] || 1; // weight by frequency
    }
  }
  return gain;
}
// Default opponent type distribution (uniform if not provided)
const defaultOpponentTypeDistribution = {
  normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 1, dark: 1, steel: 1, fairy: 1
};

// Helper: pick a random move from the top N of a pool
function pickRandomTopN(pool, n = 3) {
  if (!pool.length) return null;
  const top = pool.slice(0, n);
  return top[Math.floor(Math.random() * top.length)];
}

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
  getCombatStyle,
  natureChart,
}; 