const axios = require('axios');
const pokeCache = require('./pokeCache');
const { activeSpawns } = require('../commands/pokespawn');
const { EmbedBuilder } = require('discord.js');

// const SPAWN_INTERVAL = 10 * 60 * 1000; // 10 minutes
const DESPAWN_TIME = 2 * 60 * 1000; // 2 minutes

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
    const pokemonId = pokeCache.getRandomKantoPokemonId();
    const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
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
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`A wild #${dexNum.toString().padStart(3, '0')} ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} appeared!`)
      .setImage(artwork)
      .addFields(
        { name: 'Type', value: types, inline: true },
        { name: 'Region', value: 'Kanto', inline: true }
      )
      .setDescription(flavorText)
      .setFooter({ text: 'Type /pokecatch to try catching!' });
    const channel = await client.channels.fetch(channelId);
    const message = await channel.send({ embeds: [embed] });
    activeSpawns.set(channelId, { pokemonId, spawnedAt: Date.now(), messageId: message.id, attempts: 0 });
    // Set despawn timer
    if (despawnTimers.has(channelId)) clearTimeout(despawnTimers.get(channelId).timeout);
    const timeout = setTimeout(async () => {
      // If still active, despawn
      if (activeSpawns.has(channelId)) {
        const spawn = activeSpawns.get(channelId);
        // Only update the message if no one tried to catch
        if (!spawn.attemptedBy || spawn.attemptedBy.length === 0) {
          try {
            // Fetch the Pokémon info again for the despawn embed
            const { pokemonId } = spawn;
            const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
            const fetch = require('node-fetch');
            const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}/`);
            const speciesData = await speciesRes.json();
            const dexNum = speciesData.id;
            const artwork = pokemonData.sprites.other['official-artwork'].front_default;
            const name = pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1);
            const goneEmbed = new EmbedBuilder()
              .setColor(0x636e72)
              .setTitle(`The wild #${dexNum.toString().padStart(3, '0')} ${name} ran away!`)
              .setDescription(`No one tried to catch ${name} in time.`)
              .setImage(artwork);
            const msg = await channel.messages.fetch(message.id);
            await msg.edit({ embeds: [goneEmbed] });
          } catch (e) { console.error('[AutoSpawner] Failed to edit despawn message:', e); }
        }
        activeSpawns.delete(channelId);
      }
      despawnTimers.delete(channelId);
    }, DESPAWN_TIME);
    despawnTimers.set(channelId, { timeout, messageId: message.id });
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

module.exports = { startAutoSpawner }; 