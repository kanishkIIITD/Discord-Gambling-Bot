import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;
// Define WebSocket URL from environment variable
const WS_URL = process.env.REACT_APP_WS_URL;

// User and Wallet APIs
export const getUserProfile = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/profile`);
  return response.data;
};

export const getWalletBalance = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/wallet`);
  return response.data;
};

export const getTransactionHistory = async (discordId, page = 1, limit = 20) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/transactions`, {
    params: { page, limit }
  });
  return response.data;
};

// Betting APIs
export const getActiveBets = async () => {
  const response = await axios.get(`${API_URL}/api/bets/open`);
  return response.data;
};

export const getUpcomingBets = async () => {
  const response = await axios.get(`${API_URL}/api/bets/upcoming`);
  return response.data;
};

export const getBetDetails = async (betId) => {
  const response = await axios.get(`${API_URL}/api/bets/${betId}`);
  return response.data;
};

export const placeBet = async (betId, amount, option, discordId) => {
  const response = await axios.post(`${API_URL}/api/bets/${betId}/place`, {
    bettorDiscordId: discordId,
    amount,
    option
  });
  return response.data;
};

// Add this new function to fetch placed bets for a specific bet
export const getPlacedBetsForBet = async (betId) => {
  const response = await axios.get(`${API_URL}/api/bets/${betId}/placed`);
  return response.data;
};

// Leaderboard API
export const getLeaderboard = async (discordId, limit = 10) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/leaderboard`, {
    params: { limit }
  });
  return response.data;
};

// Misc API
export const getDiscordCommands = async () => {
  const response = await axios.get(`${API_URL}/api/misc/discord-commands`);
  return response.data;
};

// Preferences API
export const getUserPreferences = async (discordId) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/preferences`);
  return response.data;
};

export const updateUserPreferences = async (discordId, preferences) => {
  const response = await axios.put(`${API_URL}/api/users/${discordId}/preferences`, preferences);
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
        discordId
      }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // console.log('WebSocket message received:', data);
      onMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket Error:', error);
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
  const response = await axios.get(`${API_URL}/api/users`, { params: { page, limit } });
  return response.data;
}; 

// Admin/Superadmin Bet Management APIs
export const closeBet = async (betId) => {
  const response = await axios.put(`${API_URL}/api/bets/${betId}/close`);
  return response.data;
};

export const resolveBet = async (betId, winningOption, resolverDiscordId) => {
  const response = await axios.put(`${API_URL}/api/bets/${betId}/resolve`, {
    winningOption,
    resolverDiscordId,
  });
  return response.data;
};

export const cancelBet = async (betId, creatorDiscordId) => {
  const response = await axios.delete(`${API_URL}/api/bets/${betId}`, {
    data: { creatorDiscordId },
  });
  return response.data;
};

export const editBet = async (betId, creatorDiscordId, description, options, durationMinutes) => {
  const response = await axios.put(`${API_URL}/api/bets/${betId}/edit`, {
    creatorDiscordId,
    description,
    options,
    durationMinutes,
  });
  return response.data;
};

export const extendBet = async (betId, creatorDiscordId, additionalMinutes) => {
  const response = await axios.put(`${API_URL}/api/bets/${betId}/extend`, {
    creatorDiscordId,
    additionalMinutes,
  });
  return response.data;
};

// Fetch all placed bets for a user (My Bets)
export const getMyPlacedBets = async (discordId, page = 1, limit = 20) => {
  const response = await axios.get(`${API_URL}/api/users/${discordId}/bets`, {
    params: { page, limit }
  });
  return response.data;
}; 