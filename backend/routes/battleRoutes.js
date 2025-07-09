const express = require('express');
const router = express.Router();
const BattleSession = require('../models/BattleSession');
const Pokemon = require('../models/Pokemon');
const pokeApi = require('../utils/pokeApi');
const battleUtils = require('../utils/battleUtils');

// Helper function to get Pokémon data for selection
const getUserPokemons = async (userId, selectedPokemonIds) => {
  const pokemons = await Pokemon.find({ _id: { $in: selectedPokemonIds }, discordId: userId });
  return pokemons.map(p => ({
    pokemonId: p.pokemonId,
    name: p.name,
    isShiny: p.isShiny,
  }));
};

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
      const stats = battleUtils.calculateStats(pokeData.stats, 50);
      const types = pokeData.types.map(t => t.type.name);
      // --- Pass battleSize to getLegalMoveset ---
      const moves = await battleUtils.getLegalMoveset(pokeData.name, 50, 'scarlet-violet', battleSize);
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
      };
    }));
    if (isChallenger) {
      session.challengerPokemons = builtPokemons;
    } else {
      session.opponentPokemons = builtPokemons;
    }
    await session.save();
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
    if (myPoke.currentHp <= 0) return res.status(400).json({ error: 'Your Pokémon has fainted.' });
    if (theirPoke.currentHp <= 0) return res.status(400).json({ error: 'Opponent Pokémon has fainted.' });
    // Find the move object (must be in myPoke.moves)
    let moveObj = (myPoke.moves || []).find(m => m.name === moveName);
    if (!moveObj) return res.status(400).json({ error: 'Move not found or not usable by this Pokémon.' });
    // --- Prevent use if out of PP ---
    if (moveObj.currentPP === 0) {
      return res.status(400).json({ error: 'This move is out of PP and cannot be used.' });
    }
    // --- Decrement currentPP ---
    moveObj.currentPP = Math.max(0, (moveObj.currentPP || 0) - 1);
    // Calculate type effectiveness
    const typeEffectiveness = battleUtils.getTypeEffectiveness(moveObj.moveType, theirPoke.types);
    // Calculate damage using real stats and formula
    const dmgResult = battleUtils.calculateDamage(
      { level: myPoke.level, stats: myPoke.stats, types: myPoke.types },
      { stats: theirPoke.stats, types: theirPoke.types },
      moveObj,
      typeEffectiveness
    );
    const damage = dmgResult.damage;
    theirPoke.currentHp = Math.max(0, (theirPoke.currentHp || theirPoke.stats.hp) - damage);
    // Log the move
    let effectivenessText = '';
    if (typeEffectiveness === 0) effectivenessText = ' It had no effect!';
    else if (typeEffectiveness > 1) effectivenessText = ' It was super effective!';
    else if (typeEffectiveness < 1) effectivenessText = ' It was not very effective.';
    session.log.push(`${myPoke.name} used ${moveName}! It dealt ${damage} damage to ${theirPoke.name}.${effectivenessText} (${theirPoke.currentHp} HP left)`);
    // After applying damage and updating HP
    const allFainted = (pokemons) => pokemons.every(p => p.currentHp <= 0);

    let fainted = false;
    let switched = false;
    let faintedName = null;
    if (theirPoke.currentHp <= 0) {
        fainted = true;
        faintedName = theirPoke.name;
        // Find next available Pokémon for the defender
        const theirPokemons = isChallenger ? session.opponentPokemons : session.challengerPokemons;
        // Exclude current (fainted) Pokémon
        const nextIndex = theirPokemons.findIndex((p, idx) => p.currentHp > 0 && idx !== (isChallenger ? (session.activeOpponentIndex || 0) : (session.activeChallengerIndex || 0)));
        if (nextIndex !== -1) {
            // Switch to next available Pokémon
            if (isChallenger) {
                session.activeOpponentIndex = nextIndex;
            } else {
                session.activeChallengerIndex = nextIndex;
            }
            session.log.push(`${theirPoke.name} fainted! Switched to ${theirPokemons[nextIndex].name}.`);
            switched = true;
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
      if (switched) {
        const theirPokemons = isChallenger ? session.opponentPokemons : session.challengerPokemons;
        const nextIndex = isChallenger ? session.activeOpponentIndex : session.activeChallengerIndex;
        summary += ` Switched to ${theirPokemons[nextIndex].name}.`;
      }
    }
    if (session.status === 'finished') {
      const winnerMention = `<@${session.winnerId}>`;
      summary += `\nBattle ended! Winner: ${winnerMention}`;
    }
    return res.json({
      session,
      summary
    });
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
    session.log.push(`<@${userId}> forfeited!`);
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
    session.log.push(`<@${userId}> switched Pokémon!`);
    await session.save();
    return res.json({ session });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router; 