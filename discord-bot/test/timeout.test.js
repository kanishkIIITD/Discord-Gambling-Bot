const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

// Mock the discordUtils module
jest.mock('../utils/discordUtils', () => ({
    timeoutUser: jest.fn(),
    createErrorEmbed: jest.fn(() => ({
        setDescription: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis()
    })),
    createSuccessEmbed: jest.fn(() => ({
        addFields: jest.fn().mockReturnThis()
    })),
    sendLogToChannel: jest.fn()
}));

jest.mock('axios');

describe('Timeout Command', () => {
    let interaction;
    let mockGuild;
    let mockTargetMember;
    let timeoutUser;
    let createSuccessEmbed;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Get mocked functions
        const discordUtils = require('../utils/discordUtils');
        timeoutUser = discordUtils.timeoutUser;
        createSuccessEmbed = discordUtils.createSuccessEmbed;

        // Mock guild
        mockGuild = {
            members: {
                fetch: jest.fn()
            },
            members: {
                me: {
                    permissions: {
                        has: jest.fn().mockReturnValue(true)
                    }
                }
            }
        };

        // Mock target member
        mockTargetMember = {
            moderatable: true,
            communicationDisabledUntil: null
        };

        // Mock interaction
        interaction = {
            deferReply: jest.fn().mockResolvedValue(),
            editReply: jest.fn().mockResolvedValue(),
            user: { id: '123', tag: 'TestUser#0001' },
            guildId: '456',
            guild: mockGuild,
            options: {
                getUser: jest.fn().mockReturnValue({ id: '789', username: 'TargetUser' }),
                getInteger: jest.fn().mockReturnValue(5),
                getString: jest.fn().mockReturnValue('Test reason')
            }
        };

        // Mock guild.members.fetch
        mockGuild.members.fetch = jest.fn().mockResolvedValue(mockTargetMember);

        // Mock axios
        axios.post.mockResolvedValue({
            data: {
                message: 'Successfully timed out user',
                cost: 500000,
                remainingBalance: 500000,
                cooldownTime: new Date(),
                totalDuration: 5,
                additionalDuration: 5
            }
        });

        // Mock timeoutUser
        timeoutUser.mockResolvedValue({ applied: true });
    });

    test('should call timeoutUser with correct parameters', async () => {
        const timeoutCommand = require('../commands/timeout');

        await timeoutCommand.execute(interaction);

        // Verify that timeoutUser was called with correct parameters
        expect(timeoutUser).toHaveBeenCalledWith(
            mockGuild,
            '789',
            5 * 60, // 5 minutes in seconds (additional duration)
            'Test reason'
        );

        // Verify that editReply was called (success case)
        expect(interaction.editReply).toHaveBeenCalled();
    });

    test('should handle case where timeout extends existing timeout', async () => {
        // Mock timeoutUser to return that timeout was extended
        timeoutUser.mockResolvedValue({ 
            applied: true, 
            existingTimeout: 10,
            totalTimeout: 15
        });

        const timeoutCommand = require('../commands/timeout');

        await timeoutCommand.execute(interaction);

        // Verify that timeoutUser was called
        expect(timeoutUser).toHaveBeenCalledWith(
            mockGuild,
            '789',
            5 * 60,
            'Test reason'
        );

        // Verify that editReply was called (success case with extension note)
        expect(interaction.editReply).toHaveBeenCalled();

        // Get the embed instance that was used
        const embedInstance = createSuccessEmbed.mock.results[0].value;
        expect(embedInstance.addFields).toHaveBeenCalledWith(
            expect.objectContaining({
                name: '⏰ Timeout Extended',
                value: expect.stringContaining('User already had 10 minute(s) remaining')
            })
        );
    });

    test('should handle backend error gracefully', async () => {
        // Mock axios to throw an error
        axios.post.mockRejectedValue({
            response: {
                status: 400,
                data: { message: 'Insufficient balance' }
            }
        });

        const timeoutCommand = require('../commands/timeout');

        await timeoutCommand.execute(interaction);

        // Verify that editReply was called (error case)
        expect(interaction.editReply).toHaveBeenCalled();
        
        // Verify that timeoutUser was not called due to backend error
        expect(timeoutUser).not.toHaveBeenCalled();
    });
}); 