const { getEvolutionChainsForGeneration, GENERATION_RANGES } = require('../utils/evolutionChains');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate and cache evolution chains for all generations
 */
async function generateEvolutionChains() {
  console.log('🔄 Generating evolution chains...');
  
  const allChains = {};
  
  for (const [generation, range] of Object.entries(GENERATION_RANGES)) {
    console.log(`📊 Processing Generation ${generation} (${range.name})...`);
    
    try {
      const chains = await getEvolutionChainsForGeneration(parseInt(generation));
      allChains[generation] = chains;
      
      console.log(`✅ Generation ${generation}: ${chains.length} evolution chains found`);
      
      // Log some examples
      if (chains.length > 0) {
        console.log(`   Examples: ${chains.slice(0, 3).map(c => c.name).join(', ')}`);
      }
    } catch (error) {
      console.error(`❌ Error processing generation ${generation}:`, error.message);
      allChains[generation] = [];
    }
  }
  
  // Save to cache file
  const cachePath = path.join(__dirname, '../data/evolutionChains.json');
  await fs.writeFile(cachePath, JSON.stringify(allChains, null, 2));
  
  console.log(`💾 Evolution chains cached to ${cachePath}`);
  
  // Print summary
  const totalChains = Object.values(allChains).reduce((sum, chains) => sum + chains.length, 0);
  console.log(`\n📈 Summary:`);
  console.log(`   Total evolution chains: ${totalChains}`);
  Object.entries(allChains).forEach(([gen, chains]) => {
    console.log(`   Gen ${gen}: ${chains.length} chains`);
  });
  
  return allChains;
}

/**
 * Load cached evolution chains
 */
async function loadCachedEvolutionChains() {
  try {
    const cachePath = path.join(__dirname, '../data/evolutionChains.json');
    const data = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('No cached evolution chains found, generating...');
    return await generateEvolutionChains();
  }
}

// Run the script if called directly
if (require.main === module) {
  generateEvolutionChains()
    .then(() => {
      console.log('✅ Evolution chain generation complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error generating evolution chains:', error);
      process.exit(1);
    });
}

module.exports = {
  generateEvolutionChains,
  loadCachedEvolutionChains
}; 