import { AIProviderService } from '../ai-provider';

// Use global mocks from setup.ts
const vscode = (global as any).vscode;
const https = jest.requireMock('https');

describe('AIProviderService - Basic Tests', () => {
  let service: AIProviderService;
  let mockConfiguration: any;
  let mockSecrets: any;

  beforeEach(() => {
    mockConfiguration = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'provider': return 'github';
          case 'fallbackProviders': return true;
          case 'timeout': return 10;
          case 'retryCount': return 3;
          default: return undefined;
        }
      })
    };
    
    mockSecrets = {
      get: jest.fn().mockResolvedValue('test-token'),
      store: jest.fn(),
      delete: jest.fn()
    };

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfiguration);
    service = new AIProviderService();
  });

  it('should initialize with github as default provider', () => {
    expect(service.getCurrentProvider()).toBe('github');
  });

  it('should return provider names', () => {
    const names = service.getProviderNames();
    expect(names).toContain('github');
    expect(names).toContain('openai');
    expect(names).toContain('anthropic');
    expect(names).toContain('local');
  });

  it('should set provider successfully', () => {
    service.setProvider('openai');
    expect(service.getCurrentProvider()).toBe('openai');
  });

  it('should not change provider for invalid provider', () => {
    const originalProvider = service.getCurrentProvider();
    service.setProvider('invalid');
    expect(service.getCurrentProvider()).toBe(originalProvider);
  });

  it('should have correct provider configurations', () => {
    const providers = service.getProviders();
    const github = providers.get('github');
    
    expect(github).toBeDefined();
    expect(github?.name).toBe('github');
    expect(github?.endpoint).toBe('https://models.inference.ai.azure.com/chat/completions');
    expect(github?.model).toBe('gpt-4o');
  });
});