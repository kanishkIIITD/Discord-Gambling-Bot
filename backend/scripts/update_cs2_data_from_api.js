#!/usr/bin/env node

/**
 * Update CS2 Data from CSGO-API Script
 * 
 * This script fetches comprehensive CS:GO case and skin data from the
 * ByMykel CSGO-API and converts it to our local format, properly
 * including knives and gloves in the special tier.
 * 
 * Usage: node scripts/update_cs2_data_from_api.js
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class CS2DataUpdater {
  constructor() {
    this.cratesApiUrl = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/crates.json';
    this.skinsApiUrl = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/skins.json';
    this.cratesData = [];
    this.skinsData = {};
  }

  async fetchData() {
    try {
      console.log('📡 Fetching data from CSGO-API...');
      
      // Fetch crates data
      console.log('📦 Fetching crates data...');
      const cratesResponse = await axios.get(this.cratesApiUrl);
      this.cratesData = cratesResponse.data;
      console.log(`✅ Fetched ${this.cratesData.length} crates`);
      
      // Fetch skins data
      console.log('🎨 Fetching skins data...');
      const skinsResponse = await axios.get(this.skinsApiUrl);
      this.skinsData = skinsResponse.data;
      console.log(`✅ Fetched ${Object.keys(this.skinsData).length} skins`);
      
    } catch (error) {
      console.error('❌ Failed to fetch data:', error.message);
      throw error;
    }
  }

  convertRarity(apiRarity) {
    const rarityMapping = {
      'Consumer Grade': 'consumer grade',
      'Industrial Grade': 'industrial grade',
      'Mil-Spec Grade': 'mil-spec',
      'Restricted': 'restricted',
      'Classified': 'classified',
      'Covert': 'covert',
      'Extraordinary': 'special'
    };
    
    return rarityMapping[apiRarity] || 'mil-spec';
  }

  convertCaseData() {
    console.log('🔄 Converting case data...');
    
    const convertedCases = {};
    let totalCases = 0;
    let casesWithSpecialItems = 0;
    
    for (const crate of this.cratesData) {
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
      
      // Skip non-case and non-allowed souvenir items
      if ((crate.type !== 'Case' && (crate.type !== 'Souvenir' || !allowedSouvenirIds.includes(crate.id))) || !crate.contains || crate.contains.length === 0) {
        continue;
      }
      
      const caseId = crate.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
      
      // Group items by rarity
      const itemsByRarity = {};
      
      // Process regular items
      for (const item of crate.contains) {
        const rarity = this.convertRarity(item.rarity.name);
        if (!itemsByRarity[rarity]) {
          itemsByRarity[rarity] = [];
        }
        itemsByRarity[rarity].push(item.name);
      }
      
      // Process special items (knives, gloves) from contains_rare
      if (crate.contains_rare && crate.contains_rare.length > 0) {
        itemsByRarity['special'] = [];
        for (const specialItem of crate.contains_rare) {
          itemsByRarity['special'].push(specialItem.name);
        }
        casesWithSpecialItems++;
      }
      
      // Convert rarity keys to camelCase for our system
      const convertedItems = {};
      for (const [rarity, itemList] of Object.entries(itemsByRarity)) {
        const rarityKey = rarity
          .replace(/\s+/g, '')  // Remove spaces
          .replace(/^./, (str) => str.toLowerCase())  // First character to lowercase
          .replace(/-([a-z])/g, (g) => g[1].toUpperCase());  // Convert kebab-case to camelCase
        
        convertedItems[rarityKey] = itemList;
      }
      
      convertedCases[caseId] = {
        formatted_name: crate.name,
        image_url: crate.image,
        items: convertedItems,
        requires_key: true // Most cases require keys
      };
      
      totalCases++;
    }
    
    console.log(`✅ Converted ${totalCases} cases and 8 specific souvenir packages`);
    console.log(`🎯 ${casesWithSpecialItems} cases contain special items (knives/gloves)`);
    
    return convertedCases;
  }

  convertSkinsData() {
    console.log('🔄 Converting skins data...');
    
    const convertedSkins = {};
    let totalSkins = 0;
    let specialSkins = 0;
    
    for (const [skinId, skinData] of Object.entries(this.skinsData)) {
      // Skip items without proper data
      if (!skinData.name || !skinData.rarity) {
        continue;
      }
      
      const rarity = this.convertRarity(skinData.rarity.name);
      
      // Track special items
      if (rarity === 'special') {
        specialSkins++;
      }
      
      convertedSkins[skinId] = {
        formatted_name: skinData.name,
        quality: rarity,
        weapon_type: this.extractWeaponType(skinData.name),
        image_urls: skinData.image ? [skinData.image] : [],
        description: skinData.description || ''
      };
      
      totalSkins++;
    }
    
    console.log(`✅ Converted ${totalSkins} skins`);
    console.log(`🎯 ${specialSkins} special skins (knives/gloves)`);
    
    return convertedSkins;
  }

  extractWeaponType(skinName) {
    // Extract weapon type from skin name
    const weaponPatterns = {
      'knife': /★\s*([^|]+)/i,
      'gloves': /gloves/i,
      'bayonet': /bayonet/i,
      'karambit': /karambit/i,
      'm9': /m9/i,
      'butterfly': /butterfly/i,
      'huntsman': /huntsman/i,
      'falchion': /falchion/i,
      'bowie': /bowie/i,
      'gut': /gut/i,
      'flip': /flip/i,
      'shadow': /shadow/i,
      'navaja': /navaja/i,
      'stiletto': /stiletto/i,
      'ursus': /ursus/i,
      'talon': /talon/i,
      'nomad': /nomad/i,
      'skeleton': /skeleton/i,
      'survival': /survival/i,
      'paracord': /paracord/i,
      'canis': /canis/i,
      'cord': /cord/i,
      'daggers': /daggers/i
    };
    
    for (const [type, pattern] of Object.entries(weaponPatterns)) {
      if (pattern.test(skinName)) {
        return type;
      }
    }
    
    // Default to weapon if no special type found
    return 'weapon';
  }

  async saveData(convertedCases, convertedSkins) {
    try {
      console.log('💾 Saving converted data...');
      
      // Save cases
      const casesPath = path.join(__dirname, '../data/raw_cases.json');
      await fs.writeFile(casesPath, JSON.stringify(convertedCases, null, 2));
      console.log(`✅ Saved cases to ${casesPath}`);
      
      // Save skins
      const skinsPath = path.join(__dirname, '../data/raw_skins.json');
      await fs.writeFile(skinsPath, JSON.stringify(convertedSkins, null, 2));
      console.log(`✅ Saved skins to ${skinsPath}`);
      
    } catch (error) {
      console.error('❌ Failed to save data:', error.message);
      throw error;
    }
  }

  async run() {
    try {
      console.log('🚀 Starting CS2 data update from CSGO-API...\n');
      
      // Fetch data from API
      await this.fetchData();
      
      // Convert case data
      const convertedCases = this.convertCaseData();
      
      // Convert skins data
      const convertedSkins = this.convertSkinsData();
      
      // Save converted data
      await this.saveData(convertedCases, convertedSkins);
      
      console.log('\n🎉 CS2 data update completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   Cases: ${Object.keys(convertedCases).length}`);
      console.log(`   Skins: ${Object.keys(convertedSkins).length}`);
      console.log(`   Special Items: ${Object.keys(convertedSkins).filter(id => 
        convertedSkins[id].quality === 'special'
      ).length}`);
      
      // Show some examples of special items
      const specialItems = Object.values(convertedSkins).filter(skin => skin.quality === 'special').slice(0, 5);
      if (specialItems.length > 0) {
        console.log('\n🎯 Example special items:');
        specialItems.forEach(skin => {
          console.log(`   • ${skin.formatted_name} (${skin.weapon_type})`);
        });
      }
      
    } catch (error) {
      console.error('\n❌ Update failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the updater
const updater = new CS2DataUpdater();
updater.run();
