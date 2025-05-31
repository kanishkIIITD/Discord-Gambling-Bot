const axios = require('axios');
jest.mock('axios');

const { EmbedBuilder } = require('discord.js');

describe('/coinflip command', () => {
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
      if (name === 'choice') return 'heads';
      if (name === 'amount') return '100';
      return null;
    });
    axios.post.mockResolvedValue({ data: { result: 'heads', won: true, winnings: 200, newBalance: 900 } });
    axios.get.mockResolvedValue({ data: { balance: 1000 } });
    // Simulate the handler logic from index.js here (or refactor for importable function)
    // ...
    // For now, just check that axios.post is called with correct amount
    // (In real test, you would call the handler function)
    // expect(axios.post).toHaveBeenCalledWith(..., { choice: 'heads', amount: 100 }, ...);
  });

  it('handles "allin" amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'choice') return 'tails';
      if (name === 'amount') return 'allin';
      return null;
    });
    axios.get.mockResolvedValue({ data: { balance: 500 } });
    axios.post.mockResolvedValue({ data: { result: 'tails', won: false, winnings: 0, newBalance: 0 } });
    // ...
    // expect(axios.post).toHaveBeenCalledWith(..., { choice: 'tails', amount: 500 }, ...);
  });

  it('handles invalid amount', async () => {
    interaction.options.getString.mockImplementation((name) => {
      if (name === 'choice') return 'heads';
      if (name === 'amount') return 'notanumber';
      return null;
    });
    // ...
    // expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(EmbedBuilder)] }));
  });
}); 