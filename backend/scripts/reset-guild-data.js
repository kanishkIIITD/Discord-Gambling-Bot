const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;
const { program } = require('commander');
require('dotenv').config();

// Import all models
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');
const PlacedBet = require('../models/PlacedBet');
const BlackjackGame = require('../models/BlackjackGame');
const Duel = require('../models/Duel');
const Jackpot = require('../models/Jackpot');

const modelsToArchive = { Transaction, Bet, PlacedBet, BlackjackGame, Duel, Jackpot };
const betMessageMapPath = path.join(__dirname, '../../discord-bot/betMessageMap.json');
async function resetGuildData(guildId, isDryRun) {
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in the .env file.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully.');

    const logPrefix = isDryRun ? 'DRY RUN:' : 'LIVE RUN:';
    console.log(`\n--- ${logPrefix} for guildId: ${guildId} ---`);

    // 1. Reset User documents
    const userResetPayload = {
      currentWinStreak: 0,
      maxWinStreak: 0,
      crimeCooldown: null,
      workCooldown: null,
      fishCooldown: null,
      huntCooldown: null,
      jailedUntil: null,
      begCooldown: null,
      lastBegged: null,
      stealCooldown: null,
      currentTimeoutDuration: 0,
      timeoutEndsAt: null,
      crimeStats: { success: 0, fail: 0, jail: 0 },
      stealStats: { success: 0, fail: 0, jail: 0, totalStolen: 0 },
      workStats: {},
      // inventory: [],
      buffs: [],
      duelWins: 0,
      duelLosses: 0,
      mysteryboxCooldown: null,
      lastTimeoutAt: null,
      timeoutHistory: [],
      timeoutStats: { totalTimeouts: 0, totalCost: 0 },
    };
    const userCount = await User.countDocuments({ guildId });
    if (userCount > 0) {
      console.log(`- User: Would reset ${userCount} documents.`);
      if (!isDryRun) {
        await User.updateMany({ guildId }, { $set: userResetPayload });
        console.log(`  -> Successfully reset ${userCount} User documents.`);
      }
    } else {
      console.log('- User: No documents to reset.');
    }

    // 2. Reset Wallet documents
    const walletResetPayload = {
      balance: 100000, // Default balance from schema
      lastDailyClaim: null,
      dailyStreak: 0,
      slotLossStreak: 0,
      freeSpins: 0,
    };
    const walletCount = await Wallet.countDocuments({ guildId });
    if (walletCount > 0) {
      console.log(`- Wallet: Would reset ${walletCount} documents.`);
      if (!isDryRun) {
        await Wallet.updateMany({ guildId }, { $set: walletResetPayload });
        console.log(`  -> Successfully reset ${walletCount} Wallet documents.`);
      }
    } else {
      console.log('- Wallet: No documents to reset.');
    }

    // 3. Clean betMessageMap.json
    const betsInGuild = await Bet.find({ guildId }).select('_id').lean();
    const betIdsInGuild = new Set(betsInGuild.map(b => b._id.toString()));
    if (betIdsInGuild.size > 0) {
      try {
        const betMessageMapRaw = await fs.readFile(betMessageMapPath, 'utf-8');
        const betMessageMap = JSON.parse(betMessageMapRaw);
        const newBetMessageMap = Object.entries(betMessageMap).reduce((acc, [betId, value]) => {
          if (!betIdsInGuild.has(betId)) acc[betId] = value;
          return acc;
        }, {});
        const removedCount = Object.keys(betMessageMap).length - Object.keys(newBetMessageMap).length;
        if (removedCount > 0) {
          console.log(`- betMessageMap.json: Would remove ${removedCount} entries.`);
          if (!isDryRun) {
            await fs.writeFile(betMessageMapPath, JSON.stringify(newBetMessageMap, null, 2));
            console.log('  -> betMessageMap.json has been cleaned.');
          }
        } else {
            console.log('- betMessageMap.json: No relevant entries to remove.');
        }
      } catch (error) {
        if (error.code === 'ENOENT') console.log('- betMessageMap.json: File not found, skipping.');
        else console.error('Error processing betMessageMap.json:', error);
      }
    } else {
      console.log('- betMessageMap.json: No bets found for this guild, skipping cleanup.');
    }

    // 4. Archive specified models
    const archivedGuildId = `archived_${guildId}`;
    for (const modelName in modelsToArchive) {
      const model = modelsToArchive[modelName];
      const count = await model.countDocuments({ guildId });
      if (count > 0) {
        console.log(`- ${modelName}: Would archive ${count} documents to guildId '${archivedGuildId}'.`);
        if (!isDryRun) {
          await model.updateMany({ guildId }, { $set: { guildId: archivedGuildId } });
          console.log(`  -> Successfully archived ${count} ${modelName} documents.`);
        }
      } else {
        console.log(`- ${modelName}: No documents to archive.`);
      }
    }
    
    console.log(`\n--- ${isDryRun ? 'DRY RUN' : 'RESET'} COMPLETE ---`);
  } catch (error) {
    console.error('\nAn error occurred during the reset process:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

program
  .version('1.0.0')
  .description('Reset data for a specific guild using a hybrid approach (reset, archive).')
  .option('--guildId <id>', 'The ID of the guild to reset')
  .option('--confirm', 'Flag to confirm the live run (modifies data)')
  .parse(process.argv);

const options = program.opts();

if (!options.guildId) {
  console.error('Error: --guildId is a required option.');
  program.help();
} else {
  const isDryRun = !options.confirm;
  if (isDryRun) {
    console.log('Running in DRY RUN mode. No data will be modified.');
    console.log('To perform a live run, add the --confirm flag.');
  } else {
      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.log('!!                  WARNING                   !!');
      console.log('!!    THIS IS A LIVE RUN. DATA WILL BE RESET    !!');
      console.log('!!         AND ARCHIVED FOR THE GUILD.          !!');
      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  }
  resetGuildData(options.guildId, isDryRun);
} 