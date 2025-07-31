// Pokémon Data Service
// Handles fetching and caching Pokémon species data

class PokemonService {
  constructor() {
    this.speciesCache = new Map();
    this.loadingPromises = new Map();
  }

  // Fetch Pokémon species data from PokeAPI
  async getSpeciesById(id) {
    // Check cache first
    if (this.speciesCache.has(id)) {
      return this.speciesCache.get(id);
    }

    // Check if already loading
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id);
    }

    // Fetch from API
    const promise = this.fetchSpeciesFromAPI(id);
    this.loadingPromises.set(id, promise);

    try {
      const species = await promise;
      this.speciesCache.set(id, species);
      this.loadingPromises.delete(id);
      return species;
    } catch (error) {
      this.loadingPromises.delete(id);
      throw error;
    }
  }

  async fetchSpeciesFromAPI(id) {
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
      if (!response.ok) {
        throw new Error(`Failed to fetch species ${id}`);
      }
      
      const data = await response.json();
      
      // Get the English name
      const englishName = data.names.find(name => name.language.name === 'en')?.name || data.name;
      
      return {
        id: data.id,
        name: englishName,
        names: data.names,
        genera: data.genera,
        flavorTextEntries: data.flavor_text_entries,
        color: data.color?.name,
        shape: data.shape?.name,
        habitat: data.habitat?.name,
        growthRate: data.growth_rate?.name,
        captureRate: data.capture_rate,
        baseHappiness: data.base_happiness,
        isLegendary: data.is_legendary,
        isMythical: data.is_mythical,
        isBaby: data.is_baby,
        hatchCounter: data.hatch_counter,
        hasGenderDifferences: data.has_gender_differences,
        formsSwitchable: data.forms_switchable,
        order: data.order,
        conquestOrder: data.conquest_order,
        evolutionChain: data.evolution_chain?.url
      };
    } catch (error) {
      console.error(`Error fetching species ${id}:`, error);
      // Return fallback data
      return {
        id,
        name: `Pokémon ${id}`,
        names: [],
        genera: [],
        flavorTextEntries: [],
        color: 'unknown',
        shape: 'unknown',
        habitat: 'unknown',
        growthRate: 'unknown',
        captureRate: 45,
        baseHappiness: 70,
        isLegendary: false,
        isMythical: false,
        isBaby: false,
        hatchCounter: 20,
        hasGenderDifferences: false,
        formsSwitchable: false,
        order: id,
        conquestOrder: null,
        evolutionChain: null
      };
    }
  }

  // Get Pokémon image URL
  getImageUrl(id, variant = 'official-artwork') {
    const variants = {
      'official-artwork': `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
      'front': `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
      'back': `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${id}.png`,
      'shiny': `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`,
      'shiny-back': `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${id}.png`
    };
    
    return variants[variant] || variants['official-artwork'];
  }

  // Get all species for a generation
  async getSpeciesForGeneration(generation) {
    const { start, end } = this.getGenerationRange(generation);
    const species = [];
    
    for (let id = start; id <= end; id++) {
      try {
        const speciesData = await this.getSpeciesById(id);
        species.push(speciesData);
      } catch (error) {
        console.error(`Failed to fetch species ${id}:`, error);
      }
    }
    
    return species;
  }

  // Get generation range
  getGenerationRange(generation) {
    switch (generation) {
      case 1:
        return { start: 1, end: 151 };
      case 2:
        return { start: 152, end: 251 };
      case 3:
        return { start: 252, end: 386 };
      case 4:
        return { start: 387, end: 493 };
      case 5:
        return { start: 494, end: 649 };
      case 6:
        return { start: 650, end: 721 };
      case 7:
        return { start: 722, end: 809 };
      case 8:
        return { start: 810, end: 898 };
      case 9:
        return { start: 899, end: 1010 };
      default:
        return { start: 1, end: 151 };
    }
  }

  // Preload species for a generation
  async preloadGeneration(generation) {
    const { start, end } = this.getGenerationRange(generation);
    const promises = [];
    
    for (let id = start; id <= end; id++) {
      promises.push(this.getSpeciesById(id));
    }
    
    try {
      await Promise.all(promises);
      console.log(`Preloaded ${end - start + 1} species for generation ${generation}`);
    } catch (error) {
      console.error(`Error preloading generation ${generation}:`, error);
    }
  }

  // Clear cache
  clearCache() {
    this.speciesCache.clear();
    this.loadingPromises.clear();
  }
}

// Create singleton instance
const pokemonService = new PokemonService();

export default pokemonService; 