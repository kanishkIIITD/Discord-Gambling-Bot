const mongoose = require('mongoose');

const cardPackSchema = new mongoose.Schema({
  // Pack identification
  packId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  // Pack configuration
  price: {
    type: Number,
    required: true,
    min: 0
  },
  cardCount: {
    type: Number,
    required: true,
    min: 1,
    max: 20
  },
  // Rarity distribution (number of cards per rarity)
  rarityDistribution: {
    common: {
      type: Number,
      default: 0,
      min: 0
    },
    uncommon: {
      type: Number,
      default: 0,
      min: 0
    },
    rare: {
      type: Number,
      default: 0,
      min: 0
    },
    'holo-rare': {
      type: Number,
      default: 0,
      min: 0
    },
    'ultra-rare': {
      type: Number,
      default: 0,
      min: 0
    }
  },
  // Set restrictions (optional)
  allowedSets: [{
    type: String
  }],
  // Pack availability
  isActive: {
    type: Boolean,
    default: true
  },
  endDate: {
    type: Date,
    default: null // null means no end date
  },
  // Purchase limits
  dailyLimit: {
    type: Number,
    default: 10,
    min: 0 // 0 means no limit
  },
  weeklyLimit: {
    type: Number,
    default: 50,
    min: 0 // 0 means no limit
  },
  // Pack image
  imageUrl: {
    type: String,
    default: null
  },
  // Set metadata
  releaseDate: {
    type: String,
    default: null
  },
  setLogo: {
    type: String,
    default: null
  },
  // Pack rarity (for display purposes)
  packRarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  // Special features
  guaranteedHolo: {
    type: Boolean,
    default: false
  },
  guaranteedRare: {
    type: Boolean,
    default: false
  },
  holoChance: {
    type: Number,
    default: 0.25, // Default 25% chance, but classic sets use 33%
    min: 0,
    max: 1
  },
  // Metadata
  createdBy: {
    type: String,
    default: 'system'
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
cardPackSchema.index({ isActive: 1, packRarity: 1 });
cardPackSchema.index({ price: 1 });
cardPackSchema.index({ packId: 1 });

// Virtual to check if pack is available
cardPackSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return this.isActive && 
         (this.endDate === null || this.endDate > now);
});

// Method to validate rarity distribution
cardPackSchema.methods.validateDistribution = function() {
  const total = Object.values(this.rarityDistribution).reduce((sum, count) => sum + count, 0);
  return total === this.cardCount;
};

// Method to get pack display info
cardPackSchema.methods.getDisplayInfo = function() {
  return {
    id: this.packId,
    name: this.name,
    description: this.description,
    price: this.price,
    cardCount: this.cardCount,
    rarityDistribution: this.rarityDistribution,
    isAvailable: this.isAvailable,
    imageUrl: this.imageUrl,
    packRarity: this.packRarity,
    guaranteedHolo: this.guaranteedHolo,
    guaranteedRare: this.guaranteedRare
  };
};

// Static method to get available packs
cardPackSchema.statics.getAvailablePacks = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    $or: [
      { endDate: null },
      { endDate: { $gt: now } }
    ]
  }).sort({ price: 1, packRarity: 1 });
};

// Static method to create default packs
cardPackSchema.statics.createDefaultPacks = async function() {
  const defaultPacks = [
    {
      packId: 'base1',
      name: 'Base Set',
      description: 'The original Pokémon TCG expansion (1999). Features the core 150 Pokémon including iconic cards like Charizard and Blastoise! Each pack contains 9 cards: 1 Rare (33% chance holo), 3 Uncommon, and 5 Common cards. No energy cards.',
      price: 1500000,
      cardCount: 9,
      rarityDistribution: {
        common: 5,
        uncommon: 3,
        rare: 1,
        'holo-rare': 0,
        'ultra-rare': 0
      },
      packRarity: 'common',
      guaranteedRare: true,
      holoChance: 0.33, // 33% chance of holo rare
      allowedSets: ['base1'],
      releaseDate: '1999-01-09',
      setLogo: 'https://images.pokemontcg.io/base1/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'base2',
      name: 'Jungle',
      description: 'The first true expansion (1999). Introduces favorites like Vileplume and Scyther with non-holo vs holo rare variants! Each pack contains 9 cards: 1 Rare (33% chance holo), 3 Uncommon, and 5 Common cards. No energy cards.',
      price: 2000000,
      cardCount: 9,
      rarityDistribution: {
        common: 5,
        uncommon: 3,
        rare: 1,
        'holo-rare': 0,
        'ultra-rare': 0
      },
      packRarity: 'uncommon',
      guaranteedRare: true,
      holoChance: 0.33, // 33% chance of holo rare
      allowedSets: ['base2'],
      releaseDate: '1999-06-16',
      setLogo: 'https://images.pokemontcg.io/base2/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'base3',
      name: 'Fossil',
      description: 'The Fossil expansion (1999). Features fossil Pokémon like Aerodactyl and Ditto with the classic Starlight holo pattern! Each pack contains 9 cards: 1 Rare (33% chance holo), 3 Uncommon, and 5 Common cards. No energy cards.',
      price: 3000000,
      cardCount: 9,
      rarityDistribution: {
        common: 5,
        uncommon: 3,
        rare: 1,
        'holo-rare': 0,
        'ultra-rare': 0
      },
      packRarity: 'rare',
      guaranteedRare: true,
      holoChance: 0.33, // 33% chance of holo rare
      allowedSets: ['base3'],
      releaseDate: '1999-10-10',
      setLogo: 'https://images.pokemontcg.io/base3/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    }
  ];

  for (const packData of defaultPacks) {
    const existingPack = await this.findOne({ packId: packData.packId });
    if (!existingPack) {
      await this.create(packData);
      console.log(`Created default pack: ${packData.name}`);
    }
  }
};

const CardPack = mongoose.model('CardPack', cardPackSchema);

module.exports = CardPack; 