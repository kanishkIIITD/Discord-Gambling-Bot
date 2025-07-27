const mongoose = require('mongoose');
const moveSchema = require('./Move');

const pokemonBattleSchema = new mongoose.Schema({
  pokemonId:   { type: Number, required: true },
  name:        { type: String, required: true },
  maxHp:       { type: Number, required: true },
  currentHp:   { type: Number, required: true },
  moves:       { type: [moveSchema], default: [] }, // use the explicit sub-schema
  isShiny:     { type: Boolean, required: true },
  level:       { type: Number, required: true },
  stats:       { type: Object, required: true }, // { hp, attack, defense, spAttack, spDefense, speed }
  types:       { type: [String], required: true },
  // --- Competitive enhancements ---
  ivs: {
    hp:        { type: Number, default: 31 },
    attack:    { type: Number, default: 31 },
    defense:   { type: Number, default: 31 },
    spAttack:  { type: Number, default: 31 },
    spDefense: { type: Number, default: 31 },
    speed:     { type: Number, default: 31 },
  },
  evs: {
    hp:        { type: Number, default: 0 },
    attack:    { type: Number, default: 0 },
    defense:   { type: Number, default: 0 },
    spAttack:  { type: Number, default: 0 },
    spDefense: { type: Number, default: 0 },
    speed:     { type: Number, default: 0 },
  },
  nature:      { type: String, default: 'hardy' }, // one of 25 natures
  ability:     { type: String, default: '' }, // e.g. 'intimidate', 'hugePower'
  status:      { type: String, default: null }, // e.g. 'burned', 'paralyzed', etc.
  boosts: {
    attack:    { type: Number, default: 0 },
    defense:   { type: Number, default: 0 },
    spAttack:  { type: Number, default: 0 },
    spDefense: { type: Number, default: 0 },
    speed:     { type: Number, default: 0 },
    accuracy:  { type: Number, default: 0 },
    evasion:   { type: Number, default: 0 },
  },
  // --- Battle state counters ---
  sleepCounter: { type: Number, default: null }, // For sleep status (Rest, etc.)
  chargeTurns:  { type: Number, default: null }, // For charge moves (Solar Beam, etc.)
  statusCounter: { type: Number, default: null }, // For badly poisoned status
  drowsy: { type: Number, default: null },         // For Yawn delayed sleep
  wishPending: { type: Number, default: null },    // For Wish delayed healing
  flyingRemoved: { type: Number, default: null },  // For Roost temporary Flying removal
  originalTypes: { type: [String], default: null }, // For Roost, to restore types
  tauntTurns: { type: Number, default: null },
  encoreTurns: { type: Number, default: null },
  encoreMove: { type: String, default: null },
  disableTurns: { type: Number, default: null },
  disableMove: { type: String, default: null },
  partialTrapTurns: { type: Number, default: null },
  partialTrapMove: { type: String, default: null },
  isProtected: { type: Boolean, default: null },
  counterActive: { type: Boolean, default: null },
  counterType: { type: String, default: null },
  lastMoveUsed: { type: String, default: null },
  leechSeedActive: { type: Boolean, default: null },
  leechSeededBy: { type: String, default: null },
  volatileStatuses: { type: Object, default: {} }, // For Yawn, Taunt, Encore, Disable, Confusion, Partial Trap, etc.
}, { _id: false });

const battleSessionSchema = new mongoose.Schema({
  challengerId:         { type: String, required: true },
  opponentId:           { type: String, required: true },
  guildId:              { type: String, required: true },
  challengerPokemons:   { type: [pokemonBattleSchema], required: true },
  opponentPokemons:     { type: [pokemonBattleSchema], required: true },
  turn:                 { type: String, enum: ['challenger', 'opponent'], required: true },
  log: [{
    side: { type: String, enum: ['user', 'system'], required: true },
    text: { type: String, required: true },
    userId: { type: String }, // only for side: 'user'
  }],
  status:               { type: String, enum: ['pending','active','finished','cancelled'], default: 'pending' },
  winnerId:             String,
  count:                { type: Number, required: true },
  activeChallengerIndex: { type: Number, default: 0 },
  activeOpponentIndex:   { type: Number, default: 0 },
  // --- Competitive global battle state ---
  weather: { type: String, default: null },
  weatherDuration: { type: Number, default: 0 },
  terrain: { type: String, default: null },
  terrainDuration: { type: Number, default: 0 },
  fieldEffects: [{ type: String, default: [] }], // e.g. 'reflect', 'light-screen', etc.
  fieldEffectDurations: { type: Object, default: {} }, // { effectName: turnsLeft }
  friendly: { type: Boolean, default: true }, // true = normal, false = winner gets 2x rewards and loser loses all Pokémon
  challengerSideEffects: { type: [String], default: [] },
  opponentSideEffects: { type: [String], default: [] },
  challengerSideEffectDurations: { type: Object, default: {} },
  opponentSideEffectDurations: { type: Object, default: {} },
  pivotSwitchPending: { type: String, default: null },
}, {
  timestamps: true
});

module.exports = mongoose.models.BattleSession ||
                 mongoose.model('BattleSession', battleSessionSchema); 