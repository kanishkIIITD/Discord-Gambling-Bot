const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
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
  // TCG API card information
  cardId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  set: {
    id: String,
    name: String,
    series: String,
    printedTotal: Number,
    total: Number,
    legalities: {
      unlimited: String,
      expanded: String,
      standard: String
    },
    ptcgoCode: String,
    releaseDate: String,
    updatedAt: String,
    images: {
      symbol: String,
      logo: String
    }
  },
  images: {
    small: String,
    large: String
  },
  rarity: {
    type: String,
    enum: [
      "ACE SPEC Rare",
      "Amazing Rare",
      "Black White Rare",
      "Classic Collection",
      "Common",
      "Double Rare",
      "Hyper Rare",
      "Illustration Rare",
      "LEGEND",
      "Promo",
      "Radiant Rare",
      "Rare",
      "Rare ACE",
      "Rare BREAK",
      "Rare Holo",
      "Rare Holo EX",
      "Rare Holo GX",
      "Rare Holo LV.X",
      "Rare Holo Star",
      "Rare Holo V",
      "Rare Holo VMAX",
      "Rare Holo VSTAR",
      "Rare Prime",
      "Rare Prism Star",
      "Rare Rainbow",
      "Rare Secret",
      "Rare Shining",
      "Rare Shiny",
      "Rare Shiny GX",
      "Rare Ultra",
      "Shiny Rare",
      "Shiny Ultra Rare",
      "Special Illustration Rare",
      "Trainer Gallery Rare Holo",
      "Ultra Rare",
      "Uncommon"
  ],
    required: true
  },
  supertype: {
    type: String,
    enum: ['Pokémon', 'Trainer', 'Energy'],
    required: true
  },
  subtypes: [String],
  types: [String],
  // Card stats (for Pokémon cards)
  hp: String,
  attacks: [{
    name: String,
    cost: [String],
    convertedEnergyCost: Number,
    damage: String,
    text: String
  }],
  weaknesses: {
    type: [{
      type: { type: String, required: true },
      value: { type: String, required: true }
    }],
    default: []
  },
  resistances: {
    type: [{
      type: { type: String, required: true },
      value: { type: String, required: true }
    }],
    default: []
  },
  retreatCost: [String],
  convertedRetreatCost: Number,
  // Card condition and collection info
  condition: {
    type: String,
    enum: ['Mint', 'Near Mint', 'Excellent', 'Good', 'Light Played', 'Played', 'Poor'],
    default: 'Near Mint'
  },
  isFoil: {
    type: Boolean,
    default: false
  },
  isReverseHolo: {
    type: Boolean,
    default: false
  },
  count: {
    type: Number,
    default: 1
  },
  // Collection metadata
  obtainedAt: {
    type: Date,
    default: Date.now
  },
  obtainedFrom: {
    type: String,
    enum: ['pack', 'trade', 'gift', 'purchase'],
    default: 'pack'
  },
  packId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CardPack'
  },
  // Market value (can be updated periodically)
  estimatedValue: {
    type: Number,
    default: 0
  },
  lastValueUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
cardSchema.index({ discordId: 1, guildId: 1 });
cardSchema.index({ discordId: 1, guildId: 1, cardId: 1 });
cardSchema.index({ discordId: 1, guildId: 1, rarity: 1 });
cardSchema.index({ discordId: 1, guildId: 1, supertype: 1 });
cardSchema.index({ discordId: 1, guildId: 1, set: 1 });

// Pre-save middleware to handle data validation and transformation
cardSchema.pre('save', function(next) {
  // Temporarily disable pre-save middleware to debug the issue
  next();
});

// Unique compound index to prevent duplicate cards per user per guild
cardSchema.index({ 
  discordId: 1, 
  guildId: 1, 
  cardId: 1, 
  condition: 1, 
  isFoil: 1,
  isReverseHolo: 1
}, { 
  unique: true 
});

// Virtual for full card identifier
cardSchema.virtual('fullCardId').get(function() {
  return `${this.cardId}-${this.condition}-${this.isFoil ? 'foil' : 'normal'}`;
});

// Method to get card display name
cardSchema.methods.getDisplayName = function() {
  let name = this.name;
  if (this.isReverseHolo) {
    name += ' (Reverse Holo)';
  } else if (this.isFoil) {
    name += ' (Foil)';
  }
  return name;
};

// Method to get card value with condition modifier
cardSchema.methods.getValueWithCondition = function() {
  const conditionModifiers = {
    'Mint': 1.2,
    'Near Mint': 1.0,
    'Excellent': 0.8,
    'Good': 0.6,
    'Light Played': 0.4,
    'Played': 0.2,
    'Poor': 0.1
  };
  
  const modifier = conditionModifiers[this.condition] || 1.0;
  return Math.floor(this.estimatedValue * modifier);
};

// Static method to get user's collection statistics
cardSchema.statics.getCollectionStats = async function(discordId, guildId) {
  const stats = await this.aggregate([
    { $match: { discordId, guildId } },
    {
      $group: {
        _id: null,
        totalCards: { $sum: '$count' },
        uniqueCards: { $sum: 1 },
        totalValue: { $sum: '$estimatedValue' },
        rarityBreakdown: {
          $push: {
            rarity: '$rarity',
            count: '$count'
          }
        },
        supertypeBreakdown: {
          $push: {
            supertype: '$supertype',
            count: '$count'
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalCards: 0,
      uniqueCards: 0,
      totalValue: 0,
      rarityBreakdown: {},
      supertypeBreakdown: {}
    };
  }

  const stat = stats[0];
  
  // Process rarity breakdown
  const rarityBreakdown = {};
  stat.rarityBreakdown.forEach(item => {
    rarityBreakdown[item.rarity] = (rarityBreakdown[item.rarity] || 0) + item.count;
  });

  // Process supertype breakdown
  const supertypeBreakdown = {};
  stat.supertypeBreakdown.forEach(item => {
    supertypeBreakdown[item.supertype] = (supertypeBreakdown[item.supertype] || 0) + item.count;
  });

  return {
    totalCards: stat.totalCards,
    uniqueCards: stat.uniqueCards,
    totalValue: stat.totalValue,
    rarityBreakdown,
    supertypeBreakdown
  };
};

const Card = mongoose.model('Card', cardSchema);

module.exports = Card; 