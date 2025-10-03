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

// Get all Gen 4 Pokémon from customSpawnRates
const gen4Pokemon = Object.entries(customSpawnRates)
  .filter(([name, data]) => data.gen === 4)
  .map(([name, data]) => name);

console.log(`Found ${gen4Pokemon.length} Gen 4 Pokémon`);

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
  const parts = formId.split('-');
  const baseName = parts[0];
  const formType = parts.slice(1).join('-');
  
  // Common Gen 4 notable forms
  if (formType.includes('giratina')) {
    const mode = formType.replace('giratina-', '');
    return `Giratina ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  }
  if (formType.includes('shaymin')) {
    const mode = formType.replace('shaymin-', '');
    return `Shaymin ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  }
  if (formType.includes('rotom')) {
    const appliance = formType.replace('rotom-', '');
    return `Rotom ${appliance.charAt(0).toUpperCase() + appliance.slice(1)}`;
  }
  if (formType.includes('wormadam')) {
    const cloak = formType.replace('wormadam-', '');
    return `Wormadam ${cloak.charAt(0).toUpperCase() + cloak.slice(1)}`;
  }
  if (formType.includes('arceus')) {
    const type = formType.replace('arceus-', '');
    return `Arceus ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }

  // Generic formatting fallback
  if (formType === 'mega') {
    return `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} Mega`;
  }
  if (formType === 'primal') {
    return `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} Primal`;
  }
  return formId.split('-').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join(' ');
}

// Helper function to determine form rarity
function determineFormRarity(pokemonName, formId) {
  const baseRarity = customSpawnRates[pokemonName]?.rarity || 'common';
  
  // Key Gen 4 forms rarity adjustments
  if (formId.includes('giratina') || formId.includes('shaymin') || formId.includes('arceus')) {
    return 'legendary';
  }
  if (formId.includes('rotom')) {
    return 'rare';
  }
  if (formId.includes('wormadam')) {
    return 'uncommon';
  }
  
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

// Main function to update Gen 4 forms
async function updateGen4Forms() {
  console.log('Starting Gen 4 forms update...');
  
  let updatedCount = 0;
  let newFormsCount = 0;
  
  for (const pokemonName of gen4Pokemon) {
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
            evolutionItem: null,
            levelRequirement: 35,
            basePokemon: pokemonName
          };
        });

      if (forms.length > 0) {
        const existingForms = pokemonForms[pokemonName];
        
        if (existingForms) {
          pokemonForms[pokemonName].forms = forms;
          console.log(`  Updated ${pokemonName}: ${forms.length} forms`);
          updatedCount++;
        } else {
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
      
      // Be respectful to the API
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
updateGen4Forms().catch(console.error);


