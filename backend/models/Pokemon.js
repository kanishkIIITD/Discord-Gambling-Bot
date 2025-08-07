const mongoose = require('mongoose');

const pokemonSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  discordId: { type: String, required: true },
  guildId: { type: String, required: true },
  pokemonId: { type: Number, required: true },
  name: { type: String, required: true },
  isShiny: { type: Boolean, default: false },
  // --- Form support ---
  formId: { type: String, default: null }, // e.g., "charizard-mega-x", "charizard-mega-y"
  formName: { type: String, default: null }, // e.g., "Mega Charizard X", "Mega Charizard Y"
  caughtAt: { type: Date, default: Date.now },
  count: { type: Number, default: 1 },
  // --- Competitive fields ---
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
  nature:  { type: String, default: 'hardy' }, // one of 25 natures
  ability: { type: String, default: '' }, // e.g. 'intimidate', 'huge-power'
  status:  { type: String, default: null }, // e.g. 'burned', 'paralyzed', etc.
  boosts: {
    attack:    { type: Number, default: 0 },
    defense:   { type: Number, default: 0 },
    spAttack:  { type: Number, default: 0 },
    spDefense: { type: Number, default: 0 },
    speed:     { type: Number, default: 0 },
    accuracy:  { type: Number, default: 0 },
    evasion:   { type: Number, default: 0 },
  },
  // EV history tracking
  evHistory: [{
    item: { type: String, required: true }, // e.g., 'hp_up', 'protein', 'rare_candy'
    stat: { type: String, required: true }, // e.g., 'hp', 'attack', 'all'
    amount: { type: Number, required: true }, // EVs added
    appliedAt: { type: Date, default: Date.now }
  }],
  // Optionally add more fields: region, dexNum, types, etc.
});

// Update index to include formId for proper form tracking
pokemonSchema.index({ discordId: 1, guildId: 1, pokemonId: 1, isShiny: 1, formId: 1 }, { unique: false });

const Pokemon = mongoose.model('Pokemon', pokemonSchema);

module.exports = Pokemon; 