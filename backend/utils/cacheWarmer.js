const axios = require('axios');
const { setCachedMove, getCachedMove, moveEffectRegistry } = require('./battleUtils');

// Simple concurrency limiter (ES module compatible)
function createConcurrencyLimiter(concurrency) {
  let running = 0;
  const queue = [];
  
  const run = async (fn) => {
    if (running >= concurrency) {
      await new Promise(resolve => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      if (queue.length > 0) {
        queue.shift()();
      }
    }
  };
  
  return run;
}

// Configuration
const CONFIG = {
  CONCURRENCY_LIMIT: 30,        // Max concurrent requests
  RETRY_ATTEMPTS: 3,            // Number of retries per request
  RETRY_DELAY: 1000,            // Base delay for exponential backoff (ms)
  BATCH_SIZE: 50,               // Process moves in batches for logging
  CACHE_TTL: 24 * 60 * 60,     // 24 hours cache TTL
  API_TIMEOUT: 10000,           // 10 second timeout for API calls
};

// Metrics tracking
const metrics = {
  totalMoves: 0,
  warmedMoves: 0,
  failedMoves: 0,
  retriedMoves: 0,
  startTime: null,
  endTime: null,
};

/**
 * Get all move names from the PokéAPI
 */
async function getAllMoveNames() {
  try {
    console.log('[CacheWarmer] Fetching complete move list from PokéAPI...');
    const { data } = await axios.get('https://pokeapi.co/api/v2/move?limit=10000', {
      timeout: CONFIG.API_TIMEOUT
    });
    
    const moveNames = data.results.map(r => r.name);
    console.log(`[CacheWarmer] Found ${moveNames.length} total moves`);
    return moveNames;
  } catch (error) {
    console.error('[CacheWarmer] Failed to fetch move list:', error.message);
    throw error;
  }
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, attempts = CONFIG.RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === attempts - 1;
      const isRetryable = error.response?.status >= 500 || 
                          error.code === 'ECONNRESET' || 
                          error.code === 'ETIMEDOUT' ||
                          error.code === 'ENOTFOUND';
      
      if (isLastAttempt || !isRetryable) {
        throw error;
      }
      
      const delay = CONFIG.RETRY_DELAY * Math.pow(2, i);
      console.log(`[CacheWarmer] Retrying request in ${delay}ms (attempt ${i + 1}/${attempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Fetch and cache a single move
 */
async function fetchAndCacheMove(moveName) {
  try {
    // Check if already cached and not expired
    const cached = await getCachedMove(moveName);
    if (cached && cached.fetchedAt) {
      const age = Date.now() - cached.fetchedAt;
      const maxAge = CONFIG.CACHE_TTL * 1000;
      if (age < maxAge) {
        return { name: moveName, status: 'already-cached', success: true };
      } else {
        console.log(`[CacheWarmer] Move ${moveName} is expired (age: ${(age / 1000 / 60).toFixed(1)}min, max: ${(maxAge / 1000 / 60 / 60).toFixed(1)}h), will refresh`);
      }
    } else if (cached) {
      console.log(`[CacheWarmer] Move ${moveName} cached but missing fetchedAt timestamp, will refresh`);
    }
    
    // Fetch move data with retries
    const response = await retryWithBackoff(async () => {
      return axios.get(`https://pokeapi.co/api/v2/move/${moveName}/`, {
        timeout: CONFIG.API_TIMEOUT
      });
    });
    
    const moveData = response.data;
    
    // Prepare cache data with timestamp
    const cacheData = {
      name: moveName,
      power: moveData.power || 0,
      moveType: moveData.type.name,
      category: moveData.damage_class.name,
      accuracy: moveData.accuracy || 100,
      effectType: moveEffectRegistry[moveName.toLowerCase()]?.type || null,
      effectEntries: moveData.effect_entries || [],
      meta: moveData.meta || {},
      basePP: moveData.pp || 5,
      fetchedAt: Date.now(),
    };
    
    // Cache the move
    await setCachedMove(moveName, cacheData);
    return { name: moveName, status: 'cached', success: true };
    
  } catch (error) {
    console.error(`[CacheWarmer] Failed to fetch move ${moveName}:`, error.message);
    return { name: moveName, status: 'error', success: false, error: error.message };
  }
}

/**
 * Warm the move cache by preloading all moves
 */
async function warmMoveCache() {
  console.log('[CacheWarmer] Starting comprehensive move cache warming...');
  
  // Reset metrics
  Object.assign(metrics, {
    totalMoves: 0,
    warmedMoves: 0,
    failedMoves: 0,
    retriedMoves: 0,
    startTime: Date.now(),
    endTime: null,
  });
  
  try {
    // Get all move names
    const moveNames = await getAllMoveNames();
    metrics.totalMoves = moveNames.length;
    
    // Create concurrency limiter
    const limit = createConcurrencyLimiter(CONFIG.CONCURRENCY_LIMIT);
    
    console.log(`[CacheWarmer] Warming ${moveNames.length} moves with ${CONFIG.CONCURRENCY_LIMIT} concurrent requests...`);
    
    // Process moves in batches for progress logging
    const batches = [];
    for (let i = 0; i < moveNames.length; i += CONFIG.BATCH_SIZE) {
      batches.push(moveNames.slice(i, i + CONFIG.BATCH_SIZE));
    }
    
    let processedCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStartTime = Date.now();
      
      console.log(`[CacheWarmer] Processing batch ${i + 1}/${batches.length} (${batch.length} moves)...`);
      
      // Process batch with concurrency limit
      const batchPromises = batch.map(moveName => 
        limit(() => fetchAndCacheMove(moveName))
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Count results
      for (const result of batchResults) {
        if (result.success) {
          if (result.status === 'cached' || result.status === 'already-cached') {
            metrics.warmedMoves++;
          }
        } else {
          metrics.failedMoves++;
        }
      }
      
      processedCount += batch.length;
      const batchDuration = Date.now() - batchStartTime;
      
      console.log(`[CacheWarmer] Batch ${i + 1} completed in ${batchDuration}ms`);
      console.log(`[CacheWarmer] Progress: ${processedCount}/${moveNames.length} moves processed`);
      console.log(`[CacheWarmer] Success rate: ${((metrics.warmedMoves / processedCount) * 100).toFixed(1)}%`);
    }
    
    // Final metrics
    metrics.endTime = Date.now();
    const totalDuration = metrics.endTime - metrics.startTime;
    const successRate = ((metrics.warmedMoves / metrics.totalMoves) * 100).toFixed(1);
    
    console.log('\n[CacheWarmer] ===== CACHE WARMING COMPLETED =====');
    console.log(`[CacheWarmer] Total duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`[CacheWarmer] Total moves: ${metrics.totalMoves}`);
    console.log(`[CacheWarmer] Successfully warmed: ${metrics.warmedMoves}`);
    console.log(`[CacheWarmer] Failed: ${metrics.failedMoves}`);
    console.log(`[CacheWarmer] Success rate: ${successRate}%`);
    console.log(`[CacheWarmer] Average throughput: ${(metrics.totalMoves / (totalDuration / 1000)).toFixed(1)} moves/second`);
    console.log(`[CacheWarmer] Note: Most moves were likely already cached from previous runs`);
    console.log('[CacheWarmer] ======================================\n');
    
    // Emit metrics for monitoring (if you have a metrics system)
    emitMetrics();
    
    return {
      success: true,
      metrics: { ...metrics },
      duration: totalDuration,
      successRate: parseFloat(successRate),
    };
    
  } catch (error) {
    console.error('[CacheWarmer] Fatal error during cache warming:', error);
    metrics.endTime = Date.now();
    
    return {
      success: false,
      error: error.message,
      metrics: { ...metrics },
    };
  }
}

/**
 * Emit metrics for monitoring (placeholder for Prometheus/other metrics systems)
 */
function emitMetrics() {
  // This is where you'd emit metrics to your monitoring system
  // Example: prometheus.gauge('moves_warmed_total').set(metrics.warmedMoves);
  // Example: prometheus.gauge('moves_failed_total').set(metrics.failedMoves);
  // Example: prometheus.gauge('cache_warming_duration_seconds').set((metrics.endTime - metrics.startTime) / 1000);
  
  // For now, just log the metrics
  console.log('[CacheWarmer] Metrics for monitoring:');
  console.log(`  - moves_warmed_total: ${metrics.warmedMoves}`);
  console.log(`  - moves_failed_total: ${metrics.failedMoves}`);
  console.log(`  - cache_warming_duration_seconds: ${((metrics.endTime - metrics.startTime) / 1000).toFixed(2)}`);
  console.log(`  - cache_warming_success_rate: ${((metrics.warmedMoves / metrics.totalMoves) * 100).toFixed(1)}%`);
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  try {
    const { redis } = require('./redisCache');
    const keys = await redis.keys('move:*');
    const totalCached = keys.length;
    
    // Sample some keys to check freshness
    const sampleSize = Math.min(10, totalCached);
    const sampleKeys = keys.slice(0, sampleSize);
    const samples = await Promise.all(
      sampleKeys.map(async key => {
        try {
          const data = await redis.get(key);
          return data ? JSON.parse(data) : null;
        } catch {
          return null;
        }
      })
    );
    
    const validSamples = samples.filter(s => s && s.fetchedAt);
    const avgAge = validSamples.length > 0 
      ? validSamples.reduce((sum, s) => sum + (Date.now() - s.fetchedAt), 0) / validSamples.length
      : 0;
    
    return {
      totalCached,
      sampleSize,
      validSamples: validSamples.length,
      averageAgeHours: (avgAge / (1000 * 60 * 60)).toFixed(1),
    };
  } catch (error) {
    console.error('[CacheWarmer] Error getting cache stats:', error);
    return { error: error.message };
  }
}

module.exports = {
  warmMoveCache,
  getCacheStats,
  CONFIG,
}; 