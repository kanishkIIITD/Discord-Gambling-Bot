const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  avatar: { type: String },
  email: { type: String },
  createdAt: { type: Date, default: Date.now },
  currentWinStreak: { type: Number, default: 0 },
  maxWinStreak: { type: Number, default: 0 },
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  crimeCooldown: { type: Date, default: null },
  workCooldown: { type: Date, default: null },
  fishCooldown: { type: Date, default: null },
  huntCooldown: { type: Date, default: null },
  jailedUntil: { type: Date, default: null },
  begCooldown: { type: Date, default: null },
  lastBegged: { type: Date, default: null },
  crimeStats: {
    success: { type: Number, default: 0 },
    fail: { type: Number, default: 0 },
    jail: { type: Number, default: 0 }
  },
  workStats: {
    type: Object,
    default: {}
  },
  inventory: [
    {
      type: { type: String, enum: ['fish', 'animal', 'item'], required: true },
      name: { type: String, required: true },
      rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'legendary'], required: true },
      value: { type: Number, required: true },
      count: { type: Number, default: 1 }
    }
  ],
  buffs: [
    {
      type: { type: String, required: true },
      description: { type: String, required: true },
      expiresAt: { type: Date },
      usesLeft: { type: Number }
    }
  ],
  duelWins: { type: Number, default: 0 },
  duelLosses: { type: Number, default: 0 },
  mysteryboxCooldown: { type: Date, default: null },
});

const User = mongoose.model('User', userSchema);

module.exports = User; 