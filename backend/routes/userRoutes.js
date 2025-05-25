const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const PlacedBet = require('../models/PlacedBet');
const Transaction = require('../models/Transaction');
const { broadcastToUser } = require('../utils/websocketService'); // Import WebSocket service
const UserPreferences = require('../models/UserPreferences');

// Middleware to find or create user and wallet
router.use('/:discordId', async (req, res, next) => {
  try {
    let user = await User.findOne({ discordId: req.params.discordId });

    if (!user) {
      // // console.log(`New user detected: ${req.params.discordId}. Attempting to create user, wallet, and initial transaction.`);

      // Create user, including username from request body
      user = new User({ 
        discordId: req.params.discordId,
        username: req.body.username || `User${req.params.discordId}` // Use username from body or a default if not provided
      });
      await user.save();
      // // console.log(`User ${user.discordId} created.`);

      // Create wallet for the new user
      const wallet = new Wallet({ user: user._id });
      wallet.balance = 1000; // Set starting balance
      await wallet.save();
      // // console.log(`Wallet for user ${user.discordId} created with initial balance.`);

      // Record initial balance transaction
      const transaction = new Transaction({
        user: user._id,
        type: 'initial_balance', // Changed type for clarity
        amount: 1000,
        description: 'Initial balance'
      });
      await transaction.save();
      // // console.log(`Initial transaction for user ${user.discordId} recorded.`);
    }

    req.user = user;
    // Attempt to find wallet even if user existed, to ensure req.wallet is populated consistently
    if (!req.wallet) {
       req.wallet = await Wallet.findOne({ user: user._id });
       if (!req.wallet) {
           console.warn(`Wallet not found for existing user ${user.discordId} after middleware. Creating one now.`); // Keep this warn for unexpected cases
           // Create a wallet for the existing user
           const wallet = new Wallet({ user: user._id });
           wallet.balance = 1000; // Set initial balance (can be adjusted if needed for existing users)
           await wallet.save();
           // // console.log(`New wallet created for existing user ${user.discordId}.`); // Removed this log
           req.wallet = wallet; // Attach the newly created wallet
       }
    }
    next();
  } catch (error) {
    console.error('Error in user middleware during creation/finding:', error); // Keep this error log
    // Only send error response if no headers have been sent yet
    if (!res.headersSent) {
        res.status(500).json({ message: 'Server error during user/wallet initialization.' });
    } else {
        // If headers are already sent, just pass the error to the next error handler
        next(error);
    }
  }
});

// Get user's wallet balance
router.get('/:discordId/wallet', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
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
    const [wallets, totalCount] = await Promise.all([
      Wallet.find()
        .sort({ balance: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'discordId username'),
      Wallet.countDocuments()
    ]);
    const leaderboard = wallets.map(wallet => ({
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

// Get user's betting statistics
router.get('/:discordId/stats', async (req, res) => {
  try {
    const user = req.user;
    
    // Get all placed bets for this user
    const placedBets = await PlacedBet.find({ bettor: user._id })
      .populate({
        path: 'bet',
        select: 'status winningOption'
      });
    
    // Calculate statistics
    const stats = {
      totalBets: placedBets.length,
      totalWon: 0,
      totalLost: 0,
      totalWagered: 0,
      totalWon: 0
    };
    
    placedBets.forEach(placedBet => {
      stats.totalWagered += placedBet.amount;
      
      if (placedBet.bet.status === 'resolved') {
        if (placedBet.option === placedBet.bet.winningOption) {
          stats.totalWon += 1;
        } else {
          stats.totalLost += 1;
        }
      }
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// (Optional) Endpoint to initialize wallet if not created by middleware
router.post('/:discordId/wallet/initialize', async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (wallet) {
      return res.status(409).json({ message: 'Wallet already exists.' });
    }
    wallet = new Wallet({ user: req.user._id });
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
    const user = await User.findOne({ discordId: req.params.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id });
    const placedBets = await PlacedBet.find({ bettor: user._id }).populate('bet');

    // Log placed bets before filtering
    // // console.log('--- Placed Bets for Win Rate Calculation ---'); // Removed
    // placedBets.forEach(bet => {
    //     // console.log(`Bet ID: ${bet.bet._id}, Description: ${bet.bet.description}, User Option: ${bet.option}, Bet Status: ${bet.bet.status}, Winning Option: ${bet.bet.winningOption}`); // Removed
    // });
    // // console.log('--------------------------------------------'); // Removed

    // Calculate statistics
    const totalBets = placedBets.length;
    const totalWagered = placedBets.reduce((sum, bet) => sum + bet.amount, 0);

    // Filter for resolved bets
    const resolvedBets = placedBets.filter(bet => bet.bet.status === 'resolved');
    const totalResolvedBets = resolvedBets.length;

    // Count won bets among resolved bets
    const wonBets = resolvedBets.filter(bet => 
      bet.option === bet.bet.winningOption
    ).length;

    // Log resolved bets and counts
    // // console.log('--- Resolved Bets for Win Rate Calculation ---'); // Removed
    // resolvedBets.forEach(bet => {
    //     // console.log(`Resolved Bet ID: ${bet.bet._id}, User Option: ${bet.option}, Winning Option: ${bet.bet.winningOption}`); // Removed
    // });
    // // console.log(`Total Resolved Bets: ${totalResolvedBets}, Won Bets: ${wonBets}`); // Removed
    // // console.log('----------------------------------------------'); // Removed

    const winRate = totalResolvedBets > 0 ? (wonBets / totalResolvedBets) * 100 : 0;

    // Get last 5 bets
    const recentBets = placedBets
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

    res.json({
      user: {
        discordId: user.discordId,
        username: user.username,
        createdAt: user.createdAt
      },
      wallet: {
        balance: wallet ? wallet.balance : 0
      },
      stats: {
        totalBets,
        totalWagered,
        wonBets,
        winRate: winRate.toFixed(1),
        recentBets
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Claim daily bonus
router.post('/:userId/daily', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id });
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
        nextClaimTime: new Date(now.setDate(now.getDate() + 1)).setHours(0, 0, 0, 0) ()
      });
    }

    // Calculate streak bonus
    const streak = wallet.dailyStreak || 0;
    const baseAmount = 100; // Base daily bonus
    const streakMultiplier = Math.min(1 + (streak * 0.1), 2); // Max 2x multiplier
    const bonusAmount = Math.floor(baseAmount * streakMultiplier);

    // Update wallet
    wallet.balance += bonusAmount;
    wallet.lastDailyClaim = new Date(); // Store the exact claim time
    wallet.dailyStreak = streak + 1;
    await wallet.save();

    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'daily',
      amount: bonusAmount,
      description: `Daily bonus (${wallet.dailyStreak} day streak)`
    });
    await transaction.save();

    // Send WebSocket updates
    broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });

    res.json({
      message: 'Daily bonus claimed successfully!',
      amount: bonusAmount,
      streak: wallet.dailyStreak,
      nextClaimTime: new Date(now.setDate(now.getDate() + 1)).setHours(0, 0, 0, 0) ()
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
    const sender = await User.findOne({ discordId: senderDiscordId });
    const recipient = await User.findOne({ discordId: recipientDiscordId });

    if (!sender || !recipient) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get wallets
    const senderWallet = await Wallet.findOne({ user: sender._id });
    const recipientWallet = await Wallet.findOne({ user: recipient._id });

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
      description: `Gift to ${recipientDiscordId}`
    });
    await senderTransaction.save();

    const recipientTransaction = new Transaction({
      user: recipient._id,
      type: 'gift_received',
      amount: amount,
      description: `Gift from ${senderDiscordId}`
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
    const query = { user: user._id };
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
    const user = await User.findOne({ discordId: req.params.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id });
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
    let preferences = await UserPreferences.findOne({ user: req.user._id });
    
    if (!preferences) {
      preferences = new UserPreferences({ user: req.user._id });
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
      { user: req.user._id },
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
    const UserModel = require('../models/User');
    const [users, totalCount] = await Promise.all([
      UserModel.find()
        .sort({ maxWinStreak: -1 })
        .skip(skip)
        .limit(limit)
        .select('username discordId maxWinStreak currentWinStreak'),
      UserModel.countDocuments()
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
    const Transaction = require('../models/Transaction');
    const User = require('../models/User');
    const [wins, totalCount] = await Promise.all([
      Transaction.find({ type: 'win' })
        .sort({ amount: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username discordId')
        .lean(),
      Transaction.countDocuments({ type: 'win' })
    ]);
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
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const [users, totalCount] = await Promise.all([
      User.find({}, '_id username discordId role')
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments()
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

    const [placedBets, totalCount] = await Promise.all([
      PlacedBet.find({ bettor: user._id })
        .populate('bet')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PlacedBet.countDocuments({ bettor: user._id })
    ]);

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

module.exports = router; 