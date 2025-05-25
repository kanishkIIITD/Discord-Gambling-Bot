const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Each user has only one preference document
  },
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

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

module.exports = UserPreferences; 