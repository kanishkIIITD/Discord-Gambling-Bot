const mongoose = require('mongoose');

const packOpeningSchema = new mongoose.Schema({
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
  // Pack information
  packId: {
    type: String,
    required: true
  },
  packName: {
    type: String,
    required: true
  },
  packPrice: {
    type: Number,
    required: true
  },
  // Opening details
  openedAt: {
    type: Date,
    default: Date.now
  },
  // Cards obtained from this pack
  cardsObtained: [{
    cardId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    rarity: {
      type: String,
      required: true
    },
    supertype: {
      type: String,
      required: true
    },
    isFoil: {
      type: Boolean,
      default: false
    },
    condition: {
      type: String,
      default: 'Near Mint'
    },
    estimatedValue: {
      type: Number,
      default: 0
    },
    // Reference to the actual card in user's collection
    cardRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card'
    }
  }],
  // Opening statistics
  totalValue: {
    type: Number,
    default: 0
  },
  rarityBreakdown: {
    common: {
      type: Number,
      default: 0
    },
    uncommon: {
      type: Number,
      default: 0
    },
    rare: {
      type: Number,
      default: 0
    },
    'holo-rare': {
      type: Number,
      default: 0
    },
    'ultra-rare': {
      type: Number,
      default: 0
    }
  },
  // Special cards found
  specialCards: [{
    cardId: String,
    name: String,
    rarity: String,
    reason: String // e.g., "Holo Rare", "Ultra Rare", "Foil"
  }],
  // Opening metadata
  openingMethod: {
    type: String,
    enum: ['command', 'web', 'api'],
    default: 'command'
  },
  // Performance tracking
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  // Error tracking
  errors: [{
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
packOpeningSchema.index({ discordId: 1, guildId: 1 });
packOpeningSchema.index({ discordId: 1, guildId: 1, openedAt: -1 });
packOpeningSchema.index({ discordId: 1, guildId: 1, packId: 1 });
packOpeningSchema.index({ openedAt: -1 });

// Virtual to check if opening was successful
packOpeningSchema.virtual('wasSuccessful').get(function() {
  return this.cardsObtained.length > 0 && this.errors.length === 0;
});

// Virtual to get the rarest card from the opening
packOpeningSchema.virtual('rarestCard').get(function() {
  if (this.cardsObtained.length === 0) return null;
  
  const rarityOrder = ['common', 'uncommon', 'rare', 'holo-rare', 'ultra-rare'];
  let rarestCard = this.cardsObtained[0];
  
  for (const card of this.cardsObtained) {
    const currentIndex = rarityOrder.indexOf(card.rarity.toLowerCase());
    const rarestIndex = rarityOrder.indexOf(rarestCard.rarity.toLowerCase());
    
    if (currentIndex > rarestIndex) {
      rarestCard = card;
    }
  }
  
  return rarestCard;
});

// Method to calculate opening statistics
packOpeningSchema.methods.calculateStats = function() {
  this.totalValue = this.cardsObtained.reduce((sum, card) => sum + (card.estimatedValue || 0), 0);
  
  // Reset rarity breakdown
  this.rarityBreakdown = {
    common: 0,
    uncommon: 0,
    rare: 0,
    'holo-rare': 0,
    'ultra-rare': 0
  };
  
  // Count cards by rarity
  this.cardsObtained.forEach(card => {
    const rarity = card.rarity.toLowerCase();
    if (this.rarityBreakdown.hasOwnProperty(rarity)) {
      this.rarityBreakdown[rarity]++;
    }
  });
  
  // Identify special cards
  this.specialCards = [];
  this.cardsObtained.forEach(card => {
    if (card.rarity.toLowerCase() === 'holo-rare' || card.rarity.toLowerCase() === 'ultra-rare') {
      this.specialCards.push({
        cardId: card.cardId,
        name: card.name,
        rarity: card.rarity,
        reason: card.rarity
      });
    }
    if (card.isFoil) {
      this.specialCards.push({
        cardId: card.cardId,
        name: card.name,
        rarity: card.rarity,
        reason: 'Foil'
      });
    }
  });
};

// Static method to get user's opening statistics
packOpeningSchema.statics.getUserStats = async function(discordId, guildId, timeRange = null) {
  const matchQuery = { discordId, guildId };
  
  if (timeRange) {
    const now = new Date();
    const startDate = new Date(now.getTime() - timeRange);
    matchQuery.openedAt = { $gte: startDate };
  }
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalOpenings: { $sum: 1 },
        totalSpent: { $sum: '$packPrice' },
        totalValue: { $sum: '$totalValue' },
        totalCards: { $sum: { $size: '$cardsObtained' } },
        packBreakdown: {
          $push: {
            packId: '$packId',
            packName: '$packName',
            count: 1
          }
        },
        rarityBreakdown: {
          $push: '$rarityBreakdown'
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalOpenings: 0,
      totalSpent: 0,
      totalValue: 0,
      totalCards: 0,
      profitLoss: 0,
      packBreakdown: {},
      rarityBreakdown: {
        common: 0,
        uncommon: 0,
        rare: 0,
        'holo-rare': 0,
        'ultra-rare': 0
      }
    };
  }
  
  const stat = stats[0];
  
  // Process pack breakdown
  const packBreakdown = {};
  stat.packBreakdown.forEach(item => {
    packBreakdown[item.packName] = (packBreakdown[item.packName] || 0) + item.count;
  });
  
  // Process rarity breakdown
  const rarityBreakdown = {
    common: 0,
    uncommon: 0,
    rare: 0,
    'holo-rare': 0,
    'ultra-rare': 0
  };
  
  stat.rarityBreakdown.forEach(breakdown => {
    Object.keys(breakdown).forEach(rarity => {
      rarityBreakdown[rarity] += breakdown[rarity] || 0;
    });
  });
  
  return {
    totalOpenings: stat.totalOpenings,
    totalSpent: stat.totalSpent,
    totalValue: stat.totalValue,
    totalCards: stat.totalCards,
    profitLoss: stat.totalValue - stat.totalSpent,
    packBreakdown,
    rarityBreakdown
  };
};

// Static method to get recent openings
packOpeningSchema.statics.getRecentOpenings = function(discordId, guildId, limit = 10) {
  return this.find({ discordId, guildId })
    .sort({ openedAt: -1 })
    .limit(limit)
    .select('packName openedAt cardsObtained totalValue specialCards');
};

const PackOpening = mongoose.model('PackOpening', packOpeningSchema);

module.exports = PackOpening; 