const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Bet = require('../models/Bet');
const PlacedBet = require('../models/PlacedBet');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const WebSocket = require('ws');
const { updateUserWinStreak } = require('../utils/gamblingUtils');
const { requireAdmin, auth, requireGuildId, requireBetCreatorOrAdmin } = require('../middleware/auth');
const { broadcastToUser } = require('../utils/websocketService');

// Get the WebSocket server instance
let wss;
const setWebSocketServer = (server) => {
  wss = server;
};

// Function to broadcast to all clients
const broadcastToAll = (data) => {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
};

// Middleware to find user (needed for bet creation, placing, etc.)
router.use(async (req, res, next) => {
  // This middleware assumes a user is authenticated or identified somehow.
  // For now, we might need to pass the Discord ID in the request body or headers for relevant routes.
  // A more robust authentication mechanism would be needed in a production app.
  // For testing, we might fetch a default user or expect discordId in the body.
  // Let's adjust this based on how the Discord bot will send user info.
  // For now, assuming user ID is in req.body for routes that need it.
  next();
});

// Apply requireGuildId to all routes
router.use(requireGuildId);

// Timer management for automatic bet closing
const betTimers = new Map();

function scheduleBetClosure(bet) {
  // Cancel any existing timer for this bet
  cancelBetClosure(bet._id);
  if (!bet.closingTime || bet.status !== 'open') return;
  const delay = new Date(bet.closingTime).getTime() - Date.now();
  if (delay <= 0) return; // Already expired
  const timer = setTimeout(async () => {
    try {
      // Double-check bet is still open and not already closed
      const freshBet = await Bet.findById(bet._id);
      if (freshBet && freshBet.status === 'open') {
        freshBet.status = 'closed';
        await freshBet.save();
        broadcastToAll({
          type: 'BET_CLOSED',
          betId: freshBet._id
        });
      }
    } catch (err) {
      console.error('Error auto-closing bet:', err);
    } finally {
      betTimers.delete(String(bet._id));
    }
  }, delay);
  betTimers.set(String(bet._id), timer);
}

function cancelBetClosure(betId) {
  const timer = betTimers.get(String(betId));
  if (timer) {
    clearTimeout(timer);
    betTimers.delete(String(betId));
  }
}

// Create a new bet
router.post('/', async (req, res) => {
  try {
    const { description, options, creatorDiscordId, durationMinutes } = req.body;

    // Find the creator user by Discord ID
    const creator = await User.findOne({ discordId: creatorDiscordId, guildId: req.guildId });
    if (!creator) {
      return res.status(404).json({ message: 'Creator user not found.' });
    }

    const newBet = new Bet({
      description,
      options,
      creator: creator._id,
      closingTime: durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : undefined,
      guildId: req.guildId,
    });

    await newBet.save();
    
    // Broadcast new bet to all clients
    broadcastToAll({
      type: 'BET_CREATED',
      bet: newBet
    });

    // Schedule automatic closure if needed
    if (newBet.closingTime) {
      scheduleBetClosure(newBet);
    }
    
    res.status(201).json(newBet);
  } catch (error) {
    console.error('Error creating bet:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get all open bets
router.get('/open', async (req, res) => {
  try {
    const openBets = await Bet.find({ status: 'open', guildId: req.guildId }).populate('creator', 'discordId');
    res.json(openBets);
  } catch (error) {
    console.error('Error fetching open bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get upcoming bets
router.get('/upcoming', async (req, res) => {
  try {
    const upcomingBets = await Bet.find({
      status: 'open',
      closingTime: { $gt: new Date() },
      guildId: req.guildId
    }).populate('creator', 'discordId');
    res.json(upcomingBets);
  } catch (error) {
    console.error('Error fetching upcoming bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get all unresolved bets (open or closed)
router.get('/unresolved', async (req, res) => {
  try {
    const unresolvedBets = await Bet.find({ status: { $in: ['open', 'closed'] }, guildId: req.guildId }).populate('creator', 'discordId');
    res.json(unresolvedBets);
  } catch (error) {
    console.error('Error fetching unresolved bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get all closed bets
router.get('/closed', async (req, res) => {
  try {
    const closedBets = await Bet.find({ status: 'closed', guildId: req.guildId }).populate('creator', 'discordId');
    res.json(closedBets);
  } catch (error) {
    console.error('Error fetching closed bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get all closed, unnotified bets (for Discord bot polling)
router.get('/closed-unnotified', async (req, res) => {
  try {
    const guildId = req.guildId;
    const query = { status: 'closed', notified: false };
    if (guildId) query.guildId = guildId;
    const bets = await Bet.find(query);
    res.json(bets);
  } catch (error) {
    console.error('Error fetching closed-unnotified bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Mark a bet as notified (after Discord bot announces closure)
router.post('/:betId/mark-notified', async (req, res) => {
  try {
    const betId = req.params.betId;
    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }
    bet.notified = true;
    await bet.save();
    res.json({ message: 'Bet marked as notified.' });
  } catch (error) {
    console.error('Error marking bet as notified:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get a specific bet by ID
router.get('/:betId', async (req, res) => {
  try {
    const bet = await Bet.findOne({ _id: req.params.betId, guildId: req.guildId })
      .populate('creator', 'username discordId')
      .lean();

    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }

    const placedBetsStats = await PlacedBet.aggregate([
      { $match: { bet: bet._id } },
      { $group: { _id: '$option', totalAmount: { $sum: '$amount' } } },
    ]);

    const optionTotals = bet.options.reduce((acc, option) => {
      acc[option] = 0;
      return acc;
    }, {});

    let totalPot = 0;
    placedBetsStats.forEach(stat => {
      optionTotals[stat._id] = stat.totalAmount;
      totalPot += stat.totalAmount;
    });

    res.json({
      ...bet,
      optionTotals,
      totalPot,
    });
  } catch (error) {
    console.error('Error fetching bet by ID:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Place a bet on an existing event
router.post('/:betId/place', async (req, res) => {
  const { bettorDiscordId, option, amount } = req.body;
  const { betId } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Basic validations
    if (amount <= 0) {
      throw { status: 400, message: 'Amount must be positive.' };
    }

    // Find the bet and the bettor
    const bet = await Bet.findById(betId).session(session).where({ guildId: req.guildId });
    if (!bet) {
      throw { status: 404, message: 'Bet not found.' };
    }

    if (bet.status !== 'open') {
      throw { status: 400, message: 'Bet is not open for placing bets.' };
    }

    if (bet.closingTime && new Date() > bet.closingTime) {
      bet.status = 'closed';
      await bet.save({ session });
      broadcastToAll({ type: 'BET_CLOSED', betId: bet._id });
      throw { status: 400, message: 'Bet is closed as the closing time has passed.' };
    }

    if (!bet.options.includes(option)) {
      throw { status: 400, message: 'Invalid option for this bet.' };
    }

    const bettor = await User.findOne({ discordId: bettorDiscordId, guildId: req.guildId }).session(session);
    if (!bettor) {
      throw { status: 404, message: 'Bettor user not found.' };
    }

    // Check balance and deduct from wallet
    const wallet = await Wallet.findOne({ user: bettor._id, guildId: req.guildId }).session(session);
    if (!wallet || wallet.balance < amount) {
      throw { status: 400, message: 'Insufficient balance.' };
    }
    wallet.balance -= amount;

    // Check for existing bet and handle logic
    const existingPlacedBet = await PlacedBet.findOne({ bet: bet._id, bettor: bettor._id }).session(session);

    if (existingPlacedBet) {
      if (existingPlacedBet.option !== option) {
        throw { status: 400, message: `You have already placed a bet on the option "${existingPlacedBet.option}". You cannot bet on a different option.` };
      }
      // Add to existing bet
      existingPlacedBet.amount += amount;
      await existingPlacedBet.save({ session });
    } else {
      // Create new placed bet
      await PlacedBet.create([{
        bet: bet._id,
        bettor: bettor._id,
        option,
        amount,
        guildId: req.guildId,
      }], { session });
    }
    
    // Record transaction and save wallet
    await Transaction.create([{
      user: bettor._id,
      type: 'bet',
      amount: -amount,
      description: `Bet placed on "${bet.description}" - Option: ${option}`,
      guildId: req.guildId,
    }], { session });
    
    await wallet.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Broadcast updates (outside of transaction)
    broadcastToAll({
      type: 'BET_UPDATED',
      bet: await Bet.findById(betId).populate('creator', 'discordId').where({ guildId: req.guildId })
    });

    broadcastToUser(bettorDiscordId, {
      type: 'BALANCE_UPDATE',
      balance: wallet.balance
    });
    
    res.status(201).json({ message: 'Bet placed successfully.' });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error placing bet:', error);
    if (error.status) {
      res.status(error.status).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Server error during bet placement.' });
    }
  } finally {
    session.endSession();
  }
});

// Get placed bets for a specific bet by ID (with pagination)
router.get('/:betId/placed', requireGuildId, async (req, res) => {
  try {
    const betId = req.params.betId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [placedBets, totalCount] = await Promise.all([
      PlacedBet.find({ bet: betId, guildId: req.guildId })
        .populate('bettor', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PlacedBet.countDocuments({ bet: betId, guildId: req.guildId })
    ]);

    res.json({
      data: placedBets,
      totalCount,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching placed bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Close betting for a specific event
router.put('/:betId/close', requireBetCreatorOrAdmin, async (req, res) => {
  try {
    const betId = req.params.betId;
    const bet = await Bet.findById(betId).where({ guildId: req.guildId });

    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }
    if (bet.status !== 'open') {
      return res.status(400).json({ message: 'Bet is not currently open.' });
    }

    bet.status = 'closed';
    bet.notified = true;
    await bet.save();

    // Broadcast bet closure
    broadcastToAll({
      type: 'BET_CLOSED',
      betId: bet._id
    });

    // Cancel any scheduled closure timer
    cancelBetClosure(bet._id);

    res.json({ message: 'Bet closed successfully.', bet });

  } catch (error) {
    console.error('Error closing bet:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Cancel a bet (creator or admin only)
router.delete('/:betId', requireBetCreatorOrAdmin, async (req, res) => {
  try {
    const betId = req.params.betId;
    const { creatorDiscordId } = req.body;

    const bet = await Bet.findById(betId).populate('creator', 'discordId').where({ guildId: req.guildId });
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }

    // Check if any bets have been placed
    const placedBets = await PlacedBet.find({ bet: betId });
    if (placedBets.length > 0) {
      return res.status(400).json({ message: 'Cannot cancel bet after bets have been placed.' });
    }

    // Delete the bet
    await Bet.findByIdAndDelete(betId);
    res.json({ message: 'Bet cancelled successfully.' });

  } catch (error) {
    console.error('Error cancelling bet:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Edit a bet (creator or admin only)
router.put('/:betId/edit', requireBetCreatorOrAdmin, async (req, res) => {
  try {
    const betId = req.params.betId;
    const { creatorDiscordId, description, options, durationMinutes } = req.body;

    const bet = await Bet.findById(betId).populate('creator', 'discordId').where({ guildId: req.guildId });
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }

    // Check if any bets have been placed
    const placedBets = await PlacedBet.find({ bet: betId });
    if (placedBets.length > 0) {
      return res.status(400).json({ message: 'Cannot edit bet after bets have been placed.' });
    }

    // Update the bet with new values if provided
    if (description) bet.description = description;
    if (options) {
      if (Array.isArray(options)) {
        bet.options = options.map(option => option.trim());
      } else if (typeof options === 'string') {
        bet.options = options.split(',').map(option => option.trim());
      }
    }
    let closingTimeChanged = false;
    if (durationMinutes) {
      bet.closingTime = new Date(Date.now() + durationMinutes * 60 * 1000);
      closingTimeChanged = true;
    }

    await bet.save();
    // Reschedule timer if closingTime was changed
    if (closingTimeChanged) {
      scheduleBetClosure(bet);
    }
    res.json({ message: 'Bet updated successfully.', bet });

  } catch (error) {
    console.error('Error editing bet:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Extend a bet's duration (creator or admin only)
router.put('/:betId/extend', requireBetCreatorOrAdmin, async (req, res) => {
  try {
    const betId = req.params.betId;
    const { creatorDiscordId, additionalMinutes } = req.body;

    const bet = await Bet.findById(betId).populate('creator', 'discordId').where({ guildId: req.guildId });
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }

    // Check if bet is still open
    if (bet.status !== 'open') {
      return res.status(400).json({ message: 'Cannot extend a bet that is not open.' });
    }

    // Check if bet has a closing time
    if (!bet.closingTime) {
      return res.status(400).json({ message: 'Cannot extend a bet that has no closing time.' });
    }

    // Extend the closing time
    const newClosingTime = new Date(bet.closingTime.getTime() + additionalMinutes * 60 * 1000);
    bet.closingTime = newClosingTime;
    await bet.save();

    // Reschedule timer for new closing time
    scheduleBetClosure(bet);

    res.json({ 
      message: 'Bet duration extended successfully.', 
      bet,
      newClosingTime 
    });

  } catch (error) {
    console.error('Error extending bet:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Resolve a betting event (creator or admin only)
router.put('/:betId/resolve', requireBetCreatorOrAdmin, async (req, res) => {
    try {
      const betId = req.params.betId;
      const { winningOption, resolverDiscordId } = req.body;

      const bet = await Bet.findById(betId).where({ guildId: req.guildId });

      if (!bet) {
        return res.status(404).json({ message: 'Bet not found.' });
      }

      if (bet.status === 'resolved') {
          return res.status(400).json({ message: 'Bet has already been resolved.' });
      }
      if (!bet.options.includes(winningOption)) {
        return res.status(400).json({ message: 'Winning option is not valid for this bet.' });
      }

      bet.status = 'resolved';
      bet.winningOption = winningOption;
      bet.notified = true;
      await bet.save();

      // Cancel any scheduled closure timer
      cancelBetClosure(bet._id);

      const placedBets = await PlacedBet.find({ bet: bet._id }).populate('bettor').where({ guildId: req.guildId });

      const totalPot = placedBets.reduce((sum, placedBet) => sum + placedBet.amount, 0);

      const totalBetOnWinningOption = placedBets
        .filter(placedBet => placedBet.option === winningOption)
        .reduce((sum, placedBet) => sum + placedBet.amount, 0);

      for (const placedBet of placedBets) {
        if (placedBet.option === winningOption) {
          const bettorWallet = await Wallet.findOne({ user: placedBet.bettor._id, guildId: req.guildId });
          if (bettorWallet) {
            const winnings = Math.floor((placedBet.amount / totalBetOnWinningOption) * totalPot);
            bettorWallet.balance += winnings;
            await bettorWallet.save();

            // Record winning transaction
            const winTransaction = new Transaction({
              user: placedBet.bettor._id,
              type: 'win',
              amount: winnings,
              description: `Won bet on "${bet.description}" - Option: ${winningOption}`,
              guildId: req.guildId,
            });
            await winTransaction.save();

            // Update win streak for winner
            await updateUserWinStreak(placedBet.bettor.discordId, true);

            // Broadcast balance update to the winning user
            if (wss) {
              const client = Array.from(wss.clients).find(
                c => c.discordId === placedBet.bettor.discordId
              );
              if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'BALANCE_UPDATE',
                  balance: bettorWallet.balance
                }));
              }
            }
          }
        } else {
          // Update win streak for losers
          await updateUserWinStreak(placedBet.bettor.discordId, false);
        }
      }

      // Broadcast bet resolution
      broadcastToAll({
        type: 'BET_RESOLVED',
        betId: bet._id,
        winner: winningOption
      });

      res.json({ message: 'Bet resolved successfully.', bet });

    } catch (error) {
      console.error('Error resolving bet:', error);
      res.status(500).json({ message: 'Server error.' });
    }
});

// Refund a bet (admin/superadmin only)
router.post('/:betId/refund', auth, requireAdmin, async (req, res) => {
  try {
    const { betId } = req.params;
    const bet = await Bet.findById(betId).where({ guildId: req.guildId });
    if (!bet) return res.status(404).json({ message: 'Bet not found.' });
    if (['resolved', 'cancelled', 'refunded'].includes(bet.status)) {
      return res.status(400).json({ message: 'Bet is already resolved, cancelled, or refunded.' });
    }
    // Refund all placed bets
    const placedBets = await PlacedBet.find({ bet: betId });
    for (const placedBet of placedBets) {
      // Fetch the bettor's wallet
      const wallet = await Wallet.findOne({ user: placedBet.bettor, guildId: req.guildId });
      if (wallet) {
        // Refund points
        wallet.balance += placedBet.amount;
        await wallet.save();
        // Create refund transaction
        await Transaction.create({
          user: placedBet.bettor,
          type: 'refund',
          amount: placedBet.amount,
          description: `Refund for bet: ${bet.description}`,
          guildId: req.guildId,
        });
      }
    }
    bet.status = 'refunded';
    bet.notified = true;
    await bet.save();
    // Cancel any scheduled closure timer
    cancelBetClosure(bet._id);
    res.json({ bet });
  } catch (error) {
    console.error('Error refunding bet:', error);
    res.status(500).json({ message: 'Server error refunding bet.' });
  }
});

// Export timer functions for use in other endpoints
module.exports = { router, setWebSocketServer, scheduleBetClosure, cancelBetClosure };