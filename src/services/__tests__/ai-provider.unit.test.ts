import { AIProviderService } from '../ai-provider';

describe('AIProviderService Unit Tests', () => {
  let aiProvider: AIProviderService;

  beforeEach(() => {
    aiProvider = new AIProviderService();
  });

  describe('constructor', () => {
    it('should initialize with default providers', () => {
      expect(aiProvider).toBeDefined();
      expect(aiProvider).toBeInstanceOf(AIProviderService);
    });

    it('should have default provider set to github', () => {
      expect(aiProvider.getCurrentProvider()).toBe('github');
    });
  });

  describe('getProviders', () => {
    it('should return a Map of providers', () => {
      const providers = aiProvider.getProviders();
      expect(providers).toBeInstanceOf(Map);
      expect(providers.size).toBeGreaterThan(0);
    });

    it('should include expected providers', () => {
      const providers = aiProvider.getProviders();
      expect(providers.has('github')).toBe(true);
      expect(providers.has('openai')).toBe(true);
      expect(providers.has('anthropic')).toBe(true);
      expect(providers.has('local')).toBe(true);
    });
  });

  describe('getProviderNames', () => {
    it('should return array of provider names', () => {
      const names = aiProvider.getProviderNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('github');
      expect(names).toContain('openai');
    });
  });

  describe('getCurrentProvider', () => {
    it('should return current provider name', () => {
      const current = aiProvider.getCurrentProvider();
      expect(typeof current).toBe('string');
      expect(current).toBe('github');
    });
  });

  describe('setProvider', () => {
    it('should set valid provider', () => {
      aiProvider.setProvider('openai');
      expect(aiProvider.getCurrentProvider()).toBe('openai');
    });

    it('should not change provider for invalid name', () => {
      const original = aiProvider.getCurrentProvider();
      aiProvider.setProvider('invalid-provider');
      expect(aiProvider.getCurrentProvider()).toBe(original);
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for valid providers', async () => {
      const result = await aiProvider.isProviderAvailable('github');
      expect(result).toBe(true);
    });

    it('should return false for invalid providers', async () => {
      const result = await aiProvider.isProviderAvailable('invalid');
      expect(result).toBe(false);
    });
  });

  describe('generateDiagram', () => {
    it('should throw error when no token provided', async () => {
      await expect(aiProvider.generateDiagram('code', 'flowchart', 'javascript'))
        .rejects.toThrow('API token is required');
    });

    it('should accept all required parameters', async () => {
      // Mock fetch to avoid actual API calls
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'flowchart TD\nA --> B' } }] })
      } as any);

      const result = await aiProvider.generateDiagram('code', 'flowchart', 'javascript', 'github', 'test-token');
      expect(typeof result).toBe('string');
    });
  });

  describe('testProvider', () => {
    it('should return boolean for provider test', async () => {
      // Mock fetch to simulate provider test
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const result = await aiProvider.testProvider('github', 'test-token');
      expect(typeof result).toBe('boolean');
      expect(result).toBe(false);
    });
  });
});