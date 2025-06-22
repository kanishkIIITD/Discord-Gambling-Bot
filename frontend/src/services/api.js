import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;
// Define WebSocket URL from environment variable
const WS_URL = process.env.REACT_APP_WS_URL;

// --- TEMP: Main Guild ID for single-guild mode ---
// TODO: Replace with dynamic guild selection for multi-guild support
const MAIN_GUILD_ID = process.env.REACT_APP_MAIN_GUILD_ID || 'YOUR_MAIN_GUILD_ID';

// Helper to inject guildId into params/body/headers
const withGuild = (config = {}) => ({
  ...config,
  params: { ...(config.params || {}), guildId: MAIN_GUILD_ID },
  headers: { ...(config.headers || {}), 'x-guild-id': MAIN_GUILD_ID }
});

// User and Wallet APIs
export const getUserProfile = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/profile`, withGuild());
  return response.data;
};

export const getWalletBalance = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/wallet`, withGuild());
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
export const getActiveBets = async () => {
  const response = await axios.get(`${API_URL}/api/bets/open`, withGuild());
  return response.data;
};

export const getUpcomingBets = async () => {
  const response = await axios.get(`${API_URL}/api/bets/upcoming`, withGuild());
  return response.data;
};

export const getBetDetails = async (betId) => {
  const response = await axios.get(`${API_URL}/api/bets/${betId}`, withGuild());
  return response.data;
};

export const placeBet = async (betId, amount, option, discordId) => {
  const response = await axios.post(
    `${API_URL}/api/bets/${betId}/place`,
    { bettorDiscordId: discordId, amount, option, guildId: MAIN_GUILD_ID },
    withGuild()
  );
  return response.data;
};

// Add this new function to fetch placed bets for a specific bet
export const getPlacedBetsForBet = async (betId, page = 1, limit = 20) => {
  const response = await axios.get(`${API_URL}/api/bets/${betId}/placed`, withGuild({ params: { page, limit } }));
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
  const response = await axios.put(`${API_URL}/api/users/${discordId}/preferences`, { ...preferences, guildId: MAIN_GUILD_ID }, withGuild());
  return response.data;
};

// WebSocket setup
export const setupWebSocket = (onMessage, discordId) => {
  // Use the WS_URL environment variable
  const ws = new WebSocket(`${WS_URL}`);
  
  ws.onopen = () => {
    // console.log('WebSocket Connected');
    // Send authentication message
    if (discordId) {
      ws.send(JSON.stringify({
        type: 'AUTH',
        discordId,
        guildId: MAIN_GUILD_ID
      }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // console.log('WebSocket message received:', data);
      onMessage(data);
    } catch (error) {
      // console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    // console.error('WebSocket Error:', error);
  };

  ws.onclose = () => {
    // console.log('WebSocket Disconnected');
    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      // console.log('Attempting to reconnect WebSocket...');
      setupWebSocket(onMessage, discordId);
    }, 5000);
  };

  return ws;
}; 

// Fetch all users (for superadmin)
export const getAllUsers = async (page = 1, limit = 10) => {
  const response = await axios.get(`${API_URL}/api/users`, withGuild({ params: { page, limit } }));
  return response.data;
}; 

// Admin/Superadmin Bet Management APIs
export const closeBet = async (betId) => {
  const response = await axios.put(`${API_URL}/api/bets/${betId}/close`, { guildId: MAIN_GUILD_ID }, withGuild());
  return response.data;
};

export const resolveBet = async (betId, winningOption, resolverDiscordId) => {
  const response = await axios.put(`${API_URL}/api/bets/${betId}/resolve`, { winningOption, resolverDiscordId, guildId: MAIN_GUILD_ID }, withGuild());
  return response.data;
};

export const cancelBet = async (betId, creatorDiscordId) => {
  const response = await axios.delete(`${API_URL}/api/bets/${betId}`, withGuild({ data: { creatorDiscordId, guildId: MAIN_GUILD_ID } }));
  return response.data;
};

export const editBet = async (betId, creatorDiscordId, description, options, durationMinutes) => {
  const response = await axios.put(`${API_URL}/api/bets/${betId}/edit`, { creatorDiscordId, description, options, durationMinutes, guildId: MAIN_GUILD_ID }, withGuild());
  return response.data;
};

export const extendBet = async (betId, creatorDiscordId, additionalMinutes) => {
  const response = await axios.put(`${API_URL}/api/bets/${betId}/extend`, { creatorDiscordId, additionalMinutes, guildId: MAIN_GUILD_ID }, withGuild());
  return response.data;
};

// Fetch all placed bets for a user (My Bets)
export const getMyPlacedBets = async (discordId, page = 1, limit = 20) => {
  try {
    const response = await axios.get(`${API_URL}/api/users/${discordId}/bets`, withGuild({
      params: { limit: Math.min(limit, 500), page }, // Limit to max 500 items
    }));
    return response.data;
  } catch (error) {
    // console.error('Error fetching my placed bets:', error);
    throw error;
  }
};

// Update username for a user
export const updateUsername = async (discordId, username) => {
  const response = await axios.post(`${API_URL}/api/users/${discordId}/update-username`, { username, guildId: MAIN_GUILD_ID }, withGuild());
  return response.data;
};

// Refund a bet (admin/superadmin only)
export const refundBet = async (betId, creatorDiscordId) => {
  const response = await axios.post(`${API_URL}/api/bets/${betId}/refund`, { creatorDiscordId, guildId: MAIN_GUILD_ID }, withGuild());
  return response.data;
};

export const getClosedBets = async () => {
  const response = await axios.get(`${API_URL}/api/bets/closed`, withGuild());
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