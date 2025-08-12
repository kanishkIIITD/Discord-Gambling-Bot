require('dotenv').config();
const mongoose = require('mongoose');
const cs2DataService = require('../services/cs2DataService');

async function initializeCS2Data() {
  try {
    console.log('🚀 Starting CS2 data initialization...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Initialize CS2 data service with force reload
    await cs2DataService.initialize(false, true);
    console.log('✅ CS2 data service initialized');
    
    console.log('🎉 CS2 data initialization completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Cases and 8 specific souvenir packages loaded: ${cs2DataService.cases.size}`);
    console.log(`   - Skins loaded: ${cs2DataService.skins.size}`);
    
    // Show some sample data
    const sampleCases = Array.from(cs2DataService.cases.values()).slice(0, 3);
    console.log('\n📦 Sample Cases and Souvenir Packages:');
    sampleCases.forEach(caseData => {
      console.log(`   - ${caseData.formattedName} (${caseData.caseId}) - ${caseData.price} currency`);
    });
    
    // Show souvenir packages specifically
    const souvenirPackages = Array.from(cs2DataService.cases.values()).filter(c => c.type === 'Souvenir');
    if (souvenirPackages.length > 0) {
      console.log('\n🎁 Souvenir Packages Loaded:');
      souvenirPackages.forEach(pkg => {
        console.log(`   - ${pkg.formattedName} (${pkg.caseId})`);
      });
    }
    
    const sampleSkins = Array.from(cs2DataService.skins.values()).slice(0, 3);
    console.log('\n🎨 Sample Skins:');
    sampleSkins.forEach(skin => {
      console.log(`   - ${skin.formattedName} (${skin.rarity}) - ${skin.marketValue} currency`);
    });
    
  } catch (error) {
    console.error('❌ Error during CS2 data initialization:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the initialization
initializeCS2Data();
