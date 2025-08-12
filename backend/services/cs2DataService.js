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

  /**
   * Calculate adjusted odds for different container types using the ratio rule
   * Based on official CS2 odds: each rarer tier is about 1/5 as likely as the previous one
   * @param {string[]} presentRarities - Array of rarities present in the container
   * @returns {Object} Normalized percentages for each rarity
   */
  calculateAdjustedOdds(presentRarities = ['milSpec', 'restricted', 'classified', 'covert', 'special']) {
    // Raw weights based on the ratio rule (geometric progression)
    // Consumer Grade and Industrial Grade are included for souvenir packages
    const RATIO = {
      'consumerGrade': 25,    // Consumer Grade (White) - most common in souvenir packages
      'industrialGrade': 5,   // Industrial Grade (Light Blue) - 1/5 as likely as Consumer
      'milSpec': 1,           // Mil-Spec (Blue) - 1/5 as likely as Industrial
      'restricted': 1/5,      // Restricted (Purple) - 1/5 as likely as Mil-Spec
      'classified': 1/25,     // Classified (Pink) - 1/5 as likely as Restricted
      'covert': 1/125,        // Covert (Red) - 1/5 as likely as Classified
      'special': 1/625        // Special (Gold) - 1/5 as likely as Covert
    };

    // Calculate raw weights for present rarities
    const raw = {};
    let sum = 0;
    
    for (const rarity of presentRarities) {
      if (RATIO.hasOwnProperty(rarity)) {
        raw[rarity] = RATIO[rarity];
        sum += raw[rarity];
      }
    }

    // Normalize to get percentages
    const out = {};
    for (const rarity of presentRarities) {
      out[rarity] = (raw[rarity] / sum) * 100; // Convert to percentage
    }

    return out;
  }

  async initialize(skipDatabaseSync = false, forceReload = false) {
    if (this.isInitialized && !forceReload) {
      console.log('📊 CS2 data service already initialized, skipping...');
      return;
    }
    
    if (forceReload) {
      console.log('🔄 Force reload requested, clearing existing data...');
      this.cases.clear();
      this.skins.clear();
      this.isInitialized = false;
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
      
      // Force reload from raw data if requested
      if (forceReload) {
        console.log('🔄 Force reload requested, loading from raw data...');
        await this.loadCasesData();
        await this.loadSkinsData();
        
        // After force reload, always sync to database to ensure data persistence
        if (!skipDatabaseSync) {
          console.log('🔄 Syncing force-reloaded data to database...');
          await this.syncWithDatabase();
        }
      } else {
        // Only sync with database if explicitly requested or if no data exists
        if (!skipDatabaseSync && (existingCases === 0 || existingSkins === 0)) {
          console.log('📊 Database appears empty, syncing CS2 data...');
          await this.syncWithDatabase();
        } else if (!skipDatabaseSync) {
          console.log('📊 CS2 data already exists in database, skipping sync');
        }
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
      
      // Process items with type "Case" or specific souvenir packages
      let caseCount = 0;
      
      // Define the specific souvenir package IDs to include
      const allowedSouvenirIds = [
        '232', // Boston 2018 Cobblestone Souvenir Package
        '45',  // ESL One Katowice 2015 Cobblestone Souvenir Package
        '137', // MLG Columbus 2016 Cobblestone Souvenir Package
        '77',  // ESL One Cologne 2015 Cobblestone Souvenir Package
        '105', // DreamHack Cluj-Napoca 2015 Cobblestone Souvenir Package
        '203', // Atlanta 2017 Cobblestone Souvenir Package
        '329', // Stockholm 2021 Mirage Souvenir Package
        '342'  // Antwerp 2022 Mirage Souvenir Package
      ];
      
      // Debug: Check what souvenir packages exist in the raw data
      const foundSouvenirs = Object.entries(casesData).filter(([id, data]) => 
        data.type === 'Souvenir' && allowedSouvenirIds.includes(id)
      );
      console.log(`🔍 Found ${foundSouvenirs.length} allowed souvenir packages in raw data:`);
      foundSouvenirs.forEach(([id, data]) => {
        console.log(`   • ${id}: ${data.name} (type: ${data.type})`);
        console.log(`     - Has contains: ${!!data.contains}`);
        console.log(`     - Contains length: ${data.contains ? data.contains.length : 'N/A'}`);
        console.log(`     - Has image: ${!!data.image}`);
      });
      
      // Also check all souvenir packages to see what we're missing
      const allSouvenirs = Object.entries(casesData).filter(([id, data]) => data.type === 'Souvenir');
      console.log(`🔍 Total souvenir packages in raw data: ${allSouvenirs.length}`);
      if (allSouvenirs.length > 0) {
        console.log(`   First few souvenir packages:`);
        allSouvenirs.slice(0, 5).forEach(([id, data]) => {
          console.log(`   • ${id}: ${data.name}`);
        });
      }
      
      for (const [itemId, itemData] of Object.entries(casesData)) {
        // Debug: Log what we're checking
        if (itemData.type === 'Souvenir' && allowedSouvenirIds.includes(itemId)) {
          console.log(`🔍 Found allowed souvenir package: ${itemId} - ${itemData.name}`);
        }
        
        // Only process items that are actually cases or the specific souvenir packages
        if (itemData.type !== 'Case' && (itemData.type !== 'Souvenir' || !allowedSouvenirIds.includes(itemId))) {
          continue;
        }
        
        // Skip cases with invalid data - check for new structure
        if (!itemData.name) {
          console.warn(`⚠️ Skipping ${itemData.type} ${itemId}: missing name`);
          continue;
        }
        
        // For souvenir packages, we need to handle them differently since they might not have contains field
        if (itemData.type === 'Souvenir') {
          console.log(`🔍 Processing souvenir package: ${itemData.name} (${itemId})`);
          
          // Check if souvenir package has contains field, if not, skip it
          if (!itemData.contains || itemData.contains.length === 0) {
            console.warn(`⚠️ Skipping souvenir package ${itemId}: no contains field or empty contains`);
            continue;
          }
        } else {
          console.log(`🔍 Processing case: ${itemData.name}`);
          
          // Regular cases need both name and image
          if (!itemData.image) {
            console.warn(`⚠️ Skipping case ${itemId}: missing image`);
            continue;
          }
        }
        
        console.log(`   Contains: ${(itemData.contains || []).length} items`);
        console.log(`   Contains rare: ${(itemData.contains_rare || []).length} items`);
        
        if (itemData.contains_rare && itemData.contains_rare.length > 0) {
          console.log(`   Rare items: ${itemData.contains_rare.map(item => item.name).join(', ')}`);
        }
        
        const items = this.convertCaseItems(itemData.contains || [], itemData.contains_rare || []);
        
        const processedCase = {
          caseId: itemId.toLowerCase().replace(/\s+/g, '-'),
          formattedName: itemData.name.trim(),
          imageUrl: itemData.image ? itemData.image.trim() : '', // Handle souvenir packages without images
          requiresKey: itemData.requires_key || false,
          price: this.calculateCasePrice({ items }),
          items: items,
          type: itemData.type // Store the type for filtering
        };
        
        this.cases.set(processedCase.caseId, processedCase);
        caseCount++;
      }
      
      // Show which souvenir packages were loaded
      const souvenirPackages = Array.from(this.cases.values()).filter(c => c.type === 'Souvenir');
      if (souvenirPackages.length > 0) {
        console.log(`\n🎁 Souvenir packages loaded:`);
        souvenirPackages.forEach(pkg => {
          console.log(`   • ${pkg.formattedName} (${pkg.caseId})`);
        });
      } else {
        console.log(`\n⚠️ No souvenir packages were loaded!`);
        console.log(`   This might indicate an issue with the filtering logic or data structure.`);
      }
      
      console.log(`📦 Loaded ${caseCount} cases and 8 specific souvenir packages (filtered from ${Object.keys(casesData).length} total items)`);
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
      let skinCount = 0;
      for (const [itemId, itemData] of Object.entries(skinsData)) {
        // Skip skins with invalid data - check for new structure
        if (!itemData.name) {
          console.warn(`⚠️ Skipping skin ${itemId}: missing name`);
          continue;
        }
        
        // Extract weapon and skin name from new structure
        const weapon = itemData.weapon?.name || 'Unknown Weapon';
        const skinName = itemData.pattern?.name || 'Unknown Skin';
        
        // Use actual quality from new rarity structure
        const actualQuality = itemData.rarity?.name || null;
        const inferredRarity = this.inferSkinRarity(weapon, skinName, actualQuality);
        
        // Log quality mapping for debugging
        if (actualQuality && actualQuality !== inferredRarity) {
          console.log(`🔄 Quality mapping: ${itemData.name} - ${actualQuality} → ${inferredRarity}`);
        }
        
        // Extract image URL - prioritize actual image URLs over placeholders
        let imageUrl = null;
        
        // First try the main image field (which is what the raw data has)
        if (itemData.image && itemData.image.trim() !== '' && !itemData.image.includes('placeholder')) {
          imageUrl = itemData.image.trim();
        }
        
        // Fallback to image_urls array if main image field is not available
        if (!imageUrl && itemData.image_urls && itemData.image_urls.length > 0) {
          const validImageUrl = itemData.image_urls.find(url => url && url.trim() !== '' && !url.includes('placeholder'));
          if (validImageUrl) {
            imageUrl = validImageUrl.trim();
          }
        }
        
        // Extract pattern and phase information
        const pattern = itemData.pattern?.name || itemData.pattern || '';
        const phase = itemData.phase || '';
        
        // Extract float range (default to full range if not specified)
        const minFloat = itemData.min_float || 0.0;
        const maxFloat = itemData.max_float || 1.0;
        
        const processedSkin = {
          skinId: itemId.toLowerCase().replace(/\s+/g, '-').replace(/\|/g, '-'),
          formattedName: itemData.name.trim(),
          weapon: weapon,
          skinName: skinName,
          rarity: inferredRarity,
          imageUrl: imageUrl,
          minFloat: minFloat,
          maxFloat: maxFloat,
          pattern: pattern,
          phase: phase,
          isStatTrak: itemData.stattrak || false,
          isSouvenir: itemData.souvenir || false
        };
        
        // Debug logging for image processing (only log first few for brevity)
        if (skinCount <= 5) {
          if (imageUrl) {
            console.log(`✅ Skin "${itemData.name}" has image: ${imageUrl}`);
          } else {
            console.log(`⚠️ Skin "${itemData.name}" has no valid image URL`);
            // Log what's available for debugging
            if (itemData.image) {
              console.log(`   Available image: ${itemData.image}`);
            }
            if (itemData.image_urls) {
              console.log(`   Available image_urls: ${JSON.stringify(itemData.image_urls)}`);
            }
          }
        }
        
        this.skins.set(processedSkin.skinId, processedSkin);
        skinCount++;
      }
      
      console.log(`🎨 Loaded ${skinCount} skins (filtered from ${Object.keys(skinsData).length} total items)`);
      
      // Count skins with and without images
      const skinsWithImages = Array.from(this.skins.values()).filter(skin => skin.imageUrl);
      const skinsWithoutImages = Array.from(this.skins.values()).filter(skin => !skin.imageUrl);
      
      console.log(`📊 Image URL Statistics:`);
      console.log(`   Skins with images: ${skinsWithImages.length}`);
      console.log(`   Skins without images: ${skinsWithoutImages.length}`);
      console.log(`   Image coverage: ${((skinsWithImages.length / skinCount) * 100).toFixed(1)}%`);
      
      if (skinsWithoutImages.length > 0) {
        console.log(`⚠️ Sample skins without images:`);
        skinsWithoutImages.slice(0, 3).forEach(skin => {
          console.log(`   - ${skin.formattedName}`);
        });
      }
      
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

  convertCaseItems(contains, containsRare = []) {
    // The new structure has a flat array of items, we need to categorize them by rarity
    const items = {
      consumerGrade: [],
      industrialGrade: [],
      milSpec: [],
      restricted: [],
      classified: [],
      covert: [],
      special: []
    };
    
    // Process each item in the contains array (regular items)
    for (const item of contains) {
      if (item && item.name && item.rarity && item.rarity.name) {
        // Check if this is a special item (knife or glove) first
        if (this.isSpecialItem(item.name)) {
          items.special.push(item.name);
          console.log(`🔍 Found special item in contains: "${item.name}" with rarity "${item.rarity.name}"`);
          continue;
        }
        
        // Map the rarity name to the expected key for non-special items
        const rarityKey = this.mapRarityNameToKey(item.rarity.name);
        if (rarityKey && items[rarityKey]) {
          items[rarityKey].push(item.name);
        } else {
          // Debug logging for unmapped rarities
          console.log(`⚠️ Unmapped rarity in case: "${item.rarity.name}" for item "${item.name}"`);
        }
      }
    }
    
    // Process each item in the contains_rare array (special items like knives/gloves)
    for (const item of containsRare) {
      if (item && item.name) {
        // These are typically special items, so add them to special array
        items.special.push(item.name);
        console.log(`🔍 Found special item in contains_rare: "${item.name}"`);
      }
    }
    
    // Log summary of items found
    console.log(`📦 Case items summary:`);
    for (const [rarity, itemList] of Object.entries(items)) {
      if (itemList.length > 0) {
        console.log(`   ${rarity}: ${itemList.length} items`);
        if (rarity === 'special' && itemList.length > 0) {
          console.log(`     Special items: ${itemList.join(', ')}`);
        }
      }
    }
    
    return items;
  }

  isSpecialItem(itemName) {
    // Check if the item is a knife or glove (special items)
    const lowerName = itemName.toLowerCase();
    
    // Knives start with ★ or contain specific knife names
    const isKnife = itemName.includes('★') || 
                   lowerName.includes('★') ||
                   // Only check for actual knife names, not generic words that might appear in skin names
                   lowerName.includes('★ knife') ||
                   lowerName.includes('★ dagger') ||
                   lowerName.includes('★ karambit') ||
                   lowerName.includes('★ bayonet') ||
                   lowerName.includes('★ butterfly') ||
                   lowerName.includes('★ falchion') ||
                   lowerName.includes('★ flip') ||
                   lowerName.includes('★ gut') ||
                   lowerName.includes('★ huntsman') ||
                   lowerName.includes('★ shadow') ||
                   lowerName.includes('★ ursus') ||
                   lowerName.includes('★ widowmaker') ||
                   lowerName.includes('★ nomad') ||
                   lowerName.includes('★ stiletto') ||
                   lowerName.includes('★ talon') ||
                   lowerName.includes('★ navaja') ||
                   lowerName.includes('★ classic') ||
                   lowerName.includes('★ paracord') ||
                   lowerName.includes('★ survival') ||
                   lowerName.includes('★ canis') ||
                   lowerName.includes('★ cord') ||
                   lowerName.includes('★ skeleton') ||
                   lowerName.includes('★ outdoor') ||
                   lowerName.includes('★ daggers') ||
                   lowerName.includes('★ bowie') ||
                   lowerName.includes('★ push') ||
                   lowerName.includes('★ tiger') ||
                   lowerName.includes('★ switch');
    
    // Gloves contain various glove-related terms
    const isGlove = lowerName.includes('glove') || 
                   lowerName.includes('hand wrap') ||
                   lowerName.includes('sport glove') ||
                   lowerName.includes('driver glove') ||
                   lowerName.includes('moto glove') ||
                   lowerName.includes('specialist glove') ||
                   lowerName.includes('bloodhound glove') ||
                   lowerName.includes('wraps') ||
                   lowerName.includes('mitts') ||
                   lowerName.includes('gauntlets');
    
    const isSpecial = isKnife || isGlove;
    
    if (isSpecial) {
      console.log(`🔍 Detected special item: "${itemName}" (Knife: ${isKnife}, Glove: ${isGlove})`);
    }
    
    return isSpecial;
  }

  mapRarityNameToKey(rarityName) {
    // Map the rarity names from the new data structure to the expected keys
    const rarityMap = {
      'Consumer Grade': 'consumerGrade',
      'Industrial Grade': 'industrialGrade',
      'Mil-Spec Grade': 'milSpec',
      'Restricted': 'restricted',
      'Classified': 'classified',
      'Covert': 'covert'
      // Note: Special items (knives/gloves) are handled separately by isSpecialItem()
    };
    
    // Try exact match first
    if (rarityMap[rarityName]) {
      return rarityMap[rarityName];
    }
    
    // Try normalized match (remove spaces, hyphens, etc.)
    const normalizedRarity = rarityName.toLowerCase()
      .replace(/[\s\-]/g, '')
      .replace(/grade/g, '');
    
    for (const [key, value] of Object.entries(rarityMap)) {
      const normalizedKey = key.toLowerCase()
        .replace(/[\s\-]/g, '')
        .replace(/grade/g, '');
      
      if (normalizedKey === normalizedRarity) {
        return value;
      }
    }
    
    // Debug logging for unmapped rarities
    console.log(`⚠️ Unmapped rarity: "${rarityName}" - consider adding to rarityMap`);
    
    return null;
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

  /**
   * Calculate wear condition based on float value
   * @param {number} float - Float value between 0.0 and 1.0
   * @returns {string} - Wear condition
   */
  calculateWearFromFloat(float) {
    if (float <= 0.07) return 'factory new';
    if (float <= 0.15) return 'minimal wear';
    if (float <= 0.38) return 'field-tested';
    if (float <= 0.45) return 'well-worn';
    return 'battle-scarred';
  }

  /**
   * Generate a random float value within the skin's range
   * @param {number} minFloat - Minimum float value
   * @param {number} maxFloat - Maximum float value
   * @returns {number} - Random float value
   */
  generateRandomFloat(minFloat = 0.0, maxFloat = 1.0) {
    return Math.random() * (maxFloat - minFloat) + minFloat;
  }

  /**
   * Get random wear condition for a skin
   * @param {number} minFloat - Minimum float value
   * @param {number} maxFloat - Maximum float value
   * @returns {object} - Object containing wear and float
   */
  getRandomWear(minFloat = 0.0, maxFloat = 1.0) {
    const float = this.generateRandomFloat(minFloat, maxFloat);
    const wear = this.calculateWearFromFloat(float);
    
    return {
      wear,
      float: parseFloat(float.toFixed(6))
    };
  }

  /**
   * Calculate skin market value using continuous exponential decay model
   * @param {string} rarity - Skin rarity
   * @param {number} float - Float value (0.0 to 1.0)
   * @param {string} weapon - Weapon type
   * @param {string} skinName - Skin name
   * @param {boolean} isStatTrak - Whether skin is StatTrak
   * @param {boolean} isSouvenir - Whether skin is Souvenir
   * @param {string} phase - Phase of the skin (if applicable)
   * @returns {number} - Market value in points
   */
  calculateSkinValue(rarity, float, weapon, skinName, isStatTrak = false, isSouvenir = false, phase = null) {
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
    
    let baseValue = baseValues[rarity] || 1000;
    
    // Adjust value based on weapon popularity
    const weaponMultipliers = {
      'ak-47': 1.2,
      'm4a4': 1.2,
      'm4a1s': 1.2,
      'awp': 1.5,
      'glock-18': 1.1,
      'usp-s': 1.1,
      'desert eagle': 1.3
    };
    
    const weaponLower = weapon.toLowerCase();
    for (const [weaponType, multiplier] of Object.entries(weaponMultipliers)) {
      if (weaponLower.includes(weaponType)) {
        baseValue *= multiplier;
        break;
      }
    }
    
    // Adjust value for special skins
    const specialSkinMultipliers = {
      'dragon lore': 3.0,
      'howl': 2.5,
      'fire serpent': 2.0,
      'asiimov': 1.8,
      'fade': 1.6,
      'doppler': 1.7,
      'marble fade': 1.9,
      'tiger tooth': 1.5,
      'damascus steel': 1.4,
      'ultraviolet': 1.3,
      'rust coat': 0.8
    };
    
    const skinNameLower = skinName.toLowerCase();
    for (const [pattern, multiplier] of Object.entries(specialSkinMultipliers)) {
      if (skinNameLower.includes(pattern)) {
        baseValue *= multiplier;
        break;
      }
    }
    
    // Apply phase-specific multipliers (CS2 market reality)
    if (phase) {
      const phaseMultipliers = this.getPhaseMultipliers(skinName, phase);
      baseValue *= phaseMultipliers;
      console.log(`🎨 Applied phase multiplier for ${skinName} Phase ${phase}: ${phaseMultipliers.toFixed(2)}x`);
    }
    
    // Apply continuous exponential decay pricing based on float
    const price = this.estimatePriceContinuous(baseValue, float);
    
    // Apply StatTrak and Souvenir multipliers
    let finalPrice = price;
    if (isStatTrak) finalPrice *= 1.4; // 40% increase for StatTrak
    if (isSouvenir) finalPrice *= 1.5; // 50% increase for Souvenir
    
    // Add some randomness to make it more realistic (±15% variation)
    const variation = 0.15;
    const randomFactor = 1 + (Math.random() - 0.5) * variation * 2;
    
    return Math.round(finalPrice * randomFactor);
  }

  /**
   * Get phase-specific multipliers for different skin types
   * @param {string} skinName - Name of the skin
   * @param {string} phase - Phase number
   * @returns {number} - Multiplier for the phase
   */
  getPhaseMultipliers(skinName, phase) {
    const skinNameLower = skinName.toLowerCase();
    
    // Doppler phases (most popular phase system)
    if (skinNameLower.includes('doppler')) {
      const dopplerMultipliers = {
        '1': 0.8,   // Phase 1: Blue dominant, less popular
        '2': 1.0,   // Phase 2: Pink dominant, popular
        '3': 0.9,   // Phase 3: Purple dominant, moderately popular
        '4': 1.3,   // Phase 4: Blue dominant but with pink, very popular
        'ruby': 2.5, // Ruby: Red dominant, extremely rare and valuable
        'sapphire': 3.0, // Sapphire: Blue dominant, extremely rare and valuable
        'black pearl': 2.8 // Black Pearl: Black with rainbow, extremely rare
      };
      return dopplerMultipliers[phase.toLowerCase()] || 1.0;
    }
    
    // Marble Fade phases
    if (skinNameLower.includes('marble fade')) {
      const marbleFadeMultipliers = {
        '1': 1.0,   // Phase 1: Standard
        '2': 1.1,   // Phase 2: Slightly more colorful
        '3': 1.2,   // Phase 3: More vibrant
        '4': 1.3,   // Phase 4: Most colorful
        '5': 1.4    // Phase 5: Extremely colorful
      };
      return marbleFadeMultipliers[phase] || 1.0;
    }
    
    // Fade phases
    if (skinNameLower.includes('fade')) {
      const fadeMultipliers = {
        '1': 0.9,   // Phase 1: Less fade
        '2': 1.0,   // Phase 2: Standard fade
        '3': 1.1,   // Phase 3: More fade
        '4': 1.2,   // Phase 4: Maximum fade
        '5': 1.3    // Phase 5: Extreme fade
      };
      return fadeMultipliers[phase] || 1.0;
    }
    
    // Tiger Tooth phases
    if (skinNameLower.includes('tiger tooth')) {
      const tigerToothMultipliers = {
        '1': 1.0,   // Phase 1: Standard
        '2': 1.1,   // Phase 2: Slightly different pattern
        '3': 1.2    // Phase 3: Most defined pattern
      };
      return tigerToothMultipliers[phase] || 1.0;
    }
    
    // Damascus Steel phases
    if (skinNameLower.includes('damascus steel')) {
      const damascusMultipliers = {
        '1': 1.0,   // Phase 1: Standard
        '2': 1.1,   // Phase 2: Slightly different pattern
        '3': 1.2    // Phase 3: Most defined pattern
      };
      return damascusMultipliers[phase] || 1.0;
    }
    
    // Default: no phase multiplier
    return 1.0;
  }

  /**
   * Continuous pricing model using exponential decay
   * @param {number} basePrice - Base price for the skin
   * @param {number} floatVal - Float value (0.0 to 1.0)
   * @returns {number} - Price adjusted for float
   */
  estimatePriceContinuous(basePrice, floatVal) {
    // Parameters for the exponential decay model
    const A = 0.30;  // Floor as float → 1.0 (minimum 30% of base price)
    const B = 0.70;  // So at float=0 price ≈ basePrice*(1.0)
    const k = 12;    // Controls steepness — larger k = stronger premium for low floats
    
    // Calculate multiplier using exponential decay
    const multiplier = A + B * Math.exp(-k * floatVal);
    
    return basePrice * multiplier;
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
    let totalMissingSkins = 0;
    
    for (const [caseId, caseData] of this.cases) {
      let caseMismatches = 0;
      let caseMissingSkins = 0;
      
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
          } else {
            caseMissingSkins++;
            totalMissingSkins++;
            console.log(`❌ Missing skin in case ${caseData.formattedName}:`);
            console.log(`   Skin: ${skinName}`);
            console.log(`   Rarity tier: ${rarityKey}`);
          }
        }
      }
      
      if (caseMismatches > 0 || caseMissingSkins > 0) {
        console.log(`⚠️ Case "${caseData.formattedName}" has ${caseMismatches} categorization mismatches and ${caseMissingSkins} missing skins`);
      }
    }
    
    if (totalMismatches > 0 || totalMissingSkins > 0) {
      console.log(`⚠️ Found ${totalMismatches} categorization mismatches and ${totalMissingSkins} missing skins out of ${totalSkins} total skins`);
      console.log('💡 Consider updating case data to match actual skin qualities');
      
      if (totalMissingSkins > 0) {
        console.log('🚨 CRITICAL: Missing skins will cause case opening failures!');
        console.log('   This needs immediate attention to fix the case data.');
      }
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

  /**
   * Generate a complete skin instance when a case is opened
   * @param {object} baseSkin - Base skin data from database
   * @returns {object} - Complete skin instance with wear, float, and market value
   */
  generateSkinInstance(baseSkin) {
    // Generate random wear and float
    const wearData = this.getRandomWear(baseSkin.minFloat, baseSkin.maxFloat);
    
    // Determine if this skin should be StatTrak or Souvenir
    // StatTrak: independent 10% chance after rarity selection (official CS2 odds)
    const isStatTrak = Math.random() < 0.1; // 10% chance
    const isSouvenir = Math.random() < 0.05; // 5% chance
    
    // Calculate market value based on all factors
    const marketValue = this.calculateSkinValue(
      baseSkin.rarity,
      wearData.float,
      baseSkin.weapon,
      baseSkin.skinName,
      isStatTrak,
      isSouvenir,
      baseSkin.phase
    );
    
    // Create the complete skin instance with all necessary fields
    const skinInstance = {
      ...baseSkin,
      wear: wearData.wear,
      float: wearData.float,
      isStatTrak,
      isSouvenir,
      marketValue,
      generatedAt: new Date()
    };
    
    // Ensure pattern and phase are explicitly included (they should come from baseSkin)
    // This is important for Discord bot display
    if (baseSkin.pattern !== undefined) {
      skinInstance.pattern = baseSkin.pattern;
    }
    if (baseSkin.phase !== undefined) {
      skinInstance.phase = baseSkin.phase;
    }
    
    // Debug logging to verify all fields are present
    console.log(`🎨 Generated skin instance for ${baseSkin.formattedName}:`, {
      weapon: skinInstance.weapon,
      skinName: skinInstance.skinName,
      rarity: skinInstance.rarity,
      wear: skinInstance.wear,
      float: skinInstance.float,
      pattern: skinInstance.pattern,
      phase: skinInstance.phase,
      isStatTrak: skinInstance.isStatTrak,
      isSouvenir: skinInstance.isSouvenir,
      marketValue: skinInstance.marketValue
    });
    
    return skinInstance;
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
    
    console.log(`🎯 Available rarities in ${caseData.formattedName}:`, availableRarities);
    
    if (availableRarities.length === 0) {
      throw new Error('No items available in this case');
    }
    
    // Calculate odds based on container type
    let finalDistribution;
    let totalProbability = 0; // Define totalProbability for both paths
    
    if (caseData.type === 'Souvenir') {
      // Souvenir packages have different odds - they include Consumer/Industrial grades
      // and renormalize, making Covert items rarer
      console.log(`🎁 Souvenir package detected: ${caseData.formattedName}`);
      
      // For souvenir packages, we need to check if Consumer/Industrial grades are present
      // and use the full ratio system including these grades
      const souvenirRarities = availableRarities.filter(rarity => 
        ['consumerGrade', 'industrialGrade', 'milSpec', 'restricted', 'classified', 'covert'].includes(rarity)
      );
      
      console.log(`🎁 Souvenir package rarities: ${souvenirRarities.join(', ')}`);
      
      // Check if Consumer/Industrial grades are present
      const hasConsumerGrade = souvenirRarities.includes('consumerGrade');
      const hasIndustrialGrade = souvenirRarities.includes('industrialGrade');
      
      if (hasConsumerGrade || hasIndustrialGrade) {
        console.log(`🎁 Souvenir package includes additional rarities:`);
        if (hasConsumerGrade) console.log(`   • Consumer Grade (White) - most common`);
        if (hasIndustrialGrade) console.log(`   • Industrial Grade (Light Blue) - 1/5 as likely as Consumer`);
        console.log(`   • This makes Covert items significantly rarer than in standard cases`);
      }
      
      // Get odds from the ratio system and convert percentages to probabilities
      const souvenirOdds = this.calculateAdjustedOdds(souvenirRarities);
      finalDistribution = {};
      let totalProbability = 0;
      
      console.log(`🎁 Converting souvenir odds from percentages to probabilities:`);
      
      // Convert percentages to probabilities (0-1) and calculate total
      for (const [rarity, percentage] of Object.entries(souvenirOdds)) {
        finalDistribution[rarity] = percentage / 100; // Convert percentage to probability
        totalProbability += finalDistribution[rarity];
        console.log(`   ${rarity}: ${percentage.toFixed(2)}% → ${finalDistribution[rarity].toFixed(6)}`);
      }
      
      console.log(`   Total probability before normalization: ${totalProbability.toFixed(6)}`);
      
      // Normalize to ensure probabilities sum to 1
      for (const [rarity, probability] of Object.entries(finalDistribution)) {
        finalDistribution[rarity] = probability / totalProbability;
      }
      
      console.log(`   Probabilities normalized to sum to 1.000000`);
    } else {
      // Standard weapon cases use official CS2 odds
      // Using the ratio rule: each rarer tier is about 1/5 as likely as the previous one
      // Special is set to exactly 0.01% and covert adjusted to 0.99%
      const caseRarityDistribution = {
        'consumerGrade': 0,      // 0% - Consumer Grade (not in normal weapon cases)
        'industrialGrade': 0,    // 0% - Industrial Grade (not in normal weapon cases)
        'milSpec': 0.7992,       // 79.92% - Mil-Spec (Blue)
        'restricted': 0.1598,    // 15.98% - Restricted (Purple)
        'classified': 0.0320,    // 3.20% - Classified (Pink)
        'covert': 0.0099,        // 0.99% - Covert (Red) - adjusted from 0.64%
        'special': 0.0001        // 0.01% - Rare Special (Gold - Knives & Gloves) - exactly as requested
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
      
      // Normalize probabilities to ensure they sum to 1 (100%)
      finalDistribution = {};
      for (const [rarity, probability] of Object.entries(availableDistribution)) {
        finalDistribution[rarity] = probability / totalProbability;
      }
    }
    
    console.log(`📊 Case rarity distribution for ${caseData.formattedName}:`);
    let totalProbabilityCheck = 0;
    for (const [rarity, probability] of Object.entries(finalDistribution)) {
      const percentage = (probability * 100).toFixed(3);
      const itemCount = caseData.items[rarity].length;
      console.log(`   ${rarity}: ${percentage}% (${itemCount} items)`);
      totalProbabilityCheck += probability;
    }
    console.log(`   Total probability: ${totalProbabilityCheck.toFixed(6)} (should be 1.000000)`);
    
    // Note: StatTrak has independent 10% chance after rarity selection
    console.log(`📊 Note: StatTrak odds are 10% independent of rarity (official CS2 odds)`);
    
    // Display the exact odds for this case
    console.log(`📊 Final odds for ${caseData.formattedName}:`);
    Object.entries(finalDistribution).forEach(([rarity, probability]) => {
      const percentage = (probability * 100).toFixed(4);
      console.log(`   ${rarity}: ${percentage}%`);
    });
    
    // Select rarity based on normalized probabilities (already sum to 1)
    const random = Math.random();
    let cumulativeProbability = 0;
    let selectedRarity = Object.keys(finalDistribution)[0]; // Fallback to first available
    
    console.log(`🎲 Random selection process (random=${random.toFixed(4)}):`);
    
    // Since probabilities are already normalized to sum to 1, we can use random directly
    for (const [rarity, probability] of Object.entries(finalDistribution)) {
      cumulativeProbability += probability;
      console.log(`   ${rarity}: cumulative=${cumulativeProbability.toFixed(4)} (${(probability * 100).toFixed(2)}%)`);
      if (random <= cumulativeProbability) {
        selectedRarity = rarity;
        console.log(`   ✅ Selected: ${rarity} (random ${random.toFixed(4)} ≤ ${cumulativeProbability.toFixed(4)})`);
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
    
    // Find all variants of this skin (including different phases)
    const skinVariants = this.findSkinVariants(randomSkinName);
    console.log(`🔍 Found ${skinVariants.length} variants for "${randomSkinName}"`);
    
    if (skinVariants.length === 0) {
      console.warn(`⚠️ Could not find skin: "${randomSkinName}" from rarity: ${selectedRarity}`);
      
      // Try alternative search strategies
      console.log(`🔄 Attempting alternative search strategies...`);
      
      // Strategy 1: Try exact name match
      const exactMatch = Array.from(this.skins.values()).find(skin => 
        skin.formattedName.toLowerCase() === randomSkinName.toLowerCase()
      );
      
      if (exactMatch) {
        console.log(`✅ Found exact match: ${exactMatch.formattedName}`);
        const correctedSkin = {
          ...exactMatch.toObject ? exactMatch.toObject() : exactMatch,
          rarity: convertRarityFormat(selectedRarity)
        };
        return this.generateSkinInstance(correctedSkin);
      }
      
      // Strategy 2: Try partial weapon match
      const weaponMatch = Array.from(this.skins.values()).find(skin => 
        skin.weapon.toLowerCase().includes(randomSkinName.toLowerCase()) ||
        randomSkinName.toLowerCase().includes(skin.weapon.toLowerCase())
      );
      
      if (weaponMatch) {
        console.log(`✅ Found weapon match: ${weaponMatch.formattedName}`);
        const correctedSkin = {
          ...weaponMatch.toObject ? weaponMatch.toObject() : weaponMatch,
          rarity: convertRarityFormat(selectedRarity)
        };
        return this.generateSkinInstance(correctedSkin);
      }
      
      // Strategy 3: Try to find any skin from the same rarity
      const sameRaritySkins = Array.from(this.skins.values()).filter(skin => {
        const skinRarity = skin.rarity.replace(/\s+/g, '').replace(/^./, str => str.toLowerCase());
        return skinRarity === selectedRarity;
      });
      
      if (sameRaritySkins.length > 0) {
        const fallbackSkin = sameRaritySkins[Math.floor(Math.random() * sameRaritySkins.length)];
        console.log(`✅ Using fallback skin from same rarity: ${fallbackSkin.formattedName}`);
        const correctedSkin = {
          ...fallbackSkin.toObject ? fallbackSkin.toObject() : fallbackSkin,
          rarity: convertRarityFormat(selectedRarity)
        };
        return this.generateSkinInstance(correctedSkin);
      }
      
      console.error(`❌ All search strategies failed for: "${randomSkinName}"`);
      console.error(`   Case rarity: ${selectedRarity}`);
      console.error(`   Available skins in database: ${this.skins.size}`);
      console.error(`   Sample available skins:`, Array.from(this.skins.values()).slice(0, 3).map(s => s.formattedName));
      
      throw new Error(`Failed to find skin "${randomSkinName}" in database. This may indicate a data mismatch between cases and skins.`);
    }
    
    // Randomly select one of the variants (this handles phase selection)
    const selectedVariant = skinVariants[Math.floor(Math.random() * skinVariants.length)];
    console.log(`🎯 Selected variant: "${selectedVariant.formattedName}" (Phase: ${selectedVariant.phase || 'None'})`);
    
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
      ...selectedVariant.toObject ? selectedVariant.toObject() : selectedVariant,
      rarity: convertRarityFormat(selectedRarity)
    };
    
    console.log(`✅ Found skin data:`, {
      skinId: correctedSkin.skinId,
      formattedName: correctedSkin.formattedName,
      weapon: correctedSkin.weapon,
      skinName: correctedSkin.skinName,
      rarity: correctedSkin.rarity, // This will now be the case rarity (e.g., "special")
      imageUrl: correctedSkin.imageUrl,
      pattern: correctedSkin.pattern || 'None',
      phase: correctedSkin.phase || 'None',
      minFloat: correctedSkin.minFloat,
      maxFloat: correctedSkin.maxFloat
    });
    
    // Generate a complete skin instance with wear, float, and market value
    return this.generateSkinInstance(correctedSkin);
  }

  /**
   * Find all variants of a skin (including different phases)
   * @param {string} skinName - The base skin name to search for
   * @returns {Array} - Array of skin variants
   */
  findSkinVariants(skinName) {
    // Normalize the search name for better matching
    const normalizedSearchName = skinName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
      .replace(/\s+/g, ' ')          // Normalize spaces
      .trim();
    
    console.log(`🔍 Searching for skin variants: "${skinName}" (normalized: "${normalizedSearchName}")`);
    
    // Strategy 1: Try exact formatted name match first
    const exactMatches = Array.from(this.skins.values()).filter(skin => 
      skin.formattedName.toLowerCase() === skinName.toLowerCase()
    );
    
    if (exactMatches.length > 0) {
      console.log(`✅ Found ${exactMatches.length} exact matches for "${skinName}"`);
      return exactMatches;
    }
    
    // Strategy 2: Try weapon + skin name combination
    const searchParts = normalizedSearchName.split(' ');
    if (searchParts.length >= 2) {
      const searchWeapon = searchParts[0];
      const searchSkinName = searchParts.slice(1).join(' ');
      
      const weaponSkinMatches = Array.from(this.skins.values()).filter(skin => {
        const skinWeapon = skin.weapon.toLowerCase();
        const skinSkinName = skin.skinName.toLowerCase();
        
        // Check if weapon matches
        const weaponMatch = skinWeapon.includes(searchWeapon) || searchWeapon.includes(skinWeapon);
        
        // Check if skin name matches (ignoring phase information)
        const baseSkinName = skinSkinName.replace(/\s*phase\s*\d+/i, '').trim();
        const searchBaseName = searchSkinName.replace(/\s*phase\s*\d+/i, '').trim();
        
        const skinNameMatch = baseSkinName.includes(searchBaseName) || searchBaseName.includes(baseSkinName);
        
        return weaponMatch && skinNameMatch;
      });
      
      if (weaponSkinMatches.length > 0) {
        console.log(`✅ Found ${weaponSkinMatches.length} weapon+skin matches for "${skinName}"`);
        return weaponSkinMatches;
      }
    }
    
    // Strategy 3: Try partial name matching
    const partialMatches = Array.from(this.skins.values()).filter(skin => 
      skin.formattedName.toLowerCase().includes(skinName.toLowerCase()) ||
      skinName.toLowerCase().includes(skin.formattedName.toLowerCase())
    );
    
    if (partialMatches.length > 0) {
      console.log(`✅ Found ${partialMatches.length} partial matches for "${skinName}"`);
      return partialMatches;
    }
    
    // Strategy 4: Try weapon-only matching
    const weaponMatches = Array.from(this.skins.values()).filter(skin => 
      skin.weapon.toLowerCase().includes(skinName.toLowerCase()) ||
      skinName.toLowerCase().includes(skin.weapon.toLowerCase())
    );
    
    if (weaponMatches.length > 0) {
      console.log(`✅ Found ${weaponMatches.length} weapon-only matches for "${skinName}"`);
      return weaponMatches;
    }
    
    // If we get here, no matches were found
    console.log(`❌ No variants found for: "${skinName}"`);
    // Log some available skins for debugging
    const availableSkins = Array.from(this.skins.values()).slice(0, 5);
    console.log('🔍 Available skins sample:', availableSkins.map(s => s.formattedName));
    
    return [];
  }

  // Find skin by name (kept for backward compatibility)
  findSkinByName(skinName) {
    const variants = this.findSkinVariants(skinName);
    return variants.length > 0 ? variants[0] : null;
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
