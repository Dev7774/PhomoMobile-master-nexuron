import * as SQLite from 'expo-sqlite';

/**
 * PhotoCacheDB - SQLite-based URL caching service for instant photo loading
 *
 * This service caches S3 signed URLs locally for ultra-fast photo display.
 * URLs are valid for hours, so we can display photos instantly from cache
 * and refresh in the background when needed.
 */

const DB_NAME = 'phomo_photo_cache.db';
const TABLE_NAME = 'photo_urls';
const URL_EXPIRY_HOURS = 0.25; // AWS Amplify getUrl default is 15 minutes (900 seconds)

export interface CachedPhoto {
  id: string;
  thumbUrl: string | null;
  fullUrl: string | null;
  thumbUrlExpires: number | null;
  fullUrlExpires: number | null;
  cameraId: string | null;
  createdAt: number;
  ownerId: string | null;
  ownerIdentityId: string | null;
  s3Key: string | null;
  thumbKey: string | null;
  lastAccessed: number;
  localUri?: string | null; // For optimistic updates
}

class PhotoCacheDB {
  private db: SQLite.SQLiteDatabase;
  private isInitialized = false;

  constructor() {
    this.db = SQLite.openDatabaseSync(DB_NAME);
  }

  /**
   * Initialize the database and create tables if needed
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Enable WAL mode for better performance
      await this.db.execAsync('PRAGMA journal_mode = WAL');

      // Create table with indexes for fast lookups
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id TEXT PRIMARY KEY,
          thumbUrl TEXT,
          fullUrl TEXT,
          thumbUrlExpires INTEGER,
          fullUrlExpires INTEGER,
          cameraId TEXT,
          createdAt INTEGER,
          ownerId TEXT,
          ownerIdentityId TEXT,
          s3Key TEXT,
          thumbKey TEXT,
          lastAccessed INTEGER,
          localUri TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_camera_id ON ${TABLE_NAME}(cameraId);
        CREATE INDEX IF NOT EXISTS idx_owner_id ON ${TABLE_NAME}(ownerId);
        CREATE INDEX IF NOT EXISTS idx_created_at ON ${TABLE_NAME}(createdAt DESC);
        CREATE INDEX IF NOT EXISTS idx_last_accessed ON ${TABLE_NAME}(lastAccessed DESC);
      `);

      this.isInitialized = true;
      console.log('✅ [PhotoCacheDB] Database initialized');
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Get a single photo from cache
   */
  async getPhoto(photoId: string): Promise<CachedPhoto | null> {
    await this.init();

    try {
      const result = await this.db.getFirstAsync<CachedPhoto>(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
        [photoId]
      );

      if (result) {
        // Update last accessed time
        await this.db.runAsync(
          `UPDATE ${TABLE_NAME} SET lastAccessed = ? WHERE id = ?`,
          [Date.now(), photoId]
        );
      }

      return result || null;
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to get photo:', error);
      return null;
    }
  }

  /**
   * Get multiple photos from cache (for grids/lists)
   */
  async getPhotos(photoIds: string[]): Promise<Map<string, CachedPhoto>> {
    await this.init();

    if (photoIds.length === 0) return new Map();

    try {
      const placeholders = photoIds.map(() => '?').join(',');
      const results = await this.db.getAllAsync<CachedPhoto>(
        `SELECT * FROM ${TABLE_NAME} WHERE id IN (${placeholders})`,
        photoIds
      );

      const photoMap = new Map<string, CachedPhoto>();
      for (const photo of results) {
        photoMap.set(photo.id, photo);
      }

      // Update last accessed time for all fetched photos
      if (results.length > 0) {
        await this.db.runAsync(
          `UPDATE ${TABLE_NAME} SET lastAccessed = ? WHERE id IN (${placeholders})`,
          [Date.now(), ...photoIds]
        );
      }

      return photoMap;
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to get photos:', error);
      return new Map();
    }
  }


  /**
   * Save or update a photo in cache
   */
  async savePhoto(photo: Partial<CachedPhoto> & { id: string }): Promise<void> {
    await this.init();

    try {
      const now = Date.now();
      const expires = now + (URL_EXPIRY_HOURS * 60 * 60 * 1000);

      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${TABLE_NAME} (
          id, thumbUrl, fullUrl, thumbUrlExpires, fullUrlExpires,
          cameraId, createdAt, ownerId, ownerIdentityId,
          s3Key, thumbKey, lastAccessed, localUri
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          photo.id,
          photo.thumbUrl || null,
          photo.fullUrl || null,
          photo.thumbUrlExpires || (photo.thumbUrl ? expires : null),
          photo.fullUrlExpires || (photo.fullUrl ? expires : null),
          photo.cameraId || null,
          photo.createdAt || now,
          photo.ownerId || null,
          photo.ownerIdentityId || null,
          photo.s3Key || null,
          photo.thumbKey || null,
          now,
          photo.localUri || null
        ]
      );
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to save photo:', error);
    }
  }

  /**
   * Save multiple photos in a transaction (for batch updates)
   */
  async savePhotos(photos: Array<Partial<CachedPhoto> & { id: string }>): Promise<void> {
    await this.init();

    if (photos.length === 0) return;

    try {
      const now = Date.now();
      const expires = now + (URL_EXPIRY_HOURS * 60 * 60 * 1000);

      await this.db.withTransactionAsync(async () => {
        for (const photo of photos) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO ${TABLE_NAME} (
              id, thumbUrl, fullUrl, thumbUrlExpires, fullUrlExpires,
              cameraId, createdAt, ownerId, ownerIdentityId,
              s3Key, thumbKey, lastAccessed, localUri
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              photo.id,
              photo.thumbUrl || null,
              photo.fullUrl || null,
              photo.thumbUrlExpires || (photo.thumbUrl ? expires : null),
              photo.fullUrlExpires || (photo.fullUrl ? expires : null),
              photo.cameraId || null,
              photo.createdAt || now,
              photo.ownerId || null,
              photo.ownerIdentityId || null,
              photo.s3Key || null,
              photo.thumbKey || null,
              now,
              photo.localUri || null
            ]
          );
        }
      });

      console.log(`✅ [PhotoCacheDB] Saved ${photos.length} photos to cache`);
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to save photos:', error);
    }
  }

  /**
   * Update URL for a photo (when refreshing expired URLs)
   */
  async updatePhotoUrl(
    photoId: string,
    urlType: 'thumb' | 'full',
    url: string
  ): Promise<void> {
    await this.init();

    try {
      const expires = Date.now() + (URL_EXPIRY_HOURS * 60 * 60 * 1000);

      if (urlType === 'thumb') {
        await this.db.runAsync(
          `UPDATE ${TABLE_NAME} SET thumbUrl = ?, thumbUrlExpires = ? WHERE id = ?`,
          [url, expires, photoId]
        );
      } else {
        await this.db.runAsync(
          `UPDATE ${TABLE_NAME} SET fullUrl = ?, fullUrlExpires = ? WHERE id = ?`,
          [url, expires, photoId]
        );
      }
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to update photo URL:', error);
    }
  }

  /**
   * Get photos that need URL refresh (expired or about to expire)
   * Returns ALL photos needing refresh, not limited
   */
  async getPhotosNeedingRefresh(bufferMinutes: number = 30): Promise<CachedPhoto[]> {
    await this.init();

    try {
      const threshold = Date.now() + (bufferMinutes * 60 * 1000);

      const results = await this.db.getAllAsync<CachedPhoto>(
        `SELECT * FROM ${TABLE_NAME}
         WHERE (thumbUrlExpires < ? AND thumbUrl IS NOT NULL)
            OR (fullUrlExpires < ? AND fullUrl IS NOT NULL)
         ORDER BY createdAt ASC`,
        [threshold, threshold]
      );

      console.log(`🔍 [PhotoCacheDB] Found ${results.length} photos needing URL refresh`);
      return results;
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to get photos needing refresh:', error);
      return [];
    }
  }

  /**
   * Clean up old cached entries (photos not accessed in 30 days)
   */
  async cleanup(daysOld: number = 30): Promise<void> {
    await this.init();

    try {
      const threshold = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      const result = await this.db.runAsync(
        `DELETE FROM ${TABLE_NAME} WHERE lastAccessed < ?`,
        [threshold]
      );

      console.log(`🧹 [PhotoCacheDB] Cleaned up ${result.changes} old photos`);
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to cleanup:', error);
    }
  }

  /**
   * Delete a specific photo from cache
   */
  async deletePhoto(photoId: string): Promise<void> {
    await this.init();

    try {
      await this.db.runAsync(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [photoId]);
      console.log(`✅ [PhotoCacheDB] Deleted photo from cache: ${photoId}`);
    } catch (error) {
      console.error(`❌ [PhotoCacheDB] Failed to delete photo ${photoId}:`, error);
    }
  }


  /**
   * Clear all cached data (for debugging or logout)
   */
  async clear(): Promise<void> {
    await this.init();

    try {
      await this.db.runAsync(`DELETE FROM ${TABLE_NAME}`);
      
      //Reset initialization flag so database reinitalizes for next user
      this.isInitialized = false;
      console.log('🗑️ [PhotoCacheDB] All cached photos cleared and ready for re-initalization');
    } catch (error) {
      console.error('❌ [PhotoCacheDB] Failed to clear cache:', error);
    }
  }

}

// Export singleton instance
export const photoCacheDB = new PhotoCacheDB();