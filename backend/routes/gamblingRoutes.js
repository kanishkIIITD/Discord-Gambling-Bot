const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Jackpot = require('../models/Jackpot');
const BlackjackGame = require('../models/BlackjackGame');
const { validateBetAmount, handleGamblingError } = require('../middleware/gamblingMiddleware');
const { updateWalletBalance, createGamblingResponse, calculateMultiplier, getNumbersCoveredByBet, updateUserWinStreak } = require('../utils/gamblingUtils');
const Transaction = require('../models/Transaction');
const { broadcastToUser } = require('../utils/websocketService');
const { requireGuildId } = require('../middleware/auth');

// Apply requireGuildId to all routes
router.use(requireGuildId);

// Middleware to find user and wallet
router.use('/:discordId', async (req, res, next) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    req.user = user;
    req.wallet = wallet;
    next();
  } catch (error) {
    handleGamblingError(error, req, res, next);
  }
});

// Play coinflip
router.post('/:discordId/coinflip', validateBetAmount, async (req, res) => {
  try {
    const { choice, amount } = req.body;
    const wallet = req.wallet;
    const user = req.user;

    // Generate random result
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = choice === result;
    const winnings = won ? amount * calculateMultiplier('coinflip') : 0;

    // Update wallet
    const newBalance = await updateWalletBalance(
      wallet,
      amount,
      winnings,
      'coinflip',
      won ? `Choice: ${choice}, Result: ${result}` : ''
    );

    // Send WebSocket updates
    const latestTransaction = await Transaction.findOne({ user: user._id, guildId: req.guildId }).sort({ timestamp: -1 });
    if (latestTransaction) {
      broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction: latestTransaction });
    }
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: newBalance });

    // Update win streak
    await updateUserWinStreak(user.discordId, won, req.guildId);

    res.json(createGamblingResponse({ result }, won, winnings, newBalance));
  } catch (error) {
    handleGamblingError(error, req, res, next);
  }
});

// Play dice
router.post('/:discordId/dice', validateBetAmount, async (req, res) => {
  try {
    const { bet_type, number, amount } = req.body;
    const wallet = req.wallet;
    const user = req.user;

    // Validate number for specific bet
    if (bet_type === 'specific' && (!number || number < 1 || number > 6)) {
      return res.status(400).json({ message: 'Invalid number for specific bet.' });
    }

    // Roll dice
    const roll = Math.floor(Math.random() * 6) + 1;
    let won = false;
    let result = '';

    // Determine win based on bet type
    switch (bet_type) {
      case 'specific':
        won = roll === number;
        result = 'specific';
        break;
      case 'high':
        won = roll >= 4;
        result = 'high';
        break;
      case 'low':
        won = roll <= 3;
        result = 'low';
        break;
      case 'even':
        won = roll % 2 === 0;
        result = 'even';
        break;
      case 'odd':
        won = roll % 2 === 1;
        result = 'odd';
        break;
      default:
        return res.status(400).json({ message: 'Invalid bet type. Valid types are: specific, high, low, even, odd' });
    }

    const multiplier = calculateMultiplier('dice', result);
    const winnings = won ? amount * multiplier : 0;

    // Update wallet
    const newBalance = await updateWalletBalance(
      wallet,
      amount,
      winnings,
      'dice',
      won ? `${bet_type}${number ? ` (${number})` : ''}, Roll: ${roll}` : ''
    );

    // Send WebSocket updates
    const latestTransaction = await Transaction.findOne({ user: user._id, guildId: req.guildId }).sort({ timestamp: -1 });
    if (latestTransaction) {
      broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction: latestTransaction });
    }
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: newBalance });

    // Update win streak
    await updateUserWinStreak(user.discordId, won, req.guildId);

    res.json(createGamblingResponse({ roll }, won, winnings, newBalance));
  } catch (error) {
    handleGamblingError(error, req, res, next);
  }
});

// Play slots
router.post('/:discordId/slots', validateBetAmount, async (req, res) => {
  try {
    const { amount } = req.body;
    const wallet = req.wallet;
    const user = req.user;

    // Check for free spin
    let usedFreeSpin = false;
    if (wallet.freeSpins > 0) {
      usedFreeSpin = true;
      wallet.freeSpins -= 1;
    }

    // Slot symbols and their weights
    const symbols = ['🍒', '🍊', '🍋', '🍇', '💎', '7️⃣'];
    const weights = [28, 24, 19, 14, 10, 5]; // percentages

    // Generate three random symbols
    const getRandomSymbol = () => {
      const rand = Math.random() * 100;
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (rand < sum) return symbols[i];
      }
      return symbols[0];
    };

    const reels = [
      getRandomSymbol(),
      getRandomSymbol(),
      getRandomSymbol()
    ];

    // Check for jackpot win (three 7️⃣ symbols)
    const isJackpot = reels[0] === '7️⃣' && reels[1] === '7️⃣' && reels[2] === '7️⃣';
    let multiplier = 0;
    let jackpotAmount = 0;
    let winType = null;
    let winnings = 0; // Initialize winnings to 0
    if (isJackpot) {
      let jackpot = await Jackpot.findOne({ guildId: req.guildId });
      if (!jackpot) jackpot = new Jackpot({ guildId: req.guildId });
      jackpotAmount = jackpot.currentAmount;
      const jackpotMultiplier = 554.83;
      winnings = Math.max(jackpotAmount, Math.floor(amount * jackpotMultiplier));
      multiplier = 0;
      winType = 'jackpot';
      jackpot.lastWinner = user._id;
      jackpot.lastWinAmount = winnings;
      jackpot.lastWinTime = new Date();
      jackpot.currentAmount = 0;
      await jackpot.save();
      const jackpotTransaction = new Transaction({
        user: user._id,
        type: 'jackpot',
        amount: winnings,
        description: 'JACKPOT WIN! 🎉',
        guildId: req.guildId
      });
      await jackpotTransaction.save();
    } else if (reels[0] === reels[1] && reels[1] === reels[2]) {
      // Three of a kind
      winType = 'three-of-a-kind';
      switch (reels[0]) {
        case '7️⃣': multiplier = 50; break;
        case '💎': multiplier = 25; break;
        case '🍇': multiplier = 12.11; break;
        case '🍋': multiplier = 8.22; break;
        case '🍊': multiplier = 6.65; break;
        case '🍒': multiplier = 5.0; break;
      }
      winnings = amount * multiplier;
    } else if (
      (reels.filter(s => s === '7️⃣').length === 2)
    ) {
      // Two 7️⃣ (but not three)
      multiplier = 4.11;
      winType = 'two-sevens';
      winnings = amount * multiplier;
    } else if (
      (reels[0] === reels[1] && reels[0] !== '7️⃣') ||
      (reels[0] === reels[2] && reels[0] !== '7️⃣') ||
      (reels[1] === reels[2] && reels[1] !== '7️⃣')
    ) {
      // Any two matching symbols (except 7️⃣)
      multiplier = 1.2;
      winType = 'two-matching';
      winnings = amount * multiplier;
    }

    // Consolidate 'won' check and 'winnings' calculation
    const won = winnings > 0;

    // Free spin logic: track loss streak and award free spin after 5 losses
    if (!won && !usedFreeSpin) {
      wallet.slotLossStreak = (wallet.slotLossStreak || 0) + 1;
      if (wallet.slotLossStreak >= 5) {
        wallet.freeSpins = (wallet.freeSpins || 0) + 1;
        wallet.slotLossStreak = 0;
      }
    } else if (won) {
      wallet.slotLossStreak = 0;
    }

    // Update wallet and record bet/win/loss transactions
    await updateWalletBalance(
      wallet,
      usedFreeSpin ? 0 : amount,
      winnings,
      'slots',
      won ? (isJackpot ? 'JACKPOT!' : `[${reels.join('|')}]`) : '',
      req.guildId
    );
    await wallet.save();

    // CONSOLIDATED BROADCAST:
    const latestTransaction = await Transaction.findOne({ user: user._id, guildId: req.guildId }).sort({ timestamp: -1 });
    if (latestTransaction) {
      broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction: latestTransaction });
    }

    // Add to jackpot if lost and not a free spin
    if (!won && !usedFreeSpin) {
      let jackpot = await Jackpot.findOne({ guildId: req.guildId });
      if (!jackpot) jackpot = new Jackpot({ guildId: req.guildId });
      const contributionAmount = Math.floor(amount * 0.1); // 10% goes to jackpot
      jackpot.currentAmount += contributionAmount;
      jackpot.contributions.push({
        user: user._id,
        amount: contributionAmount
      });
      await jackpot.save();
    }

    // Fetch the updated balance *after* all transactions and saves
    const updatedWallet = await Wallet.findById(wallet._id);
    const newBalance = updatedWallet.balance;
    const jackpot = await Jackpot.findOne({ guildId: req.guildId }) || { currentAmount: 0 };

    // Send WebSocket update for balance
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: newBalance });
    await updateUserWinStreak(user.discordId, winnings > 0, req.guildId);

    res.json(createGamblingResponse({ reels, isJackpot, jackpotAmount, jackpotPool: jackpot.currentAmount, usedFreeSpin, freeSpins: wallet.freeSpins }, won, winnings, newBalance));
  } catch (error) {
    handleGamblingError(error, req, res);
  }
});

// Play blackjack
router.post('/:discordId/blackjack', async (req, res) => {
  try {
    const { amount, action } = req.body;
    const wallet = req.wallet;
    const user = req.user;

    // --- PATCH: Only allow a new game if there is no unfinished game ---
    let gameState = await BlackjackGame.findOne({ 
      user: req.user._id,
      guildId: req.guildId
    });
    // If starting a new game (amount provided)
    if (amount !== undefined) {
      if (gameState && !gameState.gameOver) {
        // There is an unfinished game, return it instead of starting a new one
        // Calculate canSplit/canDouble for UI
        const calculateHandValue = (hand) => {
          if (!hand || hand.length === 0) return 0;
          let value = 0;
          let aces = 0;
          for (let card of hand) {
            if (!card || !card.value) continue;
            if (card.value === 'A') { aces++; value += 11; }
            else if (['K', 'Q', 'J'].includes(card.value)) { value += 10; }
            else { value += parseInt(card.value); }
          }
          while (value > 21 && aces > 0) { value -= 10; aces--; }
          return value;
        };
        return res.json({
          playerHands: gameState.playerHands,
          dealerHand: gameState.gameOver ? gameState.dealerHand : [gameState.dealerHand[0], { suit: '?', value: '?' }],
          currentHand: gameState.currentHand,
          gameOver: gameState.gameOver,
          results: [],
          newBalance: wallet.balance,
          canSplit: gameState.playerHands[gameState.currentHand]?.length === 2 && 
                    calculateHandValue([gameState.playerHands[gameState.currentHand][0]]) === 
                    calculateHandValue([gameState.playerHands[gameState.currentHand][1]]),
          canDouble: gameState.playerHands[gameState.currentHand]?.length === 2,
          resumed: true
        });
      }
      // If previous game is over or doesn't exist, delete old state and start new game (existing logic)
      if (gameState) {
        try { await BlackjackGame.deleteOne({ _id: gameState._id }); } catch (error) { console.error('Error cleaning up old blackjack game:', error); }
        gameState = null;
      }
    } else if (gameState && (gameState.gameOver || (gameState.createdAt < new Date(Date.now() - 60 * 60 * 1000)))) {
      // Clean up if game is over or too old
      try { await BlackjackGame.deleteOne({ _id: gameState._id }); gameState = null; } catch (error) { console.error('Error cleaning up old blackjack game:', error); }
    }
    // --- END PATCH ---

    // If no game state and no amount provided, return error
    if (!gameState && amount === undefined) {
      return res.status(400).json({ message: 'Please provide an amount to start a new game.' });
    }

    // If we have an action but no game state, return error
    if (action && !gameState) {
      return res.status(400).json({ message: 'No active game found. Start a new game first with /blackjack amount:100' });
    }

    // --- PATCH: Strict atomic balance check for new games ---
    if (!gameState && amount !== undefined) {
      if (typeof amount !== 'number' || isNaN(amount) || amount < 10) {
        return res.status(400).json({ message: 'Minimum bet is 10 points.' });
      }
      // Re-fetch wallet to ensure latest balance
      const freshWallet = await Wallet.findOne({ _id: wallet._id });
      if (!freshWallet || freshWallet.balance < amount) {
        return res.status(400).json({ message: 'Insufficient balance.' });
      }
      // Atomically deduct bet amount
      freshWallet.balance -= amount;
      if (freshWallet.balance < 0) {
        return res.status(400).json({ message: 'Insufficient balance.' });
      }
      await freshWallet.save();
      wallet.balance = freshWallet.balance; // Sync in-memory wallet
    }
    // --- END PATCH ---

    // Create or use existing deck
    let deck;
    if (gameState && gameState.deck) {
      deck = gameState.deck;
    } else {
      // Create a new deck
      const suits = ['♠️', '♥️', '♣️', '♦️'];
      const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      deck = [];
      for (let suit of suits) {
        for (let value of values) {
          deck.push({ suit, value });
        }
      }
      // Shuffle deck
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }

    // Calculate hand value
    const calculateHandValue = (hand) => {
      if (!hand || hand.length === 0) return 0;
      
      let value = 0;
      let aces = 0;

      for (let card of hand) {
        if (!card || !card.value) continue;
        
        if (card.value === 'A') {
          aces++;
          value += 11;
        } else if (['K', 'Q', 'J'].includes(card.value)) {
          value += 10;
        } else {
          value += parseInt(card.value);
        }
      }

      // Adjust for aces
      while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
      }

      return value;
    };

    // Handle different actions
    if (action) {
      if (!gameState) {
        return res.status(400).json({ message: 'No active game found. Start a new game first.' });
      }

      // Ensure we have the deck from the game state
      deck = gameState.deck;

      // Validate current hand exists
      if (!gameState.playerHands[gameState.currentHand]) {
        return res.status(400).json({ message: 'Invalid game state: current hand not found.' });
      }

      // Validate current bet exists
      if (!gameState.bets[gameState.currentHand]) {
        return res.status(400).json({ message: 'Invalid game state: current bet not found.' });
      }

      switch (action.toLowerCase()) {
        case 'hit':
          if (calculateHandValue(gameState.playerHands[gameState.currentHand]) === 21) {
            return res.status(400).json({ message: 'Cannot perform this action: hand value is already 21.' });
          }
          // Add card to current hand
          gameState.playerHands[gameState.currentHand].push(deck.pop());
          
          // Check for bust
          if (calculateHandValue(gameState.playerHands[gameState.currentHand]) > 21) {
            gameState.currentHand++;
            if (gameState.currentHand >= gameState.playerHands.length) {
              // All hands are done, dealer's turn
              while (calculateHandValue(gameState.dealerHand) < 17) {
                gameState.dealerHand.push(deck.pop());
              }
              gameState.gameOver = true;
            }
          }
          break;

        case 'stand':
          gameState.currentHand++;
          if (gameState.currentHand >= gameState.playerHands.length) {
            // All hands are done, dealer's turn
            while (calculateHandValue(gameState.dealerHand) < 17) {
              gameState.dealerHand.push(deck.pop());
            }
            gameState.gameOver = true;
          }
          break;

        case 'double':
          if (calculateHandValue(gameState.playerHands[gameState.currentHand]) === 21) {
            return res.status(400).json({ message: 'Cannot perform this action: hand value is already 21.' });
          }
          // Validate current hand has exactly 2 cards
          if (gameState.playerHands[gameState.currentHand].length !== 2) {
            return res.status(400).json({ message: 'Can only double down on first two cards.' });
          }

          const currentBet = gameState.bets[gameState.currentHand];
          if (!currentBet || isNaN(currentBet) || currentBet <= 0) {
            return res.status(400).json({ message: 'Invalid bet amount for double down.' });
          }

          // Check if user has enough balance
          if (wallet.balance < currentBet) {
            return res.status(400).json({ 
              message: `You need ${currentBet.toLocaleString('en-US')} points to double down, but you only have ${wallet.balance.toLocaleString('en-US')}.` 
            });
          }

          // Process double down
          wallet.balance -= currentBet;
          gameState.bets[gameState.currentHand] *= 2;
          gameState.playerHands[gameState.currentHand].push(deck.pop());

          // Record double down transaction
          const doubleTransaction = new Transaction({
            user: req.user._id,
            type: 'bet',
            amount: -currentBet,
            description: 'Blackjack double down',
            guildId: req.guildId
          });
          await doubleTransaction.save();

          // Move to next hand or end game
          gameState.currentHand++;
          if (gameState.currentHand >= gameState.playerHands.length) {
            // All hands are done, dealer's turn
            while (calculateHandValue(gameState.dealerHand) < 17) {
              gameState.dealerHand.push(deck.pop());
            }
            gameState.gameOver = true;
          }
          break;

        case 'split':
          if (calculateHandValue(gameState.playerHands[gameState.currentHand]) === 21) {
            return res.status(400).json({ message: 'Cannot perform this action: hand value is already 21.' });
          }
          // Check if can split (same value cards and enough balance)
          const currentHand = gameState.playerHands[gameState.currentHand];
          if (currentHand.length !== 2 || 
              calculateHandValue([currentHand[0]]) !== calculateHandValue([currentHand[1]])) {
            return res.status(400).json({ message: 'Cannot split this hand.' });
          }
          if (wallet.balance < gameState.bets[gameState.currentHand]) {
            return res.status(400).json({
              message: `You need ${gameState.bets[gameState.currentHand].toLocaleString('en-US')} points to split, but you only have ${wallet.balance.toLocaleString('en-US')}.`
            });
          }
          
          // Create new hand and move one card
          const newHand = [currentHand.pop()];
          gameState.playerHands.splice(gameState.currentHand + 1, 0, newHand);
          gameState.bets.splice(gameState.currentHand + 1, 0, gameState.bets[gameState.currentHand]);
          wallet.balance -= gameState.bets[gameState.currentHand];
          
          // Add one card to each hand
          currentHand.push(deck.pop());
          newHand.push(deck.pop());

          // Record split transaction
          const splitTransaction = new Transaction({
            user: req.user._id,
            type: 'bet',
            amount: -gameState.bets[gameState.currentHand],
            description: 'Blackjack split',
            guildId: req.guildId
          });
          await splitTransaction.save();
          break;
      }

      // Update the deck in the game state
      gameState.deck = deck;
    } else if (amount !== undefined) {
      // --- PATCH: Always create a fresh game state for new games ---
      gameState = new BlackjackGame({
        user: req.user._id,
        deck,
        playerHands: [[deck.pop(), deck.pop()]],
        dealerHand: [deck.pop(), deck.pop()],
        bets: [amount],
        currentHand: 0,
        gameOver: false,
        guildId: req.guildId
      });
      // Record initial bet transaction
      const betTransaction = new Transaction({
        user: req.user._id,
        type: 'bet',
        amount: -amount,
        description: 'Blackjack initial bet',
        guildId: req.guildId
      });
      await betTransaction.save();
    }

    // Save game state
    await gameState.save();

    // Calculate results if game is over
    let results = [];
    if (gameState.gameOver) {
      const dealerValue = calculateHandValue(gameState.dealerHand);
      const dealerBust = dealerValue > 21;

      for (let i = 0; i < gameState.playerHands.length; i++) {
        const playerValue = calculateHandValue(gameState.playerHands[i]);
        const playerBust = playerValue > 21;
        const isBlackjack = gameState.playerHands[i].length === 2 && playerValue === 21;
        const dealerBlackjack = gameState.dealerHand.length === 2 && dealerValue === 21;

        let result = 'push';
        let winnings = 0;

        if (isBlackjack && !dealerBlackjack) {
          result = 'blackjack';
          winnings = gameState.bets[i] * 2.5; // 3:2 payout
        } else if (playerBust) {
          result = 'bust';
          winnings = 0;
        } else if (dealerBust) {
          result = 'win';
          winnings = gameState.bets[i] * 2;
        } else if (isBlackjack && dealerBlackjack) {
          result = 'push';
          winnings = gameState.bets[i]; // Return original bet
        } else if (playerValue > dealerValue) {
          result = 'win';
          winnings = gameState.bets[i] * 2;
        } else if (playerValue < dealerValue) {
          result = 'lose';
          winnings = 0;
        } else {
          result = 'push';
          winnings = gameState.bets[i]; // Return original bet
        }

        results.push({ result, winnings });
        wallet.balance += winnings;

        // Record result transaction
        if (winnings > 0) {
          const resultTransaction = new Transaction({
            user: req.user._id,
            type: 'win',
            amount: winnings,
            description: `Blackjack ${result} (Hand ${i + 1})`,
            guildId: req.guildId
          });
          await resultTransaction.save();
        }
      }

      // --- PATCH: Always delete the game state after game over ---
      await BlackjackGame.deleteOne({ _id: gameState._id });
      // --- END PATCH ---

      // Update win streak: win if any hand is 'win' or 'blackjack', lose if all are 'lose' or 'bust'
      const anyWin = results.some(r => r.result === 'win' || r.result === 'blackjack');
      const allLose = results.every(r => r.result === 'lose' || r.result === 'bust');
      await updateUserWinStreak(user.discordId, anyWin && !allLose, req.guildId);
    }

    await wallet.save();

    // Remove duplicate transaction recording
    res.json({
      playerHands: gameState.playerHands,
      dealerHand: gameState.gameOver ? gameState.dealerHand : [gameState.dealerHand[0], { suit: '?', value: '?' }],
      currentHand: gameState.currentHand,
      gameOver: gameState.gameOver,
      results,
      newBalance: wallet.balance,
      canSplit: (
        gameState.playerHands[gameState.currentHand]?.length === 2 &&
        calculateHandValue([gameState.playerHands[gameState.currentHand][0]]) ===
          calculateHandValue([gameState.playerHands[gameState.currentHand][1]]) &&
        wallet.balance >= gameState.bets[gameState.currentHand]
      ),
      canDouble: (
        gameState.playerHands[gameState.currentHand]?.length === 2 &&
        wallet.balance >= gameState.bets[gameState.currentHand]
      )
    });

    // Send WebSocket updates
    const latestTransaction = await Transaction.findOne({ user: user._id, guildId: req.guildId }).sort({ timestamp: -1 });
    if (latestTransaction) {
      broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction: latestTransaction });
    }
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });
  } catch (error) {
    console.error('Error in blackjack:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Play roulette
router.post('/:discordId/roulette', validateBetAmount, async (req, res) => {
  try {
    const { bets } = req.body; // Array of bets: [{ type, number, amount }]
    const wallet = req.wallet;
    const user = req.user;

    if (!Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ message: 'No bets provided.' });
    }

    // Validate all bets
    let totalBet = 0;
    for (const bet of bets) {
      if (!bet.type || typeof bet.amount !== 'number' || bet.amount <= 0) {
        return res.status(400).json({ message: 'Invalid bet format.' });
      }
      if (bet.type === 'single' && (bet.number === null || bet.number === undefined || bet.number < 0 || bet.number > 36)) {
        return res.status(400).json({ message: 'Invalid number for single bet.' });
      }
      totalBet += bet.amount;
    }

    if (totalBet > wallet.balance) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // Spin the wheel once
    const result = Math.floor(Math.random() * 37);
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const isRed = redNumbers.includes(result);
    const isBlack = result !== 0 && !isRed;
    const color = result === 0 ? 'green' : isRed ? 'red' : 'black';

    // Process all bets
    let totalWinnings = 0;
    const betResults = [];
    for (const bet of bets) {
      let won = false;
      let betResult = ''; // This will store the *actual* winning bet type for calculating multiplier

      // Determine win based on bet type
      switch (bet.type) {
        case 'single':
          won = result === bet.number;
          betResult = 'single';
          break;
        case 'red':
          won = isRed;
          betResult = 'red';
          break;
        case 'black':
          won = isBlack;
          betResult = 'black';
          break;
        case 'even':
          won = result !== 0 && result % 2 === 0;
          betResult = 'even';
          break;
        case 'odd':
          won = result % 2 === 1;
          betResult = 'odd';
          break;
        case 'high':
          won = result >= 19 && result <= 36;
          betResult = 'high';
          break;
        case 'low':
          won = result >= 1 && result <= 18;
          betResult = 'low';
          break;
        case 'dozen1':
          won = result >= 1 && result <= 12;
          betResult = 'dozen1';
          break;
        case 'dozen2':
          won = result >= 13 && result <= 24;
          betResult = 'dozen2';
          break;
        case 'dozen3':
          won = result >= 25 && result <= 36;
          betResult = 'dozen3';
          break;
        case '1ST_COLUMN':
          won = result % 3 === 1 && result !== 0;
          betResult = '1ST_COLUMN';
          break;
        case '2ND_COLUMN':
          won = result % 3 === 2;
          betResult = '2ND_COLUMN';
          break;
        case '3RD_COLUMN':
          won = result % 3 === 0 && result !== 0;
          betResult = '3RD_COLUMN';
          break;
        case '1_TO_18':
            won = result >= 1 && result <= 18;
            betResult = '1_TO_18'; // Use the actual bet type for multiplier
            break;
        case '19_TO_36':
            won = result >= 19 && result <= 36;
            betResult = '19_TO_36'; // Use the actual bet type for multiplier
            break;
        case '0':
            won = result === 0;
            betResult = '0'; // Use the actual bet type for multiplier
            break;
        case '00': // For American roulette if implemented
            // Assuming result can also be '00' as a string if American roulette is fully supported
            won = String(result) === '00';
            betResult = '00'; // Use the actual bet type for multiplier
            break;
        // Handle complex bets (splits, streets, corners, six lines, etc.)
        default:
          const coveredNumbers = getNumbersCoveredByBet(bet.type);
          // Check if the winning result (as a number or string '00') is in the list of covered numbers
          won = coveredNumbers.some(coveredNum => String(coveredNum) === String(result));
          betResult = bet.type; // Use the bet type string for multiplier calculation
          break;
      }

      const multiplier = calculateMultiplier(betResult, result);
      const winnings = won ? bet.amount * multiplier : 0;
      totalWinnings += winnings;
      betResults.push({
        ...bet,
        won,
        winnings,
        payout: multiplier,
        guildId: req.guildId
      });
    }

    // Update wallet: deduct total bet, add total winnings
    const newBalance = await updateWalletBalance(
      wallet,
      totalBet,
      totalWinnings,
      'roulette',
      betResults.filter(b => b.won).map(b => `${b.type}${b.number !== undefined ? ` (${b.number})` : ''}`).join(', '),
      req.guildId
    );

    // Send WebSocket updates
    const latestTransaction = await Transaction.findOne({ user: user._id, guildId: req.guildId }).sort({ timestamp: -1 });
    if (latestTransaction) {
      broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction: latestTransaction });
    }
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: newBalance });

    // Update win streak: win if totalWinnings > 0
    await updateUserWinStreak(user.discordId, totalWinnings > 0, req.guildId);

    res.json({
      result,
      color,
      bets: betResults,
      totalWinnings,
      newBalance
    });
  } catch (error) {
    handleGamblingError(error, req, res, next);
  }
});

// Jackpot routes
router.get('/:discordId/jackpot', async (req, res) => {
  try {
    let jackpot = await Jackpot.findOne({ guildId: req.guildId });
    if (!jackpot) jackpot = new Jackpot({ guildId: req.guildId });
    res.json({
      currentAmount: jackpot.currentAmount,
      lastWinner: jackpot.lastWinner ? await User.findById(jackpot.lastWinner) : null,
      lastWinAmount: jackpot.lastWinAmount,
      lastWinTime: jackpot.lastWinTime
    });
  } catch (error) {
    console.error('Error fetching jackpot:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

router.post('/:discordId/jackpot/contribute', async (req, res) => {
  try {
    const { amount } = req.body;
    const wallet = req.wallet;
    const user = req.user;

    // Validate amount
    if (amount < 10) {
      return res.status(400).json({ message: 'Minimum contribution is 10 points.' });
    }

    // Check if user has enough balance
    if (wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // Update jackpot
    let jackpot = await Jackpot.findOne({ guildId: req.guildId });
    if (!jackpot) jackpot = new Jackpot({ guildId: req.guildId });
    jackpot.currentAmount += amount;
    jackpot.contributions.push({
      user: req.user._id,
      amount
    });
    await jackpot.save();

    // Update wallet
    wallet.balance -= amount;
    await wallet.save();

    // Record transaction
    const transaction = new Transaction({
      user: req.user._id,
      type: 'jackpot_contribution',
      amount: -amount,
      description: 'Contribution to jackpot',
      guildId: req.guildId
    });
    await transaction.save();

    // Send WebSocket updates
    broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });

    res.json({
      contribution: amount,
      newJackpotAmount: jackpot.currentAmount,
      newBalance: wallet.balance
    });
  } catch (error) {
    console.error('Error contributing to jackpot:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- Golden Ticket: Redeem for 10% of jackpot pool (7-day cooldown) ---
router.post('/:discordId/redeem-golden-ticket', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();
    // Check cooldown
    if (user.lastGoldenTicketRedemption && now - user.lastGoldenTicketRedemption < 7 * 24 * 60 * 60 * 1000) {
      const nextAvailable = new Date(user.lastGoldenTicketRedemption.getTime() + 7 * 24 * 60 * 60 * 1000);
      return res.status(429).json({ message: `You can redeem another golden ticket after ${nextAvailable.toLocaleString()}` });
    }
    // Check inventory for golden ticket
    user.inventory = user.inventory || [];
    const idx = user.inventory.findIndex(i => i.type === 'item' && i.name === 'Golden Ticket' && i.count > 0);
    if (idx === -1) {
      return res.status(400).json({ message: 'You do not have a Golden Ticket to redeem.' });
    }
    // Get jackpot
    let jackpot = await Jackpot.findOne({ guildId: req.guildId });
    if (!jackpot || jackpot.currentAmount <= 0) {
      return res.status(400).json({ message: 'The jackpot pool is empty. Try again later.' });
    }
    // Calculate 10% payout
    const payout = Math.floor(jackpot.currentAmount * 0.10);
    if (payout <= 0) {
      return res.status(400).json({ message: 'Jackpot pool is too small to redeem a Golden Ticket.' });
    }
    // Remove one golden ticket
    user.inventory[idx].count -= 1;
    if (user.inventory[idx].count === 0) user.inventory.splice(idx, 1);
    // Update wallet and jackpot
    wallet.balance += payout;
    jackpot.currentAmount -= payout;
    jackpot.lastWinner = user._id;
    jackpot.lastWinAmount = payout;
    jackpot.lastWinTime = now;
    await wallet.save();
    await user.save();
    await jackpot.save();
    // Set cooldown
    user.lastGoldenTicketRedemption = now;
    await user.save();
    // Log transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'jackpot',
      amount: payout,
      description: 'Redeemed Golden Ticket for 10% of jackpot pool',
      guildId: req.guildId
    });
    await transaction.save();
    broadcastToUser(user.discordId, { type: 'TRANSACTION', transaction });
    broadcastToUser(user.discordId, { type: 'BALANCE_UPDATE', balance: wallet.balance });
    res.json({ message: `You redeemed a Golden Ticket for ${payout.toLocaleString('en-US')} points!`, payout, newBalance: wallet.balance, jackpotPool: jackpot.currentAmount });
  } catch (error) {
    console.error('Error redeeming golden ticket:', error);
    res.status(500).json({ message: 'Server error during golden ticket redemption.' });
  }
});

// --- Golden Ticket: Get count ---
router.get('/:discordId/golden-tickets', async (req, res) => {
  try {
    const user = req.user;
    user.inventory = user.inventory || [];
    const ticket = user.inventory.find(i => i.type === 'item' && i.name === 'Golden Ticket');
    const count = ticket ? ticket.count : 0;
    res.json({ goldenTicketCount: count });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching golden ticket count.' });
  }
});

// Export only the router
module.exports = router; 