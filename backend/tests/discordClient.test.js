// --- NodeCache and Discord.js Client Mocks ---
let mockCacheSet, mockCacheGet, mockCacheDel, mockCacheHas;
let mockGuildsCache, mockClientInstance;

// Mock guild with members.fetch method
const createMockGuild = (guildId, findUser = true) => ({
  id: guildId,
  name: `Guild ${guildId}`,
  icon: `icon_${guildId}`,
  members: {
    fetch: jest.fn().mockImplementation((userId) => {
      if (findUser) {
        return Promise.resolve({ id: userId });
      }
      return Promise.reject(new Error('User not found in this guild'));
    })
  }
});

beforeEach(() => {
  jest.resetModules();
  mockCacheSet = jest.fn();
  mockCacheGet = jest.fn();
  mockCacheDel = jest.fn();
  mockCacheHas = jest.fn();
  
  // Mock NodeCache
  jest.doMock('node-cache', () => {
    return jest.fn().mockImplementation(() => ({
      set: mockCacheSet,
      get: mockCacheGet,
      del: mockCacheDel,
      has: mockCacheHas
    }));
  });
  
  // Mock Discord.js client
  mockGuildsCache = new Map();
  
  // Add mock guilds to the cache
  const mockGuild1 = createMockGuild('guild1');
  const mockGuild2 = createMockGuild('guild2');
  mockGuildsCache.set('guild1', mockGuild1);
  mockGuildsCache.set('guild2', mockGuild2);
  
  mockClientInstance = {
    isReady: jest.fn().mockReturnValue(true),
    login: jest.fn().mockResolvedValue('token'),
    on: jest.fn(),
    removeListener: jest.fn(),
    guilds: {
      cache: mockGuildsCache
    }
  };
  
  jest.doMock('discord.js', () => ({
    Client: jest.fn(() => mockClientInstance),
    GatewayIntentBits: { Guilds: 1 }
  }));
});

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
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

describe('discordClient', () => {
  it('should fetch user guilds from Discord API if not cached', async () => {
    // Arrange
    // Create mock guilds with members.fetch method
    const mockGuild1 = createMockGuild('guild1');
    const mockGuild2 = createMockGuild('guild2');
    
    // Set up the guilds cache with our mock guilds
    mockGuildsCache.set('guild1', mockGuild1);
    mockGuildsCache.set('guild2', mockGuild2);
    
    // Expected guilds that should be returned
    const expectedGuilds = [
      { id: 'guild1', name: 'Guild guild1', icon: 'icon_guild1' },
      { id: 'guild2', name: 'Guild guild2', icon: 'icon_guild2' }
    ];
    
    // Set up cache to return undefined (cache miss)
    mockCacheGet.mockReturnValue(undefined);

    // Act
    const { getUserGuilds } = require('../utils/discordClient');
    const result = await getUserGuilds('user123');

    // Assert
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'guild1' }),
      expect.objectContaining({ id: 'guild2' })
    ]));
    expect(mockCacheSet).toHaveBeenCalledWith('user_guilds_user123', expect.any(Array));
  });

  it('should return cached user guilds if available', async () => {
    // Mock cache hit
    const cachedGuilds = [{ id: 'guild1', name: 'Guild 1' }];
    mockCacheGet.mockReturnValue(cachedGuilds);
    
    // Call the function
    const userId = 'user123';
    const { getUserGuilds } = require('../utils/discordClient');
    const guilds = await getUserGuilds(userId);
    
    // Verify cache was checked
    expect(mockCacheGet).toHaveBeenCalledWith(`user_guilds_${userId}`);
    
    // Verify Discord API was not called (members.fetch should not be called)
    const mockGuild = mockGuildsCache.get('guild1');
    expect(mockGuild.members.fetch).not.toHaveBeenCalled();
    
    // Verify cached guilds were returned
    expect(guilds).toBe(cachedGuilds);
  });

  it('should handle users not in any guild', async () => {
    // Arrange
    mockCacheGet.mockReturnValue(undefined);
    
    // Set up guild members fetch to reject for all users in all guilds
    for (const guild of mockGuildsCache.values()) {
      guild.members.fetch.mockRejectedValue(new Error('User not found'));
    }

    // Act
    const { getUserGuilds } = require('../utils/discordClient');
    const result = await getUserGuilds('unknown_user');

    // Assert
    expect(result).toEqual([]);
    expect(mockCacheSet).toHaveBeenCalledWith('user_guilds_unknown_user', []);
  });

  it('should clear user guilds cache', () => {
    // Act
    const { clearUserGuildsCache } = require('../utils/discordClient');
    clearUserGuildsCache('user123');

    // Assert
    expect(mockCacheDel).toHaveBeenCalledWith('user_guilds_user123');
  });

  it('should return empty array when user is not found in any guild', async () => {
    // Mock cache miss
    mockCacheGet.mockReturnValue(null);
    
    // Create mock guilds where user is not found
    const mockGuild1 = createMockGuild('guild1', false);
    const mockGuild2 = createMockGuild('guild2', false);
    
    // Set up the guilds cache with our mock guilds
    mockGuildsCache.set('guild1', mockGuild1);
    mockGuildsCache.set('guild2', mockGuild2);
    
    // Call the function
    const userId = 'user123';
    const { getUserGuilds } = require('../utils/discordClient');
    const guilds = await getUserGuilds(userId);
    
    // Verify cache was checked
    expect(mockCacheGet).toHaveBeenCalledWith(`user_guilds_${userId}`);
    
    // Verify members.fetch was called for each guild
    expect(mockGuild1.members.fetch).toHaveBeenCalledWith(userId);
    expect(mockGuild2.members.fetch).toHaveBeenCalledWith(userId);
    
    // Verify empty array was returned and cached
    expect(guilds).toEqual([]);
    expect(mockCacheSet).toHaveBeenCalledWith(`user_guilds_${userId}`, []);
  });
});