const request = require('supertest');
const { app } = require('../index');
const User = require('../models/User');
const { getUserGuilds } = require('../utils/discordClient');
const jwt = require('jsonwebtoken');

jest.mock('../models/User');
jest.mock('../utils/discordClient');
jest.mock('jsonwebtoken');

describe('GET /api/users/:discordId/guilds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock JWT verification to simulate authenticated requests
    jwt.verify.mockImplementation(() => ({ id: 'user_id' }));
  });

  it("should return the user's accessible guilds", async () => {
    // Mock authenticated user
    const user = { _id: 'user_id', discordId: 'user123', role: 'user' };
    User.findOne.mockResolvedValue(user);
    
    // Mock the guilds that will be returned
    const mockGuilds = [
      { id: 'guild1', name: 'Guild 1', icon: 'icon1' },
      { id: 'guild2', name: 'Guild 2', icon: 'icon2' }
    ];
    getUserGuilds.mockResolvedValue(mockGuilds);
    
    // Make the request with authentication
    const res = await request(app)
      .get('/api/users/user123/guilds')
      .set('Authorization', 'Bearer valid-token');
    
    // Verify the response
    expect(res.statusCode).toBe(200);
    expect(res.body.guilds).toEqual(mockGuilds);
    expect(getUserGuilds).toHaveBeenCalledWith('user123');
  });

  it('should require authentication', async () => {
    // Make request without authentication token
    const res = await request(app).get('/api/users/user123/guilds');
    
    // Should return unauthorized
    expect(res.statusCode).toBe(401);
  });
  
  it('should handle errors from getUserGuilds', async () => {
    // Mock authenticated user
    const user = { _id: 'user_id', discordId: 'user123', role: 'user' };
    User.findOne.mockResolvedValue(user);
    
    // Mock an error from getUserGuilds
    getUserGuilds.mockRejectedValue(new Error('Failed to fetch guilds'));
    
    // Make the request with authentication
    const res = await request(app)
      .get('/api/users/user123/guilds')
      .set('Authorization', 'Bearer valid-token');
    
    // Should return server error
    expect(res.statusCode).toBe(500);
  });
});

// Teardown logic to clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});