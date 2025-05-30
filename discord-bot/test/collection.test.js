const collectionCommand = require('../commands/collection');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

jest.mock('../utils/responseHandler');
jest.mock('../utils/logger');

describe('collection command edge cases', () => {
  let interaction;

  beforeEach(() => {
    interaction = {
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue(),
      followUp: jest.fn().mockResolvedValue(),
      replied: false,
      user: { id: '123', tag: 'TestUser#0001' },
      guildId: '456',
      options: { getString: jest.fn(), getUser: jest.fn() }
    };
    jest.clearAllMocks();
  });

  it('handles robust interaction pattern', async () => {
    await collectionCommand.execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('handles error gracefully', async () => {
    interaction.options.getString.mockImplementation(() => { throw new Error('Test error'); });
    await collectionCommand.execute(interaction);
    expect(ResponseHandler.handleError).toHaveBeenCalled();
  });
}); 