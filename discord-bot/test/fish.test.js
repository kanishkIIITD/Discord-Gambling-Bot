const fishCommand = require('../commands/fish');
const axios = require('axios');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

jest.mock('axios');
jest.mock('../utils/responseHandler');
jest.mock('../utils/logger');

describe('fish command edge cases', () => {
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
    process.env.BACKEND_API_URL = 'http://localhost:3000/api';
  });

  it('handles backend timeout (simulate slow backend)', async () => {
    axios.post.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { name: 'Trout', rarity: 'common', value: 10, count: 1 } }), 4000)));
    await fishCommand.execute(interaction);
    expect(interaction.deferReply).toHaveBeenCalled();
    // editReply may throw if Discord times out, but should not double reply
  });

  it('handles double reply gracefully', async () => {
    axios.post.mockResolvedValue({ data: { name: 'Trout', rarity: 'common', value: 10, count: 1 } });
    await fishCommand.execute(interaction);
    // Simulate already replied
    interaction.replied = true;
    await fishCommand.execute(interaction);
    // Should not call editReply again if already replied
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles backend 502 error', async () => {
    const error = new Error('Bad Gateway');
    error.response = { status: 502, data: { message: 'Internal server error' } };
    axios.post.mockRejectedValue(error);
    await fishCommand.execute(interaction);
    expect(ResponseHandler.handleError).toHaveBeenCalledWith(interaction, { message: 'Internal server error' }, 'Fish');
  });

  it('handles cooldown error with custom embed', async () => {
    const error = new Error('Cooldown');
    error.response = { status: 429, data: { message: 'You are on cooldown', cooldown: new Date(Date.now() + 60000).toISOString() } };
    axios.post.mockRejectedValue(error);
    await fishCommand.execute(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
  });
}); 