const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const customSpawnRates = require('../data/customSpawnRates.json');
const pokeCache = require('../utils/pokeCache');
const { getPreviousGenInfo } = require('../config/generationConfig');

// Group Pokémon by rarity (Gen 1 only)
const pokemonByRarity = {
  common: [],
  uncommon: [],
  rare: [],
  legendary: []
};

// Populate the rarity groups with only Gen 1 Pokémon (IDs 1-151)
Object.entries(customSpawnRates).forEach(([name, data]) => {
  // Only include Gen 1 Pokémon (IDs 1-151)
  if (data.gen === 1 && pokemonByRarity[data.rarity]) {
    pokemonByRarity[data.rarity].push({ name, ...data });
  }
});

function getDailyPokemon(userId, guildId) {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  
  // Use day of year + user ID + guild ID as seed for user AND guild-specific daily rotation
  const userSeed = parseInt(userId.slice(-3), 16); // Use last 3 characters of user ID
  const guildSeed = parseInt(guildId.slice(-3), 16); // Use last 3 characters of guild ID
  const seed = dayOfYear + userSeed + guildSeed;
  
  // Helper function to check if a Pokémon should be shiny (1% chance)
  const isShiny = (baseSeed, rarity) => {
    const shinySeed = baseSeed + rarity.charCodeAt(0); // Different seed for each rarity
    const randomValue = (shinySeed * 9301 + 49297) % 233280;
    return (randomValue % 100) < 1; // 1% chance
  };
  
  // Select one Pokémon from each rarity using the seed
  const commonPokemon = { ...pokemonByRarity.common[seed % pokemonByRarity.common.length], isShiny: isShiny(seed, 'common') };
  const uncommonPokemon = { ...pokemonByRarity.uncommon[seed % pokemonByRarity.uncommon.length], isShiny: isShiny(seed, 'uncommon') };
  
  // Add a small chance (5%) for the rare slot to be replaced by a legendary
  const randomValue = (seed * 9301 + 49297) % 233280; // Simple PRNG using the seed
  const isLegendary = (randomValue % 100) < 5; // 5% chance
  
  let rarePokemon;
  if (isLegendary && pokemonByRarity.legendary.length > 0) {
    // Select a legendary Pokémon
    rarePokemon = { ...pokemonByRarity.legendary[seed % pokemonByRarity.legendary.length], isShiny: isShiny(seed, 'legendary') };
  } else {
    // Select a rare Pokémon (default behavior)
    rarePokemon = { ...pokemonByRarity.rare[seed % pokemonByRarity.rare.length], isShiny: isShiny(seed, 'rare') };
  }
  
  return {
    common: commonPokemon,
    uncommon: uncommonPokemon,
    rare: rarePokemon
  };
}

function getRarityColor(rarity) {
  switch (rarity) {
    case 'common': return 0x808080; // Gray
    case 'uncommon': return 0x00ff00; // Green
    case 'rare': return 0x0000ff; // Blue
    case 'legendary': return 0xffd700; // Gold
    default: return 0x808080;
  }
}

function getRarityEmoji(rarity) {
  switch (rarity) {
    case 'common': return '⚪';
    case 'uncommon': return '🟢';
    case 'rare': return '🔵';
    case 'legendary': return '🟡';
    default: return '⚪';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokeshopdaily')
    .setDescription('View today\'s rotating Gen 1 Pokémon shop featuring Pokémon from different rarities!'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;
    
    let user;
    try {
      // Fetch user info to get stardust
      const userRes = await axios.get(`${backendUrl}/users/${userId}`, { headers: { 'x-guild-id': guildId } });
      user = userRes.data.user || userRes.data;
    } catch (e) {
      return interaction.editReply('Failed to fetch your user data. Please try again later.');
    }

    // Ensure pokeCache is ready
    if (!pokeCache.isKantoCacheReady()) {
      await pokeCache.buildKantoCache();
    }
    
    const dailyPokemon = getDailyPokemon(userId, guildId);
    
    // Check daily shop purchases
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split('T')[0];
    
    // Calculate time until next reset (midnight)
    const now = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const timeUntilReset = tomorrow - now;
    const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    // Fetch today's purchases from the backend
    let todayPurchases = {};
    try {
      const purchasesRes = await axios.get(`${backendUrl}/users/${userId}/pokemon/daily-purchases/${todayKey}`, { 
        headers: { 'x-guild-id': guildId } 
      });
      const purchases = purchasesRes.data.purchases || [];
      purchases.forEach(purchase => {
        todayPurchases[purchase.rarity] = purchase;
      });
    } catch (error) {
      console.error('[DailyShop] Error fetching daily purchases:', error);
      // Continue with empty purchases if there's an error
    }

    // Build main shop embed
    const mainEmbed = new EmbedBuilder()
      .setTitle('🛒 Daily Gen 1 Pokémon Shop')
      .setDescription(`Today's rotating Gen 1 Pokémon selection!`)
      .setColor(0x3498db)
      .addFields(
        { name: 'Your Stardust', value: String(user.poke_stardust || 0), inline: true },
        { name: 'Next Reset', value: `${hours}h ${minutes}m`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true }
      );

    // Create individual embeds for each Pokémon with sprites
    const pokemonEmbeds = [];
    for (const [slot, pokemon] of Object.entries(dailyPokemon)) {
      // Use the actual rarity of the Pokémon, not the slot key
      const rarity = pokemon.rarity;
      const rarityEmoji = getRarityEmoji(rarity);
      const rarityColor = getRarityColor(rarity);
      let price = rarity === 'common' ? 100 : rarity === 'uncommon' ? 250 : rarity === 'legendary' ? 1500 : 500;
      if (pokemon.isShiny) price *= 2;
      const alreadyPurchased = todayPurchases[slot];
      
      // Get Pokémon ID - try pokeCache first, then fallback to direct mapping
      let pokemonId = 1; // Default to Bulbasaur
      
      if (pokeCache.kantoSpecies && pokeCache.kantoSpecies.length > 0) {
        // Try exact match first, then case-insensitive
        let species = pokeCache.kantoSpecies.find(s => s.name === pokemon.name.toLowerCase());
        if (!species) {
          species = pokeCache.kantoSpecies.find(s => s.name.toLowerCase() === pokemon.name.toLowerCase());
        }
        if (species) {
          pokemonId = species.id;
        } else {
        }
      } else {
        // Fallback: Direct mapping for common Kanto Pokémon
        const pokemonIdMap = {
          'bulbasaur': 1, 'ivysaur': 2, 'venusaur': 3, 'charmander': 4, 'charmeleon': 5, 'charizard': 6,
          'squirtle': 7, 'wartortle': 8, 'blastoise': 9, 'caterpie': 10, 'metapod': 11, 'butterfree': 12,
          'weedle': 13, 'kakuna': 14, 'beedrill': 15, 'pidgey': 16, 'pidgeotto': 17, 'pidgeot': 18,
          'rattata': 19, 'raticate': 20, 'spearow': 21, 'fearow': 22, 'ekans': 23, 'arbok': 24,
          'pikachu': 25, 'raichu': 26, 'sandshrew': 27, 'sandslash': 28, 'nidoran-f': 29, 'nidorina': 30,
          'nidoqueen': 31, 'nidoran-m': 32, 'nidorino': 33, 'nidoking': 34, 'clefairy': 35, 'clefable': 36,
          'vulpix': 37, 'ninetales': 38, 'jigglypuff': 39, 'wigglytuff': 40, 'zubat': 41, 'golbat': 42,
          'oddish': 43, 'gloom': 44, 'vileplume': 45, 'paras': 46, 'parasect': 47, 'venonat': 48,
          'venomoth': 49, 'diglett': 50, 'dugtrio': 51, 'meowth': 52, 'persian': 53, 'psyduck': 54,
          'golduck': 55, 'mankey': 56, 'primeape': 57, 'growlithe': 58, 'arcanine': 59, 'poliwag': 60,
          'poliwhirl': 61, 'poliwrath': 62, 'abra': 63, 'kadabra': 64, 'alakazam': 65, 'machop': 66,
          'machoke': 67, 'machamp': 68, 'bellsprout': 69, 'weepinbell': 70, 'victreebel': 71, 'tentacool': 72,
          'tentacruel': 73, 'geodude': 74, 'graveler': 75, 'golem': 76, 'ponyta': 77, 'rapidash': 78,
          'slowpoke': 79, 'slowbro': 80, 'magnemite': 81, 'magneton': 82, 'farfetchd': 83, 'doduo': 84,
          'dodrio': 85, 'seel': 86, 'dewgong': 87, 'grimer': 88, 'muk': 89, 'shellder': 90,
          'cloyster': 91, 'gastly': 92, 'haunter': 93, 'gengar': 94, 'drowzee': 95, 'hypno': 96,
          'krabby': 98, 'kingler': 99, 'voltorb': 100, 'electrode': 101, 'exeggcute': 102, 'exeggutor': 103,
          'cubone': 104, 'marowak': 105, 'hitmonlee': 106, 'hitmonchan': 107, 'lickitung': 108, 'koffing': 109,
          'weezing': 110, 'rhyhorn': 111, 'rhydon': 112, 'chansey': 113, 'tangela': 114, 'kangaskhan': 115,
          'horsea': 116, 'seadra': 117, 'goldeen': 118, 'seaking': 119, 'staryu': 120, 'starmie': 121,
          'mr-mime': 122, 'scyther': 123, 'jynx': 124, 'electabuzz': 125, 'magmar': 126, 'pinsir': 127,
          'tauros': 128, 'magikarp': 129, 'gyarados': 130, 'lapras': 131, 'ditto': 132, 'vaporeon': 134,
          'jolteon': 135, 'flareon': 136, 'omanyte': 138, 'omastar': 139, 'kabuto': 140, 'kabutops': 141,
          'aerodactyl': 142, 'snorlax': 143, 'articuno': 144, 'zapdos': 145, 'moltres': 146, 'dratini': 147,
          'dragonair': 148, 'dragonite': 149, 'mewtwo': 150, 'mew': 151
        };
        
        const mappedId = pokemonIdMap[pokemon.name.toLowerCase()];
        if (mappedId) {
          pokemonId = mappedId;
        } else {
        }
      }
      
      // Use PokemonDB Black 2/White 2 animated sprites for better quality
      const spriteUrl = `https://img.pokemondb.net/sprites/black-white/anim/${pokemon.isShiny ? 'shiny' : 'normal'}/${pokemon.name.toLowerCase()}.gif`;
      
      // Determine status message
      let statusMessage;
      if (alreadyPurchased) {
        statusMessage = '🛒 **Already Purchased Today!**';
      } else if (user.poke_stardust >= price) {
        statusMessage = '✅ **Available!**';
      } else {
        statusMessage = '❌ **Not enough Stardust**';
      }
      
      const pokemonEmbed = new EmbedBuilder()
        .setTitle(`${rarityEmoji} ${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}${pokemon.isShiny ? ' ✨' : ''}`)
        .setDescription(`**Rarity:** ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}${pokemon.isShiny ? ' (Shiny)' : ''}\n💰 **Price:** ${price} Stardust\n${statusMessage}`)
        .setColor(rarityColor)
        .setThumbnail(spriteUrl);
      
      pokemonEmbeds.push(pokemonEmbed);
    }

    // Create buttons for each Pokémon
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    Object.entries(dailyPokemon).forEach(([slot, pokemon], index) => {
      const rarity = pokemon.rarity;
      let price = rarity === 'common' ? 100 : rarity === 'uncommon' ? 250 : rarity === 'legendary' ? 1500 : 500;
      if (pokemon.isShiny) price *= 2;
      const canAfford = user.poke_stardust >= price;
      const alreadyPurchased = todayPurchases[slot];
      const canPurchase = canAfford && !alreadyPurchased;
      
      const button = new ButtonBuilder()
        .setCustomId(`daily_shop_buy_${slot}`)
        .setLabel(`Buy ${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}${pokemon.isShiny ? ' ✨' : ''} (${price})`)
        .setStyle(canPurchase ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(!canPurchase);
      
      currentRow.addComponents(button);
      buttonCount++;
      
      if (buttonCount === 3 || index === Object.keys(dailyPokemon).length - 1) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
        buttonCount = 0;
      }
    });

    // Combine all embeds
    const allEmbeds = [mainEmbed, ...pokemonEmbeds];
    await interaction.editReply({ embeds: allEmbeds, components: rows });

    // Button collector for buy actions
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id && i.customId.startsWith('daily_shop_buy_'),
      time: 60000
    });

    collector.on('collect', async i => {
      const slot = i.customId.replace('daily_shop_buy_', '');
      const pokemon = dailyPokemon[slot];
      const rarity = pokemon.rarity;
      let price = rarity === 'common' ? 100 : rarity === 'uncommon' ? 250 : rarity === 'legendary' ? 1500 : 500;
      if (pokemon.isShiny) price *= 2;
      
      await i.deferUpdate();
      
      try {
        // Call backend to purchase the Pokémon
        const res = await axios.post(`${backendUrl}/users/${userId}/pokemon/purchase`, {
          pokemonName: pokemon.name,
          price: price,
          rarity: rarity,
          isShiny: pokemon.isShiny
        }, { headers: { 'x-guild-id': guildId } });
        
        // Show success message
        await interaction.followUp({ 
          content: `✅ Successfully purchased ${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}${pokemon.isShiny ? ' ✨' : ''} for ${price} Stardust!`, 
          ephemeral: true 
        });
        
        // Refresh the shop display
        try {
          const updatedUserRes = await axios.get(`${backendUrl}/users/${userId}`, { headers: { 'x-guild-id': guildId } });
          const updatedUser = updatedUserRes.data.user || updatedUserRes.data;
        
        // Update main embed with new stardust amount
        mainEmbed.spliceFields(0, 1, { name: 'Your Stardust', value: String(updatedUser.poke_stardust || 0), inline: true });
        
        // Update buttons based on new stardust and purchase status
        let updatedTodayPurchases = {};
        try {
          const updatedPurchasesRes = await axios.get(`${backendUrl}/users/${userId}/pokemon/daily-purchases/${todayKey}`, { 
            headers: { 'x-guild-id': guildId } 
          });
          const updatedPurchases = updatedPurchasesRes.data.purchases || [];
          updatedPurchases.forEach(purchase => {
            updatedTodayPurchases[purchase.rarity] = purchase;
          });
        } catch (error) {
          console.error('[DailyShop] Error fetching updated purchases:', error);
        }
        
        // Update Pokémon embeds with new availability status
        pokemonEmbeds.forEach((pokemonEmbed, index) => {
          const slot = Object.keys(dailyPokemon)[index];
          const pokemon = dailyPokemon[slot];
          const rarity = pokemon.rarity;
          let price = rarity === 'common' ? 100 : rarity === 'uncommon' ? 250 : rarity === 'legendary' ? 1500 : 500;
          if (pokemon.isShiny) price *= 2;
          const canAfford = updatedUser.poke_stardust >= price;
          const alreadyPurchased = updatedTodayPurchases[rarity];
          
          let statusMessage;
          if (alreadyPurchased) {
            statusMessage = '🛒 **Already Purchased Today!**';
          } else if (canAfford) {
            statusMessage = '✅ **Available!**';
          } else {
            statusMessage = '❌ **Not enough Stardust**';
          }
          
          pokemonEmbed.setDescription(
            pokemonEmbed.data.description.replace(
              /✅ \*\*Available!\*\*|❌ \*\*Not enough Stardust\*\*|🛒 \*\*Already Purchased Today!\*\*/,
              statusMessage
            )
          );
        });
        rows.forEach(row => {
          row.components.forEach((btn, btnIndex) => {
            const slot = Object.keys(dailyPokemon)[btnIndex];
            const pokemon = dailyPokemon[slot];
            const rarity = pokemon.rarity;
            let price = rarity === 'common' ? 100 : rarity === 'uncommon' ? 250 : rarity === 'legendary' ? 1500 : 500;
            if (pokemon.isShiny) price *= 2;
            const canAfford = updatedUser.poke_stardust >= price;
            const alreadyPurchased = updatedTodayPurchases[rarity];
            const canPurchase = canAfford && !alreadyPurchased;
            btn.setStyle(canPurchase ? ButtonStyle.Primary : ButtonStyle.Secondary);
            btn.setDisabled(!canPurchase);
          });
        });
        
        // Combine all embeds and send updated response
        const updatedAllEmbeds = [mainEmbed, ...pokemonEmbeds];
        await interaction.editReply({ embeds: updatedAllEmbeds, components: rows });
        
        } catch (updateError) {
          console.error('[DailyShop] Error updating shop display:', updateError);
          // Don't show error to user since purchase was successful
        }
        
      } catch (e) {
        const msg = e.response?.data?.message || 'Failed to purchase Pokémon.';
        await interaction.followUp({ content: `❌ ${msg}`, ephemeral: true });
      }
      
      collector.stop();
    });

    collector.on('end', () => {
      // Disable buttons after timeout
      rows.forEach(row => {
        row.components.forEach(btn => btn.setDisabled(true));
      });
      interaction.editReply({ components: rows }).catch(() => {});
    });
  }
}; 