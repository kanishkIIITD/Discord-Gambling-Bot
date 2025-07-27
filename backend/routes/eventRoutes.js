const express = require('express');
const router = express.Router();
const GlobalEvent = require('../models/GlobalEvent');
const weekendScheduler = require('../utils/weekendScheduler');
const { requireGuildId } = require('../middleware/auth');

// GET /events/double-weekend/status - Check if double weekend is active
router.get('/double-weekend/status', async (req, res) => {
  try {
    const isActive = await GlobalEvent.isDoubleWeekendActive();
    const activeEvent = await GlobalEvent.getActiveDoubleWeekend();
    
    res.json({
      isActive,
      event: activeEvent ? {
        startTime: activeEvent.startTime,
        endTime: activeEvent.endTime,
        multiplier: activeEvent.multiplier,
        description: activeEvent.description
      } : null
    });
  } catch (error) {
    console.error('Error checking double weekend status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /events/double-weekend/start - Start double weekend event (admin only)
router.post('/double-weekend/start', requireGuildId, async (req, res) => {
  try {
    const { durationHours = 48, description = 'Double XP and Stardust Weekend!' } = req.body;
    const createdBy = req.user?.discordId || 'system';
    
    // Check if there's already an active double weekend
    const existingEvent = await GlobalEvent.getActiveDoubleWeekend();
    if (existingEvent) {
      return res.status(400).json({ 
        message: 'Double weekend is already active!',
        event: {
          startTime: existingEvent.startTime,
          endTime: existingEvent.endTime,
          description: existingEvent.description
        }
      });
    }
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
    
    const event = new GlobalEvent({
      eventType: 'double_weekend',
      isActive: true,
      startTime,
      endTime,
      multiplier: 2.0,
      description,
      createdBy
    });
    
    await event.save();
    
    res.json({
      message: 'Double weekend event started successfully!',
      event: {
        startTime: event.startTime,
        endTime: event.endTime,
        multiplier: event.multiplier,
        description: event.description
      }
    });
  } catch (error) {
    console.error('Error starting double weekend event:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /events/double-weekend/stop - Stop double weekend event (admin only)
router.post('/double-weekend/stop', requireGuildId, async (req, res) => {
  try {
    const activeEvent = await GlobalEvent.getActiveDoubleWeekend();
    
    if (!activeEvent) {
      return res.status(400).json({ message: 'No active double weekend event found.' });
    }
    
    activeEvent.isActive = false;
    activeEvent.endTime = new Date();
    await activeEvent.save();
    
    res.json({
      message: 'Double weekend event stopped successfully!',
      event: {
        startTime: activeEvent.startTime,
        endTime: activeEvent.endTime,
        description: activeEvent.description
      }
    });
  } catch (error) {
    console.error('Error stopping double weekend event:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /events/double-weekend/history - Get recent double weekend events
router.get('/double-weekend/history', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const events = await GlobalEvent.find({
      eventType: 'double_weekend'
    })
    .sort({ startTime: -1 })
    .limit(parseInt(limit))
    .select('startTime endTime isActive description createdBy');
    
    res.json({ events });
  } catch (error) {
    console.error('Error fetching double weekend history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /events/weekend/status - Get weekend scheduling status
router.get('/weekend/status', async (req, res) => {
  try {
    const status = await weekendScheduler.getWeekendStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting weekend status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /events/weekend/start - Manually start a weekend event (admin only)
router.post('/weekend/start', requireGuildId, async (req, res) => {
  try {
    await weekendScheduler.startWeekendEvent();
    res.json({ message: 'Weekend event started successfully!' });
  } catch (error) {
    console.error('Error starting weekend event:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /events/weekend/stop - Manually stop the current weekend event (admin only)
router.post('/weekend/stop', requireGuildId, async (req, res) => {
  try {
    await weekendScheduler.endWeekendEvent();
    res.json({ message: 'Weekend event stopped successfully!' });
  } catch (error) {
    console.error('Error stopping weekend event:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 