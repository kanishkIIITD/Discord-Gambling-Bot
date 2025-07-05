const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireGuildId } = require('../middleware/auth');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// --- DO NOT requireGuildId for Discord OAuth routes ---
// Discord OAuth2 login route
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth2 callback route
router.get('/discord/callback', 
  passport.authenticate('discord', { failureRedirect: '/login' }),
  (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { id: req.user._id, discordId: req.user.discordId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// --- Routes that don't require guildId ---
// Get current user - no guild ID required for basic authentication
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
});

// Lightweight heartbeat endpoint for quick auth and guild checks
router.get('/heartbeat', verifyToken, async (req, res) => {
  // console.log('[Heartbeat] Received heartbeat request');
  try {
    // Find user with minimal projection (only necessary fields)
    // console.log('[Heartbeat] Finding user with ID:', req.user.id);
    const user = await User.findById(req.user.id)
      .select('discordId username discriminator avatar')
      .lean();
    
    if (!user) {
      // console.log('[Heartbeat] User not found with ID:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // console.log('[Heartbeat] User found:', user.discordId, user.username);
    
    // Fetch guilds from Discord API
    const { getUserGuilds } = require('../utils/discordClient');
    // console.log('[Heartbeat] Fetching guilds for user:', user.discordId);
    const guilds = await getUserGuilds(user.discordId);
    // console.log('[Heartbeat] Fetched guilds count:', guilds ? guilds.length : 0);
    
    // Return minimal user data and guilds for quick client-side validation
    const response = {
      user: {
        discordId: user.discordId,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar
      },
      guilds: guilds
    };
    
    // console.log('[Heartbeat] Sending response with guilds count:', response.guilds.length);
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching heartbeat data', error: error.message });
  }
});

// Logout route - no guild ID required for logout
router.post('/logout', verifyToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;