import React, { useState, useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useGuildStore } from '../store/useGuildStore';
import { useUIStore } from '../store/useUIStore';
import { getCurrentGenInfo, getPreviousGenInfo, GENERATION_NAMES, getGenerationRange } from '../utils/generationConfig';
import pokemonService from '../services/pokemonService';

const PokedexTracker = () => {
  const user = useUserStore(state => state.user);
  const theme = useUIStore(state => state.theme);
  const isDark = theme === 'dark';
  const currentGuild = useGuildStore(state => state.getSelectedGuild());
  const [pokemonCollection, setPokemonCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGeneration, setSelectedGeneration] = useState(getCurrentGenInfo().number);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('non-shiny'); // all, caught, missing, shiny, non-shiny



  // Fetch user's Pokémon collection
  useEffect(() => {
    const fetchPokemonCollection = async () => {
      if (!user || !currentGuild) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const url = `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/pokemon?guildId=${currentGuild.id}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setPokemonCollection(data.pokemon || []);
        } else {
          console.error('Failed to fetch Pokémon collection:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch Pokémon collection:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPokemonCollection();
  }, [user, currentGuild]);

  const [speciesData, setSpeciesData] = useState(new Map());
  const [loadingSpecies, setLoadingSpecies] = useState(false);

  // Load species data for the selected generation
  useEffect(() => {
    const loadSpeciesData = async () => {
      if (!selectedGeneration) return;
      
      setLoadingSpecies(true);
      try {
        const { start, end } = getGenerationRange(selectedGeneration);

        const newSpeciesData = new Map();
        
        // Create species data with real names from the collection
        for (let i = start; i <= end; i++) {
          // Find Pokémon with this ID in the collection to get the real name
          const matchingPokemon = pokemonCollection.filter(p => Number(p.pokemonId) === i);
          let realName = `Pokemon ${i}`; // Fallback name
          
          if (matchingPokemon.length > 0) {
            // Use the name from the first Pokémon found with this ID
            realName = matchingPokemon[0].name || realName;
          } else {
            // For Pokémon not in collection, try to get name from PokeAPI
            try {
              const speciesData = await pokemonService.getSpeciesById(i);
              realName = speciesData.name;
            } catch (error) {
              // Keep fallback name if API call fails
              console.log(`Could not fetch name for Pokémon ${i}:`, error.message);
            }
          }
          
          const species = {
            id: i,
            name: realName,
            isLegendary: false,
            isMythical: false
          };
          newSpeciesData.set(i, species);
        }
        
        setSpeciesData(newSpeciesData);
      } catch (error) {
        console.error('Failed to load species data:', error);
      } finally {
        setLoadingSpecies(false);
      }
    };

    loadSpeciesData();
  }, [selectedGeneration, pokemonCollection]);

             // Get all Pokémon for the selected generation
   const getGenerationPokemon = () => {
     const { start, end } = getGenerationRange(selectedGeneration);
     
     const pokemon = [];
     for (let id = start; id <= end; id++) {
       const species = speciesData.get(id);
       if (species) {
         const matchingPokemon = pokemonCollection.filter(p => Number(p.pokemonId) === id);
         const normalPokemon = matchingPokemon.filter(p => !p.isShiny);
         const shinyPokemon = matchingPokemon.filter(p => p.isShiny);
         
         // Add normal Pokémon entry (always add, even if not caught)
         pokemon.push({
           id,
           name: species.name,
           caught: normalPokemon.length > 0,
           shiny: false,
           count: normalPokemon.length,
           species: species
         });
         
         // Add shiny Pokémon entry (always add, even if not caught)
         pokemon.push({
           id,
           name: species.name, // Keep the same name for shiny
           caught: shinyPokemon.length > 0,
           shiny: true,
           count: shinyPokemon.length,
           species: species
         });
       }
     }
     
     return pokemon;
   };

  // Filter Pokémon based on search and filter criteria
  const getFilteredPokemon = () => {
    let pokemon = getGenerationPokemon();
    
    // Apply search filter
    if (searchTerm) {
      pokemon = pokemon.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply type filter
    switch (filterType) {
      case 'caught':
        pokemon = pokemon.filter(p => p.caught);
        break;
      case 'missing':
        pokemon = pokemon.filter(p => !p.caught);
        break;
      case 'shiny':
        pokemon = pokemon.filter(p => p.shiny);
        break;
      case 'non-shiny':
        pokemon = pokemon.filter(p => !p.shiny);
        break;
      case 'non-shiny-missing':
        pokemon = pokemon.filter(p => !p.shiny && !p.caught);
        break;
      default:
        break;
    }
    
    return pokemon;
  };

  const filteredPokemon = getFilteredPokemon();
  const caughtCount = filteredPokemon.filter(p => p.caught).length;
  const totalCount = filteredPokemon.length;


  
  if (loading || loadingSpecies) {
    return (
      <div className="flex items-center justify-center min-h-64 bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-text-secondary">
            {loading ? 'Loading your collection...' : 'Loading Pokémon data...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Pokédex Tracker
          </h1>
          <p className="text-text-secondary">
            Track your Pokémon collection in {currentGuild?.name || 'this server'}
          </p>
        </div>

        {/* Controls */}
        <div className="bg-surface rounded-lg shadow-sm border border-border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Generation Filter */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Generation
              </label>
              <select
                value={selectedGeneration}
                onChange={(e) => setSelectedGeneration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-surface text-text-primary"
              >
                <option value={1}>Gen 1 - Kanto (1-151)</option>
                <option value={2}>Gen 2 - Johto (152-251)</option>
                <option value={3}>Gen 3 - Hoenn (252-386)</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Search Pokémon
              </label>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-surface text-text-primary"
              />
            </div>

            {/* Filter Type */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Filter
              </label>
                             <select
                 value={filterType}
                 onChange={(e) => setFilterType(e.target.value)}
                 className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-surface text-text-primary"
               >
                 <option value="all">All Pokémon</option>
                 <option value="non-shiny">Non-Shiny Only</option>
                 <option value="shiny">Shiny Only</option>
                 <option value="caught">Caught Only</option>
                 <option value="missing">Missing Only</option>
                 <option value="non-shiny-missing">Non-Shiny Missing Only</option>
               </select>
            </div>

            {/* Stats */}
            <div className="flex items-end">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 w-full">
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  {caughtCount} / {totalCount} Caught
                </div>
                <div className="text-xs text-blue-500 dark:text-blue-300">
                  {totalCount > 0 ? Math.round((caughtCount / totalCount) * 100) : 0}% Complete
                </div>
              </div>
            </div>
          </div>
        </div>

             {/* Pokémon Grid */}
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
         {filteredPokemon.map((pokemon) => (
           <PokemonCard key={`${pokemon.id}-${pokemon.shiny ? 'shiny' : 'normal'}`} pokemon={pokemon} />
         ))}
       </div>

        {filteredPokemon.length === 0 && (
          <div className="text-center py-12">
            <div className="text-text-secondary text-lg">
              No Pokémon found matching your criteria
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Individual Pokémon Card Component
const PokemonCard = ({ pokemon }) => {
  const { id, name, caught, shiny, count, species } = pokemon;
  
  return (
    <div className="relative group">
      <div className={`
        relative bg-surface rounded-lg shadow-sm border-2 p-3 transition-all duration-200
        ${caught ? 'border-green-200 hover:border-green-300 dark:border-green-600 dark:hover:border-green-500' : 'border-border hover:border-text-secondary'}
        ${!caught ? 'opacity-60' : ''}
      `}>
        {/* Pokémon Image */}
        <div className="relative mb-2">
          <img
            src={shiny ? pokemonService.getImageUrl(id, 'shiny') : pokemonService.getImageUrl(id, 'official-artwork')}
            alt={name}
            className={`
              w-full h-24 object-contain rounded-full mx-auto
              ${!caught ? 'grayscale' : ''}
            `}
            onError={(e) => {
              e.target.src = '/pokemon-card-backside.png'; // Fallback image
            }}
          />
          
          {/* Shiny Indicator */}
          {shiny && (
            <div className="absolute top-0 right-0">
              <div className="bg-yellow-400 text-yellow-900 text-xs px-1 rounded-full">
                ✨
              </div>
            </div>
          )}
          
          {/* Count Badge */}
          {caught && count > 1 && (
            <div className="absolute bottom-0 right-0">
              <div className="bg-blue-500 text-white text-xs px-1 rounded-full">
                {count}
              </div>
            </div>
          )}
          
          {/* Legendary/Mythical Indicator */}
          {species?.isLegendary && (
            <div className="absolute top-0 left-0">
              <div className="bg-purple-500 text-white text-xs px-1 rounded-full">
                ★
              </div>
            </div>
          )}
          
          {species?.isMythical && (
            <div className="absolute top-0 left-0">
              <div className="bg-pink-500 text-white text-xs px-1 rounded-full">
                ✧
              </div>
            </div>
          )}
        </div>

        {/* Pokémon Info */}
        <div className="text-center">
          <div className="text-xs text-text-secondary mb-1">
            #{id.toString().padStart(3, '0')}
          </div>
          <div className="text-sm font-medium text-text-primary capitalize">
            {name}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            {caught ? 'Caught' : 'Not Caught'}
          </div>
          {species?.color && (
            <div className="text-xs text-text-secondary mt-1 capitalize">
              {species.color}
            </div>
          )}
        </div>

        {/* Hover Effect */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all duration-200" />
      </div>
    </div>
  );
};

export default PokedexTracker; 