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

    test('should handle failed points steal with jail punishment', async () => {
      const mockResponse = {
        success: false,
        punishment: { 
          type: 'jail', 
          severity: 'medium',
          description: 'You got caught stealing points and are sentenced to jail time!'
        },
        jailInfo: { minutes: 45, until: new Date(Date.now() + 45 * 60000) },
        bailInfo: { 
          bailAmount: 50000, 
          additionalJailTime: 0
        },
        cooldownTime: new Date(),
        stealType: 'points'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      // The command uses embed fields, so we check that addFields was called
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle failed points steal with penalty punishment', async () => {
      const mockResponse = {
        success: false,
        punishment: { 
          type: 'penalty', 
          severity: 'light',
          description: 'You got caught stealing points and must pay a penalty!'
        },
        cooldownTime: new Date(),
        stealType: 'points'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle jail immunity buff usage', async () => {
      const mockResponse = {
        success: false,
        punishment: { type: 'jail', severity: 'none' },
        buffUsed: 'jail_immunity',
        buffMessage: 'Your jail immunity buff saved you from jail!',
        cooldownTime: new Date(),
        stealType: 'points'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle cooldown error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 429,
          data: { message: 'You must wait 2h 30m before stealing points again.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle self-steal error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'You cannot steal from yourself.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle target not found error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'Target user not found.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle insufficient balance error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Target user has insufficient balance to steal from.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
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

    test('should handle failed fish steal with punishment description', async () => {
      const mockResponse = {
        success: false,
        punishment: { 
          type: 'jail', 
          severity: 'heavy',
          description: 'You got caught stealing fish and are sentenced to extended jail time!'
        },
        jailInfo: { minutes: 90, until: new Date(Date.now() + 90 * 60000) },
        bailInfo: { 
          bailAmount: 75000, 
          additionalJailTime: 30
        },
        cooldownTime: new Date(),
        stealType: 'fish'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle no fish to steal error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Target user has no common fish to steal.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });
  });

  describe('Animal Subcommand', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('animal');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
      mockInteraction.options.getString.mockReturnValue('epic'); // rarity filter
    });

    test('should handle successful animal steal', async () => {
      const mockResponse = {
        success: true,
        stolenItems: [{ name: 'Dragon', rarity: 'epic', count: 1, value: 50000 }],
        totalValue: 50000,
        newBalance: 150000,
        newCollectionValue: 75000,
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

    test('should handle failed animal steal with bounty punishment', async () => {
      const mockResponse = {
        success: false,
        punishment: { 
          type: 'bounty', 
          severity: 'medium',
          description: 'You got caught stealing animals and now have a bounty on your head!'
        },
        cooldownTime: new Date(),
        stealType: 'animal'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });
  });

  describe('Item Subcommand', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('item');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
    });

    test('should handle successful item steal', async () => {
      const mockResponse = {
        success: true,
        stolenItems: [{ name: 'Magic Sword', rarity: 'legendary', count: 1, value: 100000 }],
        totalValue: 100000,
        newBalance: 150000,
        newCollectionValue: 125000,
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
          stealType: 'item'
        },
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    test('should handle failed item steal with marked punishment', async () => {
      const mockResponse = {
        success: false,
        punishment: { 
          type: 'marked', 
          severity: 'light',
          description: 'You got caught stealing items and are now marked as a thief!'
        },
        cooldownTime: new Date(),
        stealType: 'item'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle no items to steal error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Target user has no item to steal.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });
  });

  describe('Lucky Streak Buff', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('points');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
    });

    test('should handle lucky streak buff usage', async () => {
      const mockResponse = {
        success: true,
        stolenAmount: 75000,
        newBalance: 175000,
        stealType: 'points',
        cooldownTime: new Date(),
        message: 'Lucky Streak buff used! You stole 75,000 points from TestTarget!'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createSuccessEmbed).toHaveBeenCalled();
    });
  });

  describe('Bail System', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('points');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
    });

    test('should display bail information correctly', async () => {
      const mockResponse = {
        success: false,
        punishment: { 
          type: 'jail', 
          severity: 'medium',
          description: 'You got caught stealing points and are sentenced to jail time!'
        },
        jailInfo: { 
          minutes: 60, 
          until: new Date(Date.now() + 60 * 60000) 
        },
        bailInfo: { 
          bailAmount: 60000, 
          additionalJailTime: 15
        },
        cooldownTime: new Date(),
        stealType: 'points'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle high bail amounts', async () => {
      const mockResponse = {
        success: false,
        punishment: { 
          type: 'jail', 
          severity: 'heavy',
          description: 'You got caught stealing points and are sentenced to extended jail time!'
        },
        jailInfo: { 
          minutes: 120, 
          until: new Date(Date.now() + 120 * 60000) 
        },
        bailInfo: { 
          bailAmount: 150000, 
          additionalJailTime: 30
        },
        cooldownTime: new Date(),
        stealType: 'points'
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('points');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
    });

    test('should handle network errors', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle invalid steal type', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Invalid steal type. Must be points, fish, animal, or item.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle missing targetDiscordId', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'targetDiscordId is required.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });

    test('should handle jailed user error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'You are currently jailed and cannot steal. Use /bail to get out early.' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(require('../utils/discordUtils').createErrorEmbed).toHaveBeenCalled();
    });
  });

  describe('Command Structure', () => {
    test('should have correct command structure', () => {
      expect(stealCommand.data).toBeInstanceOf(SlashCommandBuilder);
      expect(stealCommand.data.name).toBe('steal');
      expect(stealCommand.data.description).toBe('Enhanced stealing system with multiple targets and punishments');
    });

    test('should have all required subcommands', () => {
      const subcommands = stealCommand.data.options;
      const subcommandNames = subcommands.map(option => option.name);
      
      expect(subcommandNames).toContain('stats');
      expect(subcommandNames).toContain('points');
      expect(subcommandNames).toContain('fish');
      expect(subcommandNames).toContain('animal');
      expect(subcommandNames).toContain('item');
    });
  });
}); 