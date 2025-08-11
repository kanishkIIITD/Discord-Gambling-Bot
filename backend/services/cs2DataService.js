const fs = require('fs').promises;
const path = require('path');
const CS2Case = require('../models/CS2Case');
const CS2Skin = require('../models/CS2Skin');

class CS2DataService {
  constructor() {
    this.cases = new Map();
    this.skins = new Map();
    this.isInitialized = false;
    this.lastSync = null;
  }

  async initialize(skipDatabaseSync = false) {
    if (this.isInitialized) {
      console.log('📊 CS2 data service already initialized, skipping...');
      return;
    }

    try {
      console.log('🔄 Initializing CS2 data service...');
      
      // Load cases data
      await this.loadCasesData();
      
      // Load skins data
      await this.loadSkinsData();
      
      // Check if data already exists in database
      const existingCases = await CS2Case.countDocuments();
      const existingSkins = await CS2Skin.countDocuments();
      
      // Only sync with database if explicitly requested or if no data exists
      if (!skipDatabaseSync && (existingCases === 0 || existingSkins === 0)) {
        console.log('📊 Database appears empty, syncing CS2 data...');
        await this.syncWithDatabase();
      } else if (!skipDatabaseSync) {
        console.log('📊 CS2 data already exists in database, skipping sync');
      }
      
      this.isInitialized = true;
      console.log('✅ CS2 data service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize CS2 data service:', error);
      throw error;
    }
  }

  async loadCasesData() {
    try {
      const casesPath = path.join(__dirname, '../data/raw_cases.json');
      const casesData = JSON.parse(await fs.readFile(casesPath, 'utf8'));
      
      // Clear existing cases
      this.cases.clear();
      
      // Process each case
      for (const [caseId, caseData] of Object.entries(casesData)) {
        // Skip cases with invalid data
        if (!caseData.formatted_name || !caseData.image_url) {
          console.warn(`⚠️ Skipping case ${caseId}: missing formatted_name or image_url`);
          continue;
        }
        
        const processedCase = {
          caseId: caseId.toLowerCase().replace(/\s+/g, '-'),
          formattedName: caseData.formatted_name.trim(),
          imageUrl: caseData.image_url.trim(),
          requiresKey: caseData.requires_key || false,
          price: this.calculateCasePrice(caseData),
          items: {
            // Map the actual keys from raw data (they're already in camelCase)
            consumerGrade: caseData.items['consumerGrade'] || [],
            industrialGrade: caseData.items['industrialGrade'] || [],
            milSpec: caseData.items['milSpec'] || [],
            restricted: caseData.items['restricted'] || [],
            classified: caseData.items['classified'] || [],
            covert: caseData.items['covert'] || [],
            special: caseData.items['special'] || []
          }
        };
        
        this.cases.set(processedCase.caseId, processedCase);
      }
      
      console.log(`📦 Loaded ${this.cases.size} cases`);
    } catch (error) {
      console.error('❌ Failed to load cases data:', error);
      throw error;
    }
  }

  async loadSkinsData() {
    try {
      const skinsPath = path.join(__dirname, '../data/raw_skins.json');
      const skinsData = JSON.parse(await fs.readFile(skinsPath, 'utf8'));
      
      // Clear existing skins
      this.skins.clear();
      
      // Process each skin
      for (const [skinId, skinData] of Object.entries(skinsData)) {
        // Skip skins with invalid data
        if (!skinData.formatted_name) {
          console.warn(`⚠️ Skipping skin ${skinId}: missing formatted_name`);
          continue;
        }
        
        const weapon = this.extractWeapon(skinData.formatted_name);
        const skinName = this.extractSkinName(skinData.formatted_name);
        
        // Use actual quality from data if available, otherwise infer
        const actualQuality = skinData.quality || null;
        const inferredRarity = this.inferSkinRarity(weapon, skinName, actualQuality);
        
        // Log quality mapping for debugging
        if (actualQuality && actualQuality !== inferredRarity) {
          console.log(`🔄 Quality mapping: ${skinData.formatted_name} - ${actualQuality} → ${inferredRarity}`);
        }
        
        // Find the first non-empty image URL
        let imageUrl = 'https://via.placeholder.com/300x200?text=No+Image';
        if (skinData.image_urls && skinData.image_urls.length > 0) {
          const validImageUrl = skinData.image_urls.find(url => url && url.trim() !== '');
          if (validImageUrl) {
            imageUrl = validImageUrl;
          }
        }
        
        const processedSkin = {
          skinId: skinId.toLowerCase().replace(/\s+/g, '-').replace(/\|/g, '-'),
          formattedName: skinData.formatted_name.trim(),
          weapon: weapon,
          skinName: skinName,
          rarity: inferredRarity,
          imageUrl: imageUrl,
          wear: this.getRandomWear(),
          isStatTrak: Math.random() < 0.1, // 10% chance for StatTrak
          isSouvenir: Math.random() < 0.05, // 5% chance for Souvenir
          marketValue: this.calculateSkinValue(inferredRarity)
        };
        
        // Debug logging for image processing
        if (skinData.image_urls && skinData.image_urls.length > 0) {
          const emptyUrls = skinData.image_urls.filter(url => !url || url.trim() === '').length;
          const totalUrls = skinData.image_urls.length;
          if (emptyUrls > 0) {
            console.log(`🔍 Skin "${skinData.formatted_name}": ${emptyUrls}/${totalUrls} empty URLs, using: ${imageUrl}`);
          }
        } else {
          console.log(`⚠️ Skin "${skinData.formatted_name}" has no image URLs`);
        }
        
        this.skins.set(processedSkin.skinId, processedSkin);
      }
      
      console.log(`🎨 Loaded ${this.skins.size} skins`);
      
      // After loading skins, validate case categorization
      this.validateCaseCategorization();
    } catch (error) {
      console.error('❌ Failed to load skins data:', error);
      throw error;
    }
  }

  async syncWithDatabase() {
    try {
      console.log('🔄 Syncing CS2 data with database...');
      
      // Sync cases
      console.log(`📦 Syncing ${this.cases.size} cases...`);
      for (const [caseId, caseData] of this.cases) {
        try {
          await CS2Case.findOneAndUpdate(
            { caseId },
            caseData,
            { upsert: true, new: true, runValidators: true }
          );
        } catch (error) {
          console.error(`❌ Failed to sync case ${caseId}:`, error.message);
          console.error('Case data:', JSON.stringify(caseData, null, 2));
          throw error;
        }
      }
      
      // Sync skins
      console.log(`🎨 Syncing ${this.skins.size} skins...`);
      for (const [skinId, skinData] of this.skins) {
        try {
          await CS2Skin.findOneAndUpdate(
            { skinId },
            skinData,
            { upsert: true, new: true, runValidators: true }
          );
        } catch (error) {
          console.error(`❌ Failed to sync skin ${skinId}:`, error.message);
          console.error('Skin data:', JSON.stringify(skinData, null, 2));
          throw error;
        }
      }
      
            this.lastSync = new Date();
      console.log('✅ Database sync completed');
    } catch (error) {
      console.error('❌ Failed to sync with database:', error);
      throw error;
    }
  }

  calculateCasePrice(caseData) {
    // Base price calculation based on case type and items
    // Using points system (similar to your existing economy)
    let basePrice = 5000; // 5,000 points base price
    
    if (caseData.requires_key) {
      basePrice += 2500; // Key cost
    }
    
    // Adjust price based on number of items (EXCLUDING special items to prevent inflation)
    const regularItems = Object.entries(caseData.items)
      .filter(([rarity, items]) => rarity !== 'special') // Exclude special items from count
      .reduce((sum, [_, items]) => sum + items.length, 0);
    
    const specialItems = caseData.items.special ? caseData.items.special.length : 0;
    
    basePrice += regularItems * 250; // 250 points per regular item
    
    // Adjust price based on rarity of items
    if (caseData.items.covert && caseData.items.covert.length > 0) {
      basePrice += 10000; // 10,000 points bonus for covert items
    }
    if (caseData.items.classified && caseData.items.classified.length > 0) {
      basePrice += 5000; // 5,000 points bonus for classified items
    }
    if (caseData.items.special && caseData.items.special.length > 0) {
      basePrice += 15000; // 15,000 points bonus for special items (knives, gloves)
    }
    
    const finalPrice = Math.round(basePrice / 1000) * 1000; // Round to nearest 1,000 points
    
    // Log price calculation details
    console.log(`💰 Case price calculation for ${caseData.formatted_name}:`);
    console.log(`   Base price: 5,000 points`);
    console.log(`   Key cost: ${caseData.requires_key ? '2,500' : '0'} points`);
    console.log(`   Regular items (${regularItems}): +${regularItems * 250} points`);
    console.log(`   Special items (${specialItems}): excluded from count, +15,000 bonus`);
    console.log(`   Covert bonus: ${caseData.items.covert ? '+10,000' : '+0'} points`);
    console.log(`   Classified bonus: ${caseData.items.classified ? '+5,000' : '+0'} points`);
    console.log(`   Final price: ${finalPrice.toLocaleString()} points`);
    
    return finalPrice;
  }

  extractWeapon(formattedName) {
    // Extract weapon name from "AK-47 | Asiimov" format
    const parts = formattedName.split(' | ');
    return parts[0] || 'Unknown';
  }

  extractSkinName(formattedName) {
    // Extract skin name from "AK-47 | Asiimov" format
    const parts = formattedName.split(' | ');
    return parts[1] || 'Default';
  }

  getRandomWear() {
    const wears = ['factory new', 'minimal wear', 'field-tested', 'well-worn', 'battle-scarred'];
    const weights = [0.05, 0.15, 0.40, 0.25, 0.15]; // Probability distribution
    
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (let i = 0; i < wears.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return wears[i];
      }
    }
    
    return 'field-tested'; // Default fallback
  }

  calculateSkinValue(rarity) {
    // Base values for each rarity tier in points system
    const baseValues = {
      'consumer grade': 1000,      // 1,000 points
      'industrial grade': 3000,    // 3,000 points
      'mil-spec': 8000,           // 8,000 points
      'restricted': 20000,         // 20,000 points
      'classified': 50000,         // 50,000 points
      'covert': 150000,            // 150,000 points
      'special': 250000            // 250,000 points
    };
    
    const baseValue = baseValues[rarity] || 1000;
    
    // Add some randomness to make it more realistic
    const variation = 0.3; // ±30% variation
    const randomFactor = 1 + (Math.random() - 0.5) * variation * 2;
    
    return Math.round(baseValue * randomFactor);
  }

  inferSkinRarity(weapon, skinName, actualQuality = null) {
    // If we have actual quality data from the raw skins data, use it
    if (actualQuality) {
      // Map invalid quality values to valid rarity values
      const mappedQuality = this.mapQualityToRarity(actualQuality);
      console.log(`🎯 Using mapped quality for ${weapon} | ${skinName}: ${actualQuality} → ${mappedQuality}`);
      return mappedQuality;
    }
    
    // Infer rarity based on weapon type and skin characteristics
    const weaponLower = weapon.toLowerCase();
    const skinNameLower = skinName.toLowerCase();
    
    // Special items (knives, gloves) are usually high rarity
    if (weaponLower.includes('knife') || weaponLower.includes('gloves') || weaponLower.includes('dagger')) {
      return 'special';
    }
    
    // AWP skins are usually high rarity
    if (weaponLower === 'awp') {
      return 'covert';
    }
    
    // AK-47 and M4A4 skins are usually high rarity
    if (weaponLower === 'ak-47' || weaponLower === 'm4a4') {
      return 'classified';
    }
    
    // Some specific skin names indicate higher rarity
    if (skinNameLower.includes('dragon lore') || skinNameLower.includes('howl') || 
        skinNameLower.includes('fire serpent') || skinNameLower.includes('asiimov')) {
      return 'covert';
    }
    
    // Default to mil-spec for most skins when no actual quality data is available
    console.log(`🎯 Inferring rarity for ${weapon} | ${skinName}: defaulting to mil-spec`);
    return 'mil-spec';
  }

  /**
   * Maps invalid quality values from raw data to valid rarity values
   * @param {string} quality - The quality value from raw data
   * @returns {string} - The mapped rarity value
   */
  mapQualityToRarity(quality) {
    const qualityMapping = {
      'extraordinary': 'special',        // Map extraordinary to special (gold tier)
      'consumer grade': 'consumer grade',
      'industrial grade': 'industrial grade',
      'mil-spec': 'mil-spec',
      'restricted': 'restricted',
      'classified': 'classified',
      'covert': 'covert',
      'special': 'special'
    };
    
    const mappedRarity = qualityMapping[quality.toLowerCase()];
    if (!mappedRarity) {
      console.warn(`⚠️ Unknown quality value: ${quality}, defaulting to mil-spec`);
      return 'mil-spec';
    }
    
    return mappedRarity;
  }

  validateCaseCategorization() {
    console.log('🔍 Validating case categorization...');
    let totalMismatches = 0;
    let totalSkins = 0;
    
    for (const [caseId, caseData] of this.cases) {
      let caseMismatches = 0;
      
      // Check each rarity tier in the case
      for (const [rarityKey, skinNames] of Object.entries(caseData.items)) {
        for (const skinName of skinNames) {
          totalSkins++;
          const foundSkin = this.findSkinByName(skinName);
          
          if (foundSkin) {
            // Convert rarity key to standard format for comparison
            const caseRarity = rarityKey
              .replace(/([A-Z])/g, ' $1')  // Add space before capitals
              .replace(/^./, (str) => str.toLowerCase())  // First character to lowercase
              .replace(/\s+/g, ' ')  // Normalize spaces
              .trim();
            
            if (foundSkin.rarity !== caseRarity) {
              caseMismatches++;
              totalMismatches++;
              console.log(`⚠️ Case categorization mismatch in ${caseData.formattedName}:`);
              console.log(`   Skin: ${skinName}`);
              console.log(`   Case has: ${caseRarity}`);
              console.log(`   Actual quality: ${foundSkin.rarity}`);
            }
          }
        }
      }
      
      if (caseMismatches > 0) {
        console.log(`⚠️ Case "${caseData.formattedName}" has ${caseMismatches} categorization mismatches`);
      }
    }
    
    if (totalMismatches > 0) {
      console.log(`⚠️ Found ${totalMismatches} categorization mismatches out of ${totalSkins} total skins`);
      console.log('💡 Consider updating case data to match actual skin qualities');
    } else {
      console.log('✅ All case categorizations match skin qualities');
    }
  }

  // Get all cases
  getAllCases() {
    return Array.from(this.cases.values());
  }

  // Get case by ID
  getCase(caseId) {
    return this.cases.get(caseId.toLowerCase());
  }

  // Get all skins
  getAllSkins() {
    return Array.from(this.skins.values());
  }

  // Get skin by ID
  getSkin(skinId) {
    return this.skins.get(skinId.toLowerCase());
  }

  // Get skins by weapon
  getSkinsByWeapon(weapon) {
    return Array.from(this.skins.values()).filter(skin => 
      skin.weapon.toLowerCase().includes(weapon.toLowerCase())
    );
  }

  // Get skins by rarity
  getSkinsByRarity(rarity) {
    return Array.from(this.skins.values()).filter(skin => 
      skin.rarity === rarity
    );
  }

  // Search skins by name
  searchSkins(query) {
    const searchTerm = query.toLowerCase();
    return Array.from(this.skins.values()).filter(skin =>
      skin.formattedName.toLowerCase().includes(searchTerm) ||
      skin.weapon.toLowerCase().includes(searchTerm) ||
      skin.skinName.toLowerCase().includes(searchTerm)
    );
  }

  // Get random skin from case
  getRandomSkinFromCase(caseId) {
    const caseData = this.getCase(caseId);
    if (!caseData) {
      throw new Error('Case not found');
    }

    // Get available rarity tiers for this specific case (only those with items)
    const availableRarities = Object.entries(caseData.items)
      .filter(([rarity, items]) => items && items.length > 0) // Only include rarities with items
      .map(([rarity]) => rarity);
    
    console.log(`🎯 Available rarities in ${caseData.formatted_name}:`, availableRarities);
    
    if (availableRarities.length === 0) {
      throw new Error('No items available in this case');
    }
    
    // Define case-specific rarity distributions based on CS:GO drop rates
    // These are the ACTUAL drop rates for each rarity tier
    const caseRarityDistribution = {
      'milSpec': 0.032,        // 3.2% - mil-spec grade
      'restricted': 0.0064,    // 0.64% - restricted
      'classified': 0.00128,   // 0.128% - classified
      'covert': 0.000256,      // 0.0256% - covert
      'special': 0.00064       // 0.064% - special (knives/gloves)
    };
    
    // Filter to only include rarities available in this case
    const availableDistribution = {};
    let totalProbability = 0;
    
    for (const [rarity, probability] of Object.entries(caseRarityDistribution)) {
      if (availableRarities.includes(rarity)) {
        availableDistribution[rarity] = probability;
        totalProbability += probability;
      }
    }
    
    // Use the original CS:GO drop rates directly
    // These are already the correct relative probabilities
    const finalDistribution = availableDistribution;
    
    console.log(`📊 Case rarity distribution for ${caseData.formatted_name}:`);
    for (const [rarity, probability] of Object.entries(finalDistribution)) {
      const percentage = (probability * 100).toFixed(3);
      const itemCount = caseData.items[rarity].length;
      console.log(`   ${rarity}: ${percentage}% (${itemCount} items)`);
    }
    
    // Select rarity based on absolute CS:GO drop rates
    const random = Math.random();
    let cumulativeProbability = 0;
    let selectedRarity = Object.keys(finalDistribution)[0]; // Fallback to first available
    
    // Scale the random number to match our probability range
    const scaledRandom = random * totalProbability;
    
    for (const [rarity, probability] of Object.entries(finalDistribution)) {
      cumulativeProbability += probability;
      if (scaledRandom <= cumulativeProbability) {
        selectedRarity = rarity;
        break;
      }
    }
    
    const availableSkins = caseData.items[selectedRarity] || [];
    console.log(`🎯 Selected rarity: ${selectedRarity}, available skins: ${availableSkins.length}`);

    if (availableSkins.length === 0) {
      console.warn(`⚠️ No skins available for rarity ${selectedRarity}`);
      throw new Error('No skins available in this case');
    }

    // Select random skin from the selected rarity
    const randomSkinName = availableSkins[Math.floor(Math.random() * availableSkins.length)];
    console.log(`🎯 Selected random skin: "${randomSkinName}" from rarity: ${selectedRarity}`);
    
    const foundSkin = this.findSkinByName(randomSkinName);
    if (!foundSkin) {
      console.warn(`⚠️ Could not find skin: ${randomSkinName} from rarity: ${selectedRarity}`);
    } else {
      // Override the skin's rarity with the case rarity to ensure consistency
      // This fixes the issue where special items (knives/gloves) show as "covert"
      // Also convert camelCase to kebab-case for Discord bot compatibility
      const convertRarityFormat = (rarity) => {
        const formatMap = {
          'milSpec': 'mil-spec',
          'consumerGrade': 'consumer-grade',
          'industrialGrade': 'industrial-grade'
        };
        return formatMap[rarity] || rarity;
      };
      
      const correctedSkin = {
        ...foundSkin.toObject ? foundSkin.toObject() : foundSkin,
        rarity: convertRarityFormat(selectedRarity)
      };
      
      console.log(`✅ Found skin data:`, {
        skinId: correctedSkin.skinId,
        formattedName: correctedSkin.formattedName,
        weapon: correctedSkin.weapon,
        skinName: correctedSkin.skinName,
        rarity: correctedSkin.rarity, // This will now be the case rarity (e.g., "special")
        imageUrl: correctedSkin.imageUrl
      });
      
      return correctedSkin;
    }
    return foundSkin;
  }

  // Find skin by name
  findSkinByName(skinName) {
    // Normalize the search name for better matching
    const normalizedSearchName = skinName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
      .replace(/\s+/g, ' ')          // Normalize spaces
      .trim();
    
    console.log(`🔍 Searching for skin: "${skinName}" (normalized: "${normalizedSearchName}")`);
    
    // First try exact match
    let foundSkin = Array.from(this.skins.values()).find(skin => {
      const normalizedSkinName = skin.formattedName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
        .replace(/\s+/g, ' ')          // Normalize spaces
        .trim();
      
      return normalizedSkinName === normalizedSearchName;
    });
    
    // If no exact match, try partial matching
    if (!foundSkin) {
      console.log('🔍 No exact match, trying partial matching...');
      foundSkin = Array.from(this.skins.values()).find(skin => {
        const normalizedSkinName = skin.formattedName.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
          .replace(/\s+/g, ' ')          // Normalize spaces
          .trim();
        
        // Check if the search name is contained within the skin name
        return normalizedSkinName.includes(normalizedSearchName) || 
               normalizedSearchName.includes(normalizedSkinName);
      });
    }
    
    // If still no match, try matching weapon and skin name separately
    if (!foundSkin) {
      console.log('🔍 No partial match, trying weapon/skin name matching...');
      const searchParts = normalizedSearchName.split(' ');
      if (searchParts.length >= 2) {
        const searchWeapon = searchParts[0];
        const searchSkinName = searchParts.slice(1).join(' ');
        
        foundSkin = Array.from(this.skins.values()).find(skin => {
          const skinWeapon = skin.weapon.toLowerCase();
          const skinSkinName = skin.skinName.toLowerCase();
          
          return skinWeapon.includes(searchWeapon) && skinSkinName.includes(searchSkinName);
        });
      }
    }
    
    if (foundSkin) {
      console.log(`✅ Found skin: "${foundSkin.formattedName}" (ID: ${foundSkin.skinId})`);
    } else {
      console.log(`❌ No skin found for: "${skinName}"`);
      // Log some available skins for debugging
      const availableSkins = Array.from(this.skins.values()).slice(0, 5);
      console.log('🔍 Available skins sample:', availableSkins.map(s => s.formattedName));
    }
    
    return foundSkin;
  }

  // Check if service needs initialization
  needsInitialization() {
    return !this.isInitialized;
  }

  // Get initialization status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      casesCount: this.cases.size,
      skinsCount: this.skins.size,
      lastSync: this.lastSync,
      skinsWithEmptyImages: this.getSkinsWithEmptyImages().length
    };
  }
  
  // Get list of skins with empty image URLs
  getSkinsWithEmptyImages() {
    return Array.from(this.skins.values()).filter(skin => 
      !skin.imageUrl || skin.imageUrl === 'https://via.placeholder.com/300x200?text=No+Image'
    );
  }

  // Refresh data (useful for updates)
  async refresh() {
    this.isInitialized = false;
    await this.initialize();
  }

  // Force refresh with database sync (for maintenance)
  async forceRefresh() {
    this.isInitialized = false;
    await this.initialize(false); // Force database sync
  }

  // Refresh without database sync (for data updates only)
  async refreshDataOnly() {
    this.isInitialized = false;
    await this.initialize(true); // Skip database sync
  }
}

module.exports = new CS2DataService();
