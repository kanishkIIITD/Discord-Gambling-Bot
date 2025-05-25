const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  avatar: { type: String },
  email: { type: String },
  createdAt: { type: Date, default: Date.now },
  currentWinStreak: { type: Number, default: 0 },
  maxWinStreak: { type: Number, default: 0 },
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' }
});

const User = mongoose.model('User', userSchema);

module.exports = User; 