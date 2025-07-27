const mongoose = require('mongoose');
const BattleSession = require('../models/BattleSession');
require('dotenv').config();

// Configuration
const BATTLE_TIMEOUT_MINUTES = 60; // Battles will be auto-cancelled after 60 minutes
const CLEANUP_INTERVAL_MINUTES = 5; // Run cleanup every 5 minutes

async function cleanupStuckBattles() {
  try {
    console.log(`[Battle Cleanup] Starting cleanup at ${new Date().toISOString()}`);
    
    const timeoutThreshold = new Date(Date.now() - (BATTLE_TIMEOUT_MINUTES * 60 * 1000));
    
    // Find all active battles that are older than the timeout threshold
    const stuckBattles = await BattleSession.find({
      status: 'active',
      updatedAt: { $lt: timeoutThreshold }
    });
    
    if (stuckBattles.length === 0) {
      console.log('[Battle Cleanup] No stuck battles found');
      return;
    }
    
    console.log(`[Battle Cleanup] Found ${stuckBattles.length} stuck battles to clean up`);
    
    for (const battle of stuckBattles) {
      try {
        // Cancel the battle
        battle.status = 'cancelled';
        battle.log.push({
          side: 'system',
          text: `Battle automatically cancelled after ${BATTLE_TIMEOUT_MINUTES} minutes of inactivity`
        });
        
        await battle.save();
        
        console.log(`[Battle Cleanup] Cancelled battle ${battle._id} between ${battle.challengerId} and ${battle.opponentId}`);
      } catch (error) {
        console.error(`[Battle Cleanup] Error cancelling battle ${battle._id}:`, error);
      }
    }
    
    console.log(`[Battle Cleanup] Cleanup completed. Cancelled ${stuckBattles.length} battles`);
  } catch (error) {
    console.error('[Battle Cleanup] Error during cleanup:', error);
  }
}

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Battle Cleanup] Connected to MongoDB');
  } catch (error) {
    console.error('[Battle Cleanup] MongoDB connection error:', error);
    process.exit(1);
  }
}

// Main function
async function main() {
  await connectDB();
  
  // Run initial cleanup
  await cleanupStuckBattles();
  
  // Set up periodic cleanup
  setInterval(cleanupStuckBattles, CLEANUP_INTERVAL_MINUTES * 60 * 1000);
  
  console.log(`[Battle Cleanup] Cleanup service started. Will run every ${CLEANUP_INTERVAL_MINUTES} minutes`);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[Battle Cleanup] Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { cleanupStuckBattles }; 