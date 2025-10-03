// Centralized aura rules and helper utilities
const User = require('../models/User');

// Configurable aura rule constants
const AURA_RULES = {
  gambling: {
    winSmall: 1,
    winBig: 2,
    jackpot: 3,
    loss: -1,
    bigWinThresholdMultiplier: 10, // multiplier >= 10x counts as big win
  },
  betting: {
    winner: 2,
    loser: -1,
  },
  steal: {
    success: 2,
    fail: -2,
    jackpotLike: 3, // e.g., entire balance stolen
    victimOnSuccess: -1,
    victimOnJackpot: -2,
  },
};

/**
 * Compute aura delta for a gambling outcome
 * @param {Object} params
 * @param {string} params.game - coinflip|dice|slots|blackjack|roulette
 * @param {boolean} params.won
 * @param {number} [params.multiplier] - Effective payout multiplier when available
 * @param {boolean} [params.isJackpot]
 * @param {number} [params.winnings]
 * @returns {number}
 */
function getAuraDeltaForGambling({ game, won, multiplier, isJackpot, winnings }) {
  const { winSmall, winBig, jackpot, loss, bigWinThresholdMultiplier } = AURA_RULES.gambling;

  if (!won) return loss;
  if (isJackpot) return jackpot;

  // Prefer multiplier when present, otherwise consider winnings size in a coarse way
  if (typeof multiplier === 'number' && multiplier >= bigWinThresholdMultiplier) return winBig;
  return winSmall;
}

/**
 * Increment a user's aura safely for a given guild
 * @param {string} discordId
 * @param {string} guildId
 * @param {number} amount
 */
async function incrementUserAura(discordId, guildId, amount) {
  if (!discordId || !guildId || !amount) return;
  try {
    await User.updateOne({ discordId, guildId }, { $inc: { aura: amount } }).exec();
  } catch (e) {
    console.error('[Aura] Failed to update aura', { discordId, guildId, amount, error: e?.message || e });
  }
}

module.exports = {
  AURA_RULES,
  getAuraDeltaForGambling,
  incrementUserAura,
};


