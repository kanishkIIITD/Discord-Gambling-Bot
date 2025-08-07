const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const FORMS_DATA_PATH = path.join(__dirname, '../data/pokemonForms.json');
const CUSTOM_SPAWN_RATES_PATH = path.join(__dirname, '../utils/customSpawnRates.json');

// Form spawn rates (much rarer than shinies)
const FORM_SPAWN_RATES = {
  common: 1 / 2000,    // 0.05% chance
  rare: 1 / 5000,      // 0.02% chance  
  legendary: 1 / 10000 // 0.01% chance
};

// Evolution items mapping
const FORM_EVOLUTION_ITEMS = {
  'charizard-mega-x': 'charizardite-x',
  'charizard-mega-y': 'charizardite-y',
  'venusaur-mega': 'venusaurite',
  'blastoise-mega': 'blastoiseite',
  'alakazam-mega': 'alakazite',
  'gengar-mega': 'gengarite',
  'kangaskhan-mega': 'kangaskhanite',
  'pinsir-mega': 'pinsirite',
  'gyarados-mega': 'gyaradosite',
  'aerodactyl-mega': 'aerodactylite',
  'mewtwo-mega-x': 'mewtwonite-x',
  'mewtwo-mega-y': 'mewtwonite-y',
  'ampharos-mega': 'ampharosite',
  'scizor-mega': 'scizorite',
  'heracross-mega': 'heracronite',
  'houndoom-mega': 'houndoominite',
  'tyranitar-mega': 'tyranitarite',
  'blaziken-mega': 'blazikenite',
  'gardevoir-mega': 'gardevoirite',
  'mawile-mega': 'mawilite',
  'aggron-mega': 'aggronite',
  'medicham-mega': 'medichamite',
  'manectric-mega': 'manectite',
  'banette-mega': 'banettite',
  'absol-mega': 'absolite',
  'garchomp-mega': 'garchompite',
  'lucario-mega': 'lucarionite',
  'abomasnow-mega': 'abomasite',
  'beedrill-mega': 'beedrillite',
  'pidgeot-mega': 'pidgeotite',
  'slowbro-mega': 'slowbronite',
  'steelix-mega': 'steelixite',
  'sceptile-mega': 'sceptilite',
  'swampert-mega': 'swampertite',
  'sableye-mega': 'sablenite',
  'sharpedo-mega': 'sharpedonite',
  'camerupt-mega': 'cameruptite',
  'altaria-mega': 'altarianite',
  'glalie-mega': 'glalitite',
  'salamence-mega': 'salamencite',
  'metagross-mega': 'metagrossite',
  'latias-mega': 'latiasite',
  'latios-mega': 'latiosite',
  'rayquaza-mega': 'rayquazite',
  'lopunny-mega': 'lopunnite',
  'gallade-mega': 'galladite',
  'audino-mega': 'audinite',
  'diancie-mega': 'diancite'
};

// Form rarity mapping based on Pokemon base rarity
const FORM_RARITY_MAP = {
  'charizard': 'rare',
  'venusaur': 'rare', 
  'blastoise': 'rare',
  'alakazam': 'rare',
  'gengar': 'rare',
  'kangaskhan': 'rare',
  'pinsir': 'uncommon',
  'gyarados': 'rare',
  'aerodactyl': 'rare',
  'mewtwo': 'legendary',
  'ampharos': 'rare',
  'scizor': 'rare',
  'heracross': 'rare',
  'houndoom': 'rare',
  'tyranitar': 'legendary',
  'blaziken': 'rare',
  'gardevoir': 'rare',
  'mawile': 'uncommon',
  'aggron': 'rare',
  'medicham': 'uncommon',
  'manectric': 'uncommon',
  'banette': 'uncommon',
  'absol': 'rare',
  'garchomp': 'legendary',
  'lucario': 'rare',
  'abomasnow': 'rare',
  'beedrill': 'common',
  'pidgeot': 'rare',
  'slowbro': 'rare',
  'steelix': 'rare',
  'sceptile': 'rare',
  'swampert': 'rare',
  'sableye': 'uncommon',
  'sharpedo': 'rare',
  'camerupt': 'rare',
  'altaria': 'rare',
  'glalie': 'rare',
  'salamence': 'legendary',
  'metagross': 'legendary',
  'latias': 'legendary',
  'latios': 'legendary',
  'rayquaza': 'legendary',
  'lopunny': 'uncommon',
  'gallade': 'rare',
  'audino': 'uncommon',
  'diancie': 'legendary'
};

async function fetchPokemonSpecies(speciesName) {
  try {
    const response = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${speciesName}/`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch species data for ${speciesName}:`, error.message);
    return null;
  }
}

function extractFormId(pokemonUrl) {
  // Extract the Pokemon ID from the URL
  const match = pokemonUrl.match(/\/(\d+)\/$/);
  return match ? parseInt(match[1]) : null;
}

function formatFormName(formId) {
  // Convert form ID to display name
  // e.g., "charizard-mega-x" -> "Mega Charizard X"
  return formId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace('Mega ', 'Mega ')
    .replace('Gmax', 'Gigantamax');
}

function determineFormRarity(basePokemonName) {
  return FORM_RARITY_MAP[basePokemonName] || 'common';
}

function getFormSpawnRate(rarity) {
  return FORM_SPAWN_RATES[rarity] || FORM_SPAWN_RATES.common;
}

async function generatePokemonForms() {
  console.log('Starting Pokemon forms generation...');
  
  // Load existing spawn rates to get Pokemon list
  let customSpawnRates = {};
  try {
    customSpawnRates = JSON.parse(fs.readFileSync(CUSTOM_SPAWN_RATES_PATH, 'utf8'));
  } catch (error) {
    console.error('Failed to load custom spawn rates:', error);
    return;
  }

  const pokemonForms = {};
  const pokemonNames = Object.keys(customSpawnRates);
  
  console.log(`Processing ${pokemonNames.length} Pokemon for forms...`);
  
  for (const pokemonName of pokemonNames) {
    console.log(`Processing ${pokemonName}...`);
    
    try {
      const speciesData = await fetchPokemonSpecies(pokemonName);
      if (!speciesData || !speciesData.varieties) {
        continue;
      }

      const forms = speciesData.varieties
        .filter(variety => !variety.is_default) // Only non-default forms
        .map(variety => {
          const formId = variety.pokemon.name;
          const formPokemonId = extractFormId(variety.pokemon.url);
          const rarity = determineFormRarity(pokemonName);
          
          return {
            id: formId,
            name: formatFormName(formId),
            pokemonId: formPokemonId,
            rarity: rarity,
            spawnRate: getFormSpawnRate(rarity),
            evolutionItem: FORM_EVOLUTION_ITEMS[formId] || null,
            levelRequirement: 35, // All forms require level 35 to evolve
            basePokemon: pokemonName
          };
        });

      if (forms.length > 0) {
        pokemonForms[pokemonName] = {
          basePokemon: pokemonName,
          forms: forms
        };
        console.log(`  Found ${forms.length} forms for ${pokemonName}`);
      }
      
      // Add a small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Error processing ${pokemonName}:`, error.message);
    }
  }

  // Write the forms data to file
  try {
    fs.writeFileSync(FORMS_DATA_PATH, JSON.stringify(pokemonForms, null, 2), 'utf8');
    console.log(`\nPokemon forms data written to ${FORMS_DATA_PATH}`);
    console.log(`Generated forms for ${Object.keys(pokemonForms).length} Pokemon species`);
    
    // Print summary
    let totalForms = 0;
    Object.values(pokemonForms).forEach(species => {
      totalForms += species.forms.length;
    });
    console.log(`Total forms generated: ${totalForms}`);
    
  } catch (error) {
    console.error('Failed to write forms data:', error);
  }
}

// Run the script
if (require.main === module) {
  generatePokemonForms()
    .then(() => {
      console.log('Pokemon forms generation completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error generating Pokemon forms:', error);
      process.exit(1);
    });
}

module.exports = { generatePokemonForms }; 