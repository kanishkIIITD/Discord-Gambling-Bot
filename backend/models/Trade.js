const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  initiatorId: { type: String, required: true }, // Discord ID
  recipientId: { type: String, required: true }, // Discord ID
  initiatorPokemon: {
    type: Object,
    required: false,
    default: null
  },
  recipientPokemon: {
    type: Object,
    required: false,
    default: null
  },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trade', tradeSchema); 