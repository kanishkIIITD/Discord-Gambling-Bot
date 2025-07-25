const mongoose = require('mongoose');
const supertest = require('supertest');
const express = require('express');
const battleRoutes = require('../routes/battleRoutes');
const { getLegalMoveset } = require('../utils/battleUtils');
const Pokemon = require('../models/Pokemon');
const User = require('../models/User');
const BattleSession = require('../models/BattleSession');
const fs = require('fs');
const outputFile = 'battle_test_output.txt';

function writeOutput(str) {
  fs.appendFileSync(outputFile, str + '\n');
}

// Overwrite output file at the start
fs.writeFileSync(outputFile, '');

// === TEAM A and TEAM B for full mechanic coverage ===
const teamA = [
  { name: 'Blissey',    iv: [31, 0, 31, 31, 31, 0], ev: [252, 0, 252, 4, 0, 0], nature: 'bold',    ability: 'natural-cure',   ownerId: 'A', uniqueId: 'blissey' },
  { name: 'Skarmory',   iv: [31, 0, 31, 0, 31, 31], ev: [252, 0, 252, 0, 0, 4], nature: 'impish',  ability: 'sturdy',         ownerId: 'A', uniqueId: 'skarmory' },
  { name: 'Toxapex',    iv: [31, 0, 31, 22, 31, 0], ev: [252, 0, 252, 4, 0, 0], nature: 'sassy',   ability: 'regenerator',    ownerId: 'A', uniqueId: 'toxapex' },
  { name: 'Whimsicott', iv: [31, 0, 31, 31, 31, 31], ev: [0, 0, 0, 252, 4, 252], nature: 'timid',  ability: 'prankster',      ownerId: 'A', uniqueId: 'whimsicott' },
  { name: 'Scizor',     iv: [31, 31, 31, 0, 31, 31], ev: [252, 252, 0, 0, 4, 0], nature: 'adamant', ability: 'technician',     ownerId: 'A', uniqueId: 'scizor' },
  { name: 'Garchomp',   iv: [31, 31, 31, 0, 31, 31], ev: [0, 252, 0, 0, 4, 252], nature: 'jolly',   ability: 'rough-skin',     ownerId: 'A', uniqueId: 'garchomp' },
];

const teamB = [
  { name: 'Gengar',     iv: [0, 0, 0, 31, 0, 31], ev: [0, 0, 0, 252, 4, 252], nature: 'timid',    ability: 'levitate',      ownerId: 'B', uniqueId: 'gengar' },
  { name: 'Breloom',    iv: [31, 31, 31, 0, 31, 31], ev: [0, 252, 0, 0, 4, 252], nature: 'adamant', ability: 'technician',   ownerId: 'B', uniqueId: 'breloom' },
  { name: 'Gliscor',    iv: [31, 31, 31, 0, 31, 31], ev: [244, 0, 252, 0, 12, 0], nature: 'impish', ability: 'poison-heal',  ownerId: 'B', uniqueId: 'gliscor' },
  { name: 'Rotom-wash', iv: [31, 0, 31, 31, 31, 31], ev: [252, 0, 0, 252, 4, 0], nature: 'modest',  ability: 'levitate',      ownerId: 'B', uniqueId: 'rotomw' },
  { name: 'Sylveon',    iv: [31, 0, 31, 31, 31, 0], ev: [252, 0, 0, 252, 4, 0], nature: 'modest',   ability: 'pixilate',      ownerId: 'B', uniqueId: 'sylveon' },
  { name: 'Tyranitar',  iv: [31, 31, 31, 0, 31, 31], ev: [252, 252, 0, 0, 4, 0], nature: 'adamant', ability: 'sand-stream',   ownerId: 'B', uniqueId: 'tyranitar' },
];

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/battles', battleRoutes);
const request = supertest(app);

// Mapping from Pokémon name to real PokéAPI ID
const nameToId = {
  'Blissey': 242,
  'Skarmory': 227,
  'Toxapex': 748,
  'Whimsicott': 547,
  'Scizor': 212,
  'Garchomp': 445,
  'Gengar': 94,
  'Breloom': 286,
  'Gliscor': 472,
  'Rotom-wash': 479, // Rotom base form
  'Sylveon': 700,
  'Tyranitar': 248,
};
function validPokemonIdForName(name) {
  return nameToId[name] || 1; // fallback to Bulbasaur
}

// Helper: insert test User into DB and return the doc
async function insertTestUser(userId, guildId) {
  let user = await User.findOne({ discordId: userId, guildId });
  if (!user) {
    user = await User.create({
      discordId: userId,
      guildId,
      // Add any other required fields for your User schema here
      username: userId + '_test',
    });
  }
  return user;
}

// Helper: insert test Pokémon into DB and return their docs
async function insertTestPokemon(team, userId, guildId) {
  const user = await insertTestUser(userId, guildId);
  const inserted = [];
  for (const poke of team) {
    const doc = await Pokemon.create({
      user: user._id, // set required user field
      discordId: userId,
      guildId,
      pokemonId: validPokemonIdForName(poke.name),
      name: poke.name,
      isShiny: false,
      nature: poke.nature,
      ability: poke.ability,
      ivs: {
        hp: poke.iv[0], attack: poke.iv[1], defense: poke.iv[2],
        spAttack: poke.iv[3], spDefense: poke.iv[4], speed: poke.iv[5]
      },
      evs: {
        hp: poke.ev[0], attack: poke.ev[1], defense: poke.ev[2],
        spAttack: poke.ev[3], spDefense: poke.ev[4], speed: poke.ev[5]
      },
      count: 1,
    });
    inserted.push(doc);
  }
  return inserted;
}

// Helper: clean up test Pokémon and Users from DB
async function cleanupTestData(guildId) {
  await Pokemon.deleteMany({ guildId });
  await User.deleteMany({ guildId });
  await BattleSession.deleteMany({ guildId }); // Clean up test battles
}

// Helper: create a battle session via API
async function createBattleSession(teamA, teamB) {
  const guildId = 'test-guild';
  // Insert Pokémon for both users
  const pokesA = await insertTestPokemon(teamA, 'A', guildId);
  const pokesB = await insertTestPokemon(teamB, 'B', guildId);

  // 1. Create battle
  const res1 = await request.post('/battles').send({
    challengerId: 'A',
    opponentId: 'B',
    guildId,
    count: 5, // must be 5 or less
    friendly: true,
  });
  if (!res1.body || !res1.body.battleId) {
    writeOutput('Failed to create battle: ' + JSON.stringify(res1.body, null, 2));
    throw new Error('Failed to create battle');
  }
  const battleId = res1.body.battleId;

  // 2. Accept battle
  const res2 = await request.post(`/battles/${battleId}/respond`).send({ accept: true, userId: 'B' });
  if (res2.status !== 200) {
    writeOutput('Failed to accept battle: ' + JSON.stringify(res2.body, null, 2));
    throw new Error('Failed to accept battle');
  }

  // 3. Select Pokémon for both users (use real _id values, only 5 per team)
  const res3 = await request.post(`/battles/${battleId}/select`).send({
    userId: 'A',
    selectedPokemonIds: pokesA.slice(0, 5).map(p => p._id.toString()),
  });
  if (res3.status !== 200) {
    writeOutput('Failed to select Pokémon for A: ' + JSON.stringify(res3.body, null, 2));
    throw new Error('Failed to select Pokémon for A');
  }
  const res4 = await request.post(`/battles/${battleId}/select`).send({
    userId: 'B',
    selectedPokemonIds: pokesB.slice(0, 5).map(p => p._id.toString()),
  });
  if (res4.status !== 200) {
    writeOutput('Failed to select Pokémon for B: ' + JSON.stringify(res4.body, null, 2));
    throw new Error('Failed to select Pokémon for B');
  }

  return battleId;
}

// Helper: get current session state
async function getSession(battleId) {
  const res = await request.get(`/battles/${battleId}`);
  return res.body.session;
}

// Helper: pick a random move for the active Pokémon
function pickRandomMove(poke) {
  const usable = (poke.moves || []).filter(m => m.currentPP > 0);
  if (usable.length === 0) return poke.moves[0].name;
  return usable[Math.floor(Math.random() * usable.length)].name;
}

// Simulate a full battle via API
async function simulateBattleAPI(teamA, teamB) {
  const battleId = await createBattleSession(teamA, teamB);
  let session = await getSession(battleId);
  let turnCount = 0;
  let summary = '';

  while (session && session.status === 'active' && turnCount < 500) {
    const isChallengerTurn = session.turn === 'challenger';
    const userId = isChallengerTurn ? 'A' : 'B';
    const myTeam = isChallengerTurn ? session.challengerPokemons : session.opponentPokemons;
    const myActive = myTeam[session[isChallengerTurn ? 'activeChallengerIndex' : 'activeOpponentIndex'] || 0];
    const moveName = pickRandomMove(myActive);

    // POST move
    const moveRes = await request.post(`/battles/${battleId}/move`).send({ userId, moveName });
    session = moveRes.body.session;
    summary = moveRes.body.summary || '';
    turnCount++;
    if (!session || session.status !== 'active') break;
  }

  return {
    winner: session && session.winnerId,
    turns: turnCount,
    log: session ? session.log : [],
    summary,
  };
}

// Batch test and summarize
async function batchSimulateAndSummarize() {
  const guildId = 'test-guild';
  await cleanupTestData(guildId); // Clean up before
  const results = [];
  for (let i = 0; i < 3; i++) {
    const result = await simulateBattleAPI([...teamA], [...teamB]);
    results.push(result);
    writeOutput(`\nBattle ${i + 1} Summary:`);
    result.log.forEach(entry => writeOutput(entry.text));
    writeOutput(`Turns: ${result.turns}`);
    if (result.winner) {
      writeOutput(`Winner: ${result.winner === 'A' ? 'Team A' : 'Team B'}`);
    }
  }
  const avgTurns = results.reduce((sum, r) => sum + r.turns, 0) / results.length;
  writeOutput(`\nAverage turns per battle: ${avgTurns}`);
  await cleanupTestData(guildId); // Clean up after
}

// Main runner for plain Node.js
async function main() {
  await mongoose.connect('mongodb://localhost:27017/gambling', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await batchSimulateAndSummarize();
  } finally {
    await mongoose.disconnect();
  }
}

main(); 