const bailCommand = require('../commands/bail');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

jest.mock('../utils/responseHandler');
jest.mock('../utils/logger');

describe('bail command edge cases', () => {
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
        getBoolean: jest.fn()
      }
    };
    jest.clearAllMocks();
  });

  it('handles robust interaction pattern', async () => {
    await bailCommand.execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('handles error gracefully', async () => {
    interaction.options.getString.mockImplementation(() => { throw new Error('Test error'); });
    await bailCommand.execute(interaction);
    expect(ResponseHandler.handleError).toHaveBeenCalled();
  });

  it('validates input when neither user nor all is specified', async () => {
    interaction.options.getUser.mockReturnValue(null);
    interaction.options.getBoolean.mockReturnValue(false);
    
    await bailCommand.execute(interaction);
    
    expect(ResponseHandler.handleError).toHaveBeenCalledWith(
      interaction, 
      { message: 'Please specify either a user to bail or set "all" to true to bail all jailed users.' }, 
      'Bail'
    );
  });

  it('validates input when both user and all are specified', async () => {
    interaction.options.getUser.mockReturnValue({ id: '789' });
    interaction.options.getBoolean.mockReturnValue(true);
    
    await bailCommand.execute(interaction);
    
    expect(ResponseHandler.handleError).toHaveBeenCalledWith(
      interaction, 
      { message: 'Cannot specify both a user and "all" option. Please choose one or the other.' }, 
      'Bail'
    );
  });
}); 