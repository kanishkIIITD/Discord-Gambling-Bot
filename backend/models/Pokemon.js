const mongoose = require('mongoose');

const pokemonSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  discordId: { type: String, required: true },
  guildId: { type: String, required: true },
  pokemonId: { type: Number, required: true },
  name: { type: String, required: true },
  isShiny: { type: Boolean, default: false },
  caughtAt: { type: Date, default: Date.now },
  count: { type: Number, default: 1 },
  // Optionally add more fields: region, dexNum, types, etc.
});

pokemonSchema.index({ discordId: 1, guildId: 1, pokemonId: 1, isShiny: 1 }, { unique: false });

const Pokemon = mongoose.model('Pokemon', pokemonSchema);

module.exports = Pokemon; 