const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Bet = require('../models/Bet');
const { getUserGuilds } = require('../utils/discordClient');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get guildId from request
    const guildId = req.body.guildId || req.query.guildId || req.headers['x-guild-id'];
    
    // Find user - if guildId is provided, use it for guild-specific context
    // Otherwise, find the user by _id for basic authentication
    let user;
    if (guildId) {
      // Find user in the specific guild context
      user = await User.findOne({ discordId: decoded.discordId, guildId: guildId });
      
      // If user doesn't exist in this guild, create them with their existing role
      if (!user) {
        // Check if user exists in any other guild to preserve their role
        const existingUser = await User.findOne({ discordId: decoded.discordId });
        const defaultRole = existingUser ? existingUser.role : 'user';
        
        user = new User({
          discordId: decoded.discordId,
          guildId: guildId,
          username: decoded.discordId, // Will be updated later
          role: defaultRole
        });
        await user.save();
      }
    } else {
      // For non-guild-specific requests, find by _id
      user = await User.findOne({ _id: decoded.id });
    }
    
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

// New middleware that allows any admin/superadmin to perform bet actions
const requireBetCreatorOrAnyAdmin = async (req, res, next) => {
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
    
    // Check if user is admin in this guild (any admin can perform actions)
    const user = await User.findOne({ discordId: creatorDiscordId, guildId });
    const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ 
        message: 'You must be the bet creator or an admin to perform this action.' 
      });
    }

    next();
  } catch (error) {
    console.error('Error in requireBetCreatorOrAnyAdmin middleware:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Middleware to verify user has access to the guild
const verifyGuildAccess = async (req, res, next) => {
  // console.log('[Auth] verifyGuildAccess called');
  try {
    const guildId = req.body.guildId || req.query.guildId || req.headers['x-guild-id'];
    // console.log('[Auth] Requested guildId:', guildId);
    
    if (!guildId) {
      // console.log('[Auth] No guildId provided in request');
      return res.status(400).json({ message: 'guildId is required in body, query, or x-guild-id header.' });
    }

    // Skip verification for superadmins
    if (req.user && req.user.role === 'superadmin') {
      // console.log('[Auth] User is superadmin, skipping guild access verification');
      req.guildId = guildId;
      return next();
    }

    // console.log('[Auth] Fetching guilds for user:', req.user.discordId);
    // Get the guilds the user has access to
    const userGuilds = await getUserGuilds(req.user.discordId);
    // console.log('[Auth] User guilds fetched, count:', userGuilds ? userGuilds.length : 0);
    
    // Check if the user has access to the requested guild
    const hasAccess = userGuilds.some(guild => guild.id === guildId);
    // console.log('[Auth] User has access to requested guild:', hasAccess);
    
    if (!hasAccess) {
      // console.log('[Auth] Access denied to guild:', guildId);
      return res.status(403).json({ message: 'You do not have access to this guild.' });
    }

    req.guildId = guildId;
    // console.log('[Auth] Guild access verified successfully');
    next();
  } catch (error) {
    // console.error('[Auth] Error in verifyGuildAccess middleware:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  auth,
  requireAdmin,
  requireSuperAdmin,
  requireGuildId,
  requireBetCreatorOrAdmin,
  requireBetCreatorOrAnyAdmin,
  verifyGuildAccess
};