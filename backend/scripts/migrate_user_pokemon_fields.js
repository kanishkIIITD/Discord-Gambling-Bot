const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Define Pokémon-related fields to migrate
const POKEMON_FIELDS = [
  // Core progression
  'poke_level',
  'poke_xp',
  'poke_stardust',
  
  // Timestamps and cooldowns
  'poke_daily_ring_ts',
  'poke_xp_booster_ts',
  'poke_rareball_ts',
  'poke_ultraball_ts',
  
  // Weekly evolutions tracking
  'poke_weekly_evolutions',
  
  // Daily quest progress
  'poke_quest_daily_catch',
  'poke_quest_daily_battle',
  'poke_quest_daily_evolve',
  'poke_quest_daily_completed',
  'poke_quest_daily_last_reset',
  'poke_quest_daily_claimed',
  
  // Weekly quest progress
  'poke_quest_weekly_catch',
  'poke_quest_weekly_battle',
  'poke_quest_weekly_evolve',
  'poke_quest_weekly_completed',
  'poke_quest_weekly_last_reset',
  'poke_quest_weekly_claimed',
  
  // Item uses
  'poke_ring_charges',
  'poke_rareball_uses',
  'poke_ultraball_uses',
  'poke_xp_booster_uses'
];

// Function to migrate Pokémon fields from source guild to target guild
async function migrateUserPokemonFields(sourceGuildId, targetGuildId, dryRun = false) {
  try {
    console.log(`\n=== User Pokémon Fields Migration ===`);
    console.log(`Source Guild ID: ${sourceGuildId}`);
    console.log(`Target Guild ID: ${targetGuildId}`);
    console.log(`Dry Run: ${dryRun ? 'Yes' : 'No'}`);
    console.log('=====================================\n');

    // Check if source guild has any users
    const sourceUserCount = await User.countDocuments({ guildId: sourceGuildId });
    if (sourceUserCount === 0) {
      console.log('❌ No users found in source guild. Nothing to migrate.');
      return;
    }

    console.log(`📊 Found ${sourceUserCount} users in source guild`);

    // Check if target guild has users
    const targetUserCount = await User.countDocuments({ guildId: targetGuildId });
    console.log(`📊 Target guild has ${targetUserCount} users`);

    // Get all users from source guild
    const sourceUsers = await User.find({ guildId: sourceGuildId });
    console.log(`📋 Retrieved ${sourceUsers.length} users from source guild`);

    // Statistics tracking
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    // Group users by Discord ID for processing
    const userGroups = {};
    sourceUsers.forEach(user => {
      if (!userGroups[user.discordId]) {
        userGroups[user.discordId] = [];
      }
      userGroups[user.discordId].push(user);
    });

    console.log(`\n👥 Processing ${Object.keys(userGroups).length} unique Discord users`);

    if (dryRun) {
      console.log('\n🔍 DRY RUN - No changes will be made');
      console.log(`Would migrate Pokémon fields for ${sourceUsers.length} user records`);
      return;
    }

    // Process each unique Discord user
    for (const [discordId, users] of Object.entries(userGroups)) {
      try {
        // Find or create user in target guild
        let targetUser = await User.findOne({ discordId, guildId: targetGuildId });
        
        if (!targetUser) {
          // Create new user in target guild with basic info from source
          const sourceUser = users[0]; // Use first user as template
          targetUser = new User({
            discordId: sourceUser.discordId,
            guildId: targetGuildId,
            username: sourceUser.username,
            avatar: sourceUser.avatar,
            email: sourceUser.email,
            role: 'user', // Default role for new users
            createdAt: new Date()
          });
          createdCount++;
        } else {
          updatedCount++;
        }

        // Migrate Pokémon fields from all source users for this Discord ID
        // We'll merge the best values (highest levels, most items, etc.)
        let bestPokemonData = {};

        for (const sourceUser of users) {
          for (const field of POKEMON_FIELDS) {
            const sourceValue = sourceUser[field];
            
            if (sourceValue !== undefined && sourceValue !== null) {
              // For numeric fields, take the highest value
              if (typeof sourceValue === 'number') {
                if (bestPokemonData[field] === undefined || sourceValue > bestPokemonData[field]) {
                  bestPokemonData[field] = sourceValue;
                }
              }
              // For boolean fields, take true if any source has true
              else if (typeof sourceValue === 'boolean') {
                if (bestPokemonData[field] === undefined || sourceValue === true) {
                  bestPokemonData[field] = sourceValue;
                }
              }
              // For date fields, take the most recent
              else if (sourceValue instanceof Date) {
                if (bestPokemonData[field] === undefined || sourceValue > bestPokemonData[field]) {
                  bestPokemonData[field] = sourceValue;
                }
              }
              // For object fields (like poke_weekly_evolutions), merge them
              else if (typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
                if (!bestPokemonData[field]) {
                  bestPokemonData[field] = {};
                }
                Object.assign(bestPokemonData[field], sourceValue);
              }
              // For other types, take the first non-null value
              else if (bestPokemonData[field] === undefined) {
                bestPokemonData[field] = sourceValue;
              }
            }
          }
        }

        // Apply the best Pokémon data to target user
        for (const [field, value] of Object.entries(bestPokemonData)) {
          targetUser[field] = value;
        }

        await targetUser.save();
        migratedCount++;

        if (migratedCount % 50 === 0) {
          console.log(`   Progress: ${migratedCount}/${Object.keys(userGroups).length} users processed`);
        }

      } catch (error) {
        console.error(`   Error migrating user ${discordId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ Migration completed!');
    console.log(`   Successfully migrated: ${migratedCount} users`);
    console.log(`   New users created: ${createdCount}`);
    console.log(`   Existing users updated: ${updatedCount}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount} users`);
    }

    // Verification
    const finalTargetCount = await User.countDocuments({ guildId: targetGuildId });
    console.log(`\n📊 Final counts:`);
    console.log(`   Source guild: ${sourceUserCount} users`);
    console.log(`   Target guild: ${finalTargetCount} users`);
    console.log(`   Expected target: ${targetUserCount + createdCount} users`);

    // Show sample of migrated data
    const sampleUser = await User.findOne({ guildId: targetGuildId });
    if (sampleUser) {
      console.log(`\n📋 Sample migrated data for user ${sampleUser.discordId}:`);
      console.log(`   Level: ${sampleUser.poke_level}`);
      console.log(`   XP: ${sampleUser.poke_xp}`);
      console.log(`   Stardust: ${sampleUser.poke_stardust}`);
      console.log(`   Ring charges: ${sampleUser.poke_ring_charges}`);
      console.log(`   Rare balls: ${sampleUser.poke_rareball_uses}`);
      console.log(`   Ultra balls: ${sampleUser.poke_ultraball_uses}`);
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Function to clear Pokémon fields from users in a guild (optional utility)
async function clearPokemonFieldsFromGuild(guildId, dryRun = false) {
  try {
    const count = await User.countDocuments({ guildId });
    console.log(`\n🗑️  Clearing Pokémon fields from users in guild ${guildId}`);
    console.log(`   Found ${count} users to update`);
    
    if (dryRun) {
      console.log('🔍 DRY RUN - No changes will be made');
      return;
    }

    // Reset all Pokémon fields to defaults
    const updateData = {};
    POKEMON_FIELDS.forEach(field => {
      if (field === 'poke_level') updateData[field] = 1;
      else if (field === 'poke_weekly_evolutions') updateData[field] = {};
      else if (field.includes('_claimed') || field.includes('_completed')) updateData[field] = false;
      else if (field.includes('_ts') || field.includes('_reset')) updateData[field] = null;
      else updateData[field] = 0;
    });

    const result = await User.updateMany({ guildId }, updateData);
    console.log(`✅ Reset Pokémon fields for ${result.modifiedCount} users in guild ${guildId}`);
  } catch (error) {
    console.error('❌ Error clearing Pokémon fields:', error);
    throw error;
  }
}

// Function to show Pokémon field statistics for a guild
async function showPokemonFieldStats(guildId) {
  try {
    const users = await User.find({ guildId });
    console.log(`\n📊 Pokémon Field Statistics for Guild ${guildId}`);
    console.log(`   Total users: ${users.length}`);

    if (users.length === 0) {
      console.log('   No users found');
      return;
    }

    // Calculate statistics for key fields
    const stats = {
      totalLevel: 0,
      totalXP: 0,
      totalStardust: 0,
      totalRingCharges: 0,
      totalRareBalls: 0,
      totalUltraBalls: 0,
      usersWithPokemonData: 0
    };

    users.forEach(user => {
      if (user.poke_level > 1 || user.poke_xp > 0 || user.poke_stardust > 0) {
        stats.usersWithPokemonData++;
      }
      stats.totalLevel += user.poke_level || 0;
      stats.totalXP += user.poke_xp || 0;
      stats.totalStardust += user.poke_stardust || 0;
      stats.totalRingCharges += user.poke_ring_charges || 0;
      stats.totalRareBalls += user.poke_rareball_uses || 0;
      stats.totalUltraBalls += user.poke_ultraball_uses || 0;
    });

    console.log(`   Users with Pokémon data: ${stats.usersWithPokemonData}`);
    console.log(`   Average level: ${(stats.totalLevel / users.length).toFixed(2)}`);
    console.log(`   Total XP: ${stats.totalXP.toLocaleString()}`);
    console.log(`   Total stardust: ${stats.totalStardust.toLocaleString()}`);
    console.log(`   Total ring charges: ${stats.totalRingCharges}`);
    console.log(`   Total rare balls: ${stats.totalRareBalls}`);
    console.log(`   Total ultra balls: ${stats.totalUltraBalls}`);

  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node migrate_user_pokemon_fields.js <sourceGuildId> <targetGuildId> [--dry-run] [--clear-target] [--stats]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run     Show what would be done without making changes');
    console.log('  --clear-target Clear Pokémon fields from target guild before migration');
    console.log('  --stats       Show statistics for both guilds');
    console.log('');
    console.log('Examples:');
    console.log('  node migrate_user_pokemon_fields.js 123456789 987654321');
    console.log('  node migrate_user_pokemon_fields.js 123456789 987654321 --dry-run');
    console.log('  node migrate_user_pokemon_fields.js 123456789 987654321 --clear-target');
    console.log('  node migrate_user_pokemon_fields.js 123456789 987654321 --stats');
    process.exit(1);
  }

  const sourceGuildId = args[0];
  const targetGuildId = args[1];
  const dryRun = args.includes('--dry-run');
  const clearTarget = args.includes('--clear-target');
  const showStats = args.includes('--stats');

  if (sourceGuildId === targetGuildId) {
    console.log('❌ Source and target guild IDs cannot be the same');
    process.exit(1);
  }

  await connectDB();

  try {
    if (showStats) {
      console.log('\n📊 Source Guild Statistics:');
      await showPokemonFieldStats(sourceGuildId);
      
      console.log('\n📊 Target Guild Statistics (before migration):');
      await showPokemonFieldStats(targetGuildId);
    }

    if (clearTarget && !dryRun) {
      await clearPokemonFieldsFromGuild(targetGuildId, dryRun);
    }
    
    await migrateUserPokemonFields(sourceGuildId, targetGuildId, dryRun);
    
    if (showStats && !dryRun) {
      console.log('\n📊 Target Guild Statistics (after migration):');
      await showPokemonFieldStats(targetGuildId);
    }
    
    console.log('\n🎉 Script completed successfully!');
  } catch (error) {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  migrateUserPokemonFields,
  clearPokemonFieldsFromGuild,
  showPokemonFieldStats,
  POKEMON_FIELDS
}; 