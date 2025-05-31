const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const PlacedBet = require('../models/PlacedBet');
const Transaction = require('../models/Transaction');
const { broadcastToUser } = require('../utils/websocketService'); // Import WebSocket service
const UserPreferences = require('../models/UserPreferences');
const Duel = require('../models/Duel');
const { requireGuildId } = require('../middleware/auth');

// Middleware to find or create user and wallet
router.use('/:discordId', requireGuildId, async (req, res, next) => {
  try {
    let user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });

    if (!user) {
      user = new User({ 
        discordId: req.params.discordId,
        guildId: req.guildId,
        username: req.body.username || `User${req.params.discordId}`
      });
      await user.save();
      const wallet = new Wallet({ user: user._id, guildId: req.guildId });
      wallet.balance = 100000;
      await wallet.save();
      const transaction = new Transaction({
        user: user._id,
        guildId: req.guildId,
        type: 'initial_balance',
        amount: 100000,
        description: 'Initial balance'
      });
      await transaction.save();
    }

    req.user = user;
    if (!req.wallet) {
       req.wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
       if (!req.wallet) {
           const wallet = new Wallet({ user: user._id, guildId: req.guildId });
           wallet.balance = 100000;
           await wallet.save();
           req.wallet = wallet;
       }
    }
    next();
  } catch (error) {
    console.error('Error in user middleware during creation/finding:', error);
    if (!res.headersSent) {
        res.status(500).json({ message: 'Server error during user/wallet initialization.' });
    } else {
        next(error);
    }
  }
});

// Get user's wallet balance
router.get('/:discordId/wallet', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }
    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error('Error fetching wallet balance:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get leaderboard (top users by balance)
router.get('/:discordId/leaderboard', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      balance: 'balance',
      alpha: 'user.username'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'balance';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const wallets = await Wallet.find({ guildId: req.guildId })
      .populate('user', 'discordId username');
    let sortedWallets;
    if (sortBy === 'user.username') {
      sortedWallets = wallets.sort((a, b) => {
        const cmp = (a.user?.username || '').localeCompare(b.user?.username || '');
        return sortOrder === 1 ? cmp : -cmp;
      });
    } else {
      sortedWallets = wallets.sort((a, b) => {
        let cmp = b.balance - a.balance;
        return sortOrder === 1 ? -cmp : cmp;
      });
    }
    const totalCount = sortedWallets.length;
    const pagedWallets = sortedWallets.slice(skip, skip + limit);
    const leaderboard = pagedWallets.map(wallet => ({
      discordId: wallet.user.discordId,
      username: wallet.user.username,
      balance: wallet.balance
    }));
    res.json({ data: leaderboard, totalCount });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's betting and gambling statistics
router.get('/:discordId/stats', async (req, res) => {
  try {
    const user = req.user;
    // Betting stats
    const placedBets = await PlacedBet.find({ bettor: user._id, guildId: req.guildId })
      .populate({ path: 'bet', select: 'status winningOption' });
    const betting = {
      totalBets: placedBets.length,
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      winRate: 0,
      biggestWin: 0,
      biggestLoss: 0
    };
    let wonBets = 0;
    let lostBets = 0;
    placedBets.forEach(placedBet => {
      betting.totalWagered += placedBet.amount;
      if (placedBet.bet.status === 'resolved') {
        if (placedBet.option === placedBet.bet.winningOption) {
          betting.totalWon += placedBet.amount;
          wonBets++;
          if (placedBet.amount > betting.biggestWin) betting.biggestWin = placedBet.amount;
        } else {
          betting.totalLost += placedBet.amount;
          lostBets++;
          if (placedBet.amount > betting.biggestLoss) betting.biggestLoss = placedBet.amount;
        }
      }
    });
    betting.winRate = (wonBets + lostBets) > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) : '0.0';
    // Gambling stats
    const gamblingTransactions = await Transaction.find({
      user: user._id,
      type: { $in: ['bet', 'win'] },
      $or: [
        { description: /coinflip|dice|slots|blackjack|roulette/i },
        { description: { $exists: false } }
      ],
      guildId: req.guildId
    });
    let totalGamesPlayed = 0;
    let totalGambled = 0;
    let totalGamblingWon = 0;
    let biggestGamblingWin = 0;
    let biggestGamblingLoss = 0;
    const gameCounts = {};
    let gamblingWins = 0;
    let gamblingLosses = 0;
    gamblingTransactions.forEach(tx => {
      // Try to infer game type from description
      let gameType = 'unknown';
      if (tx.description) {
        const match = tx.description.match(/(coinflip|dice|slots|blackjack|roulette)/i);
        if (match) gameType = match[1].toLowerCase();
      }
      if (tx.type === 'bet' && tx.amount < 0) {
        totalGamesPlayed++;
        totalGambled += Math.abs(tx.amount);
        if (Math.abs(tx.amount) > biggestGamblingLoss) biggestGamblingLoss = Math.abs(tx.amount);
        gameCounts[gameType] = (gameCounts[gameType] || 0) + 1;
        gamblingLosses++;
      }
      if (tx.type === 'win' && tx.amount > 0) {
        totalGamblingWon += tx.amount;
        if (tx.amount > biggestGamblingWin) biggestGamblingWin = tx.amount;
        gamblingWins++;
      }
    });
    const favoriteGame = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const gambling = {
      totalGamesPlayed,
      totalGambled,
      totalWon: totalGamblingWon,
      totalLost: totalGambled - totalGamblingWon,
      winRate: (gamblingWins + gamblingLosses) > 0 ? ((gamblingWins / (gamblingWins + gamblingLosses)) * 100).toFixed(1) : '0.0',
      biggestWin: biggestGamblingWin,
      biggestLoss: biggestGamblingLoss,
      favoriteGame
    };
    // Other stats
    // Jackpot wins
    const jackpotWins = await Transaction.countDocuments({ user: user._id, type: 'jackpot', guildId: req.guildId });
    // Daily bonuses claimed
    const dailyBonusesClaimed = await Transaction.countDocuments({ user: user._id, type: 'daily', guildId: req.guildId });
    // Gifts sent/received
    const giftsSent = await Transaction.countDocuments({ user: user._id, type: 'gift_sent', guildId: req.guildId });
    const giftsReceived = await Transaction.countDocuments({ user: user._id, type: 'gift_received', guildId: req.guildId });
    // Win streaks
    const currentWinStreak = user.currentWinStreak || 0;
    const maxWinStreak = user.maxWinStreak || 0;
    const meowBarks = await Transaction.countDocuments({ user: user._id, type: 'meowbark', guildId: req.guildId });
    const refunds = await Transaction.countDocuments({ user: user._id, type: 'refund', guildId: req.guildId });
    res.json({
      betting,
      gambling,
      currentWinStreak,
      maxWinStreak,
      jackpotWins,
      dailyBonusesClaimed,
      giftsSent,
      giftsReceived,
      meowBarks
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// (Optional) Endpoint to initialize wallet if not created by middleware
router.post('/:discordId/wallet/initialize', async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id, guildId: req.guildId });
    if (wallet) {
      return res.status(409).json({ message: 'Wallet already exists.' });
    }
    wallet = new Wallet({ user: req.user._id, guildId: req.guildId });
    await wallet.save();
    res.status(201).json({ message: 'Wallet initialized.', wallet });
  } catch (error) {
    console.error('Error initializing wallet:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user profile
router.get('/:userId/profile', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    // Betting stats
    const placedBets = await PlacedBet.find({ bettor: user._id, guildId: req.guildId }).populate('bet');
    const betting = {
      totalBets: placedBets.length,
      totalWagered: 0,
      totalWon: 0,
      recentBets: []
    };
    placedBets.forEach(bet => {
      betting.totalWagered += bet.amount;
      if (bet.bet.status === 'resolved' && bet.option === bet.bet.winningOption) {
        betting.totalWon += bet.amount;
      }
    });
    // Add last 5 recent bets
    betting.recentBets = placedBets
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map(bet => ({
        description: bet.bet.description,
        amount: bet.amount,
        option: bet.option,
        status: bet.bet.status,
        result: bet.bet.status === 'resolved' ? 
          (bet.bet.winningOption === bet.option ? 'Won' : 'Lost') : 
          'Pending'
      }));
    // Gambling stats
    const gamblingTransactions = await Transaction.find({
      user: user._id,
      type: { $in: ['bet', 'win'] },
      $or: [
        { description: /coinflip|dice|slots|blackjack|roulette/i },
        { description: { $exists: false } }
      ],
      guildId: req.guildId
    });
    let totalGambled = 0;
    let totalGamblingWon = 0;
    gamblingTransactions.forEach(tx => {
      if (tx.type === 'bet' && tx.amount < 0) totalGambled += Math.abs(tx.amount);
      if (tx.type === 'win' && tx.amount > 0) totalGamblingWon += tx.amount;
    });
    const gambling = {
      totalGambled,
      totalWon: totalGamblingWon
    };
    // Round off balance
    const roundedBalance = wallet ? Math.round(wallet.balance) : 0;
    const now = new Date();
    const isJailed = user.jailedUntil && user.jailedUntil > now;
    res.json({
      user: {
        discordId: user.discordId,
        username: user.username,
        createdAt: user.createdAt,
        isJailed,
        jailedUntil: user.jailedUntil
      },
      wallet: {
        balance: roundedBalance
      },
      betting,
      gambling
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Claim daily bonus
router.post('/:userId/daily', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Check if user has already claimed today's bonus
    const lastClaim = wallet.lastDailyClaim;
    const now = new Date();
    if (lastClaim && 
        lastClaim.getDate() === now.getDate() && 
        lastClaim.getMonth() === now.getMonth() && 
        lastClaim.getFullYear() === now.getFullYear()) {
      return res.status(400).json({ 
        message: 'You have already claimed your daily bonus today.',
        nextClaimTime: lastClaim.getTime() + 24 * 60 * 60 * 1000
      });
    }

    // Calculate streak bonus
    const streak = wallet.dailyStreak || 0;
    const baseAmount = 10000; // Base daily bonus (10% of starting balance)
    const streakMultiplier = Math.min(1 + (streak * 0.1), 2); // Max 2x multiplier
    const bonusAmount = Math.floor(baseAmount * streakMultiplier);

    // Update wallet
    wallet.balance += bonusAmount;
    wallet.lastDailyClaim = new Date(); // Store the exact claim time
    wallet.dailyStreak = (wallet.dailyStreak || 0) + 1;
    await wallet.save();

    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'daily',
      amount: bonusAmount,
      description: `Daily bonus (${wallet.dailyStreak} day streak)`,
      guildId: req.guildId
    });
    await transaction.save();

    // Send WebSocket updates
    broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });

    res.json({
      message: 'Daily bonus claimed successfully!',
      amount: bonusAmount,
      streak: wallet.dailyStreak,
      nextClaimTime: now.getTime() + 24 * 60 * 60 * 1000
    });
  } catch (error) {
    console.error('Error claiming daily bonus:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Gift points to another user
router.post('/:userId/gift', async (req, res) => {
  try {
    const { recipientDiscordId, amount } = req.body;
    const senderDiscordId = req.params.userId;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid gift amount.' });
    }

    // Find sender and recipient
    const sender = await User.findOne({ discordId: senderDiscordId, guildId: req.guildId });
    const recipient = await User.findOne({ discordId: recipientDiscordId, guildId: req.guildId });

    if (!sender || !recipient) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get wallets
    const senderWallet = await Wallet.findOne({ user: sender._id, guildId: req.guildId });
    const recipientWallet = await Wallet.findOne({ user: recipient._id, guildId: req.guildId });

    if (!senderWallet || !recipientWallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Check if sender has enough balance
    if (senderWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // Update wallets
    senderWallet.balance -= amount;
    recipientWallet.balance += amount;
    await senderWallet.save();
    await recipientWallet.save();

    // Record transactions
    const senderTransaction = new Transaction({
      user: sender._id,
      type: 'gift_sent',
      amount: -amount,
      description: `Gift to ${recipientDiscordId}`,
      guildId: req.guildId
    });
    await senderTransaction.save();

    const recipientTransaction = new Transaction({
      user: recipient._id,
      type: 'gift_received',
      amount: amount,
      description: `Gift from ${senderDiscordId}`,
      guildId: req.guildId
    });
    await recipientTransaction.save();

    // Send WebSocket updates to both users
    broadcastToUser(sender.discordId, { type: 'TRANSACTION', transaction: senderTransaction });
    broadcastToUser(sender.discordId, { type: 'BALANCE_UPDATE', balance: senderWallet.balance });
    
    broadcastToUser(recipient.discordId, { type: 'TRANSACTION', transaction: recipientTransaction });
    broadcastToUser(recipient.discordId, { type: 'BALANCE_UPDATE', balance: recipientWallet.balance });

    res.json({
      message: 'Gift sent successfully!',
      amount,
      newBalance: senderWallet.balance
    });
  } catch (error) {
    console.error('Error gifting points:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's transaction history
router.get('/:discordId/transactions', async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Default to 20 items per page
    const type = req.query.type;

    // Ensure page and limit are positive
    if (page < 1 || limit < 1) {
      return res.status(400).json({ message: 'Page and limit must be positive integers.' });
    }

    // Build query
    const query = { user: user._id, guildId: req.guildId };
    if (type && type !== 'all') {
      query.type = type;
    }

    // Calculate skip value
    const skip = (page - 1) * limit;

    // Get paginated transactions and total count
    const [transactions, totalCount] = await Promise.all([
      Transaction.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(query) // Get total count for pagination
    ]);

    res.json({ transactions, totalCount });
  } catch (error) {
    console.error('Error fetching transactions:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get daily bonus status
router.get('/:userId/daily-status', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    const lastClaim = wallet.lastDailyClaim;
    const now = new Date();
    let nextClaimTime = null;

    if (lastClaim) {
      // Calculate the time 24 hours after the last claim
      nextClaimTime = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000).getTime();
    }

    res.json({
      nextClaimTime,
      currentStreak: wallet.dailyStreak || 0
    });
  } catch (error) {
    console.error('Error getting daily bonus status:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's preferences
router.get('/:discordId/preferences', async (req, res) => {
  try {
    // Find user preferences or create default if none exist
    let preferences = await UserPreferences.findOne({ user: req.user._id, guildId: req.guildId });
    
    if (!preferences) {
      preferences = new UserPreferences({ user: req.user._id, guildId: req.guildId });
      await preferences.save();
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ message: 'Server error fetching preferences.' });
  }
});

// Update user's preferences
router.put('/:discordId/preferences', async (req, res) => {
  try {
    const updates = req.body;
    // Find preferences and update
    const preferences = await UserPreferences.findOneAndUpdate(
      { user: req.user._id, guildId: req.guildId },
      { $set: updates },
      { new: true, upsert: true } // Create if not exists, return updated document
    );
    
    res.json({ message: 'Preferences updated successfully!', preferences });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ message: 'Server error updating preferences.' });
  }
});

// Leaderboard: Top Win Streaks
router.get('/leaderboard/winstreaks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      max: 'maxWinStreak',
      current: 'currentWinStreak',
      alpha: 'username'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'maxWinStreak';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const UserModel = require('../models/User');
    const [users, totalCount] = await Promise.all([
      UserModel.find({ guildId: req.guildId })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select('username discordId maxWinStreak currentWinStreak'),
      UserModel.countDocuments({ guildId: req.guildId })
    ]);
    res.json({ data: users, totalCount });
  } catch (error) {
    console.error('Error fetching win streak leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Leaderboard: Biggest Wins
router.get('/leaderboard/biggest-wins', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      amount: 'amount',
      alpha: 'user.username',
      date: 'timestamp'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'amount';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const Transaction = require('../models/Transaction');
    const User = require('../models/User');
    let wins = await Transaction.find({ type: 'win', guildId: req.guildId })
      .populate('user', 'username discordId')
      .lean();
    // In-memory sort for username (alpha)
    if (sortBy === 'user.username') {
      wins.sort((a, b) => {
        const cmp = (a.user?.username || '').localeCompare(b.user?.username || '');
        return sortOrder === 1 ? cmp : -cmp;
      });
    } else {
      wins.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'amount') cmp = b.amount - a.amount;
        else if (sortBy === 'timestamp') cmp = new Date(b.timestamp) - new Date(a.timestamp);
        return sortOrder === 1 ? -cmp : cmp;
      });
    }
    const totalCount = wins.length;
    wins = wins.slice(skip, skip + limit);
    const result = wins.map(win => ({
      username: win.user?.username || 'Unknown',
      discordId: win.user?.discordId || '',
      amount: win.amount,
      description: win.description,
      timestamp: win.timestamp
    }));
    res.json({ data: result, totalCount });
  } catch (error) {
    console.error('Error fetching biggest wins leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Add endpoint to get all users (for superadmin)
router.get('/', requireGuildId, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const queryObj = { guildId: req.guildId };
    const [users, totalCount] = await Promise.all([
      User.find(queryObj, '_id username discordId role')
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(queryObj)
    ]);
    res.json({ data: users, totalCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users.' });
  }
});

// Get all placed bets for a user (My Bets)
router.get('/:discordId/bets', async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    // Aggregation pipeline for filtering and sorting
    const matchStage = { $match: { bettor: user._id, guildId: req.guildId } };
    const lookupStage = {
      $lookup: {
        from: 'bets',
        localField: 'bet',
        foreignField: '_id',
        as: 'bet'
      }
    };
    const unwindStage = { $unwind: '$bet' };
    const pipeline = [matchStage, lookupStage, unwindStage];
    // Status filter
    if (req.query.status && req.query.status !== 'all') {
      pipeline.push({ $match: { 'bet.status': req.query.status } });
    }
    // Result filter
    if (req.query.result && req.query.result !== 'all') {
      if (req.query.result === 'won') {
        pipeline.push({ $match: { $expr: { $and: [ { $eq: ['$bet.status', 'resolved'] }, { $eq: ['$option', '$bet.winningOption'] } ] } } });
      } else if (req.query.result === 'lost') {
        pipeline.push({ $match: { $expr: { $and: [ { $eq: ['$bet.status', 'resolved'] }, { $ne: ['$option', '$bet.winningOption'] } ] } } });
      } else if (req.query.result === 'pending') {
        pipeline.push({ $match: { 'bet.status': { $ne: 'resolved' } } });
      }
    }
    // Sorting
    pipeline.push({ $sort: { [sortBy]: sortOrder } });
    // For totalCount, run the same pipeline up to this point
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    // Run aggregation
    const [placedBets, countResult] = await Promise.all([
      PlacedBet.aggregate(pipeline),
      PlacedBet.aggregate(countPipeline)
    ]);
    const totalCount = countResult[0]?.total || 0;
    res.json({
      data: placedBets,
      totalCount,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching user placed bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Update username for a user
router.post('/:discordId/update-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.length < 2) {
      return res.status(400).json({ message: 'Invalid username.' });
    }
    const user = await User.findOneAndUpdate(
      { discordId: req.params.discordId, guildId: req.guildId },
      { username },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ message: 'Username updated.', user });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// MeowBark reward endpoint
router.post('/:discordId/meowbark', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 1 || amount > 100000) {
      return res.status(400).json({ message: 'Amount must be between 1 and 100,000.' });
    }
    wallet.balance += amount;
    await wallet.save();
    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'meowbark',
      amount,
      description: 'Meow/Bark reward',
      guildId: req.guildId
    });
    await transaction.save();
    res.json({ message: `Added ${amount} points.`, newBalance: wallet.balance });
  } catch (error) {
    console.error('Error in meowbark endpoint:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Search users by username (for gifting, autocomplete, etc.)
router.get('/search-users', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }
    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      guildId: req.guildId
    })
      .select('discordId username role')
      .limit(20);
    res.json({ data: users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error searching users.' });
  }
});

// --- CRIME COMMAND ---
router.post('/:discordId/crime', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);

    // Check if user is jailed
    if (user.jailedUntil && user.jailedUntil > now) {
      return res.status(403).json({
        message: `You are jailed until ${user.jailedUntil.toLocaleString()}`,
        jailedUntil: user.jailedUntil
      });
    }

    // Check cooldown
    if (user.crimeCooldown && user.crimeCooldown > now) {
      return res.status(429).json({
        message: `Crime is on cooldown. Try again at ${user.crimeCooldown.toLocaleString()}`,
        cooldown: user.crimeCooldown
      });
    }

    // Crime scenarios
    const crimes = [
      'robbed a bank',
      'hacked a casino',
      'pickpocketed a cop',
      'mugged a street vendor',
      'stole a luxury car',
      'pulled off a jewelry heist',
      'shoplifted from a convenience store',
      'ran a pyramid scheme',
      'counterfeited lottery tickets',
      'hijacked an armored truck'
    ];
    const crime = crimes[Math.floor(Math.random() * crimes.length)];

    // Buff checks
    let usedBuff = null;
    const crimeSuccessIdx = (user.buffs || []).findIndex(b => b.type === 'crime_success');
    const jailImmunityIdx = (user.buffs || []).findIndex(b => b.type === 'jail_immunity' && (!b.expiresAt || b.expiresAt > now));
    const earningsBuff = (user.buffs || []).find(b => b.type === 'earnings_x2' && (!b.expiresAt || b.expiresAt > now));

    // Determine outcome
    const outcomeRoll = Math.random();
    let outcome, amount = 0, jailMinutes = 0, message = '';
    if (crimeSuccessIdx >= 0) {
      // Buff: guaranteed success
      outcome = 'success';
      amount = Math.floor(Math.random() * 150000) + 50000; // 50-200k
      usedBuff = user.buffs[crimeSuccessIdx];
      user.buffs[crimeSuccessIdx].usesLeft = (user.buffs[crimeSuccessIdx].usesLeft || 1) - 1;
      if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
      message = `Your buff guaranteed a successful crime! You pulled off the ${crime} and got away with ${amount.toLocaleString()} points! 🤑`;
      user.crimeStats.success++;
    } else {
      if (outcomeRoll < 0.5) {
        // Success
        outcome = 'success';
        amount = Math.floor(Math.random() * 125000) + 25000; // 25k-150k
        message = `You pulled off the ${crime} and got away with ${amount.toLocaleString()} points! 🤑`;
        user.crimeStats.success++;
      } else if (outcomeRoll < 0.85) {
        // Failure
        outcome = 'fail';
        amount = Math.floor(Math.random() * 70000) + 10000; // 10k-80k
        message = `You tried to ${crime}, but failed. Lost ${amount.toLocaleString()} points.`;
        user.crimeStats.fail++;
      } else {
        // Jail
        outcome = 'jail';
        jailMinutes = Math.floor(Math.random() * 16) + 15; // 15-30 min
        message = `You got caught ${crime}! 🚔 You're in jail for ${jailMinutes} minutes.`;
        user.crimeStats.jail++;
      }
    }

    // Buff: jail immunity
    if (jailImmunityIdx >= 0 && outcome === 'jail') {
      outcome = 'fail';
      jailMinutes = 0;
      message = 'Your jail immunity buff saved you from jail! You only failed the crime.';
      user.buffs[jailImmunityIdx].usesLeft = (user.buffs[jailImmunityIdx].usesLeft || 1) - 1;
      if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    }

    // Buff: earnings_x2
    if (earningsBuff && outcome === 'success') {
      amount *= 2;
      message = message.replace(/(\d[\d,]*) points/, `${amount.toLocaleString()} points`);
    }

    // Apply results
    if (outcome === 'success') {
      wallet.balance += amount;
    } else if (outcome === 'fail') {
      wallet.balance = Math.max(0, wallet.balance - amount);
    } else if (outcome === 'jail') {
      user.jailedUntil = new Date(now.getTime() + jailMinutes * 60000);
    }

    // Set cooldown (30-60 min)
    const cooldownMinutes = Math.floor(Math.random() * 31) + 30;
    user.crimeCooldown = new Date(now.getTime() + cooldownMinutes * 60000);

    await wallet.save();
    await user.save();

    res.json({
      outcome,
      amount,
      jailMinutes,
      message,
      cooldown: user.crimeCooldown,
      jailedUntil: user.jailedUntil
    });
  } catch (error) {
    console.error('Error in /crime:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- WORK COMMAND ---
router.post('/:discordId/work', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();

    // Check cooldown
    if (user.workCooldown && user.workCooldown > now) {
      return res.status(429).json({
        message: `Work is on cooldown. Try again at ${user.workCooldown.toLocaleString()}`,
        cooldown: user.workCooldown
      });
    }

    // Jobs
    const jobs = [
      'streamer',
      'pizza delivery',
      'mercenary',
      'taxi driver',
      'street musician',
      'dog walker',
      'barista',
      'construction worker',
      'social media influencer',
      'private investigator'
    ];
    let job = req.body.job;
    if (!job || !jobs.includes(job)) {
      job = jobs[Math.floor(Math.random() * jobs.length)];
    }

    // Determine reward
    let baseMin = 25000, baseMax = 150000; // Updated to match crime success
    let bonusChance = 0.15;
    let bonus = 0, bonusMsg = '';
    switch (job) {
      case 'streamer': bonusMsg = 'A mysterious whale donated'; break;
      case 'pizza delivery': bonusMsg = 'A celebrity tipped you'; break;
      case 'mercenary': bonusMsg = 'You found a hidden stash!'; break;
      case 'taxi driver': bonusMsg = 'Your passenger left a golden watch!'; break;
      case 'street musician': bonusMsg = 'A record producer noticed you!'; break;
      case 'dog walker': bonusMsg = 'A dog owner gave you a huge tip!'; break;
      case 'barista': bonusMsg = 'A customer paid you in gold coins!'; break;
      case 'construction worker': bonusMsg = 'You found a rare artifact!'; break;
      case 'social media influencer': bonusMsg = 'A brand sponsored your post!'; break;
      case 'private investigator': bonusMsg = 'You solved a cold case!'; break;
    }
    let amount = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
    let rare = false;
    if (Math.random() < bonusChance) {
      bonus = Math.floor(Math.random() * 150000) + 50000; // 50k-200k, matches crime guaranteed success
      amount += bonus;
      rare = true;
    }

    // Buff: work_double
    const workDoubleIdx = (user.buffs || []).findIndex(b => b.type === 'work_double' && (b.usesLeft === undefined || b.usesLeft > 0));
    let usedWorkDouble = false;
    if (workDoubleIdx >= 0) {
      amount *= 2;
      usedWorkDouble = true;
      user.buffs[workDoubleIdx].usesLeft = (user.buffs[workDoubleIdx].usesLeft || 1) - 1;
      if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
      await user.save();
    }

    // Update wallet and stats ONCE, after all buff logic
    wallet.balance += amount;
    if (!user.workStats) user.workStats = {};
    if (!user.workStats[job]) user.workStats[job] = { times: 0, earned: 0, bonus: 0 };
    user.workStats[job].times++;
    user.workStats[job].earned += (amount - bonus);
    if (bonus > 0) {
      user.workStats[job].bonus += bonus;
    }
    user.markModified('workStats');

    // Set cooldown (1-2 hours)
    const cooldownMinutes = Math.floor(Math.random() * 61) + 60;
    user.workCooldown = new Date(now.getTime() + cooldownMinutes * 60000);

    await wallet.save();
    await user.save();

    let message;
    if (rare) {
      message = `You worked as a ${job} and earned ${amount.toLocaleString()} points. ${bonusMsg} +${bonus.toLocaleString()} points!`;
    } else {
      message = `You worked as a ${job} and earned ${amount.toLocaleString()} points.`;
    }
    if (usedWorkDouble) {
      message += ' (work_double buff used: DOUBLE POINTS!)';
    }

    res.json({
      job,
      amount,
      bonus: rare ? bonus : 0,
      message,
      cooldown: user.workCooldown
    });
  } catch (error) {
    console.error('Error in /work:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- CRIME STATS ---
router.get('/:discordId/crime-stats', async (req, res) => {
  try {
    const user = req.user;
    res.json({ crimeStats: user.crimeStats });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching crime stats.' });
  }
});

// --- WORK STATS ---
router.get('/:discordId/work-stats', async (req, res) => {
  try {
    const user = req.user;
    // Handle both Map and plain object for workStats
    let workStats = [];
    if (user.workStats) {
      if (typeof user.workStats.entries === 'function') {
        // Mongoose Map
        workStats = Array.from(user.workStats.entries()).map(([job, stats]) => ({ job, ...stats }));
      } else if (typeof user.workStats === 'object') {
        // Plain object (from JSON or lean query)
        workStats = Object.entries(user.workStats).map(([job, stats]) => ({ job, ...(stats || {}) }));
      }
    }
    res.json({ workStats });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching work stats.' });
  }
});

// --- BAIL SYSTEM ---
router.post('/:discordId/bail', async (req, res) => {
  // Debug: log entry and params
  console.log('[BAIL] Called with payer discordId:', req.params.discordId, 'body:', req.body);
  if (!req.user) {
    console.error('[BAIL] req.user is missing!');
    return res.status(401).json({ message: 'User not authenticated (req.user missing).' });
  }
  try {
    const payer = req.user;
    const { targetDiscordId } = req.body;
    console.log('[BAIL] payer:', payer.discordId, 'target:', targetDiscordId);
    if (!targetDiscordId) return res.status(400).json({ message: 'No target user specified.' });
    if (targetDiscordId === payer.discordId) return res.status(400).json({ message: 'You cannot bail yourself out.' });
    const targetUser = await User.findOne({ discordId: targetDiscordId, guildId: req.guildId });
    console.log('[BAIL] targetUser:', targetUser && targetUser.discordId, 'jailedUntil:', targetUser && targetUser.jailedUntil);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found.' });
    if (!targetUser.jailedUntil || targetUser.jailedUntil < new Date()) {
      return res.status(400).json({ message: 'Target user is not currently jailed.' });
    }
    // Calculate bail cost (e.g., 10,000 + 1,000 per minute left)
    const now = new Date();
    const minutesLeft = Math.ceil((targetUser.jailedUntil - now) / 60000);
    const bailCost = 10000 + minutesLeft * 1000;
    const payerWallet = await Wallet.findOne({ user: payer._id, guildId: req.guildId });
    console.log('[BAIL] payerWallet balance:', payerWallet && payerWallet.balance, 'bailCost:', bailCost);
    if (!payerWallet || payerWallet.balance < bailCost) {
      return res.status(400).json({ message: `You need ${bailCost.toLocaleString()} points to bail this user out.` });
    }
    // Deduct from payer, free target
    payerWallet.balance -= bailCost;
    await payerWallet.save();
    // Record transaction for payer
    const transaction = new Transaction({
      user: payer._id,
      type: 'bail',
      amount: -bailCost,
      description: `Bailed out <@${targetDiscordId}>`,
      guildId: req.guildId
    });
    await transaction.save();
    broadcastToUser(payer.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(payer.discordId, { type: 'BALANCE_UPDATE', balance: payerWallet.balance });
    targetUser.jailedUntil = null;
    await targetUser.save();
    console.log('[BAIL] Bail successful.');
    res.json({
      message: `You bailed out <@${targetDiscordId}> for ${bailCost.toLocaleString()} points!`,
      bailCost,
      minutesLeft
    });
  } catch (error) {
    console.error('[BAIL] Exception:', error);
    res.status(500).json({ message: 'Server error processing bail.' });
  }
});

// --- FISHING ---
router.post('/:discordId/fish', async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    if (!user.fishCooldown) user.fishCooldown = null;
    if (user.fishCooldown && user.fishCooldown > now) {
      return res.status(429).json({ message: `Fishing is on cooldown. Try again at ${user.fishCooldown.toLocaleString()}`, cooldown: user.fishCooldown });
    }
    // Fish table
    const fishTable = [
      { name: 'Carp', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Perch', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Bluegill', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Bass', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Catfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Pike', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Salmon', rarity: 'rare', value: () => Math.floor(Math.random() * 4000) + 4000 },
      { name: 'Sturgeon', rarity: 'rare', value: () => Math.floor(Math.random() * 4000) + 4000 },
      { name: 'Eel', rarity: 'rare', value: () => Math.floor(Math.random() * 4000) + 4000 },
      { name: 'Golden Koi', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Ancient Leviathan', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 }
    ];
    // Rarity weights
    const rarityRoll = Math.random();
    let rarity = 'common';
    if (rarityRoll > 0.98) rarity = 'legendary';
    else if (rarityRoll > 0.90) rarity = 'rare';
    else if (rarityRoll > 0.70) rarity = 'uncommon';
    // Pick a fish of that rarity
    const options = fishTable.filter(f => f.rarity === rarity);
    const fish = options[Math.floor(Math.random() * options.length)];
    let value = fish.value();
    // Buff: earnings_x2
    const earningsBuff = (user.buffs || []).find(b => b.type === 'earnings_x2' && (!b.expiresAt || b.expiresAt > now));
    if (earningsBuff) value *= 2;
    // Update inventory
    const inv = user.inventory || [];
    const idx = inv.findIndex(i => i.type === 'fish' && i.name === fish.name);
    if (idx >= 0) {
      const existingItem = inv[idx];
      const existingTotalValue = existingItem.value * existingItem.count;
      const newTotalValue = existingTotalValue + value;
      existingItem.count += 1;
      existingItem.value = newTotalValue / existingItem.count; // Calculate new average
      user.markModified('inventory'); // Mark inventory as modified due to nested change
    } else {
      // Item is new
      inv.push({ type: 'fish', name: fish.name, rarity: fish.rarity, value: value, count: 1 });
    }
    user.inventory = inv;
    // Set cooldown (5-15 min)
    const cooldownMinutes = Math.floor(Math.random() * 11) + 5;
    user.fishCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await user.save();
    res.json({
      name: fish.name,
      rarity: fish.rarity,
      value,
      count: idx >= 0 ? inv[idx].count : 1,
      cooldown: user.fishCooldown
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during fishing.' });
  }
});

// --- HUNTING ---
router.post('/:discordId/hunt', async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    if (!user.huntCooldown) user.huntCooldown = null;
    if (user.huntCooldown && user.huntCooldown > now) {
      return res.status(429).json({ message: `Hunting is on cooldown. Try again at ${user.huntCooldown.toLocaleString()}`, cooldown: user.huntCooldown });
    }
    // Animal table
    const animalTable = [
      { name: 'Rabbit', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Squirrel', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Pigeon', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Fox', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Raccoon', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Owl', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Deer', rarity: 'rare', value: () => Math.floor(Math.random() * 4000) + 4000 },
      { name: 'Boar', rarity: 'rare', value: () => Math.floor(Math.random() * 4000) + 4000 },
      { name: 'Hawk', rarity: 'rare', value: () => Math.floor(Math.random() * 4000) + 4000 },
      { name: 'White Stag', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Mythic Phoenix', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 }
    ];
    // Rarity weights
    const rarityRoll = Math.random();
    let rarity = 'common';
    if (rarityRoll > 0.98) rarity = 'legendary';
    else if (rarityRoll > 0.90) rarity = 'rare';
    else if (rarityRoll > 0.70) rarity = 'uncommon';
    // Pick an animal of that rarity
    const options = animalTable.filter(a => a.rarity === rarity);
    const animal = options[Math.floor(Math.random() * options.length)];
    let value = animal.value();
    // Buff: earnings_x2
    const earningsBuff = (user.buffs || []).find(b => b.type === 'earnings_x2' && (!b.expiresAt || b.expiresAt > now));
    if (earningsBuff) value *= 2;
    // Update inventory
    const inv = user.inventory || [];
    const idx = inv.findIndex(i => i.type === 'animal' && i.name === animal.name);
    if (idx >= 0) {
      const existingItem = inv[idx];
      const existingTotalValue = existingItem.value * existingItem.count;
      const newTotalValue = existingTotalValue + value;
      existingItem.count += 1;
      existingItem.value = newTotalValue / existingItem.count; // Calculate new average
      user.markModified('inventory'); // Mark inventory as modified due to nested change
    } else {
      // Item is new
      inv.push({ type: 'animal', name: animal.name, rarity: animal.rarity, value, count: 1 });
    }
    user.inventory = inv;
    // Set cooldown (5-15 min)
    const cooldownMinutes = Math.floor(Math.random() * 11) + 5;
    user.huntCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await user.save();
    res.json({
      name: animal.name,
      rarity: animal.rarity,
      value,
      count: idx >= 0 ? inv[idx].count : 1,
      cooldown: user.huntCooldown
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during hunting.' });
  }
});

// --- COLLECTION ---
router.get('/:discordId/collection', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    await user.save();
    res.json({ inventory: user.inventory || [], buffs: user.buffs || [] });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching collection.' });
  }
});

// --- SELL INVENTORY ITEM ---
router.post('/:discordId/sell', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const { items, type, name, count } = req.body;
    // Bulk sell if items array is provided
    if (Array.isArray(items) && items.length > 0) {
      let totalValue = 0;
      const results = [];
      for (const itemReq of items) {
        const { type: typeSell, name: nameSell, count: countSell } = itemReq;
        if (!typeSell || !nameSell || !countSell || countSell < 1) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: 'Invalid sell request.', success: false });
          continue;
        }
        // Find item in inventory
        const idxSell = (user.inventory || []).findIndex(i => i.type === typeSell && i.name === nameSell);
        if (idxSell === -1) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: 'Item not found in inventory.', success: false });
          continue;
        }
        const itemSell = user.inventory[idxSell];
        if (itemSell.count < countSell) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: `You only have ${itemSell.count} of this item.`, success: false });
          continue;
        }
        // Calculate total value
        const valueSell = itemSell.value * countSell;
        // Remove/sell items
        itemSell.count -= countSell;
        if (itemSell.count === 0) {
          user.inventory.splice(idxSell, 1);
        } else {
          user.inventory[idxSell] = itemSell;
        }
        wallet.balance += valueSell;
        totalValue += valueSell;
        results.push({ type: typeSell, name: nameSell, count: countSell, value: valueSell, success: true });
        // Record transaction for each item
        const transactionSell = new Transaction({
          user: user._id,
          type: 'sell',
          amount: valueSell,
          description: `Sold ${countSell}x ${itemSell.name} (${itemSell.rarity})`,
          guildId: req.guildId
        });
        await transactionSell.save();
        broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction: transactionSell });
      }
      await user.save();
      await wallet.save();
      broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });
      return res.json({ results, newBalance: wallet.balance });
    }
    // Fallback: single item logic
    if (!type || !name || !count || count < 1) {
      return res.status(400).json({ message: 'Invalid sell request.' });
    }
    // Find item in inventory
    const idx = (user.inventory || []).findIndex(i => i.type === type && i.name === name);
    if (idx === -1) {
      return res.status(404).json({ message: 'Item not found in inventory.' });
    }
    const item = user.inventory[idx];
    if (item.count < count) {
      return res.status(400).json({ message: `You only have ${item.count} of this item.` });
    }
    // Calculate total value
    const totalValue = item.value * count;
    // Remove/sell items
    item.count -= count;
    if (item.count === 0) {
      user.inventory.splice(idx, 1);
    } else {
      user.inventory[idx] = item;
    }
    wallet.balance += totalValue;
    await user.save();
    await wallet.save();
    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'sell',
      amount: totalValue,
      description: `Sold ${count}x ${item.name} (${item.rarity})`,
      guildId: req.guildId
    });
    await transaction.save();
    broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });
    res.json({ message: `Sold ${count}x ${item.name} for ${totalValue.toLocaleString()} points.`, newBalance: wallet.balance });
  } catch (error) {
    console.error('Error selling inventory item:', error);
    res.status(500).json({ message: 'Server error during sell.' });
  }
});

// --- COLLECTION LEADERBOARD ---
router.get('/collection-leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const users = await User.find({ guildId: req.guildId });
    // Calculate total collection value for each user
    const leaderboard = users.map(u => {
      const totalValue = (u.inventory || []).reduce((sum, i) => sum + (i.value * i.count), 0);
      return {
        discordId: u.discordId,
        username: u.username,
        totalValue,
        itemCount: (u.inventory || []).reduce((sum, i) => sum + i.count, 0)
      };
    }).sort((a, b) => b.totalValue - a.totalValue).slice(0, limit);
    res.json({ data: leaderboard });
  } catch (error) {
    console.error('Error fetching collection leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- TRADE INVENTORY ITEM ---
router.post('/:discordId/trade', async (req, res) => {
  try {
    const sender = req.user;
    const { targetDiscordId, items, type, name, count } = req.body;
    if (!targetDiscordId) {
      return res.status(400).json({ message: 'Invalid trade request: missing target.' });
    }
    if (targetDiscordId === sender.discordId) {
      return res.status(400).json({ message: 'Cannot trade with yourself.' });
    }
    const receiver = await User.findOne({ discordId: targetDiscordId, guildId: req.guildId });
    if (!receiver) return res.status(404).json({ message: 'Target user not found.' });
    // Bulk trade if items array is provided
    if (Array.isArray(items) && items.length > 0) {
      const results = [];
      for (const itemReq of items) {
        const { type: typeTrade, name: nameTrade, count: countTrade } = itemReq;
        if (!typeTrade || !nameTrade || !countTrade || countTrade < 1) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: 'Invalid trade request.', success: false });
          continue;
        }
        // Find item in sender inventory
        const idxTrade = (sender.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (idxTrade === -1) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: 'Item not found in your inventory.', success: false });
          continue;
        }
        const itemTrade = sender.inventory[idxTrade];
        if (itemTrade.count < countTrade) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: `You only have ${itemTrade.count} of this item.`, success: false });
          continue;
        }
        // Store original item properties before mutating
        const itemToTransferTrade = {
          type: itemTrade.type,
          name: itemTrade.name,
          rarity: itemTrade.rarity,
          value: itemTrade.value,
          count: countTrade
        };
        // Remove from sender
        itemTrade.count -= countTrade;
        if (itemTrade.count === 0) {
          sender.inventory.splice(idxTrade, 1);
        } else {
          sender.inventory[idxTrade] = itemTrade;
        }
        // Add to receiver
        const rIdxTrade = (receiver.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (rIdxTrade === -1) {
          receiver.inventory.push(itemToTransferTrade);
        } else {
          // Recalculate average value for receiver
          const receiverItem = receiver.inventory[rIdxTrade];
          const totalValue = (receiverItem.value * receiverItem.count) + (itemToTransferTrade.value * countTrade);
          receiverItem.count += countTrade;
          receiverItem.value = totalValue / receiverItem.count;
          receiver.inventory[rIdxTrade] = receiverItem;
        }
        results.push({ type: typeTrade, name: nameTrade, count: countTrade, success: true });
        // Record transaction for sender
        const transactionTrade = new Transaction({
          user: sender._id,
          type: 'trade_sent',
          amount: 0,
          description: `Traded ${countTrade}x ${itemTrade.name} to ${targetDiscordId}`,
          guildId: req.guildId
        });
        await transactionTrade.save();
        // Record transaction for receiver
        const transaction2Trade = new Transaction({
          user: receiver._id,
          type: 'trade_received',
          amount: 0,
          description: `Received ${countTrade}x ${itemTrade.name} from ${sender.discordId}`,
          guildId: req.guildId
        });
        await transaction2Trade.save();
        broadcastToUser(sender.discordId, { type: 'TRANSACTION', transaction: transactionTrade });
        broadcastToUser(receiver.discordId, { type: 'TRANSACTION', transaction: transaction2Trade });
      }
      await sender.save();
      await receiver.save();
      return res.json({ results });
    }
    // Fallback: single item logic
    if (!type || !name || !count || count < 1) {
      return res.status(400).json({ message: 'Invalid trade request.' });
    }
    if (targetDiscordId === sender.discordId) {
      return res.status(400).json({ message: 'Cannot trade with yourself.' });
    }
    // Find item in sender inventory
    const idx = (sender.inventory || []).findIndex(i => i.type === type && i.name === name);
    if (idx === -1) {
      return res.status(404).json({ message: 'Item not found in your inventory.' });
    }
    const item = sender.inventory[idx];
    if (item.count < count) {
      return res.status(400).json({ message: `You only have ${item.count} of this item.` });
    }
    // Store original item properties before mutating
    const itemToTransfer = {
      type: item.type,
      name: item.name,
      rarity: item.rarity,
      value: item.value,
      count: count
    };
    // Remove from sender
    item.count -= count;
    if (item.count === 0) {
      sender.inventory.splice(idx, 1);
    } else {
      sender.inventory[idx] = item;
    }
    // Add to receiver
    const rIdx = (receiver.inventory || []).findIndex(i => i.type === type && i.name === name);
    if (rIdx === -1) {
      receiver.inventory.push(itemToTransfer);
    } else {
      // Recalculate average value for receiver
      const receiverItem = receiver.inventory[rIdx];
      const totalValue = (receiverItem.value * receiverItem.count) + (itemToTransfer.value * count);
      receiverItem.count += count;
      receiverItem.value = totalValue / receiverItem.count;
      receiver.inventory[rIdx] = receiverItem;
    }
    await sender.save();
    await receiver.save();
    // Record transaction for sender
    const transaction = new Transaction({
      user: sender._id,
      type: 'trade_sent',
      amount: 0,
      description: `Traded ${count}x ${item.name} to ${targetDiscordId}`,
      guildId: req.guildId
    });
    await transaction.save();
    // Record transaction for receiver
    const transaction2 = new Transaction({
      user: receiver._id,
      type: 'trade_received',
      amount: 0,
      description: `Received ${count}x ${item.name} from ${sender.discordId}`,
      guildId: req.guildId
    });
    await transaction2.save();
    broadcastToUser(sender.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(receiver.discordId, { type: 'TRANSACTION', transaction: transaction2 });
    res.json({ message: `Traded ${count}x ${item.name} to <@${targetDiscordId}>.` });
  } catch (error) {
    console.error('Error trading inventory item:', error);
    res.status(500).json({ message: 'Server error during trade.' });
  }
});

// --- DUEL: Initiate a duel ---
router.post('/:discordId/duel', async (req, res) => {
  try {
    const challenger = req.user;
    const { opponentDiscordId, amount } = req.body;
    if (!opponentDiscordId || !amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid duel request.' });
    }
    if (opponentDiscordId === challenger.discordId) {
      return res.status(400).json({ message: 'Cannot duel yourself.' });
    }
    // Cooldown: 5-10 min per user
    const now = new Date();
    if (challenger.duelCooldown && challenger.duelCooldown > now) {
      return res.status(429).json({ message: `You are on duel cooldown. Try again at ${challenger.duelCooldown.toLocaleString()}` });
    }
    const opponent = await User.findOne({ discordId: opponentDiscordId, guildId: req.guildId });
    if (!opponent) return res.status(404).json({ message: 'Opponent not found.' });
    if (opponent.duelCooldown && opponent.duelCooldown > now) {
      return res.status(429).json({ message: 'Opponent is on duel cooldown.' });
    }
    // Check for existing pending duel between these users
    const existing = await Duel.findOne({
      challengerDiscordId: challenger.discordId,
      opponentDiscordId,
      status: 'pending',
      guildId: req.guildId
    });
    if (existing) {
      return res.status(400).json({ message: 'There is already a pending duel with this user.' });
    }
    // Check balances
    const challengerWallet = await Wallet.findOne({ user: challenger._id, guildId: req.guildId });
    const opponentWallet = await Wallet.findOne({ user: opponent._id, guildId: req.guildId });
    if (!challengerWallet || challengerWallet.balance < amount) {
      return res.status(400).json({ message: 'You do not have enough points to duel.' });
    }
    if (!opponentWallet || opponentWallet.balance < amount) {
      return res.status(400).json({ message: 'Opponent does not have enough points to duel.' });
    }
    // Lock stake (deduct, will refund if declined/timeout)
    challengerWallet.balance -= amount;
    opponentWallet.balance -= amount;
    await challengerWallet.save();
    await opponentWallet.save();
    // Create duel
    const duel = new Duel({
      challenger: challenger._id,
      opponent: opponent._id,
      challengerDiscordId: challenger.discordId,
      opponentDiscordId,
      amount,
      status: 'pending',
      guildId: req.guildId,
      expiresAt: new Date(Date.now() + 60 * 1000) // 1 minute from now
    });
    await duel.save();
    // Set cooldown (5-10 min random)
    const cooldownMinutes = Math.floor(Math.random() * 6) + 5;
    challenger.duelCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    opponent.duelCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await challenger.save();
    await opponent.save();
    res.json({ message: 'Duel initiated.', duelId: duel._id, cooldownMinutes });
  } catch (error) {
    console.error('Error initiating duel:', error);
    res.status(500).json({ message: 'Server error during duel.' });
  }
});

// --- DUEL: Respond to a duel (accept/decline) ---
router.post('/:discordId/duel/respond', async (req, res) => {
  try {
    const user = req.user;
    const { duelId, accept } = req.body;
    const duel = await Duel.findById(duelId).populate('challenger opponent');
    if (!duel || duel.status !== 'pending') {
      return res.status(400).json({ message: 'Duel not found or already resolved.' });
    }
    if (user.discordId !== duel.opponentDiscordId) {
      return res.status(403).json({ message: 'Only the challenged user can respond.' });
    }
    if (accept) {
      // Resolve duel
      duel.status = 'resolved';
      duel.resolvedAt = new Date();
      // Pick winner randomly
      const winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
      duel.winner = winner._id;
      duel.winnerDiscordId = winner.discordId;
      // Fun action text
      const actions = [
        `outmaneuvered their opponent in a dramatic showdown!`,
        `landed a critical hit and claimed victory!`,
        `dodged at the last second and won the duel!`,
        `used a surprise move to win the fight!`,
        `triumphed in an epic battle!`
      ];
      duel.actionText = actions[Math.floor(Math.random() * actions.length)];
      await duel.save();
      // Award winnings
      const total = duel.amount * 2;
      const winnerWallet = await Wallet.findOne({ user: winner._id, guildId: req.guildId });
      winnerWallet.balance += total;
      await winnerWallet.save();
      // Update stats
      winner.duelWins = (winner.duelWins || 0) + 1;
      const loser = winner._id.equals(duel.challenger._id) ? duel.opponent : duel.challenger;
      loser.duelLosses = (loser.duelLosses || 0) + 1;
      await winner.save();
      await loser.save();
      // Record transaction
      await Transaction.create({
        user: winner._id,
        type: 'win',
        amount: total,
        description: `Duel win vs ${loser.username}`,
        guildId: req.guildId
      });
      await Transaction.create({
        user: loser._id,
        type: 'lose',
        amount: 0,
        description: `Duel loss vs ${winner.username}`,
        guildId: req.guildId
      });
      res.json({
        message: `Duel resolved. Winner: ${winner.username}`,
        winner: winner.discordId,
        loser: loser.discordId,
        actionText: duel.actionText
      });
    } else {
      // Declined or timeout: refund both
      duel.status = 'declined';
      duel.resolvedAt = new Date();
      await duel.save();
      const challengerWallet = await Wallet.findOne({ user: duel.challenger._id, guildId: req.guildId });
      const opponentWallet = await Wallet.findOne({ user: duel.opponent._id, guildId: req.guildId });
      challengerWallet.balance += duel.amount;
      opponentWallet.balance += duel.amount;
      await challengerWallet.save();
      await opponentWallet.save();
      res.json({ message: 'Duel declined or timed out. Stakes refunded.' });
    }
  } catch (error) {
    console.error('Error responding to duel:', error);
    res.status(500).json({ message: 'Server error during duel response.' });
  }
});

// --- DUEL: Get duel stats ---
router.get('/:discordId/duel-stats', async (req, res) => {
  try {
    const user = req.user;
    const wins = user.duelWins || 0;
    const losses = user.duelLosses || 0;
    res.json({ wins, losses });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching duel stats.' });
  }
});

// --- BEG COMMAND ---
router.post('/:discordId/beg', async (req, res) => {
  try {
    const userId = req.params.discordId;
    const wallet = req.wallet;
    const now = new Date();
    // Always fetch user fresh from DB for cooldown check
    const user = await User.findOne({ discordId: userId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.begCooldown && user.begCooldown > now) {
      return res.status(429).json({ message: `You must wait before begging again. Try at ${user.begCooldown.toLocaleString()}` });
    }
    // Cooldown: 1-5 min
    const cooldownMinutes = Math.floor(Math.random() * 5) + 1;
    const newCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    user.begCooldown = newCooldown;
    // Determine outcome
    const roll = Math.random();
    let outcome, amount = 0, message;
    if (roll < 0.65) {
      // Small coin gain
      amount = Math.floor(Math.random() * 5000) + 1000;
      wallet.balance += amount;
      outcome = 'success';
      const texts = [
        `A kind stranger gave you ${amount.toLocaleString()} points.`,
        `You found ${amount.toLocaleString()} points on the ground!`,
        `Someone took pity and tossed you ${amount.toLocaleString()} points.`,
        `A passing dog dropped a pouch with ${amount.toLocaleString()} points!`
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else if (roll < 0.85) {
      // Ignored
      outcome = 'ignored';
      const texts = [
        'People walk by, ignoring your pleas.',
        'You beg, but nobody seems to notice.',
        'A pigeon is your only company. No coins today.',
        'You get a sympathetic look, but no points.'
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else if (roll < 0.97) {
      // Negative event
      outcome = 'negative';
      amount = Math.floor(Math.random() * 2000) + 500;
      wallet.balance = Math.max(0, wallet.balance - amount);
      const texts = [
        `A thief snatched ${amount.toLocaleString()} points from you!`,
        `You tripped and lost ${amount.toLocaleString()} points.`,
        `A seagull stole your last ${amount.toLocaleString()} points!`,
        `You dropped your wallet and lost ${amount.toLocaleString()} points.`
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else {
      // Rare big reward
      amount = Math.floor(Math.random() * 50000) + 50000;
      wallet.balance += amount;
      outcome = 'jackpot';
      const texts = [
        `A mysterious benefactor handed you a briefcase with ${amount.toLocaleString()} points!`,
        `You won the street lottery: ${amount.toLocaleString()} points!`,
        `A golden retriever delivered you a bag with ${amount.toLocaleString()} points!` 
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    }
    await wallet.save();
    await user.save();
    res.json({ outcome, amount, message, cooldown: newCooldown });
  } catch (error) {
    console.error('Error in /beg:', error);
    res.status(500).json({ message: 'Server error during beg.' });
  }
});

// --- MYSTERYBOX COMMAND ---
router.post('/:discordId/mysterybox', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();
    if (!user.mysteryboxCooldown) user.mysteryboxCooldown = null;
    // Free once per day, or paid (cost: 2500 points)
    const paid = req.body.paid === true;
    const cost = 2500;
    if (!paid) {
      // Free: check cooldown (once per day)
      if (user.mysteryboxCooldown && user.mysteryboxCooldown > now) {
        return res.status(429).json({ message: `You already opened your free mystery box today. Try again at ${user.mysteryboxCooldown.toLocaleString()}` });
      }
      user.mysteryboxCooldown = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else {
      // Paid: check balance
      if (wallet.balance < cost) {
        return res.status(400).json({ message: `You need ${cost.toLocaleString()} points to open a paid mystery box.` });
      }
      wallet.balance -= cost;
    }
    // Remove expired buffs
    cleanUserBuffs(user);
    // Determine reward
    const roll = Math.random();
    let rewardType, amount = 0, item = null, message, buff = null;
    if (roll < 0.5) {
      // Coins
      amount = Math.floor(Math.random() * 4000) + 1000;
      wallet.balance += amount;
      rewardType = 'coins';
      message = `You found ${amount.toLocaleString()} points inside the box!`;
    } else if (roll < 0.8) {
      // Cosmetic/funny item
      const items = [
        { name: 'Rubber Duck', rarity: 'common' },
        { name: 'Golden Mustache', rarity: 'rare' },
        { name: 'Party Hat', rarity: 'uncommon' },
        { name: 'Mysterious Key', rarity: 'rare' },
        { name: 'Tiny Top Hat', rarity: 'common' },
        { name: 'Epic Sunglasses', rarity: 'legendary' }
      ];
      item = items[Math.floor(Math.random() * items.length)];
      user.inventory = user.inventory || [];
      const idx = user.inventory.findIndex(i => i.type === 'item' && i.name === item.name);
      if (idx >= 0) {
        user.inventory[idx].count += 1;
      } else {
        user.inventory.push({ type: 'item', name: item.name, rarity: item.rarity, value: 0, count: 1 });
      }
      rewardType = 'item';
      message = `You found a **${item.name}** (${item.rarity}) in the box!`;
    } else if (roll < 0.97) {
      // Buff
      rewardType = 'buff';
      const buffs = [
        {
          type: 'earnings_x2',
          description: '2x earnings for 10 minutes!',
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000)
        },
        {
          type: 'work_double',
          description: 'Next /work gives double points!',
          usesLeft: 1
        },
        {
          type: 'crime_success',
          description: 'Next /crime is guaranteed success!',
          usesLeft: 1
        },
        {
          type: 'jail_immunity',
          description: 'Immunity from jail for 1 hour!',
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000)
        }
      ];
      buff = buffs[Math.floor(Math.random() * buffs.length)];
      user.buffs = user.buffs || [];
      user.buffs.push(buff);
      message = `You received a buff: **${buff.description}**`;
    } else {
      // Jackpot
      amount = Math.floor(Math.random() * 20000) + 10000;
      wallet.balance += amount;
      rewardType = 'jackpot';
      message = `JACKPOT! You found ${amount.toLocaleString()} points and a golden ticket!`;
    }
    await wallet.save();
    await user.save();
    res.json({ rewardType, amount, item, message, cooldown: user.mysteryboxCooldown });
  } catch (error) {
    console.error('Error in /mysterybox:', error);
    res.status(500).json({ message: 'Server error during mystery box.' });
  }
});

// --- Remove expired buffs helper ---
function cleanUserBuffs(user) {
  const now = new Date();
  user.buffs = (user.buffs || []).filter(buff => {
    if (buff.expiresAt && buff.expiresAt < now) return false;
    if (buff.usesLeft !== undefined && buff.usesLeft <= 0) return false;
    return true;
  });
}

// --- DUEL: Get pending duels for autocomplete ---
router.get('/:discordId/pending-duels', async (req, res) => {
  try {
    const user = req.user;
    // Find all pending duels where this user is the opponent
    const duels = await Duel.find({
      opponentDiscordId: user.discordId,
      status: 'pending',
      guildId: req.guildId
    }).select('_id challengerDiscordId amount');
    res.json({ duels });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching pending duels.' });
  }
});

// --- SUPERADMIN GIVEAWAY ENDPOINT ---
// Use auth middleware to set req.user, then requireGuildId
router.post('/:discordId/giveaway', require('../middleware/auth').auth, requireGuildId, async (req, res) => {
  try {
    // Only allow superadmin
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can give points.' });
    }
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 1) {
      return res.status(400).json({ message: 'Invalid amount.' });
    }
    const targetUser = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    let wallet = await Wallet.findOne({ user: targetUser._id, guildId: req.guildId });
    if (!wallet) {
      wallet = new Wallet({ user: targetUser._id, guildId: req.guildId, balance: 0 });
    }
    wallet.balance += amount;
    await wallet.save();
    // Record transaction
    const transaction = new Transaction({
      user: targetUser._id,
      type: 'giveaway',
      amount,
      description: `Superadmin giveaway`,
      guildId: req.guildId
    });
    await transaction.save();
    res.json({ message: 'Points given successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during giveaway.' });
  }
});

module.exports = router; 