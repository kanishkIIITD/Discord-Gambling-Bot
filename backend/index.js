require('dotenv').config({path: '.env.local'});

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('./config/auth');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');
const http = require('http');
const userRoutes = require('./routes/userRoutes');
const { router: betRouter, setWebSocketServer } = require('./routes/betRoutes');
const gamblingRoutes = require('./routes/gamblingRoutes');
const authRoutes = require('./routes/authRoutes');
const miscRoutes = require('./routes/miscRoutes');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Bet = require('./models/Bet');
const websocketService = require('./utils/websocketService');
const adminRoutes = require('./routes/adminRoutes');
const serverless = require('serverless-http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
  // Removed: // console.log('HTTP server received upgrade request');
  // You might want to do some authentication here
  // based on session cookies or other headers
  
  wss.handleUpgrade(request, socket, head, (ws) => {
    // Removed: // console.log('wss.handleUpgrade successful, emitting connection');
    wss.emit('connection', ws, request);
  });
});

// WebSocket connection handling (using the service)
wss.on('connection', (ws, request) => {
  // // console.log('New WebSocket connection'); // Reverted log

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      // // console.log('Received WebSocket message:', data); // Keep this or remove? Let's keep for now, maybe make it debug level later

      if (data.type === 'AUTH' && data.discordId) {
        // Add client using the service
        websocketService.addClient(data.discordId, ws); // Potential error point?
      } else {
         console.warn('Received unknown or incomplete WebSocket message:', data); // Keep warning
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error); // Keep error
      // The server might be crashing here if addClient or parsing fails unexpectedly
    }
  });

  ws.on('close', (code, reason) => { // Kept code and reason params
    // // console.log('WebSocket Disconnected'); // Reverted log reason details
    // Remove client using the service
    websocketService.removeClient(ws); // Potential error point?
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error); // Keep error
    // Remove client on error as well
    websocketService.removeClient(ws); // Potential error point?
  });
});

// Set up WebSocket server for bet routes
setWebSocketServer(wss);

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: true,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    // console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bets', betRouter);
app.use('/api/gambling', gamblingRoutes);
app.use('/api/misc', miscRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

// Update your server start to use the HTTP server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  // console.log(`Server running on port ${PORT}`);
}); 

module.exports.handler = serverless(app);

// Only start the server locally, not in Lambda
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}