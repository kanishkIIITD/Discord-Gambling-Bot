const mongoose = require('mongoose');

const duelSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  challengerDiscordId: { type: String, required: true },
  opponentDiscordId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'resolved', 'timeout'], default: 'pending' },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winnerDiscordId: { type: String },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  actionText: { type: String },
  expiresAt: { type: Date },
  notified: { type: Boolean, default: false },
});

module.exports = mongoose.model('Duel', duelSchema); 