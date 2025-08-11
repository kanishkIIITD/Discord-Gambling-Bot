const mongoose = require('mongoose');

const CS2CaseSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  formattedName: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Formatted name cannot be empty or null'
    }
  },
  imageUrl: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Image URL cannot be empty or null'
    }
  },
  requiresKey: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: true,
    default: 1000, // Default price in currency
    min: [0, 'Price cannot be negative']
  },
  items: {
    consumerGrade: { type: [String], default: [] },
    industrialGrade: { type: [String], default: [] },
    milSpec: { type: [String], default: [] },
    restricted: { type: [String], default: [] },
    classified: { type: [String], default: [] },
    covert: { type: [String], default: [] },
    special: { type: [String], default: [] } // For special items like knives, gloves
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
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
CS2CaseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for total items in case
CS2CaseSchema.virtual('totalItems').get(function() {
  return Object.values(this.items).reduce((total, items) => total + items.length, 0);
});

// Method to get random item based on rarity
CS2CaseSchema.methods.getRandomItem = function() {
  const rarities = Object.keys(this.items);
  const randomRarity = rarities[Math.floor(Math.random() * rarities.length)];
  const itemsInRarity = this.items[randomRarity];
  
  if (!itemsInRarity || itemsInRarity.length === 0) {
    return this.getRandomItem(); // Recursive call if rarity is empty
  }
  
  const randomItem = itemsInRarity[Math.floor(Math.random() * itemsInRarity.length)];
  return {
    name: randomItem,
    rarity: randomRarity,
    caseId: this.caseId
  };
};

module.exports = mongoose.model('CS2Case', CS2CaseSchema);
