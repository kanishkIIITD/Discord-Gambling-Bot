/**
 * Utility functions for image optimization
 */

/**
 * Converts an image to WebP format using the Canvas API
 * @param {string} imageSrc - The source URL of the image
 * @param {number} quality - The quality of the WebP image (0-1)
 * @returns {Promise<string>} - A promise that resolves to the WebP data URL
 */
export const convertToWebP = (imageSrc, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Handle CORS for remote images
    
    img.onload = () => {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the image on the canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Convert to WebP
      try {
        // Check if browser supports toBlob with webp
        if (canvas.toBlob) {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(URL.createObjectURL(blob));
              } else {
                // Fallback to data URL if blob creation fails
                resolve(canvas.toDataURL('image/webp', quality));
              }
            },
            'image/webp',
            quality
          );
        } else {
          // Fallback for browsers that don't support toBlob
          resolve(canvas.toDataURL('image/webp', quality));
        }
      } catch (error) {
        console.error('Error converting image to WebP:', error);
        // Return original image source if conversion fails
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      console.error('Error loading image for WebP conversion:', error);
      reject(error);
    };
    
    img.src = imageSrc;
  });
};

/**
 * Checks if the browser supports WebP format
 * @returns {Promise<boolean>} - A promise that resolves to true if WebP is supported
 */
export const isWebPSupported = () => {
  return new Promise((resolve) => {
    const webpImg = new Image();
    
    webpImg.onload = () => {
      // The image loaded successfully, WebP is supported
      resolve(true);
    };
    
    webpImg.onerror = () => {
      // The image failed to load, WebP is not supported
      resolve(false);
    };
    
    // A simple 1x1 WebP image
    webpImg.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
};

/**
 * Preloads an image to ensure it's in the browser cache
 * @param {string} src - The source URL of the image to preload
 * @returns {Promise<HTMLImageElement>} - A promise that resolves when the image is loaded
 */
export const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Generates a low-quality placeholder image for blur-up effect
 * @param {string} src - The source URL of the original image
 * @param {number} size - The size of the placeholder (width and height)
 * @returns {Promise<string>} - A promise that resolves to the placeholder data URL
 */
export const generatePlaceholder = (src, size = 20) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      // Create a small canvas for the placeholder
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = Math.round((size * img.height) / img.width);
      
      // Draw the image at a small size
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Return the small image as a data URL
      resolve(canvas.toDataURL('image/jpeg', 0.1));
    };
    
    img.onerror = reject;
    img.src = src;
  });
};