const express = require('express');
const router = express.Router();
const cs2Service = require('../services/cs2Service');
const { auth } = require('../middleware/auth');

// Get all available cases
router.get('/cases', async (req, res) => {
  try {
    const cases = await cs2Service.getAllCases();
    res.json({ success: true, cases });
  } catch (error) {
    console.error('Error getting cases:', error);
    res.status(500).json({ success: false, error: 'Failed to get cases' });
  }
});

// Get specific case by ID
router.get('/cases/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const caseData = await cs2Service.getCase(caseId);
    
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    
    res.json({ success: true, case: caseData });
  } catch (error) {
    console.error('Error getting case:', error);
    res.status(500).json({ success: false, error: 'Failed to get case' });
  }
});

// Open a case
router.post('/cases/:caseId/open', async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.body.userId || req.headers['x-user-id'];
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const result = await cs2Service.openCase(userId, guildId, caseId);
    
    // Debug logging to see what skin data is being sent
    console.log('🎯 Backend sending skin data:', {
      weapon: result.skin.weapon,
      name: result.skin.formattedName,
      rarity: result.skin.rarity,
      imageUrl: result.skin.imageUrl,
      marketValue: result.skin.marketValue
    });
    
    res.json({
      success: true,
      message: 'Case opened successfully!',
      result: {
        case: {
          id: result.caseOpening.caseId,
          name: result.caseOpening.caseName,
          cost: result.caseOpening.cost
        },
        skin: {
          name: result.skin.formattedName,
          weapon: result.skin.weapon,
          rarity: result.skin.rarity,
          wear: result.skin.wear,
          isStatTrak: result.skin.isStatTrak,
          isSouvenir: result.skin.isSouvenir,
          marketValue: result.skin.marketValue,
          imageUrl: result.skin.imageUrl
        },
        profit: result.caseOpening.profit,
        isProfitable: result.caseOpening.isProfitable
      }
    });
  } catch (error) {
    console.error('Error opening case:', error);
    
    if (error.message.includes('Insufficient funds')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    
    if (error.message.includes('Case not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Failed to open case' });
  }
});

// Get user's CS2 inventory
router.get('/inventory/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    // For now, allow access to any user's inventory (can be restricted later if needed)
    // Check if user is requesting their own inventory or has permission
    // if (req.user.discordId !== userId && req.user.role !== 'admin') {
    //   return res.status(403).json({ success: false, error: 'Access denied' });
    // }

    const inventory = await cs2Service.getUserInventory(userId, guildId);
    
    res.json({
      success: true,
      inventory: {
        userId: inventory.userId,
        totalSkins: inventory.statistics.totalSkins,
        casesOpened: inventory.statistics.casesOpened,
        totalSpent: inventory.statistics.totalSpent,
        rarestSkin: inventory.statistics.rarestSkin,
        mostExpensiveSkin: inventory.statistics.mostExpensiveSkin,
        rarityBreakdown: inventory.statistics.rarityBreakdown,
        skins: inventory.skins
      }
    });
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({ success: false, error: 'Failed to get inventory' });
  }
});

// Get user's CS2 statistics
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const stats = await cs2Service.getUserStats(userId, guildId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// Get user's recent case openings
router.get('/openings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const openings = await cs2Service.getUserRecentOpenings(userId, guildId, parseInt(limit));
    
    res.json({
      success: true,
      openings: openings.map(opening => ({
        id: opening._id,
        caseName: opening.caseName,
        openedAt: opening.openedAt,
        cost: opening.cost,
        result: {
          name: opening.result.weapon + ' | ' + opening.result.skinName,
          rarity: opening.result.rarity,
          wear: opening.result.wear,
          isStatTrak: opening.result.isStatTrak,
          isSouvenir: opening.result.isSouvenir,
          marketValue: opening.result.marketValue
        },
        profit: opening.profit,
        isProfitable: opening.isProfitable
      }))
    });
  } catch (error) {
    console.error('Error getting openings:', error);
    res.status(500).json({ success: false, error: 'Failed to get openings' });
  }
});

// Search skins
router.get('/skins/search', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const skins = await cs2Service.searchSkins(query, parseInt(limit));
    
    res.json({
      success: true,
      skins: skins.map(skin => ({
        id: skin.skinId,
        name: skin.formattedName,
        weapon: skin.weapon,
        rarity: skin.rarity,
        wear: skin.wear,
        isStatTrak: skin.isStatTrak,
        isSouvenir: skin.isSouvenir,
        marketValue: skin.marketValue
      }))
    });
  } catch (error) {
    console.error('Error searching skins:', error);
    res.status(500).json({ success: false, error: 'Failed to search skins' });
  }
});

// Get skins by rarity
router.get('/skins/rarity/:rarity', async (req, res) => {
  try {
    const { rarity } = req.params;
    const { limit = 20 } = req.query;

    const skins = await cs2Service.getSkinsByRarity(rarity, parseInt(limit));
    
    res.json({
      success: true,
      skins: skins.map(skin => ({
        id: skin.skinId,
        name: skin.formattedName,
        weapon: skin.weapon,
        rarity: skin.rarity,
        wear: skin.wear,
        isStatTrak: skin.isStatTrak,
        isSouvenir: skin.isSouvenir,
        marketValue: skin.marketValue
      }))
    });
  } catch (error) {
    console.error('Error getting skins by rarity:', error);
    res.status(500).json({ success: false, error: 'Failed to get skins by rarity' });
  }
});

// Get skins by weapon
router.get('/skins/weapon/:weapon', async (req, res) => {
  try {
    const { weapon } = req.params;
    const { limit = 20 } = req.query;

    const skins = await cs2Service.getSkinsByWeapon(weapon, parseInt(limit));
    
    res.json({
      success: true,
      skins: skins.map(skin => ({
        id: skin.skinId,
        name: skin.formattedName,
        weapon: skin.weapon,
        rarity: skin.rarity,
        wear: skin.wear,
        isStatTrak: skin.isStatTrak,
        isSouvenir: skin.isSouvenir,
        marketValue: skin.marketValue
      }))
    });
  } catch (error) {
    console.error('Error getting skins by weapon:', error);
    res.status(500).json({ success: false, error: 'Failed to get skins by weapon' });
  }
});

// Get CS2 leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const leaderboard = await cs2Service.getLeaderboard(guildId, parseInt(limit));
    
    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
});

// Get case statistics
router.get('/cases/:caseId/stats', async (req, res) => {
  try {
    const { caseId } = req.params;
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const stats = await cs2Service.getCaseStats(caseId, guildId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting case stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get case stats' });
  }
});

// Sell a skin
router.post('/inventory/sell/:skinId', async (req, res) => {
  try {
    const { skinId } = req.params;
    const userId = req.body.userId || req.headers['x-user-id'];
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const result = await cs2Service.sellSkin(userId, guildId, skinId);
    
    res.json({
      success: true,
      message: 'Skin sold successfully!',
      result: {
        skin: {
          name: result.skin.formattedName,
          rarity: result.skin.rarity,
          wear: result.skin.wear
        },
        soldFor: result.soldFor
      }
    });
  } catch (error) {
    console.error('Error selling skin:', error);
    
    if (error.message.includes('Skin not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Failed to sell skin' });
  }
});

// Get user's best drops
router.get('/drops/:userId/best', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const drops = await cs2Service.getUserBestDrops(userId, guildId, parseInt(limit));
    
    res.json({
      success: true,
      drops: drops.map(drop => ({
        id: drop._id,
        caseName: drop.caseName,
        openedAt: drop.openedAt,
        result: {
          name: drop.result.weapon + ' | ' + drop.result.skinName,
          rarity: drop.result.rarity,
          wear: drop.result.wear,
          isStatTrak: drop.result.isStatTrak,
          isSouvenir: drop.result.isSouvenir,
          marketValue: drop.result.marketValue
        },
        profit: drop.profit
      }))
    });
  } catch (error) {
    console.error('Error getting best drops:', error);
    res.status(500).json({ success: false, error: 'Failed to get best drops' });
  }
});

// Get user's rarest drops
router.get('/drops/:userId/rarest', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const drops = await cs2Service.getUserRarestDrops(userId, guildId, parseInt(limit));
    
    res.json({
      success: true,
      drops: drops.map(drop => ({
        id: drop._id,
        caseName: drop.caseName,
        openedAt: drop.openedAt,
        result: {
          name: drop.result.weapon + ' | ' + drop.result.skinName,
          rarity: drop.result.rarity,
          wear: drop.result.wear,
          isStatTrak: drop.result.isStatTrak,
          isSouvenir: drop.result.isSouvenir,
          marketValue: drop.result.marketValue
        },
        profit: drop.profit
      }))
    });
  } catch (error) {
    console.error('Error getting rarest drops:', error);
    res.status(500).json({ success: false, error: 'Failed to get rarest drops' });
  }
});

// Sell a skin
router.post('/skins/:skinId/sell', async (req, res) => {
  try {
    const { skinId } = req.params;
    const userId = req.body.userId || req.headers['x-user-id'];
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    const result = await cs2Service.sellSkin(userId, guildId, skinId);
    
    res.json({
      success: true,
      message: 'Skin sold successfully!',
      result: {
        skinId: result.skinId,
        skinName: result.skinName,
        salePrice: result.salePrice,
        newBalance: result.newBalance,
        profit: result.profit
      }
    });
  } catch (error) {
    console.error('Error selling skin:', error);
    
    if (error.message.includes('Skin not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Failed to sell skin' });
  }
});

// Trade a skin with another user
router.post('/trade', async (req, res) => {
  try {
    const { fromUserId, toUserId, skinId, type = 'direct' } = req.body;
    const guildId = req.headers['x-guild-id'];

    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID is required' });
    }

    if (!fromUserId || !toUserId || !skinId) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    const result = await cs2Service.tradeSkin(fromUserId, toUserId, guildId, skinId, type);
    
    res.json({
      success: true,
      message: 'Trade completed successfully!',
      result: {
        skinId: result.skinId,
        skinName: result.skinName,
        fromUserId: result.fromUserId,
        toUserId: result.toUserId,
        tradeType: result.tradeType
      }
    });
  } catch (error) {
    console.error('Error trading skin:', error);
    
    if (error.message.includes('Skin not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    
    if (error.message.includes('User not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Failed to complete trade' });
  }
});

// Admin endpoint to refresh CS2 data (requires admin role)
router.post('/admin/refresh', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { forceSync = false } = req.body;
    
    if (forceSync) {
      console.log('[Admin] Force refreshing CS2 data with database sync...');
      await cs2Service.forceRefresh();
      res.json({ success: true, message: 'CS2 data force refreshed with database sync' });
    } else {
      console.log('[Admin] Refreshing CS2 data without database sync...');
      await cs2Service.refreshDataOnly();
      res.json({ success: true, message: 'CS2 data refreshed without database sync' });
    }
  } catch (error) {
    console.error('Error refreshing CS2 data:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh CS2 data' });
  }
});

// Admin endpoint to check CS2 data status
router.get('/admin/status', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const caseCount = await require('../models/CS2Case').countDocuments();
    const skinCount = await require('../models/CS2Skin').countDocuments();
    const serviceStatus = cs2Service.getStatus();
    
    res.json({
      success: true,
      status: {
        service: serviceStatus,
        database: {
          casesCount: caseCount,
          skinsCount: skinCount
        }
      }
    });
  } catch (error) {
    console.error('Error getting CS2 data status:', error);
    res.status(500).json({ success: false, error: 'Failed to get CS2 data status' });
  }
});

// Admin endpoint to get skins with empty image URLs
router.get('/admin/skins-with-empty-images', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const cs2DataService = require('../services/cs2DataService');
    const skinsWithEmptyImages = cs2DataService.getSkinsWithEmptyImages();
    
    res.json({
      success: true,
      skinsWithEmptyImages: skinsWithEmptyImages.map(skin => ({
        skinId: skin.skinId,
        formattedName: skin.formattedName,
        weapon: skin.weapon,
        skinName: skin.skinName,
        rarity: skin.rarity,
        imageUrl: skin.imageUrl
      })),
      count: skinsWithEmptyImages.length
    });
  } catch (error) {
    console.error('Error getting skins with empty images:', error);
    res.status(500).json({ success: false, error: 'Failed to get skins with empty images' });
  }
});

module.exports = router;
