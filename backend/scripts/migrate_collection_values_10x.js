// Migration script: 10x collection values for fish and animal items
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

async function migrate() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/gambling';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const users = await User.find({});
  let usersUpdated = 0;
  let itemsUpdated = 0;

  for (const user of users) {
    let changed = false;
    if (Array.isArray(user.inventory)) {
      for (const item of user.inventory) {
        if ((item.type === 'fish' || item.type === 'animal') && typeof item.value === 'number') {
          item.value *= 10;
          itemsUpdated++;
          changed = true;
        }
      }
    }
    if (changed) {
      await user.save();
      usersUpdated++;
    }
  }

  console.log(`Migration complete. Updated ${itemsUpdated} items for ${usersUpdated} users.`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
}); 