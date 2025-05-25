const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  description: { type: String, required: true },
  options: [{ type: String, required: true }], // Array of possible outcomes
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['open', 'closed', 'resolved'], default: 'open' },
  winningOption: { type: String }, // To be filled upon resolution
  createdAt: { type: Date, default: Date.now },
  closingTime: { type: Date }, // Time when betting closes
  // Add other bet-related fields as needed (e.g., end time, related message ID)
});

const Bet = mongoose.model('Bet', betSchema);

module.exports = Bet; 