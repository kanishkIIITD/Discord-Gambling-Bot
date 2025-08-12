const mongoose = require('mongoose');

const CS2CaseOpeningSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  guildId: {
    type: String,
    required: true,
    index: true
  },
  caseId: {
    type: String,
    required: true,
    index: true
  },
  caseName: {
    type: String,
    required: true
  },
  openedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  cost: {
    type: Number,
    required: true
  },
  result: {
    skinId: {
      type: String,
      required: true
    },
    skinName: {
      type: String,
      required: true
    },
    weapon: {
      type: String,
      required: true
    },
    rarity: {
      type: String,
      required: true
    },
    wear: {
      type: String,
      default: 'field-tested'
    },
    float: {
      type: Number,
      default: 0.5
    },
    pattern: {
      type: String,
      default: ''
    },
    phase: {
      type: String,
      default: ''
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
    }
  },
  profit: {
    type: Number,
    default: 0
  },
  isProfitable: {
    type: Boolean,
    default: false
  },
  rarityTier: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    required: false,
    default: 'common'
  }
});

// Pre-validate hook to set rarityTier before validation
CS2CaseOpeningSchema.pre('validate', function(next) {
  // Determine rarity tier based on CS2 rarity
  // Handle both the original CS2 rarity names and the inferred rarity values
  const rarityTierMap = {
    // Original CS2 rarity names
    'consumer grade': 'common',
    'industrial grade': 'uncommon',
    'mil-spec': 'rare',
    'restricted': 'epic',
    'classified': 'legendary',
    'covert': 'legendary',
    'special': 'legendary'
  };
  
  // Debug logging
  console.log('🔍 Pre-validate hook - Document:', {
    hasResult: !!this.result,
    resultRarity: this.result?.rarity,
    currentRarityTier: this.rarityTier
  });
  
  // Ensure rarityTier is set, defaulting to 'common' if mapping fails
  if (this.result && this.result.rarity) {
    const mappedRarity = rarityTierMap[this.result.rarity.toLowerCase()];
    this.rarityTier = mappedRarity || 'common';
    console.log(`🎯 Mapped rarity "${this.result.rarity}" to tier "${this.rarityTier}"`);
  } else {
    this.rarityTier = 'common';
    console.log('⚠️ No result or rarity found, defaulting to common');
  }
  
  console.log('✅ Final rarityTier:', this.rarityTier);
  
  next();
});

// Update timestamp on save
CS2CaseOpeningSchema.pre('save', function(next) {
  // Calculate profit
  this.profit = this.result.marketValue - this.cost;
  this.isProfitable = this.profit > 0;
  
  next();
});

// Virtual for formatted result
CS2CaseOpeningSchema.virtual('formattedResult').get(function() {
  return `${this.result.weapon} | ${this.result.skinName}`;
});

// Virtual for rarity emoji
CS2CaseOpeningSchema.virtual('rarityEmoji').get(function() {
  const emojis = {
    'consumer grade': '⚪',
    'industrial grade': '🔵',
    'mil-spec': '🔷',
    'restricted': '🟣',
    'classified': '🩷',
    'covert': '🔴',
    'special': '🟡'
  };
  return emojis[this.result.rarity] || '⚪';
});

// Virtual for profit emoji
CS2CaseOpeningSchema.virtual('profitEmoji').get(function() {
  if (this.profit > 0) return '🟢';
  if (this.profit < 0) return '🔴';
  return '⚪';
});

// Method to get opening statistics
CS2CaseOpeningSchema.statics.getUserStats = async function(userId, guildId) {
  const stats = await this.aggregate([
    { $match: { userId, guildId } },
    {
      $group: {
        _id: null,
        totalOpenings: { $sum: 1 },
        totalSpent: { $sum: '$cost' },
        totalValue: { $sum: '$result.marketValue' },
        totalProfit: { $sum: '$profit' },
        profitableOpenings: {
          $sum: { $cond: ['$isProfitable', 1, 0] }
        },
        rarestDrop: {
          $max: {
            $switch: {
              branches: [
                { case: { $eq: ['$result.rarity', 'special'] }, then: 7 },
                { case: { $eq: ['$result.rarity', 'covert'] }, then: 6 },
                { case: { $eq: ['$result.rarity', 'classified'] }, then: 5 },
                { case: { $eq: ['$result.rarity', 'restricted'] }, then: 4 },
                { case: { $eq: ['$result.rarity', 'mil-spec'] }, then: 3 },
                { case: { $eq: ['$result.rarity', 'industrial grade'] }, then: 2 },
                { case: { $eq: ['$result.rarity', 'consumer grade'] }, then: 1 }
              ],
              default: 0
            }
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalOpenings: 0,
      totalSpent: 0,
      totalValue: 0,
      totalProfit: 0,
      profitableOpenings: 0,
      rarestDrop: null,
      profitMargin: 0
    };
  }

  const stat = stats[0];
  return {
    ...stat,
    profitMargin: stat.totalSpent > 0 ? (stat.totalProfit / stat.totalSpent) * 100 : 0
  };
};

// Index for efficient queries
CS2CaseOpeningSchema.index({ userId: 1, guildId: 1, openedAt: -1 });
CS2CaseOpeningSchema.index({ caseId: 1, openedAt: -1 });
CS2CaseOpeningSchema.index({ 'result.rarity': 1 });
CS2CaseOpeningSchema.index({ isProfitable: 1 });

module.exports = mongoose.model('CS2CaseOpening', CS2CaseOpeningSchema);
