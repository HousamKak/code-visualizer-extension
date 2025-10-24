import { APIProvider } from '../types';

/**
 * Service interface for managing AI providers that generate Mermaid diagrams.
 * 
 * This service abstracts the interaction with various AI providers (GitHub Models, OpenAI, 
 * Anthropic, Ollama) to generate diagram content from code analysis. It provides fallback
 * mechanisms and provider management capabilities.
 * 
 * @example
 * ```typescript
 * const diagram = await aiProvider.generateDiagram(
 *   'function example() { return 42; }',
 *   'flowchart',
 *   'javascript'
 * );
 * ```
 */
export interface IAIProviderService {
  /**
   * Get all available AI providers with their configurations.
   * 
   * @returns Map of provider names to their APIProvider configurations
   */
  getProviders(): Map<string, APIProvider>;
  
  /**
   * Generate diagram content and explanation using AI based on code analysis.
   *
   * @param code - The source code to analyze and visualize
   * @param diagramType - Type of Mermaid diagram to generate (e.g., 'flowchart', 'sequence')
   * @param language - Programming language of the source code
   * @param providerName - Optional specific provider to use, defaults to current provider
   * @param token - Optional API token for authentication, required for actual generation
   * @returns Promise resolving to object with diagram syntax and explanation
   * @throws Error if generation fails or provider is unavailable
   */
  generateDiagram(
    code: string,
    diagramType: string,
    language: string,
    providerName?: string,
    token?: string
  ): Promise<{ diagram: string; explanation: string }>;
  
  /**
   * Check if a specific provider is available and properly configured.
   * 
   * @param providerName - Name of the provider to check
   * @returns Promise resolving to true if provider is available
   */
  isProviderAvailable(providerName: string): Promise<boolean>;
  
  /**
   * Get the name of the currently active AI provider.
   * 
   * @returns Current active provider name
   */
  getCurrentProvider(): string;
  
  /**
   * Set the active AI provider for diagram generation.
   * 
   * @param providerName - Name of the provider to set as active
   * @throws Error if provider is not registered
   */
  setProvider(providerName: string): void;
  
  /**
   * Test connectivity and authentication with a specific provider.
   * 
   * @param providerName - Name of the provider to test
   * @param token - API token to use for the test
   * @returns Promise resolving to true if connection is successful
   */
  testProvider(providerName: string, token: string): Promise<boolean>;
  
  /**
   * Get an array of all registered provider names.
   * 
   * @returns Array of provider names
   */
  getProviderNames(): string[];
}