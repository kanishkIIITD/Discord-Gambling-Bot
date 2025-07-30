const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const PlacedBet = require('../models/PlacedBet');
const Transaction = require('../models/Transaction');
const UserPreferences = require('../models/UserPreferences');
const Duel = require('../models/Duel');
const { requireGuildId } = require('../middleware/auth');
const { calculateTimeoutCost, isValidTimeoutDuration, isOnTimeoutCooldown, getRemainingCooldown, BASE_COST_PER_MINUTE, BALANCE_PERCENTAGE } = require('../utils/timeoutUtils');
const { auth } = require('../middleware/auth');
const { getUserGuilds } = require('../utils/discordClient');
const { 
  selectPunishment,
  applyPunishment,
  cleanActivePunishments,
  getStealCooldownField,
  getStealCooldownHours,
  getStealSuccessRate,
  getPunishmentDescription,
  calculateBailAmount
} = require('../utils/gamblingUtils');
const Pokemon = require('../models/Pokemon');
const DailyShopPurchase = require('../models/DailyShopPurchase');
const GlobalEvent = require('../models/GlobalEvent');
const pokeApi = require('../utils/pokeApi');

const DAILY_GOALS = { catch: 10, battle: 3, evolve: 2 };
const WEEKLY_GOALS = { catch: 50, battle: 15, evolve: 7 };

// Rarity weights for buffs
const baseWeights = {
  og: 0.1,
  transcendent: 0.4,
  mythical: 1,
  legendary: 3,
  epic: 5.5,
  rare: 15,
  uncommon: 25,
  common: 50
};
// Rarity order for buffs
const rarityOrder = [
  'og',
  'transcendent',
  'mythical',
  'legendary',
  'epic',
  'rare',
  'uncommon',
  'common'
];

// --- GET USER GUILDS ENDPOINT ---
router.get('/:discordId/guilds', auth, async (req, res) => {
  // console.log('[UserRoutes] Received request for user guilds, discordId:', req.params.discordId);
  try {
    const { discordId } = req.params;
    // console.log('[UserRoutes] Authenticated user:', req.user.discordId, 'Role:', req.user.role);
    
    // Verify that the authenticated user is requesting their own guilds
    if (req.user.discordId !== discordId && req.user.role !== 'superadmin') {
      // console.log('[UserRoutes] Unauthorized access attempt. Requester:', req.user.discordId, 'Target:', discordId);
      return res.status(403).json({ message: 'You can only request your own guilds.' });
    }
    
    // console.log('[UserRoutes] Authorization passed, fetching guilds for:', discordId);
    // Get the guilds the user has access to
    const userGuilds = await getUserGuilds(discordId);
    // console.log('[UserRoutes] Guilds fetched successfully, count:', userGuilds ? userGuilds.length : 0);
    
    res.json({
      guilds: userGuilds
    });
  } catch (error) {
    console.error('[UserRoutes] Error fetching user guilds:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /:discordId/pokemon/attempt-catch - Full catch logic with Poké Ball and XP booster support
router.post('/:discordId/pokemon/attempt-catch', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { pokemonId, name, isShiny, ballType = 'normal' } = req.body;
    if (!pokemonId || !name) {
      return res.status(400).json({ success: false, message: 'Missing pokemonId or name.' });
    }
    // Find or create user
    let user = await User.findOne({ discordId, guildId });
    if (!user) {
      user = new User({ discordId, guildId, username: discordId });
      await user.save();
    }
    // --- Poké Ball usage logic ---
    let ballField = null, ballLabel = 'Poké Ball', ballBonus = 1.0;
    if (ballType === 'rare') {
      ballField = 'poke_rareball_uses';
      ballLabel = 'Great Poké Ball';
      ballBonus = 1.75;
    } else if (ballType === 'ultra') {
      ballField = 'poke_ultraball_uses';
      ballLabel = 'Ultra Poké Ball';
      ballBonus = 2.0;
    } else if (ballType === 'masterball') {
      ballField = 'poke_masterball_uses';
      ballLabel = 'Master Poké Ball';
      ballBonus = 100.0; // 100% catch rate
    }
    if (ballField) {
      if ((user[ballField] || 0) <= 0) {
        return res.status(400).json({ success: false, message: `You have no ${ballLabel}s left!`, ballUsed: ballLabel });
      }
      user[ballField] -= 1;
    }
    // --- Use customSpawnRates if available ---
    const { getCustomSpawnInfo, getLevelForXp, getUnlockedShopItems } = require('../utils/pokeApi');
    const spawnInfo = getCustomSpawnInfo(name);
    let catchRate = null;
    let xpYield = 0;
    let dustYield = 0;
    if (spawnInfo) {
      if (typeof spawnInfo.catchRate === 'number') catchRate = spawnInfo.catchRate;
      if (typeof spawnInfo.xpYield === 'number') xpYield = spawnInfo.xpYield;
      if (typeof spawnInfo.dustYield === 'number') dustYield = spawnInfo.dustYield;
    }
    // --- Fetch PokéAPI data for fallback and flavor text ---
    let captureRate = null;
    let dexNum = pokemonId;
    let flavorText = '';
    try {
      const speciesRes = await pokeApi.getPokemonDataById(pokemonId);
      if (speciesRes && speciesRes.species && speciesRes.species.url) {
        const fetch = require('node-fetch');
        const speciesData = await fetch(speciesRes.species.url).then(r => r.json());
        if (captureRate === null) captureRate = speciesData.capture_rate || 120;
        dexNum = speciesData.id || pokemonId;
        const flavorEntries = (speciesData.flavor_text_entries || []).filter(e => e.language.name === 'en');
        flavorText = flavorEntries.length > 0
          ? flavorEntries[Math.floor(Math.random() * flavorEntries.length)].flavor_text.replace(/\f/g, ' ')
          : '';
      }
    } catch (e) { /* fallback to defaults */ }
    // --- Use custom catchRate if available, else fallback to PokéAPI's capture_rate ---
    let baseChance = (catchRate !== null ? catchRate : (captureRate !== null ? captureRate / 255 : 120 / 255));
    if (catchRate !== null && catchRate <= 1) baseChance = catchRate; // If customSpawnRates uses 0-1 scale
    else if (catchRate !== null) baseChance = catchRate / 255; // If customSpawnRates uses 0-255 scale
    let finalChance = Math.min(baseChance * ballBonus, 0.99); // cap at 99%
    const roll = Math.random();
    // --- XP Booster logic ---
    let xpBoosterUsed = false;
    let xpMultiplier = 1;
    // --- Prepare embed fields ---
    let embedData = {
      title: '',
      description: '',
      dexNum,
      ballUsed: ballLabel,
      catchChance: (finalChance * 100).toFixed(2) + '%',
      isShiny: !!isShiny,
      flavorText,
      xpBoosterUsed,
    };
    // --- Atomicity: check for duplicate after asyncs ---
    let isDuplicate = false;
    let pokemon = await Pokemon.findOne({ discordId, guildId, pokemonId, isShiny: !!isShiny });
    if (pokemon) isDuplicate = true;
    // --- Catch logic ---
    if (roll < finalChance) {
      // Success: add Pokémon to collection (as in old endpoint)
      if ((user.poke_xp_booster_uses || 0) > 0) {
        xpMultiplier = 2;
        xpBoosterUsed = true;
        user.poke_xp_booster_uses -= 1;
      }
      let ability = '';
      try {
        const pokeData = await pokeApi.getPokemonDataById(pokemonId);
        const abilitiesArr = pokeData.abilities || [];
        const nonHidden = abilitiesArr.filter(a => !a.is_hidden);
        const pool = nonHidden.length > 0 ? nonHidden : abilitiesArr;
        if (pool.length > 0) {
          const idx = Math.floor(Math.random() * pool.length);
          ability = pool[idx].ability.name;
        }
      } catch (e) { ability = ''; }
      if (pokemon) {
        pokemon.count = (pokemon.count || 1) + 1;
        pokemon.caughtAt = new Date();
        await pokemon.save();
      } else {
        pokemon = new Pokemon({
          user: user._id,
          discordId,
          guildId,
          pokemonId,
          name,
          isShiny: !!isShiny,
          caughtAt: new Date(),
          count: 1,
          ivs: {
            hp: Math.floor(Math.random() * 32),
            attack: Math.floor(Math.random() * 32),
            defense: Math.floor(Math.random() * 32),
            spAttack: Math.floor(Math.random() * 32),
            spDefense: Math.floor(Math.random() * 32),
            speed: Math.floor(Math.random() * 32),
          },
          evs: {
            hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0,
          },
          nature: randomNature(),
          ability,
          status: null,
          boosts: {
            attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0,
          },
        });
        await pokemon.save();
      }
      // Award XP and Stardust
      let xpAward = xpYield * xpMultiplier;
      let dustAward = dustYield;
      
      // Check for double weekend event
      const doubleWeekendEvent = await GlobalEvent.getActiveDoubleWeekend();
      if (doubleWeekendEvent) {
        xpAward *= doubleWeekendEvent.multiplier;
        dustAward *= doubleWeekendEvent.multiplier;
      }
      
      user.poke_xp = (user.poke_xp || 0) + xpAward;
      user.poke_stardust = (user.poke_stardust || 0) + dustAward;
      user.poke_quest_daily_catch = (user.poke_quest_daily_catch || 0) + 1;
      user.poke_quest_weekly_catch = (user.poke_quest_weekly_catch || 0) + 1;
      if (user.poke_quest_daily_catch >= DAILY_GOALS.catch) user.poke_quest_daily_completed = true;
      if (user.poke_quest_weekly_catch >= WEEKLY_GOALS.catch) user.poke_quest_weekly_completed = true;
      // Level up logic
      const prevLevel = user.poke_level || 1;
      const newLevel = getLevelForXp(user.poke_xp);
      let newlyUnlocked = [];
      if (newLevel > prevLevel) {
        user.poke_level = newLevel;
        const prevUnlocks = new Set(getUnlockedShopItems(prevLevel).map(i => i.key));
        const newUnlocks = getUnlockedShopItems(newLevel).filter(i => !prevUnlocks.has(i.key));
        newlyUnlocked = newUnlocks.map(i => i.name);
      }
      await user.save();
      // --- Custom display name logic for embed title ---
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
      function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
      const displayName = capitalizeFirst(getDisplayName(name));
      embedData.title = isDuplicate
        ? `You caught another ${isShiny ? '✨ SHINY ' : ''}${displayName}!`
        : `🎉 This is your first ${isShiny ? '✨ SHINY ' : ''}${displayName}! Added to your Pokédex!`;
      embedData.description = flavorText || (isShiny ? `✨ Incredible! <@${discordId}> caught a shiny Pokémon! ✨` : `Congratulations <@${discordId}>! The wild Pokémon is now yours.`);      
      return res.json({
        success: true,
        message: embedData.title,
        embedData,
        xpAward,
        dustAward,
        ballUsed: ballLabel,
        isDuplicate,
        newLevel: newLevel > prevLevel ? newLevel : null,
        newlyUnlocked,
        xpBoosterUsed,
        doubleWeekendActive: !!doubleWeekendEvent,
        doubleWeekendMultiplier: doubleWeekendEvent?.multiplier || 1
      });
    } else {
      // Failure: Pokémon broke free
      await user.save(); // Save ball decrement and XP booster decrement if any
      // --- Custom display name logic for embed title ---
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
      function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
      const displayName = capitalizeFirst(getDisplayName(name));
      embedData.title = `Oh no! The #${String(dexNum).padStart(3, '0')} ${displayName} broke free!`;
      embedData.description = flavorText || `<@${discordId}> Better luck next time!`;
      return res.json({
        success: false,
        message: embedData.title,
        embedData,
        ballUsed: ballLabel
      });
    }
  } catch (error) {
    console.error('[Attempt Catch] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to attempt catch.' });
  }
});

// --- SHOP ENDPOINTS ---
// POST /:discordId/shop/buy - Buy a shop item (one of: rare, ultra, xp, evolution)
router.post('/:discordId/shop/buy', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { item } = req.body; // item: 'rare', 'ultra', 'xp', 'evolution'
    const now = new Date();
    const SHOP_ITEMS = {
      rare: { name: '5x Great Poké Balls', level: 5, price: 250, cooldownField: 'poke_rareball_ts' },
      ultra: { name: '3x Ultra Poké Balls', level: 10, price: 225, cooldownField: 'poke_ultraball_ts' },
      xp: { name: '6x XP Booster', level: 15, price: 100, cooldownField: 'poke_xp_booster_ts' },
      evolution: { name: "Evolver's Ring", level: 20, price: 200, cooldownField: 'poke_daily_ring_ts' },
      // EV-boosting items
      hp_up: { name: '4x HP Up', level: 25, price: 150, cooldownField: 'poke_hp_up_ts' },
      protein: { name: '4x Protein', level: 25, price: 150, cooldownField: 'poke_protein_ts' },
      iron: { name: '4x Iron', level: 25, price: 150, cooldownField: 'poke_iron_ts' },
      calcium: { name: '4x Calcium', level: 25, price: 150, cooldownField: 'poke_calcium_ts' },
      zinc: { name: '4x Zinc', level: 25, price: 150, cooldownField: 'poke_zinc_ts' },
      carbos: { name: '4x Carbos', level: 25, price: 150, cooldownField: 'poke_carbos_ts' },
      rare_candy: { name: '3x Rare Candy', level: 30, price: 500, cooldownField: 'poke_rare_candy_ts' },
      master_ball: { name: '1 Effort Candy', level: 35, price: 1000, cooldownField: 'poke_master_ball_ts' },
      reset_bag: { name: '1 Reset Bag', level: 20, price: 300, cooldownField: 'poke_reset_bag_ts' },
      masterball: { name: '1 Master Poké Ball', level: 35, price: 5000, cooldownField: 'poke_masterball_ts', cooldownDays: 7 }
    };
    if (!SHOP_ITEMS[item]) {
      return res.status(400).json({ message: 'Invalid shop item.' });
    }
    let user = await User.findOne({ discordId, guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    // Check level
    if ((user.poke_level || 1) < SHOP_ITEMS[item].level) {
      return res.status(403).json({ message: `You must be level ${SHOP_ITEMS[item].level} to buy this item.` });
    }
    // Check cooldown (different for different item types)
    const lastTs = user[SHOP_ITEMS[item].cooldownField];
    let cooldownHours = 12; // Default cooldown
    
    // Set different cooldowns for EV items
    if (item.includes('_')) {
      // EV items have different cooldowns
      if (item === 'rare_candy') cooldownHours = 12;
      else if (item === 'master_ball') cooldownHours = 24; // Effort Candy
      else if (item === 'reset_bag') cooldownHours = 48;
      else cooldownHours = 6; // Vitamins: 6 hours
    }
    
    // Special cooldown for Master Poké Ball (7 days)
    if (item === 'masterball') {
      cooldownHours = 24 * 7; // 7 days
    }
    
    if (lastTs && now - lastTs < cooldownHours * 60 * 60 * 1000) {
      return res.status(429).json({ message: `You can only buy 1 ${SHOP_ITEMS[item].name} every ${cooldownHours} hours.` });
    }
    // Check stardust
    if ((user.poke_stardust || 0) < SHOP_ITEMS[item].price) {
      return res.status(403).json({ message: `Not enough Stardust. Requires ${SHOP_ITEMS[item].price}.` });
    }
    // Deduct stardust and set cooldown
    user.poke_stardust -= SHOP_ITEMS[item].price;
    user[SHOP_ITEMS[item].cooldownField] = now;
    
    // Add items to existing stack (make them stackable)
    if (item === 'evolution') {
      user.poke_ring_charges = (user.poke_ring_charges || 0) + 3;
    } else if (item === 'rare') {
      user.poke_rareball_uses = (user.poke_rareball_uses || 0) + 5;
    } else if (item === 'ultra') {
      user.poke_ultraball_uses = (user.poke_ultraball_uses || 0) + 3;
    } else if (item === 'xp') {
      user.poke_xp_booster_uses = (user.poke_xp_booster_uses || 0) + 6;
    } else if (item === 'hp_up') {
      user.poke_hp_up_uses = (user.poke_hp_up_uses || 0) + 4;
    } else if (item === 'protein') {
      user.poke_protein_uses = (user.poke_protein_uses || 0) + 4;
    } else if (item === 'iron') {
      user.poke_iron_uses = (user.poke_iron_uses || 0) + 4;
    } else if (item === 'calcium') {
      user.poke_calcium_uses = (user.poke_calcium_uses || 0) + 4;
    } else if (item === 'zinc') {
      user.poke_zinc_uses = (user.poke_zinc_uses || 0) + 4;
    } else if (item === 'carbos') {
      user.poke_carbos_uses = (user.poke_carbos_uses || 0) + 4;
    } else if (item === 'rare_candy') {
      user.poke_rare_candy_uses = (user.poke_rare_candy_uses || 0) + 3;
    } else if (item === 'master_ball') {
      user.poke_master_ball_uses = (user.poke_master_ball_uses || 0) + 1;
    } else if (item === 'reset_bag') {
      user.poke_reset_bag_uses = (user.poke_reset_bag_uses || 0) + 1;
    } else if (item === 'masterball') {
      user.poke_masterball_uses = (user.poke_masterball_uses || 0) + 1;
    }
    
    await user.save();
    return res.json({ message: `Successfully bought ${SHOP_ITEMS[item].name}!`, item: SHOP_ITEMS[item].name });
  } catch (error) {
    console.error('[Shop Buy] Error:', error);
    res.status(500).json({ message: 'Failed to buy shop item.' });
  }
});

// POST /:discordId/pokemon/purchase - Purchase a Pokémon from the daily shop
router.post('/:discordId/pokemon/purchase', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { pokemonName, price, rarity, isShiny = false } = req.body;
    const now = new Date();

    // Validate required fields
    if (!pokemonName || !price || !rarity) {
      return res.status(400).json({ message: 'Missing required fields: pokemonName, price, rarity' });
    }

    // Find user
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if user has enough stardust
    if ((user.poke_stardust || 0) < price) {
      return res.status(403).json({ message: `Not enough Stardust. Requires ${price}.` });
    }

    // Check daily limit for this rarity (1 per rarity per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Check if user has already purchased this rarity today
    const existingPurchase = await DailyShopPurchase.findOne({
      discordId,
      guildId,
      date: todayKey,
      rarity
    });
    
    if (existingPurchase) {
      return res.status(429).json({ message: `You have already purchased a ${rarity} Pokémon today. Limit: 1 per rarity per day.` });
    }

    // Get Pokémon data from PokeAPI
    const pokeApi = require('../utils/pokeApi');
    let pokemonData;
    try {
      // Find the Pokémon ID by name
      const customSpawnRates = require('../utils/customSpawnRates.json');
      const pokemonInfo = customSpawnRates[pokemonName.toLowerCase()];
      if (!pokemonInfo) {
        return res.status(400).json({ message: 'Invalid Pokémon name.' });
      }
      
      // Get the Pokémon ID by name using axios
      const axios = require('axios');
      const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${pokemonName.toLowerCase()}`);
      const speciesData = speciesResponse.data;
      
      // Then get the full Pokémon data using the ID
      pokemonData = await pokeApi.getPokemonDataById(speciesData.id);
    } catch (error) {
      console.error('[Pokemon Purchase] Error fetching Pokémon data:', error);
      return res.status(500).json({ message: 'Failed to fetch Pokémon data.' });
    }

    // Deduct stardust
    user.poke_stardust -= price;

    // Add Pokémon to user's collection
    let existingPokemon = await Pokemon.findOne({ 
      discordId, 
      guildId, 
      pokemonId: pokemonData.id,
      isShiny: !!isShiny 
    });

    if (existingPokemon) {
      existingPokemon.count += 1;
      await existingPokemon.save();
    } else {
      const newPokemon = new Pokemon({
        user: user._id,
        discordId,
        guildId,
        pokemonId: pokemonData.id,
        name: pokemonData.name,
        isShiny: !!isShiny,
        count: 1,
        caughtAt: now,
        // Generate random IVs and EVs
        ivs: {
          hp: Math.floor(Math.random() * 32),
          attack: Math.floor(Math.random() * 32),
          defense: Math.floor(Math.random() * 32),
          spAttack: Math.floor(Math.random() * 32),
          spDefense: Math.floor(Math.random() * 32),
          speed: Math.floor(Math.random() * 32)
        },
        evs: {
          hp: 0,
          attack: 0,
          defense: 0,
          spAttack: 0,
          spDefense: 0,
          speed: 0
        },
        nature: require('../utils/pokeApi').randomNature ? require('../utils/pokeApi').randomNature() : 'hardy',
        ability: pokemonData.abilities?.[0]?.ability?.name || 'unknown'
      });
      await newPokemon.save();
    }

    // Record the daily shop purchase
    const dailyPurchase = new DailyShopPurchase({
      user: user._id,
      discordId,
      guildId,
      date: todayKey,
      rarity,
      pokemonName: pokemonData.name,
      price: price,
      isShiny: !!isShiny,
      purchasedAt: now
    });
    await dailyPurchase.save();

    // Update quest progress
    user.poke_quest_daily_catch = (user.poke_quest_daily_catch || 0) + 1;
    user.poke_quest_weekly_catch = (user.poke_quest_weekly_catch || 0) + 1;

    // Check if daily/weekly quests are completed
    if (user.poke_quest_daily_catch >= 10) {
      user.poke_quest_daily_completed = true;
    }
    if (user.poke_quest_weekly_catch >= 50) {
      user.poke_quest_weekly_completed = true;
    }

    await user.save();

    res.json({ 
      message: `Successfully purchased ${pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)} for ${price} Stardust!`,
      pokemon: pokemonData.name,
      price: price,
      rarity: rarity
    });

  } catch (error) {
    console.error('[Pokemon Purchase] Error:', error);
    res.status(500).json({ message: 'Failed to purchase Pokémon.' });
  }
});

// GET /:discordId/pokemon/daily-purchases/:date - Get daily shop purchases for a specific date
router.get('/:discordId/pokemon/daily-purchases/:date', requireGuildId, async (req, res) => {
  try {
    const { discordId, date } = req.params;
    const guildId = req.headers['x-guild-id'];

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Find user
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get daily purchases for the specified date
    const purchases = await DailyShopPurchase.find({
      discordId,
      guildId,
      date
    }).select('rarity pokemonName price purchasedAt');

    res.json({ purchases });
  } catch (error) {
    console.error('[Daily Purchases] Error:', error);
    res.status(500).json({ message: 'Failed to fetch daily purchases.' });
  }
});

// POST /:discordId/evolve-duplicate - Duplicate evolution with Evolver's Ring
router.post('/:discordId/evolve-duplicate', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { pokemonId, isShiny = false, stage = 1, count, evolutionId } = req.body;
    const now = new Date();
    // --- Fetch user and validate ring ---
    const user = await User.findOne({ discordId, guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if ((user.poke_level || 1) < 20) return res.status(403).json({ message: 'You must be level 20+ to use Evolver\'s Ring.' });
    // Check ring purchase (within 24h)
    if (!user.poke_daily_ring_ts || now - user.poke_daily_ring_ts > 24*60*60*1000) {
      return res.status(403).json({ message: 'You must buy an Evolver\'s Ring from the shop today.' });
    }
    if (!user.poke_ring_charges || user.poke_ring_charges <= 0) {
      return res.status(403).json({ message: 'Your Evolver\'s Ring has no charges left. Buy a new one tomorrow.' });
    }
    // --- Evolution requirements ---
    const rarityMultipliers = {
      common: 6,
      uncommon: 5,
      rare: 4,
      legendary: null // lockout
    };
    const baseValue = 1;
    // --- Fetch Pokémon and validate ---
    const pokemons = await Pokemon.find({ discordId, guildId, pokemonId, isShiny });
    if (!pokemons.length) return res.status(404).json({ message: 'No Pokémon found to evolve.' });
    const spawnInfo = require('../utils/pokeApi').getCustomSpawnInfo ? require('../utils/pokeApi').getCustomSpawnInfo(pokemons[0]?.name) : null;
    const rarity = spawnInfo?.rarity || 'common';
    const canEvolve = spawnInfo?.canEvolve || false;
    const multiplier = rarityMultipliers[rarity];
    if (!canEvolve) {
      return res.status(403).json({ message: 'This Pokémon cannot evolve.' });
    }
    // --- Shiny requirement override ---
    const neededDupes = isShiny ? 2 : baseValue * multiplier;
    const neededCharges = 1; // Keep as 1 for all
    if (count !== neededDupes) return res.status(400).json({ message: `${isShiny ? 'Shiny' : rarity.charAt(0).toUpperCase() + rarity.slice(1)} Pokémon require ${neededDupes} duplicates to evolve.` });
    if (user.poke_ring_charges < neededCharges) return res.status(403).json({ message: `Not enough ring charges. Need ${neededCharges}.` });
    const totalDupes = pokemons.reduce((sum, p) => sum + (p.count || 1), 0);
    if (totalDupes < neededDupes) return res.status(403).json({ message: `You need at least ${neededDupes} duplicates to evolve.` });
    // --- Weekly cap ---
    const weekKey = String(pokemonId);
    const evolMap = user.poke_weekly_evolutions || {};
    if ((evolMap[weekKey] || 0) >= 2) return res.status(403).json({ message: 'Max 2 duplicate evolutions per species per week.' });
    // --- Get possible evolutions ---
    const possibleEvos = await pokeApi.getNextEvolutionIds(pokemonId, stage);
    if (!possibleEvos || possibleEvos.length === 0) return res.status(500).json({ message: 'Could not determine next evolution.' });
    if (!evolutionId && possibleEvos.length > 1) {
      // Multiple possible evolutions, client must choose
      return res.status(200).json({
        message: 'Multiple possible evolutions. Please choose one.',
        possibleEvolutions: possibleEvos
      });
    }
    // Determine which evolution to use
    const nextEvoId = evolutionId && possibleEvos.includes(evolutionId) ? evolutionId : possibleEvos[0];
    // --- Perform evolution ---
    let toRemove = neededDupes;
    for (const p of pokemons) {
      if (toRemove <= 0) break;
      const take = Math.min(p.count, toRemove);
      p.count -= take;
      toRemove -= take;
      if (p.count <= 0) await p.deleteOne();
      else await p.save();
    }
    // Deduct ring charges
    user.poke_ring_charges -= neededCharges;
    // Add evolved Pokémon to user
    let evolved = await Pokemon.findOne({ discordId, guildId, pokemonId: nextEvoId, isShiny });
    if (evolved) {
      evolved.count += 1;
      await evolved.save();
    } else {
      let evoName = '';
      try {
        const evoData = await pokeApi.getPokemonDataById(nextEvoId);
        evoName = evoData.name || '';
      } catch {}
      evolved = new Pokemon({
        user: user._id,
        discordId,
        guildId,
        pokemonId: nextEvoId,
        name: evoName,
        isShiny,
        count: 1,
        caughtAt: new Date(),
      });
      await evolved.save();
    }
    // Update weekly evolutions
    evolMap[weekKey] = (evolMap[weekKey] || 0) + 1;
    user.poke_weekly_evolutions = evolMap;
    user.poke_quest_daily_evolve = (user.poke_quest_daily_evolve || 0) + 1;
    user.poke_quest_weekly_evolve = (user.poke_quest_weekly_evolve || 0) + 1;
    if (
      user.poke_quest_daily_evolve >= DAILY_GOALS.evolve
    ) user.poke_quest_daily_completed = true;
    if (
      user.poke_quest_weekly_evolve >= WEEKLY_GOALS.evolve  
    ) user.poke_quest_weekly_completed = true;
    await user.save();
    res.json({ message: `Evolved to next stage!`, evolved, ringCharges: user.poke_ring_charges });
  } catch (error) {
    console.error('[Evolver Ring Evolution] Error:', error);
    res.status(500).json({ message: 'Failed to evolve with duplicates.' });
  }
});

// --- CLAIM ENDPOINTS ---
// POST /:discordId/quests/claim-daily
router.post('/:discordId/quests/claim-daily', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const user = await User.findOne({ discordId, guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!user.poke_quest_daily_completed) return res.status(400).json({ message: 'Daily quest not completed.' });
    if (user.poke_quest_daily_claimed) return res.status(400).json({ message: 'Daily quest reward already claimed.' });
    // Grant reward (e.g., 100 Stardust)
    user.poke_stardust = (user.poke_stardust || 0) + 100;
    user.poke_quest_daily_claimed = true;
    await user.save();
    res.json({ message: 'Daily quest reward claimed!', reward: 100 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to claim daily quest reward.' });
  }
});
// POST /:discordId/quests/claim-weekly
router.post('/:discordId/quests/claim-weekly', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const user = await User.findOne({ discordId, guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!user.poke_quest_weekly_completed) return res.status(400).json({ message: 'Weekly quest not completed.' });
    if (user.poke_quest_weekly_claimed) return res.status(400).json({ message: 'Weekly quest reward already claimed.' });
    // Grant reward (e.g., 500 Stardust)
    user.poke_stardust = (user.poke_stardust || 0) + 500;
    user.poke_quest_weekly_claimed = true;
    await user.save();
    res.json({ message: 'Weekly quest reward claimed!', reward: 500 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to claim weekly quest reward.' });
  }
});

// GET /:discordId/pokedex - List all collected Pokémon for a user
router.get('/:discordId/pokedex', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const pokemons = await Pokemon.find({ discordId, guildId }).sort({ pokemonId: 1, caughtAt: 1 });
    res.json({ pokedex: pokemons });
  } catch (error) {
    console.error('[Pokedex] Error:', error);
    res.status(500).json({ message: 'Failed to fetch pokedex.' });
  }
});

// GET /:discordId/pokemon/:pokemonId/stats - Get detailed stats for a specific Pokemon
router.get('/:discordId/pokemon/:pokemonId/stats', requireGuildId, async (req, res) => {
  try {
    const { discordId, pokemonId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { isShiny = false } = req.query;
    
    // Find the Pokemon
    const pokemon = await Pokemon.findOne({ 
      discordId, 
      guildId, 
      pokemonId: parseInt(pokemonId), 
      isShiny: isShiny === 'true' 
    });
    
    if (!pokemon) {
      return res.status(404).json({ message: 'Pokemon not found.' });
    }
    
    // Get Pokemon data from PokeAPI
    const pokeApi = require('../utils/pokeApi');
    const pokemonData = await pokeApi.getPokemonDataById(pokemon.pokemonId);
    
    // Calculate stats using battleUtils
    const { calculateStats } = require('../utils/battleUtils');
    const stats = calculateStats(
      pokemonData.stats,
      50, // Level 50
      pokemon.ivs,
      pokemon.evs,
      pokemon.nature,
      pokemon.ability
    );
    
    res.json({
      pokemon: {
        _id: pokemon._id,
        pokemonId: pokemon.pokemonId,
        name: pokemon.name,
        isShiny: pokemon.isShiny,
        caughtAt: pokemon.caughtAt,
        count: pokemon.count
      },
      stats,
      evs: pokemon.evs,
      ivs: pokemon.ivs,
      nature: pokemon.nature,
      ability: pokemon.ability
    });
  } catch (error) {
    console.error('[Pokemon Stats] Error:', error);
    res.status(500).json({ message: 'Failed to fetch Pokemon stats.' });
  }
});

// POST /:discordId/pokemon/:pokemonId/apply-ev-item - Apply EV item to a Pokemon
router.post('/:discordId/pokemon/:pokemonId/apply-ev-item', requireGuildId, async (req, res) => {
  try {
    const { discordId, pokemonId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { itemType, isShiny = false } = req.body;
    
    // Find user and Pokemon
    const user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    const pokemon = await Pokemon.findOne({ 
      discordId, 
      guildId, 
      pokemonId: parseInt(pokemonId), 
      isShiny 
    });
    
    if (!pokemon) {
      return res.status(404).json({ message: 'Pokemon not found.' });
    }
    
    // Define EV item effects
    const EV_ITEMS = {
      hp_up: { stat: 'hp', amount: 10, usesField: 'poke_hp_up_uses' },
      protein: { stat: 'attack', amount: 10, usesField: 'poke_protein_uses' },
      iron: { stat: 'defense', amount: 10, usesField: 'poke_iron_uses' },
      calcium: { stat: 'spAttack', amount: 10, usesField: 'poke_calcium_uses' },
      zinc: { stat: 'spDefense', amount: 10, usesField: 'poke_zinc_uses' },
      carbos: { stat: 'speed', amount: 10, usesField: 'poke_carbos_uses' },
      rare_candy: { multi: true, amount: 4, usesField: 'poke_rare_candy_uses' },
      master_ball: { multi: true, amount: 8, usesField: 'poke_master_ball_uses' },
      reset_bag: { reset: true, usesField: 'poke_reset_bag_uses' }
    };
    
    const item = EV_ITEMS[itemType];
    if (!item) {
      return res.status(400).json({ message: 'Invalid EV item type.' });
    }
    
    // Check if user has the item
    if (!user[item.usesField] || user[item.usesField] <= 0) {
      return res.status(403).json({ message: `You don't have any ${itemType.replace('_', ' ')} items.` });
    }
    
    // Handle reset bag
    if (item.reset) {
      pokemon.evs = {
        hp: 0,
        attack: 0,
        defense: 0,
        spAttack: 0,
        spDefense: 0,
        speed: 0
      };
      
      // Add to EV history
      pokemon.evHistory.push({
        item: itemType,
        stat: 'all',
        amount: -Object.values(pokemon.evs).reduce((sum, ev) => sum + ev, 0), // Negative for reset
        appliedAt: new Date()
      });
      
      user[item.usesField]--;
      await user.save();
      await pokemon.save();
      
      return res.json({ 
        message: `Reset all EVs for ${pokemon.name}!`,
        evs: pokemon.evs
      });
    }
    
    // Handle multi-stat boosters
    if (item.multi) {
      const stats = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'];
      let applied = 0;
      
      for (const stat of stats) {
        if (pokemon.evs[stat] < 252) {
          const spaceLeft = 252 - pokemon.evs[stat];
          const toAdd = Math.min(item.amount, spaceLeft);
          pokemon.evs[stat] += toAdd;
          applied += toAdd;
        }
      }
      
      if (applied === 0) {
        return res.status(400).json({ message: 'All stats are already maxed out (252 EVs).' });
      }
      
      // Add to EV history
      pokemon.evHistory.push({
        item: itemType,
        stat: 'all',
        amount: applied,
        appliedAt: new Date()
      });
      
      user[item.usesField]--;
      await user.save();
      await pokemon.save();
      
      return res.json({ 
        message: `Applied ${item.amount} EVs to all stats for ${pokemon.name}! (${applied} total EVs added)`,
        evs: pokemon.evs
      });
    }
    
    // Handle single stat boosters
    const currentEV = pokemon.evs[item.stat];
    if (currentEV >= 252) {
      return res.status(400).json({ message: `${item.stat} is already maxed out (252 EVs).` });
    }
    
    const spaceLeft = 252 - currentEV;
    const toAdd = Math.min(item.amount, spaceLeft);
    
    // Check total EV limit (510 max)
    const totalEVs = Object.values(pokemon.evs).reduce((sum, ev) => sum + ev, 0);
    if (totalEVs + toAdd > 510) {
      return res.status(400).json({ message: 'Cannot exceed 510 total EVs.' });
    }
    
    pokemon.evs[item.stat] += toAdd;
    
    // Add to EV history
    pokemon.evHistory.push({
      item: itemType,
      stat: item.stat,
      amount: toAdd,
      appliedAt: new Date()
    });
    
    user[item.usesField]--;
    
    await user.save();
    await pokemon.save();
    
    res.json({ 
      message: `Applied ${toAdd} EVs to ${item.stat} for ${pokemon.name}!`,
      evs: pokemon.evs
    });
    
  } catch (error) {
    console.error('[Apply EV Item] Error:', error);
    res.status(500).json({ message: 'Failed to apply EV item.' });
  }
});

// POST /:discordId/pokemon/sell-duplicates - Sell duplicate Pokémon for stardust
router.post('/:discordId/pokemon/sell-duplicates', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { pokemonId, isShiny, quantity, preview = false } = req.body;

    // Find or create user
    let user = await User.findOne({ discordId, guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // If preview is true, return list of duplicates with dust values
    if (preview) {
      const duplicates = await Pokemon.find({ 
        discordId, 
        guildId, 
        count: { $gt: 1 } 
      }).sort({ pokemonId: 1, isShiny: 1 });

      const duplicateList = [];
      for (const pokemon of duplicates) {
        // Get dust value from customSpawnRates
        const { getCustomSpawnInfo } = require('../utils/pokeApi');
        const spawnInfo = getCustomSpawnInfo(pokemon.name);
        const dustYield = spawnInfo?.dustYield || 10; // Default to 10 if not found
        
        duplicateList.push({
          _id: pokemon._id,
          pokemonId: pokemon.pokemonId,
          name: pokemon.name,
          isShiny: pokemon.isShiny,
          count: pokemon.count,
          dustYield: dustYield,
          totalValue: dustYield * (pokemon.count - 1), // Value for all duplicates (keeping 1)
          sellableCount: pokemon.count - 1 // Can sell all but 1
        });
      }

      return res.json({
        duplicates: duplicateList,
        totalDuplicates: duplicateList.length,
        totalValue: duplicateList.reduce((sum, p) => sum + p.totalValue, 0)
      });
    }

    // Validate required fields for actual sale
    if (!pokemonId || typeof isShiny !== 'boolean' || !quantity || quantity < 1) {
      return res.status(400).json({ 
        message: 'Missing required fields: pokemonId, isShiny, and quantity (must be > 0).' 
      });
    }

    // Find the Pokémon
    const pokemon = await Pokemon.findOne({ 
      discordId, 
      guildId, 
      pokemonId, 
      isShiny 
    });

    if (!pokemon) {
      return res.status(404).json({ message: 'Pokémon not found in your collection.' });
    }

    // Check if it's a duplicate (count > 1)
    if (pokemon.count <= 1) {
      return res.status(400).json({ message: 'This Pokémon is not a duplicate. You can only sell duplicates.' });
    }

    // Check if user has enough to sell
    const sellableCount = pokemon.count - 1; // Keep at least 1
    if (quantity > sellableCount) {
      return res.status(400).json({ 
        message: `You can only sell up to ${sellableCount} of this Pokémon (keeping 1).` 
      });
    }

    // Get dust value from customSpawnRates
    const { getCustomSpawnInfo } = require('../utils/pokeApi');
    const spawnInfo = getCustomSpawnInfo(pokemon.name);
    const dustYield = spawnInfo?.dustYield || 10; // Default to 10 if not found

    // Calculate total dust to award
    const totalDust = dustYield * quantity;

    // Apply shiny bonus (2x dust for shiny Pokémon)
    const finalDust = pokemon.isShiny ? totalDust * 2 : totalDust;

    // Update Pokémon count
    pokemon.count -= quantity;
    if (pokemon.count <= 0) {
      await pokemon.deleteOne();
    } else {
      await pokemon.save();
    }

    // Award stardust to user
    user.poke_stardust = (user.poke_stardust || 0) + finalDust;
    await user.save();

    // Return success response
    res.json({
      success: true,
      message: `Successfully sold ${quantity}x ${pokemon.isShiny ? '✨ SHINY ' : ''}${pokemon.name} for ${finalDust} stardust!`,
      soldPokemon: {
        name: pokemon.name,
        isShiny: pokemon.isShiny,
        quantity: quantity,
        dustPerUnit: dustYield,
        totalDust: finalDust,
        shinyBonus: pokemon.isShiny ? '2x' : 'none'
      },
      remainingCount: pokemon.count > 0 ? pokemon.count : 0,
      newStardustBalance: user.poke_stardust
    });

  } catch (error) {
    console.error('[Sell Duplicates] Error:', error);
    res.status(500).json({ message: 'Failed to sell Pokémon duplicates.' });
  }
});

// POST /:discordId/pokemon/steal - Superadmin: Steal a random common Pokémon from a user
router.post('/:discordId/pokemon/steal', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { pokemonId, isShiny, count, stolenBy } = req.body;

    // Validate required fields
    if (!pokemonId || typeof isShiny !== 'boolean' || !count || !stolenBy) {
      return res.status(400).json({ 
        message: 'Missing required fields: pokemonId, isShiny, count, stolenBy.' 
      });
    }

    // Check if the thief is a superadmin
    const thief = await User.findOne({ discordId: stolenBy, guildId });
    if (!thief || thief.role !== 'superadmin') {
      return res.status(403).json({ 
        message: 'Only superadmins can steal Pokémon.' 
      });
    }

    // Check cooldown (1 hour)
    const now = new Date();
    const cooldownHours = 1;
    if (thief.pokestealCooldown && now - new Date(thief.pokestealCooldown) < cooldownHours * 60 * 60 * 1000) {
      const msLeft = cooldownHours * 60 * 60 * 1000 - (now - new Date(thief.pokestealCooldown));
      const hours = Math.floor(msLeft / 3600000);
      const mins = Math.floor((msLeft % 3600000) / 60000);
      return res.status(429).json({ 
        message: `You must wait ${hours}h ${mins}m before using pokesteal again.`,
        cooldown: thief.pokestealCooldown
      });
    }

    // Find the target user
    const target = await User.findOne({ discordId, guildId });
    if (!target) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    // Find the Pokémon to steal
    const pokemon = await Pokemon.findOne({ 
      discordId, 
      guildId, 
      pokemonId, 
      isShiny 
    });

    if (!pokemon) {
      return res.status(404).json({ message: 'Pokémon not found in target user\'s collection.' });
    }

    // Check if the Pokémon is common (using customSpawnRates)
    const customSpawnRates = require('../utils/customSpawnRates.json');
    const pokemonConfig = customSpawnRates[pokemon.name.toLowerCase()];
    
    // Only allow stealing Pokémon that are explicitly defined as "common" in the config
    if (!pokemonConfig || pokemonConfig.rarity !== 'common') {
      return res.status(400).json({ 
        message: 'Only common Pokémon can be stolen.' 
      });
    }

    // Check if user has enough to steal
    if (pokemon.count < count) {
      return res.status(400).json({ 
        message: `Target user only has ${pokemon.count} of this Pokémon, but you tried to steal ${count}.` 
      });
    }

    // Update Pokémon count (remove from target)
    pokemon.count -= count;
    if (pokemon.count <= 0) {
      await pokemon.deleteOne();
    } else {
      await pokemon.save();
    }

    // Update cooldown for the thief
    thief.pokestealCooldown = now;
    await thief.save();

    // Log the theft for audit purposes
    console.log(`[Pokemon Steal] Superadmin ${stolenBy} stole ${count}x ${pokemon.name}${isShiny ? ' (shiny)' : ''} from user ${discordId} in guild ${guildId}`);

    // Return success response
    res.json({
      success: true,
      message: `Successfully stole ${count}x ${pokemon.isShiny ? '✨ SHINY ' : ''}${pokemon.name} from the target user.`,
      stolenPokemon: {
        name: pokemon.name,
        pokemonId: pokemon.pokemonId,
        isShiny: pokemon.isShiny,
        count: count,
        rarity: pokemonConfig.rarity
      },
      targetUser: discordId,
      stolenBy: stolenBy,
      remainingCount: pokemon.count > 0 ? pokemon.count : 0
    });

  } catch (error) {
    console.error('[Pokemon Steal] Error:', error);
    res.status(500).json({ message: 'Failed to steal Pokémon.' });
  }
});

// --- TIMEOUT ENDPOINT ---
router.post('/:userId/timeout', requireGuildId, async (req, res) => {
  try {
    const { userId } = req.params;
    const { targetDiscordId, duration, reason } = req.body;
    const guildId = req.headers['x-guild-id'];

    // Validate duration
    if (!isValidTimeoutDuration(duration)) {
      return res.status(400).json({ message: 'Invalid duration. Must be between 1 and 5 minutes.' });
    }

    // Get attacker's user and wallet
    let attacker = await User.findOne({ discordId: userId, guildId });
    if (!attacker) {
      // Create user if it doesn't exist
      attacker = new User({
        discordId: userId,
        guildId,
        username: userId, // Use Discord ID as username initially
        role: 'user',
        timeoutStats: { totalTimeouts: 0, totalCost: 0 }
      });
      await attacker.save();
    }

    // Get attacker's wallet
    let attackerWallet = await Wallet.findOne({ user: attacker._id, guildId });
    if (!attackerWallet) {
      // Create wallet if it doesn't exist
      attackerWallet = new Wallet({
        user: attacker._id, // Set the user reference
        discordId: userId,
        guildId,
        balance: 100000 // Initial balance
      });
      await attackerWallet.save();
    }

    // Check cooldown
    if (isOnTimeoutCooldown(attacker.lastTimeoutAt)) {
      const { minutes, seconds } = getRemainingCooldown(attacker.lastTimeoutAt);
      return res.status(429).json({ 
        message: `You must wait ${minutes}m ${seconds}s before using timeout again.`,
        cooldown: attacker.lastTimeoutAt
      });
    }

    // Calculate cost
    const cost = calculateTimeoutCost(duration, attackerWallet.balance);
    if (attackerWallet.balance < cost) {
      return res.status(400).json({ 
        message: `Insufficient balance. You need ${cost.toLocaleString('en-US')} points (${BASE_COST_PER_MINUTE} * ${duration} + ${BALANCE_PERCENTAGE * 100}% of balance).`
      });
    }

    // Get or create target user
    let target = await User.findOne({ discordId: targetDiscordId, guildId });
    if (!target) {
      // Create target user if they don't exist
      target = new User({
        discordId: targetDiscordId,
        guildId,
        username: targetDiscordId, // Use Discord ID as username initially
        role: 'user',
        timeoutStats: { totalTimeouts: 0, totalCost: 0 },
        currentTimeoutDuration: 0 // Add this field to track current timeout duration
      });
      await target.save();

      // Create wallet for target user
      const targetWallet = new Wallet({
        user: target._id,
        discordId: targetDiscordId,
        guildId,
        balance: 100000 // Initial balance
      });
      await targetWallet.save();
    }

    // Prevent self-timeout
    if (userId === targetDiscordId) {
      return res.status(400).json({ message: 'You cannot timeout yourself.' });
    }

    // Calculate total timeout duration (stack with existing timeout)
    const now = new Date();
    const timeoutEndsAt = new Date(target.timeoutEndsAt || 0);
    let totalDuration;
    let additionalDuration;

    if (timeoutEndsAt <= now) {
      // Timeout expired — reset
      totalDuration = duration;
      additionalDuration = duration;
    } else {
      // Timeout active — add to existing remaining
      const remaining = Math.ceil((timeoutEndsAt - now) / (60 * 1000)); // in minutes
      totalDuration = remaining + duration;
      additionalDuration = duration; // Only add the new duration to Discord
    }

    // Update the new timeout end timestamp and duration
    target.currentTimeoutDuration = totalDuration;
    target.timeoutEndsAt = new Date(now.getTime() + totalDuration * 60 * 1000);
    await target.save();

    // Update attacker's wallet and stats
    attackerWallet.balance -= cost;
    await attackerWallet.save();

    // Update attacker's timeout history and stats
    attacker.timeoutHistory.push({
      targetDiscordId,
      duration,
      cost,
      reason,
      timestamp: new Date()
    });
    attacker.timeoutStats.totalTimeouts += 1;
    attacker.timeoutStats.totalCost += cost;
    attacker.lastTimeoutAt = new Date(); // Set the last timeout timestamp
    await attacker.save();

    // Create transaction record
    await Transaction.create({
      user: attacker._id,
      guildId,
      type: 'bail',
      amount: -cost,
      description: `Timeout user ${targetDiscordId} for ${duration} minutes${reason ? `: ${reason}` : ''}`,
      metadata: {
        targetDiscordId,
        duration,
        reason
      }
    });

    // Return success response
    res.json({
      message: `Successfully timed out user ${targetDiscordId} for ${duration} minutes. Total timeout duration: ${totalDuration} minutes.`,
      cost,
      remainingBalance: attackerWallet.balance,
      cooldownTime: attacker.lastTimeoutAt,
      totalDuration,
      additionalDuration // Add this field for Discord to use
    });

  } catch (error) {
    console.error('Error in timeout endpoint:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// --- ADMIN GIVE POKEMON ENDPOINT ---
const ALLOWED_DISCORD_ID = '294497956348821505'; // <-- Replace with the allowed Discord ID
router.post('/admin/give-pokemon', async (req, res) => {
  // Custom admin secret check
  const adminSecret = req.header('x-admin-secret');
  if (!adminSecret || adminSecret !== process.env.ADMIN_GIVE_POKEMON_SECRET) {
    return res.status(403).json({ message: 'Invalid or missing admin secret.' });
  }
  try {
    const { userId, targetDiscordId, guildId, pokemonId, isShiny, count } = req.body;
    if (userId !== ALLOWED_DISCORD_ID) {
      return res.status(403).json({ message: 'You are not authorized to use this command.' });
    }
    if (!targetDiscordId || !guildId || !pokemonId) {
      return res.status(400).json({ message: 'Missing required fields: targetDiscordId, guildId, pokemonId.' });
    }
    const giveCount = parseInt(count) || 1;
    // Find or create user
    let user = await User.findOne({ discordId: targetDiscordId, guildId });
    if (!user) {
      user = new User({ discordId: targetDiscordId, guildId, username: targetDiscordId });
      await user.save();
    }
    // Fetch Pokémon data for name and ability
    let name = '';
    let ability = '';
    try {
      const pokeData = await pokeApi.getPokemonDataById(pokemonId);
      name = pokeData.name;
      const abilitiesArr = pokeData.abilities || [];
      const nonHidden = abilitiesArr.filter(a => !a.is_hidden);
      const pool = nonHidden.length > 0 ? nonHidden : abilitiesArr;
      if (pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        ability = pool[idx].ability.name;
      }
    } catch (e) {
      name = `pokemon_${pokemonId}`;
      ability = '';
    }
    // Check if this Pokémon (with shiny status) already exists
    let pokemon = await Pokemon.findOne({ discordId: targetDiscordId, guildId, pokemonId, isShiny: !!isShiny });
    if (pokemon) {
      pokemon.count = (pokemon.count || 1) + giveCount;
      pokemon.caughtAt = new Date();
      await pokemon.save();
    } else {
      pokemon = new Pokemon({
        user: user._id,
        discordId: targetDiscordId,
        guildId,
        pokemonId,
        name,
        isShiny: !!isShiny,
        caughtAt: new Date(),
        count: giveCount,
        ivs: {
          hp: Math.floor(Math.random() * 32),
          attack: Math.floor(Math.random() * 32),
          defense: Math.floor(Math.random() * 32),
          spAttack: Math.floor(Math.random() * 32),
          spDefense: Math.floor(Math.random() * 32),
          speed: Math.floor(Math.random() * 32),
        },
        evs: {
          hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0,
        },
        nature: randomNature(),
        ability,
        status: null,
        boosts: {
          attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0,
        },
      });
      await pokemon.save();
    }
    res.json({ message: `Successfully gave ${giveCount}x ${isShiny ? 'shiny ' : ''}${name} (ID: ${pokemonId}) to user ${targetDiscordId}.`, pokemon });
  } catch (error) {
    console.error('[Admin Give Pokemon] Error:', error);
    res.status(500).json({ message: 'Failed to give Pokémon.' });
  }
});

// POST /:discordId/quests/reset-daily
router.post('/:discordId/quests/reset-daily', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const user = await User.findOne({ discordId, guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.resetDailyQuests();
    await user.save();
    res.json({ message: 'Daily quests reset.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset daily quests.' });
  }
});

// POST /:discordId/pokemon/transfer - Transfer a Pokémon to another user (for giveaways)
router.post('/:discordId/pokemon/transfer', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const { pokemonDbId, recipientDiscordId, allowLastPokemon = false } = req.body;

    if (!pokemonDbId || !recipientDiscordId) {
      return res.status(400).json({ message: 'Missing required fields: pokemonDbId, recipientDiscordId.' });
    }

    // Find the sender's Pokémon
    const senderPokemon = await Pokemon.findOne({ 
      _id: pokemonDbId, 
      discordId, 
      guildId 
    });

    if (!senderPokemon) {
      return res.status(404).json({ message: 'Pokémon not found in your collection.' });
    }

    // Only check for last Pokémon if allowLastPokemon is false
    if (!allowLastPokemon && senderPokemon.count <= 1) {
      return res.status(400).json({ message: 'You cannot transfer your last Pokémon of this type.' });
    }

    // Find or create recipient user
    let recipientUser = await User.findOne({ discordId: recipientDiscordId, guildId });
    if (!recipientUser) {
      recipientUser = new User({ discordId: recipientDiscordId, guildId, username: recipientDiscordId });
      await recipientUser.save();
    }

    // Remove 1 from sender
    senderPokemon.count -= 1;
    if (senderPokemon.count <= 0) {
      await senderPokemon.deleteOne();
    } else {
      await senderPokemon.save();
    }

    // Add 1 to recipient (stack if possible)
    let recipientPokemon = await Pokemon.findOne({
      discordId: recipientDiscordId,
      guildId,
      pokemonId: senderPokemon.pokemonId,
      isShiny: senderPokemon.isShiny
    });

    if (recipientPokemon) {
      recipientPokemon.count += 1;
      await recipientPokemon.save();
    } else {
      // Create new Pokémon entry for recipient
      const newPokemon = new Pokemon({
        user: recipientUser._id,
        discordId: recipientDiscordId,
        guildId,
        pokemonId: senderPokemon.pokemonId,
        name: senderPokemon.name,
        isShiny: senderPokemon.isShiny,
        count: 1,
        caughtAt: new Date(),
        ivs: senderPokemon.ivs,
        evs: senderPokemon.evs,
        nature: senderPokemon.nature,
        ability: senderPokemon.ability,
        status: senderPokemon.status,
        boosts: senderPokemon.boosts
      });
      await newPokemon.save();
    }

    // Record transaction for sender
    const senderTransaction = new Transaction({
      user: await User.findOne({ discordId, guildId }),
      guildId,
      type: 'trade_sent',
      amount: 0,
      description: `Transferred ${senderPokemon.name}${senderPokemon.isShiny ? ' ✨' : ''} to ${recipientDiscordId} via giveaway`,
    });
    await senderTransaction.save();

    // Record transaction for recipient
    const recipientTransaction = new Transaction({
      user: recipientUser._id,
      guildId,
      type: 'trade_received',
      amount: 0,
      description: `Received ${senderPokemon.name}${senderPokemon.isShiny ? ' ✨' : ''} from ${discordId} via giveaway`,
    });
    await recipientTransaction.save();

    res.json({ 
      message: `Successfully transferred ${senderPokemon.name}${senderPokemon.isShiny ? ' ✨' : ''} to ${recipientDiscordId}.`,
      pokemon: {
        name: senderPokemon.name,
        isShiny: senderPokemon.isShiny,
        pokemonId: senderPokemon.pokemonId
      }
    });

  } catch (error) {
    console.error('[Pokemon Transfer] Error:', error);
    res.status(500).json({ message: 'Failed to transfer Pokémon.' });
  }
});

// POST /:discordId/quests/reset-weekly
router.post('/:discordId/quests/reset-weekly', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const user = await User.findOne({ discordId, guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.resetWeeklyQuests();
    await user.save();
    res.json({ message: 'Weekly quests reset.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset weekly quests.' });
  }
});

// --- ENHANCED STEAL ENDPOINT ---
router.post('/:userId/steal', requireGuildId, async (req, res) => {
  try {
    const { userId } = req.params;
    const { targetDiscordId, stealType = 'points', rarity } = req.body;
    
    // Validate required parameters
    if (!targetDiscordId) {
      return res.status(400).json({ message: 'targetDiscordId is required.' });
    }
    const guildId = req.headers['x-guild-id'];

    // Validate steal type
    if (!stealType || !['points', 'fish', 'animal', 'item'].includes(stealType)) {
      return res.status(400).json({ message: 'Invalid steal type. Must be points, fish, animal, or item.' });
    }

    // Get attacker's user and wallet
    let attacker = await User.findOne({ discordId: userId, guildId });
    if (!attacker) {
      // Create user if it doesn't exist
      attacker = new User({
        discordId: userId,
        guildId,
        username: userId,
        role: 'user',
        stealStats: { 
          success: 0, fail: 0, jail: 0, totalStolen: 0,
          pointsSuccess: 0, pointsFail: 0,
          fishSuccess: 0, fishFail: 0,
          animalSuccess: 0, animalFail: 0,
          itemSuccess: 0, itemFail: 0
        }
      });
      await attacker.save();
    }

    // Get attacker's wallet
    let attackerWallet = await Wallet.findOne({ user: attacker._id, guildId });
    if (!attackerWallet) {
      // Create wallet if it doesn't exist
      attackerWallet = new Wallet({
        user: attacker._id,
        discordId: userId,
        guildId,
        balance: 100000
      });
      await attackerWallet.save();
    }

    // Clean expired punishments
    cleanActivePunishments(attacker);

    // Check if attacker is jailed
    if (attacker.jailedUntil && attacker.jailedUntil > new Date()) {
      const remainingJailTime = Math.ceil((attacker.jailedUntil - new Date()) / (60 * 1000));
      return res.status(400).json({ 
        message: `You are currently jailed for ${remainingJailTime} more minutes.`
      });
    }

    // Check type-specific cooldown
    const now = new Date();
    const cooldownField = getStealCooldownField(stealType);
    const cooldownHours = getStealCooldownHours(stealType);
    const cooldownTime = cooldownHours * 60 * 60 * 1000; // Convert hours to milliseconds
    
    if (cooldownField && attacker[cooldownField] && (now - attacker[cooldownField]) < cooldownTime) {
      const remainingTime = cooldownTime - (now - attacker[cooldownField]);
      const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000));
      const remainingMinutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
      return res.status(429).json({ 
        message: `You must wait ${remainingHours}h ${remainingMinutes}m before stealing ${stealType} again.`
      });
    }

    // Prevent self-steal
    if (userId === targetDiscordId) {
      return res.status(400).json({ message: 'You cannot steal from yourself.' });
    }

    // Get target user and wallet
    let target = await User.findOne({ discordId: targetDiscordId, guildId });
    if (!target) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    let targetWallet = await Wallet.findOne({ user: target._id, guildId });
    if (!targetWallet) {
      // Create wallet for target user
      targetWallet = new Wallet({
        user: target._id,
        discordId: targetDiscordId,
        guildId,
        balance: 100000
      });
      await targetWallet.save();
    }

    // Validate target has items to steal based on type
    if (stealType === 'points') {
      if (targetWallet.balance < 1000) {
        return res.status(400).json({ message: 'Target user has insufficient balance to steal from.' });
      }
    } else {
      // Check if target has items of the specified type and rarity
      const targetItems = target.inventory || [];
      let availableItems = targetItems.filter(item => item.type === stealType);
      
      if (rarity) {
        availableItems = availableItems.filter(item => item.rarity === rarity);
      }
      
      if (availableItems.length === 0) {
        const rarityText = rarity ? ` ${rarity}` : '';
        return res.status(400).json({ 
          message: `Target user has no${rarityText} ${stealType} to steal.` 
        });
      }
    }

    // Check for lucky streak buff
    const luckyStreakBuff = (attacker.buffs || []).find(b => b.type === 'lucky_streak' && b.usesLeft > 0);
    
    // Determine success/failure based on steal type
    let successThreshold = getStealSuccessRate(stealType);
    if (luckyStreakBuff) {
      successThreshold = Math.min(successThreshold + 0.2, 0.8); // Increase by 20% but cap at 80%
    }
    const isSuccess = Math.random() < successThreshold;
    
    if (isSuccess) {
      // Success: steal items or points
      let stolenItems = [];
      let stolenAmount = 0;
      let totalValue = 0;

      if (stealType === 'points') {
        // Steal points (5-20% of target's balance)
        const stealPercentage = (Math.random() * 0.15) + 0.05; // 5% to 20%
        stolenAmount = Math.floor(targetWallet.balance * stealPercentage);
        
        // Transfer points
        targetWallet.balance -= stolenAmount;
        attackerWallet.balance += stolenAmount;
        totalValue = stolenAmount;
      } else {
        // Steal items
        const targetItems = target.inventory || [];
        let availableItems = targetItems.filter(item => item.type === stealType);
        
        if (rarity) {
          availableItems = availableItems.filter(item => item.rarity === rarity);
        }
        
        // Select 1-3 random items to steal
        const numItemsToSteal = Math.min(Math.floor(Math.random() * 3) + 1, availableItems.length);
        const shuffled = [...availableItems].sort(() => Math.random() - 0.5);
        const itemsToSteal = shuffled.slice(0, numItemsToSteal);
        
        for (const itemToSteal of itemsToSteal) {
          // Steal 1-50% of the item count (minimum 1)
          const stealCount = Math.max(1, Math.floor(itemToSteal.count * (Math.random() * 0.5 + 0.1)));
          const actualStealCount = Math.min(stealCount, itemToSteal.count);
          
          // Remove from target
          const targetItemIndex = target.inventory.findIndex(item => 
            item.type === itemToSteal.type && item.name === itemToSteal.name
          );
          
          if (targetItemIndex !== -1) {
            target.inventory[targetItemIndex].count -= actualStealCount;
            if (target.inventory[targetItemIndex].count <= 0) {
              target.inventory.splice(targetItemIndex, 1);
            }
            
            // Add to attacker
            const attackerItemIndex = attacker.inventory.findIndex(item => 
              item.type === itemToSteal.type && item.name === itemToSteal.name
            );
            
            if (attackerItemIndex !== -1) {
              attacker.inventory[attackerItemIndex].count += actualStealCount;
            } else {
              attacker.inventory.push({
                type: itemToSteal.type,
                name: itemToSteal.name,
                rarity: itemToSteal.rarity,
                value: itemToSteal.value,
                count: actualStealCount
              });
            }
            
            const itemValue = itemToSteal.value * actualStealCount;
            totalValue += itemValue;
            
            stolenItems.push({
              type: itemToSteal.type,
              name: itemToSteal.name,
              rarity: itemToSteal.rarity,
              count: actualStealCount,
              value: itemValue
            });
          }
        }
      }
      
      await targetWallet.save();
      await attackerWallet.save();
      
      // Consume lucky streak buff if used
      if (luckyStreakBuff) {
        luckyStreakBuff.usesLeft--;
        if (luckyStreakBuff.usesLeft <= 0) {
          attacker.buffs = attacker.buffs.filter(b => b !== luckyStreakBuff);
        }
      }
      
      // Update attacker stats
      attacker.stealStats.success += 1;
      attacker.stealStats.totalStolen += totalValue;
      attacker[`${stealType}Success`] = (attacker.stealStats[`${stealType}Success`] || 0) + 1;
      
      // Ensure cooldownField is defined before using it
      if (cooldownField) {
        attacker[cooldownField] = now;
      } else {
        console.error('cooldownField is undefined for stealType:', stealType);
        // Fallback to points cooldown
        attacker.stealPointsCooldown = now;
      }
      
      await attacker.save();
      await target.save();
      
      // Calculate new collection value for attacker
      const newCollectionValue = (attacker.inventory || []).reduce((sum, item) => sum + (item.value * item.count), 0);
      
      // Create transaction records
      await Transaction.create({
        user: attacker._id,
        guildId,
        type: 'steal',
        amount: totalValue,
        description: `Successfully stole ${stealType} from ${targetDiscordId}`,
        metadata: {
          targetDiscordId,
          stealType,
          stolenItems,
          totalValue,
          success: true
        }
      });
      
      await Transaction.create({
        user: target._id,
        guildId,
        type: 'stolen',
        amount: -totalValue,
        description: `Had ${stealType} stolen by ${userId}`,
        metadata: {
          attackerDiscordId: userId,
          stealType,
          stolenItems,
          totalValue,
          success: true
        }
      });
      
      let message = `Successfully stole ${stealType} from ${targetDiscordId}!`;
      if (luckyStreakBuff) {
        message += ` 🍀 Lucky Streak buff used! (${luckyStreakBuff.usesLeft + 1} uses remaining)`;
      }
      
      res.json({
        message: message,
        success: true,
        stolenItems,
        stolenAmount,
        totalValue,
        newBalance: attackerWallet.balance,
        newCollectionValue,
        cooldownTime: cooldownField ? attacker[cooldownField] : attacker.stealPointsCooldown,
        stealType
      });
    } else {
      // Failure: apply punishment
      const failureCount = attacker.stealFailureCount || 0;
      const attemptedValue = stealType === 'points' ? 
        Math.floor(targetWallet.balance * ((Math.random() * 0.15) + 0.05)) :
        (target.inventory || []).filter(item => item.type === stealType).reduce((sum, item) => sum + item.value, 0);
      
      const punishment = selectPunishment(stealType, failureCount, attemptedValue);
      
      // Check for jail immunity buff
      const jailImmunityBuff = (attacker.buffs || []).find(b => 
        b.type === 'jail_immunity' && (!b.expiresAt || b.expiresAt > now) && (b.usesLeft === undefined || b.usesLeft > 0)
      );
      
      if (jailImmunityBuff && punishment.type === 'jail') {
        // Use the buff, do not jail
        if (jailImmunityBuff.usesLeft !== undefined) {
          jailImmunityBuff.usesLeft--;
        }
        // Remove expired/used up buffs
        attacker.buffs = (attacker.buffs || []).filter(b => {
          if (b.type !== 'jail_immunity') return true;
          if (b.expiresAt && b.expiresAt < now) return false;
          if (b.usesLeft !== undefined && b.usesLeft <= 0) return false;
          return true;
        });
        
        attacker.stealStats.fail += 1;
        attacker[`${stealType}Fail`] = (attacker.stealStats[`${stealType}Fail`] || 0) + 1;
        
        // Ensure cooldownField is defined before using it
        if (cooldownField) {
          attacker[cooldownField] = now;
        } else {
          console.error('cooldownField is undefined for stealType:', stealType);
          // Fallback to points cooldown
          attacker.stealPointsCooldown = now;
        }
        
        await attacker.save();
        
        // Create transaction record (no jail)
        await Transaction.create({
          user: attacker._id,
          guildId,
          type: 'steal',
          amount: 0,
          description: `Failed to steal ${stealType} from ${targetDiscordId} but jail immunity buff saved them from jail`,
          metadata: {
            targetDiscordId,
            stealType,
            attemptedValue,
            success: false,
            buffUsed: 'jail_immunity'
          }
        });
        
        return res.json({
          message: `Steal attempt failed! Your jail immunity buff saved you from jail!`,
          success: false,
          punishment: { type: 'jail', severity: 'none' },
          cooldownTime: cooldownField ? attacker[cooldownField] : attacker.stealPointsCooldown,
          buffUsed: 'jail_immunity',
          buffMessage: 'Your jail immunity buff saved you from jail!',
          stealType
        });
      }
      
      // Apply punishment
      applyPunishment(attacker, punishment, stealType, targetDiscordId, attackerWallet);
      
      // Calculate bail amount if jailed
      let bailInfo = null;
      if (punishment.type === 'jail') {
        const stealPercentage = (Math.random() * 0.15) + 0.05; // Same as in success case
        bailInfo = calculateBailAmount(
          targetWallet.balance, 
          stealPercentage, 
          stealType, 
          failureCount, 
          attackerWallet.balance
        );
        
        // Store bail information in user record
        attacker.bailInfo = {
          amount: bailInfo.bailAmount,
          additionalJailTime: bailInfo.additionalJailTime,
          stealType: stealType,
          targetDiscordId: targetDiscordId,
          calculatedAt: new Date()
        };
      }
      
      // Update stats
      attacker.stealStats.fail += 1;
      attacker[`${stealType}Fail`] = (attacker.stealStats[`${stealType}Fail`] || 0) + 1;
      if (punishment.type === 'jail') {
        attacker.stealStats.jail += 1;
      }
      
      // Ensure cooldownField is defined before using it
      if (cooldownField) {
        attacker[cooldownField] = now;
      } else {
        console.error('cooldownField is undefined for stealType:', stealType);
        // Fallback to points cooldown
        attacker.stealPointsCooldown = now;
      }
      
      await attacker.save();
      await attackerWallet.save();
      
      // Create transaction record
      await Transaction.create({
        user: attacker._id,
        guildId,
        type: 'steal',
        amount: 0,
        description: `Failed to steal ${stealType} from ${targetDiscordId} and got punished`,
        metadata: {
          targetDiscordId,
          stealType,
          attemptedValue,
          punishment,
          success: false
        }
      });
      
      // Calculate jail time if jailed
      let jailInfo = null;
      if (punishment.type === 'jail' && attacker.jailedUntil) {
        const now = new Date();
        const jailMinutes = Math.ceil((attacker.jailedUntil - now) / 60000);
        jailInfo = {
          minutes: jailMinutes,
          until: attacker.jailedUntil
        };
      }

      // Get punishment description
      const punishmentDescription = getPunishmentDescription(punishment, stealType);

      res.json({
        message: `Steal attempt failed! You got caught and are punished.`,
        success: false,
        punishment: {
          ...punishment,
          description: punishmentDescription
        },
        bailInfo,
        jailInfo,
        cooldownTime: cooldownField ? attacker[cooldownField] : attacker.stealPointsCooldown,
        stealType
      });
    }
    
  } catch (error) {
    console.error('Error in steal endpoint:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// --- COLLECTION LIST (all possible fish and animal names) ---
router.get('/collection-list', async (req, res) => {
  try {
    // Fish and animal tables must be defined at module scope for reuse
    // (Move them to top if needed, but for now, redefine here for clarity)
    const fishTable = [
      { name: 'Carp', rarity: 'common' },
      { name: 'Perch', rarity: 'common' },
      { name: 'Bluegill', rarity: 'common' },
      { name: 'Tilapia', rarity: 'common' },
      { name: 'Sardine', rarity: 'common' },
      { name: 'Anchovy', rarity: 'common' },
      { name: 'Goby', rarity: 'common' },
      { name: 'Smelt', rarity: 'common' },
      { name: 'Mudfish', rarity: 'common' },
      { name: 'Minnow', rarity: 'common' },
      { name: 'Sunfish', rarity: 'common' },
      { name: 'Dace', rarity: 'common' },
      { name: 'Rudd', rarity: 'common' },
      { name: 'Herring', rarity: 'common' },
      { name: 'Roach', rarity: 'common' },
      { name: 'Whitefish', rarity: 'common' },
      { name: 'Crucian Carp', rarity: 'common' },
      { name: 'Bleak', rarity: 'common' },
      { name: 'Shiner', rarity: 'common' },
      { name: 'Loach', rarity: 'common' },
      { name: 'Grunt Fish', rarity: 'common' },
      { name: 'Silver Biddy', rarity: 'common' },
      { name: 'Sculpin', rarity: 'common' },
      { name: 'Bass', rarity: 'uncommon' },
      { name: 'Catfish', rarity: 'uncommon' },
      { name: 'Pike', rarity: 'uncommon' },
      { name: 'Trout', rarity: 'uncommon' },
      { name: 'Snapper', rarity: 'uncommon' },
      { name: 'Mullet', rarity: 'uncommon' },
      { name: 'Rockfish', rarity: 'uncommon' },
      { name: 'Grouper', rarity: 'uncommon' },
      { name: 'Drumfish', rarity: 'uncommon' },
      { name: 'Zander', rarity: 'uncommon' },
      { name: 'Bream', rarity: 'uncommon' },
      { name: 'Chub', rarity: 'uncommon' },
      { name: 'Bullhead Catfish', rarity: 'uncommon' },
      { name: 'Blue Catfish', rarity: 'uncommon' },
      { name: 'Burbot', rarity: 'uncommon' },
      { name: 'Sheepshead', rarity: 'uncommon' },
      { name: 'White Bass', rarity: 'uncommon' },
      { name: 'Golden Perch', rarity: 'uncommon' },
      { name: 'Spotted Seatrout', rarity: 'uncommon' },
      { name: 'Striped Bass', rarity: 'uncommon' },
      { name: 'Weakfish', rarity: 'uncommon' },
      { name: 'Silver Carp', rarity: 'uncommon' },
      { name: 'Lake Whitefish', rarity: 'uncommon' },
      { name: 'Longnose Gar', rarity: 'uncommon' },
      { name: 'Black Crappie', rarity: 'uncommon' },
      { name: 'Salmon', rarity: 'rare' },
      { name: 'Sturgeon', rarity: 'rare' },
      { name: 'Eel', rarity: 'rare' },
      { name: 'Swordfish', rarity: 'rare' },
      { name: 'Wahoo', rarity: 'rare' },
      { name: 'Barracuda', rarity: 'rare' },
      { name: 'Tarpon', rarity: 'rare' },
      { name: 'Halibut', rarity: 'rare' },
      { name: 'King Mackerel', rarity: 'rare' },
      { name: 'Rainbow Trout', rarity: 'rare' },
      { name: 'Anglerfish', rarity: 'rare' },
      { name: 'Sea Devil', rarity: 'rare' },
      { name: 'Flying Fish', rarity: 'rare' },
      { name: 'Tilefish ', rarity: 'rare' },
      { name: 'Queen Angelfish', rarity: 'rare' },
      { name: 'Red Drum', rarity: 'rare' },
      { name: 'Bluefin Tuna', rarity: 'rare' },
      { name: 'Atlantic Bonito', rarity: 'rare' },
      { name: 'Deep Sea Smelt', rarity: 'rare' },
      { name: 'Dusky Grouper', rarity: 'rare' },
      { name: 'Bigeye Trevally', rarity: 'rare' },
      { name: 'Ghost Catfish', rarity: 'rare' },
      { name: 'Ocean Sunfish', rarity: 'rare' },
      { name: 'Spotted Eagle Ray', rarity: 'rare' },
      { name: 'Threadfin Bream', rarity: 'rare' },
      { name: 'Mahi-Mahi', rarity: 'epic' },
      { name: 'Giant Squid', rarity: 'epic' },
      { name: 'Electric Ray', rarity: 'epic' },
      { name: 'Blue Marlin', rarity: 'epic' },
      { name: 'Opah', rarity: 'epic' },
      { name: 'Fire Eel', rarity: 'epic' },
      { name: 'Ghost Shark', rarity: 'epic' },
      { name: 'Aurora Flounder', rarity: 'epic' },
      { name: 'Colossal Squid', rarity: 'epic' },
      { name: 'Black Dragonfish', rarity: 'epic' },
      { name: 'Fangtooth', rarity: 'epic' },
      { name: 'Viperfish', rarity: 'epic' },
      { name: 'Glasshead Barreleye', rarity: 'epic' },
      { name: 'Mandarinfish', rarity: 'epic' },
      { name: 'Clown Triggerfish', rarity: 'epic' },
      { name: 'Blue Tang', rarity: 'epic' },
      { name: 'Rainbow Parrotfish', rarity: 'epic' },
      { name: 'Lionfish', rarity: 'epic' },
      { name: 'Swordtail Shark', rarity: 'epic' },
      { name: 'Silver Salmon', rarity: 'epic' },
      { name: 'Dragon Eel', rarity: 'epic' },
      { name: 'Thunderfin', rarity: 'epic' },
      { name: 'Starlight Ray', rarity: 'epic' },
      { name: 'Crystal Piranha', rarity: 'epic' },
      { name: 'Twilight Lanternfish', rarity: 'epic' },
      { name: 'Ghostfin Barracuda', rarity: 'epic' },
      { name: 'Frostjaw Pike', rarity: 'epic' },
      { name: 'Ironscale Tuna', rarity: 'epic' },
      { name: 'Blazetail Salmon', rarity: 'epic' },
      { name: 'Volcanic Grouper', rarity: 'epic' },
      { name: 'Golden Koi', rarity: 'legendary' },
      { name: 'Ancient Leviathan', rarity: 'legendary' },
      { name: 'Celestial Angelfish', rarity: 'legendary' },
      { name: 'Kraken', rarity: 'legendary' },
      { name: 'Leviathan Pike', rarity: 'legendary' },
      { name: 'Infernal Barramundi', rarity: 'legendary' },
      { name: 'Stormscale Tuna', rarity: 'legendary' },
      { name: 'Shadowfin Orca', rarity: 'legendary' },
      { name: 'Prism Jellyfish', rarity: 'legendary' },
      { name: 'Frostfin Leviathan', rarity: 'legendary' },
      { name: 'Titan Bass', rarity: 'legendary' },
      { name: 'Hellmaw Eel', rarity: 'legendary' },
      { name: 'Thundercrash Ray', rarity: 'legendary' },
      { name: 'Gilded Marlin', rarity: 'legendary' },
      { name: 'Stormray Manta', rarity: 'legendary' },
      { name: 'Abyssal Serpent', rarity: 'mythical' },
      { name: 'Timefish of Eternity', rarity: 'mythical' },
      { name: 'Void Whale', rarity: 'mythical' },
      { name: 'Chrono Trout', rarity: 'mythical' },
      { name: 'Dreamscale Eel', rarity: 'mythical' },
      { name: 'Aetherfin Serpent', rarity: 'mythical' },
      { name: 'Starspawn Octopus', rarity: 'mythical' },
      { name: 'Realityray', rarity: 'mythical' },
      { name: 'Nebulashark', rarity: 'mythical' },
      { name: 'Moonlit Tuna', rarity: 'mythical' },
      { name: 'Astral Barracuda', rarity: 'mythical' },
      { name: 'Cosmic Lanternfish', rarity: 'mythical' },
      { name: 'Chronoshark', rarity: 'mythical' },
      { name: 'Aurora Abyssfish', rarity: 'mythical' },
      { name: 'Wyrmfin', rarity: 'mythical' },
      { name: 'Reality Pike', rarity: 'mythical' },
      { name: 'Sunborn Leviathan', rarity: 'mythical' },
      { name: 'Goldfish', rarity: 'transcendent' },
      { name: 'Infinity Carp', rarity: 'transcendent' },
      { name: 'Omnifin', rarity: 'transcendent' },
      { name: 'Godscale Dragonfish', rarity: 'transcendent' },
      { name: 'Quantum Koi', rarity: 'transcendent' },
      { name: 'Time-Tide Leviathan', rarity: 'transcendent' },
      { name: 'Etherfin Leviathan', rarity: 'transcendent' },
      { name: 'Galactic Jellyray', rarity: 'transcendent' },
      { name: 'The Kraken', rarity: 'transcendent' },
      { name: 'Eternafish', rarity: 'transcendent' },
      { name: 'Omnisquid', rarity: 'transcendent' },
      { name: 'Celestine Ray', rarity: 'transcendent' },
      { name: 'Godfin Eternatus', rarity: 'transcendent' },
      { name: "Kanalo's Wrath", rarity: 'og' },
      { name: 'Hasib the Abyssseer', rarity: 'og' },
      { name: 'Jeemongul', rarity: 'og' },
      { name: 'Oven', rarity: 'og' },
    ];
    const animalTable = [
      { name: 'Rabbit', rarity: 'common' },
      { name: 'Squirrel', rarity: 'common' },
      { name: 'Pigeon', rarity: 'common' },
      { name: 'Hedgehog', rarity: 'common' },
      { name: 'Chipmunk', rarity: 'common' },
      { name: 'Mole', rarity: 'common' },
      { name: 'Toad', rarity: 'common' },
      { name: 'Crow', rarity: 'common' },
      { name: 'Duck', rarity: 'common' },
      { name: 'Quokka', rarity: 'common' },
      { name: 'Field Mouse', rarity: 'common' },
      { name: 'Frog ', rarity: 'common' },
      { name: 'Lizard', rarity: 'common' },
      { name: 'Beaver', rarity: 'common' },
      { name: 'Mallard', rarity: 'common' },
      { name: 'Turtle', rarity: 'common' },
      { name: 'Snail', rarity: 'common' },
      { name: 'Rat', rarity: 'common' },
      { name: 'Magpie', rarity: 'common' },
      { name: 'Bat', rarity: 'common' },
      { name: 'Finch', rarity: 'common' },
      { name: 'Newt', rarity: 'common' },
      { name: 'Shrew', rarity: 'common' },
      { name: 'Fox', rarity: 'uncommon' },
      { name: 'Raccoon', rarity: 'uncommon' },
      { name: 'Owl', rarity: 'uncommon' },
      { name: 'Skunk', rarity: 'uncommon' },
      { name: 'Coyote', rarity: 'uncommon' },
      { name: 'Badger', rarity: 'uncommon' },
      { name: 'Porcupine', rarity: 'uncommon' },
      { name: 'Weasel', rarity: 'uncommon' },
      { name: 'Hyena', rarity: 'uncommon' },
      { name: 'Falcon', rarity: 'uncommon' },
      { name: 'Woodpecker', rarity: 'uncommon' },
      { name: 'Gopher', rarity: 'uncommon' },
      { name: 'Opossum', rarity: 'uncommon' },
      { name: 'Ferret', rarity: 'uncommon' },
      { name: 'Tasmanian Devil', rarity: 'uncommon' },
      { name: 'Armadillo', rarity: 'uncommon' },
      { name: 'Monitor Lizard', rarity: 'uncommon' },
      { name: 'Snapping Turtle', rarity: 'uncommon' },
      { name: 'Jackrabbit', rarity: 'uncommon' },
      { name: 'Kookaburra', rarity: 'uncommon' },
      { name: 'Pangolin', rarity: 'uncommon' },
      { name: 'Tamarin', rarity: 'uncommon' },
      { name: 'Kinkajou', rarity: 'uncommon' },
      { name: 'Deer', rarity: 'rare' },
      { name: 'Boar', rarity: 'rare' },
      { name: 'Hawk', rarity: 'rare' },
      { name: 'Lynx', rarity: 'rare' },
      { name: 'Puma', rarity: 'rare' },
      { name: 'Jackal', rarity: 'rare' },
      { name: 'Red Deer', rarity: 'rare' },
      { name: 'Horned Owl', rarity: 'rare' },
      { name: 'Panther', rarity: 'rare' },
      { name: 'Raven', rarity: 'rare' },
      { name: 'Parrot', rarity: 'rare' },
      { name: 'Ibex', rarity: 'rare' },
      { name: 'Wild Goat', rarity: 'rare' },
      { name: 'Gazelle', rarity: 'rare' },
      { name: 'Meerkat', rarity: 'rare' },
      { name: 'Caracal', rarity: 'rare' },
      { name: 'Moose', rarity: 'rare' },
      { name: 'Elk', rarity: 'rare' },
      { name: 'Serval', rarity: 'rare' },
      { name: 'Bush Dog', rarity: 'rare' },
      { name: 'Secretary Bird', rarity: 'rare' },
      { name: 'Maned Wolf', rarity: 'rare' },
      { name: 'Golden Jackal', rarity: 'rare' },
      { name: 'Musk Ox', rarity: 'rare' },
      { name: 'Clouded Leopard', rarity: 'rare' },
      { name: 'Bearded Vulture', rarity: 'rare' },
      { name: 'Harpy Eagle', rarity: 'rare' },
      { name: 'Mountain Lion', rarity: 'rare' },
      { name: 'Bear', rarity: 'epic' },
      { name: 'Dire Wolf', rarity: 'epic' },
      { name: 'Thunder Elk', rarity: 'epic' },
      { name: 'Ice Bear', rarity: 'epic' },
      { name: 'Shadow Wolf', rarity: 'epic' },
      { name: 'Ember Lion', rarity: 'epic' },
      { name: 'Iron Boar', rarity: 'epic' },
      { name: 'Tempest Owl', rarity: 'epic' },
      { name: 'Peacock', rarity: 'epic' },
      { name: 'Striped Hyena', rarity: 'epic' },
      { name: 'Howler Monkey', rarity: 'epic' },
      { name: 'Macaw', rarity: 'epic' },
      { name: 'Jaguarundi', rarity: 'epic' },
      { name: 'Spectacled Bear', rarity: 'epic' },
      { name: 'Narwhal', rarity: 'epic' },
      { name: 'Snowy Owl', rarity: 'epic' },
      { name: 'Wolverine', rarity: 'epic' },
      { name: 'Ice Lynx', rarity: 'epic' },
      { name: 'Bison', rarity: 'epic' },
      { name: 'Iron Stag', rarity: 'epic' },
      { name: 'Ember Falcon', rarity: 'epic' },
      { name: 'Crystal Boar', rarity: 'epic' },
      { name: 'Frostfang Lynx', rarity: 'epic' },
      { name: 'Lava Panther', rarity: 'epic' },
      { name: 'Ironclaw Wolverine', rarity: 'epic' },
      { name: 'Tundra Ram', rarity: 'epic' },
      { name: 'Solar Macaw', rarity: 'epic' },
      { name: 'Shadow Porcupine', rarity: 'epic' },
      { name: 'Spirit Vulture', rarity: 'epic' },
      { name: 'Celestial Ibex', rarity: 'epic' },
      { name: 'White Stag', rarity: 'legendary' },
      { name: 'Mythic Phoenix', rarity: 'legendary' },
      { name: 'Griffin', rarity: 'legendary' },
      { name: 'Celestial Tiger', rarity: 'legendary' },
      { name: 'Ghost Elk', rarity: 'legendary' },
      { name: 'Crimson Griffin', rarity: 'legendary' },
      { name: 'Eternal Lion', rarity: 'legendary' },
      { name: 'Storm Raven', rarity: 'legendary' },
      { name: 'Phantom Jaguar', rarity: 'legendary' },
      { name: 'Divine Stag', rarity: 'legendary' },
      { name: 'Celestial Bear', rarity: 'legendary' },
      { name: 'Flamehorn Yak', rarity: 'legendary' },
      { name: 'Spectral Falcon', rarity: 'legendary' },
      { name: 'Gilded Stag', rarity: 'legendary' },
      { name: 'Ember Phoenix', rarity: 'legendary' },
      { name: 'Mythic Ram', rarity: 'legendary' },
      { name: 'Frostmane Lion', rarity: 'legendary' },
      { name: 'Eclipse Dragon', rarity: 'mythical' },
      { name: 'Spirit of the Forest', rarity: 'mythical' },
      { name: 'Cosmic Thunderbird', rarity: 'mythical' },
      { name: 'Void Stag', rarity: 'mythical' },
      { name: 'Phoenix Lynx', rarity: 'mythical' },
      { name: 'Cosmic Chimera', rarity: 'mythical' },
      { name: 'Aether Drake', rarity: 'mythical' },
      { name: 'Forest Sentinel', rarity: 'mythical' },
      { name: 'Odins Raven', rarity: 'mythical' },
      { name: 'Crystal Elk', rarity: 'mythical' },
      { name: 'Lunar Fox', rarity: 'mythical' },
      { name: 'Arcane Owlbear', rarity: 'mythical' },
      { name: 'Forest Djinn', rarity: 'mythical' },
      { name: 'Celestial Wolf', rarity: 'mythical' },
      { name: 'Titan Boar', rarity: 'mythical' },
      { name: 'Oblivion Wolf', rarity: 'mythical' },
      { name: 'Runeblade Stag', rarity: 'mythical' },
      { name: 'Soulfeather Roc', rarity: 'mythical' },
      { name: 'Chrono Panther', rarity: 'mythical' },
      { name: 'Twilight Chimera', rarity: 'mythical' },
      { name: 'Platypus', rarity: 'transcendent' },
      { name: 'Dimensional Alpaca', rarity: 'transcendent' },
      { name: 'The One Who Hunts', rarity: 'transcendent' },
      { name: 'Spirit of Gaia', rarity: 'transcendent' },
      { name: 'Primal Harmony', rarity: 'transcendent' },
      { name: 'T-Rex', rarity: 'transcendent' },
      { name: 'Hammy the Hamster', rarity: 'transcendent' },
      { name: 'Yuri Lothbrok', rarity: 'transcendent' },
      { name: 'Mycelium Moose', rarity: 'transcendent' },
      { name: 'Chronobeast', rarity: 'transcendent' },
      { name: 'Galactic Elephant', rarity: 'transcendent' },
      { name: 'Cosmic Rhino', rarity: 'transcendent' },
      { name: 'Interdimensional Capybara', rarity: 'transcendent' },
      { name: 'The Final Squirrel', rarity: 'transcendent' },
      { name: 'Fractal Pegasus', rarity: 'transcendent' },
      { name: 'Hamstergod Supreme', rarity: 'transcendent' },
      { name: 'Reztard', rarity: 'transcendent' },
      { name: 'Yaki the Gecko', rarity: 'transcendent' },
      { name: 'Wyrmlord Daph', rarity: 'og' },
      { name: 'Blau the Voidwatcher', rarity: 'og' },
      { name: 'Chronohedgehog Nodlehs', rarity: 'og' },
      { name: 'Crime-Time Rifa', rarity: 'og' },
      { name: 'Vourbs Vulture', rarity: 'og' },
    ];
    const itemTable = [
      { name: 'Rubber Duck', rarity: 'common' },
      { name: 'Tiny Top Hat', rarity: 'common' },
      { name: 'Banana Peel', rarity: 'common' },
      { name: 'Squeaky Hammer', rarity: 'common' },
      { name: 'Party Hat', rarity: 'uncommon' },
      { name: 'Magic Pebble', rarity: 'uncommon' },
      { name: 'Broken Compass', rarity: 'uncommon' },
      { name: 'Golden Mustache', rarity: 'rare' },
      { name: 'Mysterious Key', rarity: 'rare' },
      { name: 'Lucky Coin', rarity: 'rare' },
      { name: 'Pocket Rainbow', rarity: 'rare' },
      { name: 'Elixir of Fortune', rarity: 'rare' },
      { name: 'Treasure Map Fragment', rarity: 'rare' },
      { name: 'Dragon Scale', rarity: 'epic' },
      { name: 'Phoenix Feather', rarity: 'epic' },
      { name: 'Mystic Crystal', rarity: 'epic' },
      { name: 'Enchanted Tome', rarity: 'epic' },
      { name: 'Starlit Pendant', rarity: 'epic' },
      { name: 'Phantom Cloak', rarity: 'epic' },
      { name: 'Ancient Tablet', rarity: 'epic' },
      { name: 'Crystal Dice', rarity: 'epic' },
      { name: 'Epic Sunglasses', rarity: 'legendary' },
      { name: 'Mini Loot Bag', rarity: 'legendary' },
      { name: 'Ancient Coin', rarity: 'legendary' },
      { name: 'Gem-Encrusted Ring', rarity: 'legendary' },
      { name: 'Void Trinket', rarity: 'legendary' },
      { name: 'Ancient Tome', rarity: 'legendary' },
      { name: 'Dragon Heart', rarity: 'legendary' },
      { name: 'Phoenix Heart', rarity: 'legendary' },
      { name: 'Astral Relic', rarity: 'legendary' },
      { name: 'Cosmic Mirror', rarity: 'legendary' },
      { name: 'Eternal Crystal', rarity: 'mythical' },
      { name: 'Celestial Crown', rarity: 'mythical' },
      { name: 'Timeworn Crown', rarity: 'mythical' },
      { name: 'Ember of Creation', rarity: 'mythical' },
      { name: 'Soulbound Locket', rarity: 'mythical' },
      { name: 'Infinity Gem', rarity: 'mythical' },
      { name: 'Relic of the Old Gods', rarity: 'mythical' },
      { name: 'Crown of Shadows', rarity: 'mythical' },
      { name: 'Primordial Egg', rarity: 'mythical' }
    ];
    
    // Add type field
    const fishList = fishTable.map(f => ({ ...f, type: 'fish' }));
    const animalList = animalTable.map(a => ({ ...a, type: 'animal' }));
    const itemList = itemTable.map(i => ({ ...i, type: 'item' }));
    res.json({ fish: fishList, animals: animalList, items: itemList });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching collection list.' });
  }
});

// Middleware to find or create user and wallet
router.use('/:discordId', requireGuildId, async (req, res, next) => {
  try {
    let user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });

    if (!user) {
      user = new User({ 
        discordId: req.params.discordId,
        guildId: req.guildId,
        username: req.body.username || `User${req.params.discordId}`
      });
      await user.save();
      const wallet = new Wallet({ user: user._id, guildId: req.guildId });
      wallet.balance = 100000;
      await wallet.save();
      const transaction = new Transaction({
        user: user._id,
        guildId: req.guildId,
        type: 'initial_balance',
        amount: 100000,
        description: 'Initial balance'
      });
      await transaction.save();
    }

    req.user = user;
    if (!req.wallet) {
       req.wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
       if (!req.wallet) {
           const wallet = new Wallet({ user: user._id, guildId: req.guildId });
           wallet.balance = 100000;
           await wallet.save();
           req.wallet = wallet;
       }
    }
    next();
  } catch (error) {
    console.error('Error in user middleware during creation/finding:', error);
    if (!res.headersSent) {
        res.status(500).json({ message: 'Server error during user/wallet initialization.' });
    } else {
        next(error);
    }
  }
});

// Get user's wallet balance
router.get('/:discordId/wallet', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }
    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error('Error fetching wallet balance:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get leaderboard (top users by balance)
router.get('/:discordId/leaderboard', requireGuildId, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      balance: 'balance',
      alpha: 'user.username'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'balance';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const wallets = await Wallet.find({ guildId: req.guildId })
      .populate('user', 'discordId username');
    let sortedWallets;
    if (sortBy === 'user.username') {
      sortedWallets = wallets.sort((a, b) => {
        const cmp = (a.user?.username || '').localeCompare(b.user?.username || '');
        return sortOrder === 1 ? cmp : -cmp;
      });
    } else {
      sortedWallets = wallets.sort((a, b) => {
        let cmp = b.balance - a.balance;
        return sortOrder === 1 ? -cmp : cmp;
      });
    }
    const totalCount = sortedWallets.length;
    const pagedWallets = sortedWallets.slice(skip, skip + limit);
    const leaderboard = pagedWallets.map(wallet => ({
      discordId: wallet.user.discordId,
      username: wallet.user.username,
      balance: wallet.balance
    }));
    res.json({ data: leaderboard, totalCount });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's betting and gambling statistics
router.get('/:discordId/stats', async (req, res) => {
  try {
    const user = req.user;
    // Betting stats
    const placedBets = await PlacedBet.find({ bettor: user._id, guildId: req.guildId })
      .populate({ path: 'bet', select: 'status winningOption' });
    const betting = {
      totalBets: placedBets.length,
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      winRate: 0,
      biggestWin: 0,
      biggestLoss: 0
    };
    let wonBets = 0;
    let lostBets = 0;
    placedBets.forEach(placedBet => {
      betting.totalWagered += placedBet.amount;
      if (placedBet.bet.status === 'resolved') {
        if (placedBet.option === placedBet.bet.winningOption) {
          betting.totalWon += placedBet.amount;
          wonBets++;
          if (placedBet.amount > betting.biggestWin) betting.biggestWin = placedBet.amount;
        } else {
          betting.totalLost += placedBet.amount;
          lostBets++;
          if (placedBet.amount > betting.biggestLoss) betting.biggestLoss = placedBet.amount;
        }
      }
    });
    betting.winRate = (wonBets + lostBets) > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(1) : '0.0';
    // Gambling stats
    const gamblingTransactions = await Transaction.find({
      user: user._id,
      type: { $in: ['bet', 'win'] },
      $or: [
        { description: /coinflip|dice|slots|blackjack|roulette/i },
        { description: { $exists: false } }
      ],
      guildId: req.guildId
    });
    let totalGamesPlayed = 0;
    let totalGambled = 0;
    let totalGamblingWon = 0;
    let biggestGamblingWin = 0;
    let biggestGamblingLoss = 0;
    const gameCounts = {};
    let gamblingWins = 0;
    let gamblingLosses = 0;
    gamblingTransactions.forEach(tx => {
      // Try to infer game type from description
      let gameType = 'unknown';
      if (tx.description) {
        const match = tx.description.match(/(coinflip|dice|slots|blackjack|roulette)/i);
        if (match) gameType = match[1].toLowerCase();
      }
      if (tx.type === 'bet' && tx.amount < 0) {
        totalGamesPlayed++;
        totalGambled += Math.abs(tx.amount);
        if (Math.abs(tx.amount) > biggestGamblingLoss) biggestGamblingLoss = Math.abs(tx.amount);
        gameCounts[gameType] = (gameCounts[gameType] || 0) + 1;
        gamblingLosses++;
      }
      if (tx.type === 'win' && tx.amount > 0) {
        totalGamblingWon += tx.amount;
        if (tx.amount > biggestGamblingWin) biggestGamblingWin = tx.amount;
        gamblingWins++;
      }
    });
    const favoriteGame = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const gambling = {
      totalGamesPlayed,
      totalGambled,
      totalWon: totalGamblingWon,
      totalLost: totalGambled - totalGamblingWon,
      winRate: (gamblingWins + gamblingLosses) > 0 ? ((gamblingWins / (gamblingWins + gamblingLosses)) * 100).toFixed(1) : '0.0',
      biggestWin: biggestGamblingWin,
      biggestLoss: biggestGamblingLoss,
      favoriteGame
    };
    // Other stats
    // Jackpot wins
    const jackpotWins = await Transaction.countDocuments({ user: user._id, type: 'jackpot', guildId: req.guildId });
    // Daily bonuses claimed
    const dailyBonusesClaimed = await Transaction.countDocuments({ user: user._id, type: 'daily', guildId: req.guildId });
    // Gifts sent/received
    const giftsSent = await Transaction.countDocuments({ user: user._id, type: 'gift_sent', guildId: req.guildId });
    const giftsReceived = await Transaction.countDocuments({ user: user._id, type: 'gift_received', guildId: req.guildId });
    // Win streaks
    const currentWinStreak = user.currentWinStreak || 0;
    const maxWinStreak = user.maxWinStreak || 0;
    const meowBarks = await Transaction.countDocuments({ user: user._id, type: 'meowbark', guildId: req.guildId });
    const refunds = await Transaction.countDocuments({ user: user._id, type: 'refund', guildId: req.guildId });
    res.json({
      betting,
      gambling,
      currentWinStreak,
      maxWinStreak,
      jackpotWins,
      dailyBonusesClaimed,
      giftsSent,
      giftsReceived,
      meowBarks
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// (Optional) Endpoint to initialize wallet if not created by middleware
router.post('/:discordId/wallet/initialize', async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id, guildId: req.guildId });
    if (wallet) {
      return res.status(409).json({ message: 'Wallet already exists.' });
    }
    wallet = new Wallet({ user: req.user._id, guildId: req.guildId });
    await wallet.save();
    res.status(201).json({ message: 'Wallet initialized.', wallet });
  } catch (error) {
    console.error('Error initializing wallet:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user profile
router.get('/:userId/profile', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    // Betting stats
    const placedBets = await PlacedBet.find({ bettor: user._id, guildId: req.guildId }).populate('bet');
    const betting = {
      totalBets: placedBets.length,
      totalWagered: 0,
      totalWon: 0,
      recentBets: []
    };
    placedBets.forEach(bet => {
      betting.totalWagered += bet.amount;
      if (bet.bet.status === 'resolved' && bet.option === bet.bet.winningOption) {
        betting.totalWon += bet.amount;
      }
    });
    // Add last 5 recent bets
    betting.recentBets = placedBets
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map(bet => ({
        description: bet.bet.description,
        amount: bet.amount,
        option: bet.option,
        status: bet.bet.status,
        result: bet.bet.status === 'resolved' ? 
          (bet.bet.winningOption === bet.option ? 'Won' : 'Lost') : 
          'Pending'
      }));
    // Gambling stats
    const gamblingTransactions = await Transaction.find({
      user: user._id,
      type: { $in: ['bet', 'win'] },
      $or: [
        { description: /coinflip|dice|slots|blackjack|roulette/i },
        { description: { $exists: false } }
      ],
      guildId: req.guildId
    });
    let totalGambled = 0;
    let totalGamblingWon = 0;
    gamblingTransactions.forEach(tx => {
      if (tx.type === 'bet' && tx.amount < 0) totalGambled += Math.abs(tx.amount);
      if (tx.type === 'win' && tx.amount > 0) totalGamblingWon += tx.amount;
    });
    const gambling = {
      totalGambled,
      totalWon: totalGamblingWon
    };
    
    // Calculate collection value
    const collectionValue = (user.inventory || []).reduce((sum, item) => sum + (item.value * item.count), 0);
    const collectionStats = {
      totalValue: collectionValue,
      itemCount: (user.inventory || []).reduce((sum, item) => sum + item.count, 0),
      uniqueItems: user.inventory ? user.inventory.length : 0
    };
    
    // Round off balance
    const roundedBalance = wallet ? Math.round(wallet.balance) : 0;
    const now = new Date();
    const isJailed = user.jailedUntil && user.jailedUntil > now;

    // --- Pokémon Progression Fields ---
    const poke_level = user.poke_level || 1;
    const poke_xp = user.poke_xp || 0;
    const poke_stardust = user.poke_stardust || 0;
    // XP to next level calculation (match pokeshop command)
    function getNextLevelXp(level) {
      if (level <= 1) return 0;
      let xp = 0;
      for (let i = 2; i <= level; i++) {
        xp += 100 * i;
      }
      return xp;
    }
    const xpForCurrentLevel = getNextLevelXp(poke_level);
    const xpForNextLevel = getNextLevelXp(poke_level + 1);
    const poke_xp_this_level = poke_xp - xpForCurrentLevel;
    const poke_xp_to_level = xpForNextLevel - xpForCurrentLevel;

    res.json({
      user: {
        discordId: user.discordId,
        username: user.username,
        createdAt: user.createdAt,
        isJailed,
        jailedUntil: user.jailedUntil,
        role: user.role || 'user',
        poke_level,
        poke_stardust,
        poke_xp,
        poke_xp_this_level,
        poke_xp_to_level
      },
      wallet: {
        balance: roundedBalance
      },
      betting,
      gambling,
      collection: collectionStats
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Claim daily bonus
router.post('/:userId/daily', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Check if user has already claimed today's bonus
    const lastClaim = wallet.lastDailyClaim;
    const now = new Date();
    if (lastClaim && 
        lastClaim.getDate() === now.getDate() && 
        lastClaim.getMonth() === now.getMonth() && 
        lastClaim.getFullYear() === now.getFullYear()) {
      return res.status(400).json({ 
        message: 'You have already claimed your daily bonus today.',
        nextClaimTime: lastClaim.getTime() + 24 * 60 * 60 * 1000
      });
    }

    // --- Streak reset logic ---
    let streak = wallet.dailyStreak || 0;
    if (lastClaim) {
      const msSinceLastClaim = now.getTime() - lastClaim.getTime();
      if (msSinceLastClaim > 24 * 60 * 60 * 1000) {
        streak = 0; // Reset streak if more than 24 hours since last claim
      }
    }
    streak += 1;
    // --- End streak reset logic ---

    const baseAmount = 10000; // Base daily bonus (10% of starting balance)
    const streakMultiplier = Math.min(1 + (streak * 0.1), 2); // Max 2x multiplier
    const bonusAmount = Math.floor(baseAmount * streakMultiplier);

    // Update wallet
    wallet.balance += bonusAmount;
    wallet.lastDailyClaim = new Date(); // Store the exact claim time
    wallet.dailyStreak = streak;
    await wallet.save();

    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'daily',
      amount: bonusAmount,
      description: `Daily bonus (${wallet.dailyStreak} day streak)`,
      guildId: req.guildId
    });
    await transaction.save();

    res.json({
      message: 'Daily bonus claimed successfully!',
      amount: bonusAmount,
      streak: wallet.dailyStreak,
      nextClaimTime: now.getTime() + 24 * 60 * 60 * 1000
    });
  } catch (error) {
    console.error('Error claiming daily bonus:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Gift points to another user
router.post('/:userId/gift', async (req, res) => {
  try {
    const { recipientDiscordId, amount } = req.body;
    const senderDiscordId = req.params.userId;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid gift amount.' });
    }

    // Find sender and recipient
    const sender = await User.findOne({ discordId: senderDiscordId, guildId: req.guildId });
    const recipient = await User.findOne({ discordId: recipientDiscordId, guildId: req.guildId });

    if (sender._id.equals(recipient._id)) {
      return res
        .status(400)
        .json({ message: 'You cannot gift points to yourself.' });
    }

    if (!sender || !recipient) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get wallets
    const senderWallet = await Wallet.findOne({ user: sender._id, guildId: req.guildId });
    const recipientWallet = await Wallet.findOne({ user: recipient._id, guildId: req.guildId });

    if (!senderWallet || !recipientWallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Check if sender has enough balance
    if (senderWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    // Update wallets
    senderWallet.balance -= amount;
    recipientWallet.balance += amount;
    await senderWallet.save();
    await recipientWallet.save();

    // Record transactions
    const senderTransaction = new Transaction({
      user: sender._id,
      type: 'gift_sent',
      amount: -amount,
      description: `Gift to ${recipientDiscordId}`,
      guildId: req.guildId
    });
    await senderTransaction.save();

    const recipientTransaction = new Transaction({
      user: recipient._id,
      type: 'gift_received',
      amount: amount,
      description: `Gift from ${senderDiscordId}`,
      guildId: req.guildId
    });
    await recipientTransaction.save();

    res.json({
      message: 'Gift sent successfully!',
      amount,
      newBalance: senderWallet.balance
    });
  } catch (error) {
    console.error('Error gifting points:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's transaction history
router.get('/:discordId/transactions', async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Default to 20 items per page
    const type = req.query.type;

    // Ensure page and limit are positive
    if (page < 1 || limit < 1) {
      return res.status(400).json({ message: 'Page and limit must be positive integers.' });
    }

    // Build query
    const query = { user: user._id, guildId: req.guildId };
    if (type && type !== 'all') {
      query.type = type;
    }

    // Calculate skip value
    const skip = (page - 1) * limit;

    // Get paginated transactions and total count
    const [transactions, totalCount] = await Promise.all([
      Transaction.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(query) // Get total count for pagination
    ]);

    res.json({ transactions, totalCount });
  } catch (error) {
    console.error('Error fetching transactions:', error); // Keep this error log
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get daily bonus status
router.get('/:userId/daily-status', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.userId, guildId: req.guildId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    const lastClaim = wallet.lastDailyClaim;
    const now = new Date();
    let nextClaimTime = null;

    if (lastClaim) {
      // Calculate the time 24 hours after the last claim
      nextClaimTime = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000).getTime();
    }

    res.json({
      nextClaimTime,
      currentStreak: wallet.dailyStreak || 0
    });
  } catch (error) {
    console.error('Error getting daily bonus status:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get user's preferences
router.get('/:discordId/preferences', async (req, res) => {
  try {
    // Find user preferences or create default if none exist
    let preferences = await UserPreferences.findOne({ user: req.user._id, guildId: req.guildId });
    
    if (!preferences) {
      preferences = new UserPreferences({ user: req.user._id, guildId: req.guildId });
      await preferences.save();
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ message: 'Server error fetching preferences.' });
  }
});

// Update user's preferences
router.put('/:discordId/preferences', async (req, res) => {
  try {
    const updates = req.body;
    // Find preferences and update
    const preferences = await UserPreferences.findOneAndUpdate(
      { user: req.user._id, guildId: req.guildId },
      { $set: updates },
      { new: true, upsert: true } // Create if not exists, return updated document
    );
    
    res.json({ message: 'Preferences updated successfully!', preferences });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ message: 'Server error updating preferences.' });
  }
});

// Leaderboard: Top Win Streaks
router.get('/leaderboard/winstreaks', requireGuildId, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      max: 'maxWinStreak',
      current: 'currentWinStreak',
      alpha: 'username'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'maxWinStreak';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const UserModel = require('../models/User');
    const [users, totalCount] = await Promise.all([
      UserModel.find({ guildId: req.guildId })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select('username discordId maxWinStreak currentWinStreak'),
      UserModel.countDocuments({ guildId: req.guildId })
    ]);
    res.json({ data: users, totalCount });
  } catch (error) {
    console.error('Error fetching win streak leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Leaderboard: Biggest Wins
router.get('/leaderboard/biggest-wins', requireGuildId, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const allowedSorts = {
      amount: 'amount',
      alpha: 'user.username',
      date: 'timestamp'
    };
    const sortBy = allowedSorts[req.query.sortBy] || 'amount';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const Transaction = require('../models/Transaction');
    const User = require('../models/User');
    let wins = await Transaction.find({ type: 'win', guildId: req.guildId })
      .populate('user', 'username discordId')
      .lean();
    // In-memory sort for username (alpha)
    if (sortBy === 'user.username') {
      wins.sort((a, b) => {
        const cmp = (a.user?.username || '').localeCompare(b.user?.username || '');
        return sortOrder === 1 ? cmp : -cmp;
      });
    } else {
      wins.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'amount') cmp = b.amount - a.amount;
        else if (sortBy === 'timestamp') cmp = new Date(b.timestamp) - new Date(a.timestamp);
        return sortOrder === 1 ? -cmp : cmp;
      });
    }
    const totalCount = wins.length;
    wins = wins.slice(skip, skip + limit);
    const result = wins.map(win => ({
      username: win.user?.username || 'Unknown',
      discordId: win.user?.discordId || '',
      amount: win.amount,
      description: win.description,
      timestamp: win.timestamp
    }));
    res.json({ data: result, totalCount });
  } catch (error) {
    console.error('Error fetching biggest wins leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Add endpoint to get all users (for superadmin)
router.get('/', requireGuildId, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const queryObj = { guildId: req.guildId };
    const [users, totalCount] = await Promise.all([
      User.find(queryObj, '_id username discordId role')
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(queryObj)
    ]);
    res.json({ data: users, totalCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users.' });
  }
});

// Get all placed bets for a user (My Bets)
router.get('/:discordId/bets', async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    // Aggregation pipeline for filtering and sorting
    const matchStage = { $match: { bettor: user._id, guildId: req.guildId } };
    const lookupStage = {
      $lookup: {
        from: 'bets',
        localField: 'bet',
        foreignField: '_id',
        as: 'bet'
      }
    };
    const unwindStage = { $unwind: '$bet' };
    const pipeline = [matchStage, lookupStage, unwindStage];
    // Status filter
    if (req.query.status && req.query.status !== 'all') {
      pipeline.push({ $match: { 'bet.status': req.query.status } });
    }
    // Result filter
    if (req.query.result && req.query.result !== 'all') {
      if (req.query.result === 'won') {
        pipeline.push({ $match: { $expr: { $and: [ { $eq: ['$bet.status', 'resolved'] }, { $eq: ['$option', '$bet.winningOption'] } ] } } });
      } else if (req.query.result === 'lost') {
        pipeline.push({ $match: { $expr: { $and: [ { $eq: ['$bet.status', 'resolved'] }, { $ne: ['$option', '$bet.winningOption'] } ] } } });
      } else if (req.query.result === 'refunded') {
        pipeline.push({ $match: { 'bet.status': 'refunded' } });
      } else if (req.query.result === 'pending') {
        pipeline.push({ $match: { 'bet.status': { $nin: ['resolved', 'refunded'] } } });
      }
    }
    // Sorting
    pipeline.push({ $sort: { [sortBy]: sortOrder } });
    // For totalCount, run the same pipeline up to this point
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: 'total' });
    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    // Run aggregation
    const [placedBets, countResult] = await Promise.all([
      PlacedBet.aggregate(pipeline),
      PlacedBet.aggregate(countPipeline)
    ]);
    const totalCount = countResult[0]?.total || 0;
    res.json({
      data: placedBets,
      totalCount,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching user placed bets:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Update username for a user
router.post('/:discordId/update-username', requireGuildId, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.length < 2) {
      return res.status(400).json({ message: 'Invalid username.' });
    }
    const user = await User.findOneAndUpdate(
      { discordId: req.params.discordId, guildId: req.guildId },
      { username },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ message: 'Username updated.', user });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// MeowBark reward endpoint
router.post('/:discordId/meowbark', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 1 || amount > 100000) {
      return res.status(400).json({ message: 'Amount must be between 1 and 100,000.' });
    }
    wallet.balance += amount;
    await wallet.save();
    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'meowbark',
      amount,
      description: 'Meow/Bark reward',
      guildId: req.guildId
    });
    await transaction.save();
    res.json({ message: `Added ${amount} points.`, newBalance: wallet.balance });
  } catch (error) {
    console.error('Error in meowbark endpoint:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- PENALIZE LIAR ENDPOINT (for /question command) ---
router.post('/:discordId/penalize-liar', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.guildId;
    const user = req.user;
    const wallet = req.wallet;
    
    const penaltyAmount = 1000000; // 1 million
    let deductedAmount;

    if (wallet.balance >= penaltyAmount) {
      wallet.balance -= penaltyAmount;
      deductedAmount = penaltyAmount;
    } else {
      deductedAmount = wallet.balance;
      wallet.balance = 0;
    }
    
    await wallet.save();

    // Create a transaction record for the penalty
    await Transaction.create({
      user: user._id,
      guildId,
      type: 'penalty',
      amount: -deductedAmount,
      description: 'Penalty for lying to the gecko.',
      metadata: {
        command: 'question'
      }
    });

    res.json({
      success: true,
      message: `User penalized for lying. Deducted ${deductedAmount.toLocaleString('en-US')} points.`,
      newBalance: wallet.balance,
      deductedAmount
    });

  } catch (error) {
    console.error('Error in penalize-liar endpoint:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Search users by username (for gifting, autocomplete, etc.)
router.get('/search-users', requireGuildId, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }
    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      guildId: req.guildId
    })
      .select('discordId username role')
      .limit(20);
    res.json({ data: users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error searching users.' });
  }
});

// --- CRIME COMMAND ---
router.post('/:discordId/crime', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);

    // Check if user is jailed
    if (user.jailedUntil && user.jailedUntil > now) {
      return res.status(403).json({
        message: `You are jailed until ${user.jailedUntil.toLocaleString()}`,
        jailedUntil: user.jailedUntil
      });
    }

    // Check cooldown
    if (user.crimeCooldown && user.crimeCooldown > now) {
      return res.status(429).json({
        message: `Crime is on cooldown. Try again at ${user.crimeCooldown.toLocaleString()}`,
        cooldown: user.crimeCooldown
      });
    }

    // Crime scenarios
    const crimes = [
      'robbed a bank',
      'hacked a casino',
      'pickpocketed a cop',
      'mugged a street vendor',
      'stole a luxury car',
      'pulled off a jewelry heist',
      'shoplifted from a convenience store',
      'ran a pyramid scheme',
      'counterfeited lottery tickets',
      'hijacked an armored truck'
    ];
    const crime = crimes[Math.floor(Math.random() * crimes.length)];

    // Buff checks
    let usedBuff = null;
    const crimeSuccessIdx = (user.buffs || []).findIndex(b => b.type === 'crime_success');
    const jailImmunityIdx = (user.buffs || []).findIndex(b => b.type === 'jail_immunity' && (!b.expiresAt || b.expiresAt > now));
    const luckyStreakBuff = (user.buffs || []).find(b => b.type === 'lucky_streak' && b.usesLeft > 0);
    const earningsBuff = (user.buffs || []).find(b => 
      (b.type === 'earnings_x2' || b.type === 'earnings_x3' || b.type === 'earnings_x5') && 
      (!b.expiresAt || b.expiresAt > now)
    );

    // Determine outcome
    const outcomeRoll = Math.random();
    let outcome, amount = 0, jailMinutes = 0, message = '';
    if (crimeSuccessIdx >= 0) {
      // Buff: guaranteed success
      outcome = 'success';
      amount = Math.floor(Math.random() * 150000) + 50000; // 50-200k
      usedBuff = user.buffs[crimeSuccessIdx];
      user.buffs[crimeSuccessIdx].usesLeft = (user.buffs[crimeSuccessIdx].usesLeft || 1) - 1;
      if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
      message = `Your buff guaranteed a successful crime! You pulled off the ${crime} and got away with ${amount.toLocaleString('en-US')} points! 🤑`;
      user.crimeStats.success++;
    } else {
      // Apply lucky streak buff if available
      let successThreshold = 0.5;
      let failThreshold = 0.85;
      
      if (luckyStreakBuff) {
        successThreshold = 0.7; // 70% success rate instead of 50%
        failThreshold = 0.9; // 20% fail rate instead of 35%
        // 10% jail rate instead of 15%
      }
      
      if (outcomeRoll < successThreshold) {
        // Success
        outcome = 'success';
        amount = Math.floor(Math.random() * 125000) + 25000; // 25k-150k
        message = `You pulled off the ${crime} and got away with ${amount.toLocaleString('en-US')} points! 🤑`;
        user.crimeStats.success++;
        
        // Consume lucky streak buff
        if (luckyStreakBuff) {
          luckyStreakBuff.usesLeft--;
          if (luckyStreakBuff.usesLeft <= 0) {
            user.buffs = user.buffs.filter(b => b !== luckyStreakBuff);
          }
          message += ` 🍀 Lucky Streak buff used! (${luckyStreakBuff.usesLeft + 1} uses remaining)`;
        }
      } else if (outcomeRoll < failThreshold) {
        // Failure
        outcome = 'fail';
        amount = Math.floor(Math.random() * 70000) + 10000; // 10k-80k
        message = `You tried to ${crime}, but failed. Lost ${amount.toLocaleString('en-US')} points.`;
        user.crimeStats.fail++;
      } else {
        // Jail
        outcome = 'jail';
        jailMinutes = Math.floor(Math.random() * 16) + 15; // 15-30 min
        message = `You got caught ${crime}! 🚔 You're in jail for ${jailMinutes} minutes.`;
        user.crimeStats.jail++;
      }
    }

    // Buff: jail immunity
    if (jailImmunityIdx >= 0 && outcome === 'jail') {
      outcome = 'fail';
      jailMinutes = 0;
      message = 'Your jail immunity buff saved you from jail! You only failed the crime.';
      user.buffs[jailImmunityIdx].usesLeft = (user.buffs[jailImmunityIdx].usesLeft || 1) - 1;
      if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    }

    // Buff: earnings_x2/x3/x5
    if (earningsBuff && outcome === 'success') {
      const multiplier = earningsBuff.type === 'earnings_x2' ? 2 : 
                        earningsBuff.type === 'earnings_x3' ? 3 : 5;
      amount *= multiplier;
      message = message.replace(/(\d[\d,]*) points/, `${amount.toLocaleString('en-US')} points`);
      message += ` (${earningsBuff.type} buff active: ${multiplier}x POINTS!)`;
    }

    // Apply results
    if (outcome === 'success') {
      wallet.balance += amount;
    } else if (outcome === 'fail') {
      wallet.balance = Math.max(0, wallet.balance - amount);
    } else if (outcome === 'jail') {
      user.jailedUntil = new Date(now.getTime() + jailMinutes * 60000);
    }

    // Set cooldown (30-60 min)
    const cooldownMinutes = Math.floor(Math.random() * 31) + 30;
    user.crimeCooldown = new Date(now.getTime() + cooldownMinutes * 60000);

    await wallet.save();
    await user.save();

    res.json({
      outcome,
      amount,
      jailMinutes,
      message,
      cooldown: user.crimeCooldown,
      jailedUntil: user.jailedUntil
    });
  } catch (error) {
    console.error('Error in /crime:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- WORK COMMAND ---
router.post('/:discordId/work', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();

    // Check cooldown
    if (user.workCooldown && user.workCooldown > now) {
      return res.status(429).json({
        message: `Work is on cooldown. Try again at ${user.workCooldown.toLocaleString()}`,
        cooldown: user.workCooldown
      });
    }

    // Jobs
    const jobs = [
      'streamer',
      'pizza delivery',
      'mercenary',
      'taxi driver',
      'street musician',
      'dog walker',
      'barista',
      'construction worker',
      'social media influencer',
      'private investigator',
      'collector'
    ];
    let job = req.body.job;
    if (!job || !jobs.includes(job)) {
      job = jobs[Math.floor(Math.random() * jobs.length)];
    }

    // Determine reward
    let baseMin = 25000, baseMax = 150000; // Updated to match crime success
    let bonusChance = 0.15;
    let bonus = 0, bonusMsg = '';
    switch (job) {
      case 'streamer': bonusMsg = 'A mysterious whale donated'; break;
      case 'pizza delivery': bonusMsg = 'A celebrity tipped you'; break;
      case 'mercenary': bonusMsg = 'You found a hidden stash!'; break;
      case 'taxi driver': bonusMsg = 'Your passenger left a golden watch!'; break;
      case 'street musician': bonusMsg = 'A record producer noticed you!'; break;
      case 'dog walker': bonusMsg = 'A dog owner gave you a huge tip!'; break;
      case 'barista': bonusMsg = 'A customer paid you in gold coins!'; break;
      case 'construction worker': bonusMsg = 'You found a rare artifact!'; break;
      case 'social media influencer': bonusMsg = 'A brand sponsored your post!'; break;
      case 'private investigator': bonusMsg = 'You solved a cold case!'; break;
      case 'collector': bonusMsg = 'You discovered a priceless relic!'; break;
    }
    let amount = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
    let rare = false;
    if (Math.random() < bonusChance) {
      bonus = Math.floor(Math.random() * 150000) + 50000; // 50k-200k, matches crime guaranteed success
      amount += bonus;
      rare = true;
    }

    // Initialize message after amount/bonus are determined
    let message;
    if (rare) {
      let amountWithBonus = amount - bonus;
      message = `You worked as a ${job} and earned ${amountWithBonus.toLocaleString('en-US')} points. ${bonusMsg} +${bonus.toLocaleString('en-US')} points!`;
    } else {
      message = `You worked as a ${job} and earned ${amount.toLocaleString('en-US')} points.`;
    }

    // Buff: work_double/triple/quintuple
    const workBuff = (user.buffs || []).find(b => 
      (b.type === 'work_double' || b.type === 'work_triple' || b.type === 'work_quintuple') && 
      (b.usesLeft === undefined || b.usesLeft > 0)
    );

    if (workBuff) {
      const multiplier = workBuff.type === 'work_double' ? 2 : 
                        workBuff.type === 'work_triple' ? 3 : 5;
      amount *= multiplier;
      // Decrement uses if it's a limited use buff
      if (workBuff.usesLeft !== undefined) {
        workBuff.usesLeft--;
        if (workBuff.usesLeft <= 0) {
          user.buffs = user.buffs.filter(b => b !== workBuff);
        }
      }
      message += ` (${workBuff.type} buff used: ${multiplier}x POINTS!)`;
    }

    // Check for earnings buffs
    const earningsBuff = (user.buffs || []).find(b => 
      (b.type === 'earnings_x2' || b.type === 'earnings_x3' || b.type === 'earnings_x5') && 
      (!b.expiresAt || b.expiresAt > now)
    );
    if (earningsBuff) {
      const multiplier = earningsBuff.type === 'earnings_x2' ? 2 : 
                        earningsBuff.type === 'earnings_x3' ? 3 : 5;
      amount *= multiplier;
      message += ` (${earningsBuff.type} buff active: ${multiplier}x POINTS!)`;
    }

    // Update wallet and stats ONCE, after all buff logic
    wallet.balance += amount;
    if (!user.workStats) user.workStats = {};
    if (!user.workStats[job]) user.workStats[job] = { times: 0, earned: 0, bonus: 0 };
    user.workStats[job].times++;
    user.workStats[job].earned += (amount - bonus);
    if (bonus > 0) {
      user.workStats[job].bonus += bonus;
    }
    user.markModified('workStats');

    // Set cooldown (1-2 hours)
    const cooldownMinutes = Math.floor(Math.random() * 61) + 60;
    user.workCooldown = new Date(now.getTime() + cooldownMinutes * 60000);

    await wallet.save();
    await user.save();

    res.json({
      job,
      amount,
      bonus: rare ? bonus : 0,
      message,
      cooldown: user.workCooldown
    });
  } catch (error) {
    console.error('Error in /work:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- CRIME STATS ---
router.get('/:discordId/crime-stats', async (req, res) => {
  try {
    const user = req.user;
    res.json({ crimeStats: user.crimeStats });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching crime stats.' });
  }
});

// --- WORK STATS ---
router.get('/:discordId/work-stats', async (req, res) => {
  try {
    const user = req.user;
    // Handle both Map and plain object for workStats
    let workStats = [];
    if (user.workStats) {
      if (typeof user.workStats.entries === 'function') {
        // Mongoose Map
        workStats = Array.from(user.workStats.entries()).map(([job, stats]) => ({ job, ...stats }));
      } else if (typeof user.workStats === 'object') {
        // Plain object (from JSON or lean query)
        workStats = Object.entries(user.workStats).map(([job, stats]) => ({ job, ...(stats || {}) }));
      }
    }
    res.json({ workStats });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching work stats.' });
  }
});

// --- BAIL SYSTEM ---
router.post('/:discordId/bail', async (req, res) => {
  // Debug: log entry and params
  // console.log('[BAIL] Called with payer discordId:', req.params.discordId, 'body:', req.body);
  if (!req.user) {
    console.error('[BAIL] req.user is missing!');
    return res.status(401).json({ message: 'User not authenticated (req.user missing).' });
  }
  try {
    const payer = req.user;
    const { targetDiscordId } = req.body;
    // console.log('[BAIL] payer:', payer.discordId, 'target:', targetDiscordId);
    if (!targetDiscordId) return res.status(400).json({ message: 'No target user specified.' });
    if (targetDiscordId === payer.discordId) return res.status(400).json({ message: 'You cannot bail yourself out.' });
    const targetUser = await User.findOne({ discordId: targetDiscordId, guildId: req.guildId });
    // console.log('[BAIL] targetUser:', targetUser && targetUser.discordId, 'jailedUntil:', targetUser && targetUser.jailedUntil);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found.' });
    if (!targetUser.jailedUntil || targetUser.jailedUntil < new Date()) {
      return res.status(400).json({ message: 'Target user is not currently jailed.' });
    }
    // Use stored bail information or fallback to old calculation
    const now = new Date();
    const minutesLeft = Math.ceil((targetUser.jailedUntil - now) / 60000);
    
    let bailCost;
    if (targetUser.bailInfo && targetUser.bailInfo.amount > 0) {
      // Use the stored bail amount from the new system
      bailCost = targetUser.bailInfo.amount;
    } else {
      // Fallback to old calculation for users jailed before the update
      bailCost = 10000 + minutesLeft * 1000;
    }
    const payerWallet = await Wallet.findOne({ user: payer._id, guildId: req.guildId });
    // console.log('[BAIL] payerWallet balance:', payerWallet && payerWallet.balance, 'bailCost:', bailCost);
    if (!payerWallet || payerWallet.balance < bailCost) {
      return res.status(400).json({ message: `You need ${bailCost.toLocaleString('en-US')} points to bail this user out.` });
    }
    // Deduct from payer, free target
    payerWallet.balance -= bailCost;
    await payerWallet.save();
    // Record transaction for payer
    const transaction = new Transaction({
      user: payer._id,
      type: 'bail',
      amount: -bailCost,
      description: `Bailed out <@${targetDiscordId}>`,
      guildId: req.guildId
    });
    await transaction.save();
    targetUser.jailedUntil = null;
    targetUser.bailInfo = {
      amount: 0,
      additionalJailTime: 0,
      stealType: null,
      targetDiscordId: null,
      calculatedAt: null
    };
    await targetUser.save();
    // console.log('[BAIL] Bail successful.');
    res.json({
      message: `You bailed out <@${targetDiscordId}> for ${bailCost.toLocaleString('en-US')} points!`,
      bailCost,
      minutesLeft
    });
  } catch (error) {
    console.error('[BAIL] Exception:', error);
    res.status(500).json({ message: 'Server error processing bail.' });
  }
});

// --- BAIL ALL SYSTEM ---
router.post('/:discordId/bail-all', async (req, res) => {
  // console.log('[BAIL-ALL] Called with payer discordId:', req.params.discordId, 'body:', req.body);
  if (!req.user) {
    console.error('[BAIL-ALL] req.user is missing!');
    return res.status(401).json({ message: 'User not authenticated (req.user missing).' });
  }
  try {
    const payer = req.user;
    // console.log('[BAIL-ALL] payer:', payer.discordId);
    
    // Get all currently jailed users in the guild
    const now = new Date();
    const jailedUsers = await User.find({ 
      guildId: req.guildId, 
      jailedUntil: { $gt: now } 
    });
    
    if (jailedUsers.length === 0) {
      return res.status(400).json({ message: 'No users are currently jailed in this server.' });
    }
    
    // Check if payer is jailed and add to failedUsers if so
    let failedUsers = [];
    if (payer.jailedUntil && payer.jailedUntil > now) {
      failedUsers.push({
        discordId: payer.discordId,
        username: payer.username,
        reason: 'You cannot bail yourself out with this command.'
      });
    }

    // Filter out the payer from jailedUsers for actual bail processing
    const filteredJailedUsers = jailedUsers.filter(u => u.discordId !== payer.discordId);
    if (filteredJailedUsers.length === 0 && failedUsers.length > 0) {
      return res.status(400).json({ message: 'You cannot bail yourself out with this command. No other users are currently jailed.', failedUsers });
    }

    // Calculate total bail cost for all users (excluding payer)
    let totalCost = 0;
    const bailedUsers = [];

    // Get payer's wallet
    const payerWallet = await Wallet.findOne({ user: payer._id, guildId: req.guildId });
    if (!payerWallet) {
      return res.status(400).json({ message: 'Your wallet not found.' });
    }

    // Calculate costs and check if payer can afford
    for (const jailedUser of filteredJailedUsers) {
      const minutesLeft = Math.ceil((jailedUser.jailedUntil - now) / 60000);
      
      let bailCost;
      if (jailedUser.bailInfo && jailedUser.bailInfo.amount > 0) {
        // Use the stored bail amount from the new system
        bailCost = jailedUser.bailInfo.amount;
      } else {
        // Fallback to old calculation for users jailed before the update
        bailCost = 10000 + minutesLeft * 1000;
      }
      totalCost += bailCost;
    }

    if (payerWallet.balance < totalCost) {
      return res.status(400).json({ 
        message: `You need ${totalCost.toLocaleString('en-US')} points to bail all users out. You have ${payerWallet.balance.toLocaleString('en-US')} points.`,
        failedUsers
      });
    }

    // Process bails for all users (excluding payer)
    for (const jailedUser of filteredJailedUsers) {
      try {
        const minutesLeft = Math.ceil((jailedUser.jailedUntil - now) / 60000);
        
        let bailCost;
        if (jailedUser.bailInfo && jailedUser.bailInfo.amount > 0) {
          // Use the stored bail amount from the new system
          bailCost = jailedUser.bailInfo.amount;
        } else {
          // Fallback to old calculation for users jailed before the update
          bailCost = 10000 + minutesLeft * 1000;
        }
        
        // Free the user
        jailedUser.jailedUntil = null;
        jailedUser.bailInfo = {
          amount: 0,
          additionalJailTime: 0,
          stealType: null,
          targetDiscordId: null,
          calculatedAt: null
        };
        await jailedUser.save();
        // Record successful bail
        bailedUsers.push({
          discordId: jailedUser.discordId,
          username: jailedUser.username,
          bailCost: bailCost,
          minutesLeft: minutesLeft
        });

      } catch (error) {
        console.error(`[BAIL-ALL] Error bailing user ${jailedUser.discordId}:`, error);
        failedUsers.push({
          discordId: jailedUser.discordId,
          username: jailedUser.username,
          reason: error.message || 'Server error processing bail'
        });
      }
    }

    // Deduct total cost from payer
    payerWallet.balance -= totalCost;
    await payerWallet.save();

    // Record transaction for payer
    const transaction = new Transaction({
      user: payer._id,
      type: 'bail',
      amount: -totalCost,
      description: `Bailed out ${bailedUsers.length} users` + (failedUsers.length > 0 ? ` (${failedUsers.length} failed)` : ''),
      guildId: req.guildId
    });
    await transaction.save();

    let responseMsg = `Successfully bailed out ${bailedUsers.length} users for ${totalCost.toLocaleString('en-US')} points!`;
    if (failedUsers.length > 0) {
      responseMsg += `\n${failedUsers.length} users could not be bailed out.`;
    }

    res.json({
      message: responseMsg,
      totalCost,
      bailedUsers,
      failedUsers
    });
  } catch (error) {
    console.error('[BAIL-ALL] Exception:', error);
    res.status(500).json({ message: 'Server error processing mass bail.' });
  }
});

// --- FISHING ---
router.post('/:discordId/fish', async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    if (!user.fishCooldown) user.fishCooldown = null;
    
    // Check for no cooldown buffs
    const noCooldownBuff = (user.buffs || []).find(b => b.type === 'fishing_no_cooldown' && b.usesLeft > 0);
    const frenzyBuff = (user.buffs || []).find(b => b.type === 'frenzy_mode' && (!b.expiresAt || b.expiresAt > now));
    const timeWarpBuff = (user.buffs || []).find(b => b.type === 'time_warp' && (!b.expiresAt || b.expiresAt > now));
    
    if (user.fishCooldown && user.fishCooldown > now && !noCooldownBuff && !frenzyBuff) {
      return res.status(429).json({ message: `Fishing is on cooldown. Try again at ${user.fishCooldown.toLocaleString()}`, cooldown: user.fishCooldown });
    }
    // Fish table
    const fishTable = [
      // Common
      { name: 'Carp', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Perch', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Bluegill', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Tilapia', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Sardine', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Anchovy', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Goby', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Smelt', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Mudfish', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Minnow', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Sunfish', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Dace', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Rudd', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Herring', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Roach', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Whitefish', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Crucian Carp', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Bleak', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Shiner', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Loach', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Grunt Fish', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Silver Biddy', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Sculpin', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
    
      // Uncommon
      { name: 'Bass', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Catfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Pike', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Trout', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Snapper', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Mullet', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Rockfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Grouper', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Drumfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Zander', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Bream', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Chub', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Bullhead Catfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Blue Catfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Burbot', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Sheepshead', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'White Bass', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Golden Perch', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Spotted Seatrout', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Striped Bass', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Weakfish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Silver Carp', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Lake Whitefish', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Longnose Gar', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Black Crappie', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      // Rare
      { name: 'Salmon', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Sturgeon', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Eel', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Swordfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Wahoo', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Barracuda', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Tarpon', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Halibut', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'King Mackerel', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Rainbow Trout', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Anglerfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Sea Devil', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Flying Fish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Tilefish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Queen Angelfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Red Drum', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Bluefin Tuna', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Atlantic Bonito', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Deep Sea Smelt', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Dusky Grouper', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Bigeye Trevally', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Ghost Catfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Ocean Sunfish', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Spotted Eagle Ray', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Threadfin Bream', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      // Epic
      { name: 'Mahi-Mahi', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Giant Squid', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Electric Ray', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Blue Marlin', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Opah', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Fire Eel', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ghost Shark', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Aurora Flounder', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Colossal Squid', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Black Dragonfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Fangtooth', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Viperfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Glasshead Barreleye', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Mandarinfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Clown Triggerfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Blue Tang', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Rainbow Parrotfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Lionfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Silver Salmon', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Swordtail Shark', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Thunderfin', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Starlight Ray', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Crystal Piranha', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Twilight Lanternfish', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ghostfin Barracuda', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Frostjaw Pike', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ironscale Tuna', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Blazetail Salmon', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Volcanic Grouper', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      // Legendary
      { name: 'Golden Koi', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Ancient Leviathan', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Celestial Angelfish', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Kraken', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Leviathan Pike', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Infernal Barramundi', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Stormscale Tuna', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Shadowfin Orca', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Prism Jellyfish', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Frostfin Leviathan', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Titan Bass', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Hellmaw Eel', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Thundercrash Ray', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Gilded Marlin', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Stormray Manta', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      // Mythical
      { name: 'Abyssal Serpent', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Timefish of Eternity', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Void Whale', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Chrono Trout', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Dreamscale Eel', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Aetherfin Serpent', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Starspawn Octopus', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Realityray', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Nebulashark', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Moonlit Tuna', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Astral Barracuda', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Cosmic Lanternfish', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Chronoshark', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Aurora Abyssfish', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Wyrmfin', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Reality Pike', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Sunborn Leviathan', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },

      // Transcendent
        { name: 'Goldfish', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Infinity Carp', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Omnifin', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Godscale Dragonfish', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Quantum Koi', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Time-Tide Leviathan', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Etherfin Leviathan', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Galactic Jellyray', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'The Kraken', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Eternafish', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Omnisquid', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Celestine Ray', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
        { name: 'Godfin Eternatus', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },

        // OG
        { name: "Kanalo's Wrath", rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
        { name: 'Hasib the Abyssseer', rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
        { name: 'Jeemongul', rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
        { name: 'Oven', rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
    ];
    
    // Rarity weights
    const rarityRoll = Math.random();
    let rarity = 'common';
    
    // Check for guaranteed legendary/epic buffs first
    const guaranteedBuff = (user.buffs || []).find(b => 
      (b.type === 'fishing_rare' || b.type === 'fishing_epic') && 
      b.usesLeft > 0
    );

    let buffMessage = '';

    // Check for drop rate buffs
    const rateBuff = (user.buffs || []).find(b => 
      (b.type === 'fishing_rate_1.5x' || b.type === 'fishing_rate_2x' || b.type === 'fishing_rate_3x') && 
      (!b.expiresAt || b.expiresAt > now)
    );

    // Multiplier for rate buffs
    let rateMultiplier = 1;
    let rateBuffType = null;
    if (rateBuff) {
      rateBuffType = rateBuff.type;
      rateMultiplier = {
        'fishing_rate_1.5x': 1.5,
        'fishing_rate_2x': 2,
        'fishing_rate_3x': 3
      }[rateBuff.type] || 1;
      buffMessage += `${rateBuff.type} buff active: Epic+ drop rates multiplied by ${rateMultiplier}x!`;
    }

    // Calculate rarity weights based on buffs
    let weights = { ...baseWeights };
    if (guaranteedBuff) {
      // Guaranteed Rare or Epic logic
      if (guaranteedBuff.type === 'fishing_rare') {
        // Only rare, epic, legendary, mythical, transcendent, og possible
        // If rate buff, multiply mythical+ and assign remainder to legendary
        const baseRare = baseWeights.rare;
        const baseEpic = baseWeights.epic;
        const baseLegendary = baseWeights.legendary;
        const baseMythical = baseWeights.mythical;
        const baseTranscendent = baseWeights.transcendent;
        const baseOg = baseWeights.og;
        const epicPlusBase = baseEpic + baseLegendary + baseMythical + baseTranscendent + baseOg;
        let epicPlus = epicPlusBase * rateMultiplier;
        if (epicPlus > 100) epicPlus = 100;
        let rare = baseRare + (epicPlusBase - epicPlus);
        if (rare < 0) rare = 0;
        // Distribute rare/epic/legendary/mythical/transcendent/og in original ratio
        let epic = 0, legendary = 0, mythical = 0, transcendent = 0, og = 0;
        if (epicPlus > 0) {
          epic = (baseEpic / epicPlusBase) * epicPlus;
          legendary = (baseLegendary / epicPlusBase) * epicPlus;
          mythical = (baseMythical / epicPlusBase) * epicPlus;
          transcendent = (baseTranscendent / epicPlusBase) * epicPlus;
          og = (baseOg / epicPlusBase) * epicPlus;
        }
        weights = {
          og,
          transcendent,
          mythical,
          legendary,
          epic,
          rare,
          uncommon: 0,
          common: 0
        };
      } else if (guaranteedBuff.type === 'fishing_epic') {
        // Only epic, legendary, mythical, transcendent, og possible
        // If rate buff, multiply legendary+ and assign remainder to epic
        const baseEpic = baseWeights.epic;
        const baseLegendary = baseWeights.legendary;
        const baseMythical = baseWeights.mythical;
        const baseTranscendent = baseWeights.transcendent;
        const baseOg = baseWeights.og;
        const legendaryPlusBase = baseLegendary + baseMythical + baseTranscendent + baseOg;
        let legendaryPlus = legendaryPlusBase * rateMultiplier;
        if (legendaryPlus > 100) legendaryPlus = 100;
        let epic = baseEpic + (legendaryPlusBase - legendaryPlus);
        if (epic < 0) epic = 0;
        // Distribute legendary/mythical/transcendent/og in original ratio
        let legendary = 0, mythical = 0, transcendent = 0, og = 0;
        if (legendaryPlus > 0) {
          legendary = (baseLegendary / legendaryPlusBase) * legendaryPlus;
          mythical = (baseMythical / legendaryPlusBase) * legendaryPlus;
          transcendent = (baseTranscendent / legendaryPlusBase) * legendaryPlus;
          og = (baseOg / legendaryPlusBase) * legendaryPlus;
        }
        weights = {
          og,
          transcendent,
          mythical,
          legendary,
          epic,
          rare: 0,
          uncommon: 0,
          common: 0
        };
      }
      // Decrement uses
      guaranteedBuff.usesLeft--;
      if (guaranteedBuff.usesLeft <= 0) {
        user.buffs = user.buffs.filter(b => b !== guaranteedBuff);
      }
      if (buffMessage) buffMessage += '\n';
      buffMessage += `${guaranteedBuff.type} buff used: Guaranteed ${guaranteedBuff.type === 'fishing_rare' ? 'Rare' : 'Epic'} or better!`;
    } else if (rateBuff) {
      // Only rate buff, no guaranteed buff
      // Multiply epic+ by rateMultiplier, distribute rest among rare/uncommon/common
      const baseEpic = baseWeights.epic;
      const baseLegendary = baseWeights.legendary;
      const baseMythical = baseWeights.mythical;
      const baseTranscendent = baseWeights.transcendent;
      const baseOg = baseWeights.og;
      const epicPlusBase = baseEpic + baseLegendary + baseMythical + baseTranscendent + baseOg;
      let epicPlus = epicPlusBase * rateMultiplier;
      if (epicPlus > 100) epicPlus = 100;
      // Distribute epic/legendary/mythical/transcendent/og in original ratio
      let epic = 0, legendary = 0, mythical = 0, transcendent = 0, og = 0;
      if (epicPlus > 0) {
        epic = (baseEpic / epicPlusBase) * epicPlus;
        legendary = (baseLegendary / epicPlusBase) * epicPlus;
        mythical = (baseMythical / epicPlusBase) * epicPlus;
        transcendent = (baseTranscendent / epicPlusBase) * epicPlus;
        og = (baseOg / epicPlusBase) * epicPlus;
      }
      // Remaining %
      let remaining = 100 - epicPlus;
      const baseLower = baseWeights.rare + baseWeights.uncommon + baseWeights.common;
      let rare = 0, uncommon = 0, common = 0;
      if (remaining > 0 && baseLower > 0) {
        rare = (baseWeights.rare / baseLower) * remaining;
        uncommon = (baseWeights.uncommon / baseLower) * remaining;
        common = (baseWeights.common / baseLower) * remaining;
      }
      weights = {
        og,
        transcendent,
        mythical,
        legendary,
        epic,
        rare,
        uncommon,
        common
      };
    }
    // Normalize weights to sum to 100
    const totalWeight = rarityOrder.reduce((sum, r) => sum + (weights[r] || 0), 0);
    if (totalWeight > 0 && totalWeight !== 100) {
      for (const r of rarityOrder) {
        weights[r] = (weights[r] || 0) * (100 / totalWeight);
      }
    }
    // Pick rarity based on weights
    let roll = Math.random() * 100;
    let pickedRarity = 'common';
    for (const r of rarityOrder) {
      if (roll < (weights[r] || 0)) {
        pickedRarity = r;
        break;
      }
      roll -= (weights[r] || 0);
    }
    rarity = pickedRarity;

    // Pick a fish of that rarity
    const options = fishTable.filter(f => f.rarity === rarity);
    const fish = options[Math.floor(Math.random() * options.length)];
    let value = fish.value();

    // Check for earnings buffs
    const fishEarningsBuff = (user.buffs || []).find(b => 
      (b.type === 'earnings_x2' || b.type === 'earnings_x3' || b.type === 'earnings_x5') && 
      (!b.expiresAt || b.expiresAt > now)
    );
    if (fishEarningsBuff) {
      const multiplier = fishEarningsBuff.type === 'earnings_x2' ? 2 : 
                        fishEarningsBuff.type === 'earnings_x3' ? 3 : 5;
      value *= multiplier;
      if (buffMessage) buffMessage += '\n';
      buffMessage += `${fishEarningsBuff.type} buff active: ${multiplier}x POINTS!`;
    }

    // Update inventory
    const fishInv = user.inventory || [];
    const existingFish = fishInv.find(item => item.name === fish.name);
    if (existingFish) {
      existingFish.count += 1;
      existingFish.value = (existingFish.value * existingFish.count + value) / (existingFish.count + 1);
    } else {
      fishInv.push({ type: 'fish', name: fish.name, rarity: fish.rarity, value: value, count: 1 });
    }
    user.inventory = fishInv;

    // Handle buff consumption and cooldown
    let cooldownMinutes = Math.floor(Math.random() * 11) + 5;
    
    // Consume no cooldown buff if used
    if (noCooldownBuff) {
      noCooldownBuff.usesLeft--;
      if (noCooldownBuff.usesLeft <= 0) {
        user.buffs = user.buffs.filter(b => b !== noCooldownBuff);
      }
      cooldownMinutes = 0; // No cooldown when buff is used
      if (!buffMessage) buffMessage = '';
      if (buffMessage) buffMessage += '\n';
      buffMessage += `🎯 No Cooldown buff used! (${noCooldownBuff.usesLeft + 1} uses remaining)`;
    }
    
    // Apply frenzy mode (no cooldown)
    if (frenzyBuff) {
      cooldownMinutes = 0;
      if (buffMessage) buffMessage += '\n';
      buffMessage += `⚡ Frenzy Mode active: No cooldown!`;
    }
    
    // Apply time warp (75% cooldown reduction)
    if (timeWarpBuff) {
      cooldownMinutes = Math.floor(cooldownMinutes * 0.25); // 25% of original cooldown
      if (buffMessage) buffMessage += '\n';
      buffMessage += `⏰ Time Warp active: 75% cooldown reduction!`;
    }
    
    user.fishCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await user.save();

    res.json({
      name: fish.name,
      rarity: fish.rarity,
      value,
      count: existingFish ? existingFish.count : 1,
      cooldown: user.fishCooldown,
      buffMessage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during fishing.' });
  }
});

// --- HUNTING ---
router.post('/:discordId/hunt', async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    if (!user.huntCooldown) user.huntCooldown = null;
    
    // Check for no cooldown buffs
    const noCooldownBuff = (user.buffs || []).find(b => b.type === 'hunting_no_cooldown' && b.usesLeft > 0);
    const frenzyBuff = (user.buffs || []).find(b => b.type === 'frenzy_mode' && (!b.expiresAt || b.expiresAt > now));
    const timeWarpBuff = (user.buffs || []).find(b => b.type === 'time_warp' && (!b.expiresAt || b.expiresAt > now));
    
    if (user.huntCooldown && user.huntCooldown > now && !noCooldownBuff && !frenzyBuff) {
      return res.status(429).json({ message: `Hunting is on cooldown. Try again at ${user.huntCooldown.toLocaleString()}`, cooldown: user.huntCooldown });
    }
    // Animal table
    const animalTable = [
      // Common
      { name: 'Rabbit', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Squirrel', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Pigeon', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Hedgehog', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Chipmunk', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Mole', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Toad', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Crow', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Duck', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Quokka', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Field Mouse', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Frog', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Lizard', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Beaver', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Mallard', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Turtle', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Snail', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Rat', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Magpie', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Bat', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Finch', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Newt', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
      { name: 'Shrew', rarity: 'common', value: () => Math.floor(Math.random() * 1000) + 500 },
    
      // Uncommon
      { name: 'Fox', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Raccoon', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Owl', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Skunk', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Coyote', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Badger', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Porcupine', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Weasel', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Hyena', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Falcon', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Woodpecker', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Gopher', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Opossum', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Ferret', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Tasmanian Devil', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Armadillo', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Monitor Lizard', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Snapping Turtle', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Jackrabbit', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Kookaburra', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Pangolin', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Tamarin', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      { name: 'Kinkajou', rarity: 'uncommon', value: () => Math.floor(Math.random() * 2000) + 1500 },
      // Rare
      { name: 'Deer', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Boar', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Hawk', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Lynx', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Puma', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Jackal', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Red Deer', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Horned Owl', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Panther', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Raven', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Parrot', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Ibex', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Wild Goat', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Gazelle', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Meerkat', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Caracal', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Moose', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Elk', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Serval', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Bush Dog', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Secretary Bird', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Maned Wolf', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Golden Jackal', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Musk Ox', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Clouded Leopard', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Bearded Vulture', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Harpy Eagle', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      { name: 'Mountain Lion', rarity: 'rare', value: () => Math.floor(Math.random() * 3000) + 4000 },
      // Epic
      { name: 'Bear', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Dire Wolf', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Thunder Elk', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ice Bear', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Shadow Wolf', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ember Lion', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Iron Boar', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Tempest Owl', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Peacock', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Striped Hyena', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Howler Monkey', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Macaw', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Jaguarundi', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Spectacled Bear', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Narwhal', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Snowy Owl', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Wolverine', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ice Lynx', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Bison', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Iron Stag', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ember Falcon', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Crystal Boar', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Frostfang Lynx', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Lava Panther', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Ironclaw Wolverine', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Tundra Ram', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Solar Macaw', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Shadow Porcupine', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Spirit Vulture', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      { name: 'Celestial Ibex', rarity: 'epic', value: () => Math.floor(Math.random() * 7000) + 8000 },
      // Legendary
      { name: 'White Stag', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Mythic Phoenix', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Griffin', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Celestial Tiger', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Ghost Elk', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Crimson Griffin', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Eternal Lion', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Storm Raven', rarity: 'legendary', value: () => Math.floor(Math.random() * 30000) + 50000 },
      { name: 'Phantom Jaguar', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Divine Stag', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Celestial Bear', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Flamehorn Yak', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Spectral Falcon', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Gilded Stag', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Ember Phoenix', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Mythic Ram', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      { name: 'Frostmane Lion', rarity: 'legendary', value: () => Math.floor(Math.random() * 20000) + 30000 },
      // Mythical
      { name: 'Eclipse Dragon', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Spirit of the Forest', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Cosmic Thunderbird', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Void Stag', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Phoenix Lynx', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Cosmic Chimera', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Aether Drake', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Forest Sentinel', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Odins Raven', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Crystal Elk', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Lunar Fox', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Arcane Owlbear', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Forest Djinn', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Celestial Wolf', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Titan Boar', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Oblivion Wolf', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Runeblade Stag', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Soulfeather Roc', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Chrono Panther', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      { name: 'Twilight Chimera', rarity: 'mythical', value: () => Math.floor(Math.random() * 100000) + 100000 },
      // Transcendent
      { name: 'Platypus', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Dimensional Alpaca', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'The One Who Hunts', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Spirit of Gaia', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Primal Harmony', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'T-Rex', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Hammy the Hamster', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Yuri Lothbrok', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Mycelium Moose', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Chronobeast', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Cosmic Rhino', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Galactic Elephant', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Interdimensional Capybara', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'The Final Squirrel', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Fractal Pegasus', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Hamstergod Supreme', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Reztard', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },
      { name: 'Yaki the Gecko', rarity: 'transcendent', value: () => Math.floor(Math.random() * 2000000) + 3000000 },

      // OG
      { name: 'Wyrmlord Daph', rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
      { name: 'Blau the Voidwatcher', rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
      { name: 'Chronohedgehog Nodlehs', rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
      { name: 'Crime-Time Rifa', rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
      { name: 'Vourbs Vulture', rarity: 'og', value: () => Math.floor(Math.random() * 5000000) + 5000000 },
    ];
    
    // Rarity weights
    const rarityRoll = Math.random();
    let rarity = 'common';
    
    // Check for guaranteed legendary/epic buffs first
    const guaranteedBuff = (user.buffs || []).find(b => 
      (b.type === 'hunting_rare' || b.type === 'hunting_epic') && 
      b.usesLeft > 0
    );

    let buffMessage = '';

    // Check for drop rate buffs
    const rateBuff = (user.buffs || []).find(b => 
      (b.type === 'hunting_rate_1.5x' || b.type === 'hunting_rate_2x' || b.type === 'hunting_rate_3x') && 
      (!b.expiresAt || b.expiresAt > now)
    );

    // Multiplier for rate buffs
    let rateMultiplier = 1;
    let rateBuffType = null;
    if (rateBuff) {
      rateBuffType = rateBuff.type;
      rateMultiplier = {
        'hunting_rate_1.5x': 1.5,
        'hunting_rate_2x': 2,
        'hunting_rate_3x': 3
      }[rateBuff.type] || 1;
      buffMessage += `${rateBuff.type} buff active: Epic+ drop rates multiplied by ${rateMultiplier}x!`;
    }

    // Calculate rarity weights based on buffs
    let weights = { ...baseWeights };
    if (guaranteedBuff) {
      // Guaranteed Rare or Epic logic
      if (guaranteedBuff.type === 'hunting_rare') {
        // Only rare, epic, legendary, mythical, transcendent, og possible
        // If rate buff, multiply mythical+ and assign remainder to legendary
        const baseRare = baseWeights.rare;
        const baseEpic = baseWeights.epic;
        const baseLegendary = baseWeights.legendary;
        const baseMythical = baseWeights.mythical;
        const baseTranscendent = baseWeights.transcendent;
        const baseOg = baseWeights.og;
        const epicPlusBase = baseEpic + baseLegendary + baseMythical + baseTranscendent + baseOg;
        let epicPlus = epicPlusBase * rateMultiplier;
        if (epicPlus > 100) epicPlus = 100;
        let rare = baseRare + (epicPlusBase - epicPlus);
        if (rare < 0) rare = 0;
        // Distribute rare/epic/legendary/mythical/transcendent/og in original ratio
        let epic = 0, legendary = 0, mythical = 0, transcendent = 0, og = 0;
        if (epicPlus > 0) {
          epic = (baseEpic / epicPlusBase) * epicPlus;
          legendary = (baseLegendary / epicPlusBase) * epicPlus;
          mythical = (baseMythical / epicPlusBase) * epicPlus;
          transcendent = (baseTranscendent / epicPlusBase) * epicPlus;
          og = (baseOg / epicPlusBase) * epicPlus;
        }
        weights = {
          og,
          transcendent,
          mythical,
          legendary,
          epic,
          rare,
          uncommon: 0,
          common: 0
        };
      } else if (guaranteedBuff.type === 'hunting_epic') {
        // Only epic, legendary, mythical, transcendent, og possible
        // If rate buff, multiply legendary+ and assign remainder to epic
        const baseEpic = baseWeights.epic;
        const baseLegendary = baseWeights.legendary;
        const baseMythical = baseWeights.mythical;
        const baseTranscendent = baseWeights.transcendent;
        const baseOg = baseWeights.og;
        const legendaryPlusBase = baseLegendary + baseMythical + baseTranscendent + baseOg;
        let legendaryPlus = legendaryPlusBase * rateMultiplier;
        if (legendaryPlus > 100) legendaryPlus = 100;
        let epic = baseEpic + (legendaryPlusBase - legendaryPlus);
        if (epic < 0) epic = 0;
        // Distribute legendary/mythical/transcendent/og in original ratio
        let legendary = 0, mythical = 0, transcendent = 0, og = 0;
        if (legendaryPlus > 0) {
          legendary = (baseLegendary / legendaryPlusBase) * legendaryPlus;
          mythical = (baseMythical / legendaryPlusBase) * legendaryPlus;
          transcendent = (baseTranscendent / legendaryPlusBase) * legendaryPlus;
          og = (baseOg / legendaryPlusBase) * legendaryPlus;
        }
        weights = {
          og,
          transcendent,
          mythical,
          legendary,
          epic,
          rare: 0,
          uncommon: 0,
          common: 0
        };
      }
      // Decrement uses
      guaranteedBuff.usesLeft--;
      if (guaranteedBuff.usesLeft <= 0) {
        user.buffs = user.buffs.filter(b => b !== guaranteedBuff);
      }
      if (buffMessage) buffMessage += '\n';
      buffMessage += `${guaranteedBuff.type} buff used: Guaranteed ${guaranteedBuff.type === 'hunting_rare' ? 'Rare' : 'Epic'} or better!`;
    } else if (rateBuff) {
      // Only rate buff, no guaranteed buff
      // Multiply epic+ by rateMultiplier, distribute rest among rare/uncommon/common
      const baseEpic = baseWeights.epic;
      const baseLegendary = baseWeights.legendary;
      const baseMythical = baseWeights.mythical;
      const baseTranscendent = baseWeights.transcendent;
      const baseOg = baseWeights.og;
      const epicPlusBase = baseEpic + baseLegendary + baseMythical + baseTranscendent + baseOg;
      let epicPlus = epicPlusBase * rateMultiplier;
      if (epicPlus > 100) epicPlus = 100;
      // Distribute epic/legendary/mythical/transcendent/og in original ratio
      let epic = 0, legendary = 0, mythical = 0, transcendent = 0, og = 0;
      if (epicPlus > 0) {
        epic = (baseEpic / epicPlusBase) * epicPlus;
        legendary = (baseLegendary / epicPlusBase) * epicPlus;
        mythical = (baseMythical / epicPlusBase) * epicPlus;
        transcendent = (baseTranscendent / epicPlusBase) * epicPlus;
        og = (baseOg / epicPlusBase) * epicPlus;
      }
      // Remaining %
      let remaining = 100 - epicPlus;
      const baseLower = baseWeights.rare + baseWeights.uncommon + baseWeights.common;
      let rare = 0, uncommon = 0, common = 0;
      if (remaining > 0 && baseLower > 0) {
        rare = (baseWeights.rare / baseLower) * remaining;
        uncommon = (baseWeights.uncommon / baseLower) * remaining;
        common = (baseWeights.common / baseLower) * remaining;
      }
      weights = {
        og,
        transcendent,
        mythical,
        legendary,
        epic,
        rare,
        uncommon,
        common
      };
    }
    // Normalize weights to sum to 100
    const totalWeight = rarityOrder.reduce((sum, r) => sum + (weights[r] || 0), 0);
    if (totalWeight > 0 && totalWeight !== 100) {
      for (const r of rarityOrder) {
        weights[r] = (weights[r] || 0) * (100 / totalWeight);
      }
    }
    // Pick rarity based on weights
    roll = Math.random() * 100;
    pickedRarity = 'common';
    for (const r of rarityOrder) {
      if (roll < (weights[r] || 0)) {
        pickedRarity = r;
        break;
      }
      roll -= (weights[r] || 0);
    }
    rarity = pickedRarity;

    // Pick an animal of that rarity
    const options = animalTable.filter(a => a.rarity === rarity);
    const animal = options[Math.floor(Math.random() * options.length)];
    let value = animal.value();

    // Check for earnings buffs
    const huntEarningsBuff = (user.buffs || []).find(b => 
      (b.type === 'earnings_x2' || b.type === 'earnings_x3' || b.type === 'earnings_x5') && 
      (!b.expiresAt || b.expiresAt > now)
    );
    if (huntEarningsBuff) {
      const multiplier = huntEarningsBuff.type === 'earnings_x2' ? 2 : 
                        huntEarningsBuff.type === 'earnings_x3' ? 3 : 5;
      value *= multiplier;
      if (buffMessage) buffMessage += '\n';
      buffMessage += `${huntEarningsBuff.type} buff active: ${multiplier}x POINTS!`;
    }

    // Update inventory
    const huntInv = user.inventory || [];
    const existingAnimal = huntInv.find(item => item.name === animal.name);
    if (existingAnimal) {
      existingAnimal.count += 1;
      existingAnimal.value = (existingAnimal.value * existingAnimal.count + value) / (existingAnimal.count + 1);
    } else {
      huntInv.push({ type: 'animal', name: animal.name, rarity: animal.rarity, value: value, count: 1 });
    }
    user.inventory = huntInv;

    // Handle buff consumption and cooldown
    let cooldownMinutes = Math.floor(Math.random() * 11) + 5;

    // Consume no cooldown buff if used
    if (noCooldownBuff) {
      noCooldownBuff.usesLeft--;
      if (noCooldownBuff.usesLeft <= 0) {
        user.buffs = user.buffs.filter(b => b !== noCooldownBuff);
      }
      cooldownMinutes = 0; // No cooldown when buff is used
      if (!buffMessage) buffMessage = '';
      if (buffMessage) buffMessage += '\n';
      buffMessage += `🎯 No Cooldown buff used! (${noCooldownBuff.usesLeft + 1} uses remaining)`;
    }
    
    // Apply frenzy mode (no cooldown)
    if (frenzyBuff) {
      cooldownMinutes = 0;
      if (buffMessage) buffMessage += '\n';
      buffMessage += `⚡ Frenzy Mode active: No cooldown!`;
    }
    
    // Apply time warp (75% cooldown reduction)
    if (timeWarpBuff) {
      cooldownMinutes = Math.floor(cooldownMinutes * 0.25); // 25% of original cooldown
      if (buffMessage) buffMessage += '\n';
      buffMessage += `⏰ Time Warp active: 75% cooldown reduction!`;
    }
    
    user.huntCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await user.save();

    res.json({
      name: animal.name,
      rarity: animal.rarity,
      value,
      count: existingAnimal ? existingAnimal.count : 1,
      cooldown: user.huntCooldown,
      buffMessage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during hunting.' });
  }
});

// --- COLLECTION ---
router.get('/:discordId/collection', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    await user.save();
    res.json({ inventory: user.inventory || [] });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching collection.' });
  }
});

// --- COOLDOWN RESET ---
router.post('/:discordId/reset-cooldowns', async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    
    // Check for cooldown reset buff
    const cooldownResetBuff = (user.buffs || []).find(b => b.type === 'cooldown_reset' && b.usesLeft > 0);
    
    if (!cooldownResetBuff) {
      return res.status(400).json({ message: 'You need a Cooldown Reset buff to use this command.' });
    }
    
    // Reset all cooldowns
    user.fishCooldown = null;
    user.huntCooldown = null;
    user.workCooldown = null;
    user.begCooldown = null;
    user.crimeCooldown = null;
    user.stealPointsCooldown = null;
    user.stealFishCooldown = null;
    user.stealAnimalCooldown = null;
    user.stealItemCooldown = null;
    
    // Consume the buff
    cooldownResetBuff.usesLeft--;
    if (cooldownResetBuff.usesLeft <= 0) {
      user.buffs = user.buffs.filter(b => b !== cooldownResetBuff);
    }
    
    await user.save();
    
    res.json({ 
      message: 'All cooldowns have been reset!',
      buffsRemaining: user.buffs.filter(b => b.type === 'cooldown_reset').length,
      buffMessage: '🔄 Cooldown Reset buff used!'
    });
  } catch (error) {
    console.error('Error resetting cooldowns:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- SELL INVENTORY ITEM ---
router.post('/:discordId/sell', async (req, res) => {
  function filterOutGoldenTickets(items) {
    return items.filter(i => !(i.type === 'item' && i.name === 'Golden Ticket'));
  }
  try {
    const user = req.user;
    const wallet = req.wallet;
    const { items, type, name, count, action, confirmation } = req.body;

    // Handle new action-based selling
    if (action) {
      let itemsToSell = [];
      let totalValue = 0;

      // Determine what to sell based on action
      switch (action) {
        case 'specific':
          if (!type || !name || !count) {
            return res.status(400).json({ message: 'For specific items, you must provide type, name, and count.' });
          }
          if (type === 'item' && name === 'Golden Ticket') {
            return res.status(400).json({ message: 'Golden Tickets cannot be sold.' });
          }
          const item = (user.inventory || []).find(i => i.type === type && i.name === name);
          if (!item) {
            return res.status(404).json({ message: 'Item not found in inventory.' });
          }
          if (item.count < count) {
            return res.status(400).json({ message: `You only have ${item.count} of this item.` });
          }
          itemsToSell = [{ type, name, count, value: item.value }];
          totalValue = item.value * count;
          break;

        case 'all_fish':
          const fishItems = (user.inventory || []).filter(i => i.type === 'fish');
          itemsToSell = filterOutGoldenTickets(fishItems).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemsToSell.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_animals':
          const animalItems = (user.inventory || []).filter(i => i.type === 'animal');
          itemsToSell = filterOutGoldenTickets(animalItems).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemsToSell.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_items':
          const itemItems = (user.inventory || []).filter(i => i.type === 'item');
          itemsToSell = filterOutGoldenTickets(itemItems).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemsToSell.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_common':
          const commonItems = (user.inventory || []).filter(i => i.rarity === 'common');
          itemsToSell = filterOutGoldenTickets(commonItems).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemsToSell.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_uncommon':
          const uncommonItems = (user.inventory || []).filter(i => i.rarity === 'uncommon');
          itemsToSell = filterOutGoldenTickets(uncommonItems).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemsToSell.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_rare_plus':
          const rarePlusItems = (user.inventory || []).filter(i =>
            ['rare', 'epic', 'legendary', 'mythical', 'transcendent', 'og'].includes(i.rarity)
          );
          itemsToSell = filterOutGoldenTickets(rarePlusItems).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemsToSell.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'everything':
          const everythingItems = (user.inventory || []);
          itemsToSell = filterOutGoldenTickets(everythingItems).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemsToSell.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'duplicates':
          const duplicateItems = (user.inventory || []).filter(i => i.count > 1);
          itemsToSell = filterOutGoldenTickets(duplicateItems).map(item => ({ type: item.type, name: item.name, count: item.count - 1, value: item.value }));
          totalValue = itemsToSell.reduce((sum, item) => sum + (item.value * (item.count - 1)), 0);
          break;

        default:
          return res.status(400).json({ message: 'Invalid action specified.' });
      }

      if (itemsToSell.length === 0) {
        return res.status(404).json({ message: `No items found to sell for action: ${action}` });
      }

      // Check if this is a preview request (no confirmation provided)
      if (!confirmation) {
        // Check if any high-value items are being sold
        const highValueItems = itemsToSell.filter(item => item.value * item.count >= 10000); // 10k+ points
        const requiresConfirmation = highValueItems.length > 0 || totalValue >= 50000; // 50k+ total value

        return res.json({
          itemsToSell,
          totalValue,
          requiresConfirmation,
          action
        });
      }

      // Process the actual sale (confirmation provided)
      let actualValue = 0;
      const results = [];

      for (const itemReq of itemsToSell) {
        const { type: typeSell, name: nameSell, count: countSell } = itemReq;

        // Find item in inventory
        const idxSell = (user.inventory || []).findIndex(i => i.type === typeSell && i.name === nameSell);
        if (idxSell === -1) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: 'Item not found in inventory.', success: false });
          continue;
        }

        const itemSell = user.inventory[idxSell];
        if (itemSell.count < countSell) {
          results.push({ type: typeSell, name: nameSell, count: countSell, error: `You only have ${itemSell.count} of this item.`, success: false });
          continue;
        }

        // Calculate value and process sale
        const valueSell = itemSell.value * countSell;
        itemSell.count -= countSell;

        if (itemSell.count === 0) {
          user.inventory.splice(idxSell, 1);
        } else {
          user.inventory[idxSell] = itemSell;
        }

        wallet.balance += valueSell;
        actualValue += valueSell;

        results.push({ type: typeSell, name: nameSell, count: countSell, value: valueSell, success: true });

        // Record transaction for each item
        const transactionSell = new Transaction({
          user: user._id,
          type: 'sell',
          amount: valueSell,
          description: `Sold ${countSell}x ${itemSell.name} (${itemSell.rarity})`,
          guildId: req.guildId
        });
        await transactionSell.save();
      }

      await user.save();
      await wallet.save();

      return res.json({
        results,
        newBalance: wallet.balance,
        totalValue: actualValue,
        soldItems: results.filter(r => r.success).map(r => ({ name: r.name, count: r.count })),
        action: action
      });
    }

    // ... (rest of your legacy logic)
  } catch (error) {
    console.error('Error selling inventory item:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- SELL PREVIEW (NEW) ---
router.post('/:discordId/sell-preview', async (req, res) => {
  function filterOutGoldenTickets(items) {
    return items.filter(i => !(i.type === 'item' && i.name === 'Golden Ticket'));
  }
  try {
    const user = req.user;
    const { items, action, type, name, count } = req.body;
    
    let itemsToPreview = [];
    let totalValue = 0;
    let actionDescription = '';

    // Determine what to preview based on action
    switch (action) {
      case 'specific':
        if (!type || !name || !count) {
          return res.status(400).json({ message: 'For specific items, you must provide type, name, and count.' });
        }
        if (type === 'item' && name === 'Golden Ticket') {
          return res.status(400).json({ message: 'Golden Tickets cannot be sold.' });
        }
        const item = (user.inventory || []).find(i => i.type === type && i.name === name);
        if (!item) {
          return res.status(404).json({ message: 'Item not found in inventory.' });
        }
        if (item.count < count) {
          return res.status(400).json({ message: `You only have ${item.count} of this item.` });
        }
        itemsToPreview = [{ type, name, count, value: item.value }];
        itemsToPreview = filterOutGoldenTickets(itemsToPreview);
        totalValue = item.value * count;
        actionDescription = `Selling specific item: ${name}`;
        break;
    
      case 'all_fish':
        const fishItems = filterOutGoldenTickets((user.inventory || []).filter(i => i.type === 'fish'));
        itemsToPreview = fishItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = fishItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all fish (${fishItems.length} types)`;
        break;
    
      case 'all_animals':
        const animalItems = filterOutGoldenTickets((user.inventory || []).filter(i => i.type === 'animal'));
        itemsToPreview = animalItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = animalItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all animals (${animalItems.length} types)`;
        break;
    
      case 'all_items':
        const itemItems = filterOutGoldenTickets((user.inventory || []).filter(i => i.type === 'item'));
        itemsToPreview = itemItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = itemItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all items (${itemItems.length} types)`;
        break;
    
      case 'all_common':
        const commonItems = filterOutGoldenTickets((user.inventory || []).filter(i => i.rarity === 'common'));
        itemsToPreview = commonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = commonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all common items (${commonItems.length} types)`;
        break;
    
      case 'all_uncommon':
        const uncommonItems = filterOutGoldenTickets((user.inventory || []).filter(i => i.rarity === 'uncommon'));
        itemsToPreview = uncommonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = uncommonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all uncommon items (${uncommonItems.length} types)`;
        break;
    
      case 'all_rare_plus':
        const rarePlusItems = filterOutGoldenTickets((user.inventory || []).filter(i => 
          ['rare', 'epic', 'legendary', 'mythical', 'transcendent', 'og'].includes(i.rarity)
        ));
        itemsToPreview = rarePlusItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = rarePlusItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling all rare+ items (${rarePlusItems.length} types)`;
        break;
    
      case 'everything':
        const everythingItems = filterOutGoldenTickets((user.inventory || []));
        itemsToPreview = everythingItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = everythingItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Selling everything (${everythingItems.length} types)`;
        break;
    
      case 'duplicates':
        const duplicateItems = filterOutGoldenTickets((user.inventory || []).filter(i => i.count > 1));
        itemsToPreview = duplicateItems.map(item => ({ type: item.type, name: item.name, count: item.count - 1, value: item.value }));
        totalValue = duplicateItems.reduce((sum, item) => sum + (item.value * (item.count - 1)), 0);
        actionDescription = `Selling all duplicates (keeping one of each, ${duplicateItems.length} types)`;
        break;
    
      default:
        return res.status(400).json({ message: 'Invalid action specified.' });
    }

    if (itemsToPreview.length === 0) {
      return res.status(404).json({ message: `No items found to sell for action: ${action}` });
    }

    // Check for high-value items
    const highValueItems = itemsToPreview.filter(item => {
      const inventoryItem = (user.inventory || []).find(i => i.type === item.type && i.name === item.name);
      return inventoryItem && (inventoryItem.rarity === 'legendary' || inventoryItem.rarity === 'mythical' || inventoryItem.rarity === 'transcendent' || inventoryItem.rarity === 'og');
    });

    const needsConfirmation = totalValue > 10000 || highValueItems.length > 0 || itemsToPreview.length > 10;

    res.json({
      actionDescription,
      itemsToPreview,
      totalValue,
      totalItems: itemsToPreview.reduce((sum, item) => sum + item.count, 0),
      highValueItems: highValueItems.slice(0, 10), // Limit to first 10
      needsConfirmation,
      preview: true
    });

  } catch (error) {
    console.error('Error in sell preview:', error);
    res.status(500).json({ message: 'Server error during sell preview.' });
  }
});

// --- COLLECTION LEADERBOARD ---
router.get('/collection-leaderboard', requireGuildId, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const users = await User.find({ guildId: req.guildId });
    // Calculate total collection value for each user
    const leaderboard = users.map(u => {
      const totalValue = (u.inventory || []).reduce((sum, i) => sum + (i.value * i.count), 0);
      return {
        discordId: u.discordId,
        username: u.username,
        totalValue,
        itemCount: (u.inventory || []).reduce((sum, i) => sum + i.count, 0)
      };
    }).sort((a, b) => b.totalValue - a.totalValue).slice(0, limit);
    res.json({ data: leaderboard });
  } catch (error) {
    console.error('Error fetching collection leaderboard:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- TRADE INVENTORY ITEM ---
router.post('/:discordId/trade', async (req, res) => {
  try {
    const sender = req.user;
    const { targetDiscordId, items, type, name, count, action, confirmation } = req.body;
    if (!targetDiscordId) {
      return res.status(400).json({ message: 'Invalid trade request: missing target.' });
    }
    if (targetDiscordId === sender.discordId) {
      return res.status(400).json({ message: 'Cannot trade with yourself.' });
    }
    const receiver = await User.findOne({ discordId: targetDiscordId, guildId: req.guildId });
    if (!receiver) return res.status(404).json({ message: 'Target user not found.' });

    // Handle new action-based trading
    if (action) {
      let itemsToTrade = [];
      let totalValue = 0;

      // Determine what to trade based on action
      switch (action) {
        case 'specific':
          if (!type || !name || !count) {
            return res.status(400).json({ message: 'For specific items, you must provide type, name, and count.' });
          }
          
          const item = (sender.inventory || []).find(i => i.type === type && i.name === name);
          if (!item) {
            return res.status(404).json({ message: 'Item not found in your inventory.' });
          }
          if (item.count < count) {
            return res.status(400).json({ message: `You only have ${item.count} of this item.` });
          }
          itemsToTrade = [{ type, name, count, value: item.value }];
          totalValue = item.value * count;
          break;

        case 'all_fish':
          const fishItems = (sender.inventory || []).filter(i => i.type === 'fish');
          itemsToTrade = fishItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = fishItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_animals':
          const animalItems = (sender.inventory || []).filter(i => i.type === 'animal');
          itemsToTrade = animalItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = animalItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_items':
          const itemItems = (sender.inventory || []).filter(i => i.type === 'item');
          itemsToTrade = itemItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = itemItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_common':
          const commonItems = (sender.inventory || []).filter(i => i.rarity === 'common');
          itemsToTrade = commonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = commonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_uncommon':
          const uncommonItems = (sender.inventory || []).filter(i => i.rarity === 'uncommon');
          itemsToTrade = uncommonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = uncommonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'all_rare_plus':
          const rarePlusItems = (sender.inventory || []).filter(i => 
            ['rare', 'epic', 'legendary', 'mythical', 'transcendent', 'og'].includes(i.rarity)
          );
          itemsToTrade = rarePlusItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = rarePlusItems.reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'everything':
          itemsToTrade = (sender.inventory || []).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
          totalValue = (sender.inventory || []).reduce((sum, item) => sum + (item.value * item.count), 0);
          break;

        case 'duplicates':
          const duplicateItems = (sender.inventory || []).filter(i => i.count > 1);
          itemsToTrade = duplicateItems.map(item => ({ type: item.type, name: item.name, count: item.count - 1, value: item.value }));
          totalValue = duplicateItems.reduce((sum, item) => sum + (item.value * (item.count - 1)), 0);
          break;

        default:
          return res.status(400).json({ message: 'Invalid action specified.' });
      }

      if (itemsToTrade.length === 0) {
        return res.status(404).json({ message: `No items found to trade for action: ${action}` });
      }

      // Check if this is a preview request (no confirmation provided)
      if (!confirmation) {
        // Check if any high-value items are being traded
        const highValueItems = itemsToTrade.filter(item => item.value * item.count >= 10000); // 10k+ points
        const requiresConfirmation = highValueItems.length > 0 || totalValue >= 50000; // 50k+ total value

        return res.json({
          itemsToTrade,
          totalValue,
          requiresConfirmation,
          action
        });
      }

      // Process the actual trade (confirmation provided)
      const results = [];
      
      for (const itemReq of itemsToTrade) {
        const { type: typeTrade, name: nameTrade, count: countTrade } = itemReq;
        
        // Find item in sender inventory
        const idx = (sender.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (idx === -1) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: 'Item not found in your inventory.', success: false });
          continue;
        }
        
        const itemTrade = sender.inventory[idx];
        if (itemTrade.count < countTrade) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: `You only have ${itemTrade.count} of this item.`, success: false });
          continue;
        }
        
        // Store original item properties before mutating
        const itemToTransfer = {
          type: itemTrade.type,
          name: itemTrade.name,
          rarity: itemTrade.rarity,
          value: itemTrade.value,
          count: countTrade
        };
        
        // Remove from sender
        itemTrade.count -= countTrade;
        if (itemTrade.count === 0) {
          sender.inventory.splice(idx, 1);
        } else {
          sender.inventory[idx] = itemTrade;
        }
        
        // Add to receiver
        const rIdx = (receiver.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (rIdx === -1) {
          receiver.inventory.push(itemToTransfer);
        } else {
          // Recalculate average value for receiver
          const receiverItem = receiver.inventory[rIdx];
          const totalValue = (receiverItem.value * receiverItem.count) + (itemToTransfer.value * countTrade);
          receiverItem.count += countTrade;
          receiverItem.value = totalValue / receiverItem.count;
          receiver.inventory[rIdx] = receiverItem;
        }
        
        results.push({ type: typeTrade, name: nameTrade, count: countTrade, success: true });
        
        // Record transaction for sender
        const transaction = new Transaction({
          user: sender._id,
          type: 'trade_sent',
          amount: 0,
          description: `Traded ${countTrade}x ${itemTrade.name} to ${targetDiscordId}`,
          guildId: req.guildId
        });
        await transaction.save();
        
        // Record transaction for receiver
        const transaction2 = new Transaction({
          user: receiver._id,
          type: 'trade_received',
          amount: 0,
          description: `Received ${countTrade}x ${itemTrade.name} from ${sender.discordId}`,
          guildId: req.guildId
        });
        await transaction2.save();
      }
      
      await sender.save();
      await receiver.save();
      
      return res.json({ 
        results, 
        tradedItems: results.filter(r => r.success).map(r => ({ name: r.name, count: r.count })),
        message: `<@${sender.discordId}> successfully traded ${results.filter(r => r.success).length} items to <@${targetDiscordId}>.`,
        action: action
      });
    }

    // --- EXISTING BULK TRADE LOGIC (for backward compatibility) ---
    if (Array.isArray(items) && items.length > 0) {
      const results = [];
      
      for (const itemReq of items) {
        const { type: typeTrade, name: nameTrade, count: countTrade } = itemReq;
        
        // Find item in sender inventory
        const idx = (sender.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (idx === -1) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: 'Item not found in your inventory.', success: false });
          continue;
        }
        
        const itemTrade = sender.inventory[idx];
        if (itemTrade.count < countTrade) {
          results.push({ type: typeTrade, name: nameTrade, count: countTrade, error: `You only have ${itemTrade.count} of this item.`, success: false });
          continue;
        }
        
        // Store original item properties before mutating
        const itemToTransfer = {
          type: itemTrade.type,
          name: itemTrade.name,
          rarity: itemTrade.rarity,
          value: itemTrade.value,
          count: countTrade
        };
        
        // Remove from sender
        itemTrade.count -= countTrade;
        if (itemTrade.count === 0) {
          sender.inventory.splice(idx, 1);
        } else {
          sender.inventory[idx] = itemTrade;
        }
        
        // Add to receiver
        const rIdx = (receiver.inventory || []).findIndex(i => i.type === typeTrade && i.name === nameTrade);
        if (rIdx === -1) {
          receiver.inventory.push(itemToTransfer);
        } else {
          // Recalculate average value for receiver
          const receiverItem = receiver.inventory[rIdx];
          const totalValue = (receiverItem.value * receiverItem.count) + (itemToTransfer.value * countTrade);
          receiverItem.count += countTrade;
          receiverItem.value = totalValue / receiverItem.count;
          receiver.inventory[rIdx] = receiverItem;
        }
        
        results.push({ type: typeTrade, name: nameTrade, count: countTrade, success: true });
        
        // Record transaction for sender
        const transaction = new Transaction({
          user: sender._id,
          type: 'trade_sent',
          amount: 0,
          description: `Traded ${countTrade}x ${itemTrade.name} to ${targetDiscordId}`,
          guildId: req.guildId
        });
        await transaction.save();
        
        // Record transaction for receiver
        const transaction2 = new Transaction({
          user: receiver._id,
          type: 'trade_received',
          amount: 0,
          description: `Received ${countTrade}x ${itemTrade.name} from ${sender.discordId}`,
          guildId: req.guildId
        });
        await transaction2.save();
      }
      
      await sender.save();
      await receiver.save();
      
      return res.json({ results });
    }

    // --- EXISTING SINGLE ITEM LOGIC (for backward compatibility) ---
    if (!type || !name || !count || count < 1) {
      return res.status(400).json({ message: 'Invalid trade request.' });
    }
    if (targetDiscordId === sender.discordId) {
      return res.status(400).json({ message: 'Cannot trade with yourself.' });
    }
    // Find item in sender inventory
    const idx = (sender.inventory || []).findIndex(i => i.type === type && i.name === name);
    if (idx === -1) {
      return res.status(404).json({ message: 'Item not found in your inventory.' });
    }
    const item = sender.inventory[idx];
    if (item.count < count) {
      return res.status(400).json({ message: `You only have ${item.count} of this item.` });
    }
    // Store original item properties before mutating
    const itemToTransfer = {
      type: item.type,
      name: item.name,
      rarity: item.rarity,
      value: item.value,
      count: count
    };
    // Remove from sender
    item.count -= count;
    if (item.count === 0) {
      sender.inventory.splice(idx, 1);
    } else {
      sender.inventory[idx] = item;
    }
    // Add to receiver
    const rIdx = (receiver.inventory || []).findIndex(i => i.type === type && i.name === name);
    if (rIdx === -1) {
      receiver.inventory.push(itemToTransfer);
    } else {
      // Recalculate average value for receiver
      const receiverItem = receiver.inventory[rIdx];
      const totalValue = (receiverItem.value * receiverItem.count) + (itemToTransfer.value * count);
      receiverItem.count += count;
      receiverItem.value = totalValue / receiverItem.count;
      receiver.inventory[rIdx] = receiverItem;
    }
    await sender.save();
    await receiver.save();
    // Record transaction for sender
    const transaction = new Transaction({
      user: sender._id,
      type: 'trade_sent',
      amount: 0,
      description: `Traded ${count}x ${item.name} to ${targetDiscordId}`,
      guildId: req.guildId
    });
    await transaction.save();
    // Record transaction for receiver
    const transaction2 = new Transaction({
      user: receiver._id,
      type: 'trade_received',
      amount: 0,
      description: `Received ${count}x ${item.name} from ${sender.discordId}`,
      guildId: req.guildId
    });
    await transaction2.save();

    res.json({ message: `Traded ${count}x ${item.name} to <@${targetDiscordId}>.` });
  } catch (error) {
    console.error('Error trading inventory item:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- TRADE PREVIEW (NEW) ---
router.post('/:discordId/trade-preview', async (req, res) => {
  try {
    const sender = req.user;
    const { targetDiscordId, items, action, type, name, count } = req.body;
    
    if (!targetDiscordId) {
      return res.status(400).json({ message: 'Invalid trade request: missing target.' });
    }
    if (targetDiscordId === sender.discordId) {
      return res.status(400).json({ message: 'Cannot trade with yourself.' });
    }
    const receiver = await User.findOne({ discordId: targetDiscordId, guildId: req.guildId });
    if (!receiver) return res.status(404).json({ message: 'Target user not found.' });
    
    let itemsToPreview = [];
    let totalValue = 0;
    let actionDescription = '';

    // Determine what to preview based on action
    switch (action) {
      case 'specific':
        if (!type || !name || !count) {
          return res.status(400).json({ message: 'For specific items, you must provide type, name, and count.' });
        }
        
        const item = (sender.inventory || []).find(i => i.type === type && i.name === name);
        if (!item) {
          return res.status(404).json({ message: 'Item not found in your inventory.' });
        }
        if (item.count < count) {
          return res.status(400).json({ message: `You only have ${item.count} of this item.` });
        }
        itemsToPreview = [{ type, name, count, value: item.value }];
        totalValue = item.value * count;
        actionDescription = `Trading specific item: ${name} to <@${targetDiscordId}>`;
        break;

      case 'all_fish':
        const fishItems = (sender.inventory || []).filter(i => i.type === 'fish');
        itemsToPreview = fishItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = fishItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all fish (${fishItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_animals':
        const animalItems = (sender.inventory || []).filter(i => i.type === 'animal');
        itemsToPreview = animalItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = animalItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all animals (${animalItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_items':
        const itemItems = (sender.inventory || []).filter(i => i.type === 'item');
        itemsToPreview = itemItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = itemItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all items (${itemItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_common':
        const commonItems = (sender.inventory || []).filter(i => i.rarity === 'common');
        itemsToPreview = commonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = commonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all common items (${commonItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_uncommon':
        const uncommonItems = (sender.inventory || []).filter(i => i.rarity === 'uncommon');
        itemsToPreview = uncommonItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = uncommonItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all uncommon items (${uncommonItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'all_rare_plus':
        const rarePlusItems = (sender.inventory || []).filter(i => 
          ['rare', 'epic', 'legendary', 'mythical', 'transcendent', 'og'].includes(i.rarity)
        );
        itemsToPreview = rarePlusItems.map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = rarePlusItems.reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading all rare+ items (${rarePlusItems.length} types) to <@${targetDiscordId}>`;
        break;

      case 'everything':
        itemsToPreview = (sender.inventory || []).map(item => ({ type: item.type, name: item.name, count: item.count, value: item.value }));
        totalValue = (sender.inventory || []).reduce((sum, item) => sum + (item.value * item.count), 0);
        actionDescription = `Trading everything (${sender.inventory?.length || 0} types) to <@${targetDiscordId}>`;
        break;

      default:
        return res.status(400).json({ message: 'Invalid action specified.' });
    }

    if (itemsToPreview.length === 0) {
      return res.status(404).json({ message: `No items found to trade for action: ${action}` });
    }

    // Check for high-value items
    const highValueItems = itemsToPreview.filter(item => {
      const inventoryItem = (sender.inventory || []).find(i => i.type === item.type && i.name === item.name);
      return inventoryItem && (inventoryItem.rarity === 'legendary' || inventoryItem.rarity === 'mythical' || inventoryItem.rarity === 'transcendent' || inventoryItem.rarity === 'og');
    });

    const needsConfirmation = totalValue > 10000 || highValueItems.length > 0 || itemsToPreview.length > 10;

    res.json({
      actionDescription,
      itemsToPreview,
      totalValue,
      totalItems: itemsToPreview.reduce((sum, item) => sum + item.count, 0),
      highValueItems: highValueItems.slice(0, 10), // Limit to first 10
      needsConfirmation,
      preview: true
    });

  } catch (error) {
    console.error('Error in trade preview:', error);
    res.status(500).json({ message: 'Server error during trade preview.' });
  }
});

// --- DUEL: Initiate a duel ---
router.post('/:discordId/duel', async (req, res) => {
  try {
    const challenger = req.user;
    const { opponentDiscordId, amount } = req.body;
    if (!opponentDiscordId || !amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid duel request.' });
    }
    if (opponentDiscordId === challenger.discordId) {
      return res.status(400).json({ message: 'Cannot duel yourself.' });
    }
    // Cooldown: 5-10 min per user
    const now = new Date();
    if (challenger.duelCooldown && challenger.duelCooldown > now) {
      return res.status(429).json({ message: `You are on duel cooldown. Try again at ${challenger.duelCooldown.toLocaleString()}` });
    }
    const opponent = await User.findOne({ discordId: opponentDiscordId, guildId: req.guildId });
    if (!opponent) return res.status(404).json({ message: 'Opponent not found.' });
    if (opponent.duelCooldown && opponent.duelCooldown > now) {
      return res.status(429).json({ message: 'Opponent is on duel cooldown.' });
    }
    // Check for existing pending duel between these users
    const existing = await Duel.findOne({
      challengerDiscordId: challenger.discordId,
      opponentDiscordId,
      status: 'pending',
      guildId: req.guildId
    });
    if (existing) {
      return res.status(400).json({ message: 'There is already a pending duel with this user.' });
    }
    // Check balances
    const challengerWallet = await Wallet.findOne({ user: challenger._id, guildId: req.guildId });
    const opponentWallet = await Wallet.findOne({ user: opponent._id, guildId: req.guildId });
    if (!challengerWallet || challengerWallet.balance < amount) {
      return res.status(400).json({ message: 'You do not have enough points to duel.' });
    }
    if (!opponentWallet || opponentWallet.balance < amount) {
      return res.status(400).json({ message: 'Opponent does not have enough points to duel.' });
    }
    // Lock stake (deduct, will refund if declined/timeout)
    challengerWallet.balance -= amount;
    opponentWallet.balance -= amount;
    await challengerWallet.save();
    await opponentWallet.save();
    // Create duel
    const duel = new Duel({
      challenger: challenger._id,
      opponent: opponent._id,
      challengerDiscordId: challenger.discordId,
      opponentDiscordId,
      amount,
      status: 'pending',
      guildId: req.guildId,
      expiresAt: new Date(Date.now() + 60 * 1000) // 1 minute from now
    });
    await duel.save();
    // Set cooldown (5-10 min random)
    const cooldownMinutes = Math.floor(Math.random() * 6) + 5;
    challenger.duelCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    opponent.duelCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    await challenger.save();
    await opponent.save();
    res.json({ message: 'Duel initiated.', duelId: duel._id, cooldownMinutes });
  } catch (error) {
    console.error('Error initiating duel:', error);
    res.status(500).json({ message: 'Server error during duel.' });
  }
});

// --- DUEL: Respond to a duel (accept/decline) ---
router.post('/:discordId/duel/respond', async (req, res) => {
  try {
    const user = req.user;
    const { duelId, accept } = req.body;
    const duel = await Duel.findById(duelId).populate('challenger opponent');
    if (!duel || duel.status !== 'pending') {
      return res.status(400).json({ message: 'Duel not found or already resolved.' });
    }
    if (user.discordId !== duel.opponentDiscordId) {
      return res.status(403).json({ message: 'Only the challenged user can respond.' });
    }
    if (accept) {
      // Resolve duel
      duel.status = 'resolved';
      duel.resolvedAt = new Date();
      // Pick winner randomly
      const winner = Math.random() < 0.5 ? duel.challenger : duel.opponent;
      duel.winner = winner._id;
      duel.winnerDiscordId = winner.discordId;
      // Fun action text
      const actions = [
        `outmaneuvered their opponent in a dramatic showdown!`,
        `landed a critical hit and claimed victory!`,
        `dodged at the last second and won the duel!`,
        `used a surprise move to win the fight!`,
        `triumphed in an epic battle!`
      ];
      duel.actionText = actions[Math.floor(Math.random() * actions.length)];
      await duel.save();
      // Award winnings
      const total = duel.amount * 2;
      const winnerWallet = await Wallet.findOne({ user: winner._id, guildId: req.guildId });
      winnerWallet.balance += total;
      await winnerWallet.save();
      // Update stats
      winner.duelWins = (winner.duelWins || 0) + 1;
      const loser = winner._id.equals(duel.challenger._id) ? duel.opponent : duel.challenger;
      loser.duelLosses = (loser.duelLosses || 0) + 1;
      await winner.save();
      await loser.save();
      // Record transaction
      await Transaction.create({
        user: winner._id,
        type: 'win',
        amount: total,
        description: `Duel win vs ${loser.username}`,
        guildId: req.guildId
      });
      await Transaction.create({
        user: loser._id,
        type: 'lose',
        amount: 0,
        description: `Duel loss vs ${winner.username}`,
        guildId: req.guildId
      });
      res.json({
        message: `Duel resolved. Winner: ${winner.username}`,
        winner: winner.discordId,
        loser: loser.discordId,
        actionText: duel.actionText
      });
    } else {
      // Declined or timeout: refund both
      duel.status = 'declined';
      duel.resolvedAt = new Date();
      await duel.save();
      const challengerWallet = await Wallet.findOne({ user: duel.challenger._id, guildId: req.guildId });
      const opponentWallet = await Wallet.findOne({ user: duel.opponent._id, guildId: req.guildId });
      challengerWallet.balance += duel.amount;
      opponentWallet.balance += duel.amount;
      await challengerWallet.save();
      await opponentWallet.save();
      res.json({
        message: 'Duel declined or timed out. Stakes refunded.',
        challenger: duel.challengerDiscordId,
        opponent: duel.opponentDiscordId
      });
    }
  } catch (error) {
    console.error('Error responding to duel:', error);
    res.status(500).json({ message: 'Server error during duel response.' });
  }
});

// --- DUEL: Get duel stats ---
router.get('/:discordId/duel-stats', async (req, res) => {
  try {
    const user = req.user;
    const wins = user.duelWins || 0;
    const losses = user.duelLosses || 0;
    res.json({ wins, losses });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching duel stats.' });
  }
});

// --- BEG COMMAND ---
router.post('/:discordId/beg', async (req, res) => {
  try {
    const userId = req.params.discordId;
    const wallet = req.wallet;
    const now = new Date();
    // Always fetch user fresh from DB for cooldown check
    const user = await User.findOne({ discordId: userId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.begCooldown && user.begCooldown > now) {
      return res.status(429).json({ message: `You must wait before begging again. Try at ${user.begCooldown.toLocaleString()}` });
    }
    // Cooldown: 1-5 min
    const cooldownMinutes = Math.floor(Math.random() * 5) + 1;
    const newCooldown = new Date(now.getTime() + cooldownMinutes * 60000);
    user.begCooldown = newCooldown;
    // Determine outcome
    const roll = Math.random();
    let outcome, amount = 0, message;
    if (roll < 0.65) {
      // Small coin gain
      amount = Math.floor(Math.random() * 5000) + 1000;
      wallet.balance += amount;
      outcome = 'success';
      const texts = [
        `A kind stranger gave you ${amount.toLocaleString('en-US')} points.`,
        `You found ${amount.toLocaleString('en-US')} points on the ground!`,
        `Someone took pity and tossed you ${amount.toLocaleString('en-US')} points.`,
        `A passing dog dropped a pouch with ${amount.toLocaleString('en-US')} points!`,
        `An old lady pinched your cheeks and gave you ${amount.toLocaleString()} points.`,
        `A clown threw coins at you. You caught ${amount.toLocaleString()} of them.`,
        `Someone yelled "make it rain!" and tossed ${amount.toLocaleString()} points your way.`,
        `You did a little dance and earned ${amount.toLocaleString()} points in sympathy.`,
        `A small child felt bad and gave you ${amount.toLocaleString()} points from their allowance.`,
        `A ghost whispered a Venmo code to you. It led to ${amount.toLocaleString()} points.`,
        `You found a wallet with exactly ${amount.toLocaleString()} points and no ID inside. Finders keepers!`,
        `A bird dropped a coin purse — you snagged it! ${amount.toLocaleString()} points inside.`,
        `You sang off-key and somehow earned ${amount.toLocaleString()} points from amused passersby.`
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else if (roll < 0.85) {
      // Ignored
      outcome = 'ignored';
      const texts = [
        'People walk by, ignoring your pleas.',
        'You beg, but nobody seems to notice.',
        'A pigeon is your only company. No coins today.',
        'You get a sympathetic look, but no points.',
        'You sat there with your hand out... and your hand stayed empty.',
        'Everyone\'s too busy checking their phones to notice you.',
        'You sneeze dramatically, but no one reacts.',
        'You tried fake crying. A dog was mildly interested, but no humans.',
        'You shouted your life story. No one clapped.',
        'A man in a tux looked at you, said "Get a j*b", and walked off.',
        'You blended in with a nearby statue. No donations.',
        'Someone dropped a leaf in your hat. How thoughtful.',
        'Even the pigeons ignored you.'
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else if (roll < 0.97) {
      // Negative event
      outcome = 'negative';
      amount = Math.floor(Math.random() * 2500) + 500;
      wallet.balance = Math.max(0, wallet.balance - amount);
      const texts = [
        `A thief snatched ${amount.toLocaleString('en-US')} points from you!`,
        `You tripped and lost ${amount.toLocaleString('en-US')} points.`,
        `A seagull stole your last ${amount.toLocaleString('en-US')} points!`,
        `You dropped your wallet and lost ${amount.toLocaleString('en-US')} points.`,
        `A suspicious goblin swaps your coins for... beans? You lost ${amount.toLocaleString('en-US')} points.`,
        `You accidentally tipped over your cup. ${amount.toLocaleString()} points rolled into a drain.`,
        `A raccoon mugged you and took ${amount.toLocaleString()} points.`,
        `A kid threw a rock in your bowl. You dropped ${amount.toLocaleString()} points in shock.`,
        `You slipped on a banana peel and lost ${amount.toLocaleString()} points.`,
        `A con artist swapped your cash for Monopoly money. You're down ${amount.toLocaleString()} points.`,
        `You leaned too far while begging and fell into a fountain, losing ${amount.toLocaleString()} points.`,
        `Someone pickpocketed you while giving you a hug. You're down ${amount.toLocaleString()} points.`,
        `Your sign blew away... along with ${amount.toLocaleString()} points in donations.`
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    } else {
      // Rare big reward
      amount = Math.floor(Math.random() * 50000) + 5000;
      wallet.balance += amount;
      outcome = 'jackpot';
      const texts = [
        `A mysterious benefactor handed you a briefcase with ${amount.toLocaleString('en-US')} points!`,
        `You won the street lottery: ${amount.toLocaleString('en-US')} points!`,
        `A golden retriever delivered you a bag with ${amount.toLocaleString('en-US')} points!`,
        `The Coin Wizard taps your head with a wand. Coins fall out your ears! You got ${amount.toLocaleString('en-US')} points!`,
        `An NPC glitched and dropped a loot bag with ${amount.toLocaleString()} points!`,
        `You helped an old wizard cross the street. He blessed you with ${amount.toLocaleString()} points.`,
        `A limousine stopped. Someone tossed a briefcase with ${amount.toLocaleString()} points and drove off.`,
        `You accidentally joined a protest. Someone paid you ${amount.toLocaleString()} points to go home.`,
        `A movie crew mistook you for a background actor. You were paid ${amount.toLocaleString()} points!`,
        `You found a magic lamp. Instead of a genie, it spat out ${amount.toLocaleString()} points.`,
        `A secret admirer dropped a gift box. Inside: ${amount.toLocaleString()} points.`,
        `A group of hackers rewarded you with ${amount.toLocaleString()} points for "just existing."`
      ];
      message = texts[Math.floor(Math.random() * texts.length)];
    }
    await wallet.save();
    await user.save();
    res.json({ outcome, amount, message, cooldown: newCooldown });
  } catch (error) {
    console.error('Error in /beg:', error);
    res.status(500).json({ message: 'Server error during beg.' });
  }
});

// --- MYSTERYBOX COMMAND ---
router.post('/:discordId/mysterybox', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const now = new Date();
    if (!user.mysteryboxCooldown) user.mysteryboxCooldown = null;
    
    // Get box type
    const { boxType } = req.body;
    const costs = {
      basic: 25000,
      premium: 1000000,
      ultimate: 10000000
    };
    const cost = costs[boxType];

    let count = parseInt(req.body.count) || 1;
    const maxCount = 20;
    if (boxType === 'basic') count = 1;
    if (count < 1) count = 1;
    if (count > maxCount) count = maxCount;

    // Multi-box logic for premium/ultimate
    if (boxType !== 'basic' && count > 1) {
      if (wallet.balance < cost * count) {
        return res.status(400).json({ message: `You need ${(cost * count).toLocaleString('en-US')} points to open ${count} ${boxType} mystery boxes.` });
      }
      wallet.balance -= cost * count;
      await wallet.save();
      cleanUserBuffs(user);
      const rewards = [];
      for (let i = 0; i < count; i++) {
        rewards.push(generateMysteryBoxReward(user, wallet, boxType, now));
      }
      await wallet.save();
      await user.save();
      return res.json({ rewards });
    }

    // Existing single-box logic
    if (boxType === 'basic') {
      if (user.mysteryboxCooldown && user.mysteryboxCooldown > now) {
        return res.status(429).json({ message: `You already opened your free mystery box today. Try again at ${user.mysteryboxCooldown.toLocaleString()}` });
      }
      user.mysteryboxCooldown = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else {
      if (wallet.balance < cost) {
        return res.status(400).json({ message: `You need ${cost.toLocaleString('en-US')} points to open a ${boxType} mystery box.` });
      }
      wallet.balance -= cost;
      await wallet.save();
    }
    cleanUserBuffs(user);
    const reward = generateMysteryBoxReward(user, wallet, boxType, now);
    await wallet.save();
    await user.save();
    res.json({ ...reward, cooldown: user.mysteryboxCooldown });
  } catch (error) {
    console.error('Error in /mysterybox:', error);
    res.status(500).json({ message: 'Server error during mystery box.' });
  }
});

// --- REMOVE EXPIRED BUFFS HELPER ---
function cleanUserBuffs(user) {
  const now = new Date();
  user.buffs = (user.buffs || []).filter(buff => {
    if (buff.expiresAt && buff.expiresAt < now) return false;
    if (buff.usesLeft !== undefined && buff.usesLeft <= 0) return false;
    return true;
  });
}

// --- DUEL: GET PENDING DUELS FOR AUTOCOMPLETE ---
router.get('/:discordId/pending-duels', async (req, res) => {
  try {
    const user = req.user;
    // Find all pending duels where this user is the opponent
    const duels = await Duel.find({
      opponentDiscordId: user.discordId,
      status: 'pending',
      guildId: req.guildId
    }).select('_id challengerDiscordId amount');
    res.json({ duels });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching pending duels.' });
  }
});

// --- SUPERADMIN GIVEAWAY ENDPOINT ---
// Use auth middleware to set req.user, then requireGuildId
router.post('/:discordId/giveaway', require('../middleware/auth').auth, requireGuildId, async (req, res) => {
  try {
    // Only allow superadmin
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can give points.' });
    }
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 1) {
      return res.status(400).json({ message: 'Invalid amount.' });
    }
    const targetUser = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    let wallet = await Wallet.findOne({ user: targetUser._id, guildId: req.guildId });
    if (!wallet) {
      wallet = new Wallet({ user: targetUser._id, guildId: req.guildId, balance: 0 });
    }
    wallet.balance += amount;
    await wallet.save();
    // Record transaction
    const transaction = new Transaction({
      user: targetUser._id,
      type: 'giveaway',
      amount,
      description: `Superadmin giveaway`,
      guildId: req.guildId
    });
    await transaction.save();
    res.json({ message: 'Points given successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during giveaway.' });
  }
});

// --- BUFFS COMMAND ---
router.get('/:discordId/buffs', async (req, res) => {
  try {
    const user = req.user;
    if (typeof cleanUserBuffs === 'function') cleanUserBuffs(user);
    res.json({ buffs: user.buffs || [] });
  } catch (error) {
    console.error('Error in /buffs:', error);
    res.status(500).json({ message: 'Server error fetching buffs.' });
  }
});

// Get all cooldowns for a user
router.get('/:discordId/cooldowns', async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const wallet = await Wallet.findOne({ user: user._id, guildId: req.guildId });
    // duelCooldown may not exist on all users
    const duelCooldown = user.duelCooldown || null;
    res.json({
      crimeCooldown: user.crimeCooldown || null,
      workCooldown: user.workCooldown || null,
      fishCooldown: user.fishCooldown || null,
      huntCooldown: user.huntCooldown || null,
      begCooldown: user.begCooldown || null,
      mysteryboxCooldown: user.mysteryboxCooldown || null,
      duelCooldown,
      meowbarkCooldown: user.meowbarkCooldown || null,
      stealPointsCooldown: user.stealPointsCooldown || null,
      stealFishCooldown: user.stealFishCooldown || null,
      stealAnimalCooldown: user.stealAnimalCooldown || null,
      stealItemCooldown: user.stealItemCooldown || null,
      jailedUntil: user.jailedUntil || null,
      lastDailyClaim: wallet ? wallet.lastDailyClaim || null : null,
      cooldownTime: user.lastTimeoutAt || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching cooldowns.' });
  }
});

// Get enhanced steal stats for a user
router.get('/:discordId/steal-stats', requireGuildId, async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId, guildId: req.guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    
    const stealStats = user.stealStats || { 
      success: 0, fail: 0, jail: 0, totalStolen: 0,
      pointsSuccess: 0, pointsFail: 0,
      fishSuccess: 0, fishFail: 0,
      animalSuccess: 0, animalFail: 0,
      itemSuccess: 0, itemFail: 0
    };
    
    const totalAttempts = stealStats.success + stealStats.fail;
    const successRate = totalAttempts > 0 ? ((stealStats.success / totalAttempts) * 100).toFixed(1) : 0;
    
    // Calculate type-specific stats
    const typeStats = {
      points: {
        success: stealStats.pointsSuccess || 0,
        fail: stealStats.pointsFail || 0,
        total: (stealStats.pointsSuccess || 0) + (stealStats.pointsFail || 0),
        successRate: 0
      },
      fish: {
        success: stealStats.fishSuccess || 0,
        fail: stealStats.fishFail || 0,
        total: (stealStats.fishSuccess || 0) + (stealStats.fishFail || 0),
        successRate: 0
      },
      animal: {
        success: stealStats.animalSuccess || 0,
        fail: stealStats.animalFail || 0,
        total: (stealStats.animalSuccess || 0) + (stealStats.animalFail || 0),
        successRate: 0
      },
      item: {
        success: stealStats.itemSuccess || 0,
        fail: stealStats.itemFail || 0,
        total: (stealStats.itemSuccess || 0) + (stealStats.itemFail || 0),
        successRate: 0
      }
    };
    
    // Calculate success rates for each type
    Object.keys(typeStats).forEach(type => {
      if (typeStats[type].total > 0) {
        typeStats[type].successRate = parseFloat(((typeStats[type].success / typeStats[type].total) * 100).toFixed(1));
      }
    });
    
    // Get active punishments
    cleanActivePunishments(user);
    const activePunishments = user.activePunishments || [];
    
    res.json({
      stealStats: {
        ...stealStats,
        totalAttempts,
        successRate: parseFloat(successRate),
        typeStats,
        activePunishments,
        failureCount: user.stealFailureCount || 0,
        lastStealFailure: user.lastStealFailure
      }
    });
  } catch (error) {
    console.error('Error fetching steal stats:', error);
    res.status(500).json({ message: 'Server error fetching steal stats.' });
  }
});

// Change user role (Superadmin only)
router.put('/discord/:discordId/role', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const { role, guildId } = req.body;

    // Get the user making the request
    const requestingUser = await User.findOne({ 
      discordId: req.headers['x-user-id'], 
      guildId: req.guildId 
    });

    // Check if requesting user is a superadmin
    if (!requestingUser || requestingUser.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can change roles' });
    }

    // Validate role
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be one of: user, admin, superadmin' });
    }

    // Find and update user
    const user = await User.findOneAndUpdate(
      { discordId, guildId },
      { role },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Role updated successfully', user });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by Discord ID
router.get('/discord/:discordId', requireGuildId, async (req, res) => {
  try {
    const user = await User.findOne({ 
      discordId: req.params.discordId, 
      guildId: req.guildId 
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Question reward endpoint
router.post('/:discordId/question', async (req, res) => {
  try {
    const user = req.user;
    const wallet = req.wallet;
    const { amount } = req.body;
    
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ message: 'Invalid amount.' });
    }

    // Check if user has enough balance for negative amount
    if (amount < 0 && Math.abs(amount) > wallet.balance) {
      return res.status(400).json({ message: 'Insufficient balance.' });
    }

    wallet.balance += amount;
    await wallet.save();

    // Record transaction
    const transaction = new Transaction({
      user: user._id,
      type: 'question',
      amount,
      description: amount > 0 ? 'Question reward' : 'Question penalty',
      guildId: req.guildId
    });
    await transaction.save();

    res.json({ 
      message: amount > 0 ? `Added ${amount} points.` : `Deducted ${Math.abs(amount)} points.`,
      newBalance: wallet.balance 
    });
  } catch (error) {
    console.error('Error in question endpoint:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Reset timeout duration (called when timeout is manually removed in Discord)
router.post('/:userId/reset-timeout', requireGuildId, async (req, res) => {
    try {
        const { userId } = req.params;
        const { guildId } = req;

        // Find the user
        const user = await User.findOne({ discordId: userId, guildId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Reset all timeout-related fields
        user.currentTimeoutDuration = 0;
        user.timeoutEndsAt = null;
        user.lastTimeoutAt = null; // Also reset the last timeout timestamp
        await user.save();

        // Log the timeout reset
        // console.log(`Timeout reset for user ${userId} in guild ${guildId}`);

        res.json({ 
            message: 'Timeout duration reset successfully',
            currentTimeoutDuration: 0,
            timeoutEndsAt: null
        });
    } catch (error) {
        console.error('Error resetting timeout:', error);
        res.status(500).json({ message: 'Error resetting timeout duration' });
    }
});

// --- List all currently jailed users in a guild ---
router.get('/jailed-users', async (req, res) => {
  try {
    const guildId = req.headers['x-guild-id'] || req.query.guildId;
    if (!guildId) {
      return res.status(400).json({ message: 'Missing guildId.' });
    }
    const now = new Date();
    const users = await User.find({ guildId, jailedUntil: { $gt: now } }).select('discordId username jailedUntil');
    res.json({
      jailedUsers: users.map(u => ({
        discordId: u.discordId,
        username: u.username,
        jailedUntil: u.jailedUntil
      }))
    });
  } catch (error) {
    console.error('Error fetching jailed users:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// --- Helper: Generate a single mystery box reward ---
function generateMysteryBoxReward(user, wallet, boxType, now) {
  const rewardConfigs = {
    basic: {
      coins: { chance: 0.5, min: 50000, max: 150000 },
      items: { chance: 0.35, pool: [
        { name: 'Tiny Top Hat', rarity: 'common', weight: 10, value: () => Math.floor(Math.random() * 1000) + 500 },
        { name: 'Rubber Duck', rarity: 'common', weight: 10, value: () => Math.floor(Math.random() * 1000) + 500 },
        { name: 'Banana Peel', rarity: 'common', weight: 10, value: () => Math.floor(Math.random() * 1000) + 500 },
        { name: 'Squeaky Hammer', rarity: 'common', weight: 10, value: () => Math.floor(Math.random() * 1000) + 500 },
        { name: 'Party Hat', rarity: 'uncommon', weight: 6, value: () => Math.floor(Math.random() * 2000) + 1000 },
        { name: 'Magic Pebble', rarity: 'uncommon', weight: 6, value: () => Math.floor(Math.random() * 2000) + 1000 },
        { name: 'Broken Compass', rarity: 'uncommon', weight: 6, value: () => Math.floor(Math.random() * 2000) + 1000 },
        { name: 'Golden Mustache', rarity: 'rare', weight: 3, value: () => Math.floor(Math.random() * 5000) + 3000 },
        { name: 'Mysterious Key', rarity: 'rare', weight: 3, value: () => Math.floor(Math.random() * 5000) + 3000 },
        { name: 'Lucky Coin', rarity: 'rare', weight: 3, value: () => Math.floor(Math.random() * 5000) + 3000 },
        { name: 'Pocket Rainbow', rarity: 'rare', weight: 3, value: () => Math.floor(Math.random() * 5000) + 3000 },
        { name: 'Epic Sunglasses', rarity: 'legendary', weight: 1.5, value: () => Math.floor(Math.random() * 50000) + 30000 },
        { name: 'Mini Loot Bag', rarity: 'legendary', weight: 1.5, value: () => Math.floor(Math.random() * 50000) + 30000 }
      ]},
      buffs: { chance: 0.1, pool: [
        { type: 'earnings_x2', description: '2x earnings for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000) },
        { type: 'work_double', description: 'Next /work gives 2x points!', usesLeft: 1 },
        { type: 'crime_success', description: 'Next /crime is guaranteed success!', usesLeft: 1 },
        { type: 'frenzy_mode', description: 'No fish/hunt cooldowns for 30 seconds!', expiresAt: new Date(now.getTime() + 30 * 1000), weight: 5 }
      ]},
      jackpot: { chance: 0.05, min: 300000, max: 500000 }
    },
    premium: {
      coins: { chance: 0.5, min: 600000, max: 900000 },
      items: { chance: 0.35, pool: [
        { name: 'Elixir of Fortune', rarity: 'rare', weight: 3, value: () => Math.floor(Math.random() * 100000) + 100000 },
        { name: 'Treasure Map Fragment', rarity: 'rare', weight: 3, value: () => Math.floor(Math.random() * 100000) + 100000 },
        { name: 'Dragon Scale', rarity: 'epic', weight: 2, value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Phoenix Feather', rarity: 'epic', weight: 2, value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Mystic Crystal', rarity: 'epic', weight: 2, value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Enchanted Tome', rarity: 'epic', weight: 2, value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Starlit Pendant', rarity: 'epic', weight: 2, value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Phantom Cloak', rarity: 'epic', weight: 2, value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Ancient Tablet', rarity: 'epic', weight: 2, value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Crystal Dice', rarity: 'epic', weight: 2, value: () => Math.floor(Math.random() * 300000) + 200000 },
        { name: 'Ancient Coin', rarity: 'legendary', weight: 1.2, value: () => Math.floor(Math.random() * 500000) + 300000 },
        { name: 'Gem-Encrusted Ring', rarity: 'legendary', weight: 1.2, value: () => Math.floor(Math.random() * 500000) + 300000 },
        { name: 'Void Trinket', rarity: 'legendary', weight: 1.2, value: () => Math.floor(Math.random() * 500000) + 300000 },
      ]},
      buffs: { chance: 0.1, pool: [
        { type: 'fishing_rare', description: 'Next fish is guaranteed Rare or better!', usesLeft: 1, weight: 25 },
        { type: 'hunting_rare', description: 'Next animal is guaranteed Rare or better!', usesLeft: 1, weight: 25 },
        { type: 'fishing_rate_1.5x', description: 'Epic+ fish drop rates multiplied by 1.5x for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000), weight: 15 },
        { type: 'hunting_rate_1.5x', description: 'Epic+ animal drop rates multiplied by 1.5x for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000), weight: 15 },
        { type: 'earnings_x3', description: '3x earnings for 30 minutes!', expiresAt: new Date(now.getTime() + 30 * 60 * 1000), weight: 10 },
        { type: 'work_triple', description: 'Next /work gives 3x points!', usesLeft: 1, weight: 10 },
        { type: 'mysterybox_cooldown_half', description: 'Premium/Ultimate box cooldowns reduced by 50% for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000), weight: 8 },
        { type: 'fishing_no_cooldown', description: 'Next 2 fish commands have no cooldown!', usesLeft: 2, weight: 12 },
        { type: 'hunting_no_cooldown', description: 'Next 2 hunt commands have no cooldown!', usesLeft: 2, weight: 12 },
        { type: 'double_collection_value', description: 'Items worth 2x when sold for 30 minutes!', expiresAt: new Date(now.getTime() + 30 * 60 * 1000), weight: 8 },
        { type: 'lucky_streak', description: 'Next 1 steal/crime have increased success rates!', usesLeft: 1, weight: 10 },
        { type: 'time_warp', description: 'All cooldowns reduced by 75% for 30 minutes!', expiresAt: new Date(now.getTime() + 30 * 60 * 1000), weight: 6 },
        { type: 'cooldown_reset', description: 'Instantly resets all current cooldowns!', usesLeft: 1, weight: 4 }
      ]},
      jackpot: { chance: 0.05, min: 10000000, max: 20000000 }
    },
    ultimate: {
      coins: { chance: 0.5, min: 5000000, max: 7500000 },
      items: { chance: 0.35, pool: [
        { name: 'Ancient Tome', rarity: 'legendary', weight: 2.5, value: () => Math.floor(Math.random() * 8000000) + 5000000 },
        { name: 'Dragon Heart', rarity: 'legendary', weight: 2.5, value: () => Math.floor(Math.random() * 800000) + 500000 },
        { name: 'Phoenix Heart', rarity: 'legendary', weight: 2.5, value: () => Math.floor(Math.random() * 800000) + 500000 },
        { name: 'Astral Relic', rarity: 'legendary', weight: 2.5, value: () => Math.floor(Math.random() * 8000000) + 5000000 },
        { name: 'Cosmic Mirror', rarity: 'legendary', weight: 2.5, value: () => Math.floor(Math.random() * 8000000) + 5000000 },
        { name: 'Eternal Crystal', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Celestial Crown', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Timeworn Crown', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Ember of Creation', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Soulbound Locket', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Infinity Gem', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Relic of the Old Gods', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Crown of Shadows', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
        { name: 'Primordial Egg', rarity: 'mythical', weight: 1, value: () => Math.floor(Math.random() * 1000000) + 1000000 },
      ]},
      buffs: { chance: 0.1, pool: [
        { type: 'fishing_epic', description: 'Next fish is guaranteed Epic or better!', usesLeft: 1, weight: 20 },
        { type: 'hunting_epic', description: 'Next animal is guaranteed Epic or better!', usesLeft: 1, weight: 20 },
        { type: 'fishing_rate_2x', description: 'Epic+ fish drop rates multiplied by 2x for 30 minutes!', expiresAt: new Date(now.getTime() + 30 * 60 * 1000), weight: 10 },
        { type: 'hunting_rate_2x', description: 'Epic+ animal drop rates multiplied by 2x for 30 minutes!', expiresAt: new Date(now.getTime() + 30 * 60 * 1000), weight: 10 },
        { type: 'fishing_rate_3x', description: 'Epic+ fish drop rates multiplied by 3x for 15 minutes!', expiresAt: new Date(now.getTime() + 15 * 60 * 1000), weight: 5 },
        { type: 'hunting_rate_3x', description: 'Epic+ animal drop rates multiplied by 3x for 15 minutes!', expiresAt: new Date(now.getTime() + 15 * 60 * 1000), weight: 5 },
        { type: 'earnings_x5', description: '5x earnings for 15 minutes!', expiresAt: new Date(now.getTime() + 15 * 60 * 1000), weight: 10 },
        { type: 'work_quintuple', description: 'Next /work gives 5x points!', usesLeft: 1, weight: 19 },
        { type: 'jail_immunity', description: 'Immunity from jail for your next crime or steal!', usesLeft: 1, weight: 1 },
        { type: 'frenzy_mode', description: 'No fish/hunt cooldowns for 60 seconds!', expiresAt: new Date(now.getTime() + 60 * 1000), weight: 3 },
        { type: 'fishing_no_cooldown', description: 'Next 5 fish commands have no cooldown!', usesLeft: 5, weight: 8 },
        { type: 'hunting_no_cooldown', description: 'Next 5 hunt commands have no cooldown!', usesLeft: 5, weight: 8 },
        { type: 'double_collection_value', description: 'Items worth 2x when sold for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000), weight: 6 },
        { type: 'lucky_streak', description: 'Next 3 steal/crime have increased success rates!', usesLeft: 3, weight: 8 },
        { type: 'time_warp', description: 'All cooldowns reduced by 75% for 1 hour!', expiresAt: new Date(now.getTime() + 60 * 60 * 1000), weight: 4 },
        { type: 'cooldown_reset', description: 'Instantly resets all current cooldowns!', usesLeft: 1, weight: 2 }
      ]},
      jackpot: { chance: 0.05, min: 100000000, max: 200000000 }
    }
  };
  const config = rewardConfigs[boxType];
  const roll = Math.random();
  let rewardType, amount = 0, item = null, message;
  let cumulativeChance = 0;
  if (roll < (cumulativeChance += config.coins.chance)) {
    amount = Math.floor(Math.random() * (config.coins.max - config.coins.min + 1)) + config.coins.min;
    wallet.balance += amount;
    rewardType = 'coins';
    message = `You found ${amount.toLocaleString('en-US')} points inside the ${boxType} box!`;
  } else if (roll < (cumulativeChance += config.items.chance)) {
    const selectedItem = config.items.pool[Math.floor(Math.random() * config.items.pool.length)];
    const itemValue = selectedItem.value();
    user.inventory = user.inventory || [];
    const idx = user.inventory.findIndex(i => i.type === 'item' && i.name === selectedItem.name);
    if (idx >= 0) {
      user.inventory[idx].count += 1;
    } else {
      user.inventory.push({ 
        type: 'item', 
        name: selectedItem.name, 
        rarity: selectedItem.rarity, 
        value: itemValue, 
        count: 1 
      });
    }
    rewardType = 'item';
    item = { name: selectedItem.name, rarity: selectedItem.rarity, value: itemValue };
    message = `You found a **${selectedItem.name}** (${selectedItem.rarity}) worth ${itemValue.toLocaleString('en-US')} points in the ${boxType} box!`;
  } else if (roll < (cumulativeChance += config.buffs.chance)) {
    const buffPool = config.buffs.pool;
    const totalWeight = buffPool.reduce((sum, buff) => sum + (buff.weight || 1), 0);
    let buffRoll = Math.random() * totalWeight;
    let selectedBuff = null;
    for (const buff of buffPool) {
      buffRoll -= (buff.weight || 1);
      if (buffRoll <= 0) {
        selectedBuff = { ...buff };
        delete selectedBuff.weight;
        break;
      }
    }
    if (!selectedBuff) {
      selectedBuff = { ...buffPool[0] };
      delete selectedBuff.weight;
    }
    user.buffs = user.buffs || [];
    const existingBuffIdx = user.buffs.findIndex(b => b.type === selectedBuff.type);
    if (existingBuffIdx >= 0) {
      const existingBuff = user.buffs[existingBuffIdx];
      if (selectedBuff.expiresAt) {
        const currentExpiry = existingBuff.expiresAt || new Date(now.getTime());
        const newExpiry = new Date(currentExpiry.getTime() + (selectedBuff.expiresAt - now.getTime()));
        existingBuff.expiresAt = newExpiry;
      } else if (selectedBuff.usesLeft !== undefined) {
        existingBuff.usesLeft = (existingBuff.usesLeft || 0) + selectedBuff.usesLeft;
      }
      message = `You found a buff: ${selectedBuff.description} (Stacked with existing buff!)`;
    } else {
      user.buffs.push(selectedBuff);
      message = `You found a buff: ${selectedBuff.description}`;
    }
    rewardType = 'buffs';
  } else {
    // Jackpot reward
    amount = Math.floor(Math.random() * (config.jackpot.max - config.jackpot.min + 1)) + config.jackpot.min;
    wallet.balance += amount;
    rewardType = 'jackpot';
    // 1% chance for golden ticket ONLY for ultimate box
    if (boxType === 'ultimate' && Math.random() < 0.001) {
      user.inventory = user.inventory || [];
      const idx = user.inventory.findIndex(i => i.type === 'item' && i.name === 'Golden Ticket');
      if (idx >= 0) {
        user.inventory[idx].count += 1;
      } else {
        user.inventory.push({ type: 'item', name: 'Golden Ticket', rarity: 'legendary', value: 0, count: 1 });
      }
      message = `JACKPOT! You found ${amount.toLocaleString('en-US')} points and a **Golden Ticket** in the ${boxType} box!`;
    } else {
      message = `JACKPOT! You found ${amount.toLocaleString('en-US')} points in the ${boxType} box!`;
    }
  }
  return { rewardType, amount, item, message };
}

// --- DUEL: Get duel by ID (status check for bot timeout) ---
router.get('/duel/:duelId', async (req, res) => {
  try {
    const duel = await Duel.findById(req.params.duelId);
    if (!duel) return res.status(404).json({ message: 'Duel not found.' });
    res.json({
      duelId: duel._id,
      status: duel.status,
      challengerDiscordId: duel.challengerDiscordId,
      opponentDiscordId: duel.opponentDiscordId,
      amount: duel.amount,
      createdAt: duel.createdAt,
      resolvedAt: duel.resolvedAt || null
    });
  } catch (error) {
    console.error('Error fetching duel by ID:', error);
    res.status(500).json({ message: 'Server error fetching duel.' });
  }
});

// GET /:discordId - Get user info for shop and profile
router.get('/:discordId', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    const user = await User.findOne({ discordId, guildId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

// GET /:discordId/battle-stats - Get Pokémon battle statistics for a user
router.get('/:discordId/battle-stats', requireGuildId, async (req, res) => {
  try {
    const { discordId } = req.params;
    const guildId = req.headers['x-guild-id'];
    
    // Import BattleSession model
    const BattleSession = require('../models/BattleSession');
    
    // Get all battles where the user participated
    const userBattles = await BattleSession.find({
      guildId,
      $or: [
        { challengerId: discordId },
        { opponentId: discordId }
      ],
      status: 'finished'
    }).sort({ createdAt: -1 });
    
    if (userBattles.length === 0) {
      return res.status(404).json({ message: 'No battle data found for this user.' });
    }
    
    // Calculate statistics
    let wins = 0;
    let losses = 0;
    let totalXpEarned = 0;
    let totalStardustEarned = 0;
    let friendlyBattles = 0;
    let competitiveBattles = 0;
    let friendlyWins = 0;
    let competitiveWins = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    
    // Track Pokémon usage
    const pokemonUsage = {};
    
    // Process each battle
    for (const battle of userBattles) {
      const isWinner = battle.winnerId === discordId;
      const isFriendly = battle.friendly === true;
      
      if (isWinner) {
        wins++;
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
        
        if (isFriendly) {
          friendlyWins++;
        } else {
          competitiveWins++;
        }
      } else {
        losses++;
        tempStreak = 0;
      }
      
      if (isFriendly) {
        friendlyBattles++;
      } else {
        competitiveBattles++;
      }
      
      // Calculate rewards (simplified - in real implementation you'd track actual rewards)
      const loserPokemons = battle.winnerId === battle.challengerId ? battle.opponentPokemons : battle.challengerPokemons;
      let battleXp = 0;
      let battleStardust = 0;
      
      for (const poke of loserPokemons) {
        // Estimate XP and stardust based on Pokémon level/rarity
        const baseXp = Math.floor(Math.random() * 50) + 25; // 25-75 XP per Pokémon
        const baseStardust = Math.floor(Math.random() * 30) + 15; // 15-45 stardust per Pokémon
        
        battleXp += baseXp;
        battleStardust += baseStardust;
      }
      
      // Double rewards for competitive battles
      if (!isFriendly) {
        battleXp *= 2;
        battleStardust *= 2;
      }
      
      if (isWinner) {
        totalXpEarned += battleXp;
        totalStardustEarned += battleStardust;
      }
      
      // Track Pokémon usage
      const userPokemons = battle.challengerId === discordId ? battle.challengerPokemons : battle.opponentPokemons;
      for (const pokemon of userPokemons) {
        const key = `${pokemon.name}-${pokemon.isShiny}`;
        if (!pokemonUsage[key]) {
          pokemonUsage[key] = {
            name: pokemon.name,
            isShiny: pokemon.isShiny,
            usageCount: 0
          };
        }
        pokemonUsage[key].usageCount++;
      }
    }
    
    // Calculate current streak (most recent battles)
    currentStreak = 0;
    for (const battle of userBattles) {
      if (battle.winnerId === discordId) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Calculate win rates
    const totalBattles = wins + losses;
    const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;
    const friendlyWinRate = friendlyBattles > 0 ? Math.round((friendlyWins / friendlyBattles) * 100) : 0;
    const competitiveWinRate = competitiveBattles > 0 ? Math.round((competitiveWins / competitiveBattles) * 100) : 0;
    
    // Calculate averages
    const averageXpPerBattle = wins > 0 ? Math.round(totalXpEarned / wins) : 0;
    const averageStardustPerBattle = wins > 0 ? Math.round(totalStardustEarned / wins) : 0;
    
    // Get recent battles (last 5) with opponent usernames
    const recentBattles = await Promise.all(userBattles.slice(0, 5).map(async battle => {
      const isWinner = battle.winnerId === discordId;
      const opponentId = battle.challengerId === discordId ? battle.opponentId : battle.challengerId;
      
      // Fetch opponent username from User model
      let opponentUsername = 'Unknown';
      try {
        const opponentUser = await User.findOne({ discordId: opponentId, guildId });
        if (opponentUser) {
          opponentUsername = opponentUser.username;
        }
      } catch (error) {
        console.error('Error fetching opponent username:', error);
      }
      
      return {
        won: isWinner,
        opponentId,
        opponentUsername,
        createdAt: battle.createdAt
      };
    }));
    
    // Get favorite Pokémon (top 3 by usage)
    const favoritePokemon = Object.values(pokemonUsage)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 3);
    
    res.json({
      totalBattles,
      wins,
      losses,
      winRate,
      currentStreak,
      bestStreak,
      totalXpEarned,
      totalStardustEarned,
      averageXpPerBattle,
      averageStardustPerBattle,
      friendlyBattles,
      competitiveBattles,
      friendlyWinRate,
      competitiveWinRate,
      recentBattles,
      favoritePokemon
    });
    
  } catch (error) {
    console.error('Error fetching battle statistics:', error);
    res.status(500).json({ message: 'Failed to fetch battle statistics.' });
  }
});

function randomNature() {
  const natures = [
    'hardy','lonely','brave','adamant','naughty','bold','docile','relaxed','impish','lax',
    'timid','hasty','serious','jolly','naive','modest','mild','quiet','bashful','rash',
    'calm','gentle','sassy','careful','quirky'
  ];
  return natures[Math.floor(Math.random() * natures.length)];
}

module.exports = router;