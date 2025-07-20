const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Card = require('../models/Card');
const CardPack = require('../models/CardPack');
const PackOpening = require('../models/PackOpening');
const Transaction = require('../models/Transaction');
const { requireGuildId } = require('../middleware/auth');
const PackGenerator = require('../utils/packGenerator');
const packGenerator = new PackGenerator();

// GET /users/:discordId/cards - Get user's card collection
router.get('/users/:discordId/cards', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { page = 1, limit = 20, rarity, supertype, search } = req.query;

    // Find user
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Build query
    const query = { discordId, guildId };
    if (rarity) query.rarity = rarity;
    if (supertype) query.supertype = supertype;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalCards = await Card.countDocuments(query);
    const totalPages = Math.ceil(totalCards / limit);

    // Get cards with pagination
    const cards = await Card.find(query)
      .sort({ obtainedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Get collection statistics
    const stats = await Card.getCollectionStats(discordId, guildId);

    res.json({
      cards,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCards,
        totalPages
      },
      stats
    });
  } catch (error) {
    console.error('[TCG Cards] Error:', error);
    res.status(500).json({ message: 'Failed to fetch card collection.' });
  }
});

// GET /users/:discordId/cards/:cardId - Get specific card details
router.get('/users/:discordId/cards/:cardId', requireGuildId, async (req, res) => {
  try {
    const { discordId, cardId } = req.params;
    const guildId = req.headers['x-guild-id'];

    // Find user
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Find the specific card
    const card = await Card.findOne({ 
      discordId, 
      guildId, 
      cardId 
    }).select('-__v');

    if (!card) {
      return res.status(404).json({ message: 'Card not found in collection.' });
    }

    res.json({ card });
  } catch (error) {
    console.error('[TCG Card Details] Error:', error);
    res.status(500).json({ message: 'Failed to fetch card details.' });
  }
});

// GET /users/:discordId/packs - Get available packs
router.get('/users/:discordId/packs', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];

    // Find user
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get user's wallet
    const wallet = await Wallet.findOne({ user: user._id, guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Get available packs
    const availablePacks = await CardPack.getAvailablePacks();

    // Get user's opening statistics for limits
    const openingStats = await PackOpening.getUserStats(discordId, guildId, 24 * 60 * 60 * 1000); // Last 24 hours

    // Add purchase limits and affordability to each pack
    const packsWithInfo = availablePacks.map(pack => {
      const dailyPurchases = openingStats.packBreakdown[pack.name] || 0;
      const canAfford = wallet.balance >= pack.price;
      const withinDailyLimit = pack.dailyLimit === 0 || dailyPurchases < pack.dailyLimit;
      const withinWeeklyLimit = pack.weeklyLimit === 0 || (openingStats.packBreakdown[pack.name] || 0) < pack.weeklyLimit;

      return {
        ...pack.toObject(),
        canAfford,
        withinDailyLimit,
        withinWeeklyLimit,
        dailyPurchases,
        userBalance: wallet.balance
      };
    });

    res.json({ 
      packs: packsWithInfo,
      userBalance: wallet.balance,
      openingStats
    });
  } catch (error) {
    console.error('[TCG Packs] Error:', error);
    res.status(500).json({ message: 'Failed to fetch available packs.' });
  }
});

// POST /users/:discordId/packs/purchase - Buy packs
router.post('/users/:discordId/packs/purchase', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { packId, quantity = 1 } = req.body;

    // Validate quantity
    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({ message: 'Quantity must be between 1 and 10.' });
    }

    // Find user
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get user's wallet
    const wallet = await Wallet.findOne({ user: user._id, guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Find pack
    const pack = await CardPack.findOne({ packId, isActive: true });
    if (!pack) {
      return res.status(404).json({ message: 'Pack not found or unavailable.' });
    }

    // Check if pack is available
    if (!pack.isAvailable) {
      return res.status(400).json({ message: 'This pack is not currently available.' });
    }

    // Calculate total cost
    const totalCost = pack.price * quantity;

    // Check if user has enough points
    if (wallet.balance < totalCost) {
      return res.status(400).json({ 
        message: `Not enough points. You need ${totalCost} points but have ${wallet.balance}.` 
      });
    }

    // Check daily/weekly limits
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dailyPurchases = await PackOpening.countDocuments({
      discordId,
      guildId,
      packId: pack.packId,
      openedAt: { $gte: today }
    });

    const weeklyPurchases = await PackOpening.countDocuments({
      discordId,
      guildId,
      packId: pack.packId,
      openedAt: { $gte: weekAgo }
    });

    if (pack.dailyLimit > 0 && dailyPurchases + quantity > pack.dailyLimit) {
      return res.status(400).json({ 
        message: `Daily limit exceeded. You can only buy ${pack.dailyLimit - dailyPurchases} more ${pack.name} today.` 
      });
    }

    if (pack.weeklyLimit > 0 && weeklyPurchases + quantity > pack.weeklyLimit) {
      return res.status(400).json({ 
        message: `Weekly limit exceeded. You can only buy ${pack.weeklyLimit - weeklyPurchases} more ${pack.name} this week.` 
      });
    }

    // Deduct points from wallet
    wallet.balance -= totalCost;
    await wallet.save();

    // Create transaction record
    const transaction = new Transaction({
      user: user._id,
      guildId,
      type: 'pack_purchase',
      amount: -totalCost,
      description: `Purchased ${quantity}x ${pack.name} for ${totalCost} points`,
      metadata: {
        packId: pack.packId,
        packName: pack.name,
        quantity
      }
    });
    await transaction.save();

    // Create pack opening records (these will be filled when packs are opened)
    const packOpenings = [];
    for (let i = 0; i < quantity; i++) {
      const packOpening = new PackOpening({
        user: user._id,
        discordId,
        guildId,
        packId: pack.packId,
        packName: pack.name,
        packPrice: pack.price,
        openedAt: new Date(),
        cardsObtained: [],
        totalValue: 0,
        rarityBreakdown: {
          common: 0,
          uncommon: 0,
          rare: 0,
          'holo-rare': 0,
          'ultra-rare': 0
        },
        specialCards: [],
        openingMethod: 'command'
      });
      packOpenings.push(packOpening);
    }

    await PackOpening.insertMany(packOpenings);

    res.json({
      message: `Successfully purchased ${quantity}x ${pack.name} for ${totalCost} points!`,
      pack: {
        id: pack.packId,
        name: pack.name,
        price: pack.price,
        cardCount: pack.cardCount
      },
      quantity,
      totalCost,
      newBalance: wallet.balance,
      packOpenings: packOpenings.map(po => po._id)
    });

  } catch (error) {
    console.error('[TCG Pack Purchase] Error:', error);
    res.status(500).json({ message: 'Failed to purchase pack.' });
  }
});

// POST /users/:discordId/packs/open - Open a pack
router.post('/users/:discordId/packs/open', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { packOpeningId } = req.body;

    // Find user
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Find the pack opening
    const packOpening = await PackOpening.findOne({
      _id: packOpeningId,
      discordId,
      guildId
    });

    if (!packOpening) {
      return res.status(404).json({ message: 'Pack opening not found.' });
    }

    // Check if pack is already opened
    if (packOpening.cardsObtained.length > 0) {
      return res.status(400).json({ message: 'This pack has already been opened.' });
    }

    // Find pack configuration
    const pack = await CardPack.findOne({ packId: packOpening.packId });
    if (!pack) {
      return res.status(404).json({ message: 'Pack configuration not found.' });
    }

    const startTime = Date.now();

    // Generate cards for the pack
    const generatedCards = await packGenerator.generatePackCards(pack);
    
    // Debug: Log the first few cards to see their structure
    console.log('[TCG Route] Generated cards sample:', generatedCards.slice(0, 3).map(card => ({
      cardId: card.cardId,
      name: card.name,
      rarity: card.rarity
    })));
    
    // Add cards to user's collection
    const addedCards = await packGenerator.addCardsToCollection(
      generatedCards, 
      user._id, 
      discordId, 
      guildId, 
      pack._id
    );

    // Update pack opening with obtained cards
    packOpening.cardsObtained = generatedCards.map((card, index) => ({
      cardId: card.cardId || `generated_${Date.now()}_${index}`,
      name: card.name || 'Unknown Card',
      rarity: card.rarity || 'Common',
      supertype: card.supertype || 'Pokémon',
      isFoil: card.isFoil || false,
      isReverseHolo: card.isReverseHolo || false,
      estimatedValue: card.estimatedValue || 0,
      cardRef: addedCards[index]?._id
    }));

    // Calculate opening statistics
    packOpening.calculateStats();
    packOpening.processingTime = Date.now() - startTime;
    await packOpening.save();

    // Create transaction for cards obtained
    const totalValue = packOpening.totalValue;
    if (totalValue > 0) {
      const transaction = new Transaction({
        user: user._id,
        guildId,
        type: 'pack_opening',
        amount: totalValue,
        description: `Opened ${pack.name} - Obtained ${packOpening.cardsObtained.length} cards worth ${totalValue} points`,
        metadata: {
          packId: pack.packId,
          packName: pack.name,
          cardsObtained: packOpening.cardsObtained.length,
          totalValue
        }
      });
      await transaction.save();
    }

    // Return full card data including images for the Discord bot
    const fullCardData = generatedCards.map((card, index) => ({
      ...card,
      cardRef: addedCards[index]?._id
    }));

    res.json({
      message: `Successfully opened ${pack.name}!`,
      pack: {
        name: pack.name,
        cardCount: pack.cardCount
      },
      cards: fullCardData, // Use full card data instead of packOpening.cardsObtained
      totalValue: packOpening.totalValue,
      specialCards: packOpening.specialCards,
      rarityBreakdown: packOpening.rarityBreakdown,
      processingTime: packOpening.processingTime
    });

  } catch (error) {
    console.error('[TCG Pack Opening] Error:', error);
    res.status(500).json({ message: 'Failed to open pack.' });
  }
});

// GET /users/:discordId/packs/opening-stats - Get pack opening statistics
router.get('/users/:discordId/packs/opening-stats', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { timeRange } = req.query; // in milliseconds

    // Find user
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get opening statistics
    const stats = await PackOpening.getUserStats(discordId, guildId, timeRange ? parseInt(timeRange) : null);
    
    // Get recent openings
    const recentOpenings = await PackOpening.getRecentOpenings(discordId, guildId, 5);

    res.json({
      stats,
      recentOpenings
    });

  } catch (error) {
    console.error('[TCG Opening Stats] Error:', error);
    res.status(500).json({ message: 'Failed to fetch opening statistics.' });
  }
});

module.exports = router; 