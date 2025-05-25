// backend/utils/websocketService.js
const WebSocket = require('ws');

// Store connected clients
const clients = new Map();

// Function to add a client
const addClient = (discordId, ws) => {
  if (!ws) {
    console.error(`Attempted to add client ${discordId} with a null/undefined WebSocket object.`);
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
    console.warn(`Attempted to add client ${discordId} with WebSocket in state: ${ws.readyState}`);
  }

  clients.set(discordId, ws);

  try {
    ws.discordId = discordId;
  } catch (e) {
    console.error(`Error attaching discordId to WebSocket instance for ${discordId}:`, e);
  }
};

// Function to remove a client
const removeClient = (ws) => {
  for (const [discordId, client] of clients.entries()) {
    if (client === ws) {
      clients.delete(discordId);
      // // console.log(`Client disconnected: ${discordId}`);
      break;
    }
  }
};

// Function to broadcast to a specific user
const broadcastToUser = (discordId, data) => {
  const client = clients.get(discordId);
  if (client && client.readyState === WebSocket.OPEN) {
    try {
      client.send(JSON.stringify(data));
    } catch (error) {
      console.error(`Error sending WebSocket message to ${discordId}:`, error);
    }
  }
};

// Function to broadcast to all users (optional, but good to have)
const broadcastToAll = (data) => {
  clients.forEach((client, discordId) => {
    if (client.readyState === WebSocket.OPEN) {
       try {
         client.send(JSON.stringify(data));
       } catch (error) {
         console.error(`Error broadcasting WebSocket message to ${discordId}:`, error);
       }
    }
  });
};

module.exports = {
  clients, // Export clients map for index.js to use in wss connection handler
  addClient,
  removeClient,
  broadcastToUser,
  broadcastToAll,
}; 