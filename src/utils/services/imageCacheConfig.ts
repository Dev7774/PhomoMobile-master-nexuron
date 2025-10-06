import { CacheManager } from '@georstat/react-native-image-cache';
import { Dirs } from 'react-native-file-access';

/**
 * Configure image cache for AWS S3 URLs
 * This sets up caching behavior and URL processing for our photo URLs
 */
export const configureImageCache = () => {
  CacheManager.config = {
    baseDir: `${Dirs.CacheDir}/phomo-image-cache/`,
    blurRadius: 0, // Disable blur for performance
    sourceAnimationDuration: 0, // Disable animation for performance
    thumbnailAnimationDuration: 0,
    retryDelay: 1000,
    maxRetries: 3,
    cacheLimit: 1024 * 1024 * 500, // 500MB cache limit
    // Custom cache key for S3 URLs - removes query parameters
    getCustomCacheKey: (source: string) => {
      // Remove params from the URL for caching images (useful for S3 URLs)
      let newCacheKey = source;
      if (source.includes('?')) {
        newCacheKey = source.substring(0, source.lastIndexOf('?'));
      }
      return newCacheKey;
    },
  };
};

/**
 * Preload images in batches with controlled concurrency
 * This prevents overwhelming the system with too many simultaneous requests
 */
export const preloadImages = async (
  urls: string[], 
  priority: 'high' | 'low' = 'low'
): Promise<void> => {
  if (urls.length === 0) return;

  const BATCH_SIZE = priority === 'high' ? 5 : 3;
  const DELAY_BETWEEN_BATCHES = priority === 'high' ? 50 : 100;

  // Process URLs in batches to avoid overwhelming the network
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    
    // Process batch - CacheManager.prefetch() returns void, so we just call it
    batch.forEach(url => {
      try {
        CacheManager.prefetch(url);
      } catch (error) {
        console.warn(`Failed to prefetch ${url}:`, error);
      }
    });

    // Small delay between batches to prevent overwhelming
    if (i + BATCH_SIZE < urls.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
};

/**
 * Get cache statistics for debugging
 */
export const getCacheStats = async (): Promise<{
  cacheSize: number;
  cachedFiles: number;
}> => {
  try {
    // This would require implementing cache size calculation
    // For now, return basic stats
    return {
      cacheSize: 0, // Size in bytes (would need to implement)
      cachedFiles: 0, // Number of cached files (would need to implement)
    };
  } catch (error) {
    console.warn('Failed to get cache stats:', error);
    return { cacheSize: 0, cachedFiles: 0 };
  }
};

/**
 * Clear all cached images
 * Useful for debugging or when user wants to free up storage
 */
export const clearImageCache = async (): Promise<void> => {
  try {
    await CacheManager.clearCache();
    console.log('Image cache cleared successfully');
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};