export interface DiagramVersion {
  id: string;
  diagram: string;
  diagramType: DiagramType;
  timestamp: number;
  source: 'ai-generated' | 'user-edited' | 'regenerated';
  explanation?: string;
  changeDescription?: string;
  codeAnalysis?: CodeAnalysis;
}

export interface DiagramCache {
  diagram: string;
  diagramType?: DiagramType;
  timestamp: number;
  hash: string;
  codeHash?: string;
  filePath?: string;
  functionName?: string;
  language?: string;
  codeAnalysis?: CodeAnalysis;
  imageFilePath?: string;
  mermaidFilePath?: string;
  lastAccessed: number;
  accessCount: number;
  metadata?: any;
  explanation?: string;
  versions?: DiagramVersion[];
  currentVersionId?: string;
}

export interface CacheMetadata {
  version: string;
  totalEntries: number;
  lastCleanup: number;
  cacheDirectory: string;
  maxCacheSize: number;
}

export type DiagramType = 
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
  | 'block';         // Component architecture

export interface DiagramTypeConfig {
  type: DiagramType;
  name: string;
  prompt: string;
  patterns: RegExp[];
  keywords: string[];
  scoreWeight: number;
}

export interface CodeAnalysis {
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