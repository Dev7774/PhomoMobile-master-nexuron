/**
 * Logging utility for photo album functionality
 */

import { LOGGING_CONFIG } from './photoAlbumConstants';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class PhotoAlbumLogger {
  private shouldLog(level: LogLevel): boolean {
    if (level === 'error' || level === 'warn') {
      return true; // Always log errors and warnings
    }
    return LOGGING_CONFIG.ENABLE_DEBUG_LOGS;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`🔍 [PhotoAlbum] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`ℹ️ [PhotoAlbum] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️ [PhotoAlbum] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`❌ [PhotoAlbum] ${message}`, ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`✅ [PhotoAlbum] ${message}`, ...args);
    }
  }

  /**
   * Log performance metrics if enabled
   */
  performance(operation: string, duration: number): void {
    if (LOGGING_CONFIG.ENABLE_PERFORMANCE_LOGS) {
      console.log(`⏱️ [PhotoAlbum] ${operation} took ${duration}ms`);
    }
  }

  /**
   * Create a performance timer
   */
  timer(operation: string) {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.performance(operation, duration);
        return duration;
      }
    };
  }
}

export const logger = new PhotoAlbumLogger();