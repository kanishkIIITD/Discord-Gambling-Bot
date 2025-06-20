const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Bet = require('../models/Bet');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findOne({ _id: decoded.id });
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

// Middleware to require admin or superadmin
const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Middleware to require superadmin
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
};

// Middleware to require guildId
const requireGuildId = (req, res, next) => {
  const guildId = req.body.guildId || req.query.guildId || req.headers['x-guild-id'];
  if (!guildId) {
    return res.status(400).json({ message: 'guildId is required in body, query, or x-guild-id header.' });
  }
  req.guildId = guildId;
  next();
};

const requireBetCreatorOrAdmin = async (req, res, next) => {
  try {
    const { betId } = req.params;
    const { creatorDiscordId, guildId } = req.body;
    
    // Find the bet
    const bet = await Bet.findById(betId).populate('creator', 'discordId');
    if (!bet || !bet.creator) {
      return res.status(404).json({ message: 'Bet or bet creator not found.' });
    }

    // Check if user is creator
    const isCreator = bet.creator.discordId === creatorDiscordId;
    
    // Check if user is admin in this guild
    const user = await User.findOne({ discordId: creatorDiscordId, guildId });
    const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ 
        message: 'You must be the bet creator or an admin to perform this action.' 
      });
    }

    next();
  } catch (error) {
    console.error('Error in requireBetCreatorOrAdmin middleware:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  auth,
  requireAdmin,
  requireSuperAdmin,
  requireGuildId,
  requireBetCreatorOrAdmin
}; 