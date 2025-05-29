const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'bet',
      'win',
      'lose',
      'daily',
      'gift_sent',
      'gift_received',
      'jackpot',
      'jackpot_contribution',
      'meowbark',
      'refund',
      'trade_sent',
      'trade_received',
      'sell',
      'bail',
      'initial_balance',
      'giveaway'
    ],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', transactionSchema); 