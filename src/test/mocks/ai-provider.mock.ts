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
    providerName?: string,
    token?: string
  ): Promise<{ diagram: string; explanation: string }> {
    // Mock diagram generation with explanation
    const diagram = `flowchart TD
    A[${code.slice(0, 20)}...] --> B[Process]
    B --> C[Result]`;

    const explanation = `**Overview:**
This is a mock \`${language}\` function that demonstrates code processing with \`async\` operations and \`database\` interactions.

**Key Logic:**
- Validates input \`parameters\` using \`null\` and \`undefined\` checks
- Processes data in sequential steps with \`Promise\` chains
- Returns formatted \`response\` with proper error handling

**Complexity:**
Low to moderate complexity with straightforward control flow. NOTE: Contains 2-3 decision points and minimal branching.

**Technical Details:**
- Uses standard \`${language}\` syntax with modern features
- IMPORTANT: No external \`database\` dependencies in this mock
- Synchronous execution with potential for \`async\` conversion
- Handles \`null\` and \`undefined\` edge cases

**Recommendations:**
- TIP: Consider adding input \`validation\` for all parameters
- WARNING: Implement proper \`error handling\` with \`try-catch\` blocks
- Add comprehensive \`unit tests\` for 100% coverage
- Consider using \`TypeScript\` for type safety`;

    return { diagram, explanation };
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