require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function cleanupBuffs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);

    let totalUsersUpdated = 0;
    let totalBuffsRemoved = 0;

    for (const user of users) {
      if (!user.buffs || !Array.isArray(user.buffs) || user.buffs.length === 0) {
        continue;
      }

      const originalBuffCount = user.buffs.length;
      const buffMap = new Map();

      // Process each buff
      for (const buff of user.buffs) {
        const key = buff.type;
        const now = new Date();

        if (!buffMap.has(key)) {
          // First occurrence of this buff type
          buffMap.set(key, { ...buff });
        } else {
          const existingBuff = buffMap.get(key);

          if (buff.expiresAt) {
            // For rate buffs (with expiresAt)
            if (!existingBuff.expiresAt || buff.expiresAt > existingBuff.expiresAt) {
              // Keep the one with longer duration
              buffMap.set(key, { ...buff });
            }
          } else if (buff.usesLeft) {
            // For use-based buffs (with usesLeft)
            existingBuff.usesLeft = (existingBuff.usesLeft || 0) + (buff.usesLeft || 0);
            buffMap.set(key, existingBuff);
          }
        }
      }

      // Convert map back to array and filter out expired buffs
      const cleanedBuffs = Array.from(buffMap.values()).filter(buff => {
        if (buff.expiresAt && buff.expiresAt < new Date()) {
          return false;
        }
        return true;
      });

      // Update user if buffs were changed
      if (cleanedBuffs.length !== originalBuffCount) {
        user.buffs = cleanedBuffs;
        await user.save();
        totalUsersUpdated++;
        totalBuffsRemoved += (originalBuffCount - cleanedBuffs.length);
        console.log(`Updated user ${user.discordId}: Removed ${originalBuffCount - cleanedBuffs.length} duplicate/expired buffs`);
      }
    }

    console.log('\nCleanup Summary:');
    console.log(`Total users processed: ${users.length}`);
    console.log(`Users updated: ${totalUsersUpdated}`);
    console.log(`Total buffs removed: ${totalBuffsRemoved}`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupBuffs().then(() => {
  console.log('Cleanup completed');
  process.exit(0);
}).catch(error => {
  console.error('Cleanup failed:', error);
  process.exit(1);
}); 