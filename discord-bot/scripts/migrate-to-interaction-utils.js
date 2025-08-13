#!/usr/bin/env node

/**
 * Migration script to help convert existing Discord bot commands
 * to use the new interactionUtils for better timeout handling
 */

const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');
const UTILS_PATH = '../utils/interactionUtils';

// Commands that are already migrated
const MIGRATED_COMMANDS = [
  'pokespawn.js',
  'pokecatch.js'
];

// Commands that use deferReply and should be migrated
const COMMANDS_TO_MIGRATE = [
  'buffs.js',
  'collection.js',
  'beg.js',
  'collectionLeaderboard.js',
  'collectionList.js',
  'bail.js',
  'cooldowns.js',
  'crime.js',
  'cs2cases.js',
  'cs2inventory.js',
  'cs2leaderboard.js',
  'cs2open.js',
  'cs2sell.js',
  'cs2stats.js',
  'cs2trade.js',
  'cs2view.js',
  'duel.js',
  'fish.js',
  'goldenTickets.js',
  'hunt.js',
  'jailed.js',
  'mysterybox.js',
  'pokebattle.js',
  'giveawaypokemon.js',
  'pokecollection.js',
  'pokedex.js',
  'pokebattlestats.js',
  'pokeevolve.js',
  'pokeevolveform.js',
  'pokeopen.js',
  'pokepacks.js',
  'pokesellduplicates.js',
  'pokeshopdaily.js',
  'poketrade.js',
  'pokestats.js',
  'refund.js',
  'setlogchannel.js',
  'redeemGoldenTicket.js',
  'sell.js',
  'quests.js',
  'work.js',
  'timeout.js',
  'question.js',
  'shop.js',
  'transactionHistory.js',
  'steal.js',
  'trade.js'
];

function generateMigrationTemplate(commandName) {
  const className = commandName.replace('.js', '').replace(/^./, str => str.toUpperCase());
  
  return `// Migration template for ${commandName}
// Replace the existing execute function with this pattern:

const { 
  executeWithTimeoutWarning, 
  safeDeferReply, 
  safeInteractionResponse 
} = require('${UTILS_PATH}');

// ... existing imports and data ...

async execute(interaction) {
  await executeWithTimeoutWarning(interaction, '${commandName.replace('.js', '')}', async () => {
    // Replace: await interaction.deferReply();
    const deferSuccess = await safeDeferReply(interaction);
    if (!deferSuccess) return;
    
    // Replace: await interaction.editReply({ content: 'message' });
    const success = await safeInteractionResponse(
      interaction,
      'Your message here',
      { ephemeral: true }
    );
    if (!success) return;
    
    // ... rest of your existing command logic ...
    
    // Keep existing interaction.editReply() calls for final responses
    await interaction.editReply('Final response');
  });
}
`;
}

function generateMigrationGuide() {
  console.log('🔧 Discord Bot Command Migration Guide');
  console.log('=====================================\n');
  
  console.log('📋 Commands Already Migrated:');
  MIGRATED_COMMANDS.forEach(cmd => {
    console.log(`  ✅ ${cmd}`);
  });
  
  console.log('\n📝 Commands To Migrate:');
  COMMANDS_TO_MIGRATE.forEach(cmd => {
    console.log(`  ⏳ ${cmd}`);
  });
  
  console.log('\n🚀 Migration Steps:');
  console.log('1. Import the required utility functions');
  console.log('2. Wrap your execute function with executeWithTimeoutWarning');
  console.log('3. Replace interaction.deferReply() with safeDeferReply()');
  console.log('4. Replace error responses with safeInteractionResponse()');
  console.log('5. Test the command thoroughly');
  
  console.log('\n📖 Example Migration:');
  console.log('```javascript');
  console.log('// Before:');
  console.log('async execute(interaction) {');
  console.log('  await interaction.deferReply();');
  console.log('  // ... command logic');
  console.log('  await interaction.editReply("Done!");');
  console.log('}');
  console.log('');
  console.log('// After:');
  console.log('async execute(interaction) {');
  console.log('  await executeWithTimeoutWarning(interaction, "commandname", async () => {');
  console.log('    const deferSuccess = await safeDeferReply(interaction);');
  console.log('    if (!deferSuccess) return;');
  console.log('    // ... command logic');
  console.log('    await interaction.editReply("Done!");');
  console.log('  });');
  console.log('}');
  console.log('```');
  
  console.log('\n🔍 Key Benefits:');
  console.log('• Automatic timeout warnings in production');
  console.log('• Graceful handling of expired interactions');
  console.log('• Consistent error handling across commands');
  console.log('• Better user experience for slow commands');
  
  console.log('\n📚 For more details, see: utils/README.md');
}

function checkCommandFile(commandPath) {
  try {
    const content = fs.readFileSync(commandPath, 'utf8');
    const hasDeferReply = content.includes('interaction.deferReply');
    const hasExecuteFunction = content.includes('async execute(interaction)');
    const usesUtils = content.includes('interactionUtils');
    
    return {
      path: commandPath,
      hasDeferReply,
      hasExecuteFunction,
      usesUtils,
      needsMigration: hasDeferReply && hasExecuteFunction && !usesUtils
    };
  } catch (error) {
    return {
      path: commandPath,
      error: error.message,
      needsMigration: false
    };
  }
}

function analyzeCommands() {
  console.log('🔍 Analyzing Commands...\n');
  
  const allCommands = [...MIGRATED_COMMANDS, ...COMMANDS_TO_MIGRATE];
  const results = [];
  
  allCommands.forEach(cmdName => {
    const cmdPath = path.join(COMMANDS_DIR, cmdName);
    const result = checkCommandFile(cmdPath);
    results.push(result);
  });
  
  console.log('📊 Analysis Results:');
  console.log('====================\n');
  
  results.forEach(result => {
    const status = result.usesUtils ? '✅ Migrated' : 
                   result.needsMigration ? '⏳ Needs Migration' : 
                   result.error ? '❌ Error' : '⚠️  No deferReply';
    
    console.log(`${status} - ${path.basename(result.path)}`);
    
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  const needsMigration = results.filter(r => r.needsMigration).length;
  const migrated = results.filter(r => r.usesUtils).length;
  const total = results.length;
  
  console.log(`\n📈 Summary: ${migrated}/${total} commands migrated, ${needsMigration} need migration`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--analyze') || args.includes('-a')) {
    analyzeCommands();
  } else if (args.includes('--template') || args.includes('-t')) {
    const commandName = args.find(arg => arg.endsWith('.js'));
    if (commandName) {
      console.log(generateMigrationTemplate(commandName));
    } else {
      console.log('Usage: node migrate-to-interaction-utils.js --template commandname.js');
    }
  } else {
    generateMigrationGuide();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateMigrationTemplate,
  generateMigrationGuide,
  checkCommandFile,
  analyzeCommands
};
