require('dotenv').config();
const { getClient, getUserGuilds } = require('../utils/discordClient');

// Use a valid Discord user ID for testing
// This should be the ID of a user who is in at least one server with the bot
const TEST_USER_ID = '1292759560733458457'; // Using the Discord Client ID as a fallback

async function testDiscordBot() {
  console.log('Testing Discord bot connection...');
  console.log('Discord token status:', process.env.DISCORD_TOKEN ? 'Token exists' : 'No token found');
  
  try {
    // Get Discord client
    const client = getClient();
    
    // Wait for client to be ready
    if (!client.isReady()) {
      console.log('Waiting for Discord client to be ready...');
      await new Promise(resolve => {
        const readyListener = () => {
          client.removeListener('ready', readyListener);
          resolve();
        };
        client.on('ready', readyListener);
        
        // If already ready, resolve immediately
        if (client.isReady()) {
          resolve();
        }
      });
    }
    
    console.log('Discord client is ready!');
    console.log('Bot username:', client.user.username);
    console.log('Bot ID:', client.user.id);
    
    // Get all guilds the bot is in
    const botGuilds = client.guilds.cache;
    console.log(`Bot is in ${botGuilds.size} guilds:`);
    
    // Log guild details
    for (const [guildId, guild] of botGuilds) {
      console.log(`- ${guild.name} (${guildId})`);
      console.log(`  Members: ${guild.memberCount}`);
      console.log(`  Owner ID: ${guild.ownerId}`);
    }
    
    // Try to get guilds for the test user
    console.log('\nAttempting to get guilds for test user...');
    const userGuilds = await getUserGuilds(TEST_USER_ID);
    console.log(`Found ${userGuilds.length} guilds for user ${TEST_USER_ID}:`);
    userGuilds.forEach(guild => {
      console.log(`- ${guild.name} (${guild.id})`);
    });
    
  } catch (error) {
    console.error('Error testing Discord bot:', error);
  } finally {
    // Exit the process
    console.log('\nTest completed.');
    process.exit(0);
  }
}

testDiscordBot();