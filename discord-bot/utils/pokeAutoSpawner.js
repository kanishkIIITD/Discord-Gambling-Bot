const axios = require('axios');
const pokeCache = require('./pokeCache');
const { activeSpawns } = require('../commands/pokespawn');
const { EmbedBuilder } = require('discord.js');
const customSpawnRates = require('../data/customSpawnRates.json');
const { getEmojiString } = require('./emojiConfig');
const { clearAllDespawnTimers, setDespawnTimer } = require('./despawnTimerManager');
const { getCurrentGenInfo, getPreviousGenInfo, GENERATION_NAMES } = require('../config/generationConfig');

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
  else if (pokemonName.toLowerCase() === 'quilava') {
    return 'spettermark jr';
  }
  else if (pokemonName.toLowerCase() === 'typhlosion') {
    return 'spettermark';
  }
  return pokemonName;
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// const SPAWN_INTERVAL = 10 * 60 * 1000; // 10 minutes
const DESPAWN_TIME = 90 * 1000; // 1 minute 30 seconds

async function fetchSpawnChannels(backendUrl) {
  try {
    const res = await axios.get(`${backendUrl}/servers/pokechannels`);
    return res.data.servers || [];
  } catch (err) {
    console.error('[AutoSpawner] Failed to fetch spawn channels:', err);
    return [];
  }
}

async function spawnPokemonInChannel(client, guildId, channelId, backendUrl, generation = null) {
  try {
    // Prevent double spawn in the same channel
    if (activeSpawns.has(channelId)) {
      console.log(`[AutoSpawner] Skipping spawn in channel ${channelId} (guild ${guildId}) because a spawn is already active.`);
      return;
    }
    console.log(`[AutoSpawner] Spawning Pokémon in channel ${channelId} (guild ${guildId}) for generation ${generation}`);
    
    // Clear any existing despawn timers before spawning
    clearAllDespawnTimers(channelId);
    
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
    
    // Determine which generation to spawn based on channel type
    let targetGeneration = generation;
    if (!targetGeneration) {
      // Default to current generation if not specified
      targetGeneration = getCurrentGenInfo().number;
    }
    
    // Use combined pool for previous gens channel, regular pool for current gen channel
    const isPreviousGenChannel = targetGeneration === getPreviousGenInfo().number;
    const pokemonId = isPreviousGenChannel
      ? pokeCache.getRandomPokemonIdByGenerationPreviousBias(targetGeneration)
      : pokeCache.getRandomPokemonIdByGeneration(targetGeneration);
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
    let evolutionStage = null;
    if (customSpawnRates[pokemonName]) {
      if (typeof customSpawnRates[pokemonName].catchRate === 'number') {
        catchRateOverride = customSpawnRates[pokemonName].catchRate;
      }
      if (customSpawnRates[pokemonName].evolutionStage) {
        evolutionStage = customSpawnRates[pokemonName].evolutionStage;
      }
    }
    
    // Get region name based on the actual Pokémon's generation
    let regionName;
    const pokemonGen = customSpawnRates[pokemonName]?.gen;
    if (pokemonGen) {
      regionName = GENERATION_NAMES[pokemonGen] || `Gen ${pokemonGen}`;
    } else {
      // Fallback to target generation if Pokémon not found in customSpawnRates
      regionName = GENERATION_NAMES[targetGeneration] || `Gen ${targetGeneration}`;
    }
    
    // Get evolution stage display text
    let evolutionStageText = '';
    if (evolutionStage !== null) {
      switch (evolutionStage) {
        case 1:
          evolutionStageText = 'Basic';
          break;
        case 2:
          evolutionStageText = 'Stage 1';
          break;
        case 3:
          evolutionStageText = 'Stage 2';
          break;
        default:
          evolutionStageText = `Stage ${evolutionStage}`;
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`${getEmojiString('pokeball')} A wild #${dexNum.toString().padStart(3, '0')} ${capitalizeFirst(getDisplayName(pokemonData.name))} appeared!`)
      .setImage(artwork)
      .addFields(
        { name: 'Type', value: types, inline: true },
        { name: 'Region', value: regionName, inline: true }
      )
      .setDescription(flavorText)
      .setFooter({ text: 'Type /pokecatch to try catching!' });
    
    // Add evolution stage field if available
    if (evolutionStageText) {
      embed.addFields({ name: 'Evolution', value: evolutionStageText, inline: true });
    }
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
    // Calculate generation-based bonuses
    let shinyBonusMultiplier = 1;
    let formBonusMultiplier = 1;
    
    if (isPreviousGenChannel) {
      // Get the actual generation of the spawned Pokémon
      const pokemonGen = customSpawnRates[pokemonName]?.gen;
      if (pokemonGen) {
        // Apply generation-based shiny and form rate bonuses
        if (pokemonGen === 1) {
          shinyBonusMultiplier = 15; // Gen 1: 15x shiny rate
          formBonusMultiplier = 3;   // Gen 1: 3x form rate
        } else if (pokemonGen === 2) {
          shinyBonusMultiplier = 12; // Gen 2: 12x shiny rate
          formBonusMultiplier = 2.5; // Gen 2: 2.5x form rate
        } else if (pokemonGen === 3) {
          shinyBonusMultiplier = 8;  // Gen 3: 8x shiny rate
          formBonusMultiplier = 2;   // Gen 3: 2x form rate
        } else {
          // Fallback for other previous generations
          shinyBonusMultiplier = 10;
          formBonusMultiplier = 1.5;
        }
      } else {
        // Fallback if generation not found
        shinyBonusMultiplier = 10;
        formBonusMultiplier = 1.5;
      }
    }

    activeSpawns.set(channelId, { 
      pokemonId, 
      spawnedAt: Date.now(), 
      messageId: message.id, 
      attempts: 0, 
      attemptedBy: [], 
      caughtBy: [], 
      isPreviousGen: isPreviousGenChannel,
      shinyBonusMultiplier,
      formBonusMultiplier,
      ...(catchRateOverride !== undefined && { catchRateOverride }) 
    });
    console.log(`[AutoSpawner][SPAWN] Created spawn in channel ${channelId} (guild ${guildId}): messageId=${message.id}, pokemonId=${pokemonId}, spawnedAt=${Date.now()}`);
    console.log(`[AutoSpawner] activeSpawns after spawn:`, Array.from(activeSpawns.entries()));
    
    // Set despawn timer using the shared timer manager
    const timeout = setTimeout(async () => {
      // If still active, despawn only if messageId matches
      const spawn = activeSpawns.get(channelId);
      console.log(`[AutoSpawner][TIMER] Timer fired for channel ${channelId}. Timer messageId: ${message.id}, activeSpawns messageId: ${spawn ? spawn.messageId : 'none'}`);
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
            .setDescription(`The wild Pokémon ran away after 1 minute 30 seconds.`)
            .setImage(artwork);
          const msg = await channel.messages.fetch(message.id);
          await msg.edit({ embeds: [goneEmbed] });
          console.log(`[AutoSpawner] Despawned Pokémon in channel ${channelId} (guild ${guildId}), messageId: ${message.id}`);
        } catch (e) { console.error('[AutoSpawner] Failed to edit despawn message:', e); }
        activeSpawns.delete(channelId);
        console.log(`[AutoSpawner][DELETE] Deleted spawn for channel ${channelId} (messageId: ${message.id}, spawnedAt: ${spawn.spawnedAt}) [reason: despawn timer fired]`);
      } else {
        console.log(`[AutoSpawner] Despawn timer fired for channel ${channelId}, but messageId did not match. No action taken.`);
      }
      // Clear the timer from the shared manager
      clearAllDespawnTimers(channelId);
    }, DESPAWN_TIME);
    
    // Set the timer using the shared manager
    setDespawnTimer(channelId, timeout, message.id, 'auto');
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
      // Spawn current generation Pokémon in current gen channel
      if (s.currentGenSpawnChannelId) {
        console.log(`[AutoSpawner] Considering guild ${s.guildId}, Current Gen channel ${s.currentGenSpawnChannelId}`);
        // Before spawning, clear any old despawn timer and delete old spawn
        clearAllDespawnTimers(s.currentGenSpawnChannelId);
        if (activeSpawns.has(s.currentGenSpawnChannelId)) {
          console.log(`[AutoSpawner] Removing stale spawn for channel ${s.currentGenSpawnChannelId} before new spawn.`);
          activeSpawns.delete(s.currentGenSpawnChannelId);
          console.log(`[AutoSpawner][DELETE] Deleted stale spawn for channel ${s.currentGenSpawnChannelId} before new spawn.`);
        }
        await spawnPokemonInChannel(client, s.guildId, s.currentGenSpawnChannelId, backendUrl, getCurrentGenInfo().number);
      }
      
      // Spawn previous generation Pokémon in previous gen channel
      if (s.prevGenSpawnChannelId) {
        console.log(`[AutoSpawner] Considering guild ${s.guildId}, Previous Gen channel ${s.prevGenSpawnChannelId}`);
        // Before spawning, clear any old despawn timer and delete old spawn
        clearAllDespawnTimers(s.prevGenSpawnChannelId);
        if (activeSpawns.has(s.prevGenSpawnChannelId)) {
          console.log(`[AutoSpawner] Removing stale spawn for channel ${s.prevGenSpawnChannelId} before new spawn.`);
          activeSpawns.delete(s.prevGenSpawnChannelId);
          console.log(`[AutoSpawner][DELETE] Deleted stale spawn for channel ${s.prevGenSpawnChannelId} before new spawn.`);
        }
        await spawnPokemonInChannel(client, s.guildId, s.prevGenSpawnChannelId, backendUrl, getPreviousGenInfo().number);
      }
      
      // If no channels set, skip
      if (!s.currentGenSpawnChannelId && !s.prevGenSpawnChannelId) {
        console.log(`[AutoSpawner] Guild ${s.guildId} has no spawn channels set, skipping.`);
      }
    }
    // Schedule next spawn with random interval
    setTimeout(spawnAll, getRandomSpawnInterval());
  }
  // Initial spawn
  setTimeout(spawnAll, getRandomSpawnInterval());
}

module.exports = { startAutoSpawner }; 