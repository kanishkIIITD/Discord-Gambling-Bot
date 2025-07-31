const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pokeCache = require('../utils/pokeCache');
const customSpawnRates = require('../data/customSpawnRates.json');
const axios = require('axios');
const { getEmojiString } = require('../utils/emojiConfig');
const { clearAllDespawnTimers, setDespawnTimer } = require('../utils/despawnTimerManager');

// Helper function to get display name for Pokémon
function getDisplayName(pokemonName) {
  if (pokemonName.toLowerCase() === 'rattata') {
    return 'joanatta';
  }
  else if (pokemonName.toLowerCase() === 'bellsprout') {
    return 'mohasprout';
  }
  else if (pokemonName.toLowerCase() === 'koffing') {
    return 'rezzing';
  }
  else if (pokemonName.toLowerCase() === 'drowzee') {
    return 'thornzee';
  }
  return pokemonName;
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// In-memory map: channelId -> { pokemonId, spawnedAt, attempts }
const activeSpawns = new Map();

// Custom despawn timers for custom spawns: channelId -> { timeout, messageId }
const customDespawnTimers = new Map();

// Cooldown map: guildId -> last spawn timestamp
const pokespawnCooldowns = new Map();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Custom spawn command for a specific user
const ALLOWED_DISCORD_ID = '294497956348821505'; // <-- Replace with the allowed Discord ID

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokespawn')
    .setDescription('Admin: Spawn a wild Kanto Pokémon in this channel!')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!pokeCache.isKantoCacheReady()) {
      return interaction.reply({
        content: 'Pokémon data is still loading. Please try again in a few seconds!',
        ephemeral: true
      });
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only admins can use this command.', ephemeral: true });
    }
    const guildId = interaction.guildId;
    const now = Date.now();
    const lastUsed = pokespawnCooldowns.get(guildId) || 0;
    if (now - lastUsed < COOLDOWN_MS) {
      const minutesLeft = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 60000);
      return interaction.reply({ content: `You can only use /pokespawn once every 1 hour per server. Please wait ${minutesLeft} more minute(s).`, ephemeral: true });
    }
    pokespawnCooldowns.set(guildId, now);
    const channelId = interaction.channelId;
    
    // Clear any existing despawn timers before spawning
    clearAllDespawnTimers(channelId);
    
    if (activeSpawns.has(channelId)) {
      console.log(`[PokeSpawn] Removing stale spawn for channel ${channelId} before new spawn.`);
      activeSpawns.delete(channelId);
      console.log(`[PokeSpawn][DELETE] Deleted stale spawn for channel ${channelId} before new spawn.`);
    }
    if (activeSpawns.has(channelId)) {
      return interaction.reply({ content: 'A wild Pokémon is already present in this channel! Use /pokecatch to try catching it.', ephemeral: true });
    }
    const pokemonId = pokeCache.getRandomKantoPokemonId();
    const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
    const pokemonName = pokemonData.name;
    // Fetch species for dex number and flavor text
    const fetch = require('node-fetch');
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}/`);
    const speciesData = await speciesRes.json();
    const dexNum = speciesData.id;
    // Get types
    const types = pokemonData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
    // Use official artwork for large image
    const artwork = pokemonData.sprites.other['official-artwork'].front_default;
    // Get random English flavor text
    const flavorEntries = speciesData.flavor_text_entries.filter(e => e.language.name === 'en');
    const flavorText = flavorEntries.length > 0
      ? flavorEntries[Math.floor(Math.random() * flavorEntries.length)].flavor_text.replace(/\f/g, ' ')
      : `A wild ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} is watching you closely...`;
    // Set catchRateOverride if available in customSpawnRates
    let catchRateOverride;
    if (customSpawnRates[pokemonName] && typeof customSpawnRates[pokemonName].catchRate === 'number') {
      catchRateOverride = customSpawnRates[pokemonName].catchRate;
    }
    // Create the embed for the spawned Pokémon
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`${getEmojiString('pokeball')} A wild #${dexNum.toString().padStart(3, '0')} ${capitalizeFirst(getDisplayName(pokemonData.name))} appeared!`)
      .setImage(artwork)
      .addFields(
        { name: 'Type', value: types, inline: true },
        { name: 'Region', value: 'Kanto', inline: true }
      )
      .setDescription(flavorText)
      .setFooter({ text: 'Type /pokecatch to try catching!' });

    const sentMsg = await interaction.reply({ embeds: [embed], fetchReply: true });
    activeSpawns.set(channelId, { pokemonId, spawnedAt: Date.now(), messageId: sentMsg.id, attempts: 0, attemptedBy: [], caughtBy: [], ...(catchRateOverride !== undefined && { catchRateOverride }) });
    console.log(`[PokeSpawn][SPAWN] Created spawn in channel ${channelId}: messageId=${sentMsg.id}, pokemonId=${pokemonId}, spawnedAt=${Date.now()}`);
    const DESPAWN_TIME = 60 * 1000; // 1 minute
    const timeout = setTimeout(async () => {
      const spawn = activeSpawns.get(channelId);
      console.log(`[PokeSpawn][TIMER] Timer fired for channel ${channelId}. Timer messageId: ${sentMsg.id}, activeSpawns messageId: ${spawn ? spawn.messageId : 'none'}`);
      // If still active, despawn only if messageId matches
      if (spawn && spawn.messageId === sentMsg.id) {
        try {
          const goneEmbed = new EmbedBuilder()
            .setColor(0x636e72)
            .setTitle(`${getEmojiString('pokeball')} The wild #${dexNum.toString().padStart(3, '0')} ${capitalizeFirst(getDisplayName(pokemonData.name))} ran away!`)
            .setDescription(`The wild Pokémon ran away after 20 seconds.`)
            .setImage(artwork);
          // --- Update: fetch channel and message like auto-spawn ---
          const channel = await interaction.client.channels.fetch(channelId);
          const msg = await channel.messages.fetch(sentMsg.id);
          await msg.edit({ embeds: [goneEmbed] });
        } catch (e) { console.error('[PokeSpawn] Failed to edit despawn message:', e); }
        activeSpawns.delete(channelId);
        console.log(`[PokeSpawn][DELETE] Deleted spawn for channel ${channelId} (messageId: ${sentMsg.id}, spawnedAt: ${spawn.spawnedAt}) [reason: despawn timer fired]`);
      } else {
        // Fallback: always delete the spawn if the timer fires, to prevent stale spawns
        activeSpawns.delete(channelId);
        console.log(`[PokeSpawn][DELETE] Despawn timer fired for channel ${channelId}, but messageId did not match. Fallback: deleted spawn.`);
      }
      // Clear the timer from the shared manager
      clearAllDespawnTimers(channelId);
    }, DESPAWN_TIME);
    
    // Set the timer using the shared manager
    setDespawnTimer(channelId, timeout, sentMsg.id, 'manual');
  },

  // Export for pokecatch.js to access
  activeSpawns,
};

module.exports.spawnCustomPokemonCommand = {
  data: new SlashCommandBuilder()
    .setName('spawncustompokemon')
    .setDescription('Give a custom Pokémon to a user (admin only)')
    .addIntegerOption(option =>
      option.setName('pokemonid').setDescription('Pokémon ID').setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('ishiny').setDescription('Is Shiny?').setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user').setDescription('Target user').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('count').setDescription('How many to give').setRequired(false)
    ),
  async execute(interaction) {
    if (interaction.user.id !== ALLOWED_DISCORD_ID) {
      return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
    }
    const userObj = interaction.options.getUser('user');
    const targetDiscordId = userObj.id;
    const count = interaction.options.getInteger('count') || 1;
    const guildId = interaction.guildId;
    const pokemonId = interaction.options.getInteger('pokemonid');
    const isShiny = interaction.options.getBoolean('ishiny');
    // Call backend endpoint
    try {
      const backendUrl = process.env.BACKEND_API_URL;
      const response = await axios.post(
        `${backendUrl}/users/admin/give-pokemon`,
        { userId: interaction.user.id, targetDiscordId, guildId, pokemonId, isShiny, count },
        { headers: { 'x-admin-secret': process.env.ADMIN_GIVE_POKEMON_SECRET } }
      );
      const msg = response.data.message || 'Pokémon given.';
      return interaction.reply({ content: msg, ephemeral: true });
    } catch (error) {
      let errMsg = 'Failed to give Pokémon.';
      if (error.response && error.response.data && error.response.data.message) {
        errMsg = error.response.data.message;
      }
      return interaction.reply({ content: errMsg, ephemeral: true });
    }
  }
};

module.exports.customDespawnTimers = customDespawnTimers; 