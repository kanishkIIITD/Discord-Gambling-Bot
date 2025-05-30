const duelCommand = require('../commands/duel');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

jest.mock('../utils/responseHandler');
jest.mock('../utils/logger');

describe('duel command edge cases', () => {
  let interaction;

  beforeEach(() => {
    interaction = {
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue(),
      followUp: jest.fn().mockResolvedValue(),
      replied: false,
      user: { id: '123', tag: 'TestUser#0001' },
      guildId: '456',
      options: {
        getString: jest.fn(),
        getUser: jest.fn(),
        getSubcommand: jest.fn().mockReturnValue('challenge')
      }
    };
    jest.clearAllMocks();
    process.env.BACKEND_API_URL = 'http://localhost:3000/api';
  });

  it('handles robust interaction pattern', async () => {
    await duelCommand.execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('handles error gracefully', async () => {
    interaction.options.getSubcommand.mockImplementation(() => { throw new Error('Test error'); });
    await expect(duelCommand.execute(interaction)).rejects.toThrow('Test error');
  });
}); 