const tcgApi = require('./tcgApi');
const Card = require('../models/Card');
const CardPack = require('../models/CardPack');

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
    
    // Official pack structure based on historical research
    // Classic sets (Base, Jungle, Fossil): 5 commons + 3 uncommons + 1 rare + 2 energy = 11 cards
    // Modern sets: 6 commons + 3 uncommons + 1 rare = 10 cards (energy/trainers replace commons)
    this.officialPackStructure = {
      commons: 5,
      uncommons: 3,
      rare: 1,
      energy: 2
    };
    
    // Rarity upgrade chances
    this.rarityUpgrades = {
      rareToHolo: 0.33, // 33% chance rare becomes holo (historical accuracy for classic sets)
      rareToUltra: 0.05, // 5% chance rare becomes ultra rare
      reverseHolo: 0.33 // 33% chance of reverse holo (only for modern sets)
    };
  }

  /**
   * Generate cards for a pack based on its configuration
   */
  async generatePackCards(packConfig) {
    console.log(`[PackGenerator] Generating pack: ${packConfig.name} (${packConfig.packId})`);
    
    try {
      // Build the pack skeleton with official ratios
      const packSkeleton = await this.buildPackSkeleton(packConfig);
      
      // Apply rarity upgrades and guarantees
      await this.applyRarityUpgrades(packSkeleton, packConfig);
      
      // Apply reverse holo slot
      await this.applyReverseHolo(packSkeleton, packConfig);
      
      // Shuffle the cards
      const shuffledCards = this.shuffleCards(packSkeleton);
      
      // Check if this is a classic set for validation
      const isClassicSet = packConfig.allowedSets.some(set => ['base1', 'base2', 'base3'].includes(set));
      
      // Ensure we have the correct number of cards
      const expectedCards = isClassicSet ? 9 : 10;
      if (shuffledCards.length !== expectedCards) {
        console.warn(`[PackGenerator] Warning: Generated ${shuffledCards.length} cards, expected ${expectedCards}. Trimming/expanding to ${expectedCards}.`);
        
        if (shuffledCards.length > expectedCards) {
          shuffledCards.splice(expectedCards); // Remove extra cards
        } else {
          // Add fallback cards to reach expected count
          while (shuffledCards.length < expectedCards) {
            const fallbackCard = await this.getFallbackCard('common');
            shuffledCards.push(fallbackCard);
          }
        }
      }
      
      console.log(`[PackGenerator] Generated ${shuffledCards.length} cards for pack`);
      this.logCacheStats();
      
      return shuffledCards;
      
    } catch (error) {
      console.error('[PackGenerator] Error generating pack cards:', error);
      // Return fallback cards if everything fails
      return this.generateFallbackPack(packConfig);
    }
  }

  /**
   * Build the basic pack skeleton with official ratios
   */
  async buildPackSkeleton(packConfig) {
    const skeleton = [];
    const allowedSets = packConfig.allowedSets || [];
    
    // Check if this is a classic set (Base Set, Jungle, Fossil)
    const isClassicSet = allowedSets.some(set => ['base1', 'base2', 'base3'].includes(set));
    
    if (isClassicSet) {
      // Classic sets: 5 commons + 3 uncommons + 1 rare = 9 cards (no energy)
      // Historical accuracy: No trainer cards, no reverse-holos, no energy cards
      // Add commons (5 cards)
      const commons = await this.getCardsByRarity('common', 5, allowedSets);
      skeleton.push(...commons);
      // Add uncommons (3 cards)
      const uncommons = await this.getCardsByRarity('uncommon', 3, allowedSets);
      skeleton.push(...uncommons);
      // Add rare slot (1 card)
      const rares = await this.getCardsByRarity('rare', 1, allowedSets);
      skeleton.push(...rares);
    } else {
      // Modern sets: 6 commons + 3 uncommons + 1 rare = 10 cards
      // Energy and trainer cards replace commons
      
      let commonsNeeded = this.officialPackStructure.commons;
      let uncommonsNeeded = this.officialPackStructure.uncommons;
      let raresNeeded = this.officialPackStructure.rare;
      
      // Add trainer cards (replaces commons)
      const trainerCount = Math.min(2, commonsNeeded); // Max 2 trainers
      const trainers = await this.getTrainerCards(trainerCount, allowedSets);
      skeleton.push(...trainers);
      commonsNeeded -= trainers.length;
      
      // Add remaining commons
      const commons = await this.getCardsByRarity('common', commonsNeeded, allowedSets);
      skeleton.push(...commons);
      
      // Add uncommons
      const uncommons = await this.getCardsByRarity('uncommon', uncommonsNeeded, allowedSets);
      skeleton.push(...uncommons);
      
      // Add rare slot
      const rares = await this.getCardsByRarity('rare', raresNeeded, allowedSets);
      skeleton.push(...rares);
    }
    
    return skeleton;
  }

  /**
   * Preload and cache all cards for a set (lazy loading)
   */
  async preloadSet(setCode) {
    if (this.cardCache[setCode]) {
      this.cacheStats.hits++;
      return this.cardCache[setCode];
    }
    this.cacheStats.misses++;
    try {
      this.cacheStats.apiCalls++;
      // Fetch all cards for the set (up to 500, adjust if needed)
      const data = await tcgApi.getCardsBySet(setCode, 1, 500);
      const allCards = data.data || [];
      // Split by rarity and supertype
      const byRarity = {
        common: [],
        uncommon: [],
        rare: [],
        holoRare: [],
        ultraRare: [],
        energy: []
      };
      for (const card of allCards) {
        if (card.supertype === 'Energy' && card.subtypes && card.subtypes.includes('Basic')) {
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
      }
      this.cardCache[setCode] = byRarity;
      return byRarity;
    } catch (error) {
      console.error(`[PackGenerator] Error preloading set ${setCode}:`, error);
      return null;
    }
  }

  /**
   * Get cards by rarity with caching (uses preloaded set cache)
   */
  async getCardsByRarity(rarity, count, allowedSets = []) {
    const cards = [];
    const isClassicSet = allowedSets.some(set => ['base1', 'base2', 'base3'].includes(set));
    let queryRarity = rarity;
    if (isClassicSet && rarity === 'rare') {
      queryRarity = '(rarity:"Rare" OR rarity:"Rare Holo" OR rarity:"Rare Holo Foil")';
    }
    // Try to use cache for each allowed set
    for (const setCode of allowedSets) {
      const setCache = await this.preloadSet(setCode);
      if (setCache) {
        let pool = [];
        if (queryRarity === 'common') pool = setCache.common;
        else if (queryRarity === 'uncommon') pool = setCache.uncommon;
        else if (queryRarity === 'rare' || queryRarity.includes('Rare')) pool = setCache.rare.concat(setCache.holoRare, setCache.ultraRare);
        else pool = setCache.common;
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
    const poolCopy = [...pool];
    
    const actualCount = Math.min(count, poolCopy.length);
    
    for (let i = 0; i < actualCount; i++) {
      const randomIndex = Math.floor(Math.random() * poolCopy.length);
      selected.push(poolCopy[randomIndex]);
      poolCopy.splice(randomIndex, 1);
    }
    
    return selected;
  }

  /**
   * Process card data from TCG API (simplified)
   */
  async processCardData(apiCard) {
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
      // Classic sets: 5 commons + 3 uncommons + 1 rare + 2 energy = 11 cards
      
      // Add 2 energy cards for classic sets
      for (let i = 0; i < 2; i++) {
        const energyCard = await this.getFallbackCard('common');
        energyCard.name = 'Basic Energy';
        energyCard.supertype = 'Energy';
        energyCard.subtypes = ['Basic'];
        energyCard.types = ['Colorless'];
        fallbackCards.push(energyCard);
      }
      
      // Add 5 commons
      for (let i = 0; i < 5; i++) {
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
      
      for (const cardData of cards) {
        try {
          // Ensure required fields are present
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
            // Increment count of existing card
            existingCard.count += 1;
            await existingCard.save();
            savedCards.push(existingCard);
            console.log(`[PackGenerator] Incremented count for existing card: ${cardDocument.name}`);
          } else {
            // Try to create new card, but handle duplicate key errors
            try {
              const card = new Card(cardDocument);
              await card.save();
              savedCards.push(card);
              console.log(`[PackGenerator] Created new card: ${cardDocument.name}`);
            } catch (insertError) {
              // If it's a duplicate key error, try to find and increment the existing card
              if (insertError.code === 11000) {
                console.log(`[PackGenerator] Duplicate key error for ${cardDocument.name}, trying to find existing card`);
                
                // Try a broader search to find the existing card
                const existingCard = await Card.findOne({
                  discordId,
                  guildId,
                  cardId: cardDocument.cardId
                });
                
                if (existingCard) {
                  // Increment count of existing card
                  existingCard.count += 1;
                  await existingCard.save();
                  savedCards.push(existingCard);
                  console.log(`[PackGenerator] Found and incremented existing card: ${cardDocument.name}`);
                } else {
                  // If we still can't find it, create a fallback
                  console.log(`[PackGenerator] Could not find existing card for ${cardDocument.name}, creating fallback`);
                  const fallbackCard = await this.createFallbackCard(userId, discordId, guildId, packId, cardDocument.name);
                  savedCards.push(fallbackCard);
                }
              } else {
                // Re-throw non-duplicate key errors
                throw insertError;
              }
            }
          }
          
        } catch (error) {
          console.error('[PackGenerator] Error processing card:', error);
          // Create a fallback card if there's an error
          try {
            const fallbackCard = await this.createFallbackCard(userId, discordId, guildId, packId, cardData.name);
            savedCards.push(fallbackCard);
          } catch (fallbackError) {
            console.error('[PackGenerator] Error creating fallback card:', fallbackError);
          }
        }
      }
      
      console.log(`[PackGenerator] Successfully processed ${savedCards.length} cards`);
      return savedCards;
      
    } catch (error) {
      console.error('[PackGenerator] Error adding cards to collection:', error);
      throw error;
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