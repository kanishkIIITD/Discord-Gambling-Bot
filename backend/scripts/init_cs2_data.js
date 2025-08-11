require('dotenv').config();
const mongoose = require('mongoose');
const cs2DataService = require('../services/cs2DataService');

async function initializeCS2Data() {
  try {
    console.log('🚀 Starting CS2 data initialization...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Initialize CS2 data service
    await cs2DataService.initialize();
    console.log('✅ CS2 data service initialized');
    
    console.log('🎉 CS2 data initialization completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Cases loaded: ${cs2DataService.cases.size}`);
    console.log(`   - Skins loaded: ${cs2DataService.skins.size}`);
    
    // Show some sample data
    const sampleCases = Array.from(cs2DataService.cases.values()).slice(0, 3);
    console.log('\n📦 Sample Cases:');
    sampleCases.forEach(caseData => {
      console.log(`   - ${caseData.formattedName} (${caseData.caseId}) - ${caseData.price} currency`);
    });
    
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
