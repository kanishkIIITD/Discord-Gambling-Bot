require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const rarityValueRanges = {
  common: { min: 100, max: 500 },
  uncommon: { min: 500, max: 2000 },
  rare: { min: 2000, max: 5000 },
  epic: { min: 5000, max: 20000 },
  legendary: { min: 20000, max: 50000 },
  mythical: { min: 50000, max: 100000 },
  transcendent: { min: 100000, max: 200000 }
};

function getRandomValue(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function migrateItemValues() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);

    let totalItemsUpdated = 0;
    let totalUsersUpdated = 0;

    for (const user of users) {
      let userUpdated = false;
      
      if (!user.inventory || !Array.isArray(user.inventory)) {
        continue;
      }

      // Process each item in the user's inventory
      for (const item of user.inventory) {
        if (item.type === 'item' && (!item.value || item.value === 0)) {
          const range = rarityValueRanges[item.rarity];
          if (range) {
            item.value = getRandomValue(range.min, range.max);
            userUpdated = true;
            totalItemsUpdated++;
          }
        }
      }

      if (userUpdated) {
        await user.save();
        totalUsersUpdated++;
        console.log(`Updated user ${user.username} (${user.discordId})`);
      }
    }

    console.log('\nMigration completed:');
    console.log(`Total items updated: ${totalItemsUpdated}`);
    console.log(`Total users updated: ${totalUsersUpdated}`);

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateItemValues().catch(console.error); 