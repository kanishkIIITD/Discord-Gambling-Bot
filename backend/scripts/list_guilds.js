require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ServerSettings = require('../models/ServerSettings');
const { Client, GatewayIntentBits } = require('discord.js');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Get all unique guild IDs from users
  const guildIds = await User.distinct('guildId');
  console.log(`Found ${guildIds.length} unique guilds:\n`);

  // 2. Set up Discord client
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  await client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  for (const guildId of guildIds) {
    // Try to fetch guild from Discord
    let guildName = '(not in bot cache)';
    let guildIcon = '';
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      guildName = guild.name;
      guildIcon = guild.iconURL({ dynamic: true, size: 64 }) || '';
    }

    // Fetch server settings for each guild
    const settings = await ServerSettings.findOne({ guildId });
    console.log(`Guild ID: ${guildId}`);
    console.log(`  Name: ${guildName}`);
    if (guildIcon) console.log(`  Icon: ${guildIcon}`);
    if (settings) {
      console.log(`  Log Channel: ${settings.logChannelId || 'N/A'}`);
      console.log(`  Created At: ${settings.createdAt}`);
      console.log(`  Updated At: ${settings.updatedAt}`);
    } else {
      console.log('  No ServerSettings found.');
    }
    console.log('---');
  }

  await mongoose.disconnect();
  await client.destroy();
  console.log('Done.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
