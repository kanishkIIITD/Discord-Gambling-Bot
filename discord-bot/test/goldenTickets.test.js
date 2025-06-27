const goldenTickets = require('../commands/goldenTickets');
const redeemGoldenTicket = require('../commands/redeemGoldenTicket');
const axios = require('axios');
jest.mock('axios');

const mockInteraction = (overrides = {}) => ({
  user: { id: '123', tag: 'TestUser#0001' },
  guildId: 'guild1',
  deferReply: jest.fn().mockResolvedValue(),
  editReply: jest.fn().mockResolvedValue(),
  followUp: jest.fn().mockResolvedValue(),
  replied: false,
  ...overrides
});

describe('Golden Ticket Discord Bot Commands', () => {
  afterEach(() => jest.clearAllMocks());

  describe('/golden-tickets', () => {
    it('shows 0 tickets', async () => {
      axios.get.mockResolvedValue({ data: { goldenTicketCount: 0 } });
      const interaction = mockInteraction();
      await goldenTickets.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: [expect.objectContaining({ description: expect.stringMatching(/(?:\*\*0\*\*|0)\s*golden tickets/i) })]
      }));
    });
    it('shows 1 ticket', async () => {
      axios.get.mockResolvedValue({ data: { goldenTicketCount: 1 } });
      const interaction = mockInteraction();
      await goldenTickets.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: [expect.objectContaining({ description: expect.stringContaining('1') })]
      }));
    });
    it('shows multiple tickets', async () => {
      axios.get.mockResolvedValue({ data: { goldenTicketCount: 5 } });
      const interaction = mockInteraction();
      await goldenTickets.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: [expect.objectContaining({ description: expect.stringContaining('5') })]
      }));
    });
    it('handles backend error', async () => {
      axios.get.mockRejectedValue({ response: { data: { message: 'Backend error' } } });
      const interaction = mockInteraction();
      interaction.editReply = jest.fn().mockResolvedValue();
      interaction.followUp = jest.fn().mockResolvedValue();
      await goldenTickets.execute(interaction);
      expect(
        interaction.editReply.mock.calls.length > 0 || interaction.followUp.mock.calls.length > 0
      ).toBe(true);
    });
  });

  describe('/redeem-golden-ticket', () => {
    it('redeems successfully', async () => {
      axios.post.mockResolvedValue({ data: { payout: 1000, newBalance: 2000, jackpotPool: 9000, message: 'Success!' } });
      const interaction = mockInteraction();
      await redeemGoldenTicket.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: [expect.objectContaining({ title: expect.stringMatching(/success|redeemed/i) })]
      }));
    });
    it('handles cooldown error', async () => {
      axios.post.mockRejectedValue({ response: { status: 429, data: { message: 'You can redeem another golden ticket after' } } });
      const interaction = mockInteraction();
      await redeemGoldenTicket.execute(interaction);
      const call = interaction.editReply.mock.calls[0]?.[0];
      expect(
        (call.embeds && call.embeds[0].title && /cooldown/i.test(call.embeds[0].title)) ||
        (call.embeds && call.embeds[0].description && /redeem another golden ticket after/i.test(call.embeds[0].description))
      ).toBe(true);
    });
    it('handles no ticket error', async () => {
      axios.post.mockRejectedValue({ response: { data: { message: 'do not have a Golden Ticket' } } });
      const interaction = mockInteraction();
      await redeemGoldenTicket.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: [expect.objectContaining({
          title: '❌ Error',
          description: expect.stringMatching(/golden ticket/i)
        })]
      }));
    });
    it('handles empty jackpot error', async () => {
      axios.post.mockRejectedValue({ response: { data: { message: 'jackpot pool is empty' } } });
      const interaction = mockInteraction();
      await redeemGoldenTicket.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: [expect.objectContaining({ description: expect.stringMatching(/jackpot pool is empty/i) })]
      }));
    });
    it('handles too small jackpot error', async () => {
      axios.post.mockRejectedValue({ response: { data: { message: 'Jackpot pool is too small' } } });
      const interaction = mockInteraction();
      await redeemGoldenTicket.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: [expect.objectContaining({ description: expect.stringMatching(/too small/i) })]
      }));
    });
    it('handles generic backend error', async () => {
      axios.post.mockRejectedValue(new Error('Backend error'));
      const interaction = mockInteraction();
      await redeemGoldenTicket.execute(interaction);
      const calledEdit = interaction.editReply.mock.calls.length > 0;
      const calledFollow = interaction.followUp && interaction.followUp.mock.calls.length > 0;
      expect(calledEdit || calledFollow).toBe(true);
    });
  });
}); 