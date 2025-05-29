const mongoose = require('mongoose');

const blackjackGameSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deck: [{
    suit: String,
    value: String
  }],
  playerHands: [[{
    suit: String,
    value: String
  }]],
  dealerHand: [{
    suit: String,
    value: String
  }],
  bets: [Number],
  currentHand: {
    type: Number,
    default: 0
  },
  gameOver: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Automatically delete games after 1 hour
  }
});

module.exports = mongoose.model('BlackjackGame', blackjackGameSchema); 