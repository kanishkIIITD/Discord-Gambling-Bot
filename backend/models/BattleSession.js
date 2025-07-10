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
  weather:     { type: String, enum: [null, 'rain', 'sunny', 'hail', 'sandstorm'], default: null },
  terrain:     { type: String, enum: [null, 'electric', 'grassy', 'misty', 'psychic'], default: null },
  fieldEffects: [{ type: String, default: [] }], // e.g. 'reflect', 'light-screen', etc.
}, {
  timestamps: true
});

module.exports = mongoose.models.BattleSession ||
                 mongoose.model('BattleSession', battleSessionSchema); 