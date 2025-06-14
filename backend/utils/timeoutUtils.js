/**
 * Utility functions for handling timeouts
 */

// Constants
const MIN_DURATION = 1; // minutes
const MAX_DURATION = 5; // minutes
const BASE_COST_PER_MINUTE = 10000; // points
const BALANCE_PERCENTAGE = 0.05; // 5% of balance
const COOLDOWN_MINUTES = 5;

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
  const cooldownTime = 15 * 60 * 1000; // 15 minutes in milliseconds
  return Date.now() - new Date(lastTimeoutAt).getTime() < cooldownTime;
};

/**
 * Get remaining cooldown time
 * @param {Date} lastTimeoutAt - Timestamp of last timeout
 * @returns {{minutes: number, seconds: number}} Remaining cooldown time
 */
const getRemainingCooldown = (lastTimeoutAt) => {
  if (!lastTimeoutAt) return { minutes: 0, seconds: 0 };
  const cooldownTime = 15 * 60 * 1000; // 15 minutes in milliseconds
  const timeElapsed = Date.now() - new Date(lastTimeoutAt).getTime();
  const remainingTime = Math.max(0, cooldownTime - timeElapsed);
  const minutes = Math.floor(remainingTime / 60000);
  const seconds = Math.floor((remainingTime % 60000) / 1000);
  return { minutes, seconds };
};

module.exports = {
  calculateTimeoutCost,
  isValidTimeoutDuration,
  isOnTimeoutCooldown,
  getRemainingCooldown,
  BASE_COST_PER_MINUTE,
  BALANCE_PERCENTAGE
}; 