const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const pokeCache = require('../utils/pokeCache');

// In-memory map: channelId -> { pokemonId, spawnedAt, attempts }
const activeSpawns = new Map();

// Cooldown map: guildId -> last spawn timestamp
const pokespawnCooldowns = new Map();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokespawn')
    .setDescription('Admin: Spawn a wild Kanto Pokémon in this channel!')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
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
    activeSpawns.set(channelId, { pokemonId, spawnedAt: Date.now(), attempts: 0 });
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
    await interaction.reply({ embeds: [embed] });
  },

  // Export for pokecatch.js to access
  activeSpawns,
}; 