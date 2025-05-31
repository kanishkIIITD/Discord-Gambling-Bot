const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const PlacedBet = require('../models/PlacedBet');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const WebSocket = require('ws');
const { updateUserWinStreak } = require('../utils/gamblingUtils');
const { requireAdmin, auth, requireGuildId } = require('../middleware/auth');
const logger = require('../../discord-bot/utils/logger');

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

// Create a new bet
router.post('/', async (req, res) => {
  try {
    const { description, options, creatorDiscordId, durationMinutes } = req.body;

    // Find the creator user by Discord ID
    const creator = await User.findOne({ discordId: creatorDiscordId });
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

// Get a specific bet by ID
router.get('/:betId', async (req, res) => {
  try {
    const bet = await Bet.findById(req.params.betId).populate('creator', 'username discordId').where({ guildId: req.guildId });
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }
    res.json(bet);
  } catch (error) {
    console.error('Error fetching bet by ID:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Place a bet on an existing event
router.post('/:betId/place', requireGuildId, async (req, res) => {
  const { betId } = req.params;
  const { bettorDiscordId, option, amount } = req.body;
  const { guildId } = req;

  logger.info(`[PLACEBET] User ${bettorDiscordId} attempting to place bet ${betId} with amount ${amount} on option ${option} in guild ${guildId}`);

  try {
    // Find the bet and the bettor
    const bet = await Bet.findById(betId).where({ guildId: req.guildId });
    const bettor = await User.findOne({ discordId: bettorDiscordId });

    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }

    // // console.log(`DEBUG: Bet options from DB:', bet.options`);

    if (bet.status !== 'open') {
        return res.status(400).json({ message: 'Bet is not open for placing bets.' });
    }
    // Check if bet's closing time has passed
    if (bet.closingTime && new Date() > bet.closingTime) {
        bet.status = 'closed';
        await bet.save();
        
        // Broadcast bet closure
        broadcastToAll({
          type: 'BET_CLOSED',
          betId: bet._id
        });
        
        return res.status(400).json({ message: 'Bet is closed as the closing time has passed.' });
    }
    if (!bettor) {
      logger.warn(`[PLACEBET] User not found for discordId ${bettorDiscordId}`);
      return res.status(404).json({ message: 'Bettor user not found.' });
    }
    if (!bet.options.includes(option)) {
        return res.status(400).json({ message: 'Invalid option for this bet.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be positive.' });
    }

    // Check if the user has already placed a bet on this event on a different option
    const existingBetOnEvent = await PlacedBet.findOne({ bet: bet._id, bettor: bettor._id });

    if (existingBetOnEvent && existingBetOnEvent.option !== option) {
      return res.status(400).json({ message: `You have already placed a bet on the option "${existingBetOnEvent.option}" for this event. You cannot bet on a different option.` });
    }

    // Find user and wallet
    const wallet = await Wallet.findOne({ user: bettor._id, guildId });
    if (!wallet) {
      logger.warn(`[PLACEBET] Wallet not found for user ${bettor._id} in guild ${guildId}`);
      return res.status(404).json({ message: 'Wallet not found for this user in this guild.' });
    }

    logger.info(`[PLACEBET] User ${bettorDiscordId} current balance: ${wallet.balance}. Attempting to bet ${amount}.`);

    // Check if user has enough balance
    if (wallet.balance < amount) {
      logger.warn(`[PLACEBET] Insufficient balance for user ${bettorDiscordId}. Required: ${amount}, Available: ${wallet.balance}`);
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // Deduct amount from wallet
    wallet.balance -= amount;
    const newBalance = wallet.balance;
    await wallet.save();

    logger.info(`[PLACEBET] Bet placed successfully by ${bettorDiscordId}. New balance: ${newBalance}`);

    // Record bet placement transaction
    const betTransaction = new Transaction({
      user: bettor._id,
      type: 'bet',
      amount: -amount,
      description: `Bet placed on "${bet.description}" - Option: ${option}`,
      guildId: req.guildId,
    });
    await betTransaction.save();

    // Create the placed bet
    const placedBet = new PlacedBet({
      bet: bet._id,
      bettor: bettor._id,
      option,
      amount,
      guildId: req.guildId,
    });

    await placedBet.save();

    // Broadcast bet update
    broadcastToAll({
      type: 'BET_UPDATED',
      bet: await Bet.findById(betId).populate('creator', 'discordId').where({ guildId: req.guildId })
    });

    // Broadcast balance update to the bettor
    if (wss) {
      const client = Array.from(wss.clients).find(
        c => c.discordId === bettorDiscordId
      );
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'BALANCE_UPDATE',
          balance: newBalance
        }));
      }
    }

    res.status(201).json({
      message: 'Bet placed successfully!',
      placedBet,
      newBalance
    });

  } catch (error) {
    logger.error('[PLACEBET] Error placing bet:', error);
    // Check for specific Mongoose errors or other known issues
    if (error.message.includes('Insufficient balance.')) {
       return res.status(400).json({ message: 'Insufficient balance.' }); // Ensure the specific error message is returned
    }
    res.status(500).json({ message: 'Error placing bet.' });
  }
});

// Get placed bets for a specific bet by ID (with pagination)
router.get('/:betId/placed', async (req, res) => {
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
router.put('/:betId/close', async (req, res) => {
    try {
      const betId = req.params.betId;
      // Optional: Add logic here to verify if the user closing the bet has permissions (e.g., is the creator)

      const bet = await Bet.findById(betId).where({ guildId: req.guildId });

      if (!bet) {
        return res.status(404).json({ message: 'Bet not found.' });
      }
      if (bet.status !== 'open') {
          return res.status(400).json({ message: 'Bet is not currently open.' });
      }

      bet.status = 'closed';
      await bet.save();

      // Broadcast bet closure
      broadcastToAll({
        type: 'BET_CLOSED',
        betId: bet._id
      });

      res.json({ message: 'Bet closed successfully.', bet });

    } catch (error) {
      console.error('Error closing bet:', error);
      res.status(500).json({ message: 'Server error.' });
    }
  });

// Cancel a bet (creator only)
router.delete('/:betId', async (req, res) => {
  try {
    const betId = req.params.betId;
    const { creatorDiscordId } = req.body;

    const bet = await Bet.findById(betId).populate('creator', 'discordId').where({ guildId: req.guildId });
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }

    // Verify the user is the creator
    if (bet.creator.discordId !== creatorDiscordId) {
      return res.status(403).json({ message: 'Only the bet creator can cancel this bet.' });
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

// Edit a bet (creator only)
router.put('/:betId/edit', async (req, res) => {
  try {
    const betId = req.params.betId;
    const { creatorDiscordId, description, options, durationMinutes } = req.body;

    const bet = await Bet.findById(betId).populate('creator', 'discordId').where({ guildId: req.guildId });
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }

    // Verify the user is the creator
    if (bet.creator.discordId !== creatorDiscordId) {
      return res.status(403).json({ message: 'Only the bet creator can edit this bet.' });
    }

    // Check if any bets have been placed
    const placedBets = await PlacedBet.find({ bet: betId });
    if (placedBets.length > 0) {
      return res.status(400).json({ message: 'Cannot edit bet after bets have been placed.' });
    }

    // Update the bet with new values if provided
    if (description) bet.description = description;
    if (options) bet.options = options.split(',').map(option => option.trim());
    if (durationMinutes) {
      bet.closingTime = new Date(Date.now() + durationMinutes * 60 * 1000);
    }

    await bet.save();
    res.json({ message: 'Bet updated successfully.', bet });

  } catch (error) {
    console.error('Error editing bet:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Extend a bet's duration (creator only)
router.put('/:betId/extend', async (req, res) => {
  try {
    const betId = req.params.betId;
    const { creatorDiscordId, additionalMinutes } = req.body;

    const bet = await Bet.findById(betId).populate('creator', 'discordId').where({ guildId: req.guildId });
    if (!bet) {
      return res.status(404).json({ message: 'Bet not found.' });
    }

    // Verify the user is the creator
    if (bet.creator.discordId !== creatorDiscordId) {
      return res.status(403).json({ message: 'Only the bet creator can extend this bet.' });
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

// Resolve a betting event
router.put('/:betId/resolve', async (req, res) => {
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
      await bet.save();

      const placedBets = await PlacedBet.find({ bet: bet._id }).populate('bettor').where({ guildId: req.guildId });

      const totalPot = placedBets.reduce((sum, placedBet) => sum + placedBet.amount, 0);

      const totalBetOnWinningOption = placedBets
        .filter(placedBet => placedBet.option === winningOption)
        .reduce((sum, placedBet) => sum + placedBet.amount, 0);

      for (const placedBet of placedBets) {
        if (placedBet.option === winningOption) {
          const bettorWallet = await Wallet.findOne({ user: placedBet.bettor._id });
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
      const wallet = await Wallet.findOne({ user: placedBet.bettor });
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
    await bet.save();
    res.json({ bet });
  } catch (error) {
    console.error('Error refunding bet:', error);
    res.status(500).json({ message: 'Server error refunding bet.' });
  }
});

module.exports = { router, setWebSocketServer }; 