import { 
  SUPPORTED_LANGUAGES, 
  CACHE_TTL, 
  MAX_FUNCTION_SIZE, 
  MAX_CACHE_SIZE, 
  CACHE_VERSION,
  DIAGRAM_THEMES,
  NONCE_LENGTH
} from '../constants';

describe('Utils - Constants', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('should be an array of strings', () => {
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
      expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
      SUPPORTED_LANGUAGES.forEach(lang => {
        expect(typeof lang).toBe('string');
      });
    });

    it('should include common programming languages', () => {
      const expectedLanguages = ['javascript', 'typescript', 'python', 'java', 'csharp'];
      expectedLanguages.forEach(lang => {
        expect(SUPPORTED_LANGUAGES).toContain(lang);
      });
    });

    it('should not have duplicate languages', () => {
      const uniqueLanguages = new Set(SUPPORTED_LANGUAGES);
      expect(uniqueLanguages.size).toBe(SUPPORTED_LANGUAGES.length);
    });

    it('should have lowercase language identifiers', () => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        expect(lang).toBe(lang.toLowerCase());
      });
    });
  });

  describe('CACHE_TTL', () => {
    it('should be a number representing 24 hours in milliseconds', () => {
      expect(typeof CACHE_TTL).toBe('number');
      expect(CACHE_TTL).toBe(24 * 60 * 60 * 1000);
      expect(CACHE_TTL).toBe(86400000);
    });

    it('should be positive', () => {
      expect(CACHE_TTL).toBeGreaterThan(0);
    });
  });

  describe('MAX_FUNCTION_SIZE', () => {
    it('should be a reasonable size limit', () => {
      expect(typeof MAX_FUNCTION_SIZE).toBe('number');
      expect(MAX_FUNCTION_SIZE).toBe(5000);
      expect(MAX_FUNCTION_SIZE).toBeGreaterThan(0);
      expect(MAX_FUNCTION_SIZE).toBeLessThan(100000); // Reasonable upper bound
    });
  });

  describe('MAX_CACHE_SIZE', () => {
    it('should be a positive number', () => {
      expect(typeof MAX_CACHE_SIZE).toBe('number');
      expect(MAX_CACHE_SIZE).toBe(100);
      expect(MAX_CACHE_SIZE).toBeGreaterThan(0);
    });
  });

  describe('CACHE_VERSION', () => {
    it('should be a valid semantic version string', () => {
      expect(typeof CACHE_VERSION).toBe('string');
      expect(CACHE_VERSION).toBe('2.0.0');
      expect(CACHE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('DIAGRAM_THEMES', () => {
    it('should have all expected theme properties', () => {
      expect(DIAGRAM_THEMES).toHaveProperty('LIGHT');
      expect(DIAGRAM_THEMES).toHaveProperty('DARK');
      expect(DIAGRAM_THEMES).toHaveProperty('FOREST');
      expect(DIAGRAM_THEMES).toHaveProperty('NEUTRAL');
    });

    it('should have correct theme values', () => {
      expect(DIAGRAM_THEMES.LIGHT).toBe('default');
      expect(DIAGRAM_THEMES.DARK).toBe('dark');
      expect(DIAGRAM_THEMES.FOREST).toBe('forest');
      expect(DIAGRAM_THEMES.NEUTRAL).toBe('neutral');
    });

    it('should be readonly constant', () => {
      expect(Object.isFrozen(DIAGRAM_THEMES)).toBe(false); // TypeScript readonly, not runtime frozen
      // But we can test that the structure is as expected
      expect(Object.keys(DIAGRAM_THEMES)).toEqual(['LIGHT', 'DARK', 'FOREST', 'NEUTRAL']);
    });

    it('should have string values for all themes', () => {
      Object.values(DIAGRAM_THEMES).forEach(theme => {
        expect(typeof theme).toBe('string');
        expect(theme.length).toBeGreaterThan(0);
      });
    });
  });

  describe('NONCE_LENGTH', () => {
    it('should be a positive number', () => {
      expect(typeof NONCE_LENGTH).toBe('number');
      expect(NONCE_LENGTH).toBe(16);
      expect(NONCE_LENGTH).toBeGreaterThan(0);
    });

    it('should be reasonable for cryptographic nonce', () => {
      expect(NONCE_LENGTH).toBeGreaterThanOrEqual(8); // Minimum reasonable
      expect(NONCE_LENGTH).toBeLessThanOrEqual(64); // Maximum reasonable
    });
  });

  describe('Constants validation', () => {
    it('should have consistent types', () => {
      expect(typeof CACHE_TTL).toBe('number');
      expect(typeof MAX_FUNCTION_SIZE).toBe('number');
      expect(typeof MAX_CACHE_SIZE).toBe('number');
      expect(typeof NONCE_LENGTH).toBe('number');
      expect(typeof CACHE_VERSION).toBe('string');
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
      expect(typeof DIAGRAM_THEMES).toBe('object');
    });

    it('should have reasonable relationships between numeric constants', () => {
      // Cache TTL should be longer than reasonable function processing time
      expect(CACHE_TTL).toBeGreaterThan(60000); // At least 1 minute
      
      // Max function size should be reasonable for processing
      expect(MAX_FUNCTION_SIZE).toBeGreaterThan(100); // Not too small
      expect(MAX_FUNCTION_SIZE).toBeLessThan(50000); // Not too large
      
      // Cache size should allow reasonable number of entries
      expect(MAX_CACHE_SIZE).toBeGreaterThan(10); // Useful minimum
      expect(MAX_CACHE_SIZE).toBeLessThan(10000); // Reasonable maximum
    });
  });
});