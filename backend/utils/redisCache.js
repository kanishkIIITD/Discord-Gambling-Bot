const Redis = require('ioredis');

// Try different Redis connection approaches
let redis;

if (process.env.REDIS_URL) {
  // Use URL format if available
  redis = new Redis(process.env.REDIS_URL, {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    enableReadyCheck: true,
    maxLoadingTimeout: 10000
  });
} else {
  // Use individual parameters
  redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    enableReadyCheck: true,
    maxLoadingTimeout: 10000
  });
}

// Handle Redis connection events
redis.on('connect', () => {
  console.log('[Redis] Connected to Redis server');
});

redis.on('ready', () => {
  console.log('[Redis] Redis client ready');
});

redis.on('error', (err) => {
  console.error('[Redis] Redis error:', err.message);
});

redis.on('close', () => {
  console.log('[Redis] Redis connection closed');
});

const REDIS_KEY = (setId) => `set:${setId}`;
const CACHE_TTL_SEC = 24 * 60 * 60; // 24 hours

module.exports = {
  redis,
  REDIS_KEY,
  CACHE_TTL_SEC
}; 