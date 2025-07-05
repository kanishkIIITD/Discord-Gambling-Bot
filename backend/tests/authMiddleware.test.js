const { verifyGuildAccess } = require('../middleware/auth');
const { getUserGuilds } = require('../utils/discordClient');

// Mock the discordClient module
jest.mock('../utils/discordClient');

describe('verifyGuildAccess middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      headers: {},
      user: { discordId: 'user123', role: 'user' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should allow access for users in the guild', async () => {
    req.headers['x-guild-id'] = 'guild1';
    getUserGuilds.mockResolvedValue([{ id: 'guild1' }, { id: 'guild2' }]);
    await verifyGuildAccess(req, res, next);
    expect(getUserGuilds).toHaveBeenCalledWith(req.user.discordId);
    expect(next).toHaveBeenCalled();
    expect(req.guildId).toBe('guild1');
  });

  it('should deny access for users not in the guild', async () => {
    req.headers['x-guild-id'] = 'guild3';
    getUserGuilds.mockResolvedValue([{ id: 'guild1' }, { id: 'guild2' }]);
    await verifyGuildAccess(req, res, next);
    expect(getUserGuilds).toHaveBeenCalledWith(req.user.discordId);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'You do not have access to this guild.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 if guildId is missing', async () => {
    // Ensure no guildId is provided in any location
    req.body = {};
    req.query = {};
    req.headers = {};
    
    await verifyGuildAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'guildId is required in body, query, or x-guild-id header.' });
    expect(next).not.toHaveBeenCalled();
    // Verify getUserGuilds was not called when guildId is missing
    expect(getUserGuilds).not.toHaveBeenCalled();
  });

  it('should allow superadmin to bypass guild check', async () => {
    req.headers['x-guild-id'] = 'guild1';
    req.user.role = 'superadmin';
    await verifyGuildAccess(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.guildId).toBe('guild1');
    // Verify that getUserGuilds was not called for superadmins
    expect(getUserGuilds).not.toHaveBeenCalled();
  });

  it('should handle errors and return 500', async () => {
    req.headers['x-guild-id'] = 'guild1';
    getUserGuilds.mockRejectedValue(new Error('DB error'));
    await verifyGuildAccess(req, res, next);
    expect(getUserGuilds).toHaveBeenCalledWith(req.user.discordId);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Server error.' });
    expect(next).not.toHaveBeenCalled();
  });
});

// Teardown logic to clean up after all tests
afterAll(async () => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  } catch (e) {
    // Ignore if mongoose is not used
  }
});