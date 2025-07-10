const express = require('express');
const router = express.Router();
const BattleSession = require('../models/BattleSession');
const Pokemon = require('../models/Pokemon');
const pokeApi = require('../utils/pokeApi');
const battleUtils = require('../utils/battleUtils');
const { moveEffectRegistry, stageMultiplier, abilityRegistry } = require('../utils/battleUtils');

// Helper function to get Pokémon data for selection
const getUserPokemons = async (userId, selectedPokemonIds) => {
  const pokemons = await Pokemon.find({ _id: { $in: selectedPokemonIds }, discordId: userId });
  return pokemons.map(p => ({
    pokemonId: p.pokemonId,
    name: p.name,
    isShiny: p.isShiny,
  }));
};

// Helper to apply on-switch abilities
function applyOnSwitchAbilities(poke, target, session, log) {
  if (!poke.ability) return;
  const ability = abilityRegistry[poke.ability.toLowerCase()];
  if (ability && typeof ability.onSwitch === 'function') {
    ability.onSwitch(poke, target, session, log);
  }
}

// Helper to apply per-turn status effects
function applyPerTurnStatusEffects(poke, log) {
  if (!poke || poke.currentHp <= 0 || !poke.status) return { skip: false };
  let skip = false;
  let statusMsg = '';
  if (poke.status === 'poisoned') {
    const dmg = Math.max(1, Math.floor(poke.maxHp / 8));
    poke.currentHp = Math.max(0, poke.currentHp - dmg);
    statusMsg = `${poke.name} is hurt by poison! (${dmg} HP)`;
  } else if (poke.status === 'badly-poisoned') {
    poke.statusCounter = (poke.statusCounter || 1) + 1;
    const dmg = Math.max(1, Math.floor((poke.statusCounter * poke.maxHp) / 16));
    poke.currentHp = Math.max(0, poke.currentHp - dmg);
    statusMsg = `${poke.name} is hurt by toxic poison! (${dmg} HP)`;
  } else if (poke.status === 'burned') {
    const dmg = Math.max(1, Math.floor(poke.maxHp / 16));
    poke.currentHp = Math.max(0, poke.currentHp - dmg);
    statusMsg = `${poke.name} is hurt by its burn! (${dmg} HP)`;
  } else if (poke.status === 'paralyzed') {
    if (Math.random() < 0.25) {
      skip = true;
      statusMsg = `${poke.name} is paralyzed! It can't move!`;
    }
  }
  if (statusMsg) log.push({ side: 'system', text: statusMsg });
  return { skip };
}

// Helper to apply per-turn weather/terrain effects
function applyPerTurnWeatherEffects(session, log) {
  const weather = session.weather;
  if (!weather) return;
  // Apply to both sides' active Pokémon
  const activeChallenger = session.challengerPokemons[session.activeChallengerIndex || 0];
  const activeOpponent = session.opponentPokemons[session.activeOpponentIndex || 0];
  const applyWeatherDmg = (poke, immuneTypes, weatherName) => {
    if (!poke || poke.currentHp <= 0) return;
    if (poke.types.some(t => immuneTypes.includes(t))) return;
    const dmg = Math.max(1, Math.floor(poke.maxHp / 16));
    poke.currentHp = Math.max(0, poke.currentHp - dmg);
    log.push({ side: 'system', text: `${poke.name} is buffeted by ${weatherName}! (${dmg} HP)` });
  };
  if (weather === 'sandstorm') {
    applyWeatherDmg(activeChallenger, ['rock', 'ground', 'steel'], 'sandstorm');
    applyWeatherDmg(activeOpponent, ['rock', 'ground', 'steel'], 'sandstorm');
  } else if (weather === 'hail') {
    applyWeatherDmg(activeChallenger, ['ice'], 'hail');
    applyWeatherDmg(activeOpponent, ['ice'], 'hail');
  } else if (weather === 'rain') {
    log.push({ side: 'system', text: 'It is raining! Water moves are stronger, Fire moves are weaker.' });
  } else if (weather === 'sunny') {
    log.push({ side: 'system', text: 'The sunlight is strong! Fire moves are stronger, Water moves are weaker.' });
  }
}

// POST /battles - Create a new battle session
router.post('/', async (req, res) => {
  const { challengerId, opponentId, guildId, count } = req.body;
  if (!count || count < 1 || count > 5) {
    return res.status(400).json({ error: 'Number of Pokémon must be between 1 and 5.' });
  }
  try {
    // Check if either user is already in a pending or active battle in this guild
    const existing = await BattleSession.findOne({
      guildId,
      status: { $in: ['pending', 'active'] },
      $or: [
        { challengerId },
        { opponentId },
      ]
    });
    if (existing) {
      return res.status(400).json({ error: 'One or both users are already in an active or pending battle in this server.' });
    }
    // Check if both users have at least 'count' Pokémon in this guild
    const [challengerCount, opponentCount] = await Promise.all([
      Pokemon.aggregate([
        { $match: { discordId: challengerId, guildId } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ]),
      Pokemon.aggregate([
        { $match: { discordId: opponentId, guildId } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ]),
    ]);
    const challengerTotal = challengerCount[0]?.total || 0;
    const opponentTotal = opponentCount[0]?.total || 0;
    if (challengerTotal < count || opponentTotal < count) {
      return res.status(400).json({ error: 'Both users must have at least the specified number of Pokémon in this server.' });
    }
    // Only set minimal fields for now; Pokémon selection comes later
    const session = await BattleSession.create({
      challengerId,
      opponentId,
      guildId,
      challengerPokemons: [],
      opponentPokemons: [],
      turn: Math.random() < 0.5 ? 'challenger' : 'opponent', // Randomize who goes first
      status: 'pending',
      log: [],
      count,
    });
    return res.json({ battleId: session._id, session });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /battles/:battleId/respond - Accept or decline a battle
router.post('/:battleId/respond', async (req, res) => {
  const { accept, userId } = req.body;
  const { battleId } = req.params;
  try {
    const session = await BattleSession.findById(battleId);
    if (!session) return res.status(404).json({ error: 'BattleSession not found' });
    if (session.status !== 'pending') return res.status(400).json({ error: 'Battle is not pending' });
    if (userId !== session.opponentId) return res.status(403).json({ error: 'Only the challenged user can respond' });
    if (accept) {
      session.status = 'active';
    } else {
      session.status = 'cancelled';
    }
    session.updatedAt = new Date();
    await session.save();
    return res.json({ battleId, status: session.status, session });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /battles/:battleId - Get the full battle session
router.get('/:battleId', async (req, res) => {
  const { battleId } = req.params;
  try {
    const session = await BattleSession.findById(battleId);
    if (!session) return res.status(404).json({ error: 'BattleSession not found' });
    return res.json({ session });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /battles/:battleId/pokemon/:userId - List available Pokémon for user
router.get('/:battleId/pokemon/:userId', async (req, res) => {
  const { battleId, userId } = req.params;
  try {
    const session = await BattleSession.findById(battleId);
    if (!session) return res.status(404).json({ error: 'BattleSession not found' });
    if (![session.challengerId, session.opponentId].includes(userId)) {
      return res.status(403).json({ error: 'User is not part of this battle' });
    }
    // Find all Pokémon for this user in this guild
    const pokemons = await Pokemon.find({ discordId: userId, guildId: session.guildId });
    // Flatten by count (e.g., 2x Pikachu = 2 entries)
    let flatList = [];
    for (const p of pokemons) {
      for (let i = 0; i < (p.count || 1); i++) {
        flatList.push({
          pokemonId: p.pokemonId,
          name: p.name,
          isShiny: p.isShiny,
          _id: `${p._id}_${i}`,
          realId: p._id,
        });
      }
    }
    return res.json({ pokemons: flatList });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /battles/:battleId/select - User selects their Pokémon for the battle
router.post('/:battleId/select', async (req, res) => {
  const { userId, selectedPokemonIds } = req.body;
  const { battleId } = req.params;
  try {
    const session = await BattleSession.findById(battleId);
    if (!session) return res.status(404).json({ error: 'BattleSession not found' });
    if (![session.challengerId, session.opponentId].includes(userId)) {
      return res.status(403).json({ error: 'User is not part of this battle' });
    }
    // Only allow selection if not already set
    const isChallenger = userId === session.challengerId;
    const alreadySet = isChallenger ? session.challengerPokemons.length > 0 : session.opponentPokemons.length > 0;
    if (alreadySet) return res.status(400).json({ error: 'Pokémon already selected' });

    // --- Determine battleSize (number of Pokémon per team) ---
    const battleSize = selectedPokemonIds.length || 5;

    // Fetch and build Pokémon data for each selected Pokémon
    const userPokemons = await getUserPokemons(userId, selectedPokemonIds); // assume this returns [{pokemonId, name, isShiny, ...}]
    const builtPokemons = await Promise.all(userPokemons.map(async (p) => {
      const pokeData = await pokeApi.getPokemonDataById(p.pokemonId);
      // --- Use IVs, EVs, nature, ability from p if present ---
      const stats = (() => {
        const baseStats = battleUtils.calculateStats(
          pokeData.stats,
          50, // default level 50
          p.ivs || {},
          p.evs || {},
          p.nature || 'hardy',
          p.ability || ''
        );
        return baseStats;
      })();
      const types = pokeData.types.map(t => t.type.name);
      // --- Pass battleSize to getLegalMoveset ---
      const moves = await battleUtils.getLegalMoveset(pokeData.name, 50, battleSize, 'red-blue');
      return {
        pokemonId: p.pokemonId,
        name: p.name,
        maxHp: stats.hp,
        currentHp: stats.hp,
        moves,
        isShiny: p.isShiny,
        level: 50,
        stats,
        types,
        ivs: p.ivs || {},
        evs: p.evs || {},
        nature: p.nature || 'hardy',
        ability: p.ability || '',
        status: p.status || null,
        boosts: p.boosts || {},
      };
    }));
    if (isChallenger) {
      session.challengerPokemons = builtPokemons;
    } else {
      session.opponentPokemons = builtPokemons;
    }
    await session.save();
    // --- Trigger on-switch ability for first Pokémon if both teams are set ---
    if (session.challengerPokemons.length > 0 && session.opponentPokemons.length > 0) {
      const challengerActive = session.challengerPokemons[session.activeChallengerIndex || 0];
      const opponentActive = session.opponentPokemons[session.activeOpponentIndex || 0];
      // Fire both sides' onSwitch abilities
      applyOnSwitchAbilities(challengerActive, opponentActive, session, session.log);
      applyOnSwitchAbilities(opponentActive, challengerActive, session, session.log);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /battles/:battleId/move - Process a move
router.post('/:battleId/move', async (req, res) => {
  const { userId, moveName } = req.body;
  const { battleId } = req.params;
  try {
    const session = await BattleSession.findById(battleId);
    if (!session) return res.status(404).json({ error: 'BattleSession not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Battle is not active' });
    // Determine whose turn
    const isChallengerTurn = session.turn === 'challenger';
    const isChallenger = userId === session.challengerId;
    if ((isChallengerTurn && !isChallenger) || (!isChallengerTurn && isChallenger)) {
      return res.status(403).json({ error: 'It is not your turn.' });
    }
    // Get active Pokémon for both users
    const challengerPoke = session.challengerPokemons[session.activeChallengerIndex || 0];
    const opponentPoke = session.opponentPokemons[session.activeOpponentIndex || 0];
    const myPoke = isChallenger ? challengerPoke : opponentPoke;
    const theirPoke = isChallenger ? opponentPoke : challengerPoke;
    if (!myPoke || !theirPoke) return res.status(400).json({ error: 'Active Pokémon not found.' });

    // If myPoke fainted from status/weather, skip move and handle faint/switch logic
    if (myPoke.currentHp <= 0) {
      // Consolidated faint/switch logic
      function allFainted(pokemons) { return pokemons.every(p => p.currentHp <= 0); }
      let fainted = true;
      let faintedName = myPoke.name;
      let switched = false;
      let newActiveIndex = null;
      let myPokemons = isChallenger ? session.challengerPokemons : session.opponentPokemons;
      let myActiveIndex = isChallenger ? session.activeChallengerIndex : session.activeOpponentIndex;
      const nextIndex = myPokemons.findIndex((p, idx) => p.currentHp > 0 && idx !== myActiveIndex);
      if (nextIndex !== -1) {
        if (isChallenger) {
          session.activeChallengerIndex = nextIndex;
        } else {
          session.activeOpponentIndex = nextIndex;
        }
        session.log.push({ side: 'user', userId, text: `${myPoke.name} fainted! Switched to ${myPokemons[nextIndex].name}.` });
        switched = true;
        // --- Trigger on-switch ability for new Pokémon ---
        let newPoke = myPokemons[nextIndex];
        let oppPoke = isChallenger ? opponentPoke : challengerPoke;
        applyOnSwitchAbilities(newPoke, oppPoke, session, session.log);
        newActiveIndex = nextIndex;
      }
      // Now check if all Pokémon for either side have fainted
      if (allFainted(session.challengerPokemons)) {
        session.status = 'finished';
        session.winnerId = session.opponentId;
      } else if (allFainted(session.opponentPokemons)) {
        session.status = 'finished';
        session.winnerId = session.challengerId;
      } else {
        // Switch turn as usual
        session.turn = isChallenger ? 'opponent' : 'challenger';
      }
      await session.save();
      let summary = `${myPoke.name} fainted!`;
      if (switched && newActiveIndex !== null) {
        summary += ` Switched to ${myPokemons[newActiveIndex].name}.`;
      }
      if (session.status === 'finished') {
        const winnerMention = `<@${session.winnerId}>`;
        summary += `\nBattle ended! Winner: ${winnerMention}`;
      }
      return res.json({ session, summary });
    }

    // --- Apply per-turn status effects to active Pokémon (start of turn) ---
    let skipTurn = false;
    const myStatus = applyPerTurnStatusEffects(myPoke, session.log);
    if (myStatus.skip) skipTurn = true;
    const theirStatus = applyPerTurnStatusEffects(theirPoke, session.log);
    applyPerTurnWeatherEffects(session, session.log);
    session.markModified('challengerPokemons');
    session.markModified('opponentPokemons');
    // If user is paralyzed and can't move, skip their move
    if (skipTurn) {
      session.turn = isChallenger ? 'opponent' : 'challenger';
      await session.save();
      return res.json({ session, summary: `${myPoke.name} is paralyzed and can't move!` });
    }
    // Find the move object (must be in myPoke.moves)
    let moveObj = (myPoke.moves || []).find(m => m.name === moveName);
    if (!moveObj) return res.status(400).json({ error: 'Move not found or not usable by this Pokémon.' });
    // --- Prevent use if out of PP ---
    if (moveObj.currentPP === 0) {
      return res.status(400).json({ error: 'This move is out of PP and cannot be used.' });
    }
    // --- Move effect logic: branch early for effect moves ---
    const effect = moveEffectRegistry[moveName];
    if (effect && ["boost","multi-boost","status","weather","terrain"].includes(effect.type)) {
      let effectMsg = '';
      let effectSucceeded = false;
      if (effect.type === 'boost') {
        // Stat-boosting move (single stat)
        const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
        const stat = effect.stat;
        targetPoke.boosts = targetPoke.boosts || {};
        const before = targetPoke.boosts[stat] || 0;
        const after = Math.max(-6, Math.min(6, before + effect.delta));
        if (after !== before) {
          targetPoke.boosts[stat] = after;
          effectSucceeded = true;
          effectMsg = `${myPoke.name} used ${moveName}! ${targetPoke.name}'s ${stat} ${effect.delta > 0 ? 'rose' : 'fell'} ${Math.abs(effect.delta)} stage${Math.abs(effect.delta) > 1 ? 's' : ''}.`;
          if (effect.message) effectMsg += ` ${effect.message}`;
        } else {
          effectMsg = `${myPoke.name} used ${moveName}! But it failed.`;
        }
      } else if (effect.type === 'multi-boost') {
        const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
        targetPoke.boosts = targetPoke.boosts || {};
        let changed = false;
        for (const boost of effect.boosts) {
          const stat = boost.stat;
          const before = targetPoke.boosts[stat] || 0;
          const after = Math.max(-6, Math.min(6, before + boost.delta));
          if (after !== before) {
            targetPoke.boosts[stat] = after;
            changed = true;
          }
        }
        if (changed) {
          effectSucceeded = true;
          effectMsg = `${myPoke.name} used ${moveName}!`;
          if (effect.message) effectMsg += ` ${effect.message}`;
        } else {
          effectMsg = `${myPoke.name} used ${moveName}! But it failed.`;
        }
      } else if (effect.type === 'status') {
        const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
        if (!targetPoke.status) {
          if (!effect.chance || Math.random() * 100 < effect.chance) {
            targetPoke.status = effect.status;
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! ${targetPoke.name} ${effect.message}`;
          } else {
            effectMsg = `${myPoke.name} used ${moveName}! But it failed.`;
          }
        } else {
          effectMsg = `${myPoke.name} used ${moveName}! But ${targetPoke.name} is already affected.`;
        }
      } else if (effect.type === 'weather') {
        if (session.weather !== effect.weather) {
          session.weather = effect.weather;
          effectSucceeded = true;
          effectMsg = `${myPoke.name} used ${moveName}! ${effect.message}`;
        } else {
          effectMsg = `${myPoke.name} used ${moveName}! But the weather is already ${effect.weather}.`;
        }
      } else if (effect.type === 'terrain') {
        if (session.terrain !== effect.terrain) {
          session.terrain = effect.terrain;
          effectSucceeded = true;
          effectMsg = `${myPoke.name} used ${moveName}! ${effect.message}`;
        } else {
          effectMsg = `${myPoke.name} used ${moveName}! But the terrain is already ${effect.terrain}.`;
        }
      }
      // Only decrement PP if effect succeeded
      if (effectSucceeded) {
        moveObj.currentPP = Math.max(0, (moveObj.currentPP || 0) - 1);
      }
      session.log.push({ side: 'user', userId, text: effectMsg });
      session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
      // --- Always switch turn after any move (effect or damaging) ---
      // Check if all Pokémon for either side have fainted (should only happen if effect causes faint)
      function allFainted(pokemons) { return pokemons.every(p => p.currentHp <= 0); }
      if (allFainted(session.challengerPokemons)) {
        session.status = 'finished';
        session.winnerId = session.opponentId;
      } else if (allFainted(session.opponentPokemons)) {
        session.status = 'finished';
        session.winnerId = session.challengerId;
      } else {
        // Switch turn as usual
        session.turn = isChallenger ? 'opponent' : 'challenger';
      }
      await session.save();
      let summary = effectMsg;
      if (session.status === 'finished') {
        const winnerMention = `<@${session.winnerId}>`;
        summary += `\nBattle ended! Winner: ${winnerMention}`;
      }
      return res.json({ session, summary });
    }
    // --- Damaging moves and damage+status moves ---
    // --- Accuracy/evasion check for damaging and status moves ---
    let moveHits = true;
    // Only check accuracy for damaging, damage+status, and status moves (not weather/terrain/boost)
    if (
      (moveObj.power > 0 || (effect && ["damage+status","status"].includes(effect.type))) && typeof moveObj.accuracy === 'number' && moveObj.accuracy < 100
    ) {
      const userAcc = myPoke.boosts?.accuracy || 0;
      const targetEva = theirPoke.boosts?.evasion || 0;
      const finalAcc = battleUtils.calcFinalAccuracy(moveObj.accuracy, userAcc, targetEva);
      if (Math.random() * 100 >= finalAcc) {
        moveHits = false;
      }
    }
    if (!moveHits) {
      session.log.push({ side: 'user', userId, text: `${myPoke.name} used ${moveName}, but it missed!` });
      await session.save();
      return res.json({ session, summary: `${myPoke.name} used ${moveName}, but it missed!` });
    }
    // Decrement currentPP for damaging moves
    moveObj.currentPP = Math.max(0, (moveObj.currentPP || 0) - 1);
    // --- Apply stat boosts and ability multipliers ---
    function getBattleStats(poke) {
      let stats = { ...poke.stats };
      for (const stat in ['attack', 'defense', 'spAttack', 'spDefense', 'speed']) {
        if (poke.boosts && typeof poke.boosts[stat] === 'number') {
          stats[stat] = Math.floor(stats[stat] * stageMultiplier(poke.boosts[stat]));
        }
      }
      const ability = abilityRegistry[poke.ability?.toLowerCase?.()];
      const multipliers = ability?.staticMultipliers || {};
      for (const stat in multipliers) {
        if (stats[stat] !== undefined) {
          stats[stat] = Math.floor(stats[stat] * multipliers[stat]);
        }
      }
      return stats;
    }
    const attackerStats = getBattleStats(myPoke);
    const defenderStats = getBattleStats(theirPoke);
    const typeEffectiveness = battleUtils.getTypeEffectiveness(moveObj.moveType, theirPoke.types);
    const dmgResult = battleUtils.calculateDamage(
      { level: myPoke.level, stats: attackerStats, types: myPoke.types },
      { stats: defenderStats, types: theirPoke.types },
      moveObj,
      typeEffectiveness,
      session.weather,
      session.terrain
    );
    const damage = dmgResult.damage;
    theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - damage);
    let effectivenessText = '';
    if (typeEffectiveness === 0) effectivenessText = ' It had no effect!';
    else if (typeEffectiveness > 1) effectivenessText = ' It was super effective!';
    else if (typeEffectiveness < 1) effectivenessText = ' It was not very effective.';
    session.log.push({ side: 'user', userId, text: `${myPoke.name} used ${moveName}! It dealt ${damage} damage to ${theirPoke.name}.${effectivenessText} (${theirPoke.currentHp} HP left)` });
    // If move is damage+status, apply status after damage
    if (effect && effect.type === 'damage+status') {
      const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
      if (!targetPoke.status && (!effect.chance || Math.random() * 100 < effect.chance)) {
        targetPoke.status = effect.status;
        session.log.push({ side: 'user', userId, text: `${targetPoke.name} ${effect.message}` });
        session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
      }
    }
    // --- Trigger on-damage ability effects (e.g., Rough Skin) ---
    if (moveObj.power > 0 && theirPoke.ability) {
      const theirAbility = abilityRegistry[theirPoke.ability?.toLowerCase?.()];
      if (theirAbility && typeof theirAbility.onDamage === 'function') {
        theirAbility.onDamage(theirPoke, myPoke, moveObj, session, session.log);
      }
    }
    // --- Consolidated faint/switch logic ---
    function allFainted(pokemons) { return pokemons.every(p => p.currentHp <= 0); }
    let fainted = false;
    let switched = false;
    let faintedName = null;
    let newActiveIndex = null;
    let theirPokemons = isChallenger ? session.opponentPokemons : session.challengerPokemons;
    let theirActiveIndex = isChallenger ? session.activeOpponentIndex : session.activeChallengerIndex;
    if (theirPoke.currentHp <= 0) {
      fainted = true;
      faintedName = theirPoke.name;
      // Find next available Pokémon for the defender
      const nextIndex = theirPokemons.findIndex((p, idx) => p.currentHp > 0 && idx !== theirActiveIndex);
      if (nextIndex !== -1) {
        if (isChallenger) {
          session.activeOpponentIndex = nextIndex;
        } else {
          session.activeChallengerIndex = nextIndex;
        }
        session.log.push({ side: 'user', userId, text: `${theirPoke.name} fainted! Switched to ${theirPokemons[nextIndex].name}.` });
        switched = true;
        // --- Trigger on-switch ability for new Pokémon ---
        let newPoke = theirPokemons[nextIndex];
        let oppPoke = isChallenger ? challengerPoke : opponentPoke;
        applyOnSwitchAbilities(newPoke, oppPoke, session, session.log);
        newActiveIndex = nextIndex;
      }
    }
    // Now check if all Pokémon for either side have fainted
    if (allFainted(session.challengerPokemons)) {
      session.status = 'finished';
      session.winnerId = session.opponentId;
    } else if (allFainted(session.opponentPokemons)) {
      session.status = 'finished';
      session.winnerId = session.challengerId;
    } else {
      // Switch turn as usual
      session.turn = isChallenger ? 'opponent' : 'challenger';
    }
    session.markModified('challengerPokemons');
    session.markModified('opponentPokemons');
    await session.save();
    // --- PATCH: Ensure all moves have currentPP and effectivePP ---
    function patchPPFields(pokemons) {
      for (const poke of pokemons) {
        if (!poke.moves) continue;
        for (const move of poke.moves) {
          if (typeof move.effectivePP !== 'number' || isNaN(move.effectivePP)) {
            move.effectivePP = move.power ? Math.max(1, Math.ceil(move.power / 5)) : 1;
          }
          if (typeof move.currentPP !== 'number' || isNaN(move.currentPP)) {
            move.currentPP = move.effectivePP;
          }
        }
      }
    }
    patchPPFields(session.challengerPokemons);
    patchPPFields(session.opponentPokemons);
    // Return summary
    let summary = `${myPoke.name} used ${moveName}! It dealt ${damage} damage to ${theirPoke.name}.${effectivenessText} (${theirPoke.currentHp} HP left)`;
    if (fainted) {
      summary += `\n${faintedName} fainted!`;
      if (switched && newActiveIndex !== null) {
        summary += ` Switched to ${theirPokemons[newActiveIndex].name}.`;
      }
    }
    if (session.status === 'finished') {
      const winnerMention = `<@${session.winnerId}>`;
      summary += `\nBattle ended! Winner: ${winnerMention}`;
    }
    return res.json({ session, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /battles/:battleId/forfeit - Forfeit the battle
router.post('/:battleId/forfeit', async (req, res) => {
  const { userId } = req.body;
  const { battleId } = req.params;
  try {
    const session = await BattleSession.findById(battleId);
    if (!session) return res.status(404).json({ error: 'BattleSession not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Battle is not active' });
    session.status = 'finished';
    session.winnerId = userId === session.challengerId ? session.opponentId : session.challengerId;
    session.log.push({ side: 'user', userId, text: `<@${userId}> forfeited!` });
    await session.save();
    return res.json({ session });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /battles/:battleId/switch - Switch active Pokémon
router.post('/:battleId/switch', async (req, res) => {
  const { userId, newIndex } = req.body;
  const { battleId } = req.params;
  try {
    const session = await BattleSession.findById(battleId);
    if (!session) return res.status(404).json({ error: 'BattleSession not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Battle is not active' });
    if (userId === session.challengerId) {
      session.activeChallengerIndex = newIndex;
      session.turn = 'opponent';
    } else if (userId === session.opponentId) {
      session.activeOpponentIndex = newIndex;
      session.turn = 'challenger';
    } else {
      return res.status(403).json({ error: 'Not a participant' });
    }
    session.log.push({ side: 'user', userId, text: `<@${userId}> switched Pokémon!` });
    await session.save();
    // --- Trigger on-switch ability for new active Pokémon ---
    let myNewPoke, theirPoke;
    if (userId === session.challengerId) {
      myNewPoke = session.challengerPokemons[newIndex];
      theirPoke = session.opponentPokemons[session.activeOpponentIndex || 0];
    } else {
      myNewPoke = session.opponentPokemons[newIndex];
      theirPoke = session.challengerPokemons[session.activeChallengerIndex || 0];
    }
    applyOnSwitchAbilities(myNewPoke, theirPoke, session, session.log);
    return res.json({ session });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router; 