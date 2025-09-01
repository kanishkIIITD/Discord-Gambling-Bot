const fs = require('fs');
const path = require('path');

// Paths
const POKEMON_FORMS_PATH = path.join(__dirname, '../data/pokemonForms.json');
const CUSTOM_SPAWN_RATES_PATH = path.join(__dirname, '../data/customSpawnRates.json');

// Load existing data
let pokemonForms = {};
let customSpawnRates = {};

try {
  pokemonForms = JSON.parse(fs.readFileSync(POKEMON_FORMS_PATH, 'utf8'));
  customSpawnRates = JSON.parse(fs.readFileSync(CUSTOM_SPAWN_RATES_PATH, 'utf8'));
} catch (error) {
  console.error('Failed to load existing data:', error);
  process.exit(1);
}

// Get all Gen 3 Pokémon from customSpawnRates
const gen3Pokemon = Object.entries(customSpawnRates)
  .filter(([name, data]) => data.gen === 3)
  .map(([name, data]) => name);

console.log(`Found ${gen3Pokemon.length} Gen 3 Pokémon`);

// Helper function to fetch Pokémon species data
async function fetchPokemonSpecies(pokemonName) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonName}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch species data for ${pokemonName}:`, error.message);
    return null;
  }
}

// Helper function to extract form ID from URL
function extractFormId(url) {
  const match = url.match(/\/(\d+)\/$/);
  return match ? parseInt(match[1]) : null;
}

// Helper function to format form name
function formatFormName(formId) {
  // Convert form ID to readable name
  const parts = formId.split('-');
  const baseName = parts[0];
  const formType = parts.slice(1).join('-');
  
  if (formType === 'mega') {
    return `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} Mega`;
  } else if (formType === 'primal') {
    return `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} Primal`;
  } else if (formType.includes('castform')) {
    const weather = formType.replace('castform-', '');
    return `Castform ${weather.charAt(0).toUpperCase() + weather.slice(1)}`;
  } else if (formType.includes('deoxys')) {
    const form = formType.replace('deoxys-', '');
    return `Deoxys ${form.charAt(0).toUpperCase() + form.slice(1)}`;
  } else {
    // Handle other forms
    return formId.split('-').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
  }
}

// Helper function to determine form rarity
function determineFormRarity(pokemonName, formId) {
  const baseRarity = customSpawnRates[pokemonName]?.rarity || 'common';
  
  // Mega and Primal forms are legendary
  if (formId.includes('mega') || formId.includes('primal')) {
    return 'legendary';
  }
  
  // Deoxys forms are legendary
  if (formId.includes('deoxys')) {
    return 'legendary';
  }
  
  // Castform forms are uncommon
  if (formId.includes('castform')) {
    return 'uncommon';
  }
  
  // Other forms inherit base rarity
  return baseRarity;
}

// Helper function to get form spawn rate
function getFormSpawnRate(rarity) {
  switch (rarity) {
    case 'legendary': return 0.0001;
    case 'rare': return 0.0002;
    case 'uncommon': return 0.0003;
    case 'common': return 0.0005;
    default: return 0.0005;
  }
}

// Main function to update Gen 3 forms
async function updateGen3Forms() {
  console.log('Starting Gen 3 forms update...');
  
  let updatedCount = 0;
  let newFormsCount = 0;
  
  for (const pokemonName of gen3Pokemon) {
    console.log(`Processing ${pokemonName}...`);
    
    try {
      const speciesData = await fetchPokemonSpecies(pokemonName);
      if (!speciesData || !speciesData.varieties) {
        console.log(`  No varieties found for ${pokemonName}`);
        continue;
      }

      const forms = speciesData.varieties
        .filter(variety => !variety.is_default) // Only non-default forms
        .map(variety => {
          const formId = variety.pokemon.name;
          const formPokemonId = extractFormId(variety.pokemon.url);
          const rarity = determineFormRarity(pokemonName, formId);
          
          return {
            id: formId,
            name: formatFormName(formId),
            pokemonId: formPokemonId,
            rarity: rarity,
            spawnRate: getFormSpawnRate(rarity),
            evolutionItem: null, // Forms use Form Stones
            levelRequirement: 35,
            basePokemon: pokemonName
          };
        });

      if (forms.length > 0) {
        // Check if this Pokémon already has forms
        const existingForms = pokemonForms[pokemonName];
        
        if (existingForms) {
          // Update existing forms
          pokemonForms[pokemonName].forms = forms;
          console.log(`  Updated ${pokemonName}: ${forms.length} forms`);
          updatedCount++;
        } else {
          // Add new Pokémon with forms
          pokemonForms[pokemonName] = {
            basePokemon: pokemonName,
            forms: forms
          };
          console.log(`  Added ${pokemonName}: ${forms.length} forms`);
          newFormsCount++;
        }
        
        forms.forEach(form => {
          console.log(`    - ${form.name} (ID: ${form.pokemonId})`);
        });
      } else {
        console.log(`  No forms found for ${pokemonName}`);
      }
      
      // Add a small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error processing ${pokemonName}:`, error.message);
    }
  }
  
  // Save updated data
  try {
    fs.writeFileSync(POKEMON_FORMS_PATH, JSON.stringify(pokemonForms, null, 2));
    console.log(`\n✅ Successfully updated pokemonForms.json`);
    console.log(`📊 Summary:`);
    console.log(`   - Updated: ${updatedCount} Pokémon`);
    console.log(`   - Added: ${newFormsCount} new Pokémon`);
    console.log(`   - Total Pokémon with forms: ${Object.keys(pokemonForms).length}`);
  } catch (error) {
    console.error('Failed to save pokemonForms.json:', error);
  }
}

// Run the update
updateGen3Forms().catch(console.error);
