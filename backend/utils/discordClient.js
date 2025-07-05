const { Client, GatewayIntentBits } = require('discord.js');
const NodeCache = require('node-cache');

// Initialize the Discord client once
let client = null;

// Create a cache with TTL of 10 minutes (600 seconds) for better performance
// Increased from 5 minutes to reduce API calls
const guildsCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// Track frequently accessed users for cache warming
const userAccessCount = new Map();
const CACHE_WARM_THRESHOLD = 3; // Warm cache after 3 accesses

/**
 * Rate limiting utility for Discord API calls
 * @param {Array} items - Array of items to process
 * @param {Function} processor - Function to process each item
 * @param {number} concurrency - Number of concurrent operations (default: 5)
 * @param {number} delay - Delay between batches in ms (default: 100)
 */
const processWithRateLimit = async (items, processor, concurrency = 5, delay = 100) => {
  const results = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(processor);
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches to respect rate limits
    if (i + concurrency < items.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
};

/**
 * Track user access and warm cache for frequent users
 * @param {string} userId - The Discord user ID
 */
const trackUserAccess = (userId) => {
  const currentCount = userAccessCount.get(userId) || 0;
  userAccessCount.set(userId, currentCount + 1);
  
  // If user is frequently accessed, extend their cache duration
  if (currentCount >= CACHE_WARM_THRESHOLD) {
    const cacheKey = `user_guilds_${userId}`;
    const cachedGuilds = guildsCache.get(cacheKey);
    if (cachedGuilds) {
      // Extend cache TTL for frequent users
      guildsCache.set(cacheKey, cachedGuilds, 1800); // 30 minutes for frequent users
    }
  }
};

/**
 * Initialize the Discord client if not already initialized
 * @returns {Client} The Discord client instance
 */
const getClient = () => {
  if (!client) {
    // Check if Discord token is valid (not the placeholder value)
    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'REPLACE_WITH_VALID_DISCORD_TOKEN') {
      console.error('Invalid or missing Discord token. Please update your .env file with a valid token.');
      console.error('See DISCORD_TOKEN_SETUP.md for instructions on how to set up a valid token.');
      return null;
    }
    
    client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    // Login to Discord
    // console.log('Attempting to login with Discord token...');
    client.login(process.env.DISCORD_TOKEN).then(() => {
      // console.log('Successfully logged in to Discord');
    }).catch(err => {
      console.error('Failed to login to Discord:', err);
      console.error('Please check your Discord token and make sure it is valid.');
      console.error('See DISCORD_TOKEN_SETUP.md for instructions on how to set up a valid token.');
      client = null;
    });

    client.on('error', (error) => {
      console.error('Discord client error:', error);
    });
  }
  return client;
};

/**
 * Get the guilds that a user has access to
 * @param {string} userId - The Discord user ID
 * @returns {Promise<Array>} - Array of guild objects the user has access to
 */
const getUserGuilds = async (userId) => {
  // Track user access for cache optimization
  trackUserAccess(userId);
  
  // Check cache first
  const cacheKey = `user_guilds_${userId}`;
  const cachedGuilds = guildsCache.get(cacheKey);
  
  // console.log(`[getUserGuilds] Checking for user ${userId}, cache hit: ${!!cachedGuilds}`);
  
  if (cachedGuilds) {
    // console.log(`[getUserGuilds] Returning ${cachedGuilds.length} guilds from cache for user ${userId}`);
    return cachedGuilds;
  }

  try {
    // console.log(`[getUserGuilds] Cache miss for user ${userId}, fetching from Discord API`);
    const discordClient = getClient();
    
    // If client is null (token invalid or missing), return empty array
    if (!discordClient) {
      console.warn('[getUserGuilds] Discord client is null. Returning empty guilds array.');
      return [];
    }
    
    // Ensure client is ready
    if (!discordClient.isReady()) {
      // console.log('[getUserGuilds] Discord client not ready, waiting for ready event');
      await new Promise(resolve => {
        const readyListener = () => {
          discordClient.removeListener('ready', readyListener);
          // console.log('[getUserGuilds] Discord client ready event received');
          resolve();
        };
        discordClient.on('ready', readyListener);
        
        // If already ready, resolve immediately
        if (discordClient.isReady()) {
          // console.log('[getUserGuilds] Discord client already ready');
          resolve();
        }
      });
    }

    // Get all guilds the bot is in
    const botGuilds = discordClient.guilds.cache;
    // console.log(`[getUserGuilds] Bot is in ${botGuilds.size} guilds:`, Array.from(botGuilds.keys()));
    
    // OPTIMIZATION: Use rate-limited parallel processing
    // Process guilds in batches to avoid hitting Discord's rate limits
    const guildsArray = Array.from(botGuilds.values());
    
    const results = await processWithRateLimit(
      guildsArray,
      async (guild) => {
        try {
          // console.log(`[getUserGuilds] Checking if user ${userId} is in guild ${guild.id} (${guild.name})`);
          const member = await guild.members.fetch(userId);
          // console.log(`[getUserGuilds] User ${userId} found in guild ${guild.id} (${guild.name})`);
          return {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            // Add any other guild properties you need
          };
        } catch (error) {
          // console.log(`[getUserGuilds] Error fetching member ${userId} from guild ${guild.id}: ${error.message}`);
          return null; // Return null for guilds where user is not a member
        }
      },
      5, // Process 5 guilds at a time
      100 // 100ms delay between batches
    );
    
    // Filter out null results (guilds where user is not a member) and extract values
    const userGuilds = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    // Cache the results with appropriate TTL based on user access frequency
    const accessCount = userAccessCount.get(userId) || 0;
    const cacheTTL = accessCount >= CACHE_WARM_THRESHOLD ? 1800 : 600; // 30 min vs 10 min
    guildsCache.set(cacheKey, userGuilds, cacheTTL);
    
    return userGuilds;
  } catch (error) {
    console.error('Error getting user guilds:', error);
    return [];
  }
};

/**
 * Clear the cached guilds for a user
 * @param {string} userId - The Discord user ID
 */
const clearUserGuildsCache = (userId) => {
  const cacheKey = `user_guilds_${userId}`;
  guildsCache.del(cacheKey);
  userAccessCount.delete(userId); // Also clear access tracking
};

const cache = new NodeCache({ stdTTL: 3600 });

module.exports = {
  getClient,
  getUserGuilds,
  clearUserGuildsCache,
  cache,
};