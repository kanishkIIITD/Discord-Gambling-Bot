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

// Retry configuration for 504 errors
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  timeout: 300000, // 30 seconds
};

// Circuit breaker configuration
const CIRCUIT_BREAKER = {
  failureThreshold: 5, // Number of failures before opening circuit
  recoveryTimeout: 60000, // 1 minute before attempting to close circuit
  monitorInterval: 10000, // Check circuit state every 10 seconds
};

class TCGAPI {
  constructor() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.hourlyRequests = 0;
    this.lastHourReset = Date.now();
    
    // Circuit breaker state
    this.circuitState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    
    // Start circuit breaker monitor
    this.startCircuitBreakerMonitor();
  }

  /**
   * Circuit breaker monitor
   */
  startCircuitBreakerMonitor() {
    setInterval(() => {
      this.checkCircuitBreaker();
    }, CIRCUIT_BREAKER.monitorInterval);
  }

  /**
   * Check and update circuit breaker state
   */
  checkCircuitBreaker() {
    const now = Date.now();
    
    if (this.circuitState === 'OPEN' && now >= this.nextAttemptTime) {
      console.log('[TCG API] Circuit breaker attempting to close (HALF_OPEN)');
      this.circuitState = 'HALF_OPEN';
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess() {
    if (this.circuitState === 'HALF_OPEN') {
      console.log('[TCG API] Circuit breaker closing - API is working again');
      this.circuitState = 'CLOSED';
    }
    this.failureCount = 0;
  }

  /**
   * Record a failed request
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= CIRCUIT_BREAKER.failureThreshold && this.circuitState === 'CLOSED') {
      console.log(`[TCG API] Circuit breaker opening - ${this.failureCount} consecutive failures`);
      this.circuitState = 'OPEN';
      this.nextAttemptTime = Date.now() + CIRCUIT_BREAKER.recoveryTimeout;
    }
  }

  /**
   * Check if circuit breaker allows requests
   */
  isCircuitBreakerOpen() {
    if (this.circuitState === 'OPEN') {
      const timeUntilRetry = this.nextAttemptTime - Date.now();
      if (timeUntilRetry > 0) {
        console.log(`[TCG API] Circuit breaker is OPEN, retry in ${Math.ceil(timeUntilRetry / 1000)}s`);
        return true;
      }
    }
    return false;
  }

  /**
   * Retry function with exponential backoff for 504 errors
   */
  async retryWithBackoff(fn, retries = RETRY_CONFIG.maxRetries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const isRetryable = error.response?.status === 504 || 
                           error.response?.status >= 500 ||
                           error.code === 'ECONNRESET' || 
                           error.code === 'ETIMEDOUT' ||
                           error.code === 'ENOTFOUND' ||
                           error.code === 'ECONNABORTED';

        if (isLastAttempt || !isRetryable) {
          throw error;
        }

        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelay
        );
        
        console.log(`[TCG API] Retrying request in ${delay}ms (attempt ${attempt + 1}/${retries + 1}) due to ${error.response?.status || error.code}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Make a rate-limited request to the TCG API with retry logic
   */
  async makeRequest(endpoint, params = {}) {
    // Check circuit breaker first
    if (this.isCircuitBreakerOpen()) {
      throw new Error('TCG API is temporarily unavailable due to repeated failures. Please try again later.');
    }

    // Check rate limits
    await this.checkRateLimit();

    const url = `${TCG_API_BASE_URL}${endpoint}`;
    const config = {
      params,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Pokemon-Gambling-Bot/1.0'
      },
      timeout: RETRY_CONFIG.timeout
    };

    // Add API key if available
    if (TCG_API_KEY) {
      config.headers['X-Api-Key'] = TCG_API_KEY;
    }

    return await this.retryWithBackoff(async () => {
      try {
        const response = await axios.get(url, config);
        this.updateRequestCount();
        this.recordSuccess();
        return response.data;
      } catch (error) {
        console.error(`[TCG API] Error making request to ${endpoint}:`, error.message);
        
        // Record failure for circuit breaker
        this.recordFailure();
        
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.response?.status === 404) {
          throw new Error('Card not found.');
        } else if (error.response?.status === 504) {
          throw new Error(`Gateway timeout (504) for ${endpoint}. Retrying...`);
        } else if (error.response?.status >= 500) {
          throw new Error(`TCG API server error (${error.response.status}) for ${endpoint}. Retrying...`);
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new Error(`Request timeout for ${endpoint}. Retrying...`);
        } else {
          throw new Error(`API request failed: ${error.message}`);
        }
      }
    });
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
   * Reset circuit breaker (for testing/debugging)
   */
  resetCircuitBreaker() {
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    console.log('[TCG API] Circuit breaker manually reset');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cardCacheSize: cardCache.size,
      setCacheSize: setCache.size,
      requestCount: this.requestCount,
      hourlyRequests: this.hourlyRequests,
      circuitBreaker: {
        state: this.circuitState,
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime,
        nextAttemptTime: this.nextAttemptTime
      }
    };
  }
}

// Create singleton instance
const tcgApi = new TCGAPI();

module.exports = tcgApi; 