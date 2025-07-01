/**
 * Script to convert images in the public folder to WebP format
 * Run with: node scripts/convertToWebP.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // You may need to install this: npm install sharp

// Configuration
const PUBLIC_DIR = path.join(__dirname, '../public');
const QUALITY = 80; // WebP quality (0-100)
const FORMATS_TO_CONVERT = ['.jpg', '.jpeg', '.png'];

/**
 * Recursively finds all image files in a directory
 * @param {string} dir - Directory to search
 * @param {Array} fileList - Accumulator for found files
 * @returns {Array} - List of image file paths
 */
function findImageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findImageFiles(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (FORMATS_TO_CONVERT.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

/**
 * Converts an image to WebP format
 * @param {string} imagePath - Path to the image file
 * @returns {Promise} - Promise that resolves when conversion is complete
 */
async function convertToWebP(imagePath) {
  const outputPath = imagePath.replace(/\.[^\.]+$/, '.webp');
  
  // Skip if WebP version already exists and is newer than the source
  if (fs.existsSync(outputPath)) {
    const srcStat = fs.statSync(imagePath);
    const webpStat = fs.statSync(outputPath);
    
    if (webpStat.mtime > srcStat.mtime) {
      console.log(`Skipping ${path.basename(imagePath)} - WebP version is up to date`);
      return;
    }
  }
  
  try {
    await sharp(imagePath)
      .webp({ quality: QUALITY })
      .toFile(outputPath);
    
    console.log(`Converted ${path.basename(imagePath)} to WebP`);
    
    // Get file sizes for comparison
    const originalSize = fs.statSync(imagePath).size;
    const webpSize = fs.statSync(outputPath).size;
    const savings = ((originalSize - webpSize) / originalSize * 100).toFixed(2);
    
    console.log(`  Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  WebP: ${(webpSize / 1024).toFixed(2)} KB`);
    console.log(`  Savings: ${savings}%`);
  } catch (error) {
    console.error(`Error converting ${path.basename(imagePath)}:`, error.message);
  }
}

/**
 * Main function to convert all images
 */
async function main() {
  console.log('Searching for images to convert...');
  const imageFiles = findImageFiles(PUBLIC_DIR);
  
  if (imageFiles.length === 0) {
    console.log('No images found to convert.');
    return;
  }
  
  console.log(`Found ${imageFiles.length} images to convert.`);
  
  // Process images sequentially to avoid overwhelming the system
  for (const imagePath of imageFiles) {
    await convertToWebP(imagePath);
  }
  
  console.log('\nConversion complete!');
  console.log('Remember to update your image references to use the WebP versions when supported.');
}

// Run the script
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});