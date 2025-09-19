/**
 * Utility functions for handling timeouts
 */

// Constants
const MIN_DURATION = 1; // minutes
const MAX_DURATION = 5; // minutes
const BASE_COST_PER_MINUTE = 500000; // points (500k per minute - increased from 100k)
const BALANCE_PERCENTAGE = 0.10; // 10% of balance - increased from 2%
const COOLDOWN_MINUTES = 5; // 5 minutes cooldown
const UNTIMEOUT_COOLDOWN_MINUTES = 5; // Separate untimeout cooldown
const UNTIMEOUT_COST_MULTIPLIER = 10; // Untimeout is 10x more expensive than timeout
const MAX_TIMEOUT_STACK = 15; // Maximum total timeout duration in minutes
const TIMEOUT_COOLDOWN_PROTECTION = 10; // 10 minutes protection after timeout expires

/**
 * Calculate the cost of a timeout based on duration and user's balance
 * @param {number} duration - Timeout duration in minutes
 * @param {number} balance - User's current balance
 * @returns {number} Total cost in points
 */
const calculateTimeoutCost = (duration, balance) => {
  const baseCost = BASE_COST_PER_MINUTE * duration;
  const balanceCost = Math.floor(balance * BALANCE_PERCENTAGE);
  return baseCost + balanceCost;
};

/**
 * Check if a timeout duration is valid
 * @param {number} duration - Timeout duration in minutes
 * @returns {boolean} Whether the duration is valid
 */
const isValidTimeoutDuration = (duration) => {
  return Number.isInteger(duration) && duration >= MIN_DURATION && duration <= MAX_DURATION;
};

/**
 * Check if a user is on timeout cooldown
 * @param {Date} lastTimeoutAt - Timestamp of last timeout
 * @returns {boolean} Whether the user is on cooldown
 */
const isOnTimeoutCooldown = (lastTimeoutAt) => {
  if (!lastTimeoutAt) return false;
  const cooldownTime = COOLDOWN_MINUTES * 60 * 1000; // Convert minutes to milliseconds
  return Date.now() - new Date(lastTimeoutAt).getTime() < cooldownTime;
};

/**
 * Get remaining cooldown time
 * @param {Date} lastTimeoutAt - Timestamp of last timeout
 * @returns {{minutes: number, seconds: number}} Remaining cooldown time
 */
const getRemainingCooldown = (lastTimeoutAt) => {
  if (!lastTimeoutAt) return { minutes: 0, seconds: 0 };
  const cooldownTime = COOLDOWN_MINUTES * 60 * 1000; // Convert minutes to milliseconds
  const timeElapsed = Date.now() - new Date(lastTimeoutAt).getTime();
  const remainingTime = Math.max(0, cooldownTime - timeElapsed);
  const minutes = Math.floor(remainingTime / 60000);
  const seconds = Math.floor((remainingTime % 60000) / 1000);
  return { minutes, seconds };
};

/**
 * Check if a user is protected from being timed out (cooldown protection)
 * @param {Date} timeoutCooldownUntil - When the user's timeout cooldown protection ends
 * @returns {boolean} Whether the user is protected from timeouts
 */
const isOnTimeoutCooldownProtection = (timeoutCooldownUntil) => {
  if (!timeoutCooldownUntil) return false;
  return new Date() < timeoutCooldownUntil;
};

/**
 * Get remaining timeout cooldown protection time
 * @param {Date} timeoutCooldownUntil - When the user's timeout cooldown protection ends
 * @returns {Object} Object with minutes and seconds remaining
 */
const getRemainingTimeoutCooldownProtection = (timeoutCooldownUntil) => {
  if (!timeoutCooldownUntil) return { minutes: 0, seconds: 0 };
  
  const now = new Date();
  const timeRemaining = Math.max(0, timeoutCooldownUntil - now);
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return { minutes, seconds };
};

/**
 * Check if adding a timeout duration would exceed the maximum stack limit
 * @param {number} currentDuration - Current timeout duration in minutes
 * @param {number} additionalDuration - Additional timeout duration to add
 * @returns {boolean} Whether adding the duration would exceed the limit
 */
const wouldExceedStackLimit = (currentDuration, additionalDuration) => {
  return (currentDuration + additionalDuration) > MAX_TIMEOUT_STACK;
};

module.exports = {
  calculateTimeoutCost,
  isValidTimeoutDuration,
  isOnTimeoutCooldown,
  getRemainingCooldown,
  isOnTimeoutCooldownProtection,
  getRemainingTimeoutCooldownProtection,
  wouldExceedStackLimit,
  BASE_COST_PER_MINUTE,
  BALANCE_PERCENTAGE,
  MAX_TIMEOUT_STACK,
  TIMEOUT_COOLDOWN_PROTECTION,
  UNTIMEOUT_COOLDOWN_MINUTES,
  UNTIMEOUT_COST_MULTIPLIER
}; 