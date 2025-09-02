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
  // New multi-item support (backward compatible)
  initiatorItems: {
    type: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        isShiny: { type: Boolean, default: false },
        quantity: { type: Number, default: 1 }
      }
    ],
    default: []
  },
  recipientItems: {
    type: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        isShiny: { type: Boolean, default: false },
        quantity: { type: Number, default: 1 }
      }
    ],
    default: []
  },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trade', tradeSchema); 