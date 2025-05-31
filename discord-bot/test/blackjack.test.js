const axios = require('axios');
jest.mock('axios');

describe('/blackjack command', () => {
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

  it('starts a new game with numeric amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'amount') return '100';
      if (name === 'action') return null;
      return null;
    });
    axios.post.mockResolvedValue({ data: { gameOver: false, playerHands: [[]], dealerHand: [], newBalance: 900, results: [] } });
    axios.get.mockResolvedValue({ data: { balance: 1000 } });
    // ...
  });

  it('starts a new game with "allin" amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'amount') return 'allin';
      if (name === 'action') return null;
      return null;
    });
    axios.get.mockResolvedValue({ data: { balance: 500 } });
    axios.post.mockResolvedValue({ data: { gameOver: false, playerHands: [[]], dealerHand: [], newBalance: 400, results: [] } });
    // ...
  });

  it('performs an action (hit) without amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'action') return 'hit';
      if (name === 'amount') return null;
      return null;
    });
    axios.post.mockResolvedValue({ data: { gameOver: false, playerHands: [[]], dealerHand: [], newBalance: 400, results: [] } });
    // ...
  });

  it('handles invalid amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'amount') return 'notanumber';
      if (name === 'action') return null;
      return null;
    });
    // ...
  });
}); 