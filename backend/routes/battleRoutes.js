const express = require('express');
const router = express.Router();
const BattleSession = require('../models/BattleSession');
const Pokemon = require('../models/Pokemon');
const pokeApi = require('../utils/pokeApi');
const battleUtils = require('../utils/battleUtils');
const { moveEffectRegistry, stageMultiplier, abilityRegistry } = require('../utils/battleUtils');

const DAILY_GOALS = { catch: 10, battle: 3, evolve: 2 };
const WEEKLY_GOALS = { catch: 50, battle: 15, evolve: 7 };

// Helper function to get Pokémon data for selection
const getUserPokemons = async (userId, selectedPokemonIds) => {
  const pokemons = await Pokemon.find({ _id: { $in: selectedPokemonIds }, discordId: userId });
  return pokemons.map(p => ({
    pokemonId: p.pokemonId,
    name: p.name,
    isShiny: p.isShiny,
    nature: p.nature,
    ability: p.ability,
    ivs: p.ivs,
    evs: p.evs,
    status: p.status,
    boosts: p.boosts,
    // Add any other fields you want to support in battle
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

// Helper to process battle rewards when battle ends
async function processBattleRewards(session) {
  if (!session.winnerId || session.status !== 'finished') return;
  
  try {
    const { getCustomSpawnInfo } = require('../utils/pokeApi');
    const User = require('../models/User');
    let winnerUser = await User.findOne({ discordId: session.winnerId, guildId: session.guildId });
    
    if (winnerUser) {
      let totalXp = 0;
      let totalDust = 0;
      
      // Get the loser's Pokémon team
      const loserPokemons = session.winnerId === session.challengerId ? session.opponentPokemons : session.challengerPokemons;
      
      for (const poke of loserPokemons) {
        const spawnInfo = getCustomSpawnInfo(poke.name);
        if (spawnInfo) {
          totalXp += spawnInfo.xpYield || 0;
          totalDust += spawnInfo.dustYield || 0;
        }
      }
      
      // If not friendly, double the rewards
      if (session.friendly === false) {
        totalXp *= 2;
        totalDust *= 2;
      }
      
      let xpBoosterUsed = false;
      // XP Booster logic
      if ((winnerUser.poke_xp_booster_uses || 0) > 0) {
        totalXp *= 2;
        winnerUser.poke_xp_booster_uses -= 1;
        xpBoosterUsed = true;
      }
      
      winnerUser.poke_xp = (winnerUser.poke_xp || 0) + totalXp;
      winnerUser.poke_stardust = (winnerUser.poke_stardust || 0) + totalDust;
      winnerUser.poke_quest_daily_battle = (winnerUser.poke_quest_daily_battle || 0) + 1;
      winnerUser.poke_quest_weekly_battle = (winnerUser.poke_quest_weekly_battle || 0) + 1;
      
      if (winnerUser.poke_quest_daily_battle >= DAILY_GOALS.battle) {
        winnerUser.poke_quest_daily_completed = true;
      }
      if (winnerUser.poke_quest_weekly_battle >= WEEKLY_GOALS.battle) {
        winnerUser.poke_quest_weekly_completed = true;
      }
      
      // Level up logic
      const { getLevelForXp, getUnlockedShopItems } = require('../utils/pokeApi');
      const prevLevel = winnerUser.poke_level || 1;
      const newLevel = getLevelForXp(winnerUser.poke_xp);
      let newlyUnlocked = [];
      
      if (newLevel > prevLevel) {
        winnerUser.poke_level = newLevel;
        // Determine newly unlocked shop items
        const prevUnlocks = new Set(getUnlockedShopItems(prevLevel).map(i => i.key));
        const newUnlocks = getUnlockedShopItems(newLevel).filter(i => !prevUnlocks.has(i.key));
        newlyUnlocked = newUnlocks.map(i => i.name);
      }
      
      await winnerUser.save();
      
      // If not friendly, transfer all loser's Pokémon to winner
      if (session.friendly === false) {
        const loserId = session.winnerId === session.challengerId ? session.opponentId : session.challengerId;
        const loserPokemons = session.winnerId === session.challengerId ? session.opponentPokemons : session.challengerPokemons;
        const PokemonModel = require('../models/Pokemon');
        
        for (const poke of loserPokemons) {
          // Remove all from loser
          await PokemonModel.deleteMany({ discordId: loserId, guildId: session.guildId, pokemonId: poke.pokemonId, isShiny: poke.isShiny });
          // Add to winner (stack if possible)
          let winnerStack = await PokemonModel.findOne({ discordId: session.winnerId, guildId: session.guildId, pokemonId: poke.pokemonId, isShiny: poke.isShiny });
          if (winnerStack) {
            winnerStack.count = (winnerStack.count || 1) + 1;
            await winnerStack.save();
          } else {
            await PokemonModel.create({
              user: winnerUser ? winnerUser._id : undefined,
              discordId: session.winnerId,
              guildId: session.guildId,
              pokemonId: poke.pokemonId,
              name: poke.name,
              isShiny: poke.isShiny,
              count: 1,
              caughtAt: new Date(),
              ivs: poke.ivs,
              evs: poke.evs,
              nature: poke.nature,
              ability: poke.ability,
              status: poke.status,
              boosts: poke.boosts
            });
          }
        }
        session.log.push({ side: 'system', text: `All of the loser's Pokémon were transferred to the winner!` });
      }
      
      // Add reward info to session log
      let rewardMsg = `Battle rewards: +${totalXp} XP, +${totalDust} Stardust`;
      if (xpBoosterUsed) rewardMsg += ` (2x XP from booster)`;
      if (newLevel > prevLevel) {
        rewardMsg += ` | Level up! Reached level ${newLevel}`;
        if (newlyUnlocked.length > 0) {
          rewardMsg += ` | Unlocked: ${newlyUnlocked.join(', ')}`;
        }
      }
      session.log.push({ side: 'system', text: rewardMsg });
    }
  } catch (err) {
    console.error('Error processing battle rewards:', err);
    session.log.push({ side: 'system', text: 'Error processing battle rewards' });
  }
}

// Helper to apply per-turn status effects
function applyPerTurnStatusEffects(poke, log, session, isChallenger) {
  if (!poke || poke.currentHp <= 0) return { skip: false };
  let skip = false;
  let statusMsg = '';

  // --- Yawn: Delayed sleep ---
  if (poke.drowsy) {
    poke.drowsy -= 1;
    if (poke.drowsy === 0 && !poke.status) {
      poke.status = 'asleep';
      poke.sleepCounter = 2;
      statusMsg = `${poke.name} fell asleep due to Yawn!`;
      delete poke.drowsy;
    } else if (poke.drowsy > 0) {
      statusMsg = `${poke.name} is getting drowsy...`;
    }
  }

  // --- Wish: Delayed healing ---
  if (poke.wishPending) {
    poke.wishPending -= 1;
    if (poke.wishPending === 0) {
      const heal = Math.floor(poke.maxHp / 2);
      poke.currentHp = Math.min(poke.maxHp, poke.currentHp + heal);
      statusMsg = `${poke.name}'s wish came true! Restored ${heal} HP.`;
      delete poke.wishPending;
    }
  }

  // --- Roost: Temporary Flying type removal ---
  if (poke.flyingRemoved) {
    poke.flyingRemoved -= 1;
    if (poke.flyingRemoved === 0 && poke.originalTypes) {
      poke.types = poke.originalTypes;
      delete poke.originalTypes;
      delete poke.flyingRemoved;
      statusMsg = `${poke.name}'s Flying type returned after Roost.`;
    }
  }

  // --- Ability: onDamage (indirect damage prevention, e.g., Magic Guard) ---
  const abilityObj = abilityRegistry[poke.ability?.toLowerCase?.()];
  function applyIndirectDamage(amount, source) {
    if (abilityObj && typeof abilityObj.onDamage === 'function') {
      const result = abilityObj.onDamage(poke, amount, source);
      if (typeof result === 'number') return result;
      if (result === false) return 0;
    }
    return amount;
  }

  if (poke.status === 'poisoned') {
    let dmg = Math.max(1, Math.floor(poke.maxHp / 8));
    dmg = applyIndirectDamage(dmg, 'poison');
    if (dmg > 0) {
      poke.currentHp = Math.max(0, poke.currentHp - dmg);
      statusMsg = `${poke.name} is hurt by poison! (${dmg} HP)`;
    }
  } else if (poke.status === 'badly-poisoned') {
    poke.statusCounter = (poke.statusCounter || 1) + 1;
    let dmg = Math.max(1, Math.floor((poke.statusCounter * poke.maxHp) / 16));
    dmg = applyIndirectDamage(dmg, 'poison');
    if (dmg > 0) {
      poke.currentHp = Math.max(0, poke.currentHp - dmg);
      statusMsg = `${poke.name} is hurt by toxic poison! (${dmg} HP)`;
    }
  } else if (poke.status === 'burned') {
    let dmg = Math.max(1, Math.floor(poke.maxHp / 16));
    dmg = applyIndirectDamage(dmg, 'burn');
    if (dmg > 0) {
      poke.currentHp = Math.max(0, poke.currentHp - dmg);
      statusMsg = `${poke.name} is hurt by its burn! (${dmg} HP)`;
    }
  } else if (poke.status === 'paralyzed') {
    if (Math.random() < 0.25) {
      skip = true;
      statusMsg = `${poke.name} is paralyzed! It can't move!`;
    }
  } else if (poke.status === 'asleep') {
    // Initialize sleepCounter if not present
    if (typeof poke.sleepCounter !== 'number') {
      poke.sleepCounter = 2; // Default sleep duration
    }
    
    if (poke.sleepCounter > 0) {
      poke.sleepCounter -= 1;
      skip = true;
      
      if (poke.sleepCounter === 0) {
        poke.status = null;
        delete poke.sleepCounter;
        statusMsg = `${poke.name} woke up!`;
      } else {
        statusMsg = `${poke.name} is fast asleep.`;
      }
    } else {
      // Fallback: if sleepCounter is 0 or negative, wake up
      poke.status = null;
      delete poke.sleepCounter;
      statusMsg = `${poke.name} woke up!`;
    }
  } else if (poke.status === 'confused') {
    // --- Confusion logic ---
    if (typeof poke.confusionCounter !== 'number') {
      // 2-5 turns (random)
      poke.confusionCounter = 2 + Math.floor(Math.random() * 4);
    }
    if (poke.confusionCounter > 0) {
      poke.confusionCounter -= 1;
      if (poke.confusionCounter === 0) {
        poke.status = null;
        delete poke.confusionCounter;
        statusMsg = `${poke.name} snapped out of its confusion!`;
      } else {
        // 1/3 chance to hurt self
        if (Math.random() < 1/3) {
          // Self-damage: typeless, 40 base power, physical, ignore type
          const level = poke.level || 50;
          const A = poke.stats.attack;
          const D = poke.stats.defense;
          const base = Math.floor(((2 * level / 5 + 2) * 40 * A / D) / 50 + 2);
          const damage = Math.max(1, Math.floor(base));
          poke.currentHp = Math.max(0, poke.currentHp - damage);
          statusMsg = `${poke.name} is confused! It hurt itself in its confusion! (${damage} HP)`;
          skip = true;
        } else {
          statusMsg = `${poke.name} is confused!`;
        }
      }
    } else {
      // Fallback: cure confusion if counter is 0 or negative
      poke.status = null;
      delete poke.confusionCounter;
      statusMsg = `${poke.name} snapped out of its confusion!`;
    }
  }

  // --- Taunt: Prevent status/boost moves ---
  if (poke.tauntTurns) {
    poke.tauntTurns -= 1;
    if (poke.tauntTurns === 0) {
      delete poke.tauntTurns;
      statusMsg = `${poke.name} is no longer taunted!`;
    }
  }
  
  if (statusMsg) log.push({ side: 'system', text: statusMsg });
  
  // Mark as modified for persistence
  if (session) {
    if (isChallenger) {
      session.markModified('challengerPokemons');
    } else {
      session.markModified('opponentPokemons');
    }
  }
  
  // --- Partial Trap: Residual damage and duration ---
  if (poke.partialTrapTurns) {
    poke.partialTrapTurns -= 1;
    let trapDmg = Math.max(1, Math.floor(poke.maxHp / 8));
    trapDmg = applyIndirectDamage(trapDmg, 'trap');
    if (trapDmg > 0) {
      poke.currentHp = Math.max(0, poke.currentHp - trapDmg);
      statusMsg = `${poke.name} is trapped by ${poke.partialTrapMove || 'a move'}! (${trapDmg} HP)`;
    }
    if (poke.partialTrapTurns === 0) {
      delete poke.partialTrapTurns;
      delete poke.partialTrapMove;
      statusMsg += ` ${poke.name} was freed from the trap!`;
    }
  }
  
  // --- Leech Seed: drain and heal ---
  if (poke.leechSeedActive) {
    let drain = Math.max(1, Math.floor(poke.maxHp / 8));
    drain = applyIndirectDamage(drain, 'leech-seed');
    if (drain > 0) {
      poke.currentHp = Math.max(0, poke.currentHp - drain);
    }
    let seeder = null;
    // Find the seeder on the opposing team
    if (session && session.challengerPokemons && session.opponentPokemons) {
      const myTeam = isChallenger ? session.opponentPokemons : session.challengerPokemons;
      seeder = myTeam.find(p => p.name === poke.leechSeededBy && p.currentHp > 0);
      if (seeder && drain > 0) {
        seeder.currentHp = Math.min(seeder.maxHp, (seeder.currentHp || 0) + drain);
        statusMsg = `${poke.name} was sapped by Leech Seed! (${drain} HP) ${seeder.name} regained health!`;
        session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
      } else if (drain > 0) {
        statusMsg = `${poke.name} was sapped by Leech Seed! (${drain} HP)`;
      }
    }
    if (poke.currentHp <= 0) {
      delete poke.leechSeedActive;
      delete poke.leechSeededBy;
    }
  }
  
  return { skip };
}

// Helper to apply per-turn weather/terrain effects
function applyPerTurnWeatherEffects(session, log) {
  const weather = session.weather;
  const terrain = session.terrain;
  // --- Field effects: decrement durations and remove expired ---
  if (session.fieldEffectDurations) {
    for (const field in session.fieldEffectDurations) {
      session.fieldEffectDurations[field] -= 1;
      if (session.fieldEffectDurations[field] <= 0) {
        if (session.fieldEffects) {
          session.fieldEffects = session.fieldEffects.filter(f => f !== field);
        }
        log.push({ side: 'system', text: `${field.replace('-', ' ')} wore off!` });
        delete session.fieldEffectDurations[field];
      }
    }
    session.markModified('fieldEffects');
    session.markModified('fieldEffectDurations');
  }
  if (!weather && !terrain) return;
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
  // --- Grassy Terrain: Heal 1/16 max HP for grounded Pokémon ---
  if (terrain === 'grassy') {
    [activeChallenger, activeOpponent].forEach(poke => {
      if (!poke || poke.currentHp <= 0) return;
      // Consider Flying/Levitating Pokémon as not grounded (simple: skip if type includes flying)
      if (poke.types.includes('flying')) return;
      const heal = Math.max(1, Math.floor(poke.maxHp / 16));
      poke.currentHp = Math.min(poke.maxHp, poke.currentHp + heal);
      log.push({ side: 'system', text: `${poke.name} was healed by Grassy Terrain! (+${heal} HP)` });
    });
  }
  // --- Misty Terrain: Status prevention is handled in status infliction logic ---
  // --- Psychic Terrain: Priority move prevention is handled in move selection logic ---
}

// --- Integrate onModifyDamage (e.g., Multiscale) ---
function applyOnModifyDamage(target, damage) {
  const abilityObj = abilityRegistry[target.ability?.toLowerCase?.()];
  if (abilityObj && typeof abilityObj.onModifyDamage === 'function') {
    return abilityObj.onModifyDamage(target, damage);
  }
  return damage;
}

// --- Integrate onAfterMove (e.g., Moxie) ---
function applyOnAfterMove(self, target, move, session, log) {
  const abilityObj = abilityRegistry[self.ability?.toLowerCase?.()];
  if (abilityObj && typeof abilityObj.onAfterMove === 'function') {
    abilityObj.onAfterMove(self, target, move, session, log);
  }
}

// --- Integrate onSwitchOut (e.g., Regenerator) ---
function applyOnSwitchOut(poke, session, log) {
  const abilityObj = abilityRegistry[poke.ability?.toLowerCase?.()];
  if (abilityObj && typeof abilityObj.onSwitchOut === 'function') {
    abilityObj.onSwitchOut(poke, null, session, log);
  }
}

// --- Integrate onModifySpe (e.g., Chlorophyll) ---
function applyOnModifySpe(poke, speed, session) {
  const abilityObj = abilityRegistry[poke.ability?.toLowerCase?.()];
  if (abilityObj && typeof abilityObj.onModifySpe === 'function') {
    return abilityObj.onModifySpe(poke, speed, session);
  }
  return speed;
}

// --- Integrate onDeductPP (e.g., Pressure) ---
function applyOnDeductPP(target, move) {
  const abilityObj = abilityRegistry[target.ability?.toLowerCase?.()];
  if (abilityObj && typeof abilityObj.onDeductPP === 'function') {
    abilityObj.onDeductPP(move, target);
  }
}

// POST /battles - Create a new battle session
router.post('/', async (req, res) => {
  const { challengerId, opponentId, guildId, count, friendly } = req.body;
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
      friendly: friendly !== false, // default to true if not provided
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
    if (!session) return res.status(404).json({ message: 'BattleSession not found' });
    if (![session.challengerId, session.opponentId].includes(userId)) {
      return res.status(403).json({ message: 'User is not part of this battle' });
    }
    // Find all Pokémon for this user in this guild
    const pokemons = await Pokemon.find({ discordId: userId, guildId: session.guildId });
    // For each species, show at most 4: non-shiny/EV0, non-shiny/EVd, shiny/EV0, shiny/EVd
    const speciesMap = new Map();
    for (const p of pokemons) {
      const key = `${p.pokemonId}`;
      const isShiny = !!p.isShiny;
      const hasNonZeroEV = Object.values(p.evs || {}).some(ev => ev > 0);
      if (!speciesMap.has(key)) {
        speciesMap.set(key, {
          nonShinyZeroEv: null,
          nonShinyNonZeroEv: null,
          shinyZeroEv: null,
          shinyNonZeroEv: null
        });
      }
      const entry = speciesMap.get(key);
      if (isShiny) {
        if (hasNonZeroEV) {
          if (!entry.shinyNonZeroEv) {
            entry.shinyNonZeroEv = {
              pokemonId: p.pokemonId,
              name: p.name,
              isShiny: p.isShiny,
              nature: p.nature,
              ability: p.ability,
              ivs: p.ivs,
              evs: p.evs,
              _id: p._id,
            };
          }
        } else {
          if (!entry.shinyZeroEv) {
            entry.shinyZeroEv = {
              pokemonId: p.pokemonId,
              name: p.name,
              isShiny: p.isShiny,
              nature: p.nature,
              ability: p.ability,
              ivs: p.ivs,
              evs: p.evs,
              _id: p._id,
            };
          }
        }
      } else {
        if (hasNonZeroEV) {
          if (!entry.nonShinyNonZeroEv) {
            entry.nonShinyNonZeroEv = {
              pokemonId: p.pokemonId,
              name: p.name,
              isShiny: p.isShiny,
              nature: p.nature,
              ability: p.ability,
              ivs: p.ivs,
              evs: p.evs,
              _id: p._id,
            };
          }
        } else {
          if (!entry.nonShinyZeroEv) {
            entry.nonShinyZeroEv = {
              pokemonId: p.pokemonId,
              name: p.name,
              isShiny: p.isShiny,
              nature: p.nature,
              ability: p.ability,
              ivs: p.ivs,
              evs: p.evs,
              _id: p._id,
            };
          }
        }
      }
    }
    // Flatten to a list: for each species, include up to 4 variants
    const uniqueList = [];
    for (const entry of speciesMap.values()) {
      if (entry.nonShinyZeroEv) uniqueList.push(entry.nonShinyZeroEv);
      if (entry.nonShinyNonZeroEv) uniqueList.push(entry.nonShinyNonZeroEv);
      if (entry.shinyZeroEv) uniqueList.push(entry.shinyZeroEv);
      if (entry.shinyNonZeroEv) uniqueList.push(entry.shinyNonZeroEv);
    }
    return res.json({ pokemons: uniqueList });
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
      const moves = await battleUtils.getLegalMoveset(
        pokeData.name,
        50, // level
        battleSize,
        p.ability || '',
        p.nature || 'hardy',
        [
          p.ivs?.hp ?? 31,
          p.ivs?.attack ?? 31,
          p.ivs?.defense ?? 31,
          p.ivs?.spAttack ?? 31,
          p.ivs?.spDefense ?? 31,
          p.ivs?.speed ?? 31
        ],
        [
          p.evs?.hp ?? 0,
          p.evs?.attack ?? 0,
          p.evs?.defense ?? 0,
          p.evs?.spAttack ?? 0,
          p.evs?.spDefense ?? 0,
          p.evs?.speed ?? 0
        ],
        userId,
        p._id?.toString() || ''
      );
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

    // --- DEFENSIVE: At the start of every move, check if either active Pokémon is fainted and auto-switch or end battle ---
    function allFainted(pokemons) { return pokemons.every(p => p.currentHp <= 0); }
    function autoSwitchIfFainted(session, isChallenger) {
      let pokemons = isChallenger ? session.challengerPokemons : session.opponentPokemons;
      let activeIndex = isChallenger ? session.activeChallengerIndex : session.activeOpponentIndex;
      if (!pokemons[activeIndex] || pokemons[activeIndex].currentHp > 0) return false;
      // Find next available
      const nextIndex = pokemons.findIndex((p, idx) => p.currentHp > 0 && idx !== activeIndex);
      if (nextIndex !== -1) {
        if (isChallenger) session.activeChallengerIndex = nextIndex;
        else session.activeOpponentIndex = nextIndex;
        session.log.push({ side: 'system', text: `${pokemons[activeIndex].name} fainted! Switched to ${pokemons[nextIndex].name}.` });
        return true;
      }
      return false;
    }
    let changed = false;
    changed = autoSwitchIfFainted(session, true) || changed;
    changed = autoSwitchIfFainted(session, false) || changed;
    // After auto-switch, check if all fainted
    if (allFainted(session.challengerPokemons)) {
      session.status = 'finished';
      session.winnerId = session.opponentId;
    } else if (allFainted(session.opponentPokemons)) {
      session.status = 'finished';
      session.winnerId = session.challengerId;
    }
    if (session.status === 'finished') {
      await session.save();
      return res.json({ session, summary: 'Battle ended due to all Pokémon fainting.' });
    }
    // Determine whose turn
    const isChallengerTurn = session.turn === 'challenger';
    const isChallenger = userId === session.challengerId;
    let myPokemons = isChallenger ? session.challengerPokemons : session.opponentPokemons;
    let myActiveIndex = isChallenger ? session.activeChallengerIndex : session.activeOpponentIndex;
    if ((isChallengerTurn && !isChallenger) || (!isChallengerTurn && isChallenger)) {
      return res.status(403).json({ error: 'It is not your turn.' });
    }
    // Get active Pokémon for both users
    const challengerPoke = session.challengerPokemons[session.activeChallengerIndex || 0];
    const opponentPoke = session.opponentPokemons[session.activeOpponentIndex || 0];
    const myPoke = isChallenger ? challengerPoke : opponentPoke;
    const theirPoke = isChallenger ? opponentPoke : challengerPoke;
    if (!myPoke || !theirPoke) return res.status(400).json({ error: 'Active Pokémon not found.' });

    // --- Tailwind/Trick Room: Adjust move order based on field effects ---
    // Only relevant if both players have submitted moves (for future simultaneous turn system),
    // but for single-move-per-turn, we can use this to determine which Pokémon would act first if needed.
    // This is a placeholder for future simultaneous turn support.
    // For now, you can use this logic to display which Pokémon would act first if both used attacking moves.
    function getEffectiveSpeed(poke, side) {
      let speed = poke.stats.speed;
      // Tailwind: double speed for affected side
      if (session.fieldEffects && session.fieldEffects.includes('tailwind')) {
        // For now, apply to both sides (future: track which side set Tailwind)
        speed *= 2;
      }
      // --- Integrate onModifySpe (e.g., Chlorophyll) ---
      speed = applyOnModifySpe(poke, speed, session);
      // TODO: Add paralysis speed reduction, etc.
      return speed;
    }
    // Trick Room: reverse speed order
    const trickRoomActive = session.fieldEffects && session.fieldEffects.includes('trick-room');
    const challengerSpeed = getEffectiveSpeed(challengerPoke, 'challenger');
    const opponentSpeed = getEffectiveSpeed(opponentPoke, 'opponent');
    let challengerActsFirst = false;
    if (trickRoomActive) {
      // Slower Pokémon moves first
      challengerActsFirst = challengerSpeed < opponentSpeed;
    } else {
      // Faster Pokémon moves first
      challengerActsFirst = challengerSpeed > opponentSpeed;
    }
    // This logic can be used for future simultaneous turn support or for displaying move order.

    // --- Apply per-turn status effects to active Pokémon (start of turn) ---
    let skipTurn = false;
    
    // Only apply status effects to the Pokémon whose turn it is
    const myStatus = applyPerTurnStatusEffects(myPoke, session.log, session, isChallenger);
    if (myStatus.skip) skipTurn = true;
    
    // Apply weather effects to both Pokémon
    applyPerTurnWeatherEffects(session, session.log);
    session.markModified('challengerPokemons');
    session.markModified('opponentPokemons');

    // Find the move object (must be in myPoke.moves)
    let moveObj = (myPoke.moves || []).find(m => m.name === moveName);
    if (!moveObj) return res.status(400).json({ error: 'Move not found or not usable by this Pokémon.' });
    // --- Always define effectType and effect for all code paths ---
    const effectType = moveObj.effectType || (moveEffectRegistry[moveName]?.type);
    const effect = moveEffectRegistry[moveName];
    console.log('[DEBUG] moveName:', moveName, 'moveObj:', moveObj, 'effectType:', effectType, 'effect:', effect);

    // --- NEW: If myPoke fainted from status/weather, handle auto-switch and turn switch ---
    let summary = '';
    if (myPoke.currentHp <= 0) {
      function allFainted(pokemons) { return pokemons.every(p => p.currentHp <= 0); }
      let fainted = true;
      let faintedName = myPoke.name;
      let switched = false;
      let newActiveIndex = null;
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
      summary = `${myPoke.name} fainted!`;
      if (switched && newActiveIndex !== null) {
        summary += ` Switched to ${myPokemons[newActiveIndex].name}.`;
      }
      if (session.status === 'finished') {
        // Process battle rewards
        await processBattleRewards(session);
        await session.save(); // Save again after processing rewards
        
        let endSummary = '';
        if (session.winnerId) {
          const winnerMention = `<@${session.winnerId}>`;
          endSummary = `Battle ended! Winner: ${winnerMention}`;
        } else {
          endSummary = `Battle ended! It's a draw!`;
        }
        summary += `\n${endSummary}`;
        return res.json({ session, summary });
      }
      // Defensive block will run at the end
    } else if (skipTurn) {
      session.turn = isChallenger ? 'opponent' : 'challenger';
      summary = `${myPoke.name} is paralyzed and can't move!`;
      // Defensive block will run at the end
    } else {
      // --- Enforce Taunt, Encore, Disable, Misty Terrain, Psychic Terrain restrictions ---
      // 1. Taunt: block status/boost moves
      if (myPoke.tauntTurns > 0) {
        const tauntBlocked = (moveObj.category === 'status' && (!effect || ["boost","multi-boost","status","heal","cure-team","field","hazard","hazard-remove","prevent-status","lock","disable"].includes(effect.type)));
        if (tauntBlocked) {
          session.log.push({ side: 'user', userId, text: `${myPoke.name} is taunted and can't use ${moveName}!` });
          session.turn = isChallenger ? 'opponent' : 'challenger';
          summary = `${myPoke.name} is taunted and can't use ${moveName}!`;
          return res.json({ session, summary });
        }
      }
      // 2. Encore: only allow encoreMove
      if (myPoke.encoreTurns > 0 && myPoke.encoreMove && moveName !== myPoke.encoreMove) {
        session.log.push({ side: 'user', userId, text: `${myPoke.name} is locked into ${myPoke.encoreMove} due to Encore!` });
        session.turn = isChallenger ? 'opponent' : 'challenger';
        summary = `${myPoke.name} is locked into ${myPoke.encoreMove} due to Encore!`;
        return res.json({ session, summary });
      }
      // 3. Disable: block disabled move
      if (myPoke.disableTurns > 0 && myPoke.disableMove && moveName === myPoke.disableMove) {
        session.log.push({ side: 'user', userId, text: `${myPoke.name}'s move ${moveName} is disabled!` });
        session.turn = isChallenger ? 'opponent' : 'challenger';
        summary = `${myPoke.name}'s move ${moveName} is disabled!`;
        return res.json({ session, summary });
      }
      // 4. Misty Terrain: block new status conditions
      if (session.terrain === 'misty' && effect && effect.type === 'status' && effect.target !== 'self') {
        session.log.push({ side: 'user', userId, text: `Misty Terrain prevents status conditions!` });
        session.turn = isChallenger ? 'opponent' : 'challenger';
        summary = `Misty Terrain prevents status conditions!`;
        return res.json({ session, summary });
      }
      // 5. Psychic Terrain: block priority moves
      if (session.terrain === 'psychic' && moveObj.priority > 0) {
        session.log.push({ side: 'user', userId, text: `Psychic Terrain prevents priority moves!` });
        session.turn = isChallenger ? 'opponent' : 'challenger';
        summary = `Psychic Terrain prevents priority moves!`;
        return res.json({ session, summary });
      }
      // --- Set lastMoveUsed for Encore/Disable logic ---
      myPoke.lastMoveUsed = moveName;

      // --- Special-case: Transform ---
      if (moveObj.name === 'transform') {
        // Copy opponent's stats, types, and moves
        myPoke.stats = { ...theirPoke.stats };
        myPoke.types = [...theirPoke.types];
        myPoke.moves = theirPoke.moves.map(m => ({ ...m }));
        myPoke.ability = theirPoke.ability;
        myPoke.nature = theirPoke.nature;
        session.log.push({ side: 'user', userId, text: `${myPoke.name} transformed into ${theirPoke.name}!` });
        moveObj.currentPP = Math.max(0, (moveObj.currentPP || 0) - 1);
        session.turn = isChallenger ? 'opponent' : 'challenger';
        summary = `${myPoke.name} transformed into ${theirPoke.name}!`;
        // Defensive block will run at the end
      } else {
        // --- Use effectType from moveObj if present, fallback to registry ---
        // --- Special handling for Yawn, Wish, Roost ---
        console.log('[DEBUG] Before Yawn/Wish/Roost block:', { moveName, effectType, effect });
        if (moveName === 'yawn' && effectType === 'status') {
          const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
          if (!targetPoke.status && !targetPoke.drowsy) {
            targetPoke.drowsy = 2;
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used Yawn! ${targetPoke.name} became drowsy! Will fall asleep next turn.`;
          } else {
            effectMsg = `${myPoke.name} used Yawn! But it failed.`;
          }
        } else if (moveName === 'wish' && effectType === 'heal') {
          if (!myPoke.wishPending) {
            myPoke.wishPending = 2;
            effectSucceeded = true;
            effectMsg = `${myPoke.name} made a wish! HP will be restored next turn.`;
          } else {
            effectMsg = `${myPoke.name} used Wish! But it failed.`;
          }
        } else if (moveName === 'roost' && effectType === 'heal') {
          let healAmount = Math.floor(myPoke.maxHp / 2);
          myPoke.currentHp = Math.min(myPoke.maxHp, (myPoke.currentHp || 0) + healAmount);
          if (!myPoke.flyingRemoved && myPoke.types.includes('flying')) {
            myPoke.originalTypes = [...myPoke.types];
            myPoke.types = myPoke.types.filter(t => t !== 'flying');
            myPoke.flyingRemoved = 1;
            effectMsg = `${myPoke.name} used Roost! Restored ${healAmount} HP and lost Flying type for 1 turn!`;
          } else {
            effectMsg = `${myPoke.name} used Roost! Restored ${healAmount} HP.`;
          }
          effectSucceeded = true;
        } else if (effectType && [
          "boost","multi-boost","status","weather","terrain","heal","drain","damage+recoil","hazard","sound","charge-attack","damage+status","user-faints"
        ].includes(effectType)) {
          let effectMsg = '';
          let effectSucceeded = false;
          if (effectType === 'boost') {
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
          } else if (effectType === 'multi-boost') {
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
          } else if (effectType === 'status') {
            const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
            // --- Safeguard: block status if active on target's side ---
            const targetSideEffects = effect.target === 'self' ? (isChallenger ? session.challengerSideEffects : session.opponentSideEffects) : (isChallenger ? session.opponentSideEffects : session.challengerSideEffects);
            if (targetSideEffects && targetSideEffects.includes('safeguard')) {
              effectMsg = `${targetPoke.name} is protected from status by Safeguard!`;
              effectSucceeded = false;
            } else {
              // --- Ability: onStatus (target) ---
              let allowStatus = true;
              const targetAbilityObj = abilityRegistry[targetPoke.ability?.toLowerCase?.()];
              if (targetAbilityObj && typeof targetAbilityObj.onStatus === 'function') {
                const result = targetAbilityObj.onStatus(targetPoke, effect.status, myPoke, session, session.log);
                if (result === false) {
                  allowStatus = false;
                  session.log.push({ side: 'user', userId, text: `${targetPoke.name}'s ability prevented the status!` });
                }
              }
              if (!targetPoke.status && allowStatus) {
                if (!effect.chance || Math.random() * 100 < effect.chance) {
                  targetPoke.status = effect.status;
                  effectSucceeded = true;
                  effectMsg = `${myPoke.name} used ${moveName}! ${targetPoke.name} ${effect.message}`;
                } else {
                  effectMsg = `${myPoke.name} used ${moveName}! But it failed.`;
                }
              } else if (!allowStatus) {
                effectMsg = `${myPoke.name} used ${moveName}! But ${targetPoke.name}'s ability prevented the status.`;
              } else {
                effectMsg = `${myPoke.name} used ${moveName}! But ${targetPoke.name} is already affected.`;
              }
            }
          } else if (effectType === 'weather') {
            if (session.weather !== effect.weather) {
              session.weather = effect.weather;
              effectSucceeded = true;
              effectMsg = `${myPoke.name} used ${moveName}! ${effect.message}`;
            } else {
              effectMsg = `${myPoke.name} used ${moveName}! But the weather is already ${effect.weather}.`;
            }
          } else if (effectType === 'terrain') {
            if (session.terrain !== effect.terrain) {
              session.terrain = effect.terrain;
              effectSucceeded = true;
              effectMsg = `${myPoke.name} used ${moveName}! ${effect.message}`;
            } else {
              effectMsg = `${myPoke.name} used ${moveName}! But the terrain is already ${effect.terrain}.`;
            }
          } else if (effectType === 'heal') {
            // Healing move (e.g. Rest)
            let healAmount = 0;
            if (effect.amount === 'full') {
              healAmount = myPoke.maxHp;
            } else if (typeof effect.amount === 'number') {
              healAmount = Math.floor(myPoke.maxHp * (effect.amount / 100));
            }
            myPoke.currentHp = Math.min(myPoke.maxHp, (myPoke.currentHp || 0) + healAmount);
            myPoke.status = 'asleep'; // For Rest
            myPoke.sleepCounter = 2; // Sleep for 2 turns (Rest)
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! ${effect.message}`;
            session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
          } else if (effectType === 'drain') {
            // Drain punch, Giga Drain, etc. (deal damage, heal user for percent)
            // We'll treat as a damaging move with healing
            // Use normal damage calculation
            const attackerStats = myPoke.stats;
            const defenderStats = theirPoke.stats;
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
            // --- Screen effects: Light Screen, Reflect, Aurora Veil ---
            const theirSideEffects = isChallenger ? session.opponentSideEffects : session.challengerSideEffects;
            let finalDamage = damage;
            if (theirSideEffects && theirSideEffects.includes('light-screen') && moveObj.category === 'special') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('reflect') && moveObj.category === 'physical') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('aurora-veil')) {
              finalDamage = Math.floor(finalDamage / 2);
            }
            // --- Counter logic: reflect damage if target is countering ---
            if (
              theirPoke.counterActive &&
              ((theirPoke.counterType === 'physical' && moveObj.category === 'physical') ||
              (theirPoke.counterType === 'special' && moveObj.category === 'special'))
            ) {
              const reflected = finalDamage * 2;
              myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - reflected);
              session.log.push({ side: 'user', userId, text: `${theirPoke.name} countered! Reflected ${reflected} damage to ${myPoke.name}.` });
              delete theirPoke.counterActive;
              delete theirPoke.counterType;
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
            }
            let modifiedDamage = applyOnModifyDamage(theirPoke, finalDamage);
            theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - modifiedDamage);
            const heal = Math.floor(finalDamage * (effect.percent / 100));
            myPoke.currentHp = Math.min(myPoke.maxHp, (myPoke.currentHp || 0) + heal);
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! It dealt ${finalDamage} damage and restored ${heal} HP! ${effect.message}`;
          } else if (effectType === 'damage+recoil') {
            // Deal damage, then deal recoil to user
            const attackerStats = myPoke.stats;
            const defenderStats = theirPoke.stats;
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
            // --- Screen effects: Light Screen, Reflect, Aurora Veil ---
            const theirSideEffects = isChallenger ? session.opponentSideEffects : session.challengerSideEffects;
            let finalDamage = damage;
            if (theirSideEffects && theirSideEffects.includes('light-screen') && moveObj.category === 'special') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('reflect') && moveObj.category === 'physical') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('aurora-veil')) {
              finalDamage = Math.floor(finalDamage / 2);
            }
            // --- Counter logic: reflect damage if target is countering ---
            if (
              theirPoke.counterActive &&
              ((theirPoke.counterType === 'physical' && moveObj.category === 'physical') ||
              (theirPoke.counterType === 'special' && moveObj.category === 'special'))
            ) {
              const reflected = finalDamage * 2;
              myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - reflected);
              session.log.push({ side: 'user', userId, text: `${theirPoke.name} countered! Reflected ${reflected} damage to ${myPoke.name}.` });
              delete theirPoke.counterActive;
              delete theirPoke.counterType;
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
            }
            let modifiedDamage = applyOnModifyDamage(theirPoke, finalDamage);
            theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - modifiedDamage);
            let recoil = Math.floor(finalDamage * (effect.recoil / 100));
            recoil = Math.max(1, recoil);
            myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - recoil);
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! It dealt ${finalDamage} damage, but was hurt by recoil (${recoil} HP)! ${effect.message}`;
          } else if (effectType === 'hazard') {
            // Set a field effect (e.g. spikes, toxic spikes, stealth rock)
            if (!session.fieldEffects) session.fieldEffects = [];
            session.fieldEffects.push(effect.hazard);
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! ${effect.message}`;
          } else if (effectType === 'sound') {
            // For now, treat as a normal damaging move
            const attackerStats = myPoke.stats;
            const defenderStats = theirPoke.stats;
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
            // --- Screen effects: Light Screen, Reflect, Aurora Veil ---
            const theirSideEffects = isChallenger ? session.opponentSideEffects : session.challengerSideEffects;
            let finalDamage = damage;
            if (theirSideEffects && theirSideEffects.includes('light-screen') && moveObj.category === 'special') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('reflect') && moveObj.category === 'physical') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('aurora-veil')) {
              finalDamage = Math.floor(finalDamage / 2);
            }
            // --- Counter logic: reflect damage if target is countering ---
            if (
              theirPoke.counterActive &&
              ((theirPoke.counterType === 'physical' && moveObj.category === 'physical') ||
              (theirPoke.counterType === 'special' && moveObj.category === 'special'))
            ) {
              const reflected = finalDamage * 2;
              myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - reflected);
              session.log.push({ side: 'user', userId, text: `${theirPoke.name} countered! Reflected ${reflected} damage to ${myPoke.name}.` });
              delete theirPoke.counterActive;
              delete theirPoke.counterType;
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
            }
            let modifiedDamage = applyOnModifyDamage(theirPoke, finalDamage);
            theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - modifiedDamage);
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! It dealt ${finalDamage} damage! ${effect.message}`;
          } else if (effectType === 'charge-attack') {
            // Multi-turn move: require a charge turn before attacking
            // Initialize chargeTurns if not present
            if (typeof myPoke.chargeTurns !== 'number') {
              myPoke.chargeTurns = 0;
            }
            
            if (myPoke.chargeTurns < (effect.chargeTurns || 1)) {
              myPoke.chargeTurns += 1;
              effectSucceeded = false;
              effectMsg = `${myPoke.name} is charging up! ${effect.message || ''}`;
            } else {
              // Now attack
              myPoke.chargeTurns = 0;
              delete myPoke.chargeTurns;
              const attackerStats = myPoke.stats;
              const defenderStats = theirPoke.stats;
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
              // --- Screen effects: Light Screen, Reflect, Aurora Veil ---
              const theirSideEffects = isChallenger ? session.opponentSideEffects : session.challengerSideEffects;
              let finalDamage = damage;
              if (theirSideEffects && theirSideEffects.includes('light-screen') && moveObj.category === 'special') {
                finalDamage = Math.floor(finalDamage / 2);
              }
              if (theirSideEffects && theirSideEffects.includes('reflect') && moveObj.category === 'physical') {
                finalDamage = Math.floor(finalDamage / 2);
              }
              if (theirSideEffects && theirSideEffects.includes('aurora-veil')) {
                finalDamage = Math.floor(finalDamage / 2);
              }
              // --- Counter logic: reflect damage if target is countering ---
              if (
                theirPoke.counterActive &&
                ((theirPoke.counterType === 'physical' && moveObj.category === 'physical') ||
                (theirPoke.counterType === 'special' && moveObj.category === 'special'))
              ) {
                const reflected = finalDamage * 2;
                myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - reflected);
                session.log.push({ side: 'user', userId, text: `${theirPoke.name} countered! Reflected ${reflected} damage to ${myPoke.name}.` });
                delete theirPoke.counterActive;
                delete theirPoke.counterType;
                session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
                session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
              }
              let modifiedDamage = applyOnModifyDamage(theirPoke, finalDamage);
              theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - modifiedDamage);
              effectSucceeded = true;
              effectMsg = `${myPoke.name} unleashed ${moveName}! It dealt ${finalDamage} damage!`;
            }
            session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
          } else if (effectType === 'damage+status') {
            // Damaging move with a status effect (e.g. Scald)
            const attackerStats = myPoke.stats;
            const defenderStats = theirPoke.stats;
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
            // --- Screen effects: Light Screen, Reflect, Aurora Veil ---
            const theirSideEffects = isChallenger ? session.opponentSideEffects : session.challengerSideEffects;
            let finalDamage = damage;
            if (theirSideEffects && theirSideEffects.includes('light-screen') && moveObj.category === 'special') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('reflect') && moveObj.category === 'physical') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('aurora-veil')) {
              finalDamage = Math.floor(finalDamage / 2);
            }
            // --- Counter logic: reflect damage if target is countering ---
            if (
              theirPoke.counterActive &&
              ((theirPoke.counterType === 'physical' && moveObj.category === 'physical') ||
              (theirPoke.counterType === 'special' && moveObj.category === 'special'))
            ) {
              const reflected = finalDamage * 2;
              myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - reflected);
              session.log.push({ side: 'user', userId, text: `${theirPoke.name} countered! Reflected ${reflected} damage to ${myPoke.name}.` });
              delete theirPoke.counterActive;
              delete theirPoke.counterType;
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
            }
            let modifiedDamage = applyOnModifyDamage(theirPoke, finalDamage);
            theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - modifiedDamage);
            if (!theirPoke.status && (!effect.chance || Math.random() * 100 < effect.chance)) {
              theirPoke.status = effect.status;
              session.log.push({ side: 'user', userId, text: `${theirPoke.name} ${effect.message}` });
              session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
            }
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! It dealt ${finalDamage} damage!`;
          } else if (effectType === 'user-faints') {
            // Self-fainting moves: deal damage, then user faints
            const attackerStats = myPoke.stats;
            const defenderStats = theirPoke.stats;
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
            // --- Screen effects: Light Screen, Reflect, Aurora Veil ---
            const theirSideEffects = isChallenger ? session.opponentSideEffects : session.challengerSideEffects;
            let finalDamage = damage;
            if (theirSideEffects && theirSideEffects.includes('light-screen') && moveObj.category === 'special') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('reflect') && moveObj.category === 'physical') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('aurora-veil')) {
              finalDamage = Math.floor(finalDamage / 2);
            }
            // --- Counter logic: reflect damage if target is countering ---
            if (
              theirPoke.counterActive &&
              ((theirPoke.counterType === 'physical' && moveObj.category === 'physical') ||
              (theirPoke.counterType === 'special' && moveObj.category === 'special'))
            ) {
              const reflected = finalDamage * 2;
              myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - reflected);
              session.log.push({ side: 'user', userId, text: `${theirPoke.name} countered! Reflected ${reflected} damage to ${myPoke.name}.` });
              delete theirPoke.counterActive;
              delete theirPoke.counterType;
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
            }
            let modifiedDamage = applyOnModifyDamage(theirPoke, finalDamage);
            theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - modifiedDamage);
            myPoke.currentHp = 0;
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! It dealt ${finalDamage} damage, but fainted!`;
          }
          // --- Special handling for hazard-remove (Rapid Spin, Defog) ---
          if (effectType === 'hazard-remove') {
            // Remove hazards from opponent's fieldEffects
            if (!session.fieldEffects) session.fieldEffects = [];
            const hazardsToRemove = effect.removes || [];
            const before = session.fieldEffects.length;
            session.fieldEffects = session.fieldEffects.filter(h => !hazardsToRemove.includes(h));
            const after = session.fieldEffects.length;
            let removed = before - after;
            let msg = `${myPoke.name} used ${moveName}!`;
            if (removed > 0) {
              msg += ` Removed hazards: ${hazardsToRemove.join(', ')}.`;
            } else {
              msg += ` No hazards to remove.`;
            }
            // For Defog: clear opponent's stat boosts
            if (effect.clearsBoosts) {
              const oppPokemons = isChallenger ? session.opponentPokemons : session.challengerPokemons;
              for (const poke of oppPokemons) {
                if (poke.boosts) {
                  for (const stat in poke.boosts) {
                    poke.boosts[stat] = 0;
                  }
                }
              }
              msg += ` Cleared opponent's stat boosts!`;
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
            }
            session.log.push({ side: 'user', userId, text: msg });
            session.markModified('fieldEffects');
            effectSucceeded = true;
            effectMsg = msg;
          }
          // --- Special handling for field effects (Tailwind, Trick Room) ---
          if (effectType === 'field') {
            if (!session.fieldEffects) session.fieldEffects = [];
            if (!session.fieldEffectDurations) session.fieldEffectDurations = {};
            const field = effect.field;
            const duration = effect.duration || 4;
            // Add or refresh the field effect
            if (!session.fieldEffects.includes(field)) {
              session.fieldEffects.push(field);
            }
            session.fieldEffectDurations[field] = duration;
            session.log.push({ side: 'user', userId, text: `${myPoke.name} used ${moveName}! ${effect.message} (${duration} turns)` });
            session.markModified('fieldEffects');
            session.markModified('fieldEffectDurations');
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! ${effect.message}`;
          }
          // --- Special handling for cure-team (Heal Bell, Aromatherapy) ---
          if (effectType === 'cure-team') {
            const myTeam = isChallenger ? session.challengerPokemons : session.opponentPokemons;
            let curedCount = 0;
            for (const poke of myTeam) {
              if (poke.status) {
                poke.status = null;
                curedCount++;
              }
              // Also cure confusion if present
              if (poke.confusionCounter) {
                delete poke.confusionCounter;
                curedCount++;
              }
            }
            session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
            const msg = `${myPoke.name} used ${moveName}! All status conditions were cured for the team! (${curedCount} cured)`;
            session.log.push({ side: 'user', userId, text: msg });
            effectSucceeded = true;
            effectMsg = msg;
          }
          // --- Special handling for prevent-status (Taunt) ---
          if (effectType === 'prevent-status') {
            const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
            targetPoke.tauntTurns = effect.duration || 3;
            session.log.push({ side: 'user', userId, text: `${myPoke.name} used ${moveName}! ${targetPoke.name} is taunted for ${targetPoke.tauntTurns} turns!` });
            session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! ${targetPoke.name} is taunted!`;
          }
          // --- Special handling for lock (Encore) ---
          if (effectType === 'lock') {
            const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
            // Lock the target into their last used move for duration
            if (targetPoke.lastMoveUsed) {
              targetPoke.encoreTurns = effect.duration || 3;
              targetPoke.encoreMove = targetPoke.lastMoveUsed;
              session.log.push({ side: 'user', userId, text: `${myPoke.name} used ${moveName}! ${targetPoke.name} is locked into ${targetPoke.encoreMove} for ${targetPoke.encoreTurns} turns!` });
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              effectSucceeded = true;
              effectMsg = `${myPoke.name} used ${moveName}! ${targetPoke.name} is encored!`;
            } else {
              effectMsg = `${myPoke.name} used ${moveName}! But it failed (no move to encore).`;
            }
          }
          // --- Special handling for disable (Disable) ---
          if (effectType === 'disable') {
            const targetPoke = effect.target === 'self' ? myPoke : theirPoke;
            // Disable the target's last used move for duration
            if (targetPoke.lastMoveUsed) {
              targetPoke.disableTurns = effect.duration || 2;
              targetPoke.disableMove = targetPoke.lastMoveUsed;
              session.log.push({ side: 'user', userId, text: `${myPoke.name} used ${moveName}! ${targetPoke.name}'s move ${targetPoke.disableMove} is disabled for ${targetPoke.disableTurns} turns!` });
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              effectSucceeded = true;
              effectMsg = `${myPoke.name} used ${moveName}! ${targetPoke.name}'s move is disabled!`;
            } else {
              effectMsg = `${myPoke.name} used ${moveName}! But it failed (no move to disable).`;
            }
          }
          // --- Special handling for multi-hit (Double Hit, Fury Cutter) ---
          if (effectType === 'multi-hit') {
            let hits = 2;
            if (typeof effect.hits === 'string' && effect.hits.includes('-')) {
              // e.g., '2-5'
              const [min, max] = effect.hits.split('-').map(Number);
              hits = Math.floor(Math.random() * (max - min + 1)) + min;
            } else if (typeof effect.hits === 'number') {
              hits = effect.hits;
            }
            let totalDamage = 0;
            let hitLog = [];
            for (let i = 0; i < hits; i++) {
              const attackerStats = myPoke.stats;
              const defenderStats = theirPoke.stats;
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
              // --- Screen effects: Light Screen, Reflect, Aurora Veil ---
              const theirSideEffects = isChallenger ? session.opponentSideEffects : session.challengerSideEffects;
              let finalDamage = damage;
              if (theirSideEffects && theirSideEffects.includes('light-screen') && moveObj.category === 'special') {
                finalDamage = Math.floor(finalDamage / 2);
              }
              if (theirSideEffects && theirSideEffects.includes('reflect') && moveObj.category === 'physical') {
                finalDamage = Math.floor(finalDamage / 2);
              }
              if (theirSideEffects && theirSideEffects.includes('aurora-veil')) {
                finalDamage = Math.floor(finalDamage / 2);
              }
              // --- Counter logic: reflect damage if target is countering ---
              if (
                theirPoke.counterActive &&
                ((theirPoke.counterType === 'physical' && moveObj.category === 'physical') ||
                (theirPoke.counterType === 'special' && moveObj.category === 'special'))
              ) {
                const reflected = finalDamage * 2;
                myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - reflected);
                session.log.push({ side: 'user', userId, text: `${theirPoke.name} countered! Reflected ${reflected} damage to ${myPoke.name}.` });
                delete theirPoke.counterActive;
                delete theirPoke.counterType;
                session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
                session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
              }
              let modifiedDamage = applyOnModifyDamage(theirPoke, finalDamage);
              theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - modifiedDamage);
              totalDamage += finalDamage;
              hitLog.push(`Hit ${i+1}: ${finalDamage} damage`);
              if (theirPoke.currentHp <= 0) break; // Stop if fainted
            }
            session.log.push({ side: 'user', userId, text: `${myPoke.name} used ${moveName}! ${hitLog.join(', ')} (Total: ${totalDamage})` });
            session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
            effectSucceeded = true;
            effectMsg = `${myPoke.name} used ${moveName}! Hit ${hits} times for a total of ${totalDamage} damage.`;
          }
          // Only decrement PP if effect succeeded
          if (effectSucceeded) {
            moveObj.currentPP = Math.max(0, (moveObj.currentPP || 0) - 1);
            // --- Integrate onDeductPP (e.g., Pressure) ---
            // If the move targets the opponent, apply to theirPoke
            if (theirPoke && theirPoke !== myPoke) {
              applyOnDeductPP(theirPoke, moveObj);
            }
          }
          session.log.push({ side: 'user', userId, text: effectMsg });
          session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
          // --- Integrate onAfterMove (e.g., Moxie) ---
          applyOnAfterMove(myPoke, theirPoke, moveObj, session, session.log);
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
          summary = effectMsg;
          if (session.status === 'finished') {
            // Process battle rewards
            await processBattleRewards(session);
            await session.save(); // Save again after processing rewards
            
            let endSummary = '';
            if (session.winnerId) {
              const winnerMention = `<@${session.winnerId}>`;
              endSummary = `Battle ended! Winner: ${winnerMention}`;
            } else {
              endSummary = `Battle ended! It's a draw!`;
            }
            summary += `\n${endSummary}`;
            return res.json({ session, summary });
          }
        } else {
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
            // Always switch turn on miss
            session.turn = isChallenger ? 'opponent' : 'challenger';
            summary = `${myPoke.name} used ${moveName}, but it missed!`;
            // Defensive block will run at the end
          } else {
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

            // --- Block damaging moves if target is protected ---
            if (theirPoke.isProtected && moveObj.power > 0) {
              session.log.push({ side: 'user', userId, text: `${theirPoke.name} protected itself! ${myPoke.name}'s attack failed.` });
              delete theirPoke.isProtected;
              delete myPoke.isProtected;
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
              summary = `${theirPoke.name} protected itself!`;
              session.turn = isChallenger ? 'opponent' : 'challenger';
              return res.json({ session, summary });
            }

            const dmgResult = battleUtils.calculateDamage(
              { level: myPoke.level, stats: attackerStats, types: myPoke.types },
              { stats: defenderStats, types: theirPoke.types },
              moveObj,
              typeEffectiveness,
              session.weather,
              session.terrain
            );
            const damage = dmgResult.damage;
            // --- Screen effects: Light Screen, Reflect, Aurora Veil ---
            const theirSideEffects = isChallenger ? session.opponentSideEffects : session.challengerSideEffects;
            let finalDamage = damage;
            if (theirSideEffects && theirSideEffects.includes('light-screen') && moveObj.category === 'special') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('reflect') && moveObj.category === 'physical') {
              finalDamage = Math.floor(finalDamage / 2);
            }
            if (theirSideEffects && theirSideEffects.includes('aurora-veil')) {
              finalDamage = Math.floor(finalDamage / 2);
            }
            // --- Counter logic: reflect damage if target is countering ---
            if (
              theirPoke.counterActive &&
              ((theirPoke.counterType === 'physical' && moveObj.category === 'physical') ||
              (theirPoke.counterType === 'special' && moveObj.category === 'special'))
            ) {
              const reflected = finalDamage * 2;
              myPoke.currentHp = Math.max(0, (myPoke.currentHp || myPoke.stats.hp) - reflected);
              session.log.push({ side: 'user', userId, text: `${theirPoke.name} countered! Reflected ${reflected} damage to ${myPoke.name}.` });
              delete theirPoke.counterActive;
              delete theirPoke.counterType;
              session.markModified(isChallenger ? 'opponentPokemons' : 'challengerPokemons');
              session.markModified(isChallenger ? 'challengerPokemons' : 'opponentPokemons');
            }
            let modifiedDamage = applyOnModifyDamage(theirPoke, finalDamage);
            theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - modifiedDamage);
            let effectivenessText = '';
            if (typeEffectiveness === 0) effectivenessText = ' It had no effect!';
            else if (typeEffectiveness > 1) effectivenessText = ' It was super effective!';
            else if (typeEffectiveness < 1) effectivenessText = ' It was not very effective.';
            session.log.push({ side: 'user', userId, text: `${myPoke.name} used ${moveName}! It dealt ${finalDamage} damage to ${theirPoke.name}.${effectivenessText} (${theirPoke.currentHp} HP left)` });
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
            summary = `${myPoke.name} used ${moveName}! It dealt ${finalDamage} damage to ${theirPoke.name}.${effectivenessText} (${theirPoke.currentHp} HP left)`;
            if (fainted) {
              summary += `\n${faintedName} fainted!`;
              if (switched && newActiveIndex !== null) {
                summary += ` Switched to ${myPokemons[newActiveIndex].name}.`;
              }
            }
          }
        }
      }
    }
    // --- FINAL DEFENSIVE: After all move/effect logic, check if either or both active Pokémon are fainted and auto-switch or end battle ---
    let postChanged = false;
    postChanged = autoSwitchIfFainted(session, true) || postChanged;
    postChanged = autoSwitchIfFainted(session, false) || postChanged;
    if (allFainted(session.challengerPokemons)) {
      session.status = 'finished';
      session.winnerId = session.opponentId;
    } else if (allFainted(session.opponentPokemons)) {
      session.status = 'finished';
      session.winnerId = session.challengerId;
    }
    await session.save();
    if (session.status === 'finished') {
      // Process battle rewards
      await processBattleRewards(session);
      await session.save(); // Save again after processing rewards
      
      let endSummary = '';
      if (session.winnerId) {
        const winnerMention = `<@${session.winnerId}>`;
        endSummary = `Battle ended! Winner: ${winnerMention}`;
      } else {
        endSummary = `Battle ended! It's a draw!`;
      }
      return res.json({ session, summary: endSummary });
    }
    // --- End of turn: clear isProtected for both active Pokémon ---
    const activeChallenger = session.challengerPokemons[session.activeChallengerIndex || 0];
    const activeOpponent = session.opponentPokemons[session.activeOpponentIndex || 0];
    if (activeChallenger && activeChallenger.isProtected) delete activeChallenger.isProtected;
    if (activeOpponent && activeOpponent.isProtected) delete activeOpponent.isProtected;
    session.markModified('challengerPokemons');
    session.markModified('opponentPokemons');
    // --- End of turn: clear counterActive/counterType for both active Pokémon ---
    if (activeChallenger && activeChallenger.counterActive) delete activeChallenger.counterActive;
    if (activeChallenger && activeChallenger.counterType) delete activeChallenger.counterType;
    if (activeOpponent && activeOpponent.counterActive) delete activeOpponent.counterActive;
    if (activeOpponent && activeOpponent.counterType) delete activeOpponent.counterType;
    // --- Add to session schema if not present ---
    if (!session.challengerSideEffects) session.challengerSideEffects = [];
    if (!session.opponentSideEffects) session.opponentSideEffects = [];
    if (!session.challengerSideEffectDurations) session.challengerSideEffectDurations = {};
    if (!session.opponentSideEffectDurations) session.opponentSideEffectDurations = {};
    // --- At end of turn: decrement and remove expired side effects ---
    ['challenger','opponent'].forEach(side => {
      const sideEffects = session[side + 'SideEffects'];
      const sideDurations = session[side + 'SideEffectDurations'];
      if (sideEffects && sideDurations) {
        for (const field of [...sideEffects]) {
          sideDurations[field] -= 1;
          if (sideDurations[field] <= 0) {
            const idx = sideEffects.indexOf(field);
            if (idx !== -1) sideEffects.splice(idx, 1);
            delete sideDurations[field];
            session.log.push({ side: 'system', text: `${field.replace('-', ' ')} wore off for ${side} side!` });
          }
        }
        session.markModified(side + 'SideEffects');
        session.markModified(side + 'SideEffectDurations');
      }
    });
    // --- Special handling for spread moves (Surf, Earthquake) ---
    if (effectType === 'spread') {
      // For singles, treat as normal damaging move, but log that it's a spread move
      session.log.push({ side: 'system', text: `${myPoke.name} used ${moveName}! (Spread move: would hit all opponents in doubles)` });
      // Proceed to normal damage logic below
    }
    // --- Special handling for clear-boosts (Haze) ---
    if (effectType === 'clear-boosts') {
      // Clear all stat boosts for all Pokémon on both sides
      for (const poke of session.challengerPokemons) {
        if (poke.boosts) {
          for (const stat in poke.boosts) {
            poke.boosts[stat] = 0;
          }
        }
      }
      for (const poke of session.opponentPokemons) {
        if (poke.boosts) {
          for (const stat in poke.boosts) {
            poke.boosts[stat] = 0;
          }
        }
      }
      session.markModified('challengerPokemons');
      session.markModified('opponentPokemons');
      session.log.push({ side: 'system', text: `All stat changes were erased by Haze!` });
      effectSucceeded = true;
      effectMsg = `${myPoke.name} used Haze! All stat changes were erased!`;
    }
    return res.json({ session, summary });
  } catch (err) {
    console.error('[BATTLE ERROR]', err, err && err.stack);
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
    // Do NOT process battle rewards on forfeit
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
    let activePoke;
    if (userId === session.challengerId) {
      activePoke = session.challengerPokemons[session.activeChallengerIndex || 0];
    } else if (userId === session.opponentId) {
      activePoke = session.opponentPokemons[session.activeOpponentIndex || 0];
    }
    // --- Advanced trapping: prevent switching if trapped, unless Ghost type ---
    if (activePoke && activePoke.partialTrapTurns > 0 && !(activePoke.types && activePoke.types.includes('ghost'))) {
      return res.status(400).json({ error: `${activePoke.name} is trapped and cannot switch out!` });
    }
    if (userId === session.challengerId) {
      applyOnSwitchOut(session.challengerPokemons[session.activeChallengerIndex || 0], session, session.log);
      session.activeChallengerIndex = newIndex;
      session.turn = 'opponent';
    } else if (userId === session.opponentId) {
      applyOnSwitchOut(session.opponentPokemons[session.activeOpponentIndex || 0], session, session.log);
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
    // In the switch route, if pivotSwitchPending is set for the user, clear the flag, perform the switch, and THEN set the turn to the opponent
    if (session.pivotSwitchPending && session.pivotSwitchPending === userId) {
      delete session.pivotSwitchPending;
      session.turn = userId === session.challengerId ? 'opponent' : 'challenger';
      session.log.push({ side: 'user', userId, text: `<@${userId}> switched out after using a pivot move!` });
    }
    return res.json({ session });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router; 