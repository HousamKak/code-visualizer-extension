import { IAIProviderService } from '../../interfaces/ai-provider.interface';
import { APIProvider } from '../../types';

export class MockAIProviderService implements IAIProviderService {
  private mockProviders: Map<string, APIProvider> = new Map();
  private currentProvider = 'github';
  
  constructor() {
    // Setup mock providers
    this.mockProviders.set('github', {
      name: 'github',
      endpoint: 'https://mock.api.com',
      model: 'gpt-4o',
      headers: () => ({ 'Authorization': 'Bearer mock-token' }),
      buildBody: (prompt: string) => ({ prompt }),
      extractResponse: (data: any) => data.content || 'mock diagram content'
    });
  }

  getProviders(): Map<string, APIProvider> {
    return this.mockProviders;
  }

  async generateDiagram(
    code: string, 
    diagramType: string, 
    language: string,
    providerName?: string
  ): Promise<string> {
    // Mock diagram generation
    return `flowchart TD
    A[${code.slice(0, 20)}...] --> B[Process]
    B --> C[Result]`;
  }

  async isProviderAvailable(providerName: string): Promise<boolean> {
    return this.mockProviders.has(providerName);
  }

  getCurrentProvider(): string {
    return this.currentProvider;
  }

  setProvider(providerName: string): void {
    if (this.mockProviders.has(providerName)) {
      this.currentProvider = providerName;
    }
  }

  async testProvider(providerName: string, token: string): Promise<boolean> {
    return this.mockProviders.has(providerName) && token.length > 0;
  }

  getProviderNames(): string[] {
    return Array.from(this.mockProviders.keys());
  }
}