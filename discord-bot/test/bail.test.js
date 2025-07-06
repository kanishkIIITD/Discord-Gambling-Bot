const axios = require('axios');
const { SlashCommandBuilder } = require('discord.js');
const bailCommand = require('../commands/bail');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

jest.mock('../utils/responseHandler');
jest.mock('../utils/logger');

// Mock axios
jest.mock('axios');

// Mock environment variable
process.env.BACKEND_API_URL = 'http://localhost:3000';

describe('Bail Command', () => {
  let mockInteraction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockInteraction = {
      user: {
        id: '123456789',
        tag: 'TestUser#1234'
      },
      options: {
        getUser: jest.fn(),
        getBoolean: jest.fn()
      },
      deferReply: jest.fn(),
      editReply: jest.fn(),
      guildId: 'test-guild-id'
    };
  });

  describe('Single User Bail', () => {
    beforeEach(() => {
      mockInteraction.options.getUser.mockReturnValue({
        id: '987654321',
        tag: 'TargetUser#5678'
      });
      mockInteraction.options.getBoolean.mockReturnValue(false);
    });

    test('should handle successful bail with new system', async () => {
      const mockResponse = {
        message: 'You bailed out <@987654321> for 50,000 points!',
        bailCost: 50000,
        minutesLeft: 30
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await bailCommand.execute(mockInteraction);

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/users/123456789/bail',
        {
          targetDiscordId: '987654321',
          guildId: 'test-guild-id'
        },
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    test('should handle successful bail with old system fallback', async () => {
      const mockResponse = {
        message: 'You bailed out <@987654321> for 40,000 points!',
        bailCost: 40000,
        minutesLeft: 30
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await bailCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe('Mass Bail', () => {
    beforeEach(() => {
      mockInteraction.options.getUser.mockReturnValue(null);
      mockInteraction.options.getBoolean.mockReturnValue(true);
    });

    test('should handle successful mass bail', async () => {
      const mockResponse = {
        message: 'Successfully bailed out 2 users for 100,000 points!',
        totalCost: 100000,
        bailedUsers: [
          { discordId: '111111111', username: 'User1', bailCost: 50000, minutesLeft: 30 },
          { discordId: '222222222', username: 'User2', bailCost: 50000, minutesLeft: 45 }
        ],
        failedUsers: []
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await bailCommand.execute(mockInteraction);

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/users/123456789/bail-all',
        { guildId: 'test-guild-id' },
        {
          headers: {
            'x-guild-id': 'test-guild-id'
          }
        }
      );
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    test('should handle mass bail with some failures', async () => {
      const mockResponse = {
        message: 'Successfully bailed out 1 users for 50,000 points!\n1 users could not be bailed out.',
        totalCost: 50000,
        bailedUsers: [
          { discordId: '111111111', username: 'User1', bailCost: 50000, minutesLeft: 30 }
        ],
        failedUsers: [
          { discordId: '222222222', username: 'User2', reason: 'Insufficient balance' }
        ]
      };

      axios.post.mockResolvedValue({
        data: mockResponse
      });

      await bailCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors', async () => {
      const errorMessage = 'Insufficient balance';
      axios.post.mockRejectedValue({
        response: {
          data: { message: errorMessage }
        }
      });

      await bailCommand.execute(mockInteraction);

      expect(ResponseHandler.handleError).toHaveBeenCalled();
    });

    test('should handle network errors', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await bailCommand.execute(mockInteraction);

      expect(ResponseHandler.handleError).toHaveBeenCalled();
    });
  });
}); 