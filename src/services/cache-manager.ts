import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DiagramCache, CacheMetadata, DiagramVersion } from '../types';
import { cacheTtl, maxCacheSize, cacheVersion, maxVersionHistory } from '../utils/constants';
import { hashCode, sanitizeFileName } from '../utils/helpers';
import { ICacheManager } from '../interfaces/cache-manager.interface';

export class CacheManager implements ICacheManager {
  private cache: Map<string, DiagramCache> = new Map();
  private cacheDirectory: string;
  private metadata: CacheMetadata;

  constructor(private context: vscode.ExtensionContext) {
    this.cacheDirectory = path.join(context.globalStorageUri.fsPath, '.code-visualizer-cache');
    this.metadata = {
      version: cacheVersion,
      totalEntries: 0,
      lastCleanup: Date.now(),
      cacheDirectory: this.cacheDirectory,
      maxCacheSize: maxCacheSize
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
      if (Date.now() - entry.timestamp < cacheTtl) {
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
    const now = Date.now();

    // Create initial version
    const initialVersionId = `v${now}-${Math.random().toString(36).substring(2, 9)}`;
    const initialVersion: DiagramVersion = {
      id: initialVersionId,
      diagram,
      diagramType: metadata?.diagramType || 'flowchart',
      timestamp: now,
      source: 'ai-generated',
      explanation: metadata?.explanation,
      codeAnalysis: metadata?.codeAnalysis
    };

    const value: DiagramCache = {
      diagram,
      hash: cacheKey,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
      metadata,
      diagramType: metadata?.diagramType,
      explanation: metadata?.explanation,
      versions: [initialVersion],
      currentVersionId: initialVersionId
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
    if (this.cache.size > maxCacheSize) {
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
      if (now - entry.timestamp > cacheTtl) {
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

  async addVersion(
    key: string,
    diagram: string,
    source: 'ai-generated' | 'user-edited' | 'regenerated',
    explanation?: string,
    changeDescription?: string
  ): Promise<string> {
    const cacheKey = hashCode(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      throw new Error(`Cache entry not found for key: ${key}`);
    }

    // Initialize versions array if not exists
    if (!entry.versions) {
      entry.versions = [];
    }

    // Create new version
    const versionId = `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newVersion: DiagramVersion = {
      id: versionId,
      diagram,
      diagramType: entry.diagramType!,
      timestamp: Date.now(),
      source,
      explanation,
      changeDescription,
      codeAnalysis: entry.codeAnalysis
    };

    // Add version to beginning of array (newest first)
    entry.versions.unshift(newVersion);

    // Trim to max version history
    if (entry.versions.length > maxVersionHistory) {
      entry.versions = entry.versions.slice(0, maxVersionHistory);
    }

    // Update current version
    entry.currentVersionId = versionId;
    entry.diagram = diagram;
    if (explanation) {
      entry.explanation = explanation;
    }

    // Save updated entry
    await this.saveEntry(cacheKey, entry);

    return versionId;
  }

  async getVersions(key: string): Promise<DiagramVersion[]> {
    const cacheKey = hashCode(key);
    const entry = this.cache.get(cacheKey);

    if (!entry || !entry.versions) {
      return [];
    }

    return [...entry.versions];
  }

  async getVersion(key: string, versionId: string): Promise<DiagramVersion | null> {
    const cacheKey = hashCode(key);
    const entry = this.cache.get(cacheKey);

    if (!entry || !entry.versions) {
      return null;
    }

    const version = entry.versions.find(v => v.id === versionId);
    return version || null;
  }

  async setCurrentVersion(key: string, versionId: string): Promise<void> {
    const cacheKey = hashCode(key);
    const entry = this.cache.get(cacheKey);

    if (!entry || !entry.versions) {
      throw new Error(`Cache entry or versions not found for key: ${key}`);
    }

    const version = entry.versions.find(v => v.id === versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    // Update current version
    entry.currentVersionId = versionId;
    entry.diagram = version.diagram;
    entry.diagramType = version.diagramType;
    if (version.explanation) {
      entry.explanation = version.explanation;
    }

    // Save updated entry
    await this.saveEntry(cacheKey, entry);
  }

  async updateExplanation(key: string, explanation: string): Promise<void> {
    const cacheKey = hashCode(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      throw new Error(`Cache entry not found for key: ${key}`);
    }

    entry.explanation = explanation;
    await this.saveEntry(cacheKey, entry);
  }
}