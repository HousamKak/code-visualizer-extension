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

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust', 'php', 'ruby'];
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_CODE_SIZE = 8000;
const DIAGRAM_GENERATION_TIMEOUT = 15000;

// Diagram type configurations with detection patterns
const DIAGRAM_TYPES: DiagramTypeConfig[] = [
  {
    type: 'sequence',
    name: 'Sequence Diagram',
    prompt: 'Generate a Mermaid sequence diagram showing the interaction flow, API calls, async operations, and message passing',
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
    prompt: 'Generate a Mermaid state diagram showing states, transitions, and state changes',
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
    prompt: 'Generate a Mermaid class diagram showing class structure, properties, methods, and relationships',
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
    prompt: 'Generate a Mermaid ER diagram showing entities, attributes, and relationships',
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
    prompt: 'Generate a Mermaid user journey diagram showing user actions and system responses',
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
    prompt: 'Generate a Mermaid flowchart showing control flow, conditions, loops, and logic',
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
          content: 'Generate ONLY a valid Mermaid diagram based on the code analysis. No explanations, just the diagram.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.2
    }),
    extractResponse: (data) => data.choices?.[0]?.message?.content || ''
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
    this.cleanupCache();
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
      () => this.clearCache()
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

    // Check for various patterns
    analysis.hasApiCalls = /fetch\s*\(|axios\.|XMLHttpRequest|\$\.ajax|\.get\(|\.post\(|\.put\(|\.delete\(/gi.test(code);
    analysis.hasStateManagement = /state\s*[=:]|setState|this\.state|useState|useReducer|store\.|dispatch\(/gi.test(code);
    analysis.hasClassDefinition = /class\s+\w+|interface\s+\w+|extends\s+|implements\s+/gi.test(code);
    analysis.hasAsyncOperations = /async\s+|await\s+|Promise|\.then\(|\.catch\(/gi.test(code);
    analysis.hasEventHandlers = /on[A-Z]\w+|addEventListener|emit\(|on\(/gi.test(code);
    analysis.hasDataFlow = /pipe\(|map\(|filter\(|reduce\(|transform|stream/gi.test(code);
    analysis.hasUserInteraction = /onClick|onSubmit|handleClick|handleSubmit|onPress|onTap/gi.test(code);
    analysis.hasComplexConditions = (code.match(/if\s*\(/g) || []).length > 3;
    analysis.hasLoops = /for\s*\(|while\s*\(|do\s*\{|forEach|map\(|filter\(/gi.test(code);
    analysis.hasErrorHandling = /try\s*\{|catch\s*\(|throw\s+|Error\(/gi.test(code);
    analysis.hasDatabaseOperations = /SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|JOIN|\.find\(|\.save\(|\.create\(/gi.test(code);

    // Determine if it's a specific pattern
    analysis.isStateMachine = /state machine|finite state|FSM|transition.*state|currentState|nextState/gi.test(code);
    analysis.isClassHierarchy = analysis.hasClassDefinition && /extends|implements|abstract|override/gi.test(code);
    analysis.isSequentialProcess = /step\d|phase\d|stage\d|first.*then.*finally/gi.test(code);
    analysis.isEntityRelationship = /entity|model|schema|table|foreign key|primary key|relationship/gi.test(code);

    // Calculate complexity
    const lineCount = code.split('\n').length;
    const conditionCount = (code.match(/if\s*\(|switch\s*\(|\?.*:/g) || []).length;
    const functionCount = (code.match(/function\s+\w+|=>\s*\{|async\s+\w+/g) || []).length;
    
    if (lineCount > 100 || conditionCount > 10 || functionCount > 5) {
      analysis.complexity = 'complex';
    } else if (lineCount > 30 || conditionCount > 5 || functionCount > 2) {
      analysis.complexity = 'moderate';
    }

    return analysis;
  }

  private selectBestDiagramType(code: string, language: string): DiagramType {
    const analysis = this.analyzeCode(code, language);
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

      // Apply analysis-based bonuses
      if (config.type === 'sequence' && (analysis.hasApiCalls || analysis.hasAsyncOperations)) {
        score += 10;
      }
      if (config.type === 'stateDiagram' && (analysis.isStateMachine || analysis.hasStateManagement)) {
        score += 15;
      }
      if (config.type === 'classDiagram' && analysis.isClassHierarchy) {
        score += 20;
      }
      if (config.type === 'erDiagram' && (analysis.isEntityRelationship || analysis.hasDatabaseOperations)) {
        score += 12;
      }
      if (config.type === 'journey' && analysis.hasUserInteraction) {
        score += 8;
      }

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

    // Log the decision for debugging
    this.logInfo(`Selected diagram type: ${bestType} (score: ${highestScore})`);

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

    const functionInfo = this.extractFunctionAtPosition(document, position);
    if (!functionInfo || functionInfo.code.length > MAX_CODE_SIZE) {
      return undefined;
    }

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
    const promise = this.generateDiagramWithRetry(functionInfo.code, functionInfo.language, hash);
    this.pendingRequests.set(hash, promise);

    promise.then(result => {
      this.pendingRequests.delete(hash);
      this.showNotification(`Diagram ready! Hover again to view.`, 'info');
    }).catch(error => {
      this.pendingRequests.delete(hash);
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

*💡 Press \`Cmd+Shift+D\` for details*`;
    
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
      default:
        baseInfo = this.extractGenericFunction(text, offset, document);
    }
    
    if (baseInfo) {
      baseInfo.language = language;
    }
    
    return baseInfo;
  }

  private extractJavaScriptFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
    // Check if we're in a class first
    const classPattern = /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,]+)?\s*\{/g;
    let classMatch;
    while ((classMatch = classPattern.exec(text)) !== null) {
      const classStart = classMatch.index;
      const classEnd = this.findBlockEnd(text, classStart);
      
      if (offset >= classStart && offset <= classEnd) {
        // Return the entire class
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

  private extractPythonFunction(text: string, offset: number, document: vscode.TextDocument): FunctionInfo | null {
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
    // Check for class first
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
    retryCount = 0
  ): Promise<{ diagram: string; type: DiagramType }> {
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

      const provider = this.getActiveProvider();
      const diagram = await this.callAIProvider(provider, code, diagramConfig, token);
      
      if (!diagram) {
        throw new Error('Empty response from AI provider');
      }

      const cleanedDiagram = this.cleanAndValidateDiagram(diagram, diagramType);
      
      this.addToCache(hash, cleanedDiagram, diagramType, code);
      this.updateStatus('');
      
      return { diagram: cleanedDiagram, type: diagramType };
      
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        this.logInfo(`Retry attempt ${retryCount + 1} for diagram generation`);
        await this.delay(RETRY_DELAY * Math.pow(2, retryCount));
        return this.generateDiagramWithRetry(code, language, hash, retryCount + 1);
      }
      
      this.updateStatus('');
      throw error;
    }
  }

  private async callAIProvider(
    provider: APIProvider, 
    code: string, 
    diagramConfig: DiagramTypeConfig,
    token: string
  ): Promise<string> {
    const prompt = this.buildEnhancedPrompt(code, diagramConfig);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI request timeout')), DIAGRAM_GENERATION_TIMEOUT);
    });

    const fetchPromise = fetch(provider.endpoint, {
      method: 'POST',
      headers: provider.headers(token),
      body: JSON.stringify(provider.buildBody(prompt))
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return provider.extractResponse(data);
  }

  private buildEnhancedPrompt(code: string, diagramConfig: DiagramTypeConfig): string {
    return `${diagramConfig.prompt}.

Focus on the main logic flow and key interactions. Be concise but comprehensive.

Code to analyze:
\`\`\`
${code}
\`\`\`

Generate a ${diagramConfig.name} in Mermaid syntax. Remember: NO quotes in labels, keep labels concise.`;
  }

  private cleanAndValidateDiagram(diagram: string, diagramType: DiagramType): string {
    // Extract mermaid diagram
    let cleaned = diagram;
    
    // Remove markdown code blocks if present
    cleaned = cleaned.replace(/```mermaid\n?/gi, '').replace(/```\n?/gi, '');
    
    // Remove quotes from labels
    cleaned = cleaned
      .replace(/"([^"]+)"/g, '$1')
      .replace(/'([^']+)'/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
    
    // Clean up specific diagram types
    switch (diagramType) {
      case 'sequence':
        if (!cleaned.includes('sequenceDiagram')) {
          cleaned = 'sequenceDiagram\n' + cleaned;
        }
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
        break;
      case 'flowchart':
        if (!cleaned.match(/flowchart\s+(TD|LR|BT|RL)/)) {
          cleaned = 'flowchart TD\n' + cleaned;
        }
        break;
    }
    
    // Remove any remaining HTML
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // Basic validation
    if (cleaned.length < 10) {
      throw new Error('Generated diagram is too short or invalid');
    }
    
    return cleaned;
  }

  // ============================================================================
  // CACHE MANAGEMENT WITH DIAGRAM TYPE
  // ============================================================================

  private addToCache(hash: string, diagram: string, diagramType: DiagramType, code: string): void {
    this.cache.set(hash, {
      diagram,
      diagramType,
      timestamp: Date.now(),
      codeHash: hash
    });
    
    if (this.cache.size > 100) {
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
    
    return cached;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        this.cache.delete(hash);
      }
    }
  }

  private clearCache(): void {
    this.cache.clear();
    this.showNotification('Cache cleared successfully', 'info');
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
    const escapedDiagram = this.escapeHtml(diagram);
    const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'default' : 'dark';
    const diagramConfig = this.getDiagramConfig(diagramType);
    
    return `<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
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
            overflow-x: auto;
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
    
    <div class="mermaid">${escapedDiagram}</div>
    
    <div class="actions">
        <button onclick="copyDiagram()">📋 Copy Diagram</button>
        <button onclick="exportSVG()">💾 Export SVG</button>
        <button onclick="exportPNG()">🖼️ Export PNG</button>
        <button onclick="refreshDiagram()">🔄 Regenerate</button>
        <button onclick="switchDiagramType()">🔀 Try Different Type</button>
    </div>
    
    <details>
        <summary>View Source Code</summary>
        <pre>${this.escapeHtml(functionInfo.code)}</pre>
    </details>
    
    <details>
        <summary>View Mermaid Source</summary>
        <pre>${escapedDiagram}</pre>
    </details>
    
    <script>
        mermaid.initialize({ 
            startOnLoad: true, 
            theme: '${theme}',
            flowchart: {
                curve: 'basis',
                padding: 20
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
                messageMargin: 35
            }
        });
        
        function copyDiagram() {
            const diagram = \`${escapedDiagram}\`;
            navigator.clipboard.writeText(diagram).then(() => {
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
        
        function refreshDiagram() {
            location.reload();
        }
        
        function switchDiagramType() {
            showToast('Feature coming soon: Choose specific diagram type');
        }
        
        function showToast(message) {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--vscode-notifications-background);color:var(--vscode-notifications-foreground);padding:10px 20px;border-radius:4px;z-index:1000;';
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
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