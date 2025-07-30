// Shared timer management for Pokémon spawns
// This module manages both manual and auto despawn timers to prevent conflicts

// Map: channelId -> { timeout, messageId, type }
const allDespawnTimers = new Map();

/**
 * Clear all despawn timers for a specific channel
 * @param {string} channelId - The Discord channel ID
 */
function clearAllDespawnTimers(channelId) {
  if (allDespawnTimers.has(channelId)) {
    const timer = allDespawnTimers.get(channelId);
    console.log(`[DespawnTimerManager] Clearing ${timer.type} despawn timer for channel ${channelId}`);
    clearTimeout(timer.timeout);
    allDespawnTimers.delete(channelId);
  }
}

/**
 * Set a new despawn timer for a channel
 * @param {string} channelId - The Discord channel ID
 * @param {number} timeout - The timeout function
 * @param {string} messageId - The Discord message ID
 * @param {string} type - The type of spawn ('manual' or 'auto')
 */
function setDespawnTimer(channelId, timeout, messageId, type) {
  // Clear any existing timer first
  clearAllDespawnTimers(channelId);
  
  // Set new timer
  allDespawnTimers.set(channelId, { timeout, messageId, type });
  console.log(`[DespawnTimerManager] Set ${type} despawn timer for channel ${channelId}, messageId: ${messageId}`);
}

/**
 * Get the current despawn timer for a channel
 * @param {string} channelId - The Discord channel ID
 * @returns {Object|null} The timer object or null if none exists
 */
function getDespawnTimer(channelId) {
  return allDespawnTimers.get(channelId) || null;
}

/**
 * Check if a channel has an active despawn timer
 * @param {string} channelId - The Discord channel ID
 * @returns {boolean} True if a timer exists
 */
function hasDespawnTimer(channelId) {
  return allDespawnTimers.has(channelId);
}

/**
 * Clear a specific despawn timer by message ID
 * @param {string} channelId - The Discord channel ID
 * @param {string} messageId - The Discord message ID
 */
function clearDespawnTimerByMessageId(channelId, messageId) {
  const timer = allDespawnTimers.get(channelId);
  if (timer && timer.messageId === messageId) {
    console.log(`[DespawnTimerManager] Clearing ${timer.type} despawn timer for channel ${channelId}, messageId: ${messageId}`);
    clearTimeout(timer.timeout);
    allDespawnTimers.delete(channelId);
  }
}

/**
 * Get all active timers (for debugging)
 * @returns {Map} All active despawn timers
 */
function getAllTimers() {
  return allDespawnTimers;
}

module.exports = {
  clearAllDespawnTimers,
  setDespawnTimer,
  getDespawnTimer,
  hasDespawnTimer,
  clearDespawnTimerByMessageId,
  getAllTimers
}; 