import { 
  supportedLanguages, 
  cacheTtl, 
  maxFunctionSize, 
  maxCacheSize, 
  cacheVersion,
  diagramThemes,
  nonceLength
} from '../constants';

describe('Utils - Constants', () => {
  describe('supportedLanguages', () => {
    it('should be an array of strings', () => {
      expect(Array.isArray(supportedLanguages)).toBe(true);
      expect(supportedLanguages.length).toBeGreaterThan(0);
      supportedLanguages.forEach(lang => {
        expect(typeof lang).toBe('string');
      });
    });

    it('should include common programming languages', () => {
      const expectedLanguages = ['javascript', 'typescript', 'python', 'java', 'csharp'];
      expectedLanguages.forEach(lang => {
        expect(supportedLanguages).toContain(lang);
      });
    });

    it('should not have duplicate languages', () => {
      const uniqueLanguages = new Set(supportedLanguages);
      expect(uniqueLanguages.size).toBe(supportedLanguages.length);
    });

    it('should have lowercase language identifiers', () => {
      supportedLanguages.forEach(lang => {
        expect(lang).toBe(lang.toLowerCase());
      });
    });
  });

  describe('cacheTtl', () => {
    it('should be a number representing 24 hours in milliseconds', () => {
      expect(typeof cacheTtl).toBe('number');
      expect(cacheTtl).toBe(24 * 60 * 60 * 1000);
      expect(cacheTtl).toBe(86400000);
    });

    it('should be positive', () => {
      expect(cacheTtl).toBeGreaterThan(0);
    });
  });

  describe('maxFunctionSize', () => {
    it('should be a reasonable size limit', () => {
      expect(typeof maxFunctionSize).toBe('number');
      expect(maxFunctionSize).toBe(5000);
      expect(maxFunctionSize).toBeGreaterThan(0);
      expect(maxFunctionSize).toBeLessThan(100000); // Reasonable upper bound
    });
  });

  describe('maxCacheSize', () => {
    it('should be a positive number', () => {
      expect(typeof maxCacheSize).toBe('number');
      expect(maxCacheSize).toBe(100);
      expect(maxCacheSize).toBeGreaterThan(0);
    });
  });

  describe('cacheVersion', () => {
    it('should be a valid semantic version string', () => {
      expect(typeof cacheVersion).toBe('string');
      expect(cacheVersion).toBe('2.0.0');
      expect(cacheVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('diagramThemes', () => {
    it('should have all expected theme properties', () => {
      expect(diagramThemes).toHaveProperty('light');
      expect(diagramThemes).toHaveProperty('dark');
      expect(diagramThemes).toHaveProperty('forest');
      expect(diagramThemes).toHaveProperty('neutral');
    });

    it('should have correct theme values', () => {
      expect(diagramThemes.light).toBe('default');
      expect(diagramThemes.dark).toBe('dark');
      expect(diagramThemes.forest).toBe('forest');
      expect(diagramThemes.neutral).toBe('neutral');
    });

    it('should be readonly constant', () => {
      expect(Object.isFrozen(diagramThemes)).toBe(false); // TypeScript readonly, not runtime frozen
      // But we can test that the structure is as expected
      expect(Object.keys(diagramThemes)).toEqual(['light', 'dark', 'forest', 'neutral']);
    });

    it('should have string values for all themes', () => {
      Object.values(diagramThemes).forEach(theme => {
        expect(typeof theme).toBe('string');
        expect(theme.length).toBeGreaterThan(0);
      });
    });
  });

  describe('nonceLength', () => {
    it('should be a positive number', () => {
      expect(typeof nonceLength).toBe('number');
      expect(nonceLength).toBe(16);
      expect(nonceLength).toBeGreaterThan(0);
    });

    it('should be reasonable for cryptographic nonce', () => {
      expect(nonceLength).toBeGreaterThanOrEqual(8); // Minimum reasonable
      expect(nonceLength).toBeLessThanOrEqual(64); // Maximum reasonable
    });
  });

  describe('Constants validation', () => {
    it('should have consistent types', () => {
      expect(typeof cacheTtl).toBe('number');
      expect(typeof maxFunctionSize).toBe('number');
      expect(typeof maxCacheSize).toBe('number');
      expect(typeof nonceLength).toBe('number');
      expect(typeof cacheVersion).toBe('string');
      expect(Array.isArray(supportedLanguages)).toBe(true);
      expect(typeof diagramThemes).toBe('object');
    });

    it('should have reasonable relationships between numeric constants', () => {
      // Cache TTL should be longer than reasonable function processing time
      expect(cacheTtl).toBeGreaterThan(60000); // At least 1 minute
      
      // Max function size should be reasonable for processing
      expect(maxFunctionSize).toBeGreaterThan(100); // Not too small
      expect(maxFunctionSize).toBeLessThan(50000); // Not too large
      
      // Cache size should allow reasonable number of entries
      expect(maxCacheSize).toBeGreaterThan(10); // Useful minimum
      expect(maxCacheSize).toBeLessThan(10000); // Reasonable maximum
    });
  });
});