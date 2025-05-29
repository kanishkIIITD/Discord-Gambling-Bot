const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  guildId: { type: String, required: true },
  itemsPerPage: {
    type: Number,
    default: 10, // Default value for items per page
    min: 5, // Minimum items per page
    max: 100 // Maximum items per page
  },
  confirmBetPlacement: {
    type: Boolean,
    default: true // Default to requiring confirmation for placing bets
  },
  // Add other preferences here as we define them
});

userPreferencesSchema.index({ user: 1, guildId: 1 }, { unique: true });

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

module.exports = UserPreferences; 