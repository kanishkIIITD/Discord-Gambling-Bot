const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  guildId: { type: String, required: true },
  balance: { type: Number, required: true, default: 0 },
  lastDailyClaim: { type: Date, default: null },
  dailyStreak: { type: Number, default: 0 },
  slotLossStreak: { type: Number, default: 0 },
  freeSpins: { type: Number, default: 0 },
  // Add other wallet-related fields as needed (e.g., transaction history reference)
}, { timestamps: true });

walletSchema.index({ user: 1, guildId: 1 }, { unique: true });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet; 