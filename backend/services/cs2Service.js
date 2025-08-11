const CS2Case = require('../models/CS2Case');
const CS2Skin = require('../models/CS2Skin');
const CS2Inventory = require('../models/CS2Inventory');
const CS2CaseOpening = require('../models/CS2CaseOpening');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const cs2DataService = require('./cs2DataService');

class CS2Service {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('📊 CS2 service already initialized, skipping...');
      return;
    }

    try {
      console.log('🔄 Initializing CS2 service...');
      // Initialize with smart database sync (only if needed)
      await cs2DataService.initialize();
      this.isInitialized = true;
      console.log('✅ CS2 service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CS2 service:', error);
      throw error;
    }
  }

  // Check if service needs initialization
  needsInitialization() {
    return !this.isInitialized;
  }

  // Get service status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      dataServiceStatus: cs2DataService.getStatus()
    };
  }

  // Force refresh with database sync (for maintenance)
  async forceRefresh() {
    this.isInitialized = false;
    await cs2DataService.forceRefresh();
    await this.initialize();
  }

  // Refresh without database sync (for data updates only)
  async refreshDataOnly() {
    this.isInitialized = false;
    await cs2DataService.refreshDataOnly();
    await this.initialize();
  }

  // Get all available cases
  async getAllCases() {
    await this.initialize();
    return cs2DataService.getAllCases();
  }

  // Get case by ID
  async getCase(caseId) {
    await this.initialize();
    return cs2DataService.getCase(caseId);
  }

  // Get user's CS2 inventory
  async getUserInventory(userId, guildId) {
    let inventory = await CS2Inventory.findOne({ userId, guildId });
    
    if (!inventory) {
      inventory = new CS2Inventory({
        userId,
        guildId,
        skins: [],
        statistics: {
          totalSkins: 0,
          casesOpened: 0,
          totalSpent: 0,
          rarestSkin: null,
          mostExpensiveSkin: null,
          rarityBreakdown: {
            consumerGrade: 0,
            industrialGrade: 0,
            milSpec: 0,
            restricted: 0,
            classified: 0,
            covert: 0,
            special: 0
          }
        }
      });
      await inventory.save();
    }
    
    return inventory;
  }

  // Open a case
  async openCase(userId, guildId, caseId) {
    await this.initialize();

    // Get case data
    const caseData = cs2DataService.getCase(caseId);
    if (!caseData) {
      throw new Error('Case not found');
    }

    // Check if user has enough money
    // First find the user by discordId, then find their wallet
    const user = await User.findOne({ discordId: userId, guildId });
    if (!user) {
      throw new Error('User not found');
    }
    
    const wallet = await Wallet.findOne({ user: user._id, guildId });
    if (!wallet || wallet.balance < caseData.price) {
      throw new Error(`Insufficient funds. You need ${caseData.price} points to open this case.`);
    }

    // Deduct money from wallet
    wallet.balance -= caseData.price;
    await wallet.save();

    // Get random skin from case
    const skinData = cs2DataService.getRandomSkinFromCase(caseId);
    if (!skinData) {
      throw new Error('Failed to get skin from case');
    }

    // Create case opening record
    const caseOpening = new CS2CaseOpening({
      userId,
      guildId,
      caseId: caseData.caseId,
      caseName: caseData.formattedName,
      cost: caseData.price,
      result: {
        skinId: skinData.skinId,
        skinName: skinData.skinName,
        weapon: skinData.weapon,
        rarity: skinData.rarity,
        wear: skinData.wear,
        isStatTrak: skinData.isStatTrak,
        isSouvenir: skinData.isSouvenir,
        marketValue: skinData.marketValue
      }
    });

    await caseOpening.save();

    // Add skin to user's inventory
    const inventory = await this.getUserInventory(userId, guildId);
    inventory.addSkin({
      skinId: skinData.skinId,
      skinName: skinData.skinName,
      weapon: skinData.weapon,
      rarity: skinData.rarity,
      wear: skinData.wear,
      isStatTrak: skinData.isStatTrak,
      isSouvenir: skinData.isSouvenir,
      obtainedFrom: {
        caseId: caseData.caseId,
        caseName: caseData.formattedName
      },
      marketValue: skinData.marketValue
    });

    inventory.incrementCasesOpened();
    inventory.addToTotalSpent(caseData.price);
    await inventory.save();

    return {
      caseOpening,
      inventory,
      skin: skinData
    };
  }

  // Get user's case opening statistics
  async getUserStats(userId, guildId) {
    const stats = await CS2CaseOpening.getUserStats(userId, guildId);
    const inventory = await this.getUserInventory(userId, guildId);
    
    return {
      ...stats,
      inventoryStats: inventory.statistics
    };
  }

  // Get user's recent openings
  async getUserRecentOpenings(userId, guildId, limit = 10) {
    return await CS2CaseOpening.find({ userId, guildId })
      .sort({ openedAt: -1 })
      .limit(limit);
  }

  // Search skins
  async searchSkins(query, limit = 20) {
    await this.initialize();
    return cs2DataService.searchSkins(query).slice(0, limit);
  }

  // Get skins by rarity
  async getSkinsByRarity(rarity, limit = 20) {
    await this.initialize();
    return cs2DataService.getSkinsByRarity(rarity).slice(0, limit);
  }

  // Get skins by weapon
  async getSkinsByWeapon(weapon, limit = 20) {
    await this.initialize();
    return cs2DataService.getSkinsByWeapon(weapon).slice(0, limit);
  }

  // Get leaderboard for case openings
  async getLeaderboard(guildId, limit = 10) {
    const leaderboard = await CS2CaseOpening.aggregate([
      { $match: { guildId } },
      {
        $group: {
          _id: '$userId',
          totalOpenings: { $sum: 1 },
          totalSpent: { $sum: '$cost' },
          totalValue: { $sum: '$result.marketValue' },
          totalProfit: { $sum: '$profit' },
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
      },
      {
        $addFields: {
          profitMargin: {
            $cond: [
              { $gt: ['$totalSpent', 0] },
              { $multiply: [{ $divide: ['$totalProfit', '$totalSpent'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { totalProfit: -1 } },
      { $limit: limit }
    ]);

    return leaderboard;
  }

  // Get case opening statistics for a specific case
  async getCaseStats(caseId, guildId) {
    const stats = await CS2CaseOpening.aggregate([
      { $match: { caseId, guildId } },
      {
        $group: {
          _id: null,
          totalOpenings: { $sum: 1 },
          totalSpent: { $sum: '$cost' },
          totalValue: { $sum: '$result.marketValue' },
          totalProfit: { $sum: '$profit' },
          rarityBreakdown: {
            $push: '$result.rarity'
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
        rarityBreakdown: {}
      };
    }

    const stat = stats[0];
    const rarityBreakdown = {};
    
    stat.rarityBreakdown.forEach(rarity => {
      rarityBreakdown[rarity] = (rarityBreakdown[rarity] || 0) + 1;
    });

    return {
      ...stat,
      rarityBreakdown
    };
  }

  // Sell a skin from inventory
  async sellSkin(userId, guildId, skinId) {
    const inventory = await this.getUserInventory(userId, guildId);
    const skin = inventory.removeSkin(skinId);
    
    if (!skin) {
      throw new Error('Skin not found in inventory');
    }

    // Add money to wallet
    // First find the user by discordId, then find their wallet
    const user = await User.findOne({ discordId: userId, guildId });
    if (user) {
      const wallet = await Wallet.findOne({ user: user._id, guildId });
      if (wallet) {
        wallet.balance += skin.marketValue;
        await wallet.save();
        
        return {
          skinId: skin.skinId,
          skinName: skin.formattedName,
          salePrice: skin.marketValue,
          newBalance: wallet.balance,
          profit: skin.marketValue // For selling, profit is the sale price
        };
      }
    }

    await inventory.save();
    
    return {
      skinId: skin.skinId,
      skinName: skin.formattedName,
      salePrice: skin.marketValue,
      newBalance: 0,
      profit: skin.marketValue
    };
  }

  // Trade a skin with another user
  async tradeSkin(fromUserId, toUserId, guildId, skinId, type = 'direct') {
    // Get both users' inventories
    const fromInventory = await this.getUserInventory(fromUserId, guildId);
    const toInventory = await this.getUserInventory(toUserId, guildId);
    
    // Remove skin from sender's inventory
    const skin = fromInventory.removeSkin(skinId);
    
    if (!skin) {
      throw new Error('Skin not found in sender inventory');
    }

    // Add skin to receiver's inventory
    toInventory.addSkin({
      skinId: skin.skinId,
      skinName: skin.skinName,
      weapon: skin.weapon,
      rarity: skin.rarity,
      wear: skin.wear,
      isStatTrak: skin.isStatTrak,
      isSouvenir: skin.isSouvenir,
      obtainedFrom: {
        type: 'trade',
        fromUserId: fromUserId,
        tradeType: type
      },
      marketValue: skin.marketValue
    });

    // Save both inventories
    await fromInventory.save();
    await toInventory.save();
    
    return {
      skinId: skin.skinId,
      skinName: skin.formattedName,
      fromUserId: fromUserId,
      toUserId: toUserId,
      tradeType: type
    };
  }

  // Get user's best drops
  async getUserBestDrops(userId, guildId, limit = 5) {
    return await CS2CaseOpening.find({ userId, guildId })
      .sort({ 'result.marketValue': -1 })
      .limit(limit);
  }

  // Get user's rarest drops
  async getUserRarestDrops(userId, guildId, limit = 5) {
    const rarityValues = {
      'consumer grade': 1,
      'industrial grade': 2,
      'mil-spec': 3,
      'restricted': 4,
      'classified': 5,
      'covert': 6,
      'special': 7
    };

    const openings = await CS2CaseOpening.find({ userId, guildId });
    
    return openings
      .sort((a, b) => {
        const rarityA = rarityValues[a.result.rarity] || 0;
        const rarityB = rarityValues[b.result.rarity] || 0;
        return rarityB - rarityA;
      })
      .slice(0, limit);
  }
}

module.exports = new CS2Service();
