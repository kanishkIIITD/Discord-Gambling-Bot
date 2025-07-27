const GlobalEvent = require('../models/GlobalEvent');
const axios = require('axios');

class WeekendScheduler {
  constructor() {
    this.weekendTimer = null;
    this.weekendEndTimer = null;
    this.isInitialized = false;
  }

  // Initialize the weekend scheduler
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('[WeekendScheduler] Initializing weekend event scheduler...');
    
    // Check if there's already an active weekend event
    const activeEvent = await GlobalEvent.getActiveDoubleWeekend();
    if (activeEvent) {
      console.log('[WeekendScheduler] Found active weekend event, scheduling end timer');
      this.scheduleWeekendEnd(activeEvent.endTime);
    } else {
      // Schedule next weekend start
      this.scheduleNextWeekend();
    }
    
    this.isInitialized = true;
    console.log('[WeekendScheduler] Weekend scheduler initialized');
  }

  // Schedule the next weekend event
  scheduleNextWeekend() {
    const now = new Date();
    const nextWeekend = this.getNextWeekendStart();
    
    const timeUntilWeekend = nextWeekend.getTime() - now.getTime();
    
    console.log(`[WeekendScheduler] Next weekend scheduled for: ${nextWeekend.toLocaleString()}`);
    console.log(`[WeekendScheduler] Time until weekend: ${Math.round(timeUntilWeekend / (1000 * 60 * 60))} hours`);
    
    this.weekendTimer = setTimeout(async () => {
      await this.startWeekendEvent();
    }, timeUntilWeekend);
  }

  // Schedule the end of a weekend event
  scheduleWeekendEnd(endTime) {
    const now = new Date();
    const timeUntilEnd = endTime.getTime() - now.getTime();
    
    if (timeUntilEnd > 0) {
      console.log(`[WeekendScheduler] Weekend event ends at: ${endTime.toLocaleString()}`);
      console.log(`[WeekendScheduler] Time until end: ${Math.round(timeUntilEnd / (1000 * 60 * 60))} hours`);
      
      this.weekendEndTimer = setTimeout(async () => {
        await this.endWeekendEvent();
      }, timeUntilEnd);
    }
  }

  // Get the next weekend start (Friday 6 PM)
  getNextWeekendStart() {
    const now = new Date();
    const friday = new Date(now);
    
    // Set to Friday 6 PM
    friday.setHours(18, 0, 0, 0);
    
    // If today is Friday and it's past 6 PM, get next Friday
    if (now.getDay() === 5 && now.getHours() >= 18) {
      friday.setDate(friday.getDate() + 7);
    } else {
      // Get this Friday or next Friday
      const daysUntilFriday = (5 - now.getDay() + 7) % 7;
      friday.setDate(friday.getDate() + daysUntilFriday);
    }
    
    return friday;
  }

  // Get the weekend end (Sunday 11:59 PM)
  getWeekendEnd(startTime) {
    const endTime = new Date(startTime);
    endTime.setDate(endTime.getDate() + 2); // Sunday
    endTime.setHours(23, 59, 59, 999);
    return endTime;
  }

  // Start a weekend event
  async startWeekendEvent() {
    try {
      console.log('[WeekendScheduler] Starting automatic weekend event...');
      
      // Check if there's already an active event
      const existingEvent = await GlobalEvent.getActiveDoubleWeekend();
      if (existingEvent) {
        console.log('[WeekendScheduler] Event already active, skipping weekend start');
        return;
      }

      const startTime = new Date();
      const endTime = this.getWeekendEnd(startTime);
      
      const weekendEvent = new GlobalEvent({
        eventType: 'double_weekend',
        isActive: true,
        startTime,
        endTime,
        multiplier: 2.0,
        description: '🎉 Automatic Weekend Event - Double XP & Stardust!',
        createdBy: 'system'
      });

      await weekendEvent.save();
      
      console.log('[WeekendScheduler] Weekend event started successfully');
      console.log(`[WeekendScheduler] Event runs until: ${endTime.toLocaleString()}`);
      
      // Schedule the end of this weekend event
      this.scheduleWeekendEnd(endTime);
      
      // Schedule next weekend
      this.scheduleNextWeekend();
      
      // Send announcements to all servers
      await this.sendWeekendAnnouncements('start', weekendEvent);
      
    } catch (error) {
      console.error('[WeekendScheduler] Error starting weekend event:', error);
    }
  }

  // End a weekend event
  async endWeekendEvent() {
    try {
      console.log('[WeekendScheduler] Ending weekend event...');
      
      const activeEvent = await GlobalEvent.getActiveDoubleWeekend();
      if (activeEvent) {
        activeEvent.isActive = false;
        activeEvent.endTime = new Date();
        await activeEvent.save();
        
        console.log('[WeekendScheduler] Weekend event ended successfully');
        
        // Send announcements to all servers
        await this.sendWeekendAnnouncements('end', activeEvent);
      }
      
      // Schedule next weekend
      this.scheduleNextWeekend();
      
    } catch (error) {
      console.error('[WeekendScheduler] Error ending weekend event:', error);
    }
  }

  // Send announcements to all servers
  async sendWeekendAnnouncements(type, event) {
    try {
      console.log(`[WeekendScheduler] ${type === 'start' ? 'Starting' : 'Ending'} weekend event announcement sent to all servers`);
      console.log(`[WeekendScheduler] Event: ${event.description}`);
      console.log(`[WeekendScheduler] Duration: ${Math.round((event.endTime - event.startTime) / (1000 * 60 * 60))} hours`);
      
      // Store the announcement data for the Discord bot to pick up
      // In a production environment, you might use a message queue or database flag
      global.weekendAnnouncement = {
        type,
        event,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('[WeekendScheduler] Error sending announcements:', error);
    }
  }

  // Get current weekend status
  async getWeekendStatus() {
    const activeEvent = await GlobalEvent.getActiveDoubleWeekend();
    const nextWeekend = this.getNextWeekendStart();
    
    return {
      isActive: !!activeEvent,
      activeEvent,
      nextWeekendStart: nextWeekend,
      timeUntilNextWeekend: nextWeekend.getTime() - new Date().getTime()
    };
  }

  // Cleanup timers
  cleanup() {
    if (this.weekendTimer) {
      clearTimeout(this.weekendTimer);
      this.weekendTimer = null;
    }
    if (this.weekendEndTimer) {
      clearTimeout(this.weekendEndTimer);
      this.weekendEndTimer = null;
    }
  }
}

// Create singleton instance
const weekendScheduler = new WeekendScheduler();

module.exports = weekendScheduler; 