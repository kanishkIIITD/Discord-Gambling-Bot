require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

async function checkDiscordToken() {
  // console.log('Checking Discord token...');
  
  // Get the token from environment variables
  const token = process.env.DISCORD_TOKEN;
  
  if (!token) {
    console.error('No Discord token found in environment variables!');
    process.exit(1);
  }
  
  // console.log('Token exists in environment variables.');
  // console.log('Token first 10 characters:', token.substring(0, 10) + '...');
  
  // Create a new Discord client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  
  // Set up event handlers
  client.once('ready', () => {
    // console.log('✅ Successfully connected to Discord!');
    // console.log(`Logged in as ${client.user.tag}`);
    // console.log(`Bot is in ${client.guilds.cache.size} guilds`);
    
    // List all guilds
    // console.log('\nGuilds:');
    client.guilds.cache.forEach(guild => {
      // console.log(`- ${guild.name} (${guild.id})`);
    });
    
    // Clean exit
    // console.log('\nTest completed successfully.');
    client.destroy();
    process.exit(0);
  });
  
  client.on('error', error => {
    console.error('Discord client error:', error);
    process.exit(1);
  });
  
  // Attempt to login
  // console.log('Attempting to login...');
  try {
    await client.login(token);
  } catch (error) {
    console.error('Failed to login:', error);
    process.exit(1);
  }
}

checkDiscordToken();