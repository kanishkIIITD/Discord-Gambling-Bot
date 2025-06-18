const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true },
  guildId: { type: String, required: true },
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
  stealCooldown: { type: Date, default: null },
  currentTimeoutDuration: { type: Number, default: 0 },
  timeoutEndsAt: { type: Date, default: null },
  crimeStats: {
    success: { type: Number, default: 0 },
    fail: { type: Number, default: 0 },
    jail: { type: Number, default: 0 }
  },
  stealStats: {
    success: { type: Number, default: 0 },
    fail: { type: Number, default: 0 },
    jail: { type: Number, default: 0 },
    totalStolen: { type: Number, default: 0 }
  },
  workStats: {
    type: Object,
    default: {}
  },
  inventory: [
    {
      type: { type: String, enum: ['fish', 'animal', 'item'], required: true },
      name: { type: String, required: true },
      rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'transcendent'], required: true },
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
  lastTimeoutAt: { type: Date, default: null },
  timeoutHistory: [{
    targetDiscordId: { type: String, required: true },
    duration: { type: Number, required: true },
    cost: { type: Number, required: true },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  timeoutStats: {
    totalTimeouts: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 }
  }
});

userSchema.index({ discordId: 1, guildId: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

module.exports = User; 