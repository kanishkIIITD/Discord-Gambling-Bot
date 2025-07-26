const axios = require('axios');
const { redis, REDIS_KEY, CACHE_TTL_SEC } = require('./redisCache');

// Pokémon TCG API configuration
const TCG_API_BASE_URL = 'https://api.pokemontcg.io/v2';
const TCG_API_KEY = process.env.POKEMON_TCG_API_KEY; // Optional API key for higher rate limits

// Rate limiting configuration
const RATE_LIMIT = {
  requestsPerMinute: 30, // Free tier limit
  requestsPerHour: 1000
};

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const cardCache = new Map();
const setCache = new Map();

class TCGAPI {
  constructor() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.hourlyRequests = 0;
    this.lastHourReset = Date.now();
  }

  /**
   * Make a rate-limited request to the TCG API
   */
  async makeRequest(endpoint, params = {}) {
    // Check rate limits
    await this.checkRateLimit();

    const url = `${TCG_API_BASE_URL}${endpoint}`;
    const config = {
      params,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Pokemon-Gambling-Bot/1.0'
      }
    };

    // Add API key if available
    if (TCG_API_KEY) {
      config.headers['X-Api-Key'] = TCG_API_KEY;
    }

    try {
      const response = await axios.get(url, config);
      this.updateRequestCount();
      return response.data;
    } catch (error) {
      console.error(`[TCG API] Error making request to ${endpoint}:`, error.message);
      
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.response?.status === 404) {
        throw new Error('Card not found.');
      } else if (error.response?.status >= 500) {
        throw new Error('TCG API server error. Please try again later.');
      } else {
        throw new Error(`API request failed: ${error.message}`);
      }
    }
  }

  /**
   * Check and enforce rate limits
   */
  async checkRateLimit() {
    const now = Date.now();
    
    // Reset hourly counter if needed
    if (now - this.lastHourReset > 60 * 60 * 1000) {
      this.hourlyRequests = 0;
      this.lastHourReset = now;
    }

    // Check hourly limit
    if (this.hourlyRequests >= RATE_LIMIT.requestsPerHour) {
      const waitTime = 60 * 60 * 1000 - (now - this.lastHourReset);
      throw new Error(`Hourly rate limit exceeded. Please try again in ${Math.ceil(waitTime / 60000)} minutes.`);
    }

    // Check per-minute limit
    if (now - this.lastRequestTime < 60000) {
      if (this.requestCount >= RATE_LIMIT.requestsPerMinute) {
        const waitTime = 60000 - (now - this.lastRequestTime);
        throw new Error(`Rate limit exceeded. Please try again in ${Math.ceil(waitTime / 1000)} seconds.`);
      }
    } else {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }
  }

  /**
   * Update request counters
   */
  updateRequestCount() {
    this.requestCount++;
    this.hourlyRequests++;
  }

  /**
   * Get card by ID
   */
  async getCardById(cardId) {
    const cacheKey = `card_${cardId}`;
    
    // Check cache first
    if (cardCache.has(cacheKey)) {
      const cached = cardCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    }

    const data = await this.makeRequest(`/cards/${cardId}`);
    
    // Cache the result
    cardCache.set(cacheKey, {
      data: data.data,
      timestamp: Date.now()
    });

    return data.data;
  }

  /**
   * Search for cards
   */
  async searchCards(query, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      set = null,
      rarity = null,
      type = null,
      supertype = null
    } = options;

    const params = {
      q: query,
      page,
      pageSize
    };

    if (set) params.set = set;
    if (rarity) params.rarity = rarity;
    if (type) params.types = type;
    if (supertype) params.supertype = supertype;

    const data = await this.makeRequest('/cards', params);
    return data;
  }

  /**
   * Get all sets
   */
  async getSets() {
    const cacheKey = 'sets';
    
    // Check cache first
    if (setCache.has(cacheKey)) {
      const cached = setCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
    }

    const data = await this.makeRequest('/sets');
    
    // Cache the result
    setCache.set(cacheKey, {
      data: data.data,
      timestamp: Date.now()
    });

    return data.data;
  }

  /**
   * Get cards from a specific set (now Redis-cached)
   */
  async getCardsBySet(setId, page = 1, pageSize = 20) {
    // Only cache full set fetches (page=1, pageSize>=100)
    if (page === 1 && pageSize >= 100) {
      const key = REDIS_KEY(setId);
      let cached = await redis.get(key);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          // Fallback to API if cache is corrupted
        }
      }
      const params = {
        q: `set.id:${setId}`,
        page,
        pageSize
      };
      const data = await this.makeRequest('/cards', params);
      const cards = data.data || [];
      await redis.set(key, JSON.stringify(cards), 'EX', CACHE_TTL_SEC);
      return cards;
    } else {
      // Fallback to old behavior for partial fetches
      const params = {
        q: `set.id:${setId}`,
        page,
        pageSize
      };
      const data = await this.makeRequest('/cards', params);
      return data.data || [];
    }
  }

  /**
   * Get random cards for pack generation
   */
  async getRandomCards(rarity, count = 1, allowedSets = null) {
    // Define rarity mappings for the API
    const rarityMap = {
      'common': 'Common',
      'uncommon': 'Uncommon', 
      'rare': 'Rare',
      'holo-rare': 'Rare Holo',
      'ultra-rare': 'Ultra Rare'
    };

    const apiRarity = rarityMap[rarity] || rarity;
    
    // Build query based on rarity and allowed sets
    let query = `rarity:"${apiRarity}"`;
    
    // Add set restrictions if specified
    if (allowedSets && allowedSets.length > 0) {
      const setQueries = allowedSets.map(set => `set.id:${set}`).join(' OR ');
      query = `(${query}) AND (${setQueries})`;
    }
    
    console.log(`[TCG API] Query: ${query}`);
    
    const params = {
      q: query,
      pageSize: Math.min(count * 3, 100), // Get more cards than needed for better randomization
    };

    try {
      const data = await this.makeRequest('/cards', params);
      
      // Debug: Log the first card to see the data structure
      if (data.data && data.data.length > 0) {
        console.log('[TCG API] Sample card data:', {
          id: data.data[0].id,
          name: data.data[0].name,
          set: data.data[0].set?.id,
          weaknesses: data.data[0].weaknesses,
          weaknessesType: typeof data.data[0].weaknesses,
          resistances: data.data[0].resistances,
          resistancesType: typeof data.data[0].resistances
        });
      }
      
      // Randomly select the requested number of cards
      const cards = data.data || [];
      const selectedCards = [];
      
      for (let i = 0; i < Math.min(count, cards.length); i++) {
        const randomIndex = Math.floor(Math.random() * cards.length);
        selectedCards.push(cards[randomIndex]);
        cards.splice(randomIndex, 1); // Remove selected card to avoid duplicates
      }

      return selectedCards;
    } catch (error) {
      console.error(`[TCG API] Error in getRandomCards: ${error.message}`);
      console.error(`[TCG API] Query was: ${query}`);
      
      // If the specific rarity query fails, try a broader search
      if (allowedSets && allowedSets.length > 0) {
        console.log(`[TCG API] Trying fallback search for sets: ${allowedSets.join(', ')}`);
        try {
          const fallbackQuery = allowedSets.map(set => `set.id:${set}`).join(' OR ');
          const fallbackParams = {
            q: fallbackQuery,
            pageSize: Math.min(count * 5, 100)
          };
          
          const fallbackData = await this.makeRequest('/cards', fallbackParams);
          const fallbackCards = fallbackData.data || [];
          
          // Filter by rarity manually
          const filteredCards = fallbackCards.filter(card => {
            const cardRarity = card.rarity?.toLowerCase();
            return cardRarity === apiRarity.toLowerCase() || 
                   (rarity === 'rare' && cardRarity.includes('rare')) ||
                   (rarity === 'holo-rare' && cardRarity.includes('holo')) ||
                   (rarity === 'ultra-rare' && cardRarity.includes('ultra'));
          });
          
          const selectedCards = [];
          for (let i = 0; i < Math.min(count, filteredCards.length); i++) {
            const randomIndex = Math.floor(Math.random() * filteredCards.length);
            selectedCards.push(filteredCards[randomIndex]);
            filteredCards.splice(randomIndex, 1);
          }
          
          console.log(`[TCG API] Fallback search found ${selectedCards.length} cards`);
          return selectedCards;
          
        } catch (fallbackError) {
          console.error(`[TCG API] Fallback search also failed: ${fallbackError.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get energy cards specifically
   */
  async getEnergyCards(allowedSets = null) {
    // Build query for energy cards
    let query = 'supertype:Energy AND subtypes:Basic';
    
    // Add set restrictions if specified
    if (allowedSets && allowedSets.length > 0) {
      const setQueries = allowedSets.map(set => `set.id:${set}`).join(' OR ');
      query = `(${query}) AND (${setQueries})`;
    }
    
    console.log(`[TCG API] Energy query: ${query}`);
    
    const params = {
      q: query,
      pageSize: 20
    };

    try {
      const data = await this.makeRequest('/cards', params);
      return data.data || [];
    } catch (error) {
      console.error(`[TCG API] Error getting energy cards: ${error.message}`);
      return [];
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    cardCache.clear();
    setCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cardCacheSize: cardCache.size,
      setCacheSize: setCache.size,
      requestCount: this.requestCount,
      hourlyRequests: this.hourlyRequests
    };
  }
}

// Create singleton instance
const tcgApi = new TCGAPI();

module.exports = tcgApi; 