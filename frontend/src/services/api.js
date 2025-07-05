import axios from './axiosConfig';

const API_URL = process.env.REACT_APP_API_URL;

// Fallback Guild ID (only used if no guild is selected in context)
const FALLBACK_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID || 'YOUR_MAIN_GUILD_ID';

// Helper to inject guildId into params/body/headers
// This now accepts a specific guildId parameter that overrides the default
const withGuild = (config = {}, guildId = null) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  return {
    ...config,
    params: { ...(config.params || {}), guildId: currentGuildId },
    headers: { ...(config.headers || {}), 'x-guild-id': currentGuildId }
  };
};

// User and Wallet APIs
export const getUserProfile = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/profile`, withGuild());
  return response.data;
};

export const getWalletBalance = async (discordId, guildId) => {
  const response = await axios.get(
    `${API_URL}/api/users/${discordId}/wallet`,
    withGuild({ params: { guildId } }, guildId)
  );
  return response.data;
};

export const getJackpotPool = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/gambling/${discordId}/jackpot`, withGuild());
  return response.data;
};

export const getTransactionHistory = async (discordId, page = 1, limit = 20) => {
  try {
    const response = await axios.get(`${API_URL}/api/users/${discordId}/transactions`, withGuild({
      params: { limit: Math.min(limit, 500), type: 'all', page }, // Limit to max 500 items
    }));
    return response.data;
  } catch (error) {
    // console.error('Error fetching transaction history:', error);
    throw error;
  }
};

// User Stats API
export const getUserStats = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/stats`, withGuild());
  return response.data;
};

// Betting APIs
export const getActiveBets = async (guildId = null) => {
  const response = await axios.get(`${API_URL}/api/bets/open`, withGuild({}, guildId));
  return response.data;
};

export const getUpcomingBets = async (guildId = null) => {
  const response = await axios.get(`${API_URL}/api/bets/upcoming`, withGuild({}, guildId));
  return response.data;
};

export const getBetDetails = async (betId, guildId = null) => {
  const response = await axios.get(`${API_URL}/api/bets/${betId}`, withGuild({}, guildId));
  return response.data;
};

export const placeBet = async (betId, bettorDiscordId, option, amount, guildId = null) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.post(
    `${API_URL}/api/bets/${betId}/place`,
    { bettorDiscordId, amount, option, guildId: currentGuildId },
    withGuild({}, currentGuildId)
  );
  return response.data;
};

// Add this new function to fetch placed bets for a specific bet
export const getPlacedBetsForBet = async (betId, page = 1, limit = 20, guildId = null) => {
  const response = await axios.get(`${API_URL}/api/bets/${betId}/placed`, withGuild({ params: { page, limit } }, guildId));
  return response.data;
};

// Leaderboard API
export const getLeaderboard = async (discordId, limit = 10) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/leaderboard`, withGuild({ params: { limit } }));
  return response.data;
};

// Misc API
export const getDiscordCommands = async () => {
  const response = await axios.get(`${API_URL}/api/misc/discord-commands`, withGuild());
  return response.data;
};

// Preferences API
export const getUserPreferences = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/preferences`, withGuild());
  return response.data;
};

export const updateUserPreferences = async (discordId, preferences) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.put(`${API_URL}/api/users/${discordId}/preferences`, { ...preferences, guildId: currentGuildId }, withGuild());
  return response.data;
};

// Get user's accessible guilds - this endpoint doesn't require a guild ID
export const getUserGuilds = async (discordId, retryCount = 0) => {
  try {
    // console.log(`[API] Fetching guilds for user ${discordId}${retryCount > 0 ? ` (retry ${retryCount}/3)` : ''}`);
    // console.log(`[API] API_URL: ${API_URL}`);
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[API] No authentication token found');
      throw new Error('No authentication token found');
    }
    // console.log('[API] Token exists:', true);
    
    // For this specific endpoint, we don't want to include the guild ID in the headers
    // as we're fetching all guilds the user has access to
    const config = {
      headers: {
        'x-guild-id': null, // Explicitly set to null to ensure it's not included
        'Authorization': `Bearer ${token}`
      },
      // Add timeout to prevent hanging requests
      timeout: 8000 // 8 second timeout
    };
    
    // console.log(`[API] Making request to: ${API_URL}/api/users/${discordId}/guilds`);
    const response = await axios.get(`${API_URL}/api/users/${discordId}/guilds`, config);
    
    // console.log(`[API] Received ${response.data.guilds ? response.data.guilds.length : 0} guilds for user ${discordId}`);
    
    if (!response.data.guilds || response.data.guilds.length === 0) {
      console.warn('[API] No guilds returned for user. This might indicate an issue with Discord permissions or bot configuration.');
      // Return an empty array instead of null to prevent errors
      return [];
    }
    
    return response.data.guilds;
  } catch (error) {
    console.error('[API] Error fetching user guilds:', error.message);
    
    if (error.response) {
      console.error('[API] Error status:', error.response.status);
      console.error('[API] Error details:', error.response.data);
    } else if (error.request) {
      console.error('[API] No response received, request was:', error.request);
    }
    
    // Implement retry logic for network errors or timeouts
    if ((error.code === 'ECONNABORTED' || !error.response) && retryCount < 3) {
      // console.log(`[API] Retrying guild fetch (${retryCount + 1}/3)...`);
      return new Promise(resolve => {
        // Exponential backoff
        setTimeout(() => {
          resolve(getUserGuilds(discordId, retryCount + 1));
        }, 1000 * Math.pow(2, retryCount));
      });
    }
    
    // Return an empty array instead of throwing an error
    // This allows the application to continue functioning with the fallback guild
    console.warn('[API] Returning empty guilds array due to error');
    return [];
  }
};

// Fetch all users (for superadmin)
export const getAllUsers = async (page = 1, limit = 10) => {
  const response = await axios.get(`${API_URL}/api/users`, withGuild({ params: { page, limit } }));
  return response.data;
}; 

// Admin/Superadmin Bet Management APIs
export const closeBet = async (betId, creatorDiscordId, guildId = null) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.put(`${API_URL}/api/bets/${betId}/close`, { creatorDiscordId, guildId: currentGuildId }, withGuild({}, currentGuildId));
  return response.data;
};

export const resolveBet = async (betId, winningOption, creatorDiscordId, guildId = null) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.put(`${API_URL}/api/bets/${betId}/resolve`, { winningOption, creatorDiscordId, guildId: currentGuildId }, withGuild({}, currentGuildId));
  return response.data;
};

export const cancelBet = async (betId, creatorDiscordId, guildId = null) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.delete(`${API_URL}/api/bets/${betId}`, withGuild({ data: { creatorDiscordId, guildId: currentGuildId } }, currentGuildId));
  return response.data;
};

export const editBet = async (betId, creatorDiscordId, description, options, durationMinutes, guildId = null) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.put(`${API_URL}/api/bets/${betId}/edit`, { creatorDiscordId, description, options, durationMinutes, guildId: currentGuildId }, withGuild({}, currentGuildId));
  return response.data;
};

export const extendBet = async (betId, creatorDiscordId, additionalMinutes, guildId = null) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.put(`${API_URL}/api/bets/${betId}/extend`, { creatorDiscordId, additionalMinutes, guildId: currentGuildId }, withGuild({}, currentGuildId));
  return response.data;
};

// Fetch all placed bets for a user (My Bets)
export const getMyPlacedBets = async (discordId, page = 1, limit = 20, resultFilter = 'all', statusFilter = 'all', sortBy = 'placedAt', sortOrder = 'desc', guildId = null) => {
  try {
    const response = await axios.get(`${API_URL}/api/users/${discordId}/bets`, withGuild({
      params: { 
        limit: Math.min(limit, 500), 
        page,
        result: resultFilter,
        status: statusFilter,
        sortBy,
        sortOrder
      }, // Limit to max 500 items
    }, guildId));
    return response.data;
  } catch (error) {
    // console.error('Error fetching my placed bets:', error);
    throw error;
  }
};

// Update username for a user
export const updateUsername = async (discordId, username) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.post(`${API_URL}/api/users/${discordId}/update-username`, { username, guildId: currentGuildId }, withGuild());
  return response.data;
};

// Refund a bet (admin/superadmin only)
export const refundBet = async (betId, creatorDiscordId, guildId = null) => {
  // Get the current guild ID from localStorage or use the fallback
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.post(`${API_URL}/api/bets/${betId}/refund`, { creatorDiscordId, guildId: currentGuildId }, withGuild({}, currentGuildId));
  return response.data;
};

export const getClosedBets = async (guildId = null) => {
  const response = await axios.get(`${API_URL}/api/bets/closed`, withGuild({}, guildId));
  return response.data;
};

// Assuming an endpoint like this exists for Biggest Wins Leaderboard
export const getBiggestWinsLeaderboard = async (page = 1, limit = 10) => {
  try {
    const response = await axios.get(`${API_URL}/leaderboards/biggest-wins`, withGuild({
      params: { limit: Math.min(limit, 500), page }, // Limit to max 500 items
    }));
    return response.data;
  } catch (error) {
    // console.error('Error fetching biggest wins leaderboard:', error);
    throw error;
  }
};

// Balance History Graph
export const getBalanceHistory = async (discordId, limit = 500, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/balance-history`, 
    withGuild({ params: { limit, startDate, endDate } }, currentGuildId));
  return response.data;
};

// Gambling Performance Graph
export const getGamblingPerformance = async (discordId, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/gambling-performance`, 
    withGuild({ params: { startDate, endDate } }, currentGuildId));
  return response.data;
};

// Game Type Distribution Graph
export const getGameDistribution = async (discordId, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/game-distribution`, 
    withGuild({ params: { startDate, endDate } }, currentGuildId));
  return response.data;
};

// Transaction Type Analysis Graph
export const getTransactionAnalysis = async (discordId, limit = 500, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/transaction-analysis`, 
    withGuild({ params: { limit, startDate, endDate } }, currentGuildId));
  return response.data;
};

// Game Comparison Matrix Graph
export const getGameComparison = async (discordId, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/game-comparison`, 
    withGuild({ params: { startDate, endDate } }, currentGuildId));
  return response.data;
};

// Time of Day Heatmap
export const getTimeOfDayHeatmap = async (discordId, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/time-of-day-heatmap`, 
    withGuild({ params: { startDate, endDate } }, currentGuildId));
  return response.data;
};

// Daily Bonus API
export const claimDailyBonus = async (discordId, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.post(
    `${API_URL}/api/users/${discordId}/daily`,
    { guildId: currentGuildId },
    withGuild({}, currentGuildId)
  );
  return response.data;
};

// Daily Bonus Status API
export const getDailyBonusStatus = async (discordId, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(
    `${API_URL}/api/users/${discordId}/daily-status`,
    withGuild({ params: { guildId: currentGuildId } }, currentGuildId)
  );
  return response.data;
};

// Daily Profit & Loss
export const getDailyProfitLoss = async (discordId, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/daily-profit-loss`, 
    withGuild({ params: { startDate, endDate } }, currentGuildId));
  return response.data;
};

// Top Games by Net Profit
export const getTopGamesByProfit = async (discordId, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/top-games-by-profit`, 
    withGuild({ params: { startDate, endDate } }, currentGuildId));
  return response.data;
};

// Risk Score Trend
export const getRiskScoreTrend = async (discordId, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/risk-score-trend`, 
    withGuild({ params: { startDate, endDate } }, currentGuildId));
  return response.data;
};

// Favorite Game Over Time
export const getFavoriteGameTrend = async (discordId, startDate, endDate, guildId = null) => {
  // If no specific guildId is provided, use the current selected guild
  const currentGuildId = guildId || localStorage.getItem('selectedGuildId') || FALLBACK_GUILD_ID;
  
  const response = await axios.get(`${API_URL}/api/statistics/${discordId}/favorite-game-trend`, 
    withGuild({ params: { startDate, endDate } }, currentGuildId));
  return response.data;
};

// Get Guild Settings
export const getGuildSettings = async () => {
  const response = await axios.get(`${API_URL}/api/guild/settings`, withGuild());
  return response.data;
};

// Get Guild Members
export const getGuildMembers = async (page = 1, limit = 20, sortBy = 'username', sortOrder = 'asc') => {
  const response = await axios.get(`${API_URL}/api/guild/members`, 
    withGuild({ params: { page, limit, sortBy, sortOrder } }));
  return response.data;
};

// Gambling APIs
export const playCoinflip = async (discordId, amount, choice, guildId = null) => {
  const response = await axios.post(
    `${API_URL}/api/gambling/${discordId}/coinflip`,
    { amount, choice, guildId },
    withGuild({}, guildId)
  );
  return response.data;
};