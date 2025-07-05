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
  // Slot machine advanced settings
  slotAutoSpinDelay: {
    type: Number,
    default: 300,
    min: 0,
    max: 5000
  },
  slotAutoSpinDefaultCount: {
    type: Number,
    default: 1,
    min: 1,
    max: 50
  },
  // Sound settings
  defaultSoundVolume: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  // Add other preferences here as we define them
});

userPreferencesSchema.index({ user: 1, guildId: 1 }, { unique: true });

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

module.exports = UserPreferences;