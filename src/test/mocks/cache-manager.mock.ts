import { ICacheManager } from '../../interfaces/cache-manager.interface';
import { DiagramCache, CacheMetadata, DiagramVersion } from '../../types';

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
    if (result) {this.hits++;}
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

  async addVersion(
    key: string,
    diagram: string,
    source: 'ai-generated' | 'user-edited' | 'regenerated',
    explanation?: string,
    changeDescription?: string
  ): Promise<string> {
    const versionId = `v${Date.now()}`;
    const entry = this.cache.get(key);
    if (entry) {
      if (!entry.versions) {
        entry.versions = [];
      }
      entry.versions.unshift({
        id: versionId,
        diagram,
        diagramType: entry.diagramType || 'flowchart',
        timestamp: Date.now(),
        source,
        explanation,
        changeDescription
      });
    }
    return versionId;
  }

  async getVersions(key: string): Promise<DiagramVersion[]> {
    const entry = this.cache.get(key);
    return entry?.versions || [];
  }

  async getVersion(key: string, versionId: string): Promise<DiagramVersion | null> {
    const entry = this.cache.get(key);
    return entry?.versions?.find(v => v.id === versionId) || null;
  }

  async setCurrentVersion(key: string, versionId: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.currentVersionId = versionId;
    }
  }

  async updateExplanation(key: string, explanation: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.explanation = explanation;
    }
  }
}