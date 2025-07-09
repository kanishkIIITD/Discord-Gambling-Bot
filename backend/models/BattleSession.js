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
}, { _id: false });

const battleSessionSchema = new mongoose.Schema({
  challengerId:         { type: String, required: true },
  opponentId:           { type: String, required: true },
  guildId:              { type: String, required: true },
  challengerPokemons:   { type: [pokemonBattleSchema], required: true },
  opponentPokemons:     { type: [pokemonBattleSchema], required: true },
  turn:                 { type: String, enum: ['challenger', 'opponent'], required: true },
  log:                  [{ type: String }],
  status:               { type: String, enum: ['pending','active','finished','cancelled'], default: 'pending' },
  winnerId:             String,
  count:                { type: Number, required: true },
  activeChallengerIndex: { type: Number, default: 0 },
  activeOpponentIndex:   { type: Number, default: 0 },
}, {
  timestamps: true
});

module.exports = mongoose.models.BattleSession ||
                 mongoose.model('BattleSession', battleSessionSchema); 