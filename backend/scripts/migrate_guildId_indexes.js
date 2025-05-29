const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const DEFAULT_GUILD_ID = process.env.DEFAULT_GUILD_ID;

const collections = [
  { name: 'users', oldIndex: 'discordId_1', newIndex: { discordId: 1, guildId: 1 }, unique: true },
  { name: 'wallets', oldIndex: 'user_1', newIndex: { user: 1, guildId: 1 }, unique: true },
  { name: 'userpreferences', oldIndex: 'user_1', newIndex: { user: 1, guildId: 1 }, unique: true },
  { name: 'bets', newIndex: { guildId: 1 } },
  { name: 'placedbets', newIndex: { guildId: 1 } },
  { name: 'transactions', newIndex: { guildId: 1 } },
  { name: 'duels', newIndex: { guildId: 1 } },
  { name: 'jackpots', newIndex: { guildId: 1 } },
  { name: 'blackjackgames', newIndex: { guildId: 1 } },
];

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  for (const col of collections) {
    try {
      const collection = db.collection(col.name);
      // 1. Add guildId to docs missing it
      const updateRes = await collection.updateMany(
        { guildId: { $exists: false } },
        { $set: { guildId: DEFAULT_GUILD_ID } }
      );
      console.log(`[${col.name}] Updated ${updateRes.modifiedCount} docs to add guildId.`);
      // 2. Drop old unique index if specified
      if (col.oldIndex) {
        try {
          await collection.dropIndex(col.oldIndex);
          console.log(`[${col.name}] Dropped old index: ${col.oldIndex}`);
        } catch (err) {
          if (err.codeName === 'IndexNotFound') {
            console.log(`[${col.name}] Old index not found: ${col.oldIndex}`);
          } else {
            console.error(`[${col.name}] Error dropping index:`, err.message);
          }
        }
      }
      // 3. Create new index if specified
      if (col.newIndex) {
        try {
          await collection.createIndex(col.newIndex, { unique: !!col.unique });
          console.log(`[${col.name}] Created new index:`, col.newIndex, col.unique ? '(unique)' : '');
        } catch (err) {
          console.error(`[${col.name}] Error creating new index:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[${col.name}] Migration error:`, err.message);
    }
  }
  await mongoose.disconnect();
  console.log('Migration complete.');
}

migrate().catch(err => {
  console.error('Migration script failed:', err);
  process.exit(1);
}); 