const axios = require('axios');
const pokeCache = require('./pokeCache');
const { activeSpawns } = require('../commands/pokespawn');
const { EmbedBuilder } = require('discord.js');
const customSpawnRates = require('../data/customSpawnRates.json');
const { getEmojiString } = require('./emojiConfig');

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
  return pokemonName;
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// const SPAWN_INTERVAL = 10 * 60 * 1000; // 10 minutes
const DESPAWN_TIME = 60 * 1000; // 1 minute

// Map: channelId -> { timeout, messageId }
const despawnTimers = new Map();

async function fetchSpawnChannels(backendUrl) {
  try {
    const res = await axios.get(`${backendUrl}/servers/pokechannels`);
    return res.data.servers || [];
  } catch (err) {
    console.error('[AutoSpawner] Failed to fetch spawn channels:', err);
    return [];
  }
}

async function spawnPokemonInChannel(client, guildId, channelId, backendUrl) {
  try {
    // Prevent double spawn in the same channel
    if (activeSpawns.has(channelId)) {
      console.log(`[AutoSpawner] Skipping spawn in channel ${channelId} (guild ${guildId}) because a spawn is already active.`);
      return;
    }
    console.log(`[AutoSpawner] Spawning Pokémon in channel ${channelId} (guild ${guildId})`);
    // Fetch channel and log type/permissions
    let channel;
    try {
      channel = await client.channels.fetch(channelId);
      console.log(`[AutoSpawner] Channel fetched: ${channelId} (type: ${channel.type}, name: ${channel.name || 'N/A'})`);
      if (channel.guild) {
        const perms = channel.permissionsFor(client.user);
        console.log(`[AutoSpawner] Bot permissions in channel ${channelId}:`, perms ? perms.toArray() : 'N/A');
        if (!perms || !perms.has('SendMessages') || !perms.has('ViewChannel')) {
          console.error(`[AutoSpawner] Bot lacks SendMessages or ViewChannel in channel ${channelId} (guild ${guildId})`);
        }
      }
    } catch (e) {
      console.error(`[AutoSpawner] Failed to fetch channel ${channelId} (guild ${guildId}):`, e);
      return;
    }
    const pokemonId = pokeCache.getRandomKantoPokemonId();
    const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
    const pokemonName = pokemonData.name;
    const fetch = require('node-fetch');
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}/`);
    const speciesData = await speciesRes.json();
    const dexNum = speciesData.id;
    const types = pokemonData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
    const artwork = pokemonData.sprites.other['official-artwork'].front_default;
    const flavorEntries = speciesData.flavor_text_entries.filter(e => e.language.name === 'en');
    const flavorText = flavorEntries.length > 0
      ? flavorEntries[Math.floor(Math.random() * flavorEntries.length)].flavor_text.replace(/\f/g, ' ')
      : `A wild ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} is watching you closely...`;
    // Set catchRateOverride if available in customSpawnRates
    let catchRateOverride;
    if (customSpawnRates[pokemonName] && typeof customSpawnRates[pokemonName].catchRate === 'number') {
      catchRateOverride = customSpawnRates[pokemonName].catchRate;
    }
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
    console.log(`[AutoSpawner] Attempting to send spawn message in channel ${channelId} (guild ${guildId})`);
    let message;
    try {
      message = await channel.send({ embeds: [embed] });
      console.log(`[AutoSpawner] Successfully sent spawn message in channel ${channelId} (guild ${guildId}), messageId: ${message.id}`);
    } catch (e) {
      console.error(`[AutoSpawner] Failed to send spawn message in channel ${channelId} (guild ${guildId}):`, e);
      return;
    }
    // Confirm message exists by fetching it back
    try {
      const fetchedMsg = await channel.messages.fetch(message.id);
      if (fetchedMsg) {
        console.log(`[AutoSpawner] Confirmed message exists in channel ${channelId}, messageId: ${message.id}`);
      } else {
        console.error(`[AutoSpawner] Message not found after sending in channel ${channelId}, messageId: ${message.id}`);
      }
    } catch (e) {
      console.error(`[AutoSpawner] Error fetching message after sending in channel ${channelId}, messageId: ${message.id}:`, e);
    }
    activeSpawns.set(channelId, { pokemonId, spawnedAt: Date.now(), messageId: message.id, attempts: 0, attemptedBy: [], caughtBy: [], ...(catchRateOverride !== undefined && { catchRateOverride }) });
    console.log(`[AutoSpawner] activeSpawns after spawn:`, Array.from(activeSpawns.entries()));
    // Set despawn timer
    if (despawnTimers.has(channelId)) {
      console.log(`[AutoSpawner] Clearing previous despawn timer for channel ${channelId}`);
      clearTimeout(despawnTimers.get(channelId).timeout);
    }
    const timeout = setTimeout(async () => {
      // If still active, despawn only if messageId matches
      const spawn = activeSpawns.get(channelId);
      if (spawn && spawn.messageId === message.id) {
        try {
          // Fetch the Pokémon info again for the despawn embed
          const { pokemonId } = spawn;
          const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
          const fetch = require('node-fetch');
          const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}/`);
          const speciesData = await speciesRes.json();
          const dexNum = speciesData.id;
          const artwork = pokemonData.sprites.other['official-artwork'].front_default;
          const name = capitalizeFirst(getDisplayName(pokemonData.name));
          const goneEmbed = new EmbedBuilder()
            .setColor(0x636e72)
            .setTitle(`${getEmojiString('pokeball')} The wild #${dexNum.toString().padStart(3, '0')} ${name} ran away!`)
            .setDescription(`The wild Pokémon ran away after 1 minute.`)
            .setImage(artwork);
          const msg = await channel.messages.fetch(message.id);
          await msg.edit({ embeds: [goneEmbed] });
          console.log(`[AutoSpawner] Despawned Pokémon in channel ${channelId} (guild ${guildId}), messageId: ${message.id}`);
        } catch (e) { console.error('[AutoSpawner] Failed to edit despawn message:', e); }
        activeSpawns.delete(channelId);
        console.log(`[AutoSpawner] Deleted spawn for channel ${channelId} (messageId: ${message.id}, spawnedAt: ${spawn.spawnedAt})`);
      } else {
        console.log(`[AutoSpawner] Despawn timer fired for channel ${channelId}, but messageId did not match. No action taken.`);
      }
      despawnTimers.delete(channelId);
      console.log(`[AutoSpawner] Cleared despawn timer for channel ${channelId}`);
    }, DESPAWN_TIME);
    despawnTimers.set(channelId, { timeout, messageId: message.id });
    console.log(`[AutoSpawner] Set despawn timer for channel ${channelId}, messageId: ${message.id}`);
  } catch (err) {
    console.error(`[AutoSpawner] Failed to spawn in ${channelId} (guild ${guildId}):`, err);
  }
}

function getRandomSpawnInterval() {
  // 5 to 10 minutes in ms
  return (5 * 60 * 1000) + Math.floor(Math.random() * (5 * 60 * 1000));
}

async function startAutoSpawner(client, backendUrl) {
  async function spawnAll() {
    const servers = await fetchSpawnChannels(backendUrl);
    console.log(`[AutoSpawner] Fetched ${servers.length} servers with spawn channels.`);
    for (const s of servers) {
      if (s.pokeSpawnChannelId) {
        console.log(`[AutoSpawner] Considering guild ${s.guildId}, channel ${s.pokeSpawnChannelId}`);
        // Before spawning, clear any old despawn timer and delete old spawn
        if (despawnTimers.has(s.pokeSpawnChannelId)) {
          console.log(`[AutoSpawner] Clearing previous despawn timer for channel ${s.pokeSpawnChannelId} before new spawn.`);
          clearTimeout(despawnTimers.get(s.pokeSpawnChannelId).timeout);
          despawnTimers.delete(s.pokeSpawnChannelId);
        }
        if (activeSpawns.has(s.pokeSpawnChannelId)) {
          console.log(`[AutoSpawner] Removing stale spawn for channel ${s.pokeSpawnChannelId} before new spawn.`);
          activeSpawns.delete(s.pokeSpawnChannelId);
        }
        await spawnPokemonInChannel(client, s.guildId, s.pokeSpawnChannelId, backendUrl);
      } else {
        console.log(`[AutoSpawner] Guild ${s.guildId} has no spawn channel set, skipping.`);
      }
    }
    // Schedule next spawn with random interval
    setTimeout(spawnAll, getRandomSpawnInterval());
  }
  // Initial spawn
  setTimeout(spawnAll, getRandomSpawnInterval());
}

module.exports = { startAutoSpawner, despawnTimers }; 