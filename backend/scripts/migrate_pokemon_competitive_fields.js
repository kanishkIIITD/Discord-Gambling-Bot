// migrate_pokemon_competitive_fields.js
const mongoose = require('mongoose');
const Pokemon = require('../models/Pokemon');
const { getPokemonDataById } = require('../utils/pokeApi');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Copy-paste or reimplement randomNature from userRoutes.js
function randomNature() {
  const natures = [
    'hardy','lonely','brave','adamant','naughty','bold','docile','relaxed','impish','lax',
    'timid','hasty','serious','jolly','naive','modest','mild','quiet','bashful','rash',
    'calm','gentle','sassy','careful','quirky'
  ];
  return natures[Math.floor(Math.random() * natures.length)];
}

function randomIVs() {
  return {
    hp: Math.floor(Math.random() * 32),
    attack: Math.floor(Math.random() * 32),
    defense: Math.floor(Math.random() * 32),
    spAttack: Math.floor(Math.random() * 32),
    spDefense: Math.floor(Math.random() * 32),
    speed: Math.floor(Math.random() * 32),
  };
}

function zeroEVs() {
  return {
    hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0
  };
}

function zeroBoosts() {
  return {
    attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0
  };
}

async function getRandomAbility(pokemonId) {
  try {
    const data = await getPokemonDataById(pokemonId);
    const abilities = (data.abilities || []).filter(a => !a.is_hidden);
    if (abilities.length === 0) return '';
    const idx = Math.floor(Math.random() * abilities.length);
    return abilities[idx].ability.name;
  } catch (e) {
    return '';
  }
}

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  const pokemons = await Pokemon.find({});
  for (const p of pokemons) {
    let update = {};
    update.ivs = randomIVs();
    update.evs = zeroEVs();
    update.nature = randomNature();
    update.ability = await getRandomAbility(p.pokemonId);
    update.status = null;
    update.boosts = zeroBoosts();
    if (Object.keys(update).length > 0) {
      await Pokemon.updateOne({ _id: p._id }, { $set: update });
      console.log(`Updated ${p.name} (${p._id})`);
    }
  }
  await mongoose.disconnect();
  console.log('Migration complete.');
}

migrate(); 