const tcgApi = require('./tcgApi');
const Card = require('../models/Card');
const CardPack = require('../models/CardPack');
const packTemplates = require('./packTemplates');

// Map logical rarities to all possible API values
const rarityAliases = {
  common: ['Common', 'common'],
  uncommon: ['Uncommon', 'uncommon'],
  rare: ['Rare', 'Rare Holo', 'Rare Holo Foil', 'Rare Secret', 'rare', 'Rare Holo Rare'],
  promo: ['Promo', 'Black Star Promo', 'Wizards Black Star Promo', 'PROMO', 'promo'],
  energy: ['Energy', 'energy'],
};

// Proactively warm cache for all pack sets on cold start
const popularSets = ['base1', 'base2', 'basep', 'base3', 'base4', 'base5', 'base6'];
let warmed = false;

async function warmSetCache() {
  if (warmed) return;
  console.log('[PackGenerator][WARM] Starting to warm cache for all pack sets...');
  
  const warmResults = {
    successful: [],
    failed: [],
    total: popularSets.length
  };

  for (const setId of popularSets) {
    try {
      console.log(`[PackGenerator][WARM] Warming cache for set ${setId}...`);
      await tcgApi.getCardsBySet(setId, 1, 500);
      console.log(`[PackGenerator][WARM] Warmed cache for set ${setId}`);
      warmResults.successful.push(setId);
    } catch (e) {
      console.warn(`[PackGenerator][WARM] Failed to warm cache for set ${setId}:`, e.message);
      warmResults.failed.push({ setId, error: e.message });
      
      // If it's a 504 error, log it specifically
      if (e.message.includes('504') || e.message.includes('Gateway timeout')) {
        console.warn(`[PackGenerator][WARM] Gateway timeout for set ${setId} - this is a temporary server issue`);
      }
    }
  }
  
  console.log('[PackGenerator][WARM] Cache warming completed');
  console.log(`[PackGenerator][WARM] Results: ${warmResults.successful.length}/${warmResults.total} sets warmed successfully`);
  
  if (warmResults.failed.length > 0) {
    console.log('[PackGenerator][WARM] Failed sets:', warmResults.failed.map(f => f.setId).join(', '));
  }
  
  warmed = true;
}
warmSetCache();

class PackGenerator {
  constructor() {
    // Cache for card pools by set and rarity
    this.cardCache = {};
    this.cacheStats = {
      hits: 0,
      misses: 0,
      apiCalls: 0,
      fallbackUses: 0
    };
  }

  /**
   * Generate cards for a pack based on its configuration
   */
  async generatePackCards(packConfig) {
    const overallStart = Date.now();
    const setId = (packConfig.allowedSets && packConfig.allowedSets[0]) || packConfig.setId;
    const template = packTemplates.find(t => t.setId === setId);
    if (!template) throw new Error(`No pack template found for setId: ${setId}`);
    console.log(`[PackGenerator] Generating pack: ${packConfig.name} (${setId}) using template`);
    let commons = [];
    let rare = [];
    let uncommons = [];
    let promos = [];
    for (const slot of template.slots) {
      const slotStart = Date.now();
      for (const [rarity, count] of Object.entries(slot.composition)) {
        const rarityStart = Date.now();
        const drawn = await this.drawCardsByRarity(rarity, count * slot.count, [setId]);
        const rarityDuration = Date.now() - rarityStart;
        console.log(`[PackGenerator][TIMING] drawCardsByRarity(rarity=${rarity}, count=${count * slot.count}) took ${rarityDuration}ms`);
        if (rarity === 'rare') rare.push(...drawn);
        else if (rarity === 'uncommon') uncommons.push(...drawn);
        else if (rarity === 'promo') promos.push(...drawn);
        else if (rarity === 'common') commons.push(...drawn);
        else commons.push(...drawn);
      }
      const slotDuration = Date.now() - slotStart;
      console.log(`[PackGenerator][TIMING] Slot ${slot.name || JSON.stringify(slot.composition)} took ${slotDuration}ms`);
    }
    const shuffleStart = Date.now();
    commons = this.shuffleCards(commons);
    const shuffleDuration = Date.now() - shuffleStart;
    console.log(`[PackGenerator][TIMING] Shuffling commons took ${shuffleDuration}ms`);
    if (template.foilChance && Math.random() < template.foilChance && rare.length > 0) {
      const foilStart = Date.now();
      const holoRares = await this.drawCardsByRarity('rare holo', 1, [setId]);
      if (holoRares.length > 0) {
        const idx = Math.floor(Math.random() * commons.length);
        commons[idx] = holoRares[0];
      }
      const foilDuration = Date.now() - foilStart;
      console.log(`[PackGenerator][TIMING] Foil pull logic took ${foilDuration}ms`);
    }
    let cards;
    if (promos.length > 0) {
      cards = [...promos];
    } else {
      cards = [...commons, ...rare, ...uncommons];
    }
    console.log('[PackGenerator][DEBUG] Final cards:', cards.map(c => ({ name: c.name, rarity: c.rarity })));
    this.logCacheStats();
    const overallDuration = Date.now() - overallStart;
    console.log(`[PackGenerator][TIMING] generatePackCards total duration: ${overallDuration}ms`);
    return cards;
  }

  async drawCardsByRarity(logicalRarity, count, allowedSets) {
    const start = Date.now();
    const cards = [];
    const apiRarities = rarityAliases[logicalRarity] || [logicalRarity];
    for (const setCode of allowedSets) {
      const preloadStart = Date.now();
      const setCache = await this.preloadSet(setCode);
      const preloadDuration = Date.now() - preloadStart;
      console.log(`[PackGenerator][TIMING] preloadSet(${setCode}) took ${preloadDuration}ms`);
      if (setCache) {
        let pool = [];
        for (const apiRarity of apiRarities) {
          if (logicalRarity === 'energy') {
            pool = pool.concat(setCache.energy || []);
          } else if (logicalRarity === 'promo') {
            pool = pool.concat(setCache.promo || []);
          } else {
            pool = pool.concat(
              (setCache.common || []).filter(card => card.rarity === apiRarity),
              (setCache.uncommon || []).filter(card => card.rarity === apiRarity),
              (setCache.rare || []).filter(card => card.rarity === apiRarity),
              (setCache.holoRare || []).filter(card => card.rarity === apiRarity),
              (setCache.ultraRare || []).filter(card => card.rarity === apiRarity)
            );
          }
        }
        pool = pool.filter(card => card.supertype !== 'Trainer');
        console.log(`[PackGenerator][DEBUG] setId=${setCode}, logicalRarity=${logicalRarity}, poolSize=${pool.length}, apiRarities=${JSON.stringify(apiRarities)}`);
        if (logicalRarity === 'energy' && pool.length === 0) {
          const fallbackEnergy = await this.getFallbackCard('energy');
          cards.push(fallbackEnergy);
        }
        const selectStart = Date.now();
        const selected = this.pickRandomFromPool(pool, count - cards.length);
        const selectDuration = Date.now() - selectStart;
        console.log(`[PackGenerator][TIMING] pickRandomFromPool for ${logicalRarity} took ${selectDuration}ms`);
        // Parallelize processCardData for all selected cards
        const processStart = Date.now();
        const processedCards = await Promise.all(selected.map(card => this.processCardData(card)));
        const processDuration = Date.now() - processStart;
        processedCards.forEach((processedCard, idx) => {
          console.log(`[PackGenerator][TIMING] processCardData for card ${selected[idx].name} took (parallelized)`);
        });
        cards.push(...processedCards);
        if (cards.length >= count) {
          const duration = Date.now() - start;
          console.log(`[PackGenerator][TIMING] drawCardsByRarity(${logicalRarity}, ${count}) total duration: ${duration}ms`);
          return cards.slice(0, count);
        }
      }
    }
    while (cards.length < count) {
      this.cacheStats.fallbackUses++;
      const fallbackCard = await this.getFallbackCard(logicalRarity);
      cards.push(fallbackCard);
    }
    const duration = Date.now() - start;
    console.log(`[PackGenerator][TIMING] drawCardsByRarity(${logicalRarity}, ${count}) total duration: ${duration}ms`);
    return cards.slice(0, count);
  }

  /**
   * Preload and cache all cards for a set (lazy loading, now uses Redis-backed getCardsBySet)
   */
  async preloadSet(setCode) {
    const start = Date.now();
    if (this.cardCache[setCode] !== undefined) {
      this.cacheStats.hits++;
      const duration = Date.now() - start;
      console.log(`[PackGenerator][TIMING] preloadSet(${setCode}) cache hit in ${duration}ms`);
      return this.cardCache[setCode];
    }
    this.cacheStats.misses++;
    try {
      this.cacheStats.apiCalls++;
      // Fetch all cards for the set (up to 500, adjust if needed)
      const allCards = await tcgApi.getCardsBySet(setCode, 1, 500); // now returns array
      // Split by rarity and supertype
      const byRarity = {
        common: [],
        uncommon: [],
        rare: [],
        holoRare: [],
        ultraRare: [],
        energy: [],
        promo: [] // Added promo pool
      };
      for (const card of allCards) {
        if (card.supertype === 'Energy') {
          byRarity.energy.push(card);
        } else if (card.rarity === 'Common') {
          byRarity.common.push(card);
        } else if (card.rarity === 'Uncommon') {
          byRarity.uncommon.push(card);
        } else if (card.rarity === 'Rare') {
          byRarity.rare.push(card);
        } else if (card.rarity && card.rarity.includes('Holo')) {
          byRarity.holoRare.push(card);
        } else if (card.rarity && card.rarity.includes('Ultra')) {
          byRarity.ultraRare.push(card);
        }
        // Pool promo cards
        if (card.rarity && rarityAliases.promo.includes(card.rarity)) {
          if (!byRarity.promo) byRarity.promo = [];
          byRarity.promo.push(card);
        }
      }
      const uniqueRarities = Array.from(new Set(allCards.map(card => card.rarity))).filter(Boolean);
      console.log(`[PackGenerator][DEBUG] setId=${setCode}, uniqueRarities=${JSON.stringify(uniqueRarities)}`);
      this.cardCache[setCode] = byRarity;
      const duration = Date.now() - start;
      console.log(`[PackGenerator][TIMING] preloadSet(${setCode}) API/Redis load in ${duration}ms`);
      return byRarity;
    } catch (error) {
      console.error(`[PackGenerator] Error preloading set ${setCode}:`, error);
      // Cache the failure to avoid repeated API calls (negative cache)
      this.cardCache[setCode] = null;
      const duration = Date.now() - start;
      console.log(`[PackGenerator][TIMING] preloadSet(${setCode}) error in ${duration}ms`);
      return null;
    }
  }

  /**
   * Get cards by rarity with caching (uses preloaded set cache)
   */
  async getCardsByRarity(rarity, count, allowedSets = []) {
    const cards = [];
    // Use new classic set detection
    const isClassicSet = allowedSets.some(set => ['base1', 'base2', 'base3'].includes(set));
    // Accept both lowercase and titlecase rarity keys
    let queryRarity = rarity;
    // For classic sets, support all possible rarity keys
    const rarityAliases = {
      'common': ['Common'],
      'uncommon': ['Uncommon'],
      'rare': ['Rare', 'Rare Holo', 'Promo', 'Rare Secret'],
      'Rare Holo': ['Rare Holo'],
      'Promo': ['Promo'],
      'Rare Secret': ['Rare Secret'],
      'Rare': ['Rare']
    };
    for (const setCode of allowedSets) {
      const setCache = await this.preloadSet(setCode);
      if (setCache) {
        let pool = [];
        // Support all rarity keys
        if (rarityAliases[queryRarity]) {
          for (const alias of rarityAliases[queryRarity]) {
            if (setCache[alias]) pool = pool.concat(setCache[alias]);
            // Fallback to filter by card.rarity
            pool = pool.concat(setCache.common?.filter(card => card.rarity === alias) || []);
            pool = pool.concat(setCache.uncommon?.filter(card => card.rarity === alias) || []);
            pool = pool.concat(setCache.rare?.filter(card => card.rarity === alias) || []);
            pool = pool.concat(setCache.holoRare?.filter(card => card.rarity === alias) || []);
            pool = pool.concat(setCache.ultraRare?.filter(card => card.rarity === alias) || []);
            pool = pool.concat(setCache.energy?.filter(card => card.rarity === alias) || []);
          }
        } else {
          // Fallback to original logic
          if (queryRarity === 'common' || queryRarity === 'Common') pool = setCache.common;
          else if (queryRarity === 'uncommon' || queryRarity === 'Uncommon') pool = setCache.uncommon;
          else if (queryRarity === 'rare' || queryRarity === 'Rare') pool = setCache.rare.concat(setCache.holoRare, setCache.ultraRare);
          else pool = setCache.common;
        }
        // Remove trainers for classic sets
        if (isClassicSet) pool = pool.filter(card => card.supertype !== 'Trainer');
        const selected = this.pickRandomFromPool(pool, count - cards.length);
        for (const card of selected) {
          const processedCard = await this.processCardData(card);
          cards.push(processedCard);
        }
        if (cards.length >= count) return cards.slice(0, count);
      }
    }
    // Fallback if not enough cards
    while (cards.length < count) {
      this.cacheStats.fallbackUses++;
      const fallbackCard = await this.getFallbackCard(rarity);
      cards.push(fallbackCard);
    }
    return cards.slice(0, count);
  }

  /**
   * Get energy cards (uses preloaded set cache)
   */
  async getEnergyCard(allowedSets = []) {
    // If classic set is base2 or base3, always use base1 for energy pulls
    const isJungleOrFossil = allowedSets.some(set => ['base2', 'base3'].includes(set));
    const energySet = isJungleOrFossil ? ['base1'] : allowedSets;
    for (const setCode of energySet) {
      const setCache = await this.preloadSet(setCode);
      if (setCache && setCache.energy.length > 0) {
        const randomEnergy = setCache.energy[Math.floor(Math.random() * setCache.energy.length)];
        return await this.processCardData(randomEnergy);
      }
    }
    // Fallback energy card
    const fallbackEnergy = await this.getFallbackCard('common');
    fallbackEnergy.name = 'Basic Energy';
    fallbackEnergy.supertype = 'Energy';
    fallbackEnergy.subtypes = ['Basic'];
    fallbackEnergy.types = ['Colorless'];
    return fallbackEnergy;
  }

  /**
   * Get trainer cards
   */
  async getTrainerCards(count, allowedSets = []) {
    const trainers = [];
    
    try {
      // Only get trainer cards for modern sets (classic sets don't have trainers)
      const isClassicSet = allowedSets.some(set => ['base1', 'base2', 'base3'].includes(set));
      
      if (isClassicSet) {
        // Classic sets don't have trainer cards, return empty array
        return [];
      }
      
      // Get trainer cards for modern sets
      const trainerCards = await tcgApi.getRandomCards('Common', count * 2, allowedSets);
      const filteredTrainers = trainerCards.filter(card => card.supertype === 'Trainer');
      
      for (let i = 0; i < Math.min(count, filteredTrainers.length); i++) {
        const trainer = await this.processCardData(filteredTrainers[i]);
        trainers.push(trainer);
      }
    } catch (error) {
      console.error('[PackGenerator] Error fetching trainer cards:', error);
    }
    
    // Fill with fallback cards if needed
    while (trainers.length < count) {
      const fallbackCard = await this.getFallbackCard('common');
      trainers.push(fallbackCard);
    }
    
    return trainers.slice(0, count);
  }

  /**
   * Apply rarity upgrades and guarantees
   */
  async applyRarityUpgrades(skeleton, packConfig) {
    // Find the rare card
    const rareIndex = skeleton.findIndex(card => 
      card.rarity && card.rarity.toLowerCase() === 'rare'
    );
    
    if (rareIndex !== -1) {
      const rareCard = skeleton[rareIndex];
      
      // Use pack's holoChance or default to rarityUpgrades.rareToHolo
      const holoChance = packConfig.holoChance || this.rarityUpgrades.rareToHolo;
      
      // Apply rarity upgrade chances
      const upgradeRoll = Math.random();
      
      if (upgradeRoll < this.rarityUpgrades.rareToUltra) {
        // Upgrade to ultra rare (only for modern sets)
        const isClassicSet = packConfig.allowedSets.some(set => ['base1', 'base2', 'base3'].includes(set));
        if (!isClassicSet) {
          const ultraRare = await this.getCardsByRarity('ultra-rare', 1, packConfig.allowedSets);
          if (ultraRare.length > 0) {
            skeleton[rareIndex] = ultraRare[0];
          }
        }
      } else if (upgradeRoll < this.rarityUpgrades.rareToUltra + holoChance) {
        // Upgrade to holo rare using pack's holoChance
        const holoRare = await this.getCardsByRarity('holo-rare', 1, packConfig.allowedSets);
        if (holoRare.length > 0) {
          skeleton[rareIndex] = holoRare[0];
        }
      }
    }
    
    // Apply pack guarantees
    if (packConfig.guaranteedRare) {
      const hasRare = skeleton.some(card => 
        ['rare', 'holo-rare', 'ultra-rare'].includes(card.rarity?.toLowerCase())
      );
      
      if (!hasRare) {
        // Replace a common with a rare
        const commonIndex = skeleton.findIndex(card => card.rarity?.toLowerCase() === 'common');
        if (commonIndex !== -1) {
          const rareCard = await this.getCardsByRarity('rare', 1, packConfig.allowedSets);
          if (rareCard.length > 0) {
            skeleton[commonIndex] = rareCard[0];
          }
        }
      }
    }
    
    if (packConfig.guaranteedHolo) {
      const hasHolo = skeleton.some(card => 
        ['holo-rare', 'ultra-rare'].includes(card.rarity?.toLowerCase())
      );
      
      if (!hasHolo) {
        // Replace a rare with a holo rare
        const rareIndex = skeleton.findIndex(card => card.rarity?.toLowerCase() === 'rare');
        if (rareIndex !== -1) {
          const holoCard = await this.getCardsByRarity('holo-rare', 1, packConfig.allowedSets);
          if (holoCard.length > 0) {
            skeleton[rareIndex] = holoCard[0];
          }
        }
      }
    }
  }

  /**
   * Apply reverse holo slot
   */
  async applyReverseHolo(skeleton, packConfig) {
    // Check if this is a classic set (no reverse holos in classic sets)
    const isClassicSet = packConfig.allowedSets.some(set => ['base1', 'base2', 'base3'].includes(set));
    
    if (isClassicSet) {
      // Classic sets don't have reverse holos
      return;
    }
    
    // 33% chance of reverse holo for modern sets
    if (Math.random() < this.rarityUpgrades.reverseHolo) {
      // Find a common card to make reverse holo
      const commonIndex = skeleton.findIndex(card => 
        card.rarity && card.rarity.toLowerCase() === 'common'
      );
      
      if (commonIndex !== -1) {
        skeleton[commonIndex].isReverseHolo = true;
        console.log('[PackGenerator] Applied reverse holo to card:', skeleton[commonIndex].name);
      }
    }
  }

  /**
   * Pick random cards from a pool
   */
  pickRandomFromPool(pool, count) {
    const selected = [];
    if (pool.length === 0) return selected;
    if (count <= pool.length) {
      // No duplicates needed, sample without replacement
      const poolCopy = [...pool];
      for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * poolCopy.length);
        selected.push(poolCopy[randomIndex]);
        poolCopy.splice(randomIndex, 1);
      }
    } else {
      // Allow duplicates, sample with replacement
      for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        selected.push(pool[randomIndex]);
      }
    }
    return selected;
  }

  /**
   * Process card data from TCG API (simplified)
   */
  async processCardData(apiCard) {
    const start = Date.now();
    // Simplified data processing - trust the API
    const weaknesses = apiCard.weaknesses ?? [];
    const resistances = apiCard.resistances ?? [];
    const attacks = apiCard.attacks ?? [];
    
    // Handle rarity - energy cards don't have rarity, so default to Common
    const rarity = apiCard.rarity || (apiCard.supertype === 'Energy' ? 'Common' : 'Common');
    
    // Determine foil status
    const isFoil = this.determineFoilStatus(rarity);
    
    // Estimate card value
    const estimatedValue = this.estimateCardValue(rarity, isFoil);
    
    // Ensure images exist, fallback to default if missing
    const images = apiCard.images || {
      small: `https://images.pokemontcg.io/${apiCard.set?.id || 'base1'}/${apiCard.number || '1'}.png`,
      large: `https://images.pokemontcg.io/${apiCard.set?.id || 'base1'}/${apiCard.number || '1'}_hires.png`
    };
    
    const result = await (async () => {
      // Simplified data processing - trust the API
      const weaknesses = apiCard.weaknesses ?? [];
      const resistances = apiCard.resistances ?? [];
      const attacks = apiCard.attacks ?? [];
      
      // Handle rarity - energy cards don't have rarity, so default to Common
      const rarity = apiCard.rarity || (apiCard.supertype === 'Energy' ? 'Common' : 'Common');
      
      // Determine foil status
      const isFoil = this.determineFoilStatus(rarity);
      
      // Estimate card value
      const estimatedValue = this.estimateCardValue(rarity, isFoil);
      
      // Ensure images exist, fallback to default if missing
      const images = apiCard.images || {
        small: `https://images.pokemontcg.io/${apiCard.set?.id || 'base1'}/${apiCard.number || '1'}.png`,
        large: `https://images.pokemontcg.io/${apiCard.set?.id || 'base1'}/${apiCard.number || '1'}_hires.png`
      };
      
      return {
        cardId: apiCard.id || `api_${Date.now()}_${Math.random()}`,
        name: apiCard.name,
        set: {
          id: apiCard.set?.id,
          name: apiCard.set?.name,
          series: apiCard.set?.series,
          printedTotal: apiCard.set?.printedTotal,
          total: apiCard.set?.total,
          legalities: apiCard.set?.legalities,
          ptcgoCode: apiCard.set?.ptcgoCode,
          releaseDate: apiCard.set?.releaseDate,
          updatedAt: apiCard.set?.updatedAt,
          images: apiCard.set?.images
        },
        images: images,
        tcgplayer: apiCard.tcgplayer,
        cardmarket: apiCard.cardmarket,
        rarity: rarity,
        artist: apiCard.artist,
        number: apiCard.number,
        series: apiCard.series,
        printedTotal: apiCard.printedTotal,
        total: apiCard.total,
        legalities: apiCard.legalities,
        ptcgoCode: apiCard.ptcgoCode,
        releaseDate: apiCard.releaseDate,
        updatedAt: apiCard.updatedAt,
        supertype: apiCard.supertype,
        subtypes: apiCard.subtypes,
        level: apiCard.level,
        hp: apiCard.hp,
        types: apiCard.types,
        evolvesFrom: apiCard.evolvesFrom,
        evolvesTo: apiCard.evolvesTo,
        rules: apiCard.rules,
        attacks: attacks.map(attack => ({
          name: attack.name || 'Unknown Attack',
          cost: Array.isArray(attack.cost) ? attack.cost : [],
          convertedEnergyCost: attack.convertedEnergyCost || 0,
          damage: attack.damage || '',
          text: attack.text || ''
        })),
        weaknesses: weaknesses.map(weakness => ({
          type: weakness.type || 'Unknown',
          value: weakness.value || '×2'
        })),
        resistances: resistances.map(resistance => ({
          type: resistance.type || 'Unknown',
          value: resistance.value || '-20'
        })),
        retreatCost: apiCard.retreatCost,
        convertedRetreatCost: apiCard.convertedRetreatCost,
        isFoil,
        isReverseHolo: false,
        estimatedValue,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    })();
    const duration = Date.now() - start;
    console.log(`[PackGenerator][TIMING] processCardData(${apiCard.name}) total duration: ${duration}ms`);
    return result;
  }

  /**
   * Determine foil status based on rarity
   */
  determineFoilStatus(rarity) {
    if (!rarity) return false;
    
    const rarityLower = rarity.toLowerCase();
    const foilRarities = ['holo-rare', 'ultra-rare', 'secret-rare'];
    
    return foilRarities.includes(rarityLower);
  }

  /**
   * Estimate card value based on rarity and foil status
   */
  estimateCardValue(rarity, isFoil) {
    if (!rarity) return 10;
    
    const rarityLower = rarity.toLowerCase();
    let baseValue = 10;
    
    switch (rarityLower) {
      case 'common':
        baseValue = 10;
        break;
      case 'uncommon':
        baseValue = 25;
        break;
      case 'rare':
        baseValue = 100;
        break;
      case 'holo-rare':
        baseValue = 250;
        break;
      case 'ultra-rare':
        baseValue = 500;
        break;
      case 'secret-rare':
        baseValue = 1000;
        break;
      default:
        baseValue = 50;
    }
    
    // Apply foil multiplier
    if (isFoil) {
      baseValue *= 1.5;
    }
    
    return Math.round(baseValue);
  }

  /**
   * Generate fallback card when API fails
   */
  async getFallbackCard(rarity) {
    const fallbackCards = {
      common: {
        name: 'Pikachu',
        rarity: 'Common',
        supertype: 'Pokémon',
        subtypes: ['Basic'],
        hp: '60',
        types: ['Lightning'],
        attacks: [{
          name: 'Thunder Shock',
          cost: ['Lightning'],
          convertedEnergyCost: 1,
          damage: '20',
          text: 'Flip a coin. If heads, your opponent\'s Active Pokémon is now Paralyzed.'
        }],
        weaknesses: [{ type: 'Fighting', value: '×2' }],
        resistances: [],
        retreatCost: ['Colorless'],
        convertedRetreatCost: 1,
        images: {
          small: 'https://images.pokemontcg.io/base1/58.png',
          large: 'https://images.pokemontcg.io/base1/58_hires.png'
        }
      },
      uncommon: {
        name: 'Raichu',
        rarity: 'Uncommon',
        supertype: 'Pokémon',
        subtypes: ['Stage 1'],
        hp: '90',
        types: ['Lightning'],
        attacks: [{
          name: 'Thunder',
          cost: ['Lightning', 'Lightning'],
          convertedEnergyCost: 2,
          damage: '60',
          text: 'Flip a coin. If tails, this Pokémon does 20 damage to itself.'
        }],
        weaknesses: [{ type: 'Fighting', value: '×2' }],
        resistances: [],
        retreatCost: ['Colorless'],
        convertedRetreatCost: 1,
        images: {
          small: 'https://images.pokemontcg.io/base1/14.png',
          large: 'https://images.pokemontcg.io/base1/14_hires.png'
        }
      },
      rare: {
        name: 'Charizard',
        rarity: 'Rare',
        supertype: 'Pokémon',
        subtypes: ['Stage 2'],
        hp: '120',
        types: ['Fire'],
        attacks: [{
          name: 'Fire Spin',
          cost: ['Fire', 'Fire', 'Fire'],
          convertedEnergyCost: 3,
          damage: '100',
          text: 'Discard 2 Energy attached to this Pokémon.'
        }],
        weaknesses: [{ type: 'Water', value: '×2' }],
        resistances: [],
        retreatCost: ['Colorless', 'Colorless'],
        convertedRetreatCost: 2,
        images: {
          small: 'https://images.pokemontcg.io/base1/4.png',
          large: 'https://images.pokemontcg.io/base1/4_hires.png'
        }
      },
      energy: {
        name: 'Basic Energy',
        rarity: 'Common',
        supertype: 'Energy',
        subtypes: ['Basic'],
        types: ['Colorless'],
        hp: '',
        attacks: [],
        weaknesses: [],
        resistances: [],
        retreatCost: [],
        convertedRetreatCost: 0,
        images: {
          small: 'https://images.pokemontcg.io/base1/98.png',
          large: 'https://images.pokemontcg.io/base1/98_hires.png'
        }
      }
    };
    
    const fallback = fallbackCards[rarity] || fallbackCards.common;
    
    // Generate unique cardId for each fallback card
    const uniqueId = `fallback_${fallback.name.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      cardId: uniqueId,
      name: fallback.name,
      rarity: fallback.rarity,
      supertype: fallback.supertype,
      subtypes: fallback.subtypes,
      hp: fallback.hp,
      types: fallback.types,
      attacks: fallback.attacks,
      weaknesses: fallback.weaknesses,
      resistances: fallback.resistances,
      retreatCost: fallback.retreatCost,
      convertedRetreatCost: fallback.convertedRetreatCost,
      isFoil: false,
      isReverseHolo: false,
      estimatedValue: this.estimateCardValue(fallback.rarity, false),
      images: fallback.images
    };
  }

  /**
   * Generate fallback pack when everything fails
   */
  async generateFallbackPack(packConfig) {
    console.log('[PackGenerator] Generating fallback pack');
    
    const fallbackCards = [];
    const allowedSets = packConfig.allowedSets || [];
    const isClassicSet = allowedSets.some(set => ['base1', 'base2', 'base3'].includes(set));
    
    // Generate exactly 11 cards for classic sets, 10 for modern sets
    const expectedCards = isClassicSet ? 11 : 10;
    
    if (isClassicSet) {
      // Classic sets: 7 commons + 3 uncommons + 1 rare* = 11 cards
      // Add 7 commons
      for (let i = 0; i < 7; i++) {
        const fallbackCard = await this.getFallbackCard('common');
        fallbackCards.push(fallbackCard);
      }
      // Add 3 uncommons
      for (let i = 0; i < 3; i++) {
        const fallbackCard = await this.getFallbackCard('uncommon');
        fallbackCards.push(fallbackCard);
      }
      // Add 1 rare (try rare, rare holo, promo, rare secret)
      const rareTypes = ['rare', 'Rare Holo', 'Promo', 'Rare Secret'];
      let rareAdded = false;
      for (const rareType of rareTypes) {
        if (!rareAdded) {
          const fallbackCard = await this.getFallbackCard(rareType);
          if (fallbackCard) {
            fallbackCards.push(fallbackCard);
            rareAdded = true;
          }
        }
      }
      if (!rareAdded) {
        const fallbackCard = await this.getFallbackCard('common');
        fallbackCards.push(fallbackCard);
      }
    } else {
      // Modern sets: 6 commons + 3 uncommons + 1 rare = 10 cards
      
      // Add 6 commons
      for (let i = 0; i < 6; i++) {
        const fallbackCard = await this.getFallbackCard('common');
        fallbackCards.push(fallbackCard);
      }
      
      // Add 3 uncommons
      for (let i = 0; i < 3; i++) {
        const fallbackCard = await this.getFallbackCard('uncommon');
        fallbackCards.push(fallbackCard);
      }
      
      // Add 1 rare
      const rareCard = await this.getFallbackCard('rare');
      fallbackCards.push(rareCard);
    }
    
    return this.shuffleCards(fallbackCards);
  }

  /**
   * Shuffle cards using Fisher-Yates algorithm
   */
  shuffleCards(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Log cache statistics
   */
  logCacheStats() {
    console.log('[PackGenerator] Cache Stats:', {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      apiCalls: this.cacheStats.apiCalls,
      fallbackUses: this.cacheStats.fallbackUses,
      cacheSize: Object.keys(this.cardCache).length
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cardCache = {};
    this.cacheStats = {
      hits: 0,
      misses: 0,
      apiCalls: 0,
      fallbackUses: 0
    };
    console.log('[PackGenerator] Cache cleared');
  }

  /**
   * Add cards to user's collection
   */
  async addCardsToCollection(cards, userId, discordId, guildId, packId) {
    try {
      console.log(`[PackGenerator] Adding ${cards.length} cards to collection for user ${discordId}`);
      const savedCards = [];
      const newCardDocs = [];
      for (const cardData of cards) {
        try {
          const cardDocument = {
            user: userId,
            discordId,
            guildId,
            cardId: cardData.cardId || `fallback_${Date.now()}_${Math.random()}`,
            name: cardData.name || 'Unknown Card',
            set: cardData.set || {},
            images: cardData.images || {},
            rarity: cardData.rarity || 'Common',
            supertype: cardData.supertype || 'Pokémon',
            subtypes: cardData.subtypes || [],
            types: cardData.types || [],
            hp: cardData.hp,
            attacks: cardData.attacks || [],
            weaknesses: cardData.weaknesses || [],
            resistances: cardData.resistances || [],
            retreatCost: cardData.retreatCost || [],
            convertedRetreatCost: cardData.convertedRetreatCost || 0,
            condition: 'Near Mint',
            isFoil: cardData.isFoil || false,
            isReverseHolo: cardData.isReverseHolo || false,
            count: 1,
            obtainedAt: new Date(),
            obtainedFrom: 'pack',
            packId,
            estimatedValue: cardData.estimatedValue || 10
          };
          // Check if card already exists (more robust query)
          const existingCard = await Card.findOne({
            discordId,
            guildId,
            cardId: cardDocument.cardId,
            condition: cardDocument.condition,
            isFoil: cardDocument.isFoil,
            isReverseHolo: cardDocument.isReverseHolo
          });
          if (existingCard) {
            existingCard.count += 1;
            await existingCard.save();
            savedCards.push(existingCard);
            console.log(`[PackGenerator] Incremented count for existing card: ${cardDocument.name}`);
          } else {
            newCardDocs.push(cardDocument);
            console.log(`[PackGenerator] Prepared new card for batch insert: ${cardDocument.name}`);
          }
        } catch (err) {
          console.error(`[PackGenerator] Error processing card: ${cardData.name}`, err);
        }
      }
      // Batch insert new cards
      if (newCardDocs.length > 0) {
        const inserted = await Card.insertMany(newCardDocs);
        savedCards.push(...inserted);
        newCardDocs.forEach(doc => console.log(`[PackGenerator] Created new card: ${doc.name}`));
      }
      console.log(`[PackGenerator] Successfully processed ${cards.length} cards`);
      return savedCards;
    } catch (err) {
      console.error('[PackGenerator] Error adding cards to collection:', err);
      return [];
    }
  }

  /**
   * Create a fallback card when there's an error
   */
  async createFallbackCard(userId, discordId, guildId, packId, originalName) {
    try {
      const fallbackCard = new Card({
        user: userId,
        discordId,
        guildId,
        cardId: `error_fallback_${Date.now()}_${Math.random()}`,
        name: originalName || 'Error Card',
        rarity: 'Common',
        supertype: 'Pokémon',
        subtypes: ['Basic'],
        types: ['Colorless'],
        hp: '50',
        attacks: [],
        weaknesses: [],
        resistances: [],
        retreatCost: [],
        convertedRetreatCost: 0,
        condition: 'Near Mint',
        isFoil: false,
        isReverseHolo: false,
        count: 1,
        obtainedAt: new Date(),
        obtainedFrom: 'pack',
        packId,
        estimatedValue: 5,
        images: {
          small: 'https://images.pokemontcg.io/base1/58.png',
          large: 'https://images.pokemontcg.io/base1/58_hires.png'
        }
      });
      await fallbackCard.save();
      return fallbackCard;
    } catch (error) {
      console.error('[PackGenerator] Error creating fallback card:', error);
      throw error;
    }
  }

  /**
   * Get pack opening statistics
   */
  async getPackStats(discordId, guildId) {
    try {
      const stats = await Card.aggregate([
        { $match: { discordId, guildId } },
        {
          $group: {
            _id: '$packId',
            totalCards: { $sum: 1 },
            uniqueCards: { $addToSet: '$cardId' },
            totalValue: { $sum: '$estimatedValue' },
            rarestCard: { $max: '$estimatedValue' }
          }
        },
        {
          $project: {
            packId: '$_id',
            totalCards: 1,
            uniqueCards: { $size: '$uniqueCards' },
            totalValue: 1,
            rarestCard: 1
          }
        }
      ]);
      
      return stats;
      
    } catch (error) {
      console.error('[PackGenerator] Error getting pack stats:', error);
      return [];
    }
  }
}

module.exports = PackGenerator;