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
    description: `Bet on ${gameType}`,
    guildId: wallet.guildId
  });
  await betTransaction.save();

  wallet.balance -= betAmount;

  if (winnings > 0) {
    wallet.balance += winnings;
    const winTransaction = new Transaction({
      user: wallet.user,
      type: 'win',
      amount: winnings,
      description: `Win from ${gameType}${winDescription ? `: ${winDescription}` : ''}`,
      guildId: wallet.guildId
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
async function updateUserWinStreak(discordId, didWin, guildId) {
  if (!discordId) return;
  const user = await User.findOne({ discordId, guildId });
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

// Punishment system for enhanced steal command
const PUNISHMENT_LEVELS = {
  light: {
    fine: 0.05,           // 5% of balance
    cooldownExtension: 30, // 30 minutes
    itemLoss: 1,          // 1 item
    duration: 60          // 1 hour effects
  },
  medium: {
    fine: 0.10,           // 10% of balance
    cooldownExtension: 60, // 1 hour
    itemLoss: 2,          // 2 items
    duration: 120         // 2 hours effects
  },
  heavy: {
    fine: 0.15,           // 15% of balance
    cooldownExtension: 120, // 2 hours
    itemLoss: 3,          // 3 items
    duration: 240         // 4 hours effects
  }
};

const STEAL_CONFIG = {
  points: {
    successRate: 0.30,
    cooldownHours: 2,
    baseChance: { jail: 0.5, fine: 0.3, cooldown: 0.2 }, // Removed bounty: 0.1
    jailTime: { min: 30, max: 60 }
  },
  fish: {
    successRate: 0.25,
    cooldownHours: 3,
    baseChance: { jail: 0.4, itemLoss: 0.3, cooldown: 0.3 }, // Removed marked: 0.15
    jailTime: { min: 45, max: 90 }
  },
  animal: {
    successRate: 0.20,
    cooldownHours: 3,
    baseChance: { jail: 0.5, itemLoss: 0.25, cooldown: 0.25 }, // Removed penalty: 0.15
    jailTime: { min: 60, max: 120 }
  },
  item: {
    successRate: 0.15,
    cooldownHours: 4,
    baseChance: { jail: 0.5, itemLoss: 0.25, cooldown: 0.25 }, // Removed ban: 0.15
    jailTime: { min: 90, max: 180 }
  }
};

function selectPunishment(stealType, failureCount, attemptedValue) {
  const config = STEAL_CONFIG[stealType];
  if (!config) return { type: 'jail', severity: 'medium' };

  let chances = { ...config.baseChance };
  
  // Adjust based on failure count
  if (failureCount > 2) {
    chances.jail = Math.min(chances.jail + 0.2, 0.8);
    chances.fine = Math.max(chances.fine - 0.1, 0.1);
    chances.cooldown = Math.max(chances.cooldown - 0.05, 0.1);
    chances.itemLoss = Math.max(chances.itemLoss - 0.05, 0.1);
  }

  // Adjust based on target value
  if (attemptedValue > 100000) {
    chances.jail = Math.min(chances.jail + 0.1, 0.8);
    chances.fine = Math.max(chances.fine - 0.05, 0.1);
  }

  // Normalize chances
  const total = Object.values(chances).reduce((sum, chance) => sum + chance, 0);
  Object.keys(chances).forEach(key => {
    chances[key] = chances[key] / total;
  });

  // Select punishment based on weighted random
  const random = Math.random();
  let cumulative = 0;
  
  for (const [type, chance] of Object.entries(chances)) {
    cumulative += chance;
    if (random <= cumulative) {
      return { type, severity: failureCount > 2 ? 'heavy' : 'medium' };
    }
  }

  return { type: 'jail', severity: 'medium' };
}

function applyPunishment(user, punishment, stealType, targetDiscordId, wallet) {
  const level = PUNISHMENT_LEVELS[punishment.severity];
  const now = new Date();

  switch (punishment.type) {
    case 'jail':
      const jailTime = STEAL_CONFIG[stealType].jailTime;
      const jailMinutes = Math.floor(Math.random() * (jailTime.max - jailTime.min + 1)) + jailTime.min;
      user.jailedUntil = new Date(now.getTime() + jailMinutes * 60000);
      break;

    case 'fine':
      const fineAmount = Math.floor(wallet.balance * level.fine);
      wallet.balance = Math.max(0, wallet.balance - fineAmount);
      break;

    case 'itemLoss':
      const itemsToLose = Math.min(level.itemLoss, user.inventory.length);
      if (itemsToLose > 0) {
        const shuffled = [...user.inventory].sort(() => Math.random() - 0.5);
        const lostItems = shuffled.slice(0, itemsToLose);
        
        lostItems.forEach(lostItem => {
          const itemIndex = user.inventory.findIndex(item => 
            item.type === lostItem.type && item.name === lostItem.name
          );
          if (itemIndex !== -1) {
            if (user.inventory[itemIndex].count > 1) {
              user.inventory[itemIndex].count--;
            } else {
              user.inventory.splice(itemIndex, 1);
            }
          }
        });
      }
      break;

    case 'cooldown':
      const extensionMs = level.cooldownExtension * 60000;
      if (user.fishCooldown) user.fishCooldown = new Date(user.fishCooldown.getTime() + extensionMs);
      if (user.huntCooldown) user.huntCooldown = new Date(user.huntCooldown.getTime() + extensionMs);
      if (user.workCooldown) user.workCooldown = new Date(user.workCooldown.getTime() + extensionMs);
      if (user.begCooldown) user.begCooldown = new Date(user.begCooldown.getTime() + extensionMs);
      if (user.crimeCooldown) user.crimeCooldown = new Date(user.crimeCooldown.getTime() + extensionMs);
      break;

    // TODO: Implement these punishment types later
    // case 'bounty':
    // case 'marked':
    // case 'penalty':
    // case 'ban':
    //   break;
  }

  // Add active punishment
  user.activePunishments.push({
    type: punishment.type,
    description: getPunishmentDescription(punishment, stealType),
    expiresAt: new Date(now.getTime() + level.duration * 60000),
    severity: punishment.severity,
    stealType,
    targetDiscordId
  });

  // Update failure tracking
  user.stealFailureCount = (user.stealFailureCount || 0) + 1;
  user.lastStealFailure = now;
}

function getPunishmentDescription(punishment, stealType) {
  const descriptions = {
    jail: `Jailed for attempting to steal ${stealType}`,
    fine: `Fined for failed ${stealType} theft`,
    itemLoss: `Lost items due to failed ${stealType} theft`,
    cooldown: `Extended cooldowns for failed ${stealType} theft`,
    // TODO: Implement these punishment types later
    // bounty: `Bounty placed on you for failed ${stealType} theft (not implemented)`,
    // marked: `Marked as thief for failed ${stealType} theft (not implemented)`,
    // penalty: `Penalty applied for failed ${stealType} theft (not implemented)`,
    // ban: `Temporarily banned from certain activities for failed ${stealType} theft (not implemented)`
  };
  return descriptions[punishment.type] || `Punished for failed ${stealType} theft`;
}

function cleanActivePunishments(user) {
  const now = new Date();
  user.activePunishments = user.activePunishments.filter(p => p.expiresAt > now);
}

function getStealCooldownField(stealType) {
  const cooldownMap = {
    points: 'stealPointsCooldown',
    fish: 'stealFishCooldown',
    animal: 'stealAnimalCooldown',
    item: 'stealItemCooldown'
  };
  return cooldownMap[stealType] || 'stealPointsCooldown'; // Default to points cooldown
}

function getStealCooldownHours(stealType) {
  return STEAL_CONFIG[stealType]?.cooldownHours || 2;
}

function getStealSuccessRate(stealType) {
  return STEAL_CONFIG[stealType]?.successRate || 0.30;
}

function calculateBailAmount(targetBalance, stealPercentage, stealType, failureCount = 0, userBalance = 0) {
  const attemptedValue = Math.floor(targetBalance * stealPercentage);
  
  // Base bail amount
  const baseBail = 25000;
  
  // Value-based component (50% of attempted steal value)
  const valueBasedBail = Math.floor(attemptedValue * 0.5);
  
  // Maximum cap (5% of target's balance)
  const maxBail = Math.floor(targetBalance * 0.05);
  
  // Steal type modifier (items are slightly cheaper to bail out)
  const stealTypeMultipliers = {
    points: 1.0,
    fish: 0.8,
    animal: 0.8,
    item: 0.8
  };
  const typeMultiplier = stealTypeMultipliers[stealType] || 1.0;
  
  // Failure count scaling (20% increase per failure)
  const failureMultiplier = 1 + (failureCount * 0.2);
  
  // Calculate initial bail amount
  let bailAmount = Math.min(
    Math.max(baseBail, valueBasedBail), // At least baseBail, at most value-based
    maxBail // But never more than 5% of target's balance
  );
  
  // Apply type and failure multipliers
  bailAmount = Math.floor(bailAmount * typeMultiplier * failureMultiplier);
  
  // If user can't afford bail, reduce it but return additional jail time
  let additionalJailTime = 0;
  if (userBalance > 0 && userBalance < bailAmount) {
    const affordableBail = Math.floor(userBalance * 0.8); // Use 80% of their balance
    additionalJailTime = Math.ceil((bailAmount - affordableBail) / 1000); // 1 minute per 1000 points
    bailAmount = affordableBail;
  }
  
  return {
    bailAmount: Math.max(bailAmount, 1000), // Minimum 1000 points
    additionalJailTime
  };
}

module.exports = {
  updateWalletBalance,
  createGamblingResponse,
  calculateMultiplier,
  getNumbersCoveredByBet,
  updateUserWinStreak,
  // New punishment system exports
  selectPunishment,
  applyPunishment,
  cleanActivePunishments,
  getStealCooldownField,
  getStealCooldownHours,
  getStealSuccessRate,
  calculateBailAmount,
  PUNISHMENT_LEVELS,
  STEAL_CONFIG
}; 