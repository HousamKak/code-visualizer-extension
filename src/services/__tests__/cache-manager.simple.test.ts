import { CacheManager } from '../cache-manager';

// Use global mocks from setup.ts
const vscode = (global as any).vscode;
const fs = jest.requireMock('fs');

describe('CacheManager - Basic Tests', () => {
  let cacheManager: CacheManager;
  let mockContext: any;

  beforeEach(async () => {
    mockContext = {
      globalStorageUri: { fsPath: '/test/storage' }
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.promises as any) = {
      mkdir: jest.fn(),
      readdir: jest.fn().mockResolvedValue([]),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn()
    };

    cacheManager = new CacheManager(mockContext);
    await cacheManager.initialize();
  });

  it('should generate deterministic cache keys', () => {
    const key1 = cacheManager.generateKey('test code', 'flowchart', 'javascript');
    const key2 = cacheManager.generateKey('test code', 'flowchart', 'javascript');
    
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^flowchart-javascript-[a-f0-9]{64}$/);
  });

  it('should generate different keys for different inputs', () => {
    const key1 = cacheManager.generateKey('code1', 'flowchart', 'js');
    const key2 = cacheManager.generateKey('code2', 'flowchart', 'js');
    
    expect(key1).not.toBe(key2);
  });

  it('should return cache metadata', () => {
    const metadata = cacheManager.getMetadata();
    
    expect(metadata).toHaveProperty('version');
    expect(metadata).toHaveProperty('cacheDirectory');
    expect(metadata).toHaveProperty('maxCacheSize');
  });

  it('should return cache statistics', () => {
    const stats = cacheManager.getStats();
    
    expect(stats).toHaveProperty('totalEntries');
    expect(stats).toHaveProperty('cacheSize');
    expect(stats).toHaveProperty('hitRate');
    expect(stats).toHaveProperty('lastCleanup');
  });
});