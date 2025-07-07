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

// Set the Pokémon spawn channel for a guild
router.post('/:guildId/pokechannel', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channelId } = req.body;
    let settings = await ServerSettings.findOne({ guildId });
    if (!settings) {
      settings = new ServerSettings({ guildId });
    }
    settings.pokeSpawnChannelId = channelId;
    await settings.save();
    res.json({ message: 'Pokémon spawn channel set!', channelId });
  } catch (error) {
    console.error('[Set PokeChannel] Error:', error);
    res.status(500).json({ message: 'Failed to set Pokémon spawn channel.' });
  }
});

// Get the Pokémon spawn channel for a guild
router.get('/:guildId/pokechannel', async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = await ServerSettings.findOne({ guildId });
    res.json({ channelId: settings?.pokeSpawnChannelId || null });
  } catch (error) {
    console.error('[Get PokeChannel] Error:', error);
    res.status(500).json({ message: 'Failed to get Pokémon spawn channel.' });
  }
});

// Get all guilds with a pokeSpawnChannelId set
router.get('/pokechannels', async (req, res) => {
  try {
    const servers = await ServerSettings.find({ pokeSpawnChannelId: { $ne: null } });
    res.json({ servers });
  } catch (error) {
    console.error('[Get All PokeChannels] Error:', error);
    res.status(500).json({ message: 'Failed to fetch servers with pokeSpawnChannelId.' });
  }
});

module.exports = router; 