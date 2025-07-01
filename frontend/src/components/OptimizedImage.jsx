import React, { useState, useEffect, useRef } from 'react';

/**
 * OptimizedImage component for better image loading performance
 * Features:
 * - Lazy loading with IntersectionObserver
 * - Responsive image sizes
 * - Blur-up loading effect
 * - WebP support with fallback
 * - Error handling
 * - Accessibility improvements
 */
const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  className = '',
  sizes = '100vw',
  loading = 'lazy',
  objectFit = 'cover',
  placeholderColor = '#f3f4f6',
  onLoad,
  onError,
  ariaLabel,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  // Use IntersectionObserver for better lazy loading
  useEffect(() => {
    if (!imgRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Start loading when image is 200px from viewport
    );
    
    observer.observe(imgRef.current);
    
    return () => {
      if (imgRef.current) {
        observer.disconnect();
      }
    };
  }, []);

  // Check if the image is an SVG
  const isSvg = src?.toLowerCase().endsWith('.svg');

  // For SVGs, we don't need to generate different sizes
  if (isSvg) {
    return (
      <img
        ref={imgRef}
        src={isInView || loading !== 'lazy' ? src : ''}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{
          objectFit,
          transition: 'opacity 0.3s ease-in-out',
        }}
        loading={loading}
        onLoad={(e) => {
          setIsLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setError(true);
          onError?.(e);
        }}
        aria-label={ariaLabel || alt}
        {...props}
      />
    );
  }

  // Generate WebP and fallback URLs with more robust conversion logic
  const getImageUrls = () => {
    // If src is already a WebP, don't try to convert it
    if (src?.toLowerCase().endsWith('.webp')) {
      return { webp: src, fallback: src };
    }

    // For PNG/JPG images, we would ideally have WebP versions
    // Check if we have a WebP version available in the public folder
    const baseSrc = src?.split('.');
    const extension = baseSrc?.pop()?.toLowerCase();
    const baseUrl = baseSrc?.join('.');

    // If we can't parse the URL, just return the original
    if (!baseUrl) return { webp: src, fallback: src };

    // Only attempt WebP conversion for image formats that benefit from it
    const convertibleFormats = ['jpg', 'jpeg', 'png'];
    const shouldConvert = convertibleFormats.includes(extension);

    // For local images, we'll look for a .webp version with the same base name
    // For remote images, we'll assume WebP is not available unless it's from a CDN that supports it
    const isRemoteUrl = src?.startsWith('http');
    
    if (isRemoteUrl) {
      // For remote URLs, we can check if the server supports WebP via content negotiation
      // But for simplicity, we'll just use the original URL for both
      return { webp: src, fallback: src };
    }

    return {
      webp: shouldConvert ? `${baseUrl}.webp` : src,
      fallback: src,
    };
  };

  const { webp, fallback } = getImageUrls();

  // Generate srcset for responsive images with more size options
  const generateSrcSet = (url) => {
    // Skip for external URLs or if we don't have width/height
    if (!url || !width || url.startsWith('http')) return '';
    
    // Check if the URL contains a file extension
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(url);
    if (!hasExtension) return '';
    
    // Extract the base URL and extension
    const lastDotIndex = url.lastIndexOf('.');
    const baseUrl = url.substring(0, lastDotIndex);
    const extension = url.substring(lastDotIndex);
    
    // Generate multiple sizes for responsive images
    // In a production environment, these would be pre-generated on the server
    // or served through an image CDN that supports on-the-fly resizing
    const widths = [width, width * 2];
    
    // For images that might be displayed at different sizes based on viewport
    return widths.map(w => `${baseUrl}${extension} ${w}w`).join(', ');
  };

  const webpSrcSet = generateSrcSet(webp);
  const fallbackSrcSet = generateSrcSet(fallback);

  // Handle image load with performance tracking
  const handleImageLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
    
    // Report image load performance if supported
    if (window.performance && window.performance.mark) {
      const imgSrc = e.target.src;
      const markName = `img_loaded_${imgSrc.split('/').pop()}`;
      window.performance.mark(markName);
    }
  };

  // Handle image error with better fallback
  const handleImageError = (e) => {
    setError(true);
    onError?.(e);
    console.warn(`Failed to load image: ${src}`);
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto',
        backgroundColor: placeholderColor,
      }}
      ref={imgRef}
      role="img"
      aria-label={ariaLabel || alt || 'Image'}
    >
      {error ? (
        <div
          className="flex items-center justify-center w-full h-full bg-gray-200 dark:bg-gray-700"
          style={{ minHeight: '100px' }}
          role="alert"
          aria-live="polite"
        >
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            Failed to load image
          </span>
        </div>
      ) : (
        <picture>
          {/* WebP version */}
          <source 
            type="image/webp" 
            srcSet={webpSrcSet} 
            src={isInView || loading !== 'lazy' ? webp : ''} 
            sizes={sizes} 
          />
          
          {/* Fallback version */}
          <img
            src={isInView || loading !== 'lazy' ? fallback : ''}
            srcSet={fallbackSrcSet}
            alt={alt}
            width={width}
            height={height}
            loading={loading}
            sizes={sizes}
            className={`w-full h-full transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ objectFit }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            decoding="async"
            {...props}
          />
        </picture>
      )}
    </div>
  );
};

export default React.memo(OptimizedImage);