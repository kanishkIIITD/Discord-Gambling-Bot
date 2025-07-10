const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pokeCache = require('../utils/pokeCache');
const customSpawnRates = require('../data/customSpawnRates.json');

// In-memory map: channelId -> { pokemonId, spawnedAt, attempts }
const activeSpawns = new Map();
// Manual despawn timers: channelId -> { timeout, messageId }
const manualDespawnTimers = new Map();

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
    activeSpawns.set(channelId, { pokemonId, spawnedAt: Date.now(), attempts: 0, ...(catchRateOverride !== undefined && { catchRateOverride }) });
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
    const sentMsg = await interaction.reply({ embeds: [embed], fetchReply: true });
    // Set manual despawn timer
    if (manualDespawnTimers.has(channelId)) clearTimeout(manualDespawnTimers.get(channelId).timeout);
    const DESPAWN_TIME = 2 * 60 * 1000; // 2 minutes
    const timeout = setTimeout(async () => {
      // If still active and not caught, despawn
      const spawn = activeSpawns.get(channelId);
      if (spawn && !spawn.caughtBy) {
        try {
          const goneEmbed = new EmbedBuilder()
            .setColor(0x636e72)
            .setTitle(`The wild #${dexNum.toString().padStart(3, '0')} ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} ran away!`)
            .setDescription(`No one was able to catch ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} in time.`)
            .setImage(artwork);
          const channel = await interaction.client.channels.fetch(channelId);
          const msg = await channel.messages.fetch(sentMsg.id);
          await msg.edit({ embeds: [goneEmbed] });
        } catch (e) { /* ignore */ }
        activeSpawns.delete(channelId);
      }
      manualDespawnTimers.delete(channelId);
    }, DESPAWN_TIME);
    manualDespawnTimers.set(channelId, { timeout, messageId: sentMsg.id });
  },

  // Export for pokecatch.js to access
  activeSpawns,
  manualDespawnTimers,
};

module.exports.spawnCustomPokemonCommand = {
  data: new SlashCommandBuilder()
    .setName('spawncustompokemon')
    .setDescription('Spawn a custom Pokémon (admin only)')
    .addIntegerOption(option =>
      option.setName('pokemonid').setDescription('Pokémon ID').setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('ishiny').setDescription('Is Shiny?').setRequired(true)
    ),
  async execute(interaction) {
    if (interaction.user.id !== ALLOWED_DISCORD_ID) {
      return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
    }
    const channelId = interaction.channelId;
    if (activeSpawns.has(channelId)) {
      return interaction.reply({ content: 'A wild Pokémon is already present in this channel! Use /pokecatch to try catching it.', ephemeral: true });
    }
    const pokemonId = interaction.options.getInteger('pokemonid');
    const isShiny = interaction.options.getBoolean('ishiny');
    const pokemonData = await pokeCache.getPokemonDataById(pokemonId);
    const fetch = require('node-fetch');
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}/`);
    const speciesData = await speciesRes.json();
    const dexNum = speciesData.id;
    const types = pokemonData.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1)).join(', ');
    const artwork = isShiny && pokemonData.sprites.other['official-artwork'].front_shiny
      ? pokemonData.sprites.other['official-artwork'].front_shiny
      : pokemonData.sprites.other['official-artwork'].front_default;
    const flavorEntries = speciesData.flavor_text_entries.filter(e => e.language.name === 'en');
    const flavorText = flavorEntries.length > 0
      ? flavorEntries[Math.floor(Math.random() * flavorEntries.length)].flavor_text.replace(/\f/g, ' ')
      : `A wild ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} is watching you closely...`;
    activeSpawns.set(channelId, { pokemonId, spawnedAt: Date.now(), attempts: 0, isShiny, catchRateOverride: 0 });
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`A wild #${dexNum.toString().padStart(3, '0')} ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} appeared!`)
      .setImage(artwork)
      .addFields(
        { name: 'Type', value: types, inline: true },
        { name: 'Region', value: 'Kanto', inline: true },
        { name: 'Shiny', value: isShiny ? 'Yes ✨' : 'No', inline: true }
      )
      .setDescription(flavorText)
      .setFooter({ text: 'Type /pokecatch to try catching!' });
    const sentMsg = await interaction.reply({ embeds: [embed], fetchReply: true });
    // Set custom despawn timer (30 seconds)
    if (customDespawnTimers.has(channelId)) clearTimeout(customDespawnTimers.get(channelId).timeout);
    const DESPAWN_TIME = 30 * 1000;
    const timeout = setTimeout(async () => {
      const spawn = activeSpawns.get(channelId);
      if (spawn && !spawn.caughtBy) {
        try {
          const goneEmbed = new EmbedBuilder()
            .setColor(0x636e72)
            .setTitle(`The wild #${dexNum.toString().padStart(3, '0')} ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} ran away!`)
            .setDescription(`No one was able to catch ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} in time.`)
            .setImage(artwork);
          const channel = await interaction.client.channels.fetch(channelId);
          const msg = await channel.messages.fetch(sentMsg.id);
          await msg.edit({ embeds: [goneEmbed] });
        } catch (e) { /* ignore */ }
        activeSpawns.delete(channelId);
      }
      customDespawnTimers.delete(channelId);
    }, DESPAWN_TIME);
    customDespawnTimers.set(channelId, { timeout, messageId: sentMsg.id });
  }
};

module.exports.customDespawnTimers = customDespawnTimers; 