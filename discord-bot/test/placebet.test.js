const axios = require('axios');
jest.mock('axios');

describe('/placebet command', () => {
  let interaction;
  beforeEach(() => {
    interaction = {
      deferReply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue(),
      replied: false,
      user: { id: '123', username: 'TestUser' },
      guildId: '456',
      options: {
        getString: jest.fn(),
        getInteger: jest.fn()
      }
    };
    jest.clearAllMocks();
    process.env.BACKEND_API_URL = 'http://localhost:3000/api';
  });

  it('handles numeric amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'bet_id') return 'bet123';
      if (name === 'option') return 'Yes';
      if (name === 'amount') return '100';
      return null;
    });
    axios.post.mockResolvedValue({ data: {} });
    axios.get.mockResolvedValue({ data: { balance: 1000 } });
    // ...
  });

  it('handles "allin" amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'bet_id') return 'bet123';
      if (name === 'option') return 'No';
      if (name === 'amount') return 'allin';
      return null;
    });
    axios.get.mockResolvedValue({ data: { balance: 500 } });
    axios.post.mockResolvedValue({ data: {} });
    // ...
  });

  it('handles invalid amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'bet_id') return 'bet123';
      if (name === 'option') return 'Yes';
      if (name === 'amount') return 'notanumber';
      return null;
    });
    // ...
  });
}); 