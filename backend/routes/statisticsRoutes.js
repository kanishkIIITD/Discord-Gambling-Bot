const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { requireGuildId } = require('../middleware/auth');
const mongoose = require('mongoose');

// Helper function to create proper date range
const createDateRange = (startDateStr, endDateStr) => {
  let startDate = null;
  let endDate = null;
  
  if (startDateStr) {
    // Create start of day in local timezone
    const start = new Date(startDateStr);
    startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  }
  
  if (endDateStr) {
    // Create end of day in local timezone (23:59:59.999)
    const end = new Date(endDateStr);
    endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  }
  
  return { startDate, endDate };
};

// Middleware to find user by discordId
router.use('/:discordId', requireGuildId, async (req, res, next) => {
  try {
    let user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user && req.guildId && req.guildId.startsWith('archived_')) {
      // fallback: try main guild
      const mainGuildId = req.guildId.replace(/^archived_/, '');
      user = await User.findOne({ discordId: req.params.discordId, guildId: mainGuildId });
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in user middleware:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 1. Balance History Graph - Get all transactions for a user to track balance changes
router.get('/:discordId/balance-history', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = { user: user._id, guildId: req.guildId };
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get all transactions sorted by timestamp (no limit)
    const transactions = await Transaction.find(query)
      .sort({ timestamp: 1 }); // Sort by oldest first to calculate running balance

    // Calculate running balance
    let balance = 0;
    const balanceHistory = transactions.map(tx => {
      balance += tx.amount;
      return {
        timestamp: tx.timestamp,
        amount: tx.amount,
        balance: balance,
        type: tx.type,
        description: tx.description
      };
    });

    res.json({ balanceHistory });
  } catch (error) {
    console.error('Error fetching balance history:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});


// 2. Gambling Performance Graph - Get gambling transactions for specific games
router.get('/:discordId/gambling-performance', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = {
      user: user._id,
      type: { $in: ['bet', 'win'] },
      description: /coinflip|dice|slots|blackjack|roulette/i,
      guildId: req.guildId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get gambling transactions for specific games
    const gamblingTransactions = await Transaction.find(query);

    // Calculate total won and lost
    let totalWon = 0;
    let totalLost = 0;

    gamblingTransactions.forEach(tx => {
      if (tx.type === 'win' && tx.amount > 0) {
        totalWon += tx.amount;
      } else if (tx.type === 'bet' && tx.amount < 0) {
        totalLost += Math.abs(tx.amount);
      }
    });

    res.json({
      totalWon,
      totalLost,
      transactions: gamblingTransactions
    });
  } catch (error) {
    console.error('Error fetching gambling performance:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 3. Game Type Distribution Graph - Get count of games played by type
router.get('/:discordId/game-distribution', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = {
      user: user._id,
      type: 'bet',
      description: /coinflip|dice|slots|blackjack|roulette/i,
      guildId: req.guildId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get gambling transactions for specific games
    const gamblingTransactions = await Transaction.find(query);

    // Count games by type
    const gameCounts = {
      coinflip: 0,
      dice: 0,
      slots: 0,
      blackjack: 0,
      roulette: 0
    };

    gamblingTransactions.forEach(tx => {
      if (tx.description) {
        const match = tx.description.match(/(coinflip|dice|slots|blackjack|roulette)/i);
        if (match) {
          const gameType = match[1].toLowerCase();
          gameCounts[gameType] = (gameCounts[gameType] || 0) + 1;
        }
      }
    });

    res.json({ gameCounts });
  } catch (error) {
    console.error('Error fetching game distribution:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 4. Transaction Type Analysis Graph - Get all transactions grouped by type
router.get('/:discordId/transaction-analysis', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = { user: user._id, guildId: req.guildId };
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get all transactions (no limit)
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 });

    // Group transactions by type
    const transactionsByType = {};
    transactions.forEach(tx => {
      if (!transactionsByType[tx.type]) {
        transactionsByType[tx.type] = [];
      }
      transactionsByType[tx.type].push({
        timestamp: tx.timestamp,
        amount: Math.abs(tx.amount), // Use absolute value for consistent comparison
        description: tx.description
      });
    });

    res.json({ transactionsByType });
  } catch (error) {
    console.error('Error fetching transaction analysis:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 5. Game Comparison Matrix Graph - Get win rates for different games
router.get('/:discordId/game-comparison', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = {
      user: user._id,
      type: { $in: ['bet', 'win'] },
      description: /coinflip|dice|slots|blackjack|roulette/i,
      guildId: req.guildId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get gambling transactions for specific games
    const gamblingTransactions = await Transaction.find(query);

    // Calculate win rates by game type
    const gameStats = {
      coinflip: { wins: 0, plays: 0 },
      dice: { wins: 0, plays: 0 },
      slots: { wins: 0, plays: 0 },
      blackjack: { wins: 0, plays: 0 },
      roulette: { wins: 0, plays: 0 }
    };

    // First pass: count bets (plays)
    gamblingTransactions.forEach(tx => {
      if (tx.type === 'bet' && tx.description) {
        const match = tx.description.match(/(coinflip|dice|slots|blackjack|roulette)/i);
        if (match) {
          const gameType = match[1].toLowerCase();
          if (gameStats[gameType]) {
            gameStats[gameType].plays++;
          }
        }
      }
    });

    // Second pass: count wins
    gamblingTransactions.forEach(tx => {
      if (tx.type === 'win' && tx.description) {
        const match = tx.description.match(/(coinflip|dice|slots|blackjack|roulette)/i);
        if (match) {
          const gameType = match[1].toLowerCase();
          if (gameStats[gameType]) {
            gameStats[gameType].wins++;
          }
        }
      }
    });

    // Calculate win rates
    Object.keys(gameStats).forEach(game => {
      const stats = gameStats[game];
      stats.winRate = stats.plays > 0 ? ((stats.wins / stats.plays) * 100).toFixed(1) : '0.0';
    });

    res.json({ gameStats });
  } catch (error) {
    console.error('Error fetching game comparison data:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 6. Time of Day Heatmap - Show when the user is most active
router.get('/:discordId/time-of-day-heatmap', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = {
      user: user._id,
      guildId: req.guildId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get all transactions
    const transactions = await Transaction.find(query);

    // Initialize heatmap data structure (day of week vs hour of day)
    const heatmapData = Array(7).fill().map(() => Array(24).fill(0));
    
    // Process transactions
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp);
      const dayOfWeek = date.getDay(); // 0-6 (Sunday-Saturday)
      const hourOfDay = date.getHours(); // 0-23
      
      // Increment the count for this day/hour combination
      heatmapData[dayOfWeek][hourOfDay]++;
    });

    // Format data for visualization
    const formattedData = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        formattedData.push([day, hour, heatmapData[day][hour]]);
      }
    }

    res.json({
      heatmapData: formattedData,
      dayLabels: days,
      hourLabels: Array.from({ length: 24 }, (_, i) => i)
    });
  } catch (error) {
    console.error('Error fetching time of day heatmap data:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 7. Daily Profit & Loss - Show profit/loss fluctuations over time
router.get('/:discordId/daily-profit-loss', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = {
      user: user._id,
      type: { $in: ['bet', 'win'] },
      description: /coinflip|dice|slots|blackjack|roulette/i,
      guildId: req.guildId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get gambling transactions
    const transactions = await Transaction.find(query);

    // Group transactions by date
    const dailyProfitLoss = {};
    
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!dailyProfitLoss[date]) {
        dailyProfitLoss[date] = { won: 0, lost: 0 };
      }
      
      if (tx.type === 'win' && tx.amount > 0) {
        dailyProfitLoss[date].won += tx.amount;
      } else if (tx.type === 'bet' && tx.amount < 0) {
        dailyProfitLoss[date].lost += Math.abs(tx.amount);
      }
    });

    // Convert to array format for chart
    const dates = Object.keys(dailyProfitLoss).sort();
    const profitData = dates.map(date => ({
      date,
      won: dailyProfitLoss[date].won,
      lost: dailyProfitLoss[date].lost,
      net: dailyProfitLoss[date].won - dailyProfitLoss[date].lost
    }));

    res.json({ profitData });
  } catch (error) {
    console.error('Error fetching daily profit/loss data:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 8. Top Games by Net Profit - Show which games the user performs best in
router.get('/:discordId/top-games-by-profit', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = {
      user: user._id,
      type: { $in: ['bet', 'win'] },
      description: /coinflip|dice|slots|blackjack|roulette/i,
      guildId: req.guildId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get gambling transactions
    const transactions = await Transaction.find(query);
    // console.log(`Found ${transactions.length} gambling transactions for user ${user._id}`);

    // Calculate net profit by game
    const gameProfit = {
      coinflip: { winnings: 0, losses: 0 },
      dice: { winnings: 0, losses: 0 },
      slots: { winnings: 0, losses: 0 },
      blackjack: { winnings: 0, losses: 0 },
      roulette: { winnings: 0, losses: 0 }
    };
    
    transactions.forEach(tx => {
      if (tx.description) {
        const match = tx.description.match(/(coinflip|dice|slots|blackjack|roulette)/i);
        if (match) {
          const gameType = match[1].toLowerCase();
          
          if (tx.type === 'win' && tx.amount > 0) {
            gameProfit[gameType].winnings += tx.amount;
            // console.log(`Added win: ${tx.amount} to ${gameType}, new total: ${gameProfit[gameType].winnings}`);
          } else if (tx.type === 'bet' && tx.amount < 0) {
            gameProfit[gameType].losses += Math.abs(tx.amount);
            // console.log(`Added loss: ${Math.abs(tx.amount)} to ${gameType}, new total: ${gameProfit[gameType].losses}`);
          } else {
            // console.log(`Skipped transaction: type=${tx.type}, amount=${tx.amount}, description=${tx.description}`); 
          }
        } else {
          // console.log(`No game match in description: ${tx.description}`);
        }
      } else {
        // console.log(`Transaction has no description: ${tx._id}`);
      }
    });

    // Calculate net profit and format for chart
    const profitByGame = Object.keys(gameProfit).map(game => ({
      game,
      winnings: gameProfit[game].winnings,
      losses: gameProfit[game].losses,
      netProfit: gameProfit[game].winnings - gameProfit[game].losses
    }));

    // Sort by net profit (highest to lowest)
    profitByGame.sort((a, b) => b.netProfit - a.netProfit);

    // console.log('Final profitByGame data:', JSON.stringify(profitByGame));
    res.json({ profitByGame });
  } catch (error) {
    console.error('Error fetching top games by profit:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 9. Risk Score Trend - Show how risky the user's gameplay is becoming
router.get('/:discordId/risk-score-trend', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = {
      user: user._id,
      type: 'bet',
      guildId: req.guildId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get all bet transactions
    const betTransactions = await Transaction.find(query).sort({ timestamp: 1 });

    // Get all transactions for balance calculation
    const allTransactions = await Transaction.find({
      user: user._id,
      guildId: req.guildId,
      ...(query.timestamp ? { timestamp: query.timestamp } : {})
    }).sort({ timestamp: 1 });

    // Calculate running balance and risk scores
    let balance = 0;
    const balanceMap = new Map(); // Maps timestamp to balance

    // First pass: calculate balance at each point in time
    allTransactions.forEach(tx => {
      balance += tx.amount;
      balanceMap.set(tx.timestamp.getTime(), balance);
    });

    // Second pass: calculate risk scores for bet transactions
    const riskScores = [];
    let previousDate = null;
    let dailyBets = [];
    let dailyBetAmounts = [];
    let dailyBalances = [];

    betTransactions.forEach(tx => {
      const txDate = new Date(tx.timestamp);
      const dateStr = txDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Find the closest balance before this transaction
      const txTime = txDate.getTime();
      let closestBalance = 0;
      
      // Find the most recent balance before this transaction
      for (const [time, bal] of balanceMap.entries()) {
        if (time <= txTime) {
          closestBalance = bal;
        } else {
          break;
        }
      }
      
      // Calculate risk score (bet amount as percentage of balance)
      const betAmount = Math.abs(tx.amount);
      const riskScore = closestBalance > 0 ? (betAmount / closestBalance) : 0;
      
      // Group by day for the chart
      if (dateStr !== previousDate) {
        if (previousDate && dailyBets.length > 0) {
          // Calculate average risk score for the previous day
          const avgRiskScore = dailyBets.reduce((sum, score) => sum + score, 0) / dailyBets.length;
          const avgBetAmount = dailyBetAmounts.reduce((sum, amount) => sum + amount, 0) / dailyBetAmounts.length;
          const avgBalance = dailyBalances.reduce((sum, balance) => sum + balance, 0) / dailyBalances.length;
          riskScores.push({ 
            date: previousDate, 
            riskScore: avgRiskScore,
            avgBetAmount: avgBetAmount,
            avgBalance: avgBalance
          });
        }
        dailyBets = [riskScore];
        dailyBetAmounts = [betAmount];
        dailyBalances = [closestBalance];
        previousDate = dateStr;
      } else {
        dailyBets.push(riskScore);
        dailyBetAmounts.push(betAmount);
        dailyBalances.push(closestBalance);
      }
    });

    // Add the last day
    if (previousDate && dailyBets.length > 0) {
      const avgRiskScore = dailyBets.reduce((sum, score) => sum + score, 0) / dailyBets.length;
      const avgBetAmount = dailyBetAmounts.reduce((sum, amount) => sum + amount, 0) / dailyBetAmounts.length;
      const avgBalance = dailyBalances.reduce((sum, balance) => sum + balance, 0) / dailyBalances.length;
      riskScores.push({ 
        date: previousDate, 
        riskScore: avgRiskScore,
        avgBetAmount: avgBetAmount,
        avgBalance: avgBalance
      });
    }

    res.json({ riskScores });
  } catch (error) {
    console.error('Error fetching risk score trend:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 10. Favorite Game Over Time - Show user preferences shifting
router.get('/:discordId/favorite-game-trend', async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = createDateRange(req.query.startDate, req.query.endDate);

    // Build query with date range if provided
    const query = {
      user: user._id,
      type: 'bet',
      description: /coinflip|dice|slots|blackjack|roulette/i,
      guildId: req.guildId
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    // Get all bet transactions
    const transactions = await Transaction.find(query).sort({ timestamp: 1 });

    // Group by day and count games
    const dailyGameCounts = {};
    const games = ['coinflip', 'dice', 'slots', 'blackjack', 'roulette'];
    
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp);
      // Format as YYYY-MM-DD
      const dayKey = date.toISOString().split('T')[0];
      
      if (!dailyGameCounts[dayKey]) {
        dailyGameCounts[dayKey] = {};
        games.forEach(game => {
          dailyGameCounts[dayKey][game] = 0;
        });
      }
      
      if (tx.description) {
        const match = tx.description.match(/(coinflip|dice|slots|blackjack|roulette)/i);
        if (match) {
          const gameType = match[1].toLowerCase();
          dailyGameCounts[dayKey][gameType]++;
        }
      }
    });

    // Find favorite game for each day
    const favoriteGameTrend = [];
    
    Object.keys(dailyGameCounts).sort().forEach(day => {
      const gameCounts = dailyGameCounts[day];
      let favoriteGame = null;
      let maxCount = 0;
      
      Object.keys(gameCounts).forEach(game => {
        if (gameCounts[game] > maxCount) {
          maxCount = gameCounts[game];
          favoriteGame = game;
        }
      });
      
      if (favoriteGame) {
        favoriteGameTrend.push({
          week: day, // Keep 'week' as the property name for backward compatibility
          favoriteGame,
          playCount: maxCount,
          allGames: gameCounts
        });
      }
    });

    res.json({ favoriteGameTrend });
  } catch (error) {
    console.error('Error fetching favorite game trend:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;