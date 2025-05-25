const Transaction = require('../models/Transaction');
const User = require('../models/User');

const ROULETTE_BET_NUMBERS_MAP = {
    // Single numbers are checked directly, not in map
    '0': [0],
    '00': ['00'], // For American roulette if implemented
    
    // Outside bets
    'RED': [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
    'BLACK': [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
    'EVEN': [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],
    'ODD': [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35],
    '1_TO_18': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    '19_TO_36': [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],

    // Dozens
    '1ST_DOZEN': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    '2ND_DOZEN': [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    '3RD_DOZEN': [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],

    // Columns
    '1ST_COLUMN': [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
    '2ND_COLUMN': [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    '3RD_COLUMN': [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    
    // Complex bets (Splits, Streets, Corners, Six Lines) - will be generated dynamically if not explicitly listed here
    // Example: '1-2': [1, 2],
    // Example: '1-2-3': [1, 2, 3],
    // Example: '1-2-4-5': [1, 2, 4, 5],
    // Example: '1-2-3-4-5-6': [1, 2, 3, 4, 5, 6],
    // American roulette specific
    '00-0': [0, '00'],
    '0-1-2': [0, 1, 2],
    '0-2-3': [0, 2, 3],
    '00-2-3': ['00', 2, 3],
    '00-0-1-2-3': ['00', 0, 1, 2, 3],
};

const getNumbersCoveredByBet = (betType) => {
    // Direct lookup in map
    if (ROULETTE_BET_NUMBERS_MAP[betType]) {
        return ROULETTE_BET_NUMBERS_MAP[betType];
    }

    // Handle single number bets (0-36)
    const numberResult = Number(betType);
    if (!isNaN(numberResult) && numberResult >= 0 && numberResult <= 36) {
        return [numberResult];
    }

    // Handle hyphenated complex bets (splits, streets, corners, six lines)
    if (typeof betType === 'string' && betType.includes('-')) {
        // Split and convert to numbers. Filter out any non-numeric parts if necessary,
        // though frontend/library should provide clean hyphenated numbers.
        const coveredNumbers = betType.split('-').map(numStr => {
            const num = Number(numStr);
            return isNaN(num) ? numStr : num; // Keep original string if not a number (e.g., '00')
        });
         // Filter out any non-numeric entries if you only expect numbers in the result array
        // For now, keep both numbers and '00' string for flexibility.
        return coveredNumbers;
    }

    // Return empty array for unknown bet types
    return [];
};

const updateWalletBalance = async (wallet, betAmount, winnings, gameType, winDescription) => {
  // Always deduct the bet amount
  const betTransaction = new Transaction({
    user: wallet.user,
    type: 'bet',
    amount: -betAmount,
    description: `Bet on ${gameType}`
  });
  await betTransaction.save();

  wallet.balance -= betAmount;

  if (winnings > 0) {
    wallet.balance += winnings;
    const winTransaction = new Transaction({
      user: wallet.user,
      type: 'win',
      amount: winnings,
      description: `Win from ${gameType}${winDescription ? `: ${winDescription}` : ''}`
    });
    await winTransaction.save();
  }

  await wallet.save();
  return wallet.balance;
};

const createGamblingResponse = (data, won, winnings, newBalance) => {
  return {
    ...data,
    won,
    winnings,
    newBalance
  };
};

const calculateMultiplier = (betType, result) => {
  const multipliers = {
    coinflip: 2,
    dice: {
      specific: 5,
      high: 2,
      low: 2,
      even: 2,
      odd: 2
    },
    roulette: {
      single: 35,
      red: 2,
      black: 2,
      even: 2,
      odd: 2,
      high: 2,
      low: 2,
      dozen1: 3,
      dozen2: 3,
      dozen3: 3,
      '1ST_COLUMN': 3,
      '2ND_COLUMN': 3,
      '3RD_COLUMN': 3,
      '1_TO_18': 2,
      '19_TO_36': 2,
      '00-0': Math.floor(36 / 2),
      '0-1-2': Math.floor(36 / 3),
      '0-2-3': Math.floor(36 / 3),
      '00-2-3': Math.floor(36 / 3),
      '00-0-1-2-3': Math.floor(36 / 5),
      // Add other specific complex bet multipliers if they don't fit the general pattern
      // e.g., '0-1': 17,
    }
  };

  // Check for direct multiplier match if the value is a number
  if (typeof multipliers.roulette[betType] === 'number') {
      return multipliers.roulette[betType];
  }

  // Handle single number bets (0-36) - checked by 'single' key
  // Handle hyphenated complex bets based on the number of covered numbers
  if (typeof betType === 'string' && betType.includes('-')) {
    const coveredNumbersCount = betType.split('-').length;
    // General calculation for splits (2), streets (3), corners (4), six lines (6)
    // Note: The library's calculation `Math.floor(36 / v.length)` matches casino payouts.
    return Math.floor(36 / coveredNumbersCount);
  }

  // Fallback for other game types or unknown roulette types
  return multipliers[betType]?.[result] || multipliers[betType] || 0;
};

/**
 * Update a user's win streaks after a game result.
 * @param {string} discordId - The user's Discord ID
 * @param {boolean} didWin - Whether the user won the game
 */
async function updateUserWinStreak(discordId, didWin) {
  if (!discordId) return;
  const user = await User.findOne({ discordId });
  if (!user) return;
  if (didWin) {
    user.currentWinStreak = (user.currentWinStreak || 0) + 1;
    if (user.currentWinStreak > (user.maxWinStreak || 0)) {
      user.maxWinStreak = user.currentWinStreak;
    }
  } else {
    user.currentWinStreak = 0;
  }
  await user.save();
}

module.exports = {
  updateWalletBalance,
  createGamblingResponse,
  calculateMultiplier,
  getNumbersCoveredByBet,
  updateUserWinStreak
}; 