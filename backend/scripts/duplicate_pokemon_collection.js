const mongoose = require('mongoose');
const Pokemon = require('../models/Pokemon');
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

// Function to duplicate Pokémon collection from source guild to target guild
async function duplicatePokemonCollection(sourceGuildId, targetGuildId, dryRun = false) {
  try {
    console.log(`\n=== Pokémon Collection Duplication ===`);
    console.log(`Source Guild ID: ${sourceGuildId}`);
    console.log(`Target Guild ID: ${targetGuildId}`);
    console.log(`Dry Run: ${dryRun ? 'Yes' : 'No'}`);
    console.log('=====================================\n');

    // Check if source guild has any Pokémon
    const sourcePokemonCount = await Pokemon.countDocuments({ guildId: sourceGuildId });
    if (sourcePokemonCount === 0) {
      console.log('❌ No Pokémon found in source guild. Nothing to duplicate.');
      return;
    }

    console.log(`📊 Found ${sourcePokemonCount} Pokémon in source guild`);

    // Check if target guild already has Pokémon
    const targetPokemonCount = await Pokemon.countDocuments({ guildId: targetGuildId });
    if (targetPokemonCount > 0) {
      console.log(`⚠️  Warning: Target guild already has ${targetPokemonCount} Pokémon`);
      console.log('   This will create duplicates. Consider clearing target guild first.');
    }

    // Get all Pokémon from source guild
    const sourcePokemon = await Pokemon.find({ guildId: sourceGuildId });
    console.log(`📋 Retrieved ${sourcePokemon.length} Pokémon from source guild`);

    // Group Pokémon by user for better reporting
    const userStats = {};
    sourcePokemon.forEach(pokemon => {
      const userId = pokemon.discordId;
      if (!userStats[userId]) {
        userStats[userId] = {
          total: 0,
          shiny: 0,
          unique: 0
        };
      }
      userStats[userId].total += pokemon.count || 1;
      if (pokemon.isShiny) userStats[userId].shiny += pokemon.count || 1;
      userStats[userId].unique += 1;
    });

    console.log(`\n👥 User Statistics:`);
    Object.entries(userStats).forEach(([userId, stats]) => {
      console.log(`   User ${userId}: ${stats.total} total (${stats.shiny} shiny, ${stats.unique} unique species)`);
    });

    if (dryRun) {
      console.log('\n🔍 DRY RUN - No changes will be made');
      console.log(`Would duplicate ${sourcePokemon.length} Pokémon entries`);
      return;
    }

    // Duplicate Pokémon to target guild
    console.log('\n🔄 Starting duplication process...');
    
    const duplicatedPokemon = [];
    let successCount = 0;
    let errorCount = 0;

    for (const pokemon of sourcePokemon) {
      try {
        // Create new Pokémon document for target guild
        const newPokemon = new Pokemon({
          user: pokemon.user, // Keep the same user reference
          discordId: pokemon.discordId,
          guildId: targetGuildId, // New guild ID
          pokemonId: pokemon.pokemonId,
          name: pokemon.name,
          isShiny: pokemon.isShiny,
          caughtAt: pokemon.caughtAt,
          count: pokemon.count,
          // Copy all competitive fields
          ivs: pokemon.ivs,
          evs: pokemon.evs,
          nature: pokemon.nature,
          ability: pokemon.ability,
          status: pokemon.status,
          boosts: pokemon.boosts
        });

        await newPokemon.save();
        duplicatedPokemon.push(newPokemon);
        successCount++;

        if (successCount % 100 === 0) {
          console.log(`   Progress: ${successCount}/${sourcePokemon.length} Pokémon duplicated`);
        }
      } catch (error) {
        console.error(`   Error duplicating Pokémon ${pokemon.pokemonId} for user ${pokemon.discordId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ Duplication completed!');
    console.log(`   Successfully duplicated: ${successCount} Pokémon`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount} Pokémon`);
    }

    // Verify duplication
    const finalTargetCount = await Pokemon.countDocuments({ guildId: targetGuildId });
    console.log(`\n📊 Final counts:`);
    console.log(`   Source guild: ${sourcePokemonCount} Pokémon`);
    console.log(`   Target guild: ${finalTargetCount} Pokémon`);
    console.log(`   Expected target: ${sourcePokemonCount + targetPokemonCount} Pokémon`);

    if (finalTargetCount === sourcePokemonCount + targetPokemonCount) {
      console.log('✅ Verification successful - all Pokémon duplicated correctly');
    } else {
      console.log('⚠️  Verification failed - count mismatch detected');
    }

  } catch (error) {
    console.error('❌ Error during duplication:', error);
    throw error;
  }
}

// Function to clear Pokémon from a guild (optional utility)
async function clearPokemonFromGuild(guildId, dryRun = false) {
  try {
    const count = await Pokemon.countDocuments({ guildId });
    console.log(`\n🗑️  Clearing Pokémon from guild ${guildId}`);
    console.log(`   Found ${count} Pokémon to delete`);
    
    if (dryRun) {
      console.log('🔍 DRY RUN - No changes will be made');
      return;
    }

    const result = await Pokemon.deleteMany({ guildId });
    console.log(`✅ Deleted ${result.deletedCount} Pokémon from guild ${guildId}`);
  } catch (error) {
    console.error('❌ Error clearing Pokémon:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node duplicate_pokemon_collection.js <sourceGuildId> <targetGuildId> [--dry-run] [--clear-target]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run     Show what would be done without making changes');
    console.log('  --clear-target Clear target guild before duplication');
    console.log('');
    console.log('Examples:');
    console.log('  node duplicate_pokemon_collection.js 123456789 987654321');
    console.log('  node duplicate_pokemon_collection.js 123456789 987654321 --dry-run');
    console.log('  node duplicate_pokemon_collection.js 123456789 987654321 --clear-target');
    process.exit(1);
  }

  const sourceGuildId = args[0];
  const targetGuildId = args[1];
  const dryRun = args.includes('--dry-run');
  const clearTarget = args.includes('--clear-target');

  if (sourceGuildId === targetGuildId) {
    console.log('❌ Source and target guild IDs cannot be the same');
    process.exit(1);
  }

  await connectDB();

  try {
    if (clearTarget && !dryRun) {
      await clearPokemonFromGuild(targetGuildId, dryRun);
    }
    
    await duplicatePokemonCollection(sourceGuildId, targetGuildId, dryRun);
    
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
  duplicatePokemonCollection,
  clearPokemonFromGuild
}; 