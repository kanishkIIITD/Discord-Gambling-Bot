const express = require('express');
const router = express.Router();
const { requireGuildId } = require('../middleware/auth');

// Apply requireGuildId to all routes
router.use(requireGuildId);

// Endpoint to get Discord commands
router.get('/discord-commands', async (req, res) => {
  try {
    // Updated command list with categories for filtering
    const commands = [
      // Wallet/Points
      { name: 'balance', description: 'Checks your current point balance.', category: 'Wallet' },
      { name: 'daily', description: 'Claim your daily point bonus.', category: 'Wallet' },
      { name: 'gift', description: 'Gift points to another user.', category: 'Wallet', options: [
        { name: 'user', description: 'The user to gift points to.', type: 6, required: true },
        { name: 'amount', description: 'The amount of points to gift.', type: 3, required: true },
      ] },
      { name: 'transactions', description: 'View your transaction history', category: 'Wallet', options: [
        { name: 'limit', description: 'Number of transactions to show (default: 5)', type: 4, required: false },
        { name: 'type', description: 'Filter transactions by type', type: 3, required: false, choices: [
              { name: 'All', value: 'all' },
              { name: 'Bets', value: 'bet' },
              { name: 'Daily Bonus', value: 'daily' },
              { name: 'Gifts', value: 'gift' },
        ] },
      ] },
      // Betting
      { name: 'createbet', description: 'Creates a new betting event.', category: 'Betting', options: [
        { name: 'description', description: 'A brief description of the bet.', type: 3, required: true },
        { name: 'options', description: 'Comma-separated list of possible outcomes (e.g., Yes, No, Maybe).', type: 3, required: true },
        { name: 'duration_minutes', description: 'Duration of the bet in minutes (optional).', type: 4, required: false },
      ] },
      { name: 'placebet', description: 'Places a bet on an active event.', category: 'Betting', options: [
        { name: 'bet_id', description: 'The bet you want to place a bet on.', type: 3, required: true },
        { name: 'option', description: 'The option you are betting on.', type: 3, required: true },
        { name: 'amount', description: 'The amount of points you are betting.', type: 3, required: true },
      ] },
      { name: 'resolvebet', description: 'Resolves a betting event and distributes winnings.', category: 'Admin', options: [
        { name: 'bet_id', description: 'The ID of the bet to resolve.', type: 3, required: true },
        { name: 'winning_option', description: 'The winning option of the bet.', type: 3, required: true },
      ] },
      { name: 'listbets', description: 'Lists all currently open betting events.', category: 'Betting' },
      { name: 'viewbet', description: 'Views a concise summary of a specific betting event.', category: 'Betting', options: [
        { name: 'bet_id', description: 'The ID of the bet to view.', type: 3, required: true },
      ] },
      { name: 'closebet', description: 'Closes betting for a specific event.', category: 'Admin', options: [
        { name: 'bet_id', description: 'The ID of the bet to close.', type: 3, required: true },
      ] },
      { name: 'cancelbet', description: 'Cancels a bet before any bets are placed.', category: 'Admin', options: [
        { name: 'bet_id', description: 'The ID of the bet to cancel.', type: 3, required: true },
      ] },
      { name: 'editbet', description: 'Edits a bet\'s description or options before any bets are placed.', category: 'Admin', options: [
        { name: 'bet_id', description: 'The ID of the bet to edit.', type: 3, required: true },
        { name: 'description', description: 'New description for the bet (optional).', type: 3, required: false },
        { name: 'options', description: 'New comma-separated list of options (optional).', type: 3, required: false },
        { name: 'duration_minutes', description: 'New duration in minutes (optional).', type: 4, required: false },
      ] },
      { name: 'extendbet', description: 'Extends the duration of an open bet.', category: 'Admin', options: [
        { name: 'bet_id', description: 'The ID of the bet to extend.', type: 3, required: true },
        { name: 'additional_minutes', description: 'Number of minutes to extend the bet by.', type: 4, required: true },
      ] },
      { name: 'betinfo', description: 'Shows detailed information and statistics about a specific bet.', category: 'Betting', options: [
        { name: 'bet_id', description: 'The ID of the bet to view.', type: 3, required: true },
      ] },
      { name: 'unresolvedbets', description: 'Shows all bets that are unresolved (status: open or closed).', category: 'Betting' },
      { name: 'refund', description: 'Refund all bets for a specific bet.', category: 'Betting', options: [
        { name: 'bet_id', description: 'The bet to refund.', type: 3, required: true, autocomplete: true },
      ] },
      // Gambling
      { name: 'coinflip', description: 'Flip a coin and bet on the outcome', category: 'Gambling', options: [
        { name: 'choice', description: 'Your choice (heads or tails)', type: 3, required: true, choices: [ { name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' } ] },
        { name: 'amount', description: 'Amount of points to bet', type: 3, required: true },
      ] },
      { name: 'dice', description: 'Roll dice and bet on the outcome', category: 'Gambling', options: [
        { name: 'bet_type', description: 'Type of bet to place', type: 3, required: true, choices: [ { name: 'High (4-6)', value: 'high' }, { name: 'Low (1-3)', value: 'low' }, { name: 'Even', value: 'even' }, { name: 'Odd', value: 'odd' }, { name: 'Specific Number', value: 'specific' } ] },
        { name: 'amount', description: 'Amount to bet', type: 3, required: true },
        { name: 'number', description: 'Number to bet on (1-6)', type: 4, required: false },
      ] },
      { name: 'slots', description: 'Play the slot machine', category: 'Gambling', options: [
        { name: 'amount', description: 'Amount to bet', type: 3, required: true },
      ] },
      { name: 'blackjack', description: 'Play blackjack', category: 'Gambling', options: [
        { name: 'amount', description: 'Amount to bet', type: 3, required: true },
      ] },
      { name: 'roulette', description: 'Play roulette', category: 'Gambling', options: [
        { name: 'bet_type', description: 'Type of bet to place', type: 3, required: true, choices: [ { name: 'Single Number (requires number option)', value: 'single' }, { name: 'Red', value: 'red' }, { name: 'Black', value: 'black' }, { name: 'Even', value: 'even' }, { name: 'Odd', value: 'odd' }, { name: '1-18', value: 'low' }, { name: '19-36', value: 'high' }, { name: '1st Dozen (1-12)', value: 'dozen1' }, { name: '2nd Dozen (13-24)', value: 'dozen2' }, { name: '3rd Dozen (25-36)', value: 'dozen3' }, { name: '1st Column', value: '1ST_COLUMN' }, { name: '2nd Column', value: '2ND_COLUMN' }, { name: '3rd Column', value: '3RD_COLUMN' }, { name: 'Split 1-2', value: '1-2' }, { name: 'Split 8-9', value: '8-9' }, { name: 'Split 35-36', value: '35-36' }, { name: 'Street 1-2-3', value: '1-2-3' }, { name: 'Street 10-11-12', value: '10-11-12' }, { name: 'Street 34-35-36', value: '34-35-36' }, { name: 'Corner 1-2-4-5', value: '1-2-4-5' }, { name: 'Corner 8-9-11-12', value: '8-9-11-12' }, { name: 'Corner 31-32-34-35', value: '31-32-34-35' }, { name: 'Six Line 1-6', value: '1-2-3-4-5-6' }, { name: 'Basket 0-1-2', value: '0-1-2' }, { name: 'Basket 0-2-3', value: '0-2-3' } ] },
        { name: 'amount', description: 'Amount to bet', type: 3, required: true },
        { name: 'number', description: 'Number to bet on (0-36)', type: 4, required: false, min_value: 0, max_value: 36 },
      ] },
      { name: 'jackpot', description: 'View or contribute to the jackpot', category: 'Gambling', options: [
        { name: 'action', description: 'Action to perform', type: 3, required: true, choices: [ { name: 'View Jackpot', value: 'view' }, { name: 'Contribute', value: 'contribute' } ] },
        { name: 'amount', description: 'Amount to contribute', type: 4, required: false },
      ] },
      { name: 'golden-tickets', description: 'Check how many golden tickets you have!', category: 'Gambling' },
      { name: 'redeem-golden-ticket', description: 'Redeem a golden ticket for 10% of the jackpot pool (7-day cooldown).', category: 'Gambling' },
      // Stats/Profile/Utility
      { name: 'profile', description: 'View your detailed profile, including balance, betting, and gambling stats.', category: 'Utility', options: [
        { name: 'user', description: 'The user to view (defaults to yourself)', type: 6, required: false },
      ] },
      { name: 'stats', description: 'Shows your full betting and gambling statistics, including win streaks, jackpots, gifts, and more.', category: 'Utility' },
      { name: 'leaderboard', description: 'Shows the top users by balance.', category: 'Utility', options: [
        { name: 'limit', description: 'Number of users to show (default: 5).', type: 4, required: false },
      ] },
      { name: 'help', description: 'Shows a help menu with all available commands.', category: 'Utility', options: [
        { name: 'section', description: 'The section of help to show', type: 3, required: false, choices: [
          { name: 'Betting', value: 'betting' },
          { name: 'Gambling', value: 'gambling' },
          { name: 'Wallet', value: 'wallet' },
          { name: 'Utility', value: 'utility' },
          { name: 'Fun & Collection', value: 'fun' },
          { name: 'Duel', value: 'duel' },
          { name: 'Buffs', value: 'buffs' },
          { name: 'Moderation', value: 'moderation' },
        ] },
      ] },
      { name: 'collection-list', description: 'View all possible fish and animal names in the collection.', category: 'Utility' },
      { name: 'cooldowns', description: 'View all your current cooldowns', category: 'Utility' },
      // Moderation
      { name: 'timeout', description: 'Timeout a user for a specified duration (costs 100k * duration + 2% of balance, 5 min cooldown)', category: 'Moderation', options: [
        { name: 'user', description: 'The user to timeout', type: 6, required: true },
        { name: 'duration', description: 'Duration in minutes (1-5)', type: 4, required: true, min_value: 1, max_value: 5 },
        { name: 'reason', description: 'Reason for the timeout (optional)', type: 3, required: false },
      ] },
      { name: 'setlogchannel', description: 'Set the channel where moderation logs will be sent', category: 'Moderation', options: [
        { name: 'channel', description: 'The channel to send logs to', type: 7, required: true },
      ] },
      { name: 'changerole', description: 'Change a user\'s role (Superadmin only)', category: 'Moderation', options: [
        { name: 'user', description: 'The user whose role to change', type: 6, required: true },
        { name: 'role', description: 'The new role to assign', type: 3, required: true, choices: [
          { name: 'User', value: 'user' },
          { name: 'Admin', value: 'admin' },
          { name: 'Superadmin', value: 'superadmin' },
        ] },
      ] },
      { name: 'jailed', description: 'View all currently jailed users in this server.', category: 'Moderation' },
      // Fun & Collection
      { name: 'meowbark', description: 'Perform a meow or bark to earn points (5 min cooldown, max 100,000 points).', category: 'Fun', options: [
        { name: 'amount', description: 'Amount of points to earn (max 100,000)', type: 4, required: true, max_value: 100000 },
      ] },
      { name: 'question', description: 'Answer a question about a cat for a chance to win or lose points!', category: 'Fun' },
      { name: 'steal', description: 'Attempt to steal points from another user (30% success rate, 2-hour cooldown)', category: 'Fun', options: [
        { name: 'do', description: 'Attempt to steal points from another user', type: 1, options: [
          { name: 'target', description: 'The user to steal from', type: 6, required: true },
        ] },
        { name: 'stats', description: 'View your steal statistics', type: 1 },
      ] },
    ];

    const existingNames = new Set(commands.map(cmd => cmd.name));
    const missingCommands = [
      { name: 'bail', description: 'Bail a jailed user out of jail (for a fee)', category: 'Fun', options: [
        { name: 'user', description: 'The user to bail out', type: 6, required: false },
        { name: 'all', description: 'Bail all jailed users in the server', type: 5, required: false },
      ] },
      { name: 'beg', description: 'Beg for coins and see what happens!', category: 'Fun' },
      { name: 'collection', description: 'View your fishing and hunting collection!', category: 'Fun' },
      { name: 'collection-leaderboard', description: 'View the top collectors by collection value!', category: 'Fun', options: [
        { name: 'limit', description: 'Number of users to show (default: 5)', type: 4, required: false },
      ] },
      { name: 'crime', description: 'Attempt a crime for a chance to win or lose points, or get jailed!', category: 'Fun', options: [
        { name: 'do', description: 'Attempt a crime!', type: 1 },
        { name: 'stats', description: 'View your crime stats', type: 1 },
      ] },
      { name: 'duel', description: 'Challenge another user to a duel for points!', category: 'Fun', options: [
        { name: 'challenge', description: 'Challenge a user to a duel!', type: 1, options: [
          { name: 'user', description: 'The user to duel', type: 6, required: true },
          { name: 'amount', description: 'Amount to stake in the duel', type: 4, required: true },
        ] },
        { name: 'stats', description: 'View your duel win/loss record', type: 1 },
      ] },
      { name: 'fish', description: 'Go fishing for a chance to catch something valuable!', category: 'Fun' },
      { name: 'hunt', description: 'Go hunting for a chance to catch a rare animal!', category: 'Fun' },
      { name: 'mysterybox', description: 'Open a mystery box for random rewards!', category: 'Fun', options: [
        { name: 'type', description: 'The type of mystery box to open', type: 3, required: true, choices: [
          { name: 'Basic Box (Free once per day)', value: 'basic' },
          { name: 'Premium Box (1,000,000 points)', value: 'premium' },
          { name: 'Ultimate Box (10,000,000 points)', value: 'ultimate' },
        ] },
        { name: 'count', description: 'How many boxes to open (max 20, only for premium/ultimate)', type: 4, required: false, min_value: 1, max_value: 20 },
      ] },
      { name: 'sell', description: 'Sell items from your collection for points!', category: 'Fun', options: [
        { name: 'action', description: 'What to sell', type: 3, required: true, choices: [
          { name: 'Specific Item', value: 'specific' },
          { name: 'All Fish', value: 'all_fish' },
          { name: 'All Animals', value: 'all_animals' },
          { name: 'All Items', value: 'all_items' },
          { name: 'All Common', value: 'all_common' },
          { name: 'All Uncommon', value: 'all_uncommon' },
          { name: 'All Rare+', value: 'all_rare_plus' },
          { name: 'Everything', value: 'everything' },
        ] },
        { name: 'type', description: 'Type of item (fish, animal, or item) - only for specific items', type: 3, required: false, choices: [
          { name: 'Fish', value: 'fish' },
          { name: 'Animal', value: 'animal' },
          { name: 'Item', value: 'item' },
        ] },
        { name: 'name', description: 'Name of the item to sell - only for specific items', type: 3, required: false },
        { name: 'count', description: 'How many to sell - only for specific items', type: 4, required: false, min_value: 1 },
      ] },
      { name: 'trade', description: 'Trade items with another user!', category: 'Fun', options: [
        { name: 'action', description: 'What to trade', type: 3, required: true, choices: [
          { name: 'Specific Item', value: 'specific' },
          { name: 'All Fish', value: 'all_fish' },
          { name: 'All Animals', value: 'all_animals' },
          { name: 'All Items', value: 'all_items' },
          { name: 'All Common', value: 'all_common' },
          { name: 'All Uncommon', value: 'all_uncommon' },
          { name: 'All Rare+', value: 'all_rare_plus' },
          { name: 'Everything', value: 'everything' },
        ] },
        { name: 'target', description: 'User to trade with', type: 6, required: true },
        { name: 'type', description: 'Type of item (fish, animal, or item) - only for specific items', type: 3, required: false, choices: [
          { name: 'Fish', value: 'fish' },
          { name: 'Animal', value: 'animal' },
          { name: 'Item', value: 'item' },
        ] },
        { name: 'name', description: 'Name of the item to trade - only for specific items', type: 3, required: false },
        { name: 'count', description: 'How many to trade - only for specific items', type: 4, required: false, min_value: 1 },
      ] },
      { name: 'work', description: 'Work a job for a chance to earn points and rare bonuses!', category: 'Fun', options: [
        { name: 'do', description: 'Work a job!', type: 1, options: [
          { name: 'job', description: 'Choose a job or leave blank for random', type: 3, required: false, choices: [
            { name: 'Streamer', value: 'streamer' },
            { name: 'Pizza Delivery', value: 'pizza delivery' },
            { name: 'Mercenary', value: 'mercenary' },
            { name: 'Taxi Driver', value: 'taxi driver' },
            { name: 'Street Musician', value: 'street musician' },
            { name: 'Dog Walker', value: 'dog walker' },
            { name: 'Barista', value: 'barista' },
            { name: 'Construction Worker', value: 'construction worker' },
            { name: 'Social Media Influencer', value: 'social media influencer' },
            { name: 'Private Investigator', value: 'private investigator' },
            { name: 'Collector', value: 'collector' },
          ] },
        ] },
        { name: 'stats', description: 'View your work/job stats', type: 1 },
      ] },
    ];
    for (const cmd of missingCommands) {
      if (!existingNames.has(cmd.name)) {
        commands.push(cmd);
      }
    }

    res.json(commands);
  } catch (error) {
    console.error('Error fetching Discord commands:', error);
    res.status(500).json({ message: 'Server error fetching commands.' });
  }
});

/**
 * Get TCG API status and health
 */
router.get('/tcg-api-status', async (req, res) => {
  try {
    const tcgApi = require('../utils/tcgApi');
    const stats = tcgApi.getCacheStats();
    
    res.json({
      status: 'success',
      data: {
        cacheStats: stats,
        circuitBreakerState: stats.circuitBreaker.state,
        failureCount: stats.circuitBreaker.failureCount,
        isHealthy: stats.circuitBreaker.state === 'CLOSED',
        lastFailure: stats.circuitBreaker.lastFailureTime ? new Date(stats.circuitBreaker.lastFailureTime).toISOString() : null,
        nextAttempt: stats.circuitBreaker.nextAttemptTime ? new Date(stats.circuitBreaker.nextAttemptTime).toISOString() : null
      }
    });
  } catch (error) {
    console.error('[MiscRoutes] Error getting TCG API status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get TCG API status'
    });
  }
});

/**
 * Reset TCG API circuit breaker (admin only)
 */
router.post('/tcg-api-reset', async (req, res) => {
  try {
    const tcgApi = require('../utils/tcgApi');
    tcgApi.resetCircuitBreaker();
    
    res.json({
      status: 'success',
      message: 'TCG API circuit breaker reset successfully'
    });
  } catch (error) {
    console.error('[MiscRoutes] Error resetting TCG API circuit breaker:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset TCG API circuit breaker'
    });
  }
});

module.exports = router; 