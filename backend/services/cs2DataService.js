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
            consumerGrade: caseData.items['consumer grade'] || [],
            industrialGrade: caseData.items['industrial grade'] || [],
            milSpec: caseData.items['mil-spec'] || [],
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
        const inferredRarity = this.inferSkinRarity(weapon, skinName);
        
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
    
    // Adjust price based on number of items
    const totalItems = Object.values(caseData.items).reduce((sum, items) => sum + items.length, 0);
    basePrice += totalItems * 250; // 250 points per item
    
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
    
    return Math.round(basePrice / 1000) * 1000; // Round to nearest 1,000 points
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

  inferSkinRarity(weapon, skinName) {
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
    
    // Default to mil-spec for most skins
    return 'mil-spec';
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

    // Use CS2 rarity distribution
    const rarityDistribution = {
      'consumer grade': 0.7992,
      'industrial grade': 0.1598,
      'mil-spec': 0.032,
      'restricted': 0.0064,
      'classified': 0.00128,
      'covert': 0.000256,
      'special': 0.00064
    };

    const random = Math.random();
    let cumulativeProbability = 0;
    let selectedRarity = 'consumer grade';

    for (const [rarity, probability] of Object.entries(rarityDistribution)) {
      cumulativeProbability += probability;
      if (random <= cumulativeProbability) {
        selectedRarity = rarity;
        break;
      }
    }

    // Get available skins for this rarity in this case
    // Convert rarity to camelCase to match the transformed keys
    const rarityKey = selectedRarity
      .replace(/\s+/g, '')  // Remove spaces
      .replace(/^./, (str) => str.toLowerCase())  // First character to lowercase
      .replace(/-([a-z])/g, (g) => g[1].toUpperCase());  // Convert kebab-case to camelCase
    
    const availableSkins = caseData.items[rarityKey] || [];

    if (availableSkins.length === 0) {
      // Fallback to any available rarity
      for (const rarity of Object.keys(caseData.items)) {
        if (caseData.items[rarity].length > 0) {
          const randomSkin = caseData.items[rarity][Math.floor(Math.random() * caseData.items[rarity].length)];
          const foundSkin = this.findSkinByName(randomSkin);
          if (!foundSkin) {
            console.warn(`⚠️ Could not find skin: ${randomSkin} from rarity: ${rarity}`);
          }
          return foundSkin;
        }
      }
      throw new Error('No skins available in this case');
    }

    // Select random skin from the selected rarity
    const randomSkinName = availableSkins[Math.floor(Math.random() * availableSkins.length)];
    console.log(`🎯 Selected random skin name: "${randomSkinName}" from rarity: ${selectedRarity}`);
    
    const foundSkin = this.findSkinByName(randomSkinName);
    if (!foundSkin) {
      console.warn(`⚠️ Could not find skin: ${randomSkinName} from rarity: ${selectedRarity} (key: ${rarityKey})`);
    } else {
      console.log(`✅ Found skin data:`, {
        skinId: foundSkin.skinId,
        formattedName: foundSkin.formattedName,
        weapon: foundSkin.weapon,
        skinName: foundSkin.skinName,
        rarity: foundSkin.rarity,
        imageUrl: foundSkin.imageUrl
      });
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
