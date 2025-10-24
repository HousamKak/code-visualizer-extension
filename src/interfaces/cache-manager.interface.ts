import { DiagramCache, CacheMetadata, DiagramVersion } from '../types';

/**
 * Service interface for managing persistent diagram caching.
 *
 * Provides high-performance caching of generated diagrams with TTL expiration,
 * LRU eviction, and file-based persistence. Includes cache analytics and
 * automatic cleanup mechanisms. Supports versioning for diagram history tracking.
 *
 * @example
 * ```typescript
 * await cacheManager.initialize();
 * const key = cacheManager.generateKey(code, 'flowchart', 'javascript');
 * await cacheManager.set(key, diagramContent, { functionName: 'example' });
 * const cached = await cacheManager.get(key);
 * ```
 */
export interface ICacheManager {
  /**
   * Initialize the cache system and load existing cache entries.
   * 
   * Creates cache directory structure, loads metadata, and performs
   * initial cleanup of expired entries. Must be called before using
   * other cache operations.
   * 
   * @throws Error if cache directory cannot be created or accessed
   */
  initialize(): Promise<void>;
  
  /**
   * Retrieve a cached diagram entry by key.
   * 
   * Updates access tracking for LRU eviction and validates TTL expiration.
   * Automatically removes expired entries.
   * 
   * @param key - Unique cache key for the diagram
   * @returns Promise resolving to cached diagram or null if not found/expired
   */
  get(key: string): Promise<DiagramCache | null>;
  
  /**
   * Store a diagram in the cache with optional metadata.
   * 
   * Creates both JSON cache entry and separate .mmd file for easy access.
   * Triggers LRU eviction if cache exceeds size limits.
   * 
   * @param key - Unique cache key for the diagram
   * @param diagram - Mermaid diagram content to cache
   * @param metadata - Optional metadata (function name, analysis results, etc.)
   */
  set(key: string, diagram: string, metadata?: any): Promise<void>;
  
  /**
   * Check if a diagram exists in cache (synchronous).
   * 
   * Note: This only checks in-memory cache and doesn't validate TTL.
   * Use get() for full validation including expiration.
   * 
   * @param key - Cache key to check
   * @returns true if key exists in cache
   */
  has(key: string): boolean;
  
  /**
   * Remove a specific cache entry and associated files.
   * 
   * @param key - Cache key to remove
   */
  delete(key: string): Promise<void>;
  
  /**
   * Clear all cache entries and reset statistics.
   * 
   * Removes all cached diagrams, .mmd files, and resets hit/miss counters.
   * Preserves cache metadata file.
   */
  clear(): Promise<void>;
  
  /**
   * Get current cache performance statistics.
   * 
   * @returns Cache statistics including size, hit rate, and cleanup info
   */
  getStats(): {
    totalEntries: number;
    cacheSize: number;
    hitRate: number;
    lastCleanup: number;
  };
  
  /**
   * Generate a deterministic cache key from code characteristics.
   * 
   * Creates SHA-256 hash-based key that uniquely identifies diagram content
   * based on code, diagram type, and language combination.
   * 
   * @param code - Source code content
   * @param diagramType - Type of Mermaid diagram
   * @param language - Programming language
   * @returns Deterministic cache key string
   */
  generateKey(code: string, diagramType: string, language: string): string;
  
  /**
   * Remove expired cache entries and optimize storage.
   * 
   * Removes entries older than TTL, updates access patterns,
   * and triggers LRU eviction if needed.
   */
  cleanup(): Promise<void>;
  
  /**
   * Get cache system metadata and configuration.
   *
   * @returns Cache metadata including version, directory path, and limits
   */
  getMetadata(): CacheMetadata;

  /**
   * Add a new version to the diagram history.
   *
   * Stores a new version in the version history array, maintaining the
   * maximum version limit (default 10). Older versions are removed automatically.
   *
   * @param key - Cache key for the diagram
   * @param diagram - Mermaid diagram content
   * @param source - Source of the diagram (ai-generated, user-edited, regenerated)
   * @param explanation - Optional explanation of the diagram
   * @param changeDescription - Optional description of what changed
   * @returns The created version ID
   */
  addVersion(
    key: string,
    diagram: string,
    source: 'ai-generated' | 'user-edited' | 'regenerated',
    explanation?: string,
    changeDescription?: string
  ): Promise<string>;

  /**
   * Get all versions for a cached diagram.
   *
   * @param key - Cache key for the diagram
   * @returns Array of diagram versions, ordered by timestamp (newest first)
   */
  getVersions(key: string): Promise<DiagramVersion[]>;

  /**
   * Get a specific version by ID.
   *
   * @param key - Cache key for the diagram
   * @param versionId - Version ID to retrieve
   * @returns The diagram version or null if not found
   */
  getVersion(key: string, versionId: string): Promise<DiagramVersion | null>;

  /**
   * Set the current active version for a diagram.
   *
   * Updates the cache to use the specified version as the current version.
   * This updates both the main diagram field and the currentVersionId.
   *
   * @param key - Cache key for the diagram
   * @param versionId - Version ID to set as current
   */
  setCurrentVersion(key: string, versionId: string): Promise<void>;

  /**
   * Update the explanation for a cached diagram.
   *
   * @param key - Cache key for the diagram
   * @param explanation - Function explanation text
   */
  updateExplanation(key: string, explanation: string): Promise<void>;
}