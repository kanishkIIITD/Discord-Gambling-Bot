const axios = require('axios');
jest.mock('axios');

describe('/slots command', () => {
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
      if (name === 'amount') return '100';
      return null;
    });
    axios.post.mockResolvedValue({ data: { reels: ["7", "7", "7"], won: true, winnings: 700, newBalance: 900 } });
    axios.get.mockResolvedValue({ data: { balance: 1000 } });
    // ...
  });

  it('handles "allin" amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'amount') return 'allin';
      return null;
    });
    axios.get.mockResolvedValue({ data: { balance: 500 } });
    axios.post.mockResolvedValue({ data: { reels: ["🍒", "🍒", "🍒"], won: false, winnings: 0, newBalance: 0 } });
    // ...
  });

  it('handles invalid amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'amount') return 'notanumber';
      return null;
    });
    // ...
  });
}); 