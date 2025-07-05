require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

async function testDiscordConnection() {
  console.log('Testing Discord connection...');
  console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'Token exists (not showing for security)' : 'No token found');
  
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  
  try {
    console.log('Attempting to login...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log(`Successfully logged in as ${client.user.tag}`);
    
    // Wait for the client to be ready
    if (!client.isReady()) {
      await new Promise(resolve => {
        client.once('ready', resolve);
      });
    }
    
    // Get all guilds the bot is in
    const guilds = client.guilds.cache;
    console.log(`Bot is in ${guilds.size} guilds:`);
    
    guilds.forEach(guild => {
      console.log(`- ${guild.id}: ${guild.name}`);
    });
    
  } catch (error) {
    console.error('Error connecting to Discord:', error);
  } finally {
    // Close the connection
    client.destroy();
    console.log('Connection closed.');
  }
}

testDiscordConnection().catch(console.error);