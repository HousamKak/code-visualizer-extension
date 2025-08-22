import * as vscode from 'vscode';
import { DiagramType, DiagramTypeConfig, FunctionInfo, CodeAnalysis } from '../types';
import { IAIProviderService } from '../interfaces/ai-provider.interface';
import { ParserFactory } from '../parsers';
import { IDiagramGeneratorService } from '../interfaces/diagram-generator.interface';

export class DiagramGeneratorService implements IDiagramGeneratorService {
  private diagramConfigs: DiagramTypeConfig[] = [];

  constructor(
    private aiProvider: IAIProviderService,
    private context: vscode.ExtensionContext
  ) {
    this.initializeDiagramConfigs();
  }

  private initializeDiagramConfigs(): void {
    this.diagramConfigs = [
      {
        type: 'sequence',
        name: 'Sequence Diagram',
        prompt: 'Create a detailed Mermaid sequence diagram that captures all interactions, API calls, and message flows. Include participants, activation boxes, and note important async operations. Focus on the temporal order of operations and clearly show request-response patterns.',
        patterns: [
          /fetch\s*\(/gi,
          /axios\./gi,
          /\$\.ajax/gi,
          /XMLHttpRequest/gi,
          /await\s+/gi,
          /\.then\s*\(/gi,
          /emit\s*\(/gi,
          /on\s*\(/gi,
          /addEventListener/gi,
          /postMessage/gi,
          /websocket/gi,
          /grpc/gi
        ],
        keywords: ['api', 'request', 'response', 'async', 'await', 'promise', 'callback', 'emit', 'subscribe', 'publish'],
        scoreWeight: 1.5
      },
      {
        type: 'flowchart',
        name: 'Flowchart',
        prompt: 'Create a comprehensive Mermaid flowchart that shows the complete program flow, including all conditional branches, loops, and decision points. Use clear decision diamonds and show all possible execution paths.',
        patterns: [
          /if\s*\(/gi,
          /else\s*(if\s*)?\{/gi,
          /switch\s*\(/gi,
          /case\s+/gi,
          /for\s*\(/gi,
          /while\s*\(/gi,
          /do\s*\{/gi,
          /return\s+/gi,
          /break\s*;/gi,
          /continue\s*;/gi
        ],
        keywords: ['condition', 'loop', 'branch', 'decision', 'flow', 'control', 'if', 'else', 'switch', 'for', 'while'],
        scoreWeight: 1.0
      },
      {
        type: 'classDiagram',
        name: 'Class Diagram',
        prompt: 'Generate a detailed Mermaid class diagram showing class structures, inheritance hierarchies, composition relationships, and all public/private methods and properties. Include interfaces and abstract classes.',
        patterns: [
          /class\s+\w+/gi,
          /extends\s+\w+/gi,
          /implements\s+\w+/gi,
          /interface\s+\w+/gi,
          /abstract\s+class/gi,
          /public\s+/gi,
          /private\s+/gi,
          /protected\s+/gi,
          /static\s+/gi
        ],
        keywords: ['class', 'inheritance', 'interface', 'abstract', 'extends', 'implements', 'polymorphism', 'encapsulation'],
        scoreWeight: 1.2
      },
      {
        type: 'stateDiagram',
        name: 'State Diagram',
        prompt: 'Create a Mermaid state diagram that clearly shows all possible states, transitions between states, and the events or conditions that trigger these transitions. Include initial and final states.',
        patterns: [
          /state\s*=/gi,
          /status\s*=/gi,
          /setState\s*\(/gi,
          /useState\s*\(/gi,
          /enum\s+\w+/gi,
          /switch\s*\(\s*state/gi,
          /case\s+\w+\s*:/gi
        ],
        keywords: ['state', 'status', 'transition', 'event', 'trigger', 'mode', 'phase', 'step'],
        scoreWeight: 1.1
      },
      {
        type: 'erDiagram',
        name: 'ER Diagram',
        prompt: 'Generate a comprehensive Mermaid ER diagram showing entities, their attributes, and relationships with proper cardinality notation. Include primary keys, foreign keys, and relationship types.',
        patterns: [
          /schema\s*:/gi,
          /table\s+\w+/gi,
          /entity\s+\w+/gi,
          /model\s+\w+/gi,
          /primary\s+key/gi,
          /foreign\s+key/gi,
          /references\s+/gi,
          /belongs\s*to/gi,
          /has\s*many/gi,
          /has\s*one/gi
        ],
        keywords: ['entity', 'relationship', 'attribute', 'primary', 'foreign', 'table', 'model', 'schema', 'database'],
        scoreWeight: 1.3
      },
      {
        type: 'journey',
        name: 'User Journey',
        prompt: 'Create a Mermaid user journey diagram that maps out the user experience, showing each step in the user\'s interaction with the system, including emotions and pain points.',
        patterns: [
          /user\s*\./gi,
          /customer\s*\./gi,
          /journey\s*/gi,
          /step\s*\d+/gi,
          /experience\s*/gi,
          /interaction\s*/gi,
          /touchpoint\s*/gi
        ],
        keywords: ['user', 'journey', 'experience', 'interaction', 'step', 'touchpoint', 'satisfaction', 'pain point'],
        scoreWeight: 0.9
      }
    ];
  }

  determineBestDiagramType(functionInfo: FunctionInfo, analysis?: CodeAnalysis): DiagramType {
    const scores = new Map<DiagramType, number>();
    
    // Initialize scores
    for (const config of this.diagramConfigs) {
      scores.set(config.type, 0);
    }

    // Score based on code analysis
    if (analysis) {
      if (analysis.isSequentialProcess) scores.set('sequence', (scores.get('sequence') || 0) + 3);
      if (analysis.isClassHierarchy) scores.set('classDiagram', (scores.get('classDiagram') || 0) + 3);
      if (analysis.isStateMachine) scores.set('stateDiagram', (scores.get('stateDiagram') || 0) + 3);
      if (analysis.isEntityRelationship) scores.set('erDiagram', (scores.get('erDiagram') || 0) + 3);
      
      if (analysis.hasAsyncOperations) scores.set('sequence', (scores.get('sequence') || 0) + 2);
      if (analysis.hasComplexConditions) scores.set('flowchart', (scores.get('flowchart') || 0) + 2);
      if (analysis.hasClassDefinition) scores.set('classDiagram', (scores.get('classDiagram') || 0) + 2);
      if (analysis.hasUserInteraction) scores.set('journey', (scores.get('journey') || 0) + 2);
      if (analysis.hasDatabaseOperations) scores.set('erDiagram', (scores.get('erDiagram') || 0) + 2);
    }

    // Score based on pattern matching
    for (const config of this.diagramConfigs) {
      for (const pattern of config.patterns) {
        if (pattern.test(functionInfo.code)) {
          scores.set(config.type, (scores.get(config.type) || 0) + 1);
        }
      }
      
      for (const keyword of config.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        const matches = functionInfo.code.match(regex);
        if (matches) {
          scores.set(config.type, (scores.get(config.type) || 0) + matches.length * 0.5);
        }
      }
    }

    // Find highest scoring diagram type
    let bestType: DiagramType = 'flowchart'; // default
    let highestScore = 0;
    
    for (const [type, score] of scores.entries()) {
      if (score > highestScore) {
        highestScore = score;
        bestType = type;
      }
    }

    return bestType;
  }

  getDiagramConfig(diagramType: DiagramType): DiagramTypeConfig {
    return this.diagramConfigs.find(config => config.type === diagramType) || this.diagramConfigs[0];
  }

  // Interface implementation
  analyzeBestDiagramType(code: string, language: string): DiagramType {
    const functionInfo: FunctionInfo = {
      code,
      name: 'function',
      type: 'function',
      startLine: 0,
      endLine: 0,
      language
    };
    const analysis = this.analyzeCode(functionInfo);
    return this.determineBestDiagramType(functionInfo, analysis);
  }

  async generateDiagram(
    functionInfo: FunctionInfo,
    preferredType?: DiagramType
  ): Promise<{ diagram: string; type: DiagramType }> {
    const diagramType = preferredType || this.analyzeBestDiagramType(functionInfo.code, functionInfo.language);
    const analysis = this.analyzeCode(functionInfo);
    const diagram = await this.generateSpecificDiagram(functionInfo.code, diagramType, functionInfo.language);
    
    return { diagram, type: diagramType };
  }

  async generateSpecificDiagram(
    code: string,
    diagramType: DiagramType,
    language: string
  ): Promise<string> {
    const functionInfo: FunctionInfo = {
      code,
      name: 'function',
      type: 'function',
      startLine: 0,
      endLine: 0,
      language
    };
    return this.generateDiagramInternal(functionInfo, diagramType);
  }

  private async generateDiagramInternal(
    functionInfo: FunctionInfo, 
    diagramType: DiagramType, 
    analysis?: CodeAnalysis
  ): Promise<string> {
    const config = this.getDiagramConfig(diagramType);
    const prompt = this.buildPrompt(functionInfo, config, analysis);
    
    // Get provider settings
    const providerName = vscode.workspace.getConfiguration('codeVisualizer').get<string>('provider', 'github');
    const fallbackEnabled = vscode.workspace.getConfiguration('codeVisualizer').get<boolean>('fallbackProviders', true);
    
    // Try primary provider
    try {
      const response = await this.aiProvider.generateDiagram(functionInfo.code, diagramType, functionInfo.language, providerName);
      return this.cleanAndValidateResponse(response, diagramType);
    } catch (error) {
      console.error(`Primary provider ${providerName} failed:`, error);
      
      if (!fallbackEnabled) {
        throw error;
      }
      
      // Try fallback providers
      const fallbackProviders = ['github', 'openai', 'anthropic'].filter(p => p !== providerName);
      
      for (const fallbackProvider of fallbackProviders) {
        try {
          const response = await this.aiProvider.generateDiagram(functionInfo.code, diagramType, functionInfo.language, fallbackProvider);
          return this.cleanAndValidateResponse(response, diagramType);
        } catch (fallbackError) {
          console.error(`Fallback provider ${fallbackProvider} failed:`, fallbackError);
        }
      }
      
      throw new Error('All providers failed to generate diagram');
    }
  }

  private buildPrompt(functionInfo: FunctionInfo, config: DiagramTypeConfig, analysis?: CodeAnalysis): string {
    const languageContext = this.detectLanguageContext(functionInfo.code, functionInfo.language);
    const complexityHints = this.getComplexityHints(analysis || {} as CodeAnalysis);
    
    return `You are an expert software architect creating visual documentation. ${config.prompt}

## Code Context:
- Language: ${languageContext.language}
- Framework: ${languageContext.framework || 'Unknown'}
- Complexity: ${analysis?.complexity || 'Unknown'}
- Key Patterns: ${languageContext.patterns.join(', ') || 'None detected'}

## Analysis Results:
${this.formatCodeAnalysis(analysis || {} as CodeAnalysis)}

## Instructions:
${complexityHints}
- Use clear, descriptive labels without quotes
- Include all significant control flows and data transformations
- Show error handling paths where present
- Highlight async operations and their dependencies
- Focus on business logic and key architectural decisions
${this.getDiagramSpecificInstructions(config.type)}

## Code to Visualize:
\`\`\`${languageContext.language}
${functionInfo.code}
\`\`\`

Generate ONLY the ${config.name} in valid Mermaid syntax. Ensure the diagram is comprehensive yet readable.`;
  }

  private buildAnalysisContext(analysis: CodeAnalysis): string {
    const insights = [];
    
    if (analysis.hasAsyncOperations) insights.push('- Contains async operations');
    if (analysis.hasApiCalls) insights.push('- Makes API calls');
    if (analysis.hasComplexConditions) insights.push('- Has complex conditional logic');
    if (analysis.hasErrorHandling) insights.push('- Includes error handling');
    if (analysis.hasLoops) insights.push('- Contains loops or iterations');
    if (analysis.hasStateManagement) insights.push('- Manages state');
    
    if (insights.length > 0) {
      return `\nCode Analysis Insights:
${insights.join('\n')}

Use these insights to create the most appropriate diagram structure.`;
    }
    
    return '';
  }

  private async getApiToken(providerName: string): Promise<string> {
    // Try to get from secrets first (secure storage)
    const secretKey = `codeVisualizer.token.${providerName}`;
    let token = await this.context.secrets.get(secretKey);
    
    // For GitHub provider, try to get GitHub Copilot token
    if (!token && providerName === 'github') {
      try {
        // Try to get GitHub authentication token from VS Code
        const session = await vscode.authentication.getSession('github', ['user:email'], { createIfNone: false });
        if (session) {
          token = session.accessToken;
        }
      } catch (error) {
        console.log('Could not get GitHub session:', error);
      }
    }
    
    // Fallback to configuration (deprecated)
    if (!token) {
      token = vscode.workspace.getConfiguration('codeVisualizer').get<string>('apiToken');
    }
    
    if (!token) {
      const message = providerName === 'github' 
        ? `No GitHub token found. Either:
1. Use 'Code Visualizer: Configure API Token' command to set a GitHub Models API token, or
2. Sign in to GitHub in VS Code (Accounts → Sign in to sync settings)`
        : `No API token configured for ${providerName}. Use 'Code Visualizer: Configure API Token' command.`;
      throw new Error(message);
    }
    
    return token;
  }

  private cleanAndValidateResponse(response: string, diagramType: DiagramType): string {
    if (!response || response.trim().length === 0) {
      throw new Error('Empty response from AI provider');
    }

    // Clean and validate using parser
    const cleaned = ParserFactory.cleanDiagram(response, diagramType);
    
    if (cleaned.length < 10) {
      throw new Error('Generated diagram is too short or invalid');
    }

    return cleaned;
  }

  private detectLanguageContext(code: string, language: string): { language: string; framework?: string; patterns: string[] } {
    const context = {
      language: language,
      framework: undefined as string | undefined,
      patterns: [] as string[]
    };

    // Framework detection
    if (code.includes('React.') || code.includes('useState') || code.includes('useEffect')) {
      context.framework = 'React';
      context.patterns.push('React Hooks');
    }
    if (code.includes('Vue.') || code.includes('@Component')) {
      context.framework = 'Vue';
    }
    if (code.includes('express') || code.includes('app.get') || code.includes('app.post')) {
      context.framework = 'Express.js';
      context.patterns.push('REST API');
    }

    // Pattern detection
    if (code.includes('class ') && code.includes('extends ')) {
      context.patterns.push('Inheritance');
    }
    if (code.includes('interface ') || code.includes('implements ')) {
      context.patterns.push('Interfaces');
    }
    if (code.includes('async ') || code.includes('await ')) {
      context.patterns.push('Async/Await');
    }

    return context;
  }

  private getComplexityHints(analysis: CodeAnalysis): string {
    if (analysis.complexity === 'complex') {
      return '- Focus on the main flow, simplify complex branches\n- Group related operations into logical sections\n- Use subgraphs for complex nested structures';
    } else if (analysis.complexity === 'moderate') {
      return '- Include all major decision points\n- Show error handling where significant';
    } else {
      return '- Keep the diagram simple and direct\n- Focus on the primary execution path';
    }
  }

  private formatCodeAnalysis(analysis: CodeAnalysis): string {
    const features = [];
    if (analysis.hasApiCalls) features.push('API Calls');
    if (analysis.hasAsyncOperations) features.push('Async Operations');
    if (analysis.hasComplexConditions) features.push('Complex Conditions');
    if (analysis.hasLoops) features.push('Loops');
    if (analysis.hasErrorHandling) features.push('Error Handling');
    if (analysis.hasStateManagement) features.push('State Management');
    
    return features.length > 0 ? `Detected Features: ${features.join(', ')}` : 'No specific patterns detected';
  }

  private getDiagramSpecificInstructions(diagramType: DiagramType): string {
    const instructions: Record<DiagramType, string> = {
      'sequence': '- Show all participants and their interactions\n- Include activation boxes for processing\n- Note async operations clearly',
      'flowchart': '- Use decision diamonds for conditions\n- Show all possible paths\n- Group related operations',
      'classDiagram': '- Show all class members (methods and properties)\n- Include inheritance and composition relationships\n- Use proper visibility indicators',
      'stateDiagram': '- Show all states and transitions\n- Include trigger conditions for transitions\n- Note entry/exit actions',
      'erDiagram': '- Show all entities and their attributes\n- Include relationship cardinalities\n- Use proper relationship notation',
      'journey': '- Show user actions and system responses\n- Include emotional states where relevant\n- Focus on user experience flow',
      'gitGraph': '- Show branch structure clearly\n- Include merge and commit points\n- Use descriptive commit messages',
      'mindmap': '- Organize concepts hierarchically\n- Group related ideas\n- Keep labels concise',
      'timeline': '- Show chronological sequence\n- Include key milestones\n- Use clear time indicators',
      'quadrantChart': '- Label axes clearly\n- Position items accurately\n- Use meaningful categories',
      'sankey': '- Show flow proportions\n- Label all nodes and flows\n- Use appropriate flow widths',
      'block': '- Show component relationships\n- Include data flow directions\n- Group related components'
    };
    
    return instructions[diagramType] || '- Follow standard Mermaid syntax\n- Keep structure clear and logical';
  }

  // Additional interface methods
  getAvailableDiagramTypes(): DiagramTypeConfig[] {
    return [...this.diagramConfigs];
  }

  validateDiagram(diagram: string, type: DiagramType): boolean {
    try {
      const cleaned = this.cleanDiagramSyntax(diagram, type);
      return cleaned.length > 0;
    } catch {
      return false;
    }
  }

  cleanDiagramSyntax(diagram: string, type: DiagramType): string {
    return ParserFactory.cleanDiagram(diagram, type);
  }

  getDiagramTypeConfig(type: DiagramType): DiagramTypeConfig | null {
    return this.diagramConfigs.find(config => config.type === type) || null;
  }

  private analyzeCode(functionInfo: FunctionInfo): CodeAnalysis {
    const code = functionInfo.code;
    return {
      hasApiCalls: /\b(fetch|axios|http|request|api)\b/i.test(code),
      hasStateManagement: /\b(useState|setState|state|store|redux)\b/i.test(code),
      hasClassDefinition: /\bclass\s+\w+/i.test(code),
      hasAsyncOperations: /\b(async|await|Promise|then|catch)\b/i.test(code),
      hasEventHandlers: /\b(addEventListener|onClick|onSubmit|handleClick)\b/i.test(code),
      hasDataFlow: /\b(map|filter|reduce|pipe|transform)\b/i.test(code),
      hasUserInteraction: /\b(input|button|form|click|submit)\b/i.test(code),
      hasComplexConditions: (code.match(/\b(if|else|switch|case)\b/g) || []).length > 2,
      hasLoops: /\b(for|while|forEach|map|each)\b/i.test(code),
      hasErrorHandling: /\b(try|catch|throw|error|exception)\b/i.test(code),
      hasDatabaseOperations: /\b(query|select|insert|update|delete|database|sql)\b/i.test(code),
      isStateMachine: false,
      isClassHierarchy: false,
      isSequentialProcess: false,
      isEntityRelationship: false,
      complexity: 'simple' as const
    };
  }
}