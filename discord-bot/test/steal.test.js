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
        getUser: jest.fn()
      },
      user: {
        id: '987654321',
        username: 'TestUser'
      },
      guildId: 'test-guild-id',
      deferReply: jest.fn(),
      editReply: jest.fn(),
      followUp: jest.fn()
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
        successRate: 50.0
      };

      axios.get.mockResolvedValue({
        data: { stealStats: mockStats }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3000/users/987654321/steal-stats',
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      const errorMessage = 'User not found';
      axios.get.mockRejectedValue({
        response: {
          data: { message: errorMessage }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    test('should handle unexpected errors', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe('Do Subcommand', () => {
    beforeEach(() => {
      mockInteraction.options.getSubcommand.mockReturnValue('do');
      mockInteraction.options.getUser.mockReturnValue(mockTargetUser);
    });

    test('should handle successful steal', async () => {
      const mockResponse = {
        success: true,
        stolenAmount: 50000,
        newBalance: 150000,
        jailTimeMinutes: 0,
        cooldownTime: new Date()
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/users/987654321/steal',
        {
          targetDiscordId: '123456789'
        },
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    test('should handle failed steal', async () => {
      const mockResponse = {
        success: false,
        stolenAmount: 0,
        newBalance: 100000,
        jailTimeMinutes: 30,
        cooldownTime: new Date()
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    test('should handle cooldown errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 429,
          data: { message: 'You must wait 1 hour before stealing again' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    test('should handle jailed user errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: { message: 'You are currently jailed and cannot steal' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    test('should handle self-steal errors', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: { message: 'You cannot steal from yourself' }
        }
      });

      await stealCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe('Command Structure', () => {
    test('should have correct command data structure', () => {
      expect(stealCommand.data).toBeInstanceOf(SlashCommandBuilder);
      expect(stealCommand.data.name).toBe('steal');
      expect(stealCommand.data.description).toBe('Attempt to steal points from another user (30% success rate, 2-hour cooldown)');
    });

    test('should have both do and stats subcommands', () => {
      const commandData = stealCommand.data.toJSON();
      expect(commandData.options).toHaveLength(2);
      
      const doSubcommand = commandData.options.find(opt => opt.name === 'do');
      const statsSubcommand = commandData.options.find(opt => opt.name === 'stats');
      
      expect(doSubcommand).toBeDefined();
      expect(statsSubcommand).toBeDefined();
      expect(doSubcommand.options).toHaveLength(1);
      expect(doSubcommand.options[0].name).toBe('target');
      expect(statsSubcommand.options).toHaveLength(0);
    });
  });
}); 