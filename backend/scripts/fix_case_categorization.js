#!/usr/bin/env node

/**
 * Fix CS2 Case Categorization Script
 * 
 * This script analyzes the raw skins and cases data to identify and fix
 * categorization mismatches where skins are placed in the wrong rarity tiers.
 * 
 * Usage: node scripts/fix_case_categorization.js
 */

const fs = require('fs').promises;
const path = require('path');

class CaseCategorizationFixer {
  constructor() {
    this.skinsData = {};
    this.casesData = {};
    this.fixes = [];
  }

  async loadData() {
    try {
      console.log('📂 Loading raw skins data...');
      const skinsPath = path.join(__dirname, '../data/raw_skins.json');
      this.skinsData = JSON.parse(await fs.readFile(skinsPath, 'utf8'));
      console.log(`✅ Loaded ${Object.keys(this.skinsData).length} total items`);

      console.log('📂 Loading raw cases data...');
      const casesPath = path.join(__dirname, '../data/raw_cases.json');
      this.casesData = JSON.parse(await fs.readFile(casesPath, 'utf8'));
      
      // Filter to only actual cases and specific souvenir packages
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
      
      const totalItems = Object.keys(this.casesData).length;
      const actualCases = Object.fromEntries(
        Object.entries(this.casesData).filter(([id, data]) => 
          data.type === 'Case' || (data.type === 'Souvenir' && allowedSouvenirIds.includes(id))
        )
      );
      this.casesData = actualCases;
      
      console.log(`✅ Loaded ${Object.keys(this.casesData).length} cases and 8 specific souvenir packages (filtered from ${totalItems} total items)`);
    } catch (error) {
      console.error('❌ Failed to load data:', error);
      throw error;
    }
  }

  findSkinByName(skinName) {
    // Normalize the search name for better matching
    const normalizedSearchName = skinName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
      .replace(/\s+/g, ' ')          // Normalize spaces
      .trim();
    
    // First try exact match
    for (const [itemId, itemData] of Object.entries(this.skinsData)) {
      const normalizedSkinName = itemData.name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
        .replace(/\s+/g, ' ')          // Normalize spaces
        .trim();
      
      if (normalizedSkinName === normalizedSearchName) {
        return itemData;
      }
    }
    
    // If no exact match, try partial matching
    for (const [itemId, itemData] of Object.entries(this.skinsData)) {
      const normalizedSkinName = itemData.name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
        .replace(/\s+/g, ' ')          // Normalize spaces
        .trim();
      
      if (normalizedSkinName.includes(normalizedSearchName) || 
          normalizedSkinName.includes(normalizedSearchName)) {
        return itemData;
      }
    }
    
    return null;
  }

  analyzeCategorization() {
    console.log('🔍 Analyzing case categorization...');
    let totalMismatches = 0;
    let totalSkins = 0;
    
    for (const [itemId, itemData] of Object.entries(this.casesData)) {
      let caseMismatches = 0;
      const caseFixes = [];
      
      // Check each rarity tier in the case
      for (const [rarityKey, skinNames] of Object.entries(itemData.items)) {
        for (const skinName of skinNames) {
          totalSkins++;
          const foundSkin = this.findSkinByName(skinName);
          
          if (foundSkin && foundSkin.rarity?.name) {
            // Convert rarity key to standard format for comparison (same as CS2 data service)
            const caseRarity = rarityKey
              .replace(/([A-Z])/g, '-$1')  // Add hyphen before capitals
              .replace(/^./, (str) => str.toLowerCase())  // First character to lowercase
              .replace(/^-/, '')  // Remove leading hyphen
              .trim();
            
            if (foundSkin.rarity.name !== caseRarity) {
              caseMismatches++;
              totalMismatches++;
              
              const fix = {
                caseId: itemId,
                caseName: itemData.name,
                skinName,
                currentRarity: caseRarity,
                actualQuality: foundSkin.rarity.name,
                action: 'move'
              };
              
              caseFixes.push(fix);
              this.fixes.push(fix);
              
              console.log(`⚠️ Mismatch in ${itemData.name}:`);
              console.log(`   Skin: ${skinName}`);
              console.log(`   Case has: ${caseRarity}`);
              console.log(`   Actual quality: ${foundSkin.rarity.name}`);
            }
          }
        }
      }
      
      if (caseMismatches > 0) {
        console.log(`⚠️ Case "${itemData.name}" has ${caseMismatches} categorization mismatches`);
      }
    }
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`   Total cases analyzed: ${Object.keys(this.casesData).length}`);
    console.log(`   Total skins analyzed: ${totalSkins}`);
    console.log(`   Total mismatches found: ${totalMismatches}`);
    
    return totalMismatches;
  }

  async applyFixes() {
    if (this.fixes.length === 0) {
      console.log('✅ No fixes needed!');
      return;
    }

    console.log(`\n🔧 Applying ${this.fixes.length} fixes...`);
    
    // Group fixes by case
    const fixesByCase = {};
    for (const fix of this.fixes) {
      if (!fixesByCase[fix.caseId]) {
        fixesByCase[fix.caseId] = [];
      }
      fixesByCase[fix.caseId].push(fix);
    }
    
    // Apply fixes to each case
    for (const [caseId, caseFixes] of Object.entries(fixesByCase)) {
      const itemData = this.casesData[caseId];
      console.log(`\n🔧 Fixing case: ${itemData.name}`);
      
      for (const fix of caseFixes) {
        // Remove skin from current rarity tier
        const currentRarityKey = fix.currentRarity.replace(/\s+/g, '').replace(/^./, str => str.toLowerCase());
        if (itemData.items[currentRarityKey]) {
          const index = itemData.items[currentRarityKey].indexOf(fix.skinName);
          if (index > -1) {
            itemData.items[currentRarityKey].splice(index, 1);
            console.log(`   ➖ Removed "${fix.skinName}" from ${fix.currentRarity}`);
          }
        }
        
        // Add skin to correct rarity tier
        const correctRarityKey = fix.actualQuality.replace(/\s+/g, '').replace(/^./, str => str.toLowerCase());
        if (!itemData.items[correctRarityKey]) {
          itemData.items[correctRarityKey] = [];
        }
        itemData.items[correctRarityKey].push(fix.skinName);
        console.log(`   ➕ Added "${fix.skinName}" to ${fix.actualQuality}`);
      }
    }
  }

  async saveFixedData() {
    if (this.fixes.length === 0) {
      console.log('✅ No data to save');
      return;
    }

    try {
      console.log('\n💾 Saving fixed cases data...');
      
      // Create backup
      const backupPath = path.join(__dirname, '../data/raw_cases_backup.json');
      await fs.writeFile(backupPath, JSON.stringify(this.casesData, null, 2));
      console.log(`✅ Backup created: ${backupPath}`);
      
      // Save fixed data
      const casesPath = path.join(__dirname, '../data/raw_cases.json');
      await fs.writeFile(casesPath, JSON.stringify(this.casesData, null, 2));
      console.log(`✅ Fixed data saved: ${casesPath}`);
      
    } catch (error) {
      console.error('❌ Failed to save data:', error);
      throw error;
    }
  }

  async run() {
    try {
      console.log('🚀 Starting CS2 Case Categorization Fix...\n');
      
      await this.loadData();
      const mismatches = this.analyzeCategorization();
      
      if (mismatches > 0) {
        console.log('\n❓ Do you want to apply fixes? (y/N)');
        // For automated scripts, you can set this to true
        const shouldApply = process.env.AUTO_APPLY === 'true';
        
        if (shouldApply) {
          await this.applyFixes();
          await this.saveFixedData();
          console.log('\n✅ All fixes applied and saved!');
        } else {
          console.log('\n💡 To apply fixes automatically, set AUTO_APPLY=true');
          console.log('💡 Or run the script interactively to review changes');
        }
      } else {
        console.log('\n✅ All case categorizations are correct!');
      }
      
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  }
}

// Run the script
if (require.main === module) {
  const fixer = new CaseCategorizationFixer();
  fixer.run();
}

module.exports = CaseCategorizationFixer;
