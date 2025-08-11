const mongoose = require('mongoose');

const CS2InventorySchema = new mongoose.Schema({
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
  skins: [{
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
    isStatTrak: {
      type: Boolean,
      default: false
    },
    isSouvenir: {
      type: Boolean,
      default: false
    },
    obtainedFrom: {
      caseId: String,
      caseName: String
    },
    obtainedAt: {
      type: Date,
      default: Date.now
    },
    marketValue: {
      type: Number,
      default: 0
    }
  }],
  statistics: {
    totalSkins: {
      type: Number,
      default: 0
    },
    casesOpened: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    rarestSkin: {
      type: String,
      default: null
    },
    mostExpensiveSkin: {
      type: String,
      default: null
    },
    rarityBreakdown: {
      consumerGrade: { type: Number, default: 0 },
      industrialGrade: { type: Number, default: 0 },
      milSpec: { type: Number, default: 0 },
      restricted: { type: Number, default: 0 },
      classified: { type: Number, default: 0 },
      covert: { type: Number, default: 0 },
      special: { type: Number, default: 0 }
    }
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
CS2InventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to add skin to inventory
CS2InventorySchema.methods.addSkin = function(skinData) {
  const newSkin = {
    skinId: skinData.skinId,
    skinName: skinData.skinName,
    weapon: skinData.weapon,
    rarity: skinData.rarity,
    wear: skinData.wear || 'field-tested',
    isStatTrak: skinData.isStatTrak || false,
    isSouvenir: skinData.isSouvenir || false,
    obtainedFrom: skinData.obtainedFrom,
    obtainedAt: new Date(),
    marketValue: skinData.marketValue || 0
  };

  this.skins.push(newSkin);
  this.updateStatistics();
  return newSkin;
};

// Method to remove skin from inventory
CS2InventorySchema.methods.removeSkin = function(skinId) {
  const skinIndex = this.skins.findIndex(skin => skin.skinId === skinId);
  if (skinIndex > -1) {
    const removedSkin = this.skins.splice(skinIndex, 1)[0];
    this.updateStatistics();
    return removedSkin;
  }
  return null;
};

// Method to update statistics
CS2InventorySchema.methods.updateStatistics = function() {
  this.statistics.totalSkins = this.skins.length;
  
  // Reset rarity breakdown
  Object.keys(this.statistics.rarityBreakdown).forEach(rarity => {
    this.statistics.rarityBreakdown[rarity] = 0;
  });

  // Count skins by rarity
  this.skins.forEach(skin => {
    const rarityKey = skin.rarity.replace(/\s+/g, '').replace('-', '');
    if (this.statistics.rarityBreakdown.hasOwnProperty(rarityKey)) {
      this.statistics.rarityBreakdown[rarityKey]++;
    }
  });

  // Find rarest skin (highest rarity value)
  const rarityValues = {
    'consumer grade': 1,
    'industrial grade': 2,
    'mil-spec': 3,
    'restricted': 4,
    'classified': 5,
    'covert': 6,
    'special': 7
  };

  let rarestSkin = null;
  let highestRarity = 0;

  this.skins.forEach(skin => {
    const rarityValue = rarityValues[skin.rarity] || 0;
    if (rarityValue > highestRarity) {
      highestRarity = rarityValue;
      rarestSkin = skin.skinName;
    }
  });

  this.statistics.rarestSkin = rarestSkin;

  // Find most expensive skin
  let mostExpensiveSkin = null;
  let highestValue = 0;

  this.skins.forEach(skin => {
    if (skin.marketValue > highestValue) {
      highestValue = skin.marketValue;
      mostExpensiveSkin = skin.skinName;
    }
  });

  this.statistics.mostExpensiveSkin = mostExpensiveSkin;
};

// Method to increment cases opened
CS2InventorySchema.methods.incrementCasesOpened = function() {
  this.statistics.casesOpened++;
};

// Method to add to total spent
CS2InventorySchema.methods.addToTotalSpent = function(amount) {
  this.statistics.totalSpent += amount;
};

// Index for efficient queries
CS2InventorySchema.index({ userId: 1, guildId: 1 });
CS2InventorySchema.index({ 'skins.rarity': 1 });
CS2InventorySchema.index({ 'statistics.totalSkins': -1 });

module.exports = mongoose.model('CS2Inventory', CS2InventorySchema);
