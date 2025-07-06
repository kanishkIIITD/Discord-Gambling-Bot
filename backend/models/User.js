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
  bailInfo: {
    amount: { type: Number, default: 0 },
    additionalJailTime: { type: Number, default: 0 },
    stealType: { type: String, enum: ['points', 'fish', 'animal', 'item'] },
    targetDiscordId: { type: String },
    calculatedAt: { type: Date }
  },
  begCooldown: { type: Date, default: null },
  lastBegged: { type: Date, default: null },
  stealPointsCooldown: { type: Date, default: null },
  stealFishCooldown: { type: Date, default: null },
  stealAnimalCooldown: { type: Date, default: null },
  stealItemCooldown: { type: Date, default: null },
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
    totalStolen: { type: Number, default: 0 },
    pointsSuccess: { type: Number, default: 0 },
    pointsFail: { type: Number, default: 0 },
    fishSuccess: { type: Number, default: 0 },
    fishFail: { type: Number, default: 0 },
    animalSuccess: { type: Number, default: 0 },
    animalFail: { type: Number, default: 0 },
    itemSuccess: { type: Number, default: 0 },
    itemFail: { type: Number, default: 0 }
  },
  stealFailureCount: { type: Number, default: 0 },
  lastStealFailure: { type: Date, default: null },
  workStats: {
    type: Object,
    default: {}
  },
  inventory: [
    {
      type: { type: String, enum: ['fish', 'animal', 'item'], required: true },
      name: { type: String, required: true },
      rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'transcendent','og'], required: true },
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
  activePunishments: [{
    type: { type: String, required: true },
    description: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    severity: { type: String, enum: ['light', 'medium', 'heavy'], default: 'medium' },
    stealType: { type: String, enum: ['points', 'fish', 'animal', 'item'] },
    targetDiscordId: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
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
  },
  lastGoldenTicketRedemption: { type: Date, default: null }
});

userSchema.index({ discordId: 1, guildId: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

module.exports = User; 