const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  initiatorId: { type: String, required: true }, // Discord ID
  recipientId: { type: String, required: true }, // Discord ID
  initiatorPokemon: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    isShiny: { type: Boolean, required: true },
    quantity: { type: Number, required: true }
  },
  recipientPokemon: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    isShiny: { type: Boolean, required: true },
    quantity: { type: Number, required: true }
  },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trade', tradeSchema); 