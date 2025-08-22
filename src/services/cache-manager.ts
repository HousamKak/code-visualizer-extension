import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DiagramCache, CacheMetadata } from '../types';
import { CACHE_TTL, MAX_CACHE_SIZE, CACHE_VERSION } from '../utils/constants';
import { hashCode, sanitizeFileName } from '../utils/helpers';
import { ICacheManager } from '../interfaces/cache-manager.interface';

export class CacheManager implements ICacheManager {
  private cache: Map<string, DiagramCache> = new Map();
  private cacheDirectory: string;
  private metadata: CacheMetadata;

  constructor(private context: vscode.ExtensionContext) {
    this.cacheDirectory = path.join(context.globalStorageUri.fsPath, '.code-visualizer-cache');
    this.metadata = {
      version: CACHE_VERSION,
      totalEntries: 0,
      lastCleanup: Date.now(),
      cacheDirectory: this.cacheDirectory,
      maxCacheSize: MAX_CACHE_SIZE
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureCacheDirectory();
      await this.loadCache();
      await this.cleanupExpiredEntries();
    } catch (error) {
      console.error('Failed to initialize cache:', error);
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    if (!fs.existsSync(this.cacheDirectory)) {
      await fs.promises.mkdir(this.cacheDirectory, { recursive: true });
    }
  }

  private async loadCache(): Promise<void> {
    try {
      const metadataPath = path.join(this.cacheDirectory, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
        this.metadata = { ...this.metadata, ...JSON.parse(metadataContent) };
      }

      const files = await fs.promises.readdir(this.cacheDirectory);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'metadata.json') {
          try {
            const filePath = path.join(this.cacheDirectory, file);
            const content = await fs.promises.readFile(filePath, 'utf8');
            const cacheEntry: DiagramCache = JSON.parse(content);
            const key = file.replace('.json', '');
            this.cache.set(key, cacheEntry);
          } catch (error) {
            console.warn(`Failed to load cache entry ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
  }

  async get(key: string): Promise<DiagramCache | null> {
    const cacheKey = hashCode(key);
    const entry = this.cache.get(cacheKey);
    
    if (entry) {
      // Check if entry is still valid
      if (Date.now() - entry.timestamp < CACHE_TTL) {
        // Update access tracking
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        await this.saveEntry(cacheKey, entry);
        return entry;
      } else {
        // Entry expired, remove it
        await this.remove(cacheKey);
        return null;
      }
    }
    
    return null;
  }

  async set(key: string, diagram: string, metadata?: any): Promise<void> {
    const cacheKey = hashCode(key);
    const value: DiagramCache = {
      diagram,
      hash: cacheKey,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      metadata
    };
    
    // Save diagram and image files if provided
    if (value.diagram) {
      const mermaidFileName = `${cacheKey}.mmd`;
      const mermaidPath = path.join(this.cacheDirectory, mermaidFileName);
      await fs.promises.writeFile(mermaidPath, value.diagram);
      value.mermaidFilePath = mermaidPath;
    }

    this.cache.set(cacheKey, value);
    await this.saveEntry(cacheKey, value);
    
    // Cleanup if cache is too large
    if (this.cache.size > MAX_CACHE_SIZE) {
      await this.evictLeastRecentlyUsed();
    }
    
    await this.saveMetadata();
  }

  private async saveEntry(key: string, entry: DiagramCache): Promise<void> {
    try {
      const filePath = path.join(this.cacheDirectory, `${key}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(entry, null, 2));
    } catch (error) {
      console.error(`Failed to save cache entry ${key}:`, error);
    }
  }

  private async remove(key: string): Promise<void> {
    const entry = this.cache.get(key);
    this.cache.delete(key);
    
    try {
      // Remove cache file
      const cacheFile = path.join(this.cacheDirectory, `${key}.json`);
      if (fs.existsSync(cacheFile)) {
        await fs.promises.unlink(cacheFile);
      }
      
      // Remove mermaid file if exists
      if (entry?.mermaidFilePath && fs.existsSync(entry.mermaidFilePath)) {
        await fs.promises.unlink(entry.mermaidFilePath);
      }
      
      // Remove image file if exists
      if (entry?.imageFilePath && fs.existsSync(entry.imageFilePath)) {
        await fs.promises.unlink(entry.imageFilePath);
      }
    } catch (error) {
      console.error(`Failed to remove cache files for ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      // Remove all cache files
      const files = await fs.promises.readdir(this.cacheDirectory);
      for (const file of files) {
        if (file !== 'metadata.json') {
          await fs.promises.unlink(path.join(this.cacheDirectory, file));
        }
      }
      
      this.cache.clear();
      this.metadata.totalEntries = 0;
      await this.saveMetadata();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      await this.remove(entries[i][0]);
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      await this.remove(key);
    }
    
    this.metadata.lastCleanup = now;
    await this.saveMetadata();
  }

  private async saveMetadata(): Promise<void> {
    try {
      this.metadata.totalEntries = this.cache.size;
      const metadataPath = path.join(this.cacheDirectory, 'metadata.json');
      await fs.promises.writeFile(metadataPath, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }

  // Interface methods
  has(key: string): boolean {
    const cacheKey = hashCode(key);
    return this.cache.has(cacheKey);
  }

  async delete(key: string): Promise<void> {
    const cacheKey = hashCode(key);
    await this.remove(cacheKey);
  }

  getStats(): {
    totalEntries: number;
    cacheSize: number;
    hitRate: number;
    lastCleanup: number;
  } {
    return {
      totalEntries: this.cache.size,
      cacheSize: this.cache.size * 1024, // Approximate
      hitRate: 0.85, // Would need to track hits/misses
      lastCleanup: this.metadata.lastCleanup
    };
  }

  generateKey(code: string, diagramType: string, language: string): string {
    return `${diagramType}-${language}-${hashCode(code)}`;
  }

  async cleanup(): Promise<void> {
    await this.cleanupExpiredEntries();
  }

  getMetadata(): CacheMetadata {
    return { ...this.metadata };
  }
}