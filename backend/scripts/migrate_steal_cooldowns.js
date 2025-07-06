const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('../models/User');

async function migrateStealCooldowns() {
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in the .env file.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully.');

    console.log('\n--- Starting Steal Cooldown Migration ---');

    // Find all users that have the old stealCooldown field
    const usersWithOldCooldown = await User.find({
      stealCooldown: { $exists: true, $ne: null }
    });

    console.log(`Found ${usersWithOldCooldown.length} users with old stealCooldown field.`);

    if (usersWithOldCooldown.length === 0) {
      console.log('No users found with old stealCooldown field. Migration not needed.');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of usersWithOldCooldown) {
      try {
        // Copy the old stealCooldown value to stealPointsCooldown
        const oldCooldownValue = user.stealCooldown;
        
        // Update the user document
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              stealPointsCooldown: oldCooldownValue
            },
            $unset: {
              stealCooldown: 1
            }
          }
        );

        migratedCount++;
        console.log(`✓ Migrated user ${user.discordId} (${user.username}) - Guild: ${user.guildId}`);
        
        if (oldCooldownValue) {
          console.log(`  - Old stealCooldown: ${oldCooldownValue}`);
          console.log(`  - New stealPointsCooldown: ${oldCooldownValue}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`✗ Error migrating user ${user.discordId}:`, error.message);
      }
    }

    // Also find users that have stealCooldown set to null and just remove the field
    const usersWithNullCooldown = await User.find({
      stealCooldown: null
    });

    console.log(`\nFound ${usersWithNullCooldown.length} users with null stealCooldown field.`);

    if (usersWithNullCooldown.length > 0) {
      try {
        const nullResult = await User.updateMany(
          { stealCooldown: null },
          { $unset: { stealCooldown: 1 } }
        );
        console.log(`✓ Removed null stealCooldown field from ${nullResult.modifiedCount} users.`);
      } catch (error) {
        console.error('✗ Error removing null stealCooldown fields:', error.message);
      }
    }

    // Verify migration by checking if any stealCooldown fields remain
    const remainingOldCooldowns = await User.find({
      stealCooldown: { $exists: true }
    });

    console.log(`\n--- Migration Summary ---`);
    console.log(`Successfully migrated: ${migratedCount} users`);
    console.log(`Errors encountered: ${errorCount} users`);
    console.log(`Remaining stealCooldown fields: ${remainingOldCooldowns.length}`);

    if (remainingOldCooldowns.length > 0) {
      console.log('\n⚠️  WARNING: Some users still have the old stealCooldown field:');
      remainingOldCooldowns.forEach(user => {
        console.log(`  - ${user.discordId} (${user.username}) - Guild: ${user.guildId}`);
      });
    } else {
      console.log('\n✅ Migration completed successfully! All old stealCooldown fields have been migrated.');
    }

    // Verify new fields exist
    const usersWithNewCooldowns = await User.find({
      $or: [
        { stealPointsCooldown: { $exists: true } },
        { stealFishCooldown: { $exists: true } },
        { stealAnimalCooldown: { $exists: true } },
        { stealItemCooldown: { $exists: true } }
      ]
    });

    console.log(`\nUsers with new steal cooldown fields: ${usersWithNewCooldowns.length}`);

  } catch (error) {
    console.error('\nAn error occurred during migration:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB disconnected.');
  }
}

// Add command line options for dry run
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  console.log('Running in DRY RUN mode. No changes will be made to the database.');
  console.log('To perform actual migration, run without --dry-run flag.');
  
  // For dry run, we'll just show what would be migrated
  async function dryRunMigration() {
    if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI is not defined in the .env file.');
      process.exit(1);
    }

    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('MongoDB connected successfully.');

      console.log('\n--- DRY RUN: Steal Cooldown Migration Preview ---');

      const usersWithOldCooldown = await User.find({
        stealCooldown: { $exists: true, $ne: null }
      });

      console.log(`Would migrate ${usersWithOldCooldown.length} users with old stealCooldown field:`);
      
      usersWithOldCooldown.forEach(user => {
        console.log(`  - ${user.discordId} (${user.username}) - Guild: ${user.guildId}`);
        console.log(`    Old stealCooldown: ${user.stealCooldown}`);
        console.log(`    Would set stealPointsCooldown: ${user.stealCooldown}`);
      });

      const usersWithNullCooldown = await User.find({
        stealCooldown: null
      });

      console.log(`\nWould remove null stealCooldown field from ${usersWithNullCooldown.length} users.`);

    } catch (error) {
      console.error('\nAn error occurred during dry run:', error);
    } finally {
      await mongoose.disconnect();
      console.log('\nMongoDB disconnected.');
    }
  }

  dryRunMigration();
} else {
  migrateStealCooldowns();
} 