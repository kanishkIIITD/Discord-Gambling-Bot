const mongoose = require('mongoose');

const dailyShopPurchaseSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  discordId: { 
    type: String, 
    required: true 
  },
  guildId: { 
    type: String, 
    required: true 
  },
  date: { 
    type: String, 
    required: true 
  }, // YYYY-MM-DD or YYYY-MM-DD-0/1 (half-day)
  rarity: { 
    type: String, 
    enum: ['common', 'uncommon', 'rare', 'legendary'], 
    required: true 
  },
  pokemonName: { 
    type: String, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true 
  },
  isShiny: {
    type: Boolean,
    default: false
  },
  purchasedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index to ensure one purchase per rarity per user per half-day
dailyShopPurchaseSchema.index({ 
  discordId: 1, 
  guildId: 1, 
  date: 1, 
  rarity: 1 
}, { 
  unique: true 
});

// Index for efficient queries
dailyShopPurchaseSchema.index({ 
  discordId: 1, 
  guildId: 1, 
  date: 1 
});

const DailyShopPurchase = mongoose.model('DailyShopPurchase', dailyShopPurchaseSchema);

module.exports = DailyShopPurchase; 