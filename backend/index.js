require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('./config/auth');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const userRoutes = require('./routes/userRoutes');
const { router: betRouter, scheduleBetClosure } = require('./routes/betRoutes');
const gamblingRoutes = require('./routes/gamblingRoutes');
const authRoutes = require('./routes/authRoutes');
const miscRoutes = require('./routes/miscRoutes');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Bet = require('./models/Bet');
const adminRoutes = require('./routes/adminRoutes');
const serverless = require('serverless-http');
const Duel = require('./models/Duel');
const Wallet = require('./models/Wallet');
const serverRoutes = require('./routes/serverRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');
const MongoStore = require('connect-mongo');
const battleRoutes = require('./routes/battleRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const questRoutes = require('./routes/questRoutes');
const tcgRoutes = require('./routes/tcgRoutes');

const app = express();
const server = http.createServer(app);

// Middleware to parse JSON bodies
// Wehen updating cors, make sure to update the serverless.yml file
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-guild-id']
}));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: true,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60 // 1 day
  }),
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
  .then(async () => {
    console.log(`Connected to MongoDB ${process.env.MONGODB_URI}`);
    // --- Schedule bet closure timers for all open bets with a future closingTime ---
    try {
      const now = new Date();
      const openBets = await Bet.find({ status: 'open', closingTime: { $gt: now } });
      let scheduled = 0;
      for (const bet of openBets) {
        scheduleBetClosure(bet);
        scheduled++;
      }
      console.log(`[BetTimers] Scheduled closure timers for ${scheduled} open bets with future closingTime.`);
    } catch (err) {
      console.error('[BetTimers] Error scheduling bet timers on startup:', err);
    }
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
app.use('/api/servers', serverRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/battles', battleRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/tcg', tcgRoutes);
app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

// Only start the server if this file is run directly (not imported by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Discord Client ID: ${process.env.DISCORD_CLIENT_ID}`);
    // console.log(`Discord Client Secret: ${process.env.DISCORD_CLIENT_SECRET}`);
  });
}

// Export app and server for testing
module.exports = { app, server };

// Export handler for serverless deployment
const handler = serverless(app);
module.exports.handler = handler;