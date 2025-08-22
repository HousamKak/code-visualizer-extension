import { ICacheManager } from '../../interfaces/cache-manager.interface';
import { DiagramCache, CacheMetadata } from '../../types';

export class MockCacheManager implements ICacheManager {
  private cache = new Map<string, DiagramCache>();
  private hits = 0;
  private total = 0;

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async get(key: string): Promise<DiagramCache | null> {
    this.total++;
    const result = this.cache.get(key) || null;
    if (result) this.hits++;
    return result;
  }

  async set(key: string, diagram: string, metadata?: any): Promise<void> {
    const cacheEntry: DiagramCache = {
      diagram,
      timestamp: Date.now(),
      hash: key,
      metadata,
      accessCount: 1,
      lastAccessed: Date.now()
    };
    this.cache.set(key, cacheEntry);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.total = 0;
  }

  getStats() {
    return {
      totalEntries: this.cache.size,
      cacheSize: this.cache.size * 1024, // Mock size
      hitRate: this.total > 0 ? this.hits / this.total : 0,
      lastCleanup: Date.now()
    };
  }

  generateKey(code: string, diagramType: string, language: string): string {
    return `${diagramType}-${language}-${code.slice(0, 50)}`;
  }

  async cleanup(): Promise<void> {
    // Mock cleanup - remove old entries
    const now = Date.now();
    const ttl = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key);
      }
    }
  }

  getMetadata(): CacheMetadata {
    return {
      version: '1.0.0',
      totalEntries: this.cache.size,
      lastCleanup: Date.now(),
      cacheDirectory: '/mock/cache',
      maxCacheSize: 1000
    };
  }
}