const axios = require('axios');

// Cache for evolution chains to avoid repeated API calls
const evolutionChainCache = new Map();
const speciesCache = new Map();

// Generation ranges
const GENERATION_RANGES = {
  1: { start: 1, end: 151, name: 'Kanto' },
  2: { start: 152, end: 251, name: 'Johto' },
  3: { start: 252, end: 386, name: 'Hoenn' },
  4: { start: 387, end: 493, name: 'Sinnoh' }
};

/**
 * Fetch species data from PokeAPI
 */
async function fetchSpeciesData(speciesId) {
  if (speciesCache.has(speciesId)) {
    return speciesCache.get(speciesId);
  }

  try {
    const response = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}/`);
    const speciesData = response.data;
    
    // Cache the result
    speciesCache.set(speciesId, speciesData);
    
    return speciesData;
  } catch (error) {
    console.error(`Failed to fetch species data for ID ${speciesId}:`, error.message);
    return null;
  }
}

/**
 * Fetch evolution chain data from PokeAPI
 */
async function fetchEvolutionChain(chainId) {
  if (evolutionChainCache.has(chainId)) {
    return evolutionChainCache.get(chainId);
  }

  try {
    const response = await axios.get(`https://pokeapi.co/api/v2/evolution-chain/${chainId}/`);
    const chainData = response.data;
    
    // Cache the result
    evolutionChainCache.set(chainId, chainData);
    
    return chainData;
  } catch (error) {
    console.error(`Failed to fetch evolution chain ${chainId}:`, error.message);
    return null;
  }
}

/**
 * Extract Pokemon ID from URL
 */
function extractIdFromUrl(url) {
  const parts = url.split('/');
  return parseInt(parts[parts.length - 2], 10);
}

/**
 * Check if a Pokémon or its evolutions are in the specified generation range
 */
function checkForRelevantEvolutions(pokemon, range) {
  // Check if this Pokémon is in the range
  if (pokemon.id >= range.start && pokemon.id <= range.end) {
    return true;
  }
  
  // Recursively check evolutions
  if (pokemon.evolutions && pokemon.evolutions.length > 0) {
    for (const evolution of pokemon.evolutions) {
      if (checkForRelevantEvolutions(evolution, range)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Recursively build evolution chain from PokeAPI data with branching support
 */
function buildEvolutionChain(chainNode) {
  if (!chainNode) return null;

  const pokemonId = extractIdFromUrl(chainNode.species.url);
  const pokemonName = chainNode.species.name;
  
  const pokemon = {
    id: pokemonId,
    name: pokemonName,
    canEvolve: chainNode.evolves_to && chainNode.evolves_to.length > 0,
    evolutions: []
  };

  // Handle multiple possible evolutions (branching)
  if (chainNode.evolves_to && chainNode.evolves_to.length > 0) {
    for (const evolution of chainNode.evolves_to) {
      const evolutionData = buildEvolutionChain(evolution);
      if (evolutionData) {
        pokemon.evolutions.push(evolutionData);
      }
    }
  }

  return pokemon;
}

/**
 * Get all evolution chains for a specific generation
 */
async function getEvolutionChainsForGeneration(generation) {
  const range = GENERATION_RANGES[generation];
  if (!range) {
    throw new Error(`Invalid generation: ${generation}`);
  }

  const chains = [];
  const processedChainIds = new Set();

  // Fetch species data for all Pokemon in the generation
  for (let id = range.start; id <= range.end; id++) {
    try {
      const speciesData = await fetchSpeciesData(id);
      if (!speciesData || !speciesData.evolution_chain?.url) {
        continue; // Skip if no evolution chain
      }

      // Extract chain ID from URL
      const chainUrl = speciesData.evolution_chain.url;
      const chainId = extractIdFromUrl(chainUrl);

      // Skip if we've already processed this chain
      if (processedChainIds.has(chainId)) {
        continue;
      }

      // Fetch the evolution chain
      const chainData = await fetchEvolutionChain(chainId);
      if (!chainData) {
        continue;
      }

      // Build the evolution chain
      const evolutionChain = buildEvolutionChain(chainData.chain);
      
      // Check if the base Pokémon is in our generation range
      if (evolutionChain && evolutionChain.id >= range.start && evolutionChain.id <= range.end) {
        // Check if there are any evolutions in our generation range
        const hasRelevantEvolutions = checkForRelevantEvolutions(evolutionChain, range);
        
        // Only include chains that have evolutions (skip single-stage Pokémon)
        if (hasRelevantEvolutions && evolutionChain.evolutions && evolutionChain.evolutions.length > 0) {
          chains.push({
            id: evolutionChain.name,
            name: `${evolutionChain.name.charAt(0).toUpperCase() + evolutionChain.name.slice(1)} Evolution Chain`,
            pokemon: [evolutionChain]
          });
          
          processedChainIds.add(chainId);
        }
      }
    } catch (error) {
      console.error(`Error processing Pokemon ${id}:`, error.message);
      continue;
    }
  }

  return chains;
}

/**
 * Get evolution chains for all generations
 */
async function getAllEvolutionChains() {
  const allChains = {};
  
  for (const generation of Object.keys(GENERATION_RANGES)) {
    try {
      allChains[generation] = await getEvolutionChainsForGeneration(parseInt(generation));
    } catch (error) {
      console.error(`Error fetching chains for generation ${generation}:`, error);
      allChains[generation] = [];
    }
  }
  
  return allChains;
}

/**
 * Get cached evolution chains for a generation
 */
async function getCachedEvolutionChains(generation) {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const cachePath = path.join(__dirname, '../data/evolutionChains.json');
    
    const data = await fs.readFile(cachePath, 'utf8');
    const cachedChains = JSON.parse(data);
    
    return cachedChains[generation] || [];
  } catch (error) {
    console.log('No cached evolution chains found, fetching from API...');
    return await getEvolutionChainsForGeneration(generation);
  }
}

module.exports = {
  getEvolutionChainsForGeneration,
  getAllEvolutionChains,
  getCachedEvolutionChains,
  GENERATION_RANGES
}; 