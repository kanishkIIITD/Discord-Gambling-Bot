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
      description: 'Base Set (1999). 7 Commons, 1 Rare, 3 Uncommons. Classic TCG slot order.',
      price: 1000000,
      cardCount: 11,
      rarityDistribution: {
        Common: 7,
        Uncommon: 3,
        Rare: 1
      },
      packRarity: 'common',
      guaranteedRare: true,
      holoChance: 0.15,
      allowedSets: ['base1'],
      releaseDate: '1999-01-09',
      setLogo: 'https://images.pokemontcg.io/base1/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'base2',
      name: 'Jungle',
      description: 'Jungle (1999). 7 Commons, 1 Rare, 3 Uncommons. Classic TCG slot order.',
      price: 800000,
      cardCount: 11,
      rarityDistribution: {
        Common: 7,
        Uncommon: 3,
        Rare: 1
      },
      packRarity: 'common',
      guaranteedRare: true,
      holoChance: 0.12,
      allowedSets: ['base2'],
      releaseDate: '1999-06-16',
      setLogo: 'https://images.pokemontcg.io/base2/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'basep',
      name: 'Wizards Black Star Promos',
      description: 'Wizards Black Star Promos. 1 Promo card per pack.',
      price: 1200000,
      cardCount: 1,
      rarityDistribution: {
        Promo: 1
      },
      packRarity: 'common',
      guaranteedRare: true,
      holoChance: 0.0,
      allowedSets: ['basep'],
      releaseDate: '1999-07-01',
      setLogo: 'https://images.pokemontcg.io/basep/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'base3', // Use TCG API set code for Fossil
      name: 'Fossil',
      description: 'Fossil (1999). 7 Commons, 1 Rare, 3 Uncommons. Classic TCG slot order.',
      price: 750000,
      cardCount: 11,
      rarityDistribution: {
        Common: 7,
        Uncommon: 3,
        Rare: 1
      },
      packRarity: 'common',
      guaranteedRare: true,
      holoChance: 0.12,
      allowedSets: ['base3'], // TCG API set code
      releaseDate: '1999-10-10',
      setLogo: 'https://images.pokemontcg.io/base3/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'base4',
      name: 'Base Set 2',
      description: 'Base Set 2 (2000). 7 Commons, 1 Rare, 3 Uncommons. Classic TCG slot order.',
      price: 600000,
      cardCount: 11,
      rarityDistribution: {
        Common: 7,
        Uncommon: 3,
        Rare: 1
      },
      packRarity: 'common',
      guaranteedRare: true,
      holoChance: 0.08,
      allowedSets: ['base4'],
      releaseDate: '2000-02-24',
      setLogo: 'https://images.pokemontcg.io/base4/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'base5',
      name: 'Team Rocket',
      description: 'Team Rocket (2000). 7 Commons, 1 Rare, 3 Uncommons. Classic TCG slot order.',
      price: 900000,
      cardCount: 11,
      rarityDistribution: {
        Common: 7,
        Uncommon: 3,
        Rare: 1
      },
      packRarity: 'common',
      guaranteedRare: true,
      holoChance: 0.14,
      allowedSets: ['base5'],
      releaseDate: '2000-04-24',
      setLogo: 'https://images.pokemontcg.io/base5/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'base6',
      name: 'Legendary Collection',
      description: 'Legendary Collection (2002). 7 Commons, 1 Rare, 3 Uncommons. Classic TCG slot order.',
      price: 1100000,
      cardCount: 11,
      rarityDistribution: {
        Common: 7,
        Uncommon: 3,
        Rare: 1
      },
      packRarity: 'common',
      guaranteedRare: true,
      holoChance: 0.20,
      allowedSets: ['base6'],
      releaseDate: '2002-05-24',
      setLogo: 'https://images.pokemontcg.io/base6/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'sm115',
      name: 'Hidden Fates (Shiny Vault)',
      description: 'Hidden Fates Shiny Vault (2019). 5-card all-foil booster: 3 Commons, 1 Uncommon, 1 Rare (guaranteed Shiny Vault slot).',
      price: 1200000,
      cardCount: 5,
      rarityDistribution: {
        common: 3,
        uncommon: 1,
        rare: 1
      },
      packRarity: 'epic',
      guaranteedHolo: true,
      foilGuaranteed: true,
      allowedSets: ['sm115'],
      releaseDate: '2019-08-23',
      setLogo: 'https://images.pokemontcg.io/hidden-fates/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'swsh45',
      name: 'Shining Fates',
      description: 'Shining Fates (2021). 1 Shiny Vault, 1 Rare/Holo, 1 Energy, 1 Reverse Holo, 6 Commons/Uncommons.',
      price: 1200000,
      cardCount: 10,
      rarityDistribution: {
        shiny: 1,
        rare: 1,
        energy: 1,
        reverseHolo: 1,
        common: 6
      },
      packRarity: 'epic',
      guaranteedHolo: true,
      allowedSets: ['swsh45'],
      releaseDate: '2021-02-19',
      setLogo: 'https://images.pokemontcg.io/swsh45/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'xy8',
      name: 'BREAKthrough',
      description: 'BREAKthrough (2015). 1 BREAK, 3 Uncommons, 6 Commons.',
      price: 900000,
      cardCount: 10,
      rarityDistribution: {
        break: 1,
        uncommon: 3,
        common: 6
      },
      packRarity: 'rare',
      guaranteedHolo: false,
      allowedSets: ['xy8'],
      releaseDate: '2015-11-04',
      setLogo: 'https://images.pokemontcg.io/xy8/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'swsh35',
      name: "Champion's Path",
      description: "Champion's Path (2020). 1 Holo or better, 3 Uncommons, 6 Commons.",
      price: 1000000,
      cardCount: 10,
      rarityDistribution: {
        rare: 1,
        uncommon: 3,
        common: 6
      },
      packRarity: 'epic',
      guaranteedHolo: true,
      allowedSets: ['swsh35'],
      releaseDate: '2020-09-25',
      setLogo: 'https://images.pokemontcg.io/swsh35/logo.png',
      dailyLimit: 0,
      weeklyLimit: 0
    },
    {
      packId: 'swsh9',
      name: 'Brilliant Stars',
      description: 'Brilliant Stars (2022). 1 Rare/Holo/Ultra/ACE, 1 Reverse Holo/Trainer Gallery, 3 Uncommons, 5 Commons.',
      price: 1100000,
      cardCount: 10,
      rarityDistribution: {
        rare: 1,
        reverseHolo: 1,
        uncommon: 3,
        common: 5
      },
      packRarity: 'epic',
      guaranteedHolo: true,
      allowedSets: ['swsh9'],
      releaseDate: '2022-02-25',
      setLogo: 'https://images.pokemontcg.io/swsh9/logo.png',
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