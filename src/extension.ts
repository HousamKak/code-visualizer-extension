import * as vscode from 'vscode';
import { DiagramType, FunctionInfo } from './types';
import { setupContainer } from './container/container-setup';
import { SERVICE_IDENTIFIERS } from './interfaces/container.interface';
import { ServiceContainer } from './container/service-container';

// Import interfaces
import { IFunctionDetectorService } from './interfaces/function-detector.interface';
import { ICacheManager } from './interfaces/cache-manager.interface';
import { IAIProviderService } from './interfaces/ai-provider.interface';
import { IDiagramGeneratorService } from './interfaces/diagram-generator.interface';
import { IStatusManager } from './interfaces/status-manager.interface';
import { IWebviewManager } from './interfaces/webview-manager.interface';
import { IHoverProvider } from './interfaces/hover-provider.interface';

/**
 * Main extension class that orchestrates the Code Visualizer functionality.
 * 
 * Manages the dependency injection container, command registration, and service
 * initialization. Provides the primary interface for generating AI-powered
 * Mermaid diagrams from source code with intelligent type detection.
 * 
 * @example
 * ```typescript
 * // Activated automatically by VS Code when extension loads
 * const extension = new CodeVisualizerExtension(context);
 * ```
 */
export class CodeVisualizerExtension {
  private disposables: vscode.Disposable[] = [];
  private container: ServiceContainer;
  
  // Services (resolved from container)
  private functionDetector!: IFunctionDetectorService;
  private cacheManager!: ICacheManager;
  private aiProvider!: IAIProviderService;
  private diagramGenerator!: IDiagramGeneratorService;
  
  // UI (resolved from container)
  private statusManager!: IStatusManager;
  private webviewManager!: IWebviewManager;
  private hoverProvider!: IHoverProvider;

  /**
   * Initialize the Code Visualizer extension.
   * 
   * Sets up dependency injection container, resolves all services,
   * registers VS Code commands, and initializes hover providers.
   * 
   * @param context - VS Code extension context for access to APIs and storage
   */
  constructor(private context: vscode.ExtensionContext) {
    this.container = setupContainer(context);
    this.initializeServices();
    this.registerCommands();
    this.registerProviders();
  }

  private initializeServices(): void {
    // Resolve services from DI container
    this.functionDetector = this.container.resolve<IFunctionDetectorService>(SERVICE_IDENTIFIERS.FUNCTION_DETECTOR);
    this.cacheManager = this.container.resolve<ICacheManager>(SERVICE_IDENTIFIERS.CACHE_MANAGER);
    this.aiProvider = this.container.resolve<IAIProviderService>(SERVICE_IDENTIFIERS.AI_PROVIDER);
    this.diagramGenerator = this.container.resolve<IDiagramGeneratorService>(SERVICE_IDENTIFIERS.DIAGRAM_GENERATOR);
    this.statusManager = this.container.resolve<IStatusManager>(SERVICE_IDENTIFIERS.STATUS_MANAGER);
    this.webviewManager = this.container.resolve<IWebviewManager>(SERVICE_IDENTIFIERS.WEBVIEW_MANAGER);
    this.hoverProvider = this.container.resolve<IHoverProvider>(SERVICE_IDENTIFIERS.HOVER_PROVIDER);
  }

  private registerCommands(): void {
    // Main diagram commands
    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.showDiagram', () => this.showDiagram())
    );
    
    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.showDiagramPanel', () => this.showDiagramPanel())
    );

    // Configuration commands
    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.storeApiToken', () => this.storeApiToken())
    );

    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.clearCache', () => this.clearCache())
    );

    // Analytics and export commands
    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.showAnalytics', () => this.showAnalytics())
    );

    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.exportDiagram', () => this.exportDiagram())
    );

    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.configureDiagramType', () => this.configureDiagramType())
    );
  }

  private registerProviders(): void {
    // Register hover provider for supported languages
    const supportedLanguages = [
      'javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust', 'php', 'ruby',
      'cpp', 'c', 'kotlin', 'swift', 'scala', 'dart'
    ];

    for (const language of supportedLanguages) {
      this.disposables.push(
        vscode.languages.registerHoverProvider(language, this.hoverProvider)
      );
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.cacheManager.initialize();
      this.statusManager.showNotification('Code Visualizer initialized successfully', 'info');
    } catch (error) {
      console.error('Failed to initialize Code Visualizer:', error);
      this.statusManager.showNotification('Failed to initialize Code Visualizer', 'error');
    }
  }

  private async showDiagram(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.statusManager.showNotification('No active editor found', 'warning');
      return;
    }

    if (!this.functionDetector.isSupported(editor.document)) {
      this.statusManager.showNotification(`Language ${editor.document.languageId} is not supported`, 'warning');
      return;
    }

    const functionInfo = this.functionDetector.extractFunctionAtPosition(editor.document, editor.selection.active);
    if (!functionInfo) {
      this.statusManager.showNotification('No function found at cursor position', 'warning');
      return;
    }

    await this.generateAndShowDiagram(functionInfo, true);
  }

  private async showDiagramPanel(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.statusManager.showNotification('No active editor found', 'warning');
      return;
    }

    if (!this.functionDetector.isSupported(editor.document)) {
      this.statusManager.showNotification(`Language ${editor.document.languageId} is not supported`, 'warning');
      return;
    }

    const functionInfo = this.functionDetector.extractFunctionAtPosition(editor.document, editor.selection.active);
    if (!functionInfo) {
      this.statusManager.showNotification('No function found at cursor position', 'warning');
      return;
    }

    await this.generateAndShowDiagram(functionInfo, true);
  }

  private async generateAndShowDiagram(functionInfo: FunctionInfo, showPanel: boolean = false): Promise<void> {
    const cacheKey = `${functionInfo.name}:${functionInfo.code}`;
    
    try {
      // Check cache first
      let cachedDiagram = await this.cacheManager.get(cacheKey);
      
      if (!cachedDiagram) {
        // Generate new diagram
        await this.statusManager.showProgress('Generating diagram...', async (progress) => {
          progress('Analyzing code...');
          
          const analysis = this.functionDetector.analyzeCode(functionInfo.code, functionInfo.language);
          
          progress('Determining best diagram type...');
          const diagramType = this.diagramGenerator.analyzeBestDiagramType(functionInfo.code, functionInfo.language);
          
          progress(`Generating ${diagramType} diagram...`);
          const result = await this.diagramGenerator.generateDiagram(functionInfo, diagramType);
          
          progress('Caching diagram...');
          await this.cacheManager.set(cacheKey, result.diagram, {
            diagramType: result.type,
            timestamp: Date.now(),
            codeHash: cacheKey,
            functionName: functionInfo.name,
            language: functionInfo.language,
            codeAnalysis: analysis,
            lastAccessed: Date.now(),
            accessCount: 1
          });
          
          cachedDiagram = await this.cacheManager.get(cacheKey);
        });
      }

      if (cachedDiagram) {
        if (showPanel) {
          this.webviewManager.createDiagramPanel(
            cachedDiagram.diagram,
            cachedDiagram.diagramType as DiagramType,
            functionInfo
          );
        } else {
          this.statusManager.showNotification('Diagram generated successfully! Hover over function to see preview.', 'info');
        }
      }
    } catch (error) {
      console.error('Error generating diagram:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.statusManager.showNotification(`Failed to generate diagram: ${errorMessage}`, 'error');
      
      // Also show as information dialog for better visibility
      vscode.window.showErrorMessage(`Code Visualizer Error:\n\n${errorMessage}`, 'Configure Token').then(selection => {
        if (selection === 'Configure Token') {
          this.storeApiToken();
        }
      });
    }
  }

  private async storeApiToken(): Promise<void> {
    const providerNames = this.aiProvider.getProviderNames();
    const provider = await vscode.window.showQuickPick(
      providerNames,
      { placeHolder: 'Select AI provider' }
    );

    if (!provider) {
      return;
    }

    const token = await vscode.window.showInputBox({
      prompt: `Enter API token for ${provider}`,
      password: true,
      placeHolder: 'Your API token'
    });

    if (token) {
      await this.context.secrets.store(`codeVisualizer.token.${provider}`, token);
      this.statusManager.showNotification(`API token stored securely for ${provider}`, 'info');
    }
  }

  private async clearCache(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'This will clear all cached diagrams. Continue?',
      'Yes',
      'No'
    );

    if (confirm === 'Yes') {
      await this.cacheManager.clear();
      this.statusManager.showNotification('Cache cleared successfully', 'info');
    }
  }

  private async showAnalytics(): Promise<void> {
    const stats = this.cacheManager.getStats();
    const metadata = this.cacheManager.getMetadata();
    const message = `Cache Statistics:
• Total entries: ${stats.totalEntries}
• Cache size: ${stats.cacheSize} bytes
• Hit rate: ${(stats.hitRate * 100).toFixed(1)}%
• Last cleanup: ${new Date(stats.lastCleanup).toLocaleString()}
• Version: ${metadata.version}`;

    vscode.window.showInformationMessage(message);
  }

  private async exportDiagram(): Promise<void> {
    this.statusManager.showNotification('Export functionality coming soon!', 'info');
  }

  private async configureDiagramType(): Promise<void> {
    this.statusManager.showNotification('Diagram type configuration coming soon!', 'info');
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.statusManager.dispose?.();
    this.webviewManager.dispose?.();
    this.hoverProvider.dispose?.();
  }
}

// Extension activation
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const extension = new CodeVisualizerExtension(context);
  await extension.initialize();
  context.subscriptions.push(extension);
}

export function deactivate(): void {
  // Extension cleanup is handled by dispose methods
}