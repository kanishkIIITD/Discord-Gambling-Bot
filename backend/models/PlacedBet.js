const mongoose = require('mongoose');

const placedBetSchema = new mongoose.Schema({
  bet: { type: mongoose.Schema.Types.ObjectId, ref: 'Bet', required: true },
  bettor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  option: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  placedAt: { type: Date, default: Date.now },
  // Add other placed bet-related fields as needed (e.g., payout amount)
});

const PlacedBet = mongoose.model('PlacedBet', placedBetSchema);

module.exports = PlacedBet; 