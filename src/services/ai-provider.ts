import { APIProvider } from '../types';
import { IAIProviderService } from '../interfaces/ai-provider.interface';
import * as vscode from 'vscode';

/**
 * Implementation of AI provider service for generating Mermaid diagrams.
 * 
 * Manages multiple AI providers (GitHub Models, OpenAI, Anthropic, Ollama) with
 * automatic fallback mechanisms, token management, and provider-specific optimizations
 * for diagram generation.
 * 
 * @implements {IAIProviderService}
 */
export class AIProviderService implements IAIProviderService {
  private providers: Map<string, APIProvider> = new Map();
  private currentProvider = 'github';

  /**
   * Initialize the AI provider service with all supported providers.
   * 
   * Sets up GitHub Models, OpenAI, Anthropic, and Ollama providers with
   * their respective endpoints, models, and request configurations.
   */
  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // GitHub Models (exact original configuration)
    this.providers.set('github', {
      name: 'github',
      endpoint: 'https://models.inference.ai.azure.com/chat/completions',
      model: 'gpt-4o',
      headers: (token: string) => ({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }),
      buildBody: (prompt: string) => ({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a code visualization expert specializing in Mermaid diagrams. 
Your task is to analyze code and generate the most appropriate Mermaid diagram.

CRITICAL RULES:
1. Output ONLY the Mermaid diagram code, no explanations
2. Start with the diagram type declaration (e.g., "sequenceDiagram", "stateDiagram-v2", "flowchart TD")
3. NO quotes or backticks in node labels - use plain text only
4. Keep all labels concise (under 25 characters)
5. Use clear, descriptive node IDs
6. For complex logic, focus on the main flow, not every detail
7. Ensure the diagram is valid Mermaid syntax

Remember: You must output ONLY the diagram code, nothing else.`
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.2
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content || ''
    });

    // OpenAI
    this.providers.set('openai', {
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4',
      headers: (token: string) => ({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }),
      buildBody: (prompt: string) => ({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3
      }),
      extractResponse: (data: any) => data.choices?.[0]?.message?.content || ''
    });

    // Anthropic Claude
    this.providers.set('anthropic', {
      name: 'Anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-haiku-20240307',
      headers: (token: string) => ({
        'x-api-key': token,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }),
      buildBody: (prompt: string) => ({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      }),
      extractResponse: (data: any) => data.content?.[0]?.text || ''
    });

    // Local Ollama
    this.providers.set('local', {
      name: 'Ollama',
      endpoint: 'http://localhost:11434/api/generate',
      model: 'llama2',
      headers: () => ({ 'Content-Type': 'application/json' }),
      buildBody: (prompt: string) => ({
        model: 'llama2',
        prompt: prompt,
        stream: false
      }),
      extractResponse: (data: any) => data.response || ''
    });
  }

  getProvider(name: string): APIProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): APIProvider[] {
    return Array.from(this.providers.values());
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  async makeRequest(providerName: string, prompt: string, token: string): Promise<string> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    try {
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: provider.headers(token),
        body: JSON.stringify(provider.buildBody(prompt))
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return provider.extractResponse(data);
    } catch (error) {
      throw new Error(`Failed to call ${provider.name}: ${error}`);
    }
  }

  // Interface methods
  getProviders(): Map<string, APIProvider> {
    return this.providers;
  }

  async generateDiagram(
    code: string, 
    diagramType: string, 
    language: string,
    providerName?: string
  ): Promise<string> {
    const provider = providerName || this.currentProvider;
    const config = vscode.workspace.getConfiguration('codeVisualizer');
    const token = await vscode.commands.executeCommand('codeVisualizer.getApiToken') as string;
    
    const prompt = `Generate a ${diagramType} Mermaid diagram for this ${language} code:

${code}

Focus on the main logic flow and keep it concise. Output only the Mermaid diagram code.`;

    return this.makeRequest(provider, prompt, token);
  }

  async isProviderAvailable(providerName: string): Promise<boolean> {
    return this.providers.has(providerName);
  }

  getCurrentProvider(): string {
    return this.currentProvider;
  }

  setProvider(providerName: string): void {
    if (this.providers.has(providerName)) {
      this.currentProvider = providerName;
    }
  }

  async testProvider(providerName: string, token: string): Promise<boolean> {
    try {
      await this.makeRequest(providerName, 'Test prompt', token);
      return true;
    } catch (error) {
      return false;
    }
  }
}