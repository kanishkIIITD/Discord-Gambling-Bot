const express = require('express');
const router = express.Router();
const ServerSettings = require('../models/ServerSettings');
const { requireGuildId } = require('../middleware/auth');

// Get server settings
router.get('/:guildId/settings', requireGuildId, async (req, res) => {
    try {
        let settings = await ServerSettings.findOne({ guildId: req.params.guildId });
        
        if (!settings) {
            settings = new ServerSettings({ guildId: req.params.guildId });
            await settings.save();
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching server settings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update server settings
router.post('/:guildId/settings', requireGuildId, async (req, res) => {
    try {
        const { logChannelId } = req.body;

        let settings = await ServerSettings.findOne({ guildId: req.params.guildId });
        
        if (!settings) {
            settings = new ServerSettings({ guildId: req.params.guildId });
        }

        if (logChannelId !== undefined) {
            settings.logChannelId = logChannelId;
        }

        await settings.save();
        res.json(settings);
    } catch (error) {
        console.error('Error updating server settings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router; 