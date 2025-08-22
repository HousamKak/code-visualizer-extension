import { DiagramType, DiagramTypeConfig, FunctionInfo, CodeAnalysis } from '../types';

/**
 * Service interface for intelligent diagram generation and type analysis.
 * 
 * This service analyzes source code to determine the most appropriate Mermaid diagram type
 * and generates high-quality diagrams using AI providers. It includes pattern matching,
 * syntax validation, and diagram optimization capabilities.
 * 
 * @example
 * ```typescript
 * const result = await diagramGenerator.generateDiagram({
 *   code: 'async function fetchData() { return await api.get("/data"); }',
 *   name: 'fetchData',
 *   type: 'async',
 *   language: 'typescript'
 * });
 * // Returns: { diagram: 'sequenceDiagram...', type: 'sequence' }
 * ```
 */
export interface IDiagramGeneratorService {
  /**
   * Generate the most appropriate diagram for a given function.
   * 
   * Analyzes the function code to determine the best diagram type and generates
   * a comprehensive diagram using AI providers with fallback support.
   * 
   * @param functionInfo - Complete function information including code and metadata
   * @param preferredType - Optional preferred diagram type to override analysis
   * @returns Promise resolving to generated diagram string and determined type
   * @throws Error if diagram generation fails after all retries
   */
  generateDiagram(
    functionInfo: FunctionInfo,
    preferredType?: DiagramType
  ): Promise<{ diagram: string; type: DiagramType }>;
  
  /**
   * Analyze source code and determine the optimal diagram type.
   * 
   * Uses pattern matching, keyword analysis, and code complexity assessment
   * to select the most appropriate Mermaid diagram type for visualization.
   * 
   * @param code - Source code to analyze
   * @param language - Programming language of the code
   * @returns Most suitable DiagramType for the given code
   */
  analyzeBestDiagramType(code: string, language: string): DiagramType;
  
  /**
   * Get all available diagram type configurations.
   * 
   * @returns Array of all supported diagram type configurations with patterns and prompts
   */
  getAvailableDiagramTypes(): DiagramTypeConfig[];
  
  /**
   * Generate a diagram of a specific type for given code.
   * 
   * @param code - Source code to visualize
   * @param diagramType - Specific Mermaid diagram type to generate
   * @param language - Programming language of the source code
   * @returns Promise resolving to generated Mermaid diagram syntax
   * @throws Error if generation fails or diagram type is unsupported
   */
  generateSpecificDiagram(
    code: string,
    diagramType: DiagramType,
    language: string
  ): Promise<string>;
  
  /**
   * Validate Mermaid diagram syntax for correctness.
   * 
   * @param diagram - Mermaid diagram syntax to validate
   * @param type - Expected diagram type for validation rules
   * @returns true if diagram syntax is valid, false otherwise
   */
  validateDiagram(diagram: string, type: DiagramType): boolean;
  
  /**
   * Clean and optimize Mermaid diagram syntax.
   * 
   * Removes invalid syntax, fixes common errors, and optimizes the diagram
   * structure for better rendering and readability.
   * 
   * @param diagram - Raw diagram syntax to clean
   * @param type - Diagram type for type-specific cleaning rules
   * @returns Cleaned and optimized Mermaid syntax
   */
  cleanDiagramSyntax(diagram: string, type: DiagramType): string;
  
  /**
   * Get configuration for a specific diagram type.
   * 
   * @param type - Diagram type to get configuration for
   * @returns Configuration object or null if type is not supported
   */
  getDiagramTypeConfig(type: DiagramType): DiagramTypeConfig | null;
}