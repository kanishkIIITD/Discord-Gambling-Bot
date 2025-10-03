import React, { useState, useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useGuildStore } from '../store/useGuildStore';
import { useUIStore } from '../store/useUIStore';
import pokemonService from '../services/pokemonService';

// Evolution requirements based on rarity
const EVOLUTION_REQUIREMENTS = {
  common: 6,
  uncommon: 5,
  rare: 4,
  legendary: null // Cannot evolve
};

const SHINY_REQUIREMENT = 2;

// Helper function to determine evolution stage
const getEvolutionStage = (pokemon, isBase) => {
  if (isBase) return 'Base';
  
  // Check if this Pokémon has evolutions
  if (pokemon.evolutions && pokemon.evolutions.length > 0) {
    return 'Stage 1';
  }
  
  // If no evolutions, it's the final stage
  return 'Final';
};

// Helper function to get generation color
const getGenerationColor = (pokemonId) => {
  const generation = Math.ceil(pokemonId / 151);
  const colors = {
    1: '#80BB1D', // Gen 1 - Kanto
    2: '#CAC02E', // Gen 2 - Johto
    3: '#67C1AB', // Gen 3 - Hoenn
    4: '#9072A3', // Gen 4 - Sinnoh
    5: '#6BAECE', // Gen 5 - Unova
    6: '#CB0B4F', // Gen 6 - Kalos
    7: '#DC5A40', // Gen 7 - Alola
    8: '#AC379E', // Gen 8 - Galar
    9: '#E19F3E'  // Gen 9 - Paldea
  };
  return colors[generation] || '#80BB1D'; // Default to Gen 1 color
};

const EvolutionTracker = () => {
  const user = useUserStore(state => state.user);
  const theme = useUIStore(state => state.theme);
  const isDark = theme === 'dark';
  const currentGuild = useGuildStore(state => state.getSelectedGuild());
  const [pokemonCollection, setPokemonCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evolutionChains, setEvolutionChains] = useState([]);
  const [selectedChain, setSelectedChain] = useState(null);
  const [ringCharges, setRingCharges] = useState(0);
  const [selectedGeneration, setSelectedGeneration] = useState(1);

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

  // Load evolution chains from backend
  useEffect(() => {
    const loadEvolutionChains = async () => {
      if (!user || !currentGuild) return;

      try {
        const url = `${process.env.REACT_APP_API_URL}/api/users/${user.discordId}/evolution-data?guildId=${currentGuild.id}&generation=${selectedGeneration}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setEvolutionChains(data.evolutionChains || []);
          setRingCharges(data.user?.ringCharges || 0);
        } else {
          console.error('Failed to fetch evolution data:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch evolution data:', error);
      }
    };

    loadEvolutionChains();
  }, [user, currentGuild, selectedGeneration]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-text-secondary">
            Loading evolution data...
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
            Evolution Tracker
          </h1>
          <p className="text-text-secondary mb-4">
            Track your Pokémon evolution progress in {currentGuild?.name || 'this server'}
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 inline-block">
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              Evolver's Ring Charges: {ringCharges}
            </div>
            <div className="text-xs text-blue-500 dark:text-blue-300">
              {ringCharges > 0 ? 'Ready to evolve!' : 'Buy more charges from the shop'}
            </div>
          </div>
        </div>

        {/* Generation Filter */}
        <div className="mb-6">
          <div className="bg-surface rounded-lg shadow-sm border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Generation
                </label>
                <select
                  value={selectedGeneration}
                  onChange={(e) => setSelectedGeneration(Number(e.target.value))}
                  className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-surface text-text-primary"
                >
                  <option value={1}>Gen 1 - Kanto (1-151)</option>
                  <option value={2}>Gen 2 - Johto (152-251)</option>
                  <option value={3}>Gen 3 - Hoenn (252-386)</option>
                  <option value={4}>Gen 4 - Sinnoh (387-493)</option>
                </select>
              </div>
              <div className="text-right">
                <div className="text-sm text-text-secondary">
                  {evolutionChains.length} Evolution Chains
                </div>
                <div className="text-xs text-text-secondary">
                  Showing Gen {selectedGeneration} Pokémon
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Evolution Chains */}
        <div className="space-y-8">
          {evolutionChains.map((chain) => (
            <EvolutionChain key={chain.id} chain={chain} />
          ))}
        </div>

        {evolutionChains.length === 0 && (
          <div className="text-center py-12">
            <div className="text-text-secondary text-lg">
              No evolution chains found
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Individual Evolution Chain Component with Branching Support
const EvolutionChain = ({ chain }) => {
  return (
    <div className="bg-surface rounded-xl shadow-lg border border-border p-8 mb-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          {chain.name}
        </h2>
        <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
      </div>
      
             <div className="overflow-x-auto">
         <HorizontalEvolutionChain pokemon={chain.pokemon[0]} />
       </div>
    </div>
  );
};

// Build evolution chain with proper branching
const buildEvolutionChain = (pokemon) => {
  const chain = [pokemon];
  let current = pokemon;
  
  while (current.evolutions && current.evolutions.length > 0) {
    // For single evolution, continue the chain
    if (current.evolutions.length === 1) {
      current = current.evolutions[0];
      chain.push(current);
    } else {
      // For multiple evolutions, stop here and return the chain with branching info
      return {
        linearChain: chain,
        branchingPoint: current,
        branches: current.evolutions
      };
    }
  }
  
  return {
    linearChain: chain,
    branchingPoint: null,
    branches: null
  };
};

// Horizontal evolution chain component
const HorizontalEvolutionChain = ({ pokemon }) => {
  const evolutionData = buildEvolutionChain(pokemon);
  const { linearChain, branchingPoint, branches } = evolutionData;
  
  // Debug logging for duplicate detection
  console.log(`Evolution chain for ${pokemon.name}:`, linearChain.map(p => p.name));
  
  return (
    <div className="flex items-center justify-center space-x-8">
      {/* Render the linear part of the chain */}
      {linearChain.map((chainPokemon, index) => (
        <React.Fragment key={`${chainPokemon.id}-${index}`}>
          {/* Pokémon Card */}
          <div className="flex flex-col items-center">
            <PokemonCard 
              pokemon={chainPokemon} 
              isBase={index === 0} 
            />
          </div>
          
          {/* Evolution Arrow (except for the last Pokémon) */}
          {index < linearChain.length - 1 && (
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 text-text-secondary/60" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </React.Fragment>
      ))}
      
             {/* Render branching if there are multiple evolutions */}
       {branches && branches.length > 1 && (
         <>
           {/* Arrow to branching point */}
           <div className="flex flex-col items-center">
             <svg className="w-8 h-8 text-text-secondary/60" fill="currentColor" viewBox="0 0 20 20">
               <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
             </svg>
           </div>
           
           {/* Branching Pokémon stacked vertically */}
           <div className="flex flex-col items-center space-y-4">
             {branches.map((branch, index) => (
               <div key={`${branch.id}-${index}`} className="flex flex-col items-center">
                 <PokemonCard pokemon={branch} />
               </div>
             ))}
           </div>
         </>
       )}
    </div>
  );
};

// Individual Pokémon Card Component
const PokemonCard = ({ pokemon, isBase = false }) => {
  return (
    <div className={`bg-surface-secondary rounded-xl p-6 border border-border transition-all duration-200 hover:shadow-lg ${
      isBase ? 'ring-2 ring-blue-500/50 shadow-lg' : ''
    }`}>
      {/* Pokémon Image */}
      <div className="relative mb-4">
        {/* Generation and Evolution Stage Label */}
        <div 
          className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-white text-xs px-2 py-1 rounded-full shadow-md z-10 text-center min-w-max"
          style={{ backgroundColor: getGenerationColor(pokemon.id) }}
        >
          Gen {Math.ceil(pokemon.id / 151)} • {getEvolutionStage(pokemon, isBase)}
        </div>
        
        <img
          src={pokemonService.getImageUrl(pokemon.id, 'official-artwork')}
          alt={pokemon.name}
          className={`object-contain mx-auto transition-transform duration-200 hover:scale-105 ${
            isBase ? 'w-32 h-32' : 'w-24 h-24'
          }`}
          onError={(e) => {
            e.target.src = '/pokemon-card-backside.png';
          }}
        />
      </div>

             {/* Pokémon Info */}
       <div className="text-center mb-4">
         <div className="text-xs text-text-secondary mb-1">
           #{pokemon.id.toString().padStart(3, '0')}
         </div>
                   <div className={`font-semibold text-text-primary capitalize ${
            isBase ? 'text-lg' : 'text-base'
          }`}>
            {pokemon.name}
          </div>
       </div>

             {/* Evolution Progress - Only show for Pokémon that can evolve */}
       {getEvolutionStage(pokemon, isBase) !== 'Final' && (
         <div className="space-y-3">
           {/* Normal Evolution */}
           <div className="text-center">
             <div className="text-xs text-text-secondary mb-2 font-medium">
               Normal Evolution
             </div>
             <div className="flex items-center justify-center space-x-2 mb-2">
               <span className="text-xs text-text-secondary">
                 {pokemon.normalCount}/{pokemon.normalRequired}
               </span>
               {pokemon.canEvolveNormal && (
                 <span className="text-green-500 text-xs font-bold">✓</span>
               )}
             </div>
             <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
               <div 
                 className={`h-2.5 rounded-full transition-all duration-300 ${
                   pokemon.canEvolveNormal 
                     ? 'bg-green-500' 
                     : 'bg-blue-500'
                 }`}
                 style={{ width: `${pokemon.normalProgress * 100}%` }}
               ></div>
             </div>
           </div>

           {/* Shiny Evolution */}
           <div className="text-center">
             <div className="text-xs text-text-secondary mb-2 font-medium">
               Shiny Evolution ✨
             </div>
             <div className="flex items-center justify-center space-x-2 mb-2">
               <span className="text-xs text-text-secondary">
                 {pokemon.shinyCount}/{pokemon.shinyRequired}
               </span>
               {pokemon.canEvolveShiny && (
                 <span className="text-green-500 text-xs font-bold">✓</span>
               )}
             </div>
             <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
               <div 
                 className={`h-2.5 rounded-full transition-all duration-300 ${
                   pokemon.canEvolveShiny 
                     ? 'bg-green-500' 
                     : 'bg-yellow-500'
                 }`}
                 style={{ width: `${pokemon.shinyProgress * 100}%` }}
               ></div>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default EvolutionTracker; 