const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const customSpawnRates = require('../data/customSpawnRates.json');
const pokeCache = require('../utils/pokeCache');
const { getPreviousGenInfo, getCurrentGenInfo, GENERATION_NAMES } = require('../config/generationConfig');

// --- Seeded RNG utilities for fair, consistent half-day randomness per user ---
function xfnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13; h ^= h >>> 7;
    h += h << 3;  h ^= h >>> 17;
    h += h << 5;
    return h >>> 0;
  };
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function createUserPeriodRng(userId, periodKey) {
  const seedFunc = xfnv1a(`${userId}-${periodKey}`);
  const seed = seedFunc();
  return mulberry32(seed);
}

function rngInt(rng, max) {
  return Math.floor(rng() * max);
}

// Group Pokémon by rarity (Previous Gen only)
const pokemonByRarity = {
  common: [],
  uncommon: [],
  rare: [],
  legendary: []
};

// Function to populate rarity groups for a specific generation
function populateGenerationPools(genNumber) {
  const pools = {
    common: [],
    uncommon: [],
    rare: [],
    legendary: []
  };
  
  Object.entries(customSpawnRates).forEach(([name, data]) => {
    if (data.gen === genNumber && pools[data.rarity]) {
      pools[data.rarity].push({ name, ...data });
    }
  });
  
  return pools;
}

// Populate the rarity groups with only Previous Gen Pokémon (default)
(function populatePreviousGenPools() {
  const prevGen = getPreviousGenInfo().number;
  Object.entries(customSpawnRates).forEach(([name, data]) => {
    if (data.gen === prevGen && pokemonByRarity[data.rarity]) {
      pokemonByRarity[data.rarity].push({ name, ...data });
    }
  });
})();

function getDailyPokemon(userId, guildId, halfDayKey, genNumber = null) {
  // Use a user-level RNG per half-day so each user sees their own rotation
  const rng = createUserPeriodRng(userId, halfDayKey);

  // Helper function to check if a Pokémon should be shiny (5% chance - buffed from 1%)
  const isShiny = () => rng() < 0.05;

  // Helper function to check if a Pokémon should be a form (30% chance - buffed from 5%)
  const isFormChance = () => rng() < 0.3;

  // Helper function to get a random form for a Pokémon
  const getRandomForm = (pokemonName, baseSeed) => {
    try {
      const pokemonForms = require('../data/pokemonForms.json');
      const forms = pokemonForms[pokemonName]?.forms || [];
      if (forms.length > 0) {
        // Weight forms by spawnRate, pick with RNG
        const totalWeight = forms.reduce((sum, form) => sum + form.spawnRate, 0);
        let pick = rng() * totalWeight;
        for (const form of forms) {
          pick -= form.spawnRate;
          if (pick <= 0) return form;
        }
        return forms[forms.length - 1];
      }
    } catch (error) {
      console.error('Error loading forms data:', error);
    }
    return null;
  };
  
  // Get the appropriate rarity pools for the selected generation
  let rarityPools;
  if (genNumber) {
    rarityPools = populateGenerationPools(genNumber);
  } else {
    rarityPools = pokemonByRarity; // Use default previous gen pools
  }
  
  // Select one Pokémon from each rarity using RNG (uniform within rarity)
  const commonBase = rarityPools.common[rngInt(rng, rarityPools.common.length)];
  const uncommonBase = rarityPools.uncommon[rngInt(rng, rarityPools.uncommon.length)];
  // 30% chance to upgrade rare slot to legendary (buffed from 5%)
  const pickLegendary = rng() < 0.3 && rarityPools.legendary.length > 0;
  const rareBase = pickLegendary
    ? rarityPools.legendary[rngInt(rng, rarityPools.legendary.length)]
    : rarityPools.rare[rngInt(rng, rarityPools.rare.length)];

  // Add form and shiny properties
  const commonFormData = isFormChance() ? getRandomForm(commonBase.name) : null;
  const commonPokemon = { 
    ...commonBase, 
    isShiny: isShiny(),
    isForm: !!commonFormData, // Only true if form data exists
    formData: commonFormData
  };
  
  const uncommonFormData = isFormChance() ? getRandomForm(uncommonBase.name) : null;
  const uncommonPokemon = { 
    ...uncommonBase, 
    isShiny: isShiny(),
    isForm: !!uncommonFormData, // Only true if form data exists
    formData: uncommonFormData
  };
  
  const rareFormData = isFormChance() ? getRandomForm(rareBase.name) : null;
  const rarePokemon = { 
    ...rareBase, 
    isShiny: isShiny(),
    isForm: !!rareFormData, // Only true if form data exists
    formData: rareFormData
  };
  
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
    .setDescription('View today\'s rotating Previous Generation Pokémon shop featuring Pokémon from different rarities!')
    .addIntegerOption(option =>
      option.setName('gen')
        .setDescription('Select which previous generation to view (1-3)')
        .setRequired(false)
        .addChoices(
          { name: 'Gen 1 - Kanto', value: 1 },
          { name: 'Gen 2 - Johto', value: 2 },
          { name: 'Gen 3 - Hoenn', value: 3 }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const backendUrl = process.env.BACKEND_API_URL;
    
    // Get the selected generation, default to previous generation if not specified
    const selectedGen = interaction.options.getInteger('gen') || getPreviousGenInfo().number;
    
    let user;
    try {
      // Fetch user info to get stardust
      const userRes = await axios.get(`${backendUrl}/users/${userId}`, { headers: { 'x-guild-id': guildId } });
      user = userRes.data.user || userRes.data;
    } catch (e) {
      return interaction.editReply('Failed to fetch your user data. Please try again later.');
    }

    // Ensure pokeCache is ready for required generations
    if (!pokeCache.isKantoCacheReady()) await pokeCache.buildKantoCache();
    if (!pokeCache.isGen2CacheReady()) await pokeCache.buildGen2Cache();
    if (!pokeCache.isGen3CacheReady()) await pokeCache.buildGen3Cache();
    // Build half-day key consistent with purchases to sync rotation windows
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Half-day key: YYYY-MM-DD-0 for 00:00-11:59, -1 for 12:00-23:59
    const baseDateKey = today.toISOString().split('T')[0];
    const nowForKey = new Date();
    const halfDaySlot = nowForKey.getHours() < 12 ? '0' : '1';
    const todayKey = `${baseDateKey}-${halfDaySlot}`;
    const purchaseDateKey = todayKey; // backend expects YYYY-MM-DD-0/1 format
    const halfDayKey = todayKey;
    // Seed with userId + guildId + half-day for per-user-per-guild variety
    const dailyPokemon = getDailyPokemon(`${userId}-${guildId}`, guildId, halfDayKey, selectedGen);
    
    // Check daily shop purchases
    
    // Calculate time until next reset (every 12 hours)
    const now = new Date();
    const nextReset = new Date(now);
    if (now.getHours() < 12) {
      nextReset.setHours(12, 0, 0, 0);
    } else {
      nextReset.setDate(nextReset.getDate() + 1);
      nextReset.setHours(0, 0, 0, 0);
    }
    const timeUntilReset = nextReset - now;
    const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    // Fetch today's purchases from the backend
    let todayPurchases = {};
    try {
      const purchasesRes = await axios.get(`${backendUrl}/users/${userId}/pokemon/daily-purchases/${purchaseDateKey}`, { 
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
    const genInfo = {
      number: selectedGen,
      name: GENERATION_NAMES[selectedGen] || `Gen ${selectedGen}`
    };
    const mainEmbed = new EmbedBuilder()
      .setTitle(`🛒 Daily Gen ${genInfo.number} (${genInfo.name}) Pokémon Shop`)
      .setDescription(`Today's rotating Gen ${genInfo.number} (${genInfo.name}) Pokémon selection!`)
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
      if (pokemon.isForm) price *= 3;
      const alreadyPurchased = todayPurchases[rarity];
      
      // Get Pokémon ID - try pokeCache first, then fallback to direct mapping
      let pokemonId = 1; // Default to Bulbasaur
      let displayName = pokemon.name;
      let formName = null;
      
      // If it's a form, use the form's data
      if (pokemon.isForm && pokemon.formData) {
        pokemonId = pokemon.formData.pokemonId;
        displayName = pokemon.formData.name;
        formName = pokemon.formData.name;
      } else {
        // Use base Pokemon ID from the selected generation species cache
        let speciesList = [];
        if (selectedGen === 1) {
          speciesList = pokeCache.kantoSpecies || [];
        } else if (selectedGen === 2) {
          speciesList = pokeCache.gen2Species || [];
        } else if (selectedGen === 3) {
          speciesList = pokeCache.gen3Species || [];
        }
        if (speciesList && speciesList.length > 0) {
          let species = speciesList.find(s => s.name === pokemon.name.toLowerCase());
          if (!species) {
            species = speciesList.find(s => s.name.toLowerCase() === pokemon.name.toLowerCase());
          }
          if (species) {
            pokemonId = species.id;
          }
        } else {
          // Fallback: Direct mapping for common Kanto Pokémon (only applies if selectedGen is 1)
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
          
          if (selectedGen === 1) {
            const mappedId = pokemonIdMap[pokemon.name.toLowerCase()];
            if (mappedId) {
              pokemonId = mappedId;
            }
          }
        }
      }
      
             // Use Pokemon Showdown sprites for all Pokemon (including forms)
       const { getShowdownGif } = require('../index.js');
       let spriteUrl;
       try {
         // Use the form name if it's a form, otherwise use the base Pokemon name
         const spriteName = pokemon.isForm && pokemon.formData ? pokemon.formData.id : pokemon.name;
         spriteUrl = await getShowdownGif(spriteName, pokemon.isShiny, true);
       } catch (error) {
         console.error('Error getting Showdown sprite:', error);
         // Fallback to PokemonDB sprites
         const spriteName = pokemon.name.toLowerCase();
         spriteUrl = `https://img.pokemondb.net/sprites/black-white/anim/${pokemon.isShiny ? 'shiny' : 'normal'}/${spriteName}.gif`;
       }
      
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
        .setTitle(`${rarityEmoji} ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}${pokemon.isShiny ? ' ✨' : ''}${pokemon.isForm ? ' 🔮' : ''}`)
        .setDescription(`**Rarity:** ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}${pokemon.isShiny ? ' (Shiny)' : ''}${pokemon.isForm ? ' (Form)' : ''}\n💰 **Price:** ${price} Stardust\n${statusMessage}`)
        .setColor(rarityColor)
        .setThumbnail(spriteUrl);
      
      pokemonEmbeds.push(pokemonEmbed);
    }

    // Create buttons for each Pokémon
    const buttonToken = interaction.id; // unique per command invocation
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    Object.entries(dailyPokemon).forEach(([slot, pokemon], index) => {
      const rarity = pokemon.rarity;
      let price = rarity === 'common' ? 100 : rarity === 'uncommon' ? 250 : rarity === 'legendary' ? 1500 : 500;
      if (pokemon.isShiny) price *= 2;
      if (pokemon.isForm) price *= 3;
      const canAfford = user.poke_stardust >= price;
      const alreadyPurchased = todayPurchases[rarity];
      const canPurchase = canAfford && !alreadyPurchased;
      
      // Get display name for this Pokemon
      let displayName = pokemon.name;
      if (pokemon.isForm && pokemon.formData) {
        displayName = pokemon.formData.name;
      }
      
      const button = new ButtonBuilder()
        .setCustomId(`daily_shop_buy_${buttonToken}_${slot}`)
        .setLabel(`Buy ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}${pokemon.isShiny ? ' ✨' : ''}${pokemon.isForm ? ' 🔮' : ''} (${price})`)
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
    const message = await interaction.editReply({ embeds: allEmbeds, components: rows });

    // Button collector for buy actions
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id && i.customId.startsWith(`daily_shop_buy_${buttonToken}_`),
      time: 60000
    });

    collector.on('collect', async i => {
      const slot = i.customId.replace(`daily_shop_buy_${buttonToken}_`, '');
      const pokemon = dailyPokemon[slot];
      const rarity = pokemon.rarity;
      let price = rarity === 'common' ? 100 : rarity === 'uncommon' ? 250 : rarity === 'legendary' ? 1500 : 500;
      if (pokemon.isShiny) price *= 2;
      if (pokemon.isForm) price *= 3;
      
      try {
        // Defer the button update first
        await i.deferUpdate();
        
        // Call backend to purchase the Pokémon
        const res = await axios.post(`${backendUrl}/users/${userId}/pokemon/purchase`, {
          pokemonName: pokemon.name,
          price: price,
          rarity: rarity,
          isShiny: pokemon.isShiny,
          formId: pokemon.isForm ? pokemon.formData.id : null,
          formName: pokemon.isForm ? pokemon.formData.name : null
        }, { headers: { 'x-guild-id': guildId } });
        
        // Get display name for this Pokemon
        let displayName = pokemon.name;
        if (pokemon.isForm && pokemon.formData) {
          displayName = pokemon.formData.name;
        }
        
        // Show success message using the button interaction
        await i.followUp({ 
          content: `✅ Successfully purchased ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}${pokemon.isShiny ? ' ✨' : ''}${pokemon.isForm ? ' 🔮' : ''} for ${price} Stardust!`, 
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
            const updatedPurchasesRes = await axios.get(`${backendUrl}/users/${userId}/pokemon/daily-purchases/${purchaseDateKey}`, { 
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
            if (pokemon.isForm) price *= 3;
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
          
          // Update button states
          let buttonIndex = 0;
          rows.forEach(row => {
            row.components.forEach((btn) => {
              const slot = Object.keys(dailyPokemon)[buttonIndex];
              const pokemon = dailyPokemon[slot];
              const rarity = pokemon.rarity;
              let price = rarity === 'common' ? 100 : rarity === 'uncommon' ? 250 : rarity === 'legendary' ? 1500 : 500;
              if (pokemon.isShiny) price *= 2;
              if (pokemon.isForm) price *= 3;
              const canAfford = updatedUser.poke_stardust >= price;
              const alreadyPurchased = updatedTodayPurchases[rarity];
              const canPurchase = canAfford && !alreadyPurchased;
              btn.setStyle(canPurchase ? ButtonStyle.Primary : ButtonStyle.Secondary);
              btn.setDisabled(!canPurchase);
              buttonIndex++;
            });
          });
          
          // Update the message through the button interaction
          const updatedAllEmbeds = [mainEmbed, ...pokemonEmbeds];
          await i.editReply({ embeds: updatedAllEmbeds, components: rows });
          
        } catch (updateError) {
          console.error('[DailyShop] Error updating shop display:', updateError);
          // Don't show error to user since purchase was successful
        }
        
        // Disable all buttons after successful purchase since collector ends
        rows.forEach(row => {
          row.components.forEach(btn => btn.setDisabled(true));
        });
        
        // Update the message one final time with disabled buttons
        try {
          const finalAllEmbeds = [mainEmbed, ...pokemonEmbeds];
          await i.editReply({ embeds: finalAllEmbeds, components: rows });
        } catch (finalUpdateError) {
          console.error('[DailyShop] Error in final button update:', finalUpdateError);
        }
        
      } catch (e) {
        console.error('[DailyShop] Error processing purchase:', e);
        const msg = e.response?.data?.message || 'Failed to purchase Pokémon.';
        
        // Try to show error message, but don't fail if interaction is expired
        try {
          await i.followUp({ content: `❌ ${msg}`, ephemeral: true });
        } catch (followUpError) {
          console.error('[DailyShop] Error showing error message:', followUpError);
        }
      }
      
      // Stop the collector after processing
      collector.stop();
    });

    collector.on('end', () => {
      // Disable buttons after timeout
      rows.forEach(row => {
        row.components.forEach(btn => btn.setDisabled(true));
      });
      
      // Try to update the message, but don't fail if interaction is expired
      try {
        // Since we can't guarantee which interaction is still valid, we'll just log this
        console.log('[DailyShop] Collector ended, buttons disabled');
      } catch (error) {
        console.error('[DailyShop] Error in collector end handler:', error);
      }
    });
  }
}; 