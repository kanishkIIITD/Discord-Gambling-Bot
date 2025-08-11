const mongoose = require('mongoose');

const CS2SkinSchema = new mongoose.Schema({
  skinId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  formattedName: {
    type: String,
    required: true
  },
  weapon: {
    type: String,
    required: true,
    index: true
  },
  skinName: {
    type: String,
    required: true
  },
  rarity: {
    type: String,
    enum: ['consumer grade', 'industrial grade', 'mil-spec', 'restricted', 'classified', 'covert', 'special'],
    required: true
  },
  imageUrl: {
    type: String
  },
  wear: {
    type: String,
    enum: ['factory new', 'minimal wear', 'field-tested', 'well-worn', 'battle-scarred'],
    default: 'field-tested'
  },
  isStatTrak: {
    type: Boolean,
    default: false
  },
  isSouvenir: {
    type: Boolean,
    default: false
  },
  marketValue: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
CS2SkinSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full skin name
CS2SkinSchema.virtual('fullName').get(function() {
  return `${this.weapon} | ${this.skinName}`;
});

// Virtual for rarity color
CS2SkinSchema.virtual('rarityColor').get(function() {
  const colors = {
    'consumer grade': 0xCCCCCC, // White
    'industrial grade': 0x5E98D9, // Light Blue
    'mil-spec': 0x4B69FF, // Blue
    'restricted': 0x8847FF, // Purple
    'classified': 0xD32CE6, // Pink
    'covert': 0xEB4B4B, // Red
    'special': 0xFFD700 // Gold
  };
  return colors[this.rarity] || 0xCCCCCC;
});

// Virtual for rarity emoji
CS2SkinSchema.virtual('rarityEmoji').get(function() {
  const emojis = {
    'consumer grade': '⚪',
    'industrial grade': '🔵',
    'mil-spec': '🔷',
    'restricted': '🟣',
    'classified': '🩷',
    'covert': '🔴',
    'special': '🟡'
  };
  return emojis[this.rarity] || '⚪';
});

// Index for efficient queries
CS2SkinSchema.index({ weapon: 1, rarity: 1 });
CS2SkinSchema.index({ rarity: 1, isActive: 1 });

module.exports = mongoose.model('CS2Skin', CS2SkinSchema);
