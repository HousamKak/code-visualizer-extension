import { APIProvider, DiagramType } from '../types';
import { IAIProviderService } from '../interfaces/ai-provider.interface';
import { strictSystemPrompt, diagramAddenda, buildUserPrompt, parseStructuredResponse } from '../utils/strict-prompts';
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
    // Get user-selected GitHub model from settings
    const githubModel = vscode.workspace.getConfiguration('codeVisualizer').get<string>('githubModel', 'gpt-4o');

    // GitHub Models (with configurable model selection)
    this.providers.set('github', {
      name: 'github',
      endpoint: 'https://models.inference.ai.azure.com/chat/completions',
      model: githubModel,
      headers: (token: string) => ({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }),
      buildBody: (prompt: string, diagramType?: DiagramType) => {
        const system = strictSystemPrompt;
        const addendum = diagramType ? diagramAddenda[diagramType] : '';
        const user = addendum ? `${addendum}\n\n${prompt}` : prompt;

        return {
          model: githubModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          max_tokens: 2000,
          temperature: 0.1
        };
      },
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
      buildBody: (prompt: string, diagramType?: DiagramType) => {
        const system = strictSystemPrompt;
        const addendum = diagramType ? diagramAddenda[diagramType] : '';
        const user = addendum ? `${addendum}\n\n${prompt}` : prompt;
        
        return {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          max_tokens: 2000,
          temperature: 0.2
        };
      },
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
      buildBody: (prompt: string, diagramType?: DiagramType) => {
        const system = strictSystemPrompt;
        const addendum = diagramType ? diagramAddenda[diagramType] : '';
        const user = addendum ? `${addendum}\n\n${prompt}` : prompt;
        
        return {
          model: 'claude-3-haiku-20240307',
          max_tokens: 2000,
          temperature: 0.1,
          system: system,
          messages: [{ role: 'user', content: user }]
        };
      },
      extractResponse: (data: any) => data.content?.[0]?.text || ''
    });

    // Local Ollama
    this.providers.set('local', {
      name: 'Ollama',
      endpoint: 'http://localhost:11434/api/generate',
      model: 'llama2',
      headers: () => ({ 'Content-Type': 'application/json' }),
      buildBody: (prompt: string, diagramType?: DiagramType) => {
        const system = strictSystemPrompt;
        const addendum = diagramType ? diagramAddenda[diagramType] : '';
        const fullPrompt = `${system}\n\n${addendum ? addendum + '\n\n' : ''}${prompt}`;
        
        return {
          model: 'llama2',
          prompt: fullPrompt,
          stream: false,
          temperature: 0.1
        };
      },
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
      const extractedResponse = provider.extractResponse(data);
      
      console.log(`[AI-PROVIDER] Raw response from ${provider.name}:`, extractedResponse);
      return extractedResponse;
    } catch (error) {
      throw new Error(`Failed to call ${provider.name}: ${error}`);
    }
  }

  async makeRequestWithDiagramType(
    providerName: string, 
    prompt: string, 
    token: string, 
    diagramType: DiagramType
  ): Promise<string> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    try {
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: provider.headers(token),
        body: JSON.stringify(provider.buildBody(prompt, diagramType))
      });

      if (!response.ok) {
        // Get error details from response
        let errorDetails = '';
        try {
          const errorData: any = await response.json();
          errorDetails = errorData?.error?.message || JSON.stringify(errorData);
        } catch (e) {
          errorDetails = response.statusText;
        }

        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '60';
          const waitSeconds = parseInt(retryAfter, 10);
          throw new Error(
            `Rate limit exceeded for ${provider.name}. ` +
            `GitHub Models free tier has daily limits. ` +
            `Please wait ${waitSeconds} seconds or upgrade to GitHub Copilot for higher limits. ` +
            `Current model: ${providerName}`
          );
        }

        // Handle bad request - often means invalid model name
        if (response.status === 400) {
          throw new Error(
            `Invalid request to ${provider.name}. ` +
            `This often means the model "${providerName}" is not available or the name is incorrect. ` +
            `Try selecting a different model with "Code Visualizer: Select AI Model". ` +
            `Error details: ${errorDetails}`
          );
        }

        throw new Error(`HTTP ${response.status}: ${errorDetails}`);
      }

      const data = await response.json();
      const extractedResponse = provider.extractResponse(data);

      console.log(`[AI-PROVIDER] Raw response from ${provider.name}:`, extractedResponse);
      return extractedResponse;
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
    providerName?: string,
    token?: string
  ): Promise<{ diagram: string; explanation: string }> {
    const provider = providerName || this.currentProvider;

    if (!token) {
      throw new Error('API token is required for diagram generation');
    }

    const prompt = buildUserPrompt(diagramType as DiagramType, language, code);
    const rawResponse = await this.makeRequestWithDiagramType(provider, prompt, token, diagramType as DiagramType);

    // Parse the structured response
    const parsed = parseStructuredResponse(rawResponse);

    return {
      diagram: parsed.diagram,
      explanation: parsed.explanation
    };
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