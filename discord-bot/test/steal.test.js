const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const stealCommand = require('../commands/steal');

// Mock axios
jest.mock('axios');

// Mock the discordUtils module
jest.mock('../utils/discordUtils', () => ({
    createErrorEmbed: jest.fn(() => ({
        setColor: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis()
    })),
    createSuccessEmbed: jest.fn(() => ({
        addFields: jest.fn().mockReturnThis()
    })),
    sendLogToChannel: jest.fn()
}));

describe('Steal Command', () => {
  let mockInteraction;
  let mockTargetUser;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock target user
    mockTargetUser = {
      id: '123456789',
      username: 'TestTarget',
      toString: () => '<@123456789>'
    };

    // Mock interaction
    mockInteraction = {
      options: {
        getSubcommand: jest.fn(),
        getUser: jest.fn(),
        getString: jest.fn()
      },
      user: {
        id: '987654321',
        username: 'TestUser'
      },
      guildId: 'test-guild-id',
      deferReply: jest.fn(),
      editReply: jest.fn(),
      followUp: jest.fn(),
      reply: jest.fn(),
      replied: false,
      deferred: false
    };

    // Mock environment variable
    process.env.BACKEND_API_URL = 'http://localhost:3000';
  });

  describe('Stats Subcommand', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('stats');
    });

    test('should display steal statistics successfully', async () => {
      const mockStats = {
        success: 5,
        fail: 3,
        jail: 2,
        totalStolen: 1500000,
        totalAttempts: 10,
        successRate: 50.0,
        typeStats: {
          points: { success: 3, fail: 1, total: 4, successRate: 75.0 },
          fish: { success: 1, fail: 1, total: 2, successRate: 50.0 },
          animal: { success: 1, fail: 1, total: 2, successRate: 50.0 },
          item: { success: 0, fail: 0, total: 0, successRate: 0 }
        },
        activePunishments: []
      };

      axios.get.mockResolvedValue({
        data: { stealStats: mockStats }
      });

      await stealCommand.execute(mockInteraction);

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3000/users/987654321/steal-stats',
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      const errorMessage = 'User not found';
      axios.get.mockRejectedValue({
        response: {
          data: { message: errorMessage }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    test('should handle unexpected errors', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });

  describe('Points Subcommand', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('points');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
    });

    test('should handle successful points steal', async () => {
      const mockResponse = {
        success: true,
        stolenAmount: 50000,
        newBalance: 150000,
        stealType: 'points',
        cooldownTime: new Date()
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/users/987654321/steal',
        {
          targetDiscordId: '123456789',
          stealType: 'points'
        },
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    test('should handle failed points steal', async () => {
      const mockResponse = {
        success: false,
        stolenAmount: 0,
        newBalance: 100000,
        stealType: 'points',
        punishment: { type: 'jail', severity: 'medium' },
        jailInfo: { minutes: 45, until: new Date(Date.now() + 45 * 60000) },
        bailInfo: { bailAmount: 50000, additionalJailTime: 0 },
        cooldownTime: new Date()
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });

  describe('Fish Subcommand', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('fish');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
      mockInteraction.options.getString.mockReturnValue('common'); // rarity filter
    });

    test('should handle successful fish steal', async () => {
      const mockResponse = {
        success: true,
        stolenItems: [{ name: 'Goldfish', rarity: 'common', count: 2, value: 5000 }],
        totalValue: 10000,
        newBalance: 150000,
        newCollectionValue: 25000,
        stealType: 'fish',
        cooldownTime: new Date()
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/users/987654321/steal',
        {
          targetDiscordId: '123456789',
          stealType: 'fish',
          rarity: 'common'
        },
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });

  describe('Animal Subcommand', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('animal');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
      mockInteraction.options.getString.mockReturnValue('rare'); // rarity filter
    });

    test('should handle successful animal steal', async () => {
      const mockResponse = {
        success: true,
        stolenItems: [{ name: 'Lion', rarity: 'rare', count: 1, value: 15000 }],
        totalValue: 15000,
        newBalance: 150000,
        newCollectionValue: 35000,
        stealType: 'animal',
        cooldownTime: new Date()
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/users/987654321/steal',
        {
          targetDiscordId: '123456789',
          stealType: 'animal',
          rarity: 'rare'
        },
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });

  describe('Item Subcommand', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('item');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
      mockInteraction.options.getString.mockReturnValue('epic'); // rarity filter
    });

    test('should handle successful item steal', async () => {
      const mockResponse = {
        success: true,
        stolenItems: [{ name: 'Magic Sword', rarity: 'epic', count: 1, value: 25000 }],
        totalValue: 25000,
        newBalance: 150000,
        newCollectionValue: 45000,
        stealType: 'item',
        cooldownTime: new Date()
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/users/987654321/steal',
        {
          targetDiscordId: '123456789',
          stealType: 'item',
          rarity: 'epic'
        },
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('points');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
    });

    test('should handle cooldown errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 429,
          data: { message: 'You must wait 2 hours before stealing points again' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    test('should handle jailed user errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: { message: 'You are currently jailed and cannot steal' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    test('should handle self-steal errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: { message: 'You cannot steal from yourself' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    test('should handle target not found errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: { message: 'Target user not found' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });

  describe('Command Structure', () => {
    test('should have correct command data structure', () => {
      expect(stealCommand.data).toBeInstanceOf(SlashCommandBuilder);
      expect(stealCommand.data.name).toBe('steal');
      expect(stealCommand.data.description).toBe('Enhanced stealing system with multiple targets and punishments');
    });

    test('should have all required subcommands', () => {
      const commandData = stealCommand.data.toJSON();
      expect(commandData.options).toHaveLength(5);
      
      const subcommands = commandData.options.map(opt => opt.name);
      expect(subcommands).toContain('points');
      expect(subcommands).toContain('fish');
      expect(subcommands).toContain('animal');
      expect(subcommands).toContain('item');
      expect(subcommands).toContain('stats');
      
      // Check that points subcommand has target option
      const pointsSubcommand = commandData.options.find(opt => opt.name === 'points');
      expect(pointsSubcommand.options).toHaveLength(1);
      expect(pointsSubcommand.options[0].name).toBe('target');
      
      // Check that fish/animal/item subcommands have target and rarity options
      ['fish', 'animal', 'item'].forEach(type => {
        const subcommand = commandData.options.find(opt => opt.name === type);
        expect(subcommand.options).toHaveLength(2);
        expect(subcommand.options[0].name).toBe('target');
        expect(subcommand.options[1].name).toBe('rarity');
      });
      
      // Check that stats subcommand has no options
      const statsSubcommand = commandData.options.find(opt => opt.name === 'stats');
      expect(statsSubcommand.options).toHaveLength(0);
    });
  });
}); 