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
  }, // YYYY-MM-DD format
  rarity: { 
    type: String, 
    enum: ['common', 'uncommon', 'rare'], 
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
  purchasedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index to ensure one purchase per rarity per user per day
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