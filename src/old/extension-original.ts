// src/extension.ts
import * as vscode from 'vscode';
import * as crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface DiagramCache {
  diagram: string;
  diagramType: DiagramType;
  timestamp: number;
  codeHash: string;
  filePath?: string;
  functionName?: string;
  language?: string;
  codeAnalysis?: CodeAnalysis;
  imageFilePath?: string;
  mermaidFilePath?: string;
  lastAccessed: number;
  accessCount: number;
}

interface CacheMetadata {
  version: string;
  totalEntries: number;
  lastCleanup: number;
  cacheDirectory: string;
  maxCacheSize: number;
}

interface FunctionInfo {
  code: string;
  name: string;
  type: 'function' | 'arrow' | 'method' | 'async' | 'generator' | 'class' | 'module';
  startLine: number;
  endLine: number;
  language: string;
}

interface CodeAnalysis {
  hasApiCalls: boolean;
  hasStateManagement: boolean;
  hasClassDefinition: boolean;
  hasAsyncOperations: boolean;
  hasEventHandlers: boolean;
  hasDataFlow: boolean;
  hasUserInteraction: boolean;
  hasComplexConditions: boolean;
  hasLoops: boolean;
  hasErrorHandling: boolean;
  hasDatabaseOperations: boolean;
  isStateMachine: boolean;
  isClassHierarchy: boolean;
  isSequentialProcess: boolean;
  isEntityRelationship: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

type DiagramType = 
  | 'flowchart'      // Control flow, conditions, loops
  | 'sequence'       // API calls, async operations, message passing
  | 'stateDiagram'   // State machines, lifecycle methods
  | 'classDiagram'   // Class structures, inheritance
  | 'erDiagram'      // Database schemas, entity relationships
  | 'journey'        // User interactions, process flows
  | 'gitGraph'       // Branching logic, version control
  | 'mindmap'        // Module structure, dependencies
  | 'timeline'       // Sequential events, scheduling
  | 'quadrantChart'  // Decision matrices, comparisons
  | 'sankey'         // Data flow, resource allocation
  | 'block'          // Component architecture;

interface DiagramTypeConfig {
  type: DiagramType;
  name: string;
  prompt: string;
  patterns: RegExp[];
  keywords: string[];
  scoreWeight: number;
}

interface APIProvider {
  name: string;
  endpoint: string;
  model: string;
  headers: (token: string) => Record<string, string>;
  buildBody: (prompt: string) => any;
  extractResponse: (data: any) => string;
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust', 'php', 'ruby',
  'cpp', 'c', 'kotlin', 'swift', 'scala', 'dart', 'lua', 'perl', 'r', 'matlab', 'sql'
];
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_CODE_SIZE = 12000; // Increased for better analysis
const DIAGRAM_GENERATION_TIMEOUT = 30000; // Increased timeout
const DEBOUNCE_DELAY = 300; // For hover debouncing
const MAX_CACHE_SIZE = 500; // Increased cache size
const CACHE_VERSION = '2.0.0';
const CACHE_CLEANUP_INTERVAL = 1000 * 60 * 60 * 6; // 6 hours
const MAX_ACCESS_COUNT_FOR_PERSISTENCE = 3;
const PERSISTENT_CACHE_DIR = '.code-visualizer-cache';

// Diagram type configurations with detection patterns
const DIAGRAM_TYPES: DiagramTypeConfig[] = [
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
    type: 'stateDiagram',
    name: 'State Diagram',
    prompt: 'Create a comprehensive Mermaid state diagram showing all states, transitions, guards, and actions. Include initial and final states, compound states where applicable, and clearly label all transition conditions and events.',
    patterns: [
      /state\s*[=:]/gi,
      /setState/gi,
      /this\.state/gi,
      /useState/gi,
      /useReducer/gi,
      /switch\s*\([^)]*state/gi,
      /FSM|FiniteStateMachine/gi,
      /transition/gi,
      /currentState/gi,
      /nextState/gi,
      /\_state/gi
    ],
    keywords: ['state', 'transition', 'machine', 'fsm', 'status', 'phase', 'stage', 'lifecycle'],
    scoreWeight: 1.8
  },
  {
    type: 'classDiagram',
    name: 'Class Diagram',
    prompt: 'Create a detailed Mermaid class diagram following exact Mermaid syntax. Use proper class definition format: class ClassName { +method() -field }. For relationships use: ClassName --|> ParentClass for inheritance, ClassName --* ClassName2 for composition, ClassName --> ClassName2 for association. NO + or - prefixes outside braces, NO --> for inheritance.',
    patterns: [
      /class\s+\w+/gi,
      /extends\s+\w+/gi,
      /implements\s+\w+/gi,
      /constructor\s*\(/gi,
      /public\s+\w+/gi,
      /private\s+\w+/gi,
      /protected\s+\w+/gi,
      /static\s+\w+/gi,
      /interface\s+\w+/gi,
      /abstract\s+class/gi,
      /trait\s+\w+/gi
    ],
    keywords: ['class', 'interface', 'extends', 'implements', 'inheritance', 'abstract', 'override', 'polymorphism'],
    scoreWeight: 2.0
  },
  {
    type: 'erDiagram',
    name: 'Entity Relationship Diagram',
    prompt: 'Create a comprehensive Mermaid ER diagram showing all entities, their attributes (including primary/foreign keys), relationship cardinalities, and constraints. Focus on data model integrity and clear relationship types.',
    patterns: [
      /CREATE\s+TABLE/gi,
      /SELECT\s+.*\s+FROM/gi,
      /JOIN\s+/gi,
      /FOREIGN\s+KEY/gi,
      /PRIMARY\s+KEY/gi,
      /\.findOne/gi,
      /\.findMany/gi,
      /\.create\(/gi,
      /\.save\(/gi,
      /model\(/gi,
      /Schema\(/gi,
      /sequelize/gi,
      /prisma/gi,
      /typeorm/gi
    ],
    keywords: ['table', 'entity', 'model', 'schema', 'database', 'relation', 'foreign', 'primary', 'query'],
    scoreWeight: 1.7
  },
  {
    type: 'journey',
    name: 'User Journey',
    prompt: 'Create an engaging Mermaid user journey diagram that maps all user touchpoints, emotions, pain points, and system interactions. Include user goals, actions, thoughts, and opportunities for improvement.',
    patterns: [
      /onClick/gi,
      /onSubmit/gi,
      /addEventListener/gi,
      /user\./gi,
      /handleClick/gi,
      /handleSubmit/gi,
      /dispatch\(/gi,
      /navigate\(/gi,
      /redirect/gi,
      /route/gi
    ],
    keywords: ['user', 'click', 'submit', 'action', 'interaction', 'event', 'handle', 'form', 'button'],
    scoreWeight: 1.3
  },
  {
    type: 'mindmap',
    name: 'Mind Map',
    prompt: 'Generate a Mermaid mindmap showing the structure, components, and relationships',
    patterns: [
      /import\s+.*\s+from/gi,
      /require\s*\(/gi,
      /export\s+/gi,
      /module\./gi,
      /namespace\s+/gi,
      /package\s+/gi
    ],
    keywords: ['module', 'component', 'import', 'export', 'dependency', 'package', 'library'],
    scoreWeight: 1.2
  },
  {
    type: 'timeline',
    name: 'Timeline',
    prompt: 'Generate a Mermaid timeline showing sequential events and time-based operations',
    patterns: [
      /setTimeout/gi,
      /setInterval/gi,
      /cron/gi,
      /schedule/gi,
      /delay/gi,
      /wait/gi,
      /sleep/gi,
      /queue/gi,
      /timestamp/gi,
      /date/gi
    ],
    keywords: ['time', 'schedule', 'delay', 'timeout', 'interval', 'queue', 'sequence', 'order', 'step'],
    scoreWeight: 1.1
  },
  {
    type: 'flowchart',
    name: 'Flowchart',
    prompt: 'Create a valid Mermaid flowchart with proper syntax. Start with "flowchart TD". Use proper node definitions like nodeId[Label] or nodeId{Decision}. Connect nodes with --> arrows. Use subgraphs to group related logic. NO direct subgraph-to-subgraph connections. Ensure all referenced nodes are properly defined.',
    patterns: [
      /if\s*\(/gi,
      /else/gi,
      /for\s*\(/gi,
      /while\s*\(/gi,
      /switch\s*\(/gi,
      /return/gi,
      /throw/gi,
      /try\s*\{/gi,
      /catch\s*\(/gi
    ],
    keywords: ['if', 'else', 'loop', 'condition', 'switch', 'case', 'return', 'flow', 'process'],
    scoreWeight: 1.0
  }
];

// API Provider configurations
const API_PROVIDERS: APIProvider[] = [
  {
    name: 'github',
    endpoint: 'https://models.inference.ai.azure.com/chat/completions',
    model: 'gpt-4o',
    headers: (token) => ({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }),
    buildBody: (prompt) => ({
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
    extractResponse: (data) => data.choices?.[0]?.message?.content || ''
  },
  {
    name: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4',
    headers: (token) => ({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }),
    buildBody: (prompt) => ({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in creating comprehensive, accurate Mermaid diagrams from code analysis. Generate ONLY the diagram code - no explanations, no markdown blocks, just clean Mermaid syntax that accurately represents the code structure and flow.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.2
    }),
    extractResponse: (data) => data.choices?.[0]?.message?.content || ''
  },
  {
    name: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-haiku-20240307',
    headers: (token) => ({
      'x-api-key': token,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    }),
    buildBody: (prompt) => ({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Generate ONLY a valid Mermaid diagram based on this code analysis. No explanations, just the diagram code.\n\n${prompt}`
        }
      ]
    }),
    extractResponse: (data) => data.content?.[0]?.text || ''
  },
  {
    name: 'local',
    endpoint: 'http://localhost:11434/api/generate',
    model: 'codellama',
    headers: (token) => ({
      'Content-Type': 'application/json'
    }),
    buildBody: (prompt) => ({
      model: 'codellama',
      prompt: `Generate ONLY a valid Mermaid diagram based on this code analysis:\n\n${prompt}`,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 1500
      }
    }),
    extractResponse: (data) => data.response || ''
  }
];

// ============================================================================
// MAIN EXTENSION CLASS
// ============================================================================

export class CodeVisualizer {
  private cache = new Map<string, DiagramCache>();
  private pendingRequests = new Map<string, Promise<{ diagram: string; type: DiagramType }>>();
  private outputChannel: vscode.OutputChannel;
  private statusBarItem: vscode.StatusBarItem;
  private currentPanel: vscode.WebviewPanel | undefined;
  private decorationType: vscode.TextEditorDecorationType;
  private hoverTimeouts = new Map<string, NodeJS.Timeout>();
  private persistentCacheDir!: string;
  private cacheMetadata!: CacheMetadata;
  private lastCleanupTime: number = 0;
  private analyticsData = {
    diagramsGenerated: 0,
    mostUsedTypes: new Map<DiagramType, number>(),
    averageGenerationTime: 0,
    errorCount: 0
  };

  constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Code Visualizer');
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: ' 📊',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic'
      }
    });
    this.context.subscriptions.push(this.statusBarItem);
    this.initializePersistentCache();
    this.cleanupCache();
    this.loadAnalytics();
  }

  public activate(): void {
    // Register hover provider for all supported languages
    const hoverProvider = vscode.languages.registerHoverProvider(
      SUPPORTED_LANGUAGES,
      {
        provideHover: (doc, pos, token) => this.provideHover(doc, pos, token)
      }
    );

    // Register commands
    const showDiagramCmd = vscode.commands.registerCommand(
      'codeVisualizer.showDiagram',
      () => this.showDiagramCommand()
    );

    const showPanelCmd = vscode.commands.registerCommand(
      'codeVisualizer.showDiagramPanel',
      () => this.showDiagramPanelCommand()
    );

    const storeTokenCmd = vscode.commands.registerCommand(
      'codeVisualizer.storeApiToken',
      () => this.storeApiToken()
    );

    const clearCacheCmd = vscode.commands.registerCommand(
      'codeVisualizer.clearCache',
      async () => await this.clearCache()
    );

    const showAnalyticsCmd = vscode.commands.registerCommand(
      'codeVisualizer.showAnalytics',
      () => this.showAnalytics()
    );

    const exportDiagramCmd = vscode.commands.registerCommand(
      'codeVisualizer.exportDiagram',
      () => this.exportCurrentDiagram()
    );

    const configureDiagramTypeCmd = vscode.commands.registerCommand(
      'codeVisualizer.configureDiagramType',
      () => this.configureDiagramType()
    );

    // Register editor change listener for decorations
    const onDidChangeEditor = vscode.window.onDidChangeActiveTextEditor(
      editor => this.updateDecorations(editor)
    );

    // Add to subscriptions
    this.context.subscriptions.push(
      hoverProvider,
      showDiagramCmd,
      showPanelCmd,
      storeTokenCmd,
      clearCacheCmd,
      showAnalyticsCmd,
      exportDiagramCmd,
      configureDiagramTypeCmd,
      onDidChangeEditor
    );

    this.outputChannel.appendLine('Code Visualizer activated successfully');
    this.updateDecorations(vscode.window.activeTextEditor);
  }

  // ============================================================================
  // CODE ANALYSIS & DIAGRAM TYPE SELECTION
  // ============================================================================

  private analyzeCode(code: string, language: string): CodeAnalysis {
    const analysis: CodeAnalysis = {
      hasApiCalls: false,
      hasStateManagement: false,
      hasClassDefinition: false,
      hasAsyncOperations: false,
      hasEventHandlers: false,
      hasDataFlow: false,
      hasUserInteraction: false,
      hasComplexConditions: false,
      hasLoops: false,
      hasErrorHandling: false,
      hasDatabaseOperations: false,
      isStateMachine: false,
      isClassHierarchy: false,
      isSequentialProcess: false,
      isEntityRelationship: false,
      complexity: 'simple'
    };

    // Enhanced pattern detection with language-specific patterns
    const languagePatterns = this.getLanguageSpecificPatterns(language);
    
    // Check for various patterns with enhanced detection
    analysis.hasApiCalls = this.testPatterns(code, [
      ...languagePatterns.api,
      /fetch\s*\(|axios\.|XMLHttpRequest|\$\.ajax|\.get\(|\.post\(|\.put\(|\.delete\(/gi,
      /HttpClient|RestTemplate|retrofit|okhttp|urllib|requests/gi
    ]);
    
    analysis.hasStateManagement = this.testPatterns(code, [
      ...languagePatterns.state,
      /state\s*[=:]|setState|this\.state|useState|useReducer|store\.|dispatch\(/gi,
      /vuex|redux|mobx|ngrx|bloc|provider/gi
    ]);
    
    analysis.hasClassDefinition = this.testPatterns(code, [
      ...languagePatterns.class,
      /class\s+\w+|interface\s+\w+|extends\s+|implements\s+|struct\s+|trait\s+/gi
    ]);
    
    analysis.hasAsyncOperations = this.testPatterns(code, [
      ...languagePatterns.async,
      /async\s+|await\s+|Promise|\.then\(|\.catch\(|coroutine|goroutine|thread/gi
    ]);
    
    analysis.hasEventHandlers = this.testPatterns(code, [
      /on[A-Z]\w+|addEventListener|emit\(|on\(|observer|listener|delegate/gi
    ]);
    
    analysis.hasDataFlow = this.testPatterns(code, [
      /pipe\(|map\(|filter\(|reduce\(|transform|stream|flow|observable/gi
    ]);
    
    analysis.hasUserInteraction = this.testPatterns(code, [
      /onClick|onSubmit|handleClick|handleSubmit|onPress|onTap|button|input|form/gi
    ]);
    
    // Enhanced complexity analysis
    const conditionCount = this.countPatterns(code, /if\s*\(|switch\s*\(|\?.*:|case\s+/g);
    const loopCount = this.countPatterns(code, /for\s*\(|while\s*\(|do\s*\{|forEach|map\(|filter\(/g);
    const functionCount = this.countPatterns(code, /function\s+\w+|=>\s*\{|async\s+\w+|def\s+\w+|func\s+\w+/g);
    
    analysis.hasComplexConditions = conditionCount > 3;
    analysis.hasLoops = loopCount > 0;
    analysis.hasErrorHandling = this.testPatterns(code, [
      /try\s*\{|catch\s*\(|throw\s+|Error\(|except|rescue|panic/gi
    ]);
    
    analysis.hasDatabaseOperations = this.testPatterns(code, [
      /SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|JOIN|\.find\(|\.save\(|\.create\(/gi,
      /mongoose|sequelize|typeorm|prisma|hibernate|room|core_data/gi
    ]);

    // Determine specific patterns with improved detection
    analysis.isStateMachine = this.testPatterns(code, [
      /state machine|finite state|FSM|transition.*state|currentState|nextState|workflow/gi
    ]);
    
    analysis.isClassHierarchy = analysis.hasClassDefinition && this.testPatterns(code, [
      /extends|implements|abstract|override|virtual|inherit|super|base/gi
    ]);
    
    analysis.isSequentialProcess = this.testPatterns(code, [
      /step\d|phase\d|stage\d|first.*then.*finally|pipeline|workflow/gi
    ]);
    
    analysis.isEntityRelationship = this.testPatterns(code, [
      /entity|model|schema|table|foreign key|primary key|relationship|association/gi
    ]);

    // Enhanced complexity calculation
    const lineCount = code.split('\n').length;
    const complexityScore = lineCount * 0.1 + conditionCount * 2 + loopCount * 1.5 + functionCount * 1;
    
    if (complexityScore > 50 || lineCount > 150) {
      analysis.complexity = 'complex';
    } else if (complexityScore > 20 || lineCount > 50) {
      analysis.complexity = 'moderate';
    }

    return analysis;
  }

  private getLanguageSpecificPatterns(language: string): {
    api: RegExp[],
    state: RegExp[],
    class: RegExp[],
    async: RegExp[]
  } {
    const patterns = {
      api: [] as RegExp[],
      state: [] as RegExp[],
      class: [] as RegExp[],
      async: [] as RegExp[]
    };

    switch (language) {
      case 'javascript':
      case 'typescript':
        patterns.api.push(/fetch|axios|XMLHttpRequest/gi);
        patterns.state.push(/useState|useReducer|setState/gi);
        patterns.async.push(/async|await|Promise|\.then/gi);
        break;
      case 'python':
        patterns.api.push(/requests|urllib|httpx/gi);
        patterns.async.push(/async def|await|asyncio/gi);
        break;
      case 'java':
        patterns.api.push(/HttpClient|RestTemplate|OkHttp/gi);
        patterns.async.push(/CompletableFuture|@Async/gi);
        break;
      case 'csharp':
        patterns.api.push(/HttpClient|WebClient|RestSharp/gi);
        patterns.async.push(/async Task|await/gi);
        break;
      case 'go':
        patterns.api.push(/http\.Get|http\.Post|net\/http/gi);
        patterns.async.push(/go func|goroutine|channel/gi);
        break;
      case 'rust':
        patterns.api.push(/reqwest|hyper|curl/gi);
        patterns.async.push(/async fn|await|tokio/gi);
        break;
    }

    return patterns;
  }

  private testPatterns(code: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(code));
  }

  private countPatterns(code: string, pattern: RegExp): number {
    const matches = code.match(pattern);
    return matches ? matches.length : 0;
  }

  private selectBestDiagramType(code: string, language: string): DiagramType {
    const analysis = this.analyzeCodeForDiagramGeneration(code);
    const languageContext = this.detectLanguageContext(code);
    const scores = new Map<DiagramType, number>();

    // Calculate scores for each diagram type
    for (const config of DIAGRAM_TYPES) {
      let score = 0;

      // Check pattern matches
      for (const pattern of config.patterns) {
        const matches = code.match(pattern);
        if (matches) {
          score += matches.length * config.scoreWeight;
        }
      }

      // Check keyword presence
      const codeLower = code.toLowerCase();
      for (const keyword of config.keywords) {
        if (codeLower.includes(keyword)) {
          score += config.scoreWeight * 0.5;
        }
      }

      // Enhanced analysis-based bonuses with comprehensive scoring
      if (config.type === 'sequence') {
        if (analysis.hasApiCalls) score += 60;
        if (analysis.hasAsyncOperations) score += 50;
        if (languageContext.patterns.includes('REST API')) score += 40;
        if (analysis.hasEventHandlers) score += 30;
      }
      
      if (config.type === 'stateDiagram') {
        if (analysis.hasStateManagement) score += 70;
        if (analysis.isStateMachine) score += 80;
        if (languageContext.patterns.includes('React Hooks')) score += 40;
      }
      
      if (config.type === 'classDiagram') {
        if (analysis.hasClassDefinition) score += 70;
        if (analysis.isClassHierarchy) score += 80;
        if (languageContext.patterns.includes('Inheritance')) score += 50;
        if (languageContext.patterns.includes('Interfaces')) score += 40;
      }
      
      if (config.type === 'erDiagram') {
        if (analysis.hasDatabaseOperations) score += 80;
        if (analysis.isEntityRelationship) score += 70;
        if (languageContext.language === 'sql') score += 60;
      }
      
      if (config.type === 'journey') {
        if (analysis.hasUserInteraction) score += 60;
        if (languageContext.framework === 'React') score += 30;
        if (languageContext.framework === 'Vue.js') score += 30;
      }
      
      if (config.type === 'flowchart') {
        if (analysis.hasComplexConditions) score += 40;
        if (analysis.hasLoops) score += 30;
        if (analysis.hasErrorHandling) score += 25;
        if (analysis.complexity === 'complex') score += 35;
      }
      
      if (config.type === 'timeline') {
        if (analysis.isSequentialProcess) score += 70;
        if (languageContext.patterns.includes('Async/Await')) score += 30;
      }
      
      if (config.type === 'mindmap') {
        if (analysis.hasDataFlow) score += 50;
        if (analysis.complexity === 'complex') score += 30;
      }

      // Language-specific bonuses
      if (languageContext.language === 'python' && config.type === 'flowchart') score += 10;
      if (languageContext.language === 'javascript' && config.type === 'sequence') score += 15;
      if (languageContext.language === 'java' && config.type === 'classDiagram') score += 15;

      scores.set(config.type, score);
    }

    // Find the highest scoring diagram type
    let bestType: DiagramType = 'flowchart';
    let highestScore = 0;

    for (const [type, score] of scores.entries()) {
      if (score > highestScore) {
        highestScore = score;
        bestType = type;
      }
    }

    // Enhanced logging for debugging
    const analysisInfo = {
      complexity: analysis.complexity,
      language: languageContext.language,
      framework: languageContext.framework,
      patterns: languageContext.patterns,
      features: this.formatCodeAnalysis(analysis)
    };
    
    this.logInfo(`Selected diagram type: ${bestType} (score: ${highestScore})`);
    this.logInfo(`Analysis: ${JSON.stringify(analysisInfo)}`);
    
    // Log top 3 scoring types for insight
    const sortedScores = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    this.logInfo(`Top diagram scores: ${sortedScores.map(([type, score]) => `${type}:${score}`).join(', ')}`);

    return bestType;
  }

  private getDiagramConfig(type: DiagramType): DiagramTypeConfig {
    return DIAGRAM_TYPES.find(d => d.type === type) || DIAGRAM_TYPES[DIAGRAM_TYPES.length - 1];
  }

  // ============================================================================
  // HOVER PROVIDER - CLEAN VISUALIZATION ONLY
  // ============================================================================

  private async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const config = vscode.workspace.getConfiguration('codeVisualizer');
    if (!config.get<boolean>('enableHover', true)) {
      return undefined;
    }

    // Debounce hover requests
    const key = `${document.uri.toString()}-${position.line}-${position.character}`;
    if (this.hoverTimeouts.has(key)) {
      clearTimeout(this.hoverTimeouts.get(key)!);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        this.hoverTimeouts.delete(key);
        resolve(await this.processHoverRequest(document, position, token));
      }, DEBOUNCE_DELAY);
      
      this.hoverTimeouts.set(key, timeout);
    });
  }

  private async processHoverRequest(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const functionInfo = this.extractFunctionAtPosition(document, position);
    if (!functionInfo || functionInfo.code.length > MAX_CODE_SIZE) {
      return undefined;
    }
    
    // Enhanced logging for debugging method vs class detection
    this.logInfo(`Hover detected: ${functionInfo.type} '${functionInfo.name}' (${functionInfo.code.length} chars)`);

    const hash = this.hashCode(functionInfo.code);
    
    // Check cache first
    const cached = this.getFromCache(hash);
    if (cached) {
      return this.createCleanHover(cached.diagram, cached.diagramType);
    }

    // Check if already generating
    if (this.pendingRequests.has(hash)) {
      try {
        const result = await this.pendingRequests.get(hash)!;
        return this.createCleanHover(result.diagram, result.type);
      } catch (error) {
        return new vscode.Hover('❌ Diagram generation failed');
      }
    }

    // Start async generation
    const promise = this.generateDiagramWithRetry(functionInfo.code, functionInfo.language, hash, functionInfo);
    this.pendingRequests.set(hash, promise);

    promise.then(result => {
      this.pendingRequests.delete(hash);
      this.updateAnalytics(result.type, true);
      this.showNotification(`Diagram ready! Hover again to view.`, 'info');
    }).catch(error => {
      this.pendingRequests.delete(hash);
      this.updateAnalytics('flowchart', false);
      this.logError('Diagram generation failed', error);
    });

    // Return minimal loading message
    return new vscode.Hover(
      new vscode.MarkdownString(`⏳ **Generating visualization...** \n\nHover again in a moment.`)
    );
  }

  private createCleanHover(diagram: string, diagramType: DiagramType): vscode.Hover {
    const markdown = new vscode.MarkdownString();
    markdown.supportHtml = true;
    markdown.isTrusted = true;
    
    // Only show the diagram visualization, no code or technical details
    const content = `\`\`\`mermaid
${diagram}
\`\`\`

*💡 Press \`Cmd+Shift+D\` for interactive view with zoom/pan controls*`;
    
    markdown.appendMarkdown(content);
    return new vscode.Hover(markdown);
  }

  // ============================================================================
  // FUNCTION EXTRACTION (SAME AS BEFORE BUT WITH LANGUAGE INFO)
  // ============================================================================

  private extractFunctionAtPosition(document: vscode.TextDocument, position: vscode.Position): FunctionInfo | null {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const language = document.languageId;
    
    let baseInfo: FunctionInfo | null = null;
    
    switch (language) {
      case 'javascript':
        baseInfo = this.extractJavaScriptFunction(text, offset, document);
        break;
      case 'typescript':
        baseInfo = this.extractJavaScriptFunction(text, offset, document);
        break;
      case 'python':
        baseInfo = this.extractPythonFunction(text, offset, document);
        break;
      case 'csharp':
        baseInfo = this.extractCSharpFunction(text, offset, document);
        break;
      case 'java':
        baseInfo = this.extractJavaFunction(text, offset, document);
        break;
      case 'go':
        baseInfo = this.extractGoFunction(text, offset, document);
        break;
      case 'rust':
        baseInfo = this.extractRustFunction(text, offset, document);
        break;
      case 'cpp':
      case 'c':
        baseInfo = this.extractCppFunction(text, offset, document);
        break;
      case 'kotlin':
        baseInfo = this.extractKotlinFunction(text, offset, document);
        break;
      case 'swift':
        baseInfo = this.extractSwiftFunction(text, offset, document);
        break;
      case 'php':
        baseInfo = this.extractPhpFunction(text, offset, document);
        break;
      default:
        baseInfo = this.extractGenericFunction(text, offset, document);
    }
    
    if (baseInfo) {
      baseInfo.language = language;
    }
    
    return baseInfo;
  }

  private extractJavaScriptFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // PRIORITY 1: Check for individual methods/functions at exact position first
    const methodResult = this.extractMethodAtPosition(text, offset, document, 'javascript');
    if (methodResult) {
      return methodResult;
    }
    
    // PRIORITY 2: Check if we're in a class (only if no method found)
    const classPattern = /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,]+)?\s*\{/g;
    let classMatch;
    while ((classMatch = classPattern.exec(text)) !== null) {
      const classStart = classMatch.index;
      const classEnd = this.findBlockEnd(text, classStart);
      
      if (offset >= classStart && offset <= classEnd) {
        // Return the entire class only if no method was found
        const code = text.substring(classStart, classEnd + 1);
        return {
          code,
          name: classMatch[1],
          type: 'class',
          startLine: document.positionAt(classStart).line,
          endLine: document.positionAt(classEnd).line,
          language: 'javascript'
        };
      }
    }
    
    // Function patterns
    const patterns = [
      /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*[{(]/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\w+)\s*=>\s*[{(]/g,
      /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
      /(\w+)\s*:\s*(?:async\s+)?(?:function\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*(?:=>)?\s*\{/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        const functionName = match[1] || 'anonymous';
        const functionEnd = this.findBlockEnd(text, start);
        
        if (functionEnd === -1) continue;
        
        if (offset >= start && offset <= functionEnd) {
          const code = text.substring(start, functionEnd + 1);
          const startLine = document.positionAt(start).line;
          const endLine = document.positionAt(functionEnd).line;
          
          const isAsync = /async\s+/.test(code.substring(0, 50));
          const isArrow = /=>/.test(code.substring(0, 100));
          const isMethod = /^\s*(\w+)\s*\(/.test(code) && !/(function|const|let|var)/.test(code.substring(0, 50));
          
          return {
            code,
            name: functionName,
            type: isAsync ? 'async' : isArrow ? 'arrow' : isMethod ? 'method' : 'function',
            startLine,
            endLine,
            language: 'javascript'
          };
        }
      }
    }
    
    return null;
  }

  private extractMethodAtPosition(text: string, offset: number, document: vscode.TextDocument, language: string): FunctionInfo | null {
    // Enhanced method detection that works within classes and standalone
    let patterns: RegExp[] = [];
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        patterns = [
          // Class methods (including async, static, private)
          /((?:static\s+)?(?:async\s+)?(?:private\s+|protected\s+|public\s+)?)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
          // Arrow functions
          /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*[{(]/g,
          // Function declarations
          /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
          // Object methods
          /(\w+)\s*:\s*(?:async\s+)?(?:function\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*(?:=>)?\s*\{/g,
        ];
        break;
      case 'python':
        patterns = [
          // Python methods and functions
          /def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/g,
        ];
        break;
      case 'java':
      case 'csharp':
        patterns = [
          // Java/C# methods
          /((?:public|private|protected|static|final|abstract|override)\s+)*\w+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*\{/g,
        ];
        break;
      default:
        patterns = [
          // Generic function patterns
          /(?:function\s+)?(\w+)\s*\([^)]*\)\s*\{/g,
        ];
    }

    // Find the most specific (smallest) method that contains the offset
    let bestMatch: { start: number; end: number; name: string; code: string; type: string } | null = null;
    let smallestSize = Infinity;

    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      
      while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        const functionEnd = this.findBlockEnd(text, start);
        
        if (functionEnd === -1) continue;
        
        // Check if cursor is within this method
        if (offset >= start && offset <= functionEnd) {
          const size = functionEnd - start;
          
          // Prefer the smallest enclosing method (most specific)
          if (size < smallestSize) {
            const functionName = this.extractFunctionName(match, language);
            const code = text.substring(start, functionEnd + 1);
            const methodType = this.determineMethodType(code, language);
            
            bestMatch = {
              start,
              end: functionEnd,
              name: functionName,
              code,
              type: methodType
            };
            smallestSize = size;
          }
        }
      }
    }

    if (bestMatch) {
      return {
        code: bestMatch.code,
        name: bestMatch.name,
        type: bestMatch.type as 'function' | 'arrow' | 'method' | 'async' | 'generator' | 'class' | 'module',
        startLine: document.positionAt(bestMatch.start).line,
        endLine: document.positionAt(bestMatch.end).line,
        language
      };
    }

    return null;
  }

  private extractFunctionName(match: RegExpExecArray, language: string): string {
    // Extract function name based on language and pattern
    if (language === 'javascript' || language === 'typescript') {
      // Try different capture groups based on pattern
      return match[2] || match[1] || 'anonymous';
    } else if (language === 'python') {
      return match[1] || 'unnamed';
    } else {
      return match[1] || match[2] || 'function';
    }
  }

  private determineMethodType(code: string, language: string): string {
    const first50 = code.substring(0, 100).toLowerCase();
    
    if (first50.includes('async')) return 'async';
    if (first50.includes('=>')) return 'arrow';
    if (first50.includes('static')) return 'method';
    if (first50.includes('function*') || first50.includes('*')) return 'generator';
    
    // Check if it's inside a class (basic heuristic)
    if (first50.match(/^\s*\w+\s*\(/)) return 'method';
    
    return 'function';
  }

  private extractPythonFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // PRIORITY 1: Check for individual methods/functions at exact position first
    const methodResult = this.extractMethodAtPosition(text, offset, document, 'python');
    if (methodResult) {
      return methodResult;
    }
    
    // PRIORITY 2: Fall back to class detection if no method found
    const lines = text.split('\n');
    const position = document.positionAt(offset);
    const currentLine = position.line;
    
    // Check for class definition
    let classStart = currentLine;
    while (classStart >= 0) {
      const line = lines[classStart];
      if (/^\s*class\s+(\w+)/.test(line)) {
        const match = line.match(/^\s*class\s+(\w+)/);
        if (match) {
          const className = match[1];
          const indent = line.match(/^\s*/)?.[0].length || 0;
          
          // Find the end of the class
          let classEnd = classStart + 1;
          while (classEnd < lines.length) {
            const endLine = lines[classEnd];
            if (endLine.trim() === '') {
              classEnd++;
              continue;
            }
            const currentIndent = endLine.match(/^\s*/)?.[0].length || 0;
            if (currentIndent <= indent && endLine.trim() !== '') {
              break;
            }
            classEnd++;
          }
          
          const code = lines.slice(classStart, classEnd).join('\n');
          return {
            code,
            name: className,
            type: 'class',
            startLine: classStart,
            endLine: classEnd - 1,
            language: 'python'
          };
        }
      }
      classStart--;
    }
    
    // Find function definition
    let functionStart = currentLine;
    while (functionStart >= 0) {
      const line = lines[functionStart];
      if (/^\s*(async\s+)?def\s+(\w+)/.test(line)) {
        break;
      }
      functionStart--;
    }
    
    if (functionStart < 0) return null;
    
    const match = lines[functionStart].match(/^\s*(async\s+)?def\s+(\w+)/);
    if (!match) return null;
    
    const functionName = match[2];
    const isAsync = !!match[1];
    const indent = lines[functionStart].match(/^\s*/)?.[0].length || 0;
    
    let functionEnd = functionStart + 1;
    while (functionEnd < lines.length) {
      const line = lines[functionEnd];
      if (line.trim() === '') {
        functionEnd++;
        continue;
      }
      const currentIndent = line.match(/^\s*/)?.[0].length || 0;
      if (currentIndent <= indent && line.trim() !== '') {
        break;
      }
      functionEnd++;
    }
    
    const code = lines.slice(functionStart, functionEnd).join('\n');
    
    return {
      code,
      name: functionName,
      type: isAsync ? 'async' : 'function',
      startLine: functionStart,
      endLine: functionEnd - 1,
      language: 'python'
    };
  }

  private extractCSharpFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // PRIORITY 1: Check for individual methods first
    const methodResult = this.extractMethodAtPosition(text, offset, document, 'csharp');
    if (methodResult) {
      return methodResult;
    }
    
    // PRIORITY 2: Check for class (only if no method found)
    const classPattern = /(?:public|private|protected|internal|abstract|sealed|static)*\s*(?:partial\s+)?class\s+(\w+)(?:\s*:\s*[\w\s,]+)?\s*\{/g;
    let classMatch;
    while ((classMatch = classPattern.exec(text)) !== null) {
      const start = classMatch.index;
      const end = this.findBlockEnd(text, start);
      
      if (offset >= start && offset <= end) {
        const code = text.substring(start, end + 1);
        return {
          code,
          name: classMatch[1],
          type: 'class',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(end).line,
          language: 'csharp'
        };
      }
    }
    
    // Method pattern
    const pattern = /(?:public|private|protected|internal|static|async|override|virtual|abstract|sealed|extern|partial)*\s*(?:async\s+)?(?:(?:void|Task|Task<[^>]+>|[\w<>[\],\s]+)\s+)?(\w+)\s*\([^)]*\)\s*(?:where\s+\w+\s*:\s*[\w\s,]+)?\s*\{/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const functionName = match[1];
      const functionEnd = this.findBlockEnd(text, start);
      
      if (functionEnd === -1) continue;
      
      if (offset >= start && offset <= functionEnd) {
        const code = text.substring(start, functionEnd + 1);
        const isAsync = /async\s+/.test(code.substring(0, 100));
        
        return {
          code,
          name: functionName,
          type: isAsync ? 'async' : 'method',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(functionEnd).line,
          language: 'csharp'
        };
      }
    }
    
    return null;
  }

  private extractJavaFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // Check for class/interface first
    const classPattern = /(?:public|private|protected|abstract|final)*\s*(?:class|interface)\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,]+)?\s*\{/g;
    let classMatch;
    while ((classMatch = classPattern.exec(text)) !== null) {
      const start = classMatch.index;
      const end = this.findBlockEnd(text, start);
      
      if (offset >= start && offset <= end) {
        const code = text.substring(start, end + 1);
        return {
          code,
          name: classMatch[1],
          type: 'class',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(end).line,
          language: 'java'
        };
      }
    }
    
    const pattern = /(?:public|private|protected|static|final|synchronized|native|abstract)*\s*(?:<[\w\s,?]+>\s+)?(?:void|[\w<>[\],\s]+)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*\{/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const functionName = match[1];
      const functionEnd = this.findBlockEnd(text, start);
      
      if (functionEnd === -1) continue;
      
      if (offset >= start && offset <= functionEnd) {
        const code = text.substring(start, functionEnd + 1);
        
        return {
          code,
          name: functionName,
          type: 'method',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(functionEnd).line,
          language: 'java'
        };
      }
    }
    
    return null;
  }

  private extractGoFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    const pattern = /func\s+(?:\(\s*\w+\s+[^)]+\)\s+)?(\w+)\s*\([^)]*\)\s*(?:\([^)]*\)|\w+)?\s*\{/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const functionName = match[1];
      const functionEnd = this.findBlockEnd(text, start);
      
      if (functionEnd === -1) continue;
      
      if (offset >= start && offset <= functionEnd) {
        const code = text.substring(start, functionEnd + 1);
        
        return {
          code,
          name: functionName,
          type: 'function',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(functionEnd).line,
          language: 'go'
        };
      }
    }
    
    return null;
  }

  private extractRustFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    const pattern = /(?:pub(?:\(\w+\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]+"\s+)?fn\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*(?:->\s*[^{]+)?\s*(?:where[^{]+)?\s*\{/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const functionName = match[1];
      const functionEnd = this.findBlockEnd(text, start);
      
      if (functionEnd === -1) continue;
      
      if (offset >= start && offset <= functionEnd) {
        const code = text.substring(start, functionEnd + 1);
        const isAsync = /async\s+fn/.test(code.substring(0, 100));
        
        return {
          code,
          name: functionName,
          type: isAsync ? 'async' : 'function',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(functionEnd).line,
          language: 'rust'
        };
      }
    }
    
    return null;
  }

  private extractGenericFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    const openBrace = text.lastIndexOf('{', offset);
    if (openBrace === -1) return null;
    
    const closeBrace = this.findBlockEnd(text, openBrace);
    if (closeBrace === -1) return null;
    
    if (offset >= openBrace && offset <= closeBrace) {
      const code = text.substring(openBrace, closeBrace + 1);
      
      return {
        code,
        name: 'function',
        type: 'function',
        startLine: document.positionAt(openBrace).line,
        endLine: document.positionAt(closeBrace).line,
        language: document.languageId
      };
    }
    
    return null;
  }

  private extractCppFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // Check for class first
    const classPattern = /(?:class|struct)\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+[\w\s,]+)?\s*\{/g;
    let classMatch;
    while ((classMatch = classPattern.exec(text)) !== null) {
      const start = classMatch.index;
      const end = this.findBlockEnd(text, start);
      
      if (offset >= start && offset <= end) {
        const code = text.substring(start, end + 1);
        return {
          code,
          name: classMatch[1],
          type: 'class',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(end).line,
          language: 'cpp'
        };
      }
    }
    
    // Function pattern for C++
    const functionPattern = /(?:inline\s+|static\s+|virtual\s+|explicit\s+)*(?:[\w:]+\s*[&*]*\s+)?(\w+)\s*\([^)]*\)\s*(?:const)?\s*(?:override)?\s*\{/g;
    
    let match;
    while ((match = functionPattern.exec(text)) !== null) {
      const start = match.index;
      const functionName = match[1];
      const functionEnd = this.findBlockEnd(text, start);
      
      if (functionEnd === -1) continue;
      
      if (offset >= start && offset <= functionEnd) {
        const code = text.substring(start, functionEnd + 1);
        
        return {
          code,
          name: functionName,
          type: 'function',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(functionEnd).line,
          language: 'cpp'
        };
      }
    }
    
    return null;
  }

  private extractKotlinFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // Check for class first
    const classPattern = /(?:data\s+|sealed\s+|abstract\s+|open\s+)?class\s+(\w+)(?:\s*:\s*[\w\s,()]+)?\s*\{/g;
    let classMatch;
    while ((classMatch = classPattern.exec(text)) !== null) {
      const start = classMatch.index;
      const end = this.findBlockEnd(text, start);
      
      if (offset >= start && offset <= end) {
        const code = text.substring(start, end + 1);
        return {
          code,
          name: classMatch[1],
          type: 'class',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(end).line,
          language: 'kotlin'
        };
      }
    }
    
    const pattern = /(?:suspend\s+)?fun\s+(?:<[^>]+>\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const functionName = match[1];
      const functionEnd = this.findBlockEnd(text, start);
      
      if (functionEnd === -1) continue;
      
      if (offset >= start && offset <= functionEnd) {
        const code = text.substring(start, functionEnd + 1);
        const isAsync = /suspend\s+fun/.test(code.substring(0, 50));
        
        return {
          code,
          name: functionName,
          type: isAsync ? 'async' : 'function',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(functionEnd).line,
          language: 'kotlin'
        };
      }
    }
    
    return null;
  }

  private extractSwiftFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // Check for class/struct first
    const classPattern = /(?:class|struct|enum)\s+(\w+)(?:\s*:\s*[\w\s,]+)?\s*\{/g;
    let classMatch;
    while ((classMatch = classPattern.exec(text)) !== null) {
      const start = classMatch.index;
      const end = this.findBlockEnd(text, start);
      
      if (offset >= start && offset <= end) {
        const code = text.substring(start, end + 1);
        return {
          code,
          name: classMatch[1],
          type: 'class',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(end).line,
          language: 'swift'
        };
      }
    }
    
    const pattern = /func\s+(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*(?:async\s+)?(?:throws\s+)?(?:->\s*[^{]+)?\s*\{/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const functionName = match[1];
      const functionEnd = this.findBlockEnd(text, start);
      
      if (functionEnd === -1) continue;
      
      if (offset >= start && offset <= functionEnd) {
        const code = text.substring(start, functionEnd + 1);
        const isAsync = /async\s+/.test(code);
        
        return {
          code,
          name: functionName,
          type: isAsync ? 'async' : 'function',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(functionEnd).line,
          language: 'swift'
        };
      }
    }
    
    return null;
  }

  private extractPhpFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // Check for class first
    const classPattern = /(?:abstract\s+|final\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,]+)?\s*\{/g;
    let classMatch;
    while ((classMatch = classPattern.exec(text)) !== null) {
      const start = classMatch.index;
      const end = this.findBlockEnd(text, start);
      
      if (offset >= start && offset <= end) {
        const code = text.substring(start, end + 1);
        return {
          code,
          name: classMatch[1],
          type: 'class',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(end).line,
          language: 'php'
        };
      }
    }
    
    const pattern = /(?:public\s+|private\s+|protected\s+|static\s+)*function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const functionName = match[1];
      const functionEnd = this.findBlockEnd(text, start);
      
      if (functionEnd === -1) continue;
      
      if (offset >= start && offset <= functionEnd) {
        const code = text.substring(start, functionEnd + 1);
        
        return {
          code,
          name: functionName,
          type: 'function',
          startLine: document.positionAt(start).line,
          endLine: document.positionAt(functionEnd).line,
          language: 'php'
        };
      }
    }
    
    return null;
  }

  private findBlockEnd(text: string, startPos: number): number {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let inComment = false;
    let inMultilineComment = false;
    
    for (let i = startPos; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (!inString) {
        if (char === '/' && nextChar === '/') {
          inComment = true;
        } else if (char === '/' && nextChar === '*') {
          inMultilineComment = true;
          i++;
          continue;
        } else if (inMultilineComment && char === '*' && nextChar === '/') {
          inMultilineComment = false;
          i++;
          continue;
        } else if (inComment && char === '\n') {
          inComment = false;
        }
      }
      
      if (inComment || inMultilineComment) continue;
      
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && text[i - 1] !== '\\') {
        inString = false;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return i;
        }
      }
    }
    
    return -1;
  }

  // ============================================================================
  // DIAGRAM GENERATION WITH INTELLIGENT TYPE SELECTION
  // ============================================================================

  private async generateDiagramWithRetry(
    code: string, 
    language: string, 
    hash: string, 
    functionInfo?: FunctionInfo,
    retryCount = 0
  ): Promise<{ diagram: string; type: DiagramType }> {
    const startTime = Date.now();
    
    try {
      this.updateStatus('Analyzing code structure...');
      
      // Select the best diagram type
      const diagramType = this.selectBestDiagramType(code, language);
      const diagramConfig = this.getDiagramConfig(diagramType);
      
      this.updateStatus(`Generating ${diagramConfig.name}...`);
      
      const token = await this.getApiToken();
      if (!token) {
        throw new Error('No API token configured. Please run "Code Visualizer: Configure API Token"');
      }

      // Try multiple providers with fallback
      const providers = this.getProviderFallbackChain();
      let lastError: Error | null = null;
      
      for (const provider of providers) {
        try {
          this.logInfo(`Attempting diagram generation with provider: ${provider.name}`);
          const diagram = await this.callAIProviderWithTimeout(provider, code, diagramConfig, token);
          
          if (!diagram || diagram.trim().length < 10) {
            throw new Error(`Empty or invalid response from ${provider.name}`);
          }

          const cleanedDiagram = this.cleanAndValidateDiagram(diagram, diagramType);
          const generationTime = Date.now() - startTime;
          
          this.logInfo(`Diagram generated successfully in ${generationTime}ms using ${provider.name}`);
          this.addToCache(hash, cleanedDiagram, diagramType, code, functionInfo);
          this.updateStatus('');
          
          // Update analytics with generation time
          this.analyticsData.averageGenerationTime = 
            (this.analyticsData.averageGenerationTime + generationTime) / 2;
          
          return { diagram: cleanedDiagram, type: diagramType };
          
        } catch (error: any) {
          lastError = error;
          this.logError(`Provider ${provider.name} failed`, error);
          continue; // Try next provider
        }
      }
      
      // All providers failed
      throw lastError || new Error('All API providers failed');
      
    } catch (error: any) {
      if (retryCount < MAX_RETRIES) {
        this.logInfo(`Retry attempt ${retryCount + 1} for diagram generation`);
        await this.delay(RETRY_DELAY * Math.pow(2, retryCount));
        return this.generateDiagramWithRetry(code, language, hash, functionInfo, retryCount + 1);
      }
      
      this.updateStatus('');
      this.logError('Diagram generation failed after all retries', error);
      throw this.createUserFriendlyError(error);
    }
  }

  private getProviderFallbackChain(): APIProvider[] {
    const config = vscode.workspace.getConfiguration('codeVisualizer');
    const primaryProvider = config.get<string>('provider', 'github');
    
    // Reorder providers to put primary first, then others as fallback
    const providers = [...API_PROVIDERS];
    const primaryIndex = providers.findIndex(p => p.name === primaryProvider);
    
    if (primaryIndex > 0) {
      const primary = providers.splice(primaryIndex, 1)[0];
      providers.unshift(primary);
    }
    
    return providers;
  }

  private async callAIProviderWithTimeout(
    provider: APIProvider, 
    code: string, 
    diagramConfig: DiagramTypeConfig,
    token: string
  ): Promise<string> {
    const prompt = this.buildEnhancedPrompt(code, diagramConfig);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout: ${provider.name} took longer than ${DIAGRAM_GENERATION_TIMEOUT}ms`)), DIAGRAM_GENERATION_TIMEOUT);
    });

    const fetchPromise = this.makeAPIRequest(provider, prompt, token);

    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`${provider.name} API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return provider.extractResponse(data);
  }

  private async makeAPIRequest(provider: APIProvider, prompt: string, token: string): Promise<Response> {
    const maxRetries = 2;
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fetch(provider.endpoint, {
          method: 'POST',
          headers: provider.headers(token),
          body: JSON.stringify(provider.buildBody(prompt))
        });
      } catch (error: any) {
        lastError = error;
        if (i < maxRetries) {
          await this.delay(1000 * (i + 1)); // Exponential backoff
        }
      }
    }
    
    throw lastError!;
  }

  private createUserFriendlyError(error: any): Error {
    const message = error.message || error.toString();
    
    if (message.includes('token') || message.includes('authentication') || message.includes('401')) {
      return new Error('Authentication failed. Please check your API token and try again.');
    }
    
    if (message.includes('rate limit') || message.includes('429')) {
      return new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    
    if (message.includes('timeout') || message.includes('ECONNRESET')) {
      return new Error('Network timeout. Please check your internet connection and try again.');
    }
    
    if (message.includes('quota') || message.includes('billing')) {
      return new Error('API quota exceeded. Please check your API account billing and limits.');
    }
    
    return new Error(`Diagram generation failed: ${message.substring(0, 100)}...`);
  }

  private buildEnhancedPrompt(code: string, diagramConfig: DiagramTypeConfig): string {
    const codeAnalysis = this.analyzeCodeForDiagramGeneration(code);
    const languageContext = this.detectLanguageContext(code);
    const complexityHints = this.getComplexityHints(codeAnalysis);
    
    return `You are an expert software architect creating visual documentation. ${diagramConfig.prompt}

## Code Context:
- Language: ${languageContext.language}
- Framework: ${languageContext.framework || 'Unknown'}
- Complexity: ${codeAnalysis.complexity}
- Key Patterns: ${languageContext.patterns.join(', ') || 'None detected'}

## Analysis Results:
${this.formatCodeAnalysis(codeAnalysis)}

## Instructions:
${complexityHints}
- Use clear, descriptive labels without quotes
- Include all significant control flows and data transformations
- Show error handling paths where present
- Highlight async operations and their dependencies
- Focus on business logic and key architectural decisions
${this.getDiagramSpecificInstructions(diagramConfig.type)}

## Code to Visualize:
\`\`\`${languageContext.language}
${code}
\`\`\`

Generate ONLY the ${diagramConfig.name} in valid Mermaid syntax. Ensure the diagram is comprehensive yet readable.`;
  }

  private cleanAndValidateDiagram(diagram: string, diagramType: DiagramType): string {
    // Extract mermaid diagram
    let cleaned = diagram;
    
    // Remove markdown code blocks if present
    cleaned = cleaned.replace(/```mermaid\n?/gi, '').replace(/```\n?/gi, '');
    
    // Only remove quotes if they cause syntax issues - be more conservative
    // Keep quotes that are valid Mermaid syntax
    
    // Clean up specific diagram types
    switch (diagramType) {
      case 'sequence':
        if (!cleaned.includes('sequenceDiagram')) {
          cleaned = 'sequenceDiagram\n' + cleaned;
        }
        // Fix sequence diagram syntax errors
        cleaned = this.fixSequenceDiagramSyntax(cleaned);
        break;
      case 'stateDiagram':
        if (!cleaned.includes('stateDiagram')) {
          cleaned = 'stateDiagram-v2\n' + cleaned;
        }
        break;
      case 'classDiagram':
        if (!cleaned.includes('classDiagram')) {
          cleaned = 'classDiagram\n' + cleaned;
        }
        // Fix common class diagram syntax errors
        cleaned = this.fixClassDiagramSyntax(cleaned);
        break;
      case 'erDiagram':
        if (!cleaned.includes('erDiagram')) {
          cleaned = 'erDiagram\n' + cleaned;
        }
        break;
      case 'journey':
        if (!cleaned.includes('journey')) {
          cleaned = 'journey\n' + cleaned;
        }
        // Fix journey diagram syntax
        cleaned = this.fixJourneyDiagramSyntax(cleaned);
        break;
      case 'flowchart':
        if (!cleaned.match(/flowchart\s+(TD|LR|BT|RL)/)) {
          cleaned = 'flowchart TD\n' + cleaned;
        }
        // Fix flowchart syntax errors
        cleaned = this.fixFlowchartSyntax(cleaned);
        break;
      case 'mindmap':
        if (!cleaned.includes('mindmap')) {
          cleaned = 'mindmap\n' + cleaned;
        }
        break;
      case 'timeline':
        if (!cleaned.includes('timeline')) {
          cleaned = 'timeline\n' + cleaned;
        }
        break;
      case 'gitGraph':
        if (!cleaned.includes('gitGraph')) {
          cleaned = 'gitGraph\n' + cleaned;
        }
        break;
      case 'quadrantChart':
        if (!cleaned.includes('quadrantChart')) {
          cleaned = 'quadrantChart\n' + cleaned;
        }
        break;
      case 'sankey':
        if (!cleaned.includes('sankey')) {
          cleaned = 'sankey-beta\n' + cleaned;
        }
        break;
      case 'block':
        if (!cleaned.includes('block')) {
          cleaned = 'block-beta\n' + cleaned;
        }
        break;
    }
    
    // REMOVED: destructive HTML tag cleaning that breaks valid Mermaid syntax
    // cleaned = cleaned.replace(/<[^>]+>/g, ''); // This breaks <<interface>>, <<abstract>>, etc.
    
    // Fix common syntax errors across all diagram types
    cleaned = this.fixCommonSyntaxErrors(cleaned);
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // Basic validation
    if (cleaned.length < 10) {
      throw new Error('Generated diagram is too short or invalid');
    }
    
    return cleaned;
  }

  private fixClassDiagramSyntax(diagram: string): string {
    let fixed = diagram;
    
    // Fix invalid class member syntax - move + and - inside class blocks
    // Replace pattern like: + method() or - field
    // With proper syntax inside class definitions
    
    // First, find and fix standalone + and - prefixed lines that should be inside classes
    const lines = fixed.split('\n');
    const fixedLines: string[] = [];
    let currentClass = '';
    let inClassDefinition = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this is a class definition
      const classMatch = line.match(/^class\s+(\w+)\s*\{?/);
      if (classMatch) {
        currentClass = classMatch[1];
        inClassDefinition = true;
        fixedLines.push(line.includes('{') ? line : `class ${currentClass} {`);
        continue;
      }
      
      // Check for end of class definition
      if (line === '}' && inClassDefinition) {
        fixedLines.push(line);
        inClassDefinition = false;
        currentClass = '';
        continue;
      }
      
      // Fix methods/fields with + or - prefixes outside of class definitions
      if (line.match(/^[+\-]\s*\w+/) && !inClassDefinition && currentClass) {
        // This should be inside the last class
        // Find the last class definition and add it there
        const lastClassIndex = fixedLines.map((line, index) => line.includes(`class ${currentClass}`) ? index : -1).filter(i => i !== -1).pop() ?? -1;
        if (lastClassIndex !== -1) {
          if (!fixedLines[lastClassIndex].includes('{')) {
            fixedLines[lastClassIndex] = `class ${currentClass} {`;
          }
          // Add the method/field inside the class
          fixedLines.push(`    ${line}`);
          continue;
        }
      }
      
      // Fix relationship syntax - replace incorrect --> with proper syntax
      if (line.includes('-->') && !line.includes('note')) {
        // For class diagrams, --> should usually be --|> for inheritance
        // or --* for composition, or --> for simple association
        const relationshipLine = line
          .replace(/\s*-->\s*([\w\s:]+)\s*:\s*Inherits/gi, ' --|> $1')
          .replace(/\s*-->\s*([\w\s:]+)\s*:\s*Uses/gi, ' --> $1 : uses')
          .replace(/\s*-->\s*([\w\s:]+)\s*:\s*Extends/gi, ' --|> $1')
          .replace(/\s*-->\s*([\w\s:]+)\s*:\s*Implements/gi, ' ..|> $1');
        fixedLines.push(relationshipLine);
        continue;
      }
      
      fixedLines.push(line);
    }
    
    // Ensure all class definitions that were opened are closed
    if (inClassDefinition) {
      fixedLines.push('}');
    }
    
    fixed = fixedLines.join('\n');
    
    // Additional fixes for common errors
    fixed = fixed
      // Fix multiple class declarations
      .replace(/class\s+(\w+)\s*class\s+(\w+)/gi, 'class $1\nclass $2')
      // Fix missing spaces in relationships
      .replace(/(\w+)(--[|>*]|\.\.\|>)(\w+)/g, '$1 $2 $3')
      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
    
    return fixed;
  }

  private fixFlowchartSyntax(diagram: string): string {
    let fixed = diagram;
    
    // Split into lines for processing
    const lines = fixed.split('\n');
    const fixedLines: string[] = [];
    const nodeIds = new Set<string>();
    const connections: string[] = [];
    let inSubgraph = false;
    let subgraphDepth = 0;
    
    // First pass: collect all node IDs and fix basic syntax
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('flowchart ')) {
        fixedLines.push(line);
        continue;
      }
      
      // Handle subgraphs
      if (line.startsWith('subgraph ')) {
        inSubgraph = true;
        subgraphDepth++;
        fixedLines.push(line);
        continue;
      }
      
      if (line === 'end' && inSubgraph) {
        subgraphDepth--;
        if (subgraphDepth === 0) {
          inSubgraph = false;
        }
        fixedLines.push(line);
        continue;
      }
      
      // Skip empty lines
      if (!line) {
        fixedLines.push(line);
        continue;
      }
      
      // Extract node definitions and connections
      if (line.includes('-->') || line.includes('---')) {
        // This is a connection line
        connections.push(line);
        
        // Extract node IDs from connection
        const matches = line.match(/(\w+)\s*-->\s*(\w+)/g);
        if (matches) {
          matches.forEach(match => {
            const parts = match.split('-->');
            if (parts.length === 2) {
              const fromNode = parts[0].trim();
              const toNode = parts[1].trim().split(/[\s\|:]/)[0]; // Handle conditions
              nodeIds.add(fromNode);
              nodeIds.add(toNode);
            }
          });
        }
      } else if (line.match(/^\s*\w+\[.*\]/) || line.match(/^\s*\w+\{.*\}/) || line.match(/^\s*\w+\(.*\)/)) {
        // This is a node definition
        const nodeMatch = line.match(/^\s*(\w+)/);
        if (nodeMatch) {
          nodeIds.add(nodeMatch[1]);
        }
        fixedLines.push(line);
      } else {
        // Other lines (might be malformed)
        fixedLines.push(line);
      }
    }
    
    // Second pass: validate and fix connections
    const validConnections: string[] = [];
    for (const connection of connections) {
      const matches = connection.match(/(\w+)\s*-->\s*(\w+)/g);
      if (matches) {
        matches.forEach(match => {
          const parts = match.split('-->');
          if (parts.length === 2) {
            const fromNode = parts[0].trim();
            let toNodePart = parts[1].trim();
            const toNode = toNodePart.split(/[\s\|:]/)[0];
            
            // Only add connection if both nodes exist
            if (nodeIds.has(fromNode) && nodeIds.has(toNode)) {
              // Reconstruct the full connection line
              const condition = toNodePart.includes('|') ? toNodePart.substring(toNodePart.indexOf('|')) : '';
              validConnections.push(`    ${fromNode} --> ${toNode}${condition}`);
            }
          }
        });
      }
    }
    
    // Remove invalid subgraph-to-subgraph connections - be more conservative
    const cleanedLines = fixedLines.filter(line => {
      // Only remove lines that are clearly malformed connections, not based on content
      // REMOVED: overly aggressive content-based filtering that could break valid diagrams
      return true; // Keep all lines for now
    });
    
    // Rebuild the diagram
    const finalLines = [];
    let addedConnections = false;
    
    for (const line of cleanedLines) {
      finalLines.push(line);
      
      // Add connections after the last subgraph ends
      if (line === 'end' && !addedConnections && validConnections.length > 0) {
        finalLines.push('');
        finalLines.push('    %% Valid connections');
        finalLines.push(...validConnections);
        addedConnections = true;
      }
    }
    
    // If no subgraphs, add connections at the end
    if (!addedConnections && validConnections.length > 0) {
      finalLines.push('');
      finalLines.push('    %% Connections');
      finalLines.push(...validConnections);
    }
    
    fixed = finalLines.join('\n');
    
    // Additional syntax fixes
    fixed = fixed
      // Remove duplicate flowchart declarations
      .replace(/^flowchart\s+TD\s*\n.*?^flowchart\s+TD/gm, 'flowchart TD')
      // Fix malformed node definitions
      .replace(/\[(.*?)\]\[(.*?)\]/g, '[$1 $2]')
      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
    
    return fixed;
  }

  private fixJourneyDiagramSyntax(diagram: string): string {
    let fixed = diagram;
    
    // Split into lines for processing
    const lines = fixed.split('\n');
    const fixedLines: string[] = [];
    let hasTitle = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        fixedLines.push('');
        continue;
      }
      
      // Check for journey declaration
      if (line === 'journey') {
        fixedLines.push(line);
        continue;
      }
      
      // Ensure there's a title
      if (line.startsWith('title ')) {
        hasTitle = true;
        fixedLines.push('    ' + line);
        continue;
      }
      
      // Handle sections
      if (line.startsWith('section ')) {
        fixedLines.push('    ' + line);
        continue;
      }
      
      // Handle journey entries (should have format: Task: Score: Emotion)
      if (line.includes(':') && !line.startsWith('section') && !line.startsWith('title')) {
        // Check if the line has the correct format
        const parts = line.split(':');
        if (parts.length >= 3) {
          // Format: Task: Score: Emotion
          const task = parts[0].trim();
          const score = parts[1].trim();
          const emotion = parts.slice(2).join(':').trim();
          
          // Validate score is a number between 1-5
          const scoreNum = parseInt(score);
          if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 5) {
            // Fix invalid score
            fixedLines.push(`      ${task}: 3: ${emotion}`);
          } else {
            fixedLines.push(`      ${task}: ${score}: ${emotion}`);
          }
        } else if (parts.length === 2) {
          // Missing emotion, add default
          const task = parts[0].trim();
          const score = parts[1].trim();
          const scoreNum = parseInt(score);
          const validScore = isNaN(scoreNum) || scoreNum < 1 || scoreNum > 5 ? 3 : scoreNum;
          fixedLines.push(`      ${task}: ${validScore}: Neutral`);
        } else {
          // Malformed line, add with defaults
          fixedLines.push(`      ${line}: 3: Neutral`);
        }
        continue;
      }
      
      // Other lines, preserve with proper indentation
      if (line && !line.startsWith(' ')) {
        fixedLines.push('    ' + line);
      } else {
        fixedLines.push(line);
      }
    }
    
    // Add title if missing
    if (!hasTitle && fixedLines.length > 1) {
      fixedLines.splice(1, 0, '    title User Journey');
    }
    
    fixed = fixedLines.join('\n');
    
    // Additional cleanup
    fixed = fixed
      // Remove extra spaces
      .replace(/\s{2,}/g, ' ')
      // Ensure proper line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
    
    return fixed;
  }

  private fixSequenceDiagramSyntax(diagram: string): string {
    let fixed = diagram;
    
    // Split into lines for processing
    const lines = fixed.split('\n');
    const fixedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Skip empty lines and diagram declaration
      if (!line.trim() || line.trim() === 'sequenceDiagram') {
        fixedLines.push(line);
        continue;
      }
      
      // Fix common sequence diagram syntax errors
      line = line
        // Fix invalid arrow syntax: --> > becomes ->>
        .replace(/-->\s*>/g, '->>')
        .replace(/->\s*>/g, '->>')
        // Fix double arrows that should be single
        .replace(/-->>/g, '->>')
        .replace(/-->/g, '->')
        // Fix spacing around arrows
        .replace(/\s*->>\s*/g, ' ->> ')
        .replace(/\s*->\s*/g, ' -> ')
        // Fix participant declarations
        .replace(/participant\s+(\w+)\s*:\s*/g, 'participant $1 as ')
        // Fix activate/deactivate syntax
        .replace(/activate\s+([^:\n]+):\s*/g, 'activate $1')
        .replace(/deactivate\s+([^:\n]+):\s*/g, 'deactivate $1')
        // Fix note syntax
        .replace(/Note\s+over\s+([^:]+):\s*/g, 'Note over $1: ')
        .replace(/Note\s+left\s+of\s+([^:]+):\s*/g, 'Note left of $1: ')
        .replace(/Note\s+right\s+of\s+([^:]+):\s*/g, 'Note right of $1: ')
        // Fix alt/else/end blocks
        .replace(/alt\s+([^:\n]+):\s*/g, 'alt $1')
        .replace(/else\s+([^:\n]+):\s*/g, 'else $1')
        // Remove invalid characters that cause INVALID token errors
        .replace(/[^\w\s\->>:(),.'"]/g, '')
        // Fix malformed message syntax
        .replace(/:\s*([^:\n]*)\s*\(/g, ': $1(')
        .replace(/\)\s*$/g, ')')
        // Clean up extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
      
      // Validate and fix participant names (must be valid identifiers)
      if (line.includes('participant ')) {
        line = line.replace(/participant\s+([^\s]+)/g, (match, name) => {
          // Ensure participant name is a valid identifier
          const cleanName = name.replace(/[^\w]/g, '');
          return `participant ${cleanName}`;
        });
      }
      
      // Validate message syntax: Participant -> Participant: Message
      if (line.includes('->') && !line.includes('participant') && !line.includes('Note') && !line.includes('activate') && !line.includes('deactivate')) {
        const messageMatch = line.match(/^\s*(\w+)\s*(->>?)\s*(\w+)\s*:\s*(.+)$/);
        if (messageMatch) {
          const [, from, arrow, to, message] = messageMatch;
          line = `    ${from} ${arrow} ${to}: ${message.trim()}`;
        } else if (line.includes('->') && line.includes(':')) {
          // Try to fix malformed message lines
          const parts = line.split(':');
          if (parts.length >= 2) {
            const arrowPart = parts[0].trim();
            const messagePart = parts.slice(1).join(':').trim();
            const arrowMatch = arrowPart.match(/(\w+)\s*(->>?)\s*(\w+)/);
            if (arrowMatch) {
              const [, from, arrow, to] = arrowMatch;
              line = `    ${from} ${arrow} ${to}: ${messagePart}`;
            }
          }
        }
      }
      
      fixedLines.push(line);
    }
    
    fixed = fixedLines.join('\n');
    
    // Final cleanup
    fixed = fixed
      // Remove empty lines between sequence elements
      .replace(/\n\s*\n(\s*(activate|deactivate|alt|else|end))/g, '\n$1')
      // Ensure proper indentation
      .replace(/^(\s*)(activate|deactivate|alt|else|end|Note)/gm, '    $2')
      .replace(/^(\s*)(\w+\s*->>?\s*\w+)/gm, '    $2')
      // Clean up multiple newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
    
    return fixed;
  }

  private fixCommonSyntaxErrors(diagram: string): string {
    let fixed = diagram;
    
    // Split into lines for processing
    const lines = fixed.split('\n');
    const fixedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Fix incomplete arrows - the main issue causing your syntax error
      if (line.match(/\w+\s*->\s*$/)) {
        // Line ends with incomplete arrow, try to fix it
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (nextLine && !nextLine.startsWith('--') && !nextLine.includes('->')) {
          // Next line might be the target, try to combine
          line = line.trim() + ' ' + nextLine;
          i++; // Skip the next line since we combined it
        } else {
          // Remove incomplete arrow
          line = line.replace(/\s*->\s*$/, '');
        }
      }
      
      // Fix other incomplete arrow patterns
      line = line
        // Remove trailing arrows with no target
        .replace(/\s*-->\s*$/, '')
        .replace(/\s*--->\s*$/, '')
        .replace(/\s*\.\.\>\s*$/, '')
        // Fix double arrows
        .replace(/-->\s*-->/g, '-->')
        .replace(/--->\s*--->/g, '-->')
        // Fix malformed arrow syntax
        .replace(/\s+->\s*->/g, ' -->')
        .replace(/\s*-\s*>/g, ' -->')
        // Clean up extra whitespace around arrows
        .replace(/\s*-->\s*/g, ' --> ')
        .replace(/\s*--->\s*/g, ' ---> ')
        // Fix common typos in arrow syntax
        .replace(/\s*-\s*-\s*>/g, ' -->')
        .replace(/\s*=\s*>/g, ' -->')
        // Remove lines that are just arrows with no content
        .replace(/^\s*-->\s*$/, '')
        .replace(/^\s*--->\s*$/, '');
      
      // Only add non-empty lines or lines that serve a purpose
      if (line.trim() || lines[i].trim() === '') {
        fixedLines.push(line);
      }
    }
    
    fixed = fixedLines.join('\n');
    
    // Additional cleanup
    fixed = fixed
      // Remove multiple consecutive empty lines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Remove trailing whitespace
      .replace(/[ \t]+$/gm, '')
      // Fix common label syntax issues
      .replace(/\[\s*\]/g, '')  // Remove empty labels
      .replace(/\(\s*\)/g, '')  // Remove empty parentheses
      .replace(/\{\s*\}/g, '')  // Remove empty braces
      // Ensure proper spacing around node definitions
      .replace(/(\w+)\[/g, '$1 [')
      .replace(/(\w+)\(/g, '$1 (')
      .replace(/(\w+)\{/g, '$1 {');
    
    return fixed;
  }

  // ============================================================================
  // ENHANCED CACHE MANAGEMENT WITH PERSISTENT STORAGE
  // ============================================================================

  private async initializePersistentCache(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      this.persistentCacheDir = vscode.Uri.joinPath(workspaceFolders[0].uri, PERSISTENT_CACHE_DIR).fsPath;
    } else {
      this.persistentCacheDir = vscode.Uri.joinPath(this.context.globalStorageUri, PERSISTENT_CACHE_DIR).fsPath;
    }

    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.persistentCacheDir));
      await this.loadCacheMetadata();
      await this.loadPersistentCache();
    } catch (error) {
      this.logError('Failed to initialize persistent cache:', error);
    }
  }

  private async loadCacheMetadata(): Promise<void> {
    const metadataPath = vscode.Uri.file(`${this.persistentCacheDir}/metadata.json`);
    try {
      const data = await vscode.workspace.fs.readFile(metadataPath);
      this.cacheMetadata = JSON.parse(data.toString());
    } catch {
      this.cacheMetadata = {
        version: CACHE_VERSION,
        totalEntries: 0,
        lastCleanup: Date.now(),
        cacheDirectory: this.persistentCacheDir,
        maxCacheSize: MAX_CACHE_SIZE
      };
    }
  }

  private async saveCacheMetadata(): Promise<void> {
    const metadataPath = vscode.Uri.file(`${this.persistentCacheDir}/metadata.json`);
    try {
      await vscode.workspace.fs.writeFile(metadataPath, Buffer.from(JSON.stringify(this.cacheMetadata, null, 2)));
    } catch (error) {
      this.logError('Failed to save cache metadata:', error);
    }
  }

  private async loadPersistentCache(): Promise<void> {
    try {
      const cacheIndexPath = vscode.Uri.file(`${this.persistentCacheDir}/cache-index.json`);
      const indexData = await vscode.workspace.fs.readFile(cacheIndexPath);
      const cacheIndex = JSON.parse(indexData.toString());
      
      for (const [hash, cacheInfo] of Object.entries(cacheIndex)) {
        if (Date.now() - (cacheInfo as any).timestamp < CACHE_TTL) {
          this.cache.set(hash, cacheInfo as DiagramCache);
        }
      }
    } catch {
      // Cache index doesn't exist yet
    }
  }

  private async savePersistentCache(): Promise<void> {
    try {
      const cacheIndex: Record<string, DiagramCache> = {};
      for (const [hash, cacheData] of this.cache.entries()) {
        if (cacheData.accessCount >= MAX_ACCESS_COUNT_FOR_PERSISTENCE) {
          cacheIndex[hash] = cacheData;
          
          // Save diagram and image files
          if (cacheData.diagram) {
            const diagramPath = vscode.Uri.file(`${this.persistentCacheDir}/${hash}.mmd`);
            await vscode.workspace.fs.writeFile(diagramPath, Buffer.from(cacheData.diagram));
            cacheData.mermaidFilePath = diagramPath.fsPath;
          }
        }
      }
      
      const cacheIndexPath = vscode.Uri.file(`${this.persistentCacheDir}/cache-index.json`);
      await vscode.workspace.fs.writeFile(cacheIndexPath, Buffer.from(JSON.stringify(cacheIndex, null, 2)));
      
      this.cacheMetadata.totalEntries = Object.keys(cacheIndex).length;
      await this.saveCacheMetadata();
    } catch (error) {
      this.logError('Failed to save persistent cache:', error);
    }
  }

  private addToCache(hash: string, diagram: string, diagramType: DiagramType, code: string, functionInfo?: FunctionInfo): void {
    const cacheEntry: DiagramCache = {
      diagram,
      diagramType,
      timestamp: Date.now(),
      codeHash: hash,
      filePath: functionInfo?.startLine ? vscode.window.activeTextEditor?.document.uri.fsPath : undefined,
      functionName: functionInfo?.name,
      language: functionInfo?.language,
      codeAnalysis: this.analyzeCodeForDiagramGeneration(code),
      lastAccessed: Date.now(),
      accessCount: 1
    };
    
    this.cache.set(hash, cacheEntry);
    
    if (this.cache.size > MAX_CACHE_SIZE) {
      this.cleanupCache();
    }
  }

  private getFromCache(hash: string): DiagramCache | null {
    const cached = this.cache.get(hash);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.cache.delete(hash);
      return null;
    }
    
    // Update access tracking
    cached.lastAccessed = Date.now();
    cached.accessCount = (cached.accessCount || 0) + 1;
    
    // Save frequently accessed items to persistent storage
    if (cached.accessCount >= MAX_ACCESS_COUNT_FOR_PERSISTENCE) {
      this.savePersistentCache().catch(error => this.logError('Failed to save persistent cache:', error));
    }
    
    return cached;
  }

  private cleanupCache(): void {
    const now = Date.now();
    
    // Regular TTL cleanup
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        this.cache.delete(hash);
      }
    }
    
    // Periodic comprehensive cleanup
    if (now - this.lastCleanupTime > CACHE_CLEANUP_INTERVAL) {
      this.performComprehensiveCleanup();
      this.lastCleanupTime = now;
    }
  }
  
  private async performComprehensiveCleanup(): Promise<void> {
    // Remove least accessed items if cache is too large
    if (this.cache.size > MAX_CACHE_SIZE * 0.8) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));
      
      const toRemove = sortedEntries.slice(0, Math.floor(this.cache.size * 0.2));
      for (const [hash] of toRemove) {
        this.cache.delete(hash);
      }
    }
    
    // Save current state
    await this.savePersistentCache();
  }

  private async clearCache(): Promise<void> {
    this.cache.clear();
    
    // Also clear persistent cache
    try {
      const cacheDir = vscode.Uri.file(this.persistentCacheDir);
      await vscode.workspace.fs.delete(cacheDir, { recursive: true, useTrash: false });
      await this.initializePersistentCache();
    } catch (error) {
      this.logError('Failed to clear persistent cache:', error);
    }
    
    this.showNotification('Cache cleared successfully', 'info');
  }

  // ============================================================================
  // ENHANCED CODE ANALYSIS FOR PROMPT GENERATION
  // ============================================================================

  private analyzeCodeForDiagramGeneration(code: string): CodeAnalysis {
    const analysis: CodeAnalysis = {
      hasApiCalls: /fetch\s*\(|axios\.|XMLHttpRequest|\$\.ajax/gi.test(code),
      hasStateManagement: /state\s*[=:]|setState|useState|useReducer|this\.state/gi.test(code),
      hasClassDefinition: /class\s+\w+|interface\s+\w+/gi.test(code),
      hasAsyncOperations: /async\s+|await\s+|\.then\s*\(|Promise/gi.test(code),
      hasEventHandlers: /onClick|onSubmit|addEventListener|emit\s*\(/gi.test(code),
      hasDataFlow: /pipe\s*\(|map\s*\(|filter\s*\(|reduce\s*\(/gi.test(code),
      hasUserInteraction: /input|button|form|click|submit/gi.test(code),
      hasComplexConditions: /(if|else|switch|case|\?|:).*\n.*\{/gi.test(code),
      hasLoops: /for\s*\(|while\s*\(|forEach|map\s*\(/gi.test(code),
      hasErrorHandling: /try\s*\{|catch\s*\(|throw\s+|finally\s*\{/gi.test(code),
      hasDatabaseOperations: /SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|\.find|\.save|\.create/gi.test(code),
      isStateMachine: /transition|currentState|FSM|FiniteStateMachine/gi.test(code),
      isClassHierarchy: /extends\s+\w+|implements\s+\w+|super\s*\(/gi.test(code),
      isSequentialProcess: /step\d+|stage\d+|phase\d+|pipeline/gi.test(code),
      isEntityRelationship: /JOIN\s+|FOREIGN\s+KEY|PRIMARY\s+KEY|belongsTo|hasMany/gi.test(code),
      complexity: this.determineComplexity(code)
    };
    
    return analysis;
  }

  private determineComplexity(code: string): 'simple' | 'moderate' | 'complex' {
    const lines = code.split('\n').length;
    const cyclomaticFactors = [
      /if\s*\(/gi, /else\s*if/gi, /while\s*\(/gi, /for\s*\(/gi,
      /switch\s*\(/gi, /case\s+/gi, /catch\s*\(/gi, /&&/gi, /\|\|/gi
    ];
    
    let complexity = 1; // Base complexity
    cyclomaticFactors.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    });
    
    if (lines < 20 && complexity < 5) return 'simple';
    if (lines < 50 && complexity < 15) return 'moderate';
    return 'complex';
  }

  private detectLanguageContext(code: string): { language: string; framework?: string; patterns: string[] } {
    const patterns = [];
    let language = 'javascript'; // default
    let framework;
    
    // Language detection
    if (/def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import/gi.test(code)) {
      language = 'python';
      if (/from\s+django|import\s+django/gi.test(code)) framework = 'Django';
      if (/from\s+flask|import\s+flask/gi.test(code)) framework = 'Flask';
      if (/from\s+fastapi|import\s+fastapi/gi.test(code)) framework = 'FastAPI';
    } else if (/public\s+class|private\s+\w+|public\s+static\s+void\s+main/gi.test(code)) {
      language = 'java';
      if (/@SpringBootApplication|@RestController/gi.test(code)) framework = 'Spring Boot';
    } else if (/using\s+System|public\s+class.*\{|namespace\s+\w+/gi.test(code)) {
      language = 'csharp';
      if (/\[ApiController\]|\[HttpGet\]/gi.test(code)) framework = '.NET Core API';
    } else if (/func\s+\w+\(|package\s+main|import\s+"\w+"/gi.test(code)) {
      language = 'go';
    } else if (/fn\s+\w+\(|use\s+std::|extern\s+crate/gi.test(code)) {
      language = 'rust';
    }
    
    // Framework/pattern detection for JavaScript/TypeScript
    if (language === 'javascript' || language === 'typescript') {
      if (/import.*react|from\s+['"]react|useEffect|useState/gi.test(code)) {
        framework = 'React';
        patterns.push('React Hooks', 'Component Lifecycle');
      }
      if (/import.*vue|from\s+['"]vue|defineComponent/gi.test(code)) {
        framework = 'Vue.js';
        patterns.push('Vue Composition API');
      }
      if (/@Component|@Injectable|import.*@angular/gi.test(code)) {
        framework = 'Angular';
        patterns.push('Dependency Injection', 'Decorators');
      }
      if (/express\(\)|app\.get|app\.post/gi.test(code)) {
        framework = 'Express.js';
        patterns.push('REST API', 'Middleware');
      }
    }
    
    // Common patterns
    if (/async\s+|await\s+|Promise/gi.test(code)) patterns.push('Async/Await');
    if (/class\s+\w+.*extends/gi.test(code)) patterns.push('Inheritance');
    if (/interface\s+\w+/gi.test(code)) patterns.push('Interfaces');
    if (/try\s*\{.*catch/gi.test(code)) patterns.push('Error Handling');
    
    return { language, framework, patterns };
  }

  private getComplexityHints(analysis: CodeAnalysis): string {
    const hints = [];
    
    if (analysis.complexity === 'complex') {
      hints.push('- Break down into logical sections and sub-processes');
      hints.push('- Use swimlanes or subgraphs to organize related components');
      hints.push('- Highlight the main flow path while showing alternatives');
    }
    
    if (analysis.hasAsyncOperations) {
      hints.push('- Clearly mark async operations with proper sequencing');
      hints.push('- Show parallel vs sequential execution paths');
    }
    
    if (analysis.hasErrorHandling) {
      hints.push('- Include error handling flows and exception paths');
    }
    
    if (analysis.hasStateManagement) {
      hints.push('- Show state transitions and data flow clearly');
    }
    
    if (analysis.hasApiCalls) {
      hints.push('- Represent external API calls and their responses');
      hints.push('- Show request/response cycles with proper actors');
    }
    
    return hints.length > 0 ? hints.join('\n') : '- Focus on clear, logical flow representation';
  }

  private formatCodeAnalysis(analysis: CodeAnalysis): string {
    const features = [];
    if (analysis.hasApiCalls) features.push('API Integration');
    if (analysis.hasStateManagement) features.push('State Management');
    if (analysis.hasAsyncOperations) features.push('Async Operations');
    if (analysis.hasErrorHandling) features.push('Error Handling');
    if (analysis.hasClassDefinition) features.push('Object-Oriented Design');
    if (analysis.hasDatabaseOperations) features.push('Database Operations');
    if (analysis.hasEventHandlers) features.push('Event Handling');
    if (analysis.hasUserInteraction) features.push('User Interface');
    
    return features.length > 0 ? features.join(', ') : 'Basic Logic Flow';
  }

  private getDiagramSpecificInstructions(diagramType: DiagramType): string {
    switch (diagramType) {
      case 'classDiagram':
        return `\n\n### Class Diagram Specific Rules:
- Use proper syntax: class ClassName { +publicMethod() -privateField }
- For inheritance: ChildClass --|> ParentClass
- For composition: ClassA --* ClassB
- For association: ClassA --> ClassB : label
- For interfaces: InterfaceName <|-- ImplementingClass
- NO + or - prefixes outside of class definitions
- All methods and fields must be inside class braces`;
      
      case 'sequence':
        return `\n\n### Sequence Diagram Specific Rules:
- Start with 'sequenceDiagram'
- Use participant names consistently
- Show activation boxes with activate/deactivate
- Include proper arrow types: -> for sync, ->> for async
- Add notes for important details`;
        
      case 'stateDiagram':
        return `\n\n### State Diagram Specific Rules:
- Start with 'stateDiagram-v2'
- Use [*] for start/end states
- Show state transitions with clear triggers
- Include guard conditions in brackets
- Use state1 --> state2 : trigger/action format`;
        
      case 'flowchart':
        return `\n\n### Flowchart Specific Rules:
- Start with direction: flowchart TD (or LR, BT, RL)
- Use clear node shapes: [] for processes, () for start/end, {} for decisions
- Label all decision branches clearly (|Yes|, |No|)
- Show error handling paths when present
- Use subgraphs for logical grouping: subgraph GroupName ... end
- NEVER connect subgraphs directly (Subgraph1 --> Subgraph2 is INVALID)
- All connections must be between specific nodes, not subgraphs
- Ensure every referenced node is properly defined
- Use proper node IDs without spaces or special characters`;
        
      default:
        return '';
    }
  }

  // ============================================================================
  // ANALYTICS & INSIGHTS
  // ============================================================================

  private loadAnalytics(): void {
    const stored = this.context.globalState.get<any>('codeVisualizer.analytics');
    if (stored) {
      this.analyticsData = {
        ...this.analyticsData,
        ...stored,
        mostUsedTypes: new Map(stored.mostUsedTypes || [])
      };
    }
  }

  private updateAnalytics(diagramType: DiagramType, success: boolean): void {
    if (success) {
      this.analyticsData.diagramsGenerated++;
      const currentCount = this.analyticsData.mostUsedTypes.get(diagramType) || 0;
      this.analyticsData.mostUsedTypes.set(diagramType, currentCount + 1);
    } else {
      this.analyticsData.errorCount++;
    }
    
    this.saveAnalytics();
  }

  private saveAnalytics(): void {
    const dataToSave = {
      ...this.analyticsData,
      mostUsedTypes: Array.from(this.analyticsData.mostUsedTypes.entries())
    };
    this.context.globalState.update('codeVisualizer.analytics', dataToSave);
  }

  private async showAnalytics(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'codeVisualizerAnalytics',
      'Code Visualizer Analytics',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    const topTypes = Array.from(this.analyticsData.mostUsedTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    panel.webview.html = this.getAnalyticsHtml(topTypes);
  }

  private getAnalyticsHtml(topTypes: [DiagramType, number][]): string {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
        }
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            margin: 5px 0;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
        }
        .chart {
            margin: 20px 0;
        }
        .bar {
            height: 20px;
            background: var(--vscode-progressBar-background);
            margin: 5px 0;
            border-radius: 3px;
            position: relative;
        }
        .bar-fill {
            height: 100%;
            background: var(--vscode-button-background);
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .bar-label {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--vscode-button-foreground);
        }
    </style>
</head>
<body>
    <h1>📊 Code Visualizer Analytics</h1>
    
    <div class="metric">
        <span>Total Diagrams Generated:</span>
        <strong>${this.analyticsData.diagramsGenerated}</strong>
    </div>
    
    <div class="metric">
        <span>Error Count:</span>
        <strong>${this.analyticsData.errorCount}</strong>
    </div>
    
    <div class="metric">
        <span>Success Rate:</span>
        <strong>${this.analyticsData.diagramsGenerated > 0 ? 
          Math.round((this.analyticsData.diagramsGenerated / (this.analyticsData.diagramsGenerated + this.analyticsData.errorCount)) * 100) : 0}%</strong>
    </div>
    
    <h2>Most Used Diagram Types</h2>
    <div class="chart">
        ${topTypes.map(([type, count]) => {
          const maxCount = topTypes[0]?.[1] || 1;
          const percentage = (count / maxCount) * 100;
          return `
            <div class="bar">
              <div class="bar-fill" style="width: ${percentage}%"></div>
              <div class="bar-label">${type}: ${count}</div>
            </div>
          `;
        }).join('')}
    </div>
</body>
</html>`;
  }

  // ============================================================================
  // EXPORT & SHARING FEATURES
  // ============================================================================

  private async exportCurrentDiagram(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.showNotification('No active editor', 'warning');
      return;
    }

    const position = editor.selection.active;
    const functionInfo = this.extractFunctionAtPosition(editor.document, position);
    
    if (!functionInfo) {
      this.showNotification('No function or class found at cursor position', 'warning');
      return;
    }

    const hash = this.hashCode(functionInfo.code);
    const cached = this.getFromCache(hash);
    
    if (!cached) {
      this.showNotification('No diagram available. Generate one first by hovering or using the diagram panel.', 'warning');
      return;
    }

    const exportFormat = await vscode.window.showQuickPick(
      ['Mermaid Code', 'SVG', 'PNG', 'Markdown'],
      { placeHolder: 'Select export format' }
    );

    if (exportFormat) {
      await this.exportDiagram(cached.diagram, cached.diagramType, functionInfo.name, exportFormat);
    }
  }

  private async exportDiagram(diagram: string, type: DiagramType, name: string, format: string): Promise<void> {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${name}_${type}_${timestamp}`;

    switch (format) {
      case 'Mermaid Code':
        await this.saveMermaidCode(diagram, filename);
        break;
      case 'Markdown':
        await this.saveMarkdown(diagram, name, filename);
        break;
      default:
        this.showNotification('Export format not yet implemented', 'info');
    }
  }

  private async saveMermaidCode(diagram: string, filename: string): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${filename}.mmd`),
      filters: { 'Mermaid': ['mmd'] }
    });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(diagram, 'utf8'));
      this.showNotification('Mermaid diagram exported successfully', 'info');
    }
  }

  private async saveMarkdown(diagram: string, name: string, filename: string): Promise<void> {
    const markdown = `# ${name} Visualization

\`\`\`mermaid
${diagram}
\`\`\`

*Generated by Code Visualizer Extension*
`;

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${filename}.md`),
      filters: { 'Markdown': ['md'] }
    });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, 'utf8'));
      this.showNotification('Markdown file exported successfully', 'info');
    }
  }

  // ============================================================================
  // DIAGRAM TYPE CONFIGURATION
  // ============================================================================

  private async configureDiagramType(): Promise<void> {
    const diagramTypes = DIAGRAM_TYPES.map(d => ({
      label: d.name,
      description: d.prompt.substring(0, 100) + '...',
      detail: `Patterns: ${d.patterns.length}, Keywords: ${d.keywords.length}`,
      type: d.type
    }));

    const selected = await vscode.window.showQuickPick(diagramTypes, {
      placeHolder: 'Select a diagram type to learn more about',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      const config = DIAGRAM_TYPES.find(d => d.type === selected.type);
      if (config) {
        await this.showDiagramTypeInfo(config);
      }
    }
  }

  private async showDiagramTypeInfo(config: DiagramTypeConfig): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'diagramTypeInfo',
      `${config.name} Information`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
        }
        .patterns, .keywords {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 10px;
        }
        .tag {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>${config.name}</h1>
    
    <div class="section">
        <h2>Description</h2>
        <p>${config.prompt}</p>
    </div>
    
    <div class="section">
        <h2>Detection Patterns</h2>
        <p>This diagram type is selected when the following patterns are detected in your code:</p>
        <div class="patterns">
            ${config.patterns.map(p => `<span class="tag">${p.source}</span>`).join('')}
        </div>
    </div>
    
    <div class="section">
        <h2>Keywords</h2>
        <p>These keywords also influence diagram type selection:</p>
        <div class="keywords">
            ${config.keywords.map(k => `<span class="tag">${k}</span>`).join('')}
        </div>
    </div>
    
    <div class="section">
        <h2>Score Weight</h2>
        <p>Selection priority: <strong>${config.scoreWeight}</strong> (higher values have more priority)</p>
    </div>
</body>
</html>`;
  }

  // ============================================================================
  // COMMANDS - ENHANCED PANEL VIEW
  // ============================================================================

  private async showDiagramCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.showNotification('No active editor', 'warning');
      return;
    }

    const position = editor.selection.active;
    const functionInfo = this.extractFunctionAtPosition(editor.document, position);
    
    if (!functionInfo) {
      this.showNotification('No function or class found at cursor position', 'warning');
      return;
    }

    await this.showDiagramPanel(functionInfo);
  }

  private async showDiagramPanelCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.showNotification('No active editor', 'warning');
      return;
    }

    const position = editor.selection.active;
    const functionInfo = this.extractFunctionAtPosition(editor.document, position);
    
    if (!functionInfo) {
      this.showNotification('No function or class found at cursor position', 'warning');
      return;
    }

    await this.showDiagramPanel(functionInfo);
  }

  private async showDiagramPanel(functionInfo: FunctionInfo): Promise<void> {
    if (this.currentPanel) {
      this.currentPanel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.currentPanel = vscode.window.createWebviewPanel(
        'codeVisualizer',
        'Code Visualization',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      this.currentPanel.onDidDispose(() => {
        this.currentPanel = undefined;
      });
    }

    this.currentPanel.webview.html = this.getLoadingHtml();

    try {
      const hash = this.hashCode(functionInfo.code);
      
      let cached = this.getFromCache(hash);
      let diagram: string;
      let diagramType: DiagramType;
      
      if (cached) {
        diagram = cached.diagram;
        diagramType = cached.diagramType;
      } else {
        const result = await this.generateDiagramWithRetry(functionInfo.code, functionInfo.language, hash);
        diagram = result.diagram;
        diagramType = result.type;
      }

      this.currentPanel.webview.html = this.getEnhancedDiagramHtml(diagram, diagramType, functionInfo);
      
    } catch (error: any) {
      this.currentPanel.webview.html = this.getErrorHtml(error.message);
      this.logError('Failed to show diagram', error);
    }
  }

  private async storeApiToken(): Promise<void> {
    const token = await vscode.window.showInputBox({
      prompt: 'Enter your GitHub Models or OpenAI API token',
      password: true,
      placeHolder: 'ghp_... or sk-...'
    });

    if (token) {
      await this.context.secrets.store('codeVisualizer.apiToken', token);
      this.showNotification('API token stored securely', 'info');
    }
  }

  // ============================================================================
  // UI HELPERS - ENHANCED WITH DIAGRAM TYPE INFO
  // ============================================================================

  private updateDecorations(editor: vscode.TextEditor | undefined): void {
    if (!editor) return;

    const config = vscode.workspace.getConfiguration('codeVisualizer');
    if (!config.get<boolean>('showIndicators', true)) return;

    const decorations: vscode.DecorationOptions[] = [];
    const text = editor.document.getText();
    
    const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>|\w+\s*\([^)]*\)\s*\{|class\s+\w+|def\s+\w+)/g;
    
    let match;
    while ((match = functionPattern.exec(text)) !== null) {
      const startPos = editor.document.positionAt(match.index);
      const endPos = editor.document.positionAt(match.index + match[0].length);
      decorations.push({
        range: new vscode.Range(startPos, endPos),
        hoverMessage: 'Hover to visualize'
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  private getLoadingHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: var(--vscode-editor-background);
        }
        .loading {
            text-align: center;
            color: var(--vscode-foreground);
        }
        .spinner {
            border: 3px solid var(--vscode-foreground);
            border-top: 3px solid transparent;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .status {
            margin-top: 10px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <div>Analyzing code structure...</div>
        <div class="status">Selecting optimal visualization...</div>
    </div>
</body>
</html>`;
  }

  private getEnhancedDiagramHtml(diagram: string, diagramType: DiagramType, functionInfo: FunctionInfo): string {
    const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'default' : 'dark';
    const diagramConfig = this.getDiagramConfig(diagramType);
    const nonce = this.generateNonce();
    const scriptUri = this.currentPanel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'mermaid.min.js')
    );
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.currentPanel!.webview.cspSource} blob: data:; style-src ${this.currentPanel!.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <script nonce="${nonce}" src="${scriptUri}"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            margin: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
        }
        h2 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .diagram-type {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: normal;
        }
        .info {
            margin: 10px 0;
            padding: 10px;
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            border-radius: 3px;
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }
        .info-item {
            display: flex;
            gap: 5px;
        }
        .info-label {
            font-weight: bold;
            opacity: 0.8;
        }
        .mermaid {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
            min-height: 400px;
            cursor: grab;
        }
        .mermaid:active {
            cursor: grabbing;
        }
        .mermaid-wrapper {
            transform-origin: center center;
            transition: transform 0.2s ease;
            width: 100%;
            height: 100%;
            overflow: visible;
        }
        .mermaid-container {
            width: 100%;
            height: 100%;
        }
        .diagram-controls {
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--vscode-toolbar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 8px;
            display: flex;
            gap: 4px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .control-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s ease;
        }
        .control-btn:hover {
            background: var(--vscode-button-hoverBackground);
            transform: scale(1.05);
        }
        .control-btn:active {
            transform: scale(0.95);
        }
        .zoom-level {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            min-width: 40px;
            text-align: center;
        }
        .fullscreen-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: var(--vscode-editor-background);
            z-index: 10000;
            display: none;
            padding: 20px;
            box-sizing: border-box;
        }
        .fullscreen-overlay.active {
            display: flex;
            flex-direction: column;
        }
        .fullscreen-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 10px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .fullscreen-content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        .actions {
            margin-top: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 3px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        details {
            margin-top: 20px;
            padding: 10px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
        }
        summary {
            cursor: pointer;
            font-weight: bold;
            padding: 5px;
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 10px;
            border-radius: 3px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 12px;
        }
        .analysis {
            margin-top: 15px;
            padding: 10px;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 3px;
        }
        .analysis h3 {
            margin-top: 0;
            font-size: 14px;
        }
        .analysis-item {
            margin: 5px 0;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <h2>
        📊 ${functionInfo.name} Visualization
        <span class="diagram-type">${diagramConfig.name}</span>
    </h2>
    
    <div class="info">
        <div class="info-item">
            <span class="info-label">Type:</span>
            <span>${functionInfo.type}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Language:</span>
            <span>${functionInfo.language}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Lines:</span>
            <span>${functionInfo.startLine + 1}-${functionInfo.endLine + 1}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Size:</span>
            <span>${functionInfo.code.length} chars</span>
        </div>
    </div>
    
    <div class="analysis">
        <h3>📈 Visualization Analysis</h3>
        <div class="analysis-item">
            Selected <strong>${diagramConfig.name}</strong> based on code patterns detected.
        </div>
        <div class="analysis-item">
            This diagram type best represents the ${
              diagramType === 'sequence' ? 'interaction flow and async operations' :
              diagramType === 'stateDiagram' ? 'state transitions and lifecycle' :
              diagramType === 'classDiagram' ? 'object structure and relationships' :
              diagramType === 'erDiagram' ? 'data model and entity relationships' :
              diagramType === 'journey' ? 'user interaction flow' :
              'control flow and logic'
            } in your code.
        </div>
    </div>
    
    <div class="mermaid" id="diagram-container">
        <div class="diagram-controls">
            <button class="control-btn" onclick="zoomIn()" title="Zoom In">🔍+</button>
            <button class="control-btn" onclick="zoomOut()" title="Zoom Out">🔍-</button>
            <div class="zoom-level" id="zoom-level">100%</div>
            <button class="control-btn" onclick="resetView()" title="Reset View">⌂</button>
            <button class="control-btn" onclick="toggleFullscreen()" title="Fullscreen">⛶</button>
        </div>
        <div class="mermaid-wrapper" id="mermaid-wrapper">
            <div class="mermaid-container" id="mermaid-container"></div>
        </div>
    </div>
    
    <div class="fullscreen-overlay" id="fullscreen-overlay">
        <div class="fullscreen-header">
            <h2>📊 ${functionInfo.name} - ${diagramConfig.name} (Fullscreen)</h2>
            <button class="control-btn" onclick="toggleFullscreen()" title="Exit Fullscreen">✕</button>
        </div>
        <div class="fullscreen-content">
            <div class="mermaid" id="fullscreen-diagram">
                <div class="diagram-controls">
                    <button class="control-btn" onclick="zoomIn(true)" title="Zoom In">🔍+</button>
                    <button class="control-btn" onclick="zoomOut(true)" title="Zoom Out">🔍-</button>
                    <div class="zoom-level" id="fullscreen-zoom-level">100%</div>
                    <button class="control-btn" onclick="resetView(true)" title="Reset View">⌂</button>
                </div>
                <div class="mermaid-wrapper" id="fullscreen-mermaid-wrapper">
                    <div class="mermaid-container" id="fullscreen-mermaid-container"></div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="actions">
        <button onclick="copyDiagram()">📋 Copy Diagram</button>
        <button onclick="exportSVG()">💾 Export SVG</button>
        <button onclick="exportPNG()">🖼️ Export PNG</button>
        <button onclick="refreshDiagram()">🔄 Regenerate</button>
        <button onclick="switchDiagramType()">🔀 Try Different Type</button>
        <button onclick="toggleFullscreen()" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">⛶ Fullscreen View</button>
    </div>
    
    <details>
        <summary>View Source Code</summary>
        <pre>${this.escapeHtml(functionInfo.code)}</pre>
    </details>
    
    <details>
        <summary>View Mermaid Source</summary>
        <pre>${this.escapeHtml(diagram)}</pre>
    </details>
    
    <script nonce="${nonce}">
        // Store diagram data for rendering
        const diagramData = ${JSON.stringify(diagram)};
        
        // Enhanced Mermaid configuration with better error handling
        mermaid.initialize({ 
            startOnLoad: false,  // Changed to false for better control
            theme: '${theme}',
            logLevel: 'error',   // Reduce console noise
            securityLevel: 'loose',  // Allow more flexibility
            suppressErrorRendering: false,  // Show errors for debugging
            flowchart: {
                curve: 'basis',
                padding: 20,
                htmlLabels: true
            },
            sequence: {
                diagramMarginX: 50,
                diagramMarginY: 50,
                actorMargin: 100,
                width: 150,
                height: 65,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35,
                showSequenceNumbers: true
            },
            journey: {
                diagramMarginX: 50,
                diagramMarginY: 50,
                leftMargin: 150,
                width: 150,
                height: 50,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35
            },
            er: {
                diagramPadding: 20,
                layoutDirection: 'TB',
                minEntityWidth: 100,
                minEntityHeight: 75,
                entityPadding: 15,
                stroke: 'gray',
                fill: 'honeydew',
                fontSize: 12
            },
            state: {
                dividerMargin: 10,
                sizeUnit: 5,
                confWidth: 35,
                confHeight: 35
            }
        });
        
        // Simplified Mermaid rendering without transforms interference
        function initializeMermaidDiagrams() {
            const containers = document.querySelectorAll('.mermaid-container');
            
            containers.forEach((container, index) => {
                const elementId = 'mermaid-diagram-' + index;
                
                // Clear the container and reset any transforms
                container.innerHTML = '';
                container.id = elementId;
                container.style.transform = ''; // Clear any existing transforms
                
                try {
                    // Set raw diagram text directly
                    container.textContent = diagramData;
                    container.classList.add('mermaid');
                    container.removeAttribute('data-processed');
                    
                    // Try mermaid.run() for automatic processing
                    setTimeout(() => {
                        try {
                            if (mermaid.run) {
                                mermaid.run({ nodes: [container] }).catch(error => {
                                    console.error('Mermaid rendering error:', error);
                                    renderErrorFallback(container, error, diagramData, elementId);
                                });
                            } else if (mermaid.init) {
                                mermaid.init(undefined, container);
                            } else {
                                renderErrorFallback(container, new Error('No Mermaid API available'), diagramData, elementId);
                            }
                        } catch (error) {
                            console.error('Mermaid processing failed:', error);
                            renderErrorFallback(container, error, diagramData, elementId);
                        }
                    }, 100);
                } catch (error) {
                    console.error('Mermaid initialization error:', error);
                    renderErrorFallback(container, error, diagramData, elementId);
                }
            });
        }
        
        function renderErrorFallback(container, error, diagramText, elementId) {
            const isSyntaxError = error.message.includes('Parse error') || error.message.includes('Syntax error');
            const errorType = isSyntaxError ? 'Syntax Error' : 'Rendering Error';
            const suggestions = isSyntaxError ? 
                '<div style="margin-top: 10px; padding: 10px; background: #2d2d30; border-radius: 4px;">' +
                '<strong>Common fixes:</strong><br>' +
                '• Check for incomplete arrows (e.g., "Task->" should be "Task --> Target")<br>' +
                '• Ensure all connections have valid targets<br>' +
                '• Verify proper node syntax with brackets/parentheses<br>' +
                '• Try regenerating the diagram with a different type<br>' +
                '</div>' : '';
            
            container.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center; background: #1e1e1e; border-radius: 8px; border: 1px solid #ff6b6b;">\n' +
                '<h3>⚠️ ' + errorType + '</h3>\n' +
                '<p>The diagram could not be rendered due to invalid Mermaid syntax.</p>\n' +
                suggestions +
                '<details style="margin-top: 15px;">\n' +
                '<summary style="cursor: pointer; font-weight: bold;">Show Technical Details</summary>\n' +
                '<pre style="text-align: left; font-size: 11px; margin-top: 10px; background: #0d1117; padding: 10px; border-radius: 4px; overflow-x: auto;">Error: ' + error.message + '</pre>\n' +
                '<pre style="text-align: left; font-size: 11px; margin-top: 10px; background: #0d1117; padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 200px; overflow-y: auto;">Diagram Source:\n' + diagramText + '</pre>\n' +
                '</details>\n' +
                '<div style="margin-top: 15px;">\n' +
                '<button onclick="regenerateFixedDiagram()" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">🔄 Try Auto-Fix</button>\n' +
                '<button onclick="switchDiagramType()" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">🔀 Try Different Type</button>\n' +
                '</div>\n' +
                '</div>';
        }
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeMermaidDiagrams);
        } else {
            initializeMermaidDiagrams();
        }
        
        function copyDiagram() {
            navigator.clipboard.writeText(diagramData).then(() => {
                showToast('Diagram copied to clipboard!');
            });
        }
        
        function exportSVG() {
            const svg = document.querySelector('.mermaid svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '${functionInfo.name}_${diagramType}.svg';
                a.click();
                showToast('SVG exported successfully!');
            }
        }
        
        function exportPNG() {
            const svg = document.querySelector('.mermaid svg');
            if (svg) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const svgData = new XMLSerializer().serializeToString(svg);
                const img = new Image();
                
                img.onload = function() {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob(function(blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = '${functionInfo.name}_${diagramType}.png';
                        a.click();
                        showToast('PNG exported successfully!');
                    });
                };
                
                img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
            }
        }
        
        function regenerateFixedDiagram() {
            // Apply common syntax fixes to the diagram and re-render
            try {
                const containers = document.querySelectorAll('.mermaid-container');
                containers.forEach((container) => {
                    // Apply the same fixes we do in the extension
                    let fixedDiagram = diagramData
                        // Fix sequence diagram specific issues
                        .replace(/-->\s*>/g, '->>')
                        .replace(/->\s*>/g, '->>')
                        .replace(/-->>/g, '->>')
                        .replace(/-->/g, '->')
                        .replace(/\s*->>\s*/g, ' ->> ')
                        .replace(/\s*->\s*/g, ' -> ')
                        // Fix incomplete arrows
                        .replace(/(\w+)\s*->\s*$/gm, '$1')
                        .replace(/\s*-->\s*$/gm, '')
                        .replace(/\s*--->\s*$/gm, '')
                        // Fix double arrows
                        .replace(/-->\s*-->/g, '-->')
                        .replace(/--->\s*--->/g, '-->')
                        // Remove invalid characters
                        .replace(/[^\w\s\->>:(),.'"\\n]/g, '')
                        // Clean up whitespace
                        .replace(/\n\s*\n\s*\n/g, '\n\n')
                        .replace(/[ \t]+$/gm, '')
                        .trim();
                    
                    container.innerHTML = '';
                    container.textContent = fixedDiagram;
                    container.classList.add('mermaid');
                    container.removeAttribute('data-processed');
                    
                    // Try rendering again
                    setTimeout(() => {
                        if (mermaid.run) {
                            mermaid.run({ nodes: [container] }).catch(error => {
                                showToast('Auto-fix failed. Try switching diagram type.', 'error');
                            });
                        }
                    }, 100);
                });
                showToast('Attempting to fix syntax errors...', 'info');
            } catch (error) {
                showToast('Auto-fix failed: ' + error.message, 'error');
            }
        }
        
        function refreshDiagram() {
            location.reload();
        }
        
        function switchDiagramType() {
            showToast('Feature coming soon: Choose specific diagram type');
        }
        
        // Enhanced diagram interaction variables
        let currentZoom = 1;
        let currentPanX = 0;
        let currentPanY = 0;
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;
        let isFullscreen = false;
        
        // Zoom functions
        function zoomIn(fullscreen = false) {
            currentZoom = Math.min(currentZoom * 1.2, 5);
            updateTransform(fullscreen);
            updateZoomLevel(fullscreen);
        }
        
        function zoomOut(fullscreen = false) {
            currentZoom = Math.max(currentZoom / 1.2, 0.1);
            updateTransform(fullscreen);
            updateZoomLevel(fullscreen);
        }
        
        function resetView(fullscreen = false) {
            currentZoom = 1;
            currentPanX = 0;
            currentPanY = 0;
            updateTransform(fullscreen);
            updateZoomLevel(fullscreen);
            showToast('View reset to default');
        }
        
        function updateTransform(fullscreen = false) {
            const wrapper = fullscreen ? 
                document.getElementById('fullscreen-mermaid-wrapper') : 
                document.getElementById('mermaid-wrapper');
            if (wrapper) {
                wrapper.style.transform = \`translate(\${currentPanX}px, \${currentPanY}px) scale(\${currentZoom})\`;
            }
        }
        
        function updateZoomLevel(fullscreen = false) {
            const zoomDisplay = fullscreen ? 
                document.getElementById('fullscreen-zoom-level') : 
                document.getElementById('zoom-level');
            if (zoomDisplay) {
                zoomDisplay.textContent = Math.round(currentZoom * 100) + '%';
            }
        }
        
        // Fullscreen functionality
        function toggleFullscreen() {
            const overlay = document.getElementById('fullscreen-overlay');
            isFullscreen = !isFullscreen;
            
            if (isFullscreen) {
                overlay.classList.add('active');
                // Reset transform for fullscreen
                currentZoom = 1;
                currentPanX = 0;
                currentPanY = 0;
                updateTransform(true);
                updateZoomLevel(true);
                showToast('Entered fullscreen mode - Use ESC to exit');
            } else {
                overlay.classList.remove('active');
                showToast('Exited fullscreen mode');
            }
        }
        
        // Pan functionality with mouse events
        function initializePanControls() {
            const containers = [\n                document.getElementById('diagram-container'),\n                document.getElementById('fullscreen-diagram')\n            ];
            
            containers.forEach(container => {
                if (!container) return;
                
                container.addEventListener('mousedown', (e) => {
                    if (e.target.closest('.diagram-controls')) return;
                    isDragging = true;
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                    container.style.cursor = 'grabbing';
                    e.preventDefault();
                });
                
                container.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    
                    const deltaX = e.clientX - lastMouseX;
                    const deltaY = e.clientY - lastMouseY;
                    
                    currentPanX += deltaX;
                    currentPanY += deltaY;
                    
                    updateTransform(container.id === 'fullscreen-diagram');
                    
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                });
                
                container.addEventListener('mouseup', () => {
                    isDragging = false;
                    container.style.cursor = 'grab';
                });
                
                container.addEventListener('mouseleave', () => {
                    isDragging = false;
                    container.style.cursor = 'grab';
                });
                
                // Zoom with mouse wheel
                container.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const isFullscreenContainer = container.id === 'fullscreen-diagram';
                    
                    if (e.deltaY < 0) {
                        zoomIn(isFullscreenContainer);
                    } else {
                        zoomOut(isFullscreenContainer);
                    }
                });
            });
        }
        
        function showToast(message) {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--vscode-notifications-background);color:var(--vscode-notifications-foreground);padding:10px 20px;border-radius:4px;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            toast.textContent = message;
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
        
        // Enhanced keyboard navigation support
        document.addEventListener('keydown', function(e) {
            // Handle fullscreen exit with ESC
            if (e.key === 'Escape' && isFullscreen) {
                e.preventDefault();
                toggleFullscreen();
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'c':
                        e.preventDefault();
                        copyDiagram();
                        break;
                    case 's':
                        e.preventDefault();
                        exportSVG();
                        break;
                    case 'r':
                        e.preventDefault();
                        refreshDiagram();
                        break;
                    case '=':
                    case '+':
                        e.preventDefault();
                        zoomIn(isFullscreen);
                        break;
                    case '-':
                        e.preventDefault();
                        zoomOut(isFullscreen);
                        break;
                    case '0':
                        e.preventDefault();
                        resetView(isFullscreen);
                        break;
                }
            } else {
                switch(e.key) {
                    case 'f':
                    case 'F11':
                        e.preventDefault();
                        toggleFullscreen();
                        break;
                    case '+':
                    case '=':
                        e.preventDefault();
                        zoomIn(isFullscreen);
                        break;
                    case '-':
                        e.preventDefault();
                        zoomOut(isFullscreen);
                        break;
                    case '0':
                        e.preventDefault();
                        resetView(isFullscreen);
                        break;
                    // Arrow keys for panning
                    case 'ArrowUp':
                        e.preventDefault();
                        currentPanY += 20;
                        updateTransform(isFullscreen);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        currentPanY -= 20;
                        updateTransform(isFullscreen);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        currentPanX += 20;
                        updateTransform(isFullscreen);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        currentPanX -= 20;
                        updateTransform(isFullscreen);
                        break;
                }
            }
        });
        
        // Initialize interaction controls
        document.addEventListener('DOMContentLoaded', function() {
            initializePanControls();
            updateZoomLevel(false);
            updateZoomLevel(true);
        });
        
        // Initialize immediately if DOM is already loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initializePanControls();
            });
        } else {
            initializePanControls();
        }
        
        // Focus management and accessibility
        const firstButton = document.querySelector('button');
        if (firstButton) {
            firstButton.focus();
        }
        
        // Show helpful tooltip on first load
        setTimeout(() => {
            showToast('💡 Use mouse wheel to zoom, drag to pan, or press F for fullscreen!');
        }, 1000);
    </script>
</body>
</html>`;
  }

  private getErrorHtml(error: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-errorForeground);
        }
        .error {
            padding: 20px;
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 3px;
        }
        h2 {
            margin-top: 0;
        }
        .suggestion {
            margin-top: 20px;
            padding: 10px;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 3px;
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <div class="error">
        <h2>❌ Visualization Generation Failed</h2>
        <p>${this.escapeHtml(error)}</p>
    </div>
    <div class="suggestion">
        <strong>💡 Troubleshooting:</strong>
        <ul>
            <li>Verify your API token is valid and has sufficient credits</li>
            <li>Check your internet connectivity</li>
            <li>Try selecting a smaller code block</li>
            <li>Check the Output panel for detailed error logs</li>
            <li>Consider switching API providers in settings</li>
        </ul>
    </div>
</body>
</html>`;
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private async getApiToken(): Promise<string | undefined> {
    let token = await this.context.secrets.get('codeVisualizer.apiToken');
    
    if (!token) {
      const config = vscode.workspace.getConfiguration('codeVisualizer');
      token = config.get<string>('apiToken');
    }
    
    return token;
  }

  private getActiveProvider(): APIProvider {
    const config = vscode.workspace.getConfiguration('codeVisualizer');
    const providerName = config.get<string>('provider', 'github');
    
    return API_PROVIDERS.find(p => p.name === providerName) || API_PROVIDERS[0];
  }

  private hashCode(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateStatus(message: string): void {
    if (message) {
      this.statusBarItem.text = `$(sync~spin) ${message}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  private showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    switch (type) {
      case 'error':
        vscode.window.showErrorMessage(message);
        break;
      case 'warning':
        vscode.window.showWarningMessage(message);
        break;
      default:
        vscode.window.showInformationMessage(message);
    }
  }

  private logInfo(message: string): void {
    this.outputChannel.appendLine(`[INFO] ${new Date().toISOString()}: ${message}`);
  }

  private logError(message: string, error: any): void {
    this.outputChannel.appendLine(`[ERROR] ${new Date().toISOString()}: ${message}`);
    if (error) {
      this.outputChannel.appendLine(`  Details: ${error.message || error}`);
      if (error.stack) {
        this.outputChannel.appendLine(`  Stack: ${error.stack}`);
      }
    }
  }
}

// ============================================================================
// EXTENSION ACTIVATION
// ============================================================================

let visualizer: CodeVisualizer | undefined;

export function activate(context: vscode.ExtensionContext): void {
  visualizer = new CodeVisualizer(context);
  visualizer.activate();
}

export function deactivate(): void {
  visualizer = undefined;
}