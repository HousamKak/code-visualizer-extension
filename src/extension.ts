import * as vscode from 'vscode';
import { DiagramType, FunctionInfo } from './types';
import { setupContainer } from './container/container-setup';
import { serviceIdentifiers } from './interfaces/container.interface';
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
    this.functionDetector = this.container.resolve<IFunctionDetectorService>(serviceIdentifiers.FUNCTION_DETECTOR);
    this.cacheManager = this.container.resolve<ICacheManager>(serviceIdentifiers.CACHE_MANAGER);
    this.aiProvider = this.container.resolve<IAIProviderService>(serviceIdentifiers.AI_PROVIDER);
    this.diagramGenerator = this.container.resolve<IDiagramGeneratorService>(serviceIdentifiers.DIAGRAM_GENERATOR);
    this.statusManager = this.container.resolve<IStatusManager>(serviceIdentifiers.STATUS_MANAGER);
    this.webviewManager = this.container.resolve<IWebviewManager>(serviceIdentifiers.WEBVIEW_MANAGER);
    this.hoverProvider = this.container.resolve<IHoverProvider>(serviceIdentifiers.HOVER_PROVIDER);
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

    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.selectModel', () => this.selectModel())
    );

    // Regeneration command for webview
    this.disposables.push(
      vscode.commands.registerCommand('codeVisualizer.generateDiagram', () => this.regenerateDiagram())
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
    
    console.log(`[EXTENSION] Starting diagram generation for function: ${functionInfo.name}`);
    console.log(`[EXTENSION] Function code length: ${functionInfo.code.length}, Language: ${functionInfo.language}`);
    
    try {
      // Check cache first
      let cachedDiagram = await this.cacheManager.get(cacheKey);
      
      if (cachedDiagram) {
        console.log(`[EXTENSION] Found cached diagram for: ${functionInfo.name}`);
      } else {
        console.log(`[EXTENSION] No cached diagram found, generating new one...`);
      }
      
      if (!cachedDiagram) {
        // Generate new diagram
        await this.statusManager.showProgress('Generating diagram...', async (progress) => {
          progress('Analyzing code...');
          
          const analysis = this.functionDetector.analyzeCode(functionInfo.code, functionInfo.language);
          
          progress('Determining best diagram type...');
          const diagramType = this.diagramGenerator.analyzeBestDiagramType(functionInfo.code, functionInfo.language);
          
          progress(`Generating ${diagramType} diagram...`);
          console.log(`[EXTENSION] Calling diagram generator for type: ${diagramType}`);
          const result = await this.diagramGenerator.generateDiagram(functionInfo, diagramType);
          console.log(`[EXTENSION] Diagram generated successfully, length: ${result.diagram.length}`);
          console.log(`[EXTENSION] Explanation length: ${result.explanation?.length || 0}`);

          progress('Caching diagram...');
          await this.cacheManager.set(cacheKey, result.diagram, {
            diagramType: result.type,
            timestamp: Date.now(),
            codeHash: cacheKey,
            functionName: functionInfo.name,
            language: functionInfo.language,
            codeAnalysis: analysis,
            explanation: result.explanation,
            lastAccessed: Date.now(),
            accessCount: 1
          });
          
          cachedDiagram = await this.cacheManager.get(cacheKey);
        });
      }

      if (cachedDiagram) {
        console.log(`[EXTENSION] Displaying diagram, type: ${cachedDiagram.diagramType}, showPanel: ${showPanel}`);
        if (showPanel) {
          console.log(`[EXTENSION] Creating webview panel with diagram length: ${cachedDiagram.diagram.length}`);
          this.webviewManager.createDiagramPanel(
            cachedDiagram.diagram,
            cachedDiagram.diagramType as DiagramType,
            functionInfo,
            cachedDiagram.explanation,
            cachedDiagram.versions
          );
        } else {
          this.statusManager.showNotification('Diagram generated successfully! Hover over function to see preview.', 'info');
        }
      } else {
        console.log(`[EXTENSION] ERROR: No cached diagram found after generation attempt`);
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

  private async selectModel(): Promise<void> {
    const models = [
      { label: '$(shield) GPT-4.1', description: 'OpenAI - General availability', value: 'gpt-4.1' },
      { label: '$(rocket) GPT-5', description: 'OpenAI - Latest flagship', value: 'gpt-5' },
      { label: '$(zap) GPT-5 Mini', description: 'OpenAI - Lighter GPT-5 tier', value: 'gpt-5-mini' },
      { label: '$(symbol-function) GPT-5 Codex', description: 'OpenAI - Code-optimized preview', value: 'gpt-5-codex' },
      { label: '$(comment-discussion) Claude Haiku 4.5', description: 'Anthropic - Fastest Claude', value: 'claude-haiku-4.5' },
      { label: '$(comment) Claude Opus 4.1', description: 'Anthropic - Enterprise reasoning', value: 'claude-opus-4.1' },
      { label: '$(comment) Claude Sonnet 4', description: 'Anthropic - Balanced Claude', value: 'claude-sonnet-4' },
      { label: '$(comment) Claude Sonnet 4.5', description: 'Anthropic - Latest Sonnet', value: 'claude-sonnet-4.5' },
      { label: '$(globe) Gemini 2.5 Pro', description: 'Google - Multimodal GA', value: 'gemini-2.5-pro' },
      { label: '$(pulse) Grok Code Fast 1', description: 'xAI - Public preview', value: 'grok-code-fast-1' },
      { label: '$(star) GPT-4 Omni', description: 'OpenAI - Most advanced (Recommended)', value: 'gpt-4o' },
      { label: '$(zap) GPT-4 Omni Mini', description: 'OpenAI - Faster GPT-4o variant', value: 'gpt-4o-mini' },
      { label: '$(rocket) GPT-4 Turbo', description: 'OpenAI - Previous generation', value: 'gpt-4-turbo' },
      { label: '$(lightbulb) O1 Preview', description: 'OpenAI - Reasoning model', value: 'o1-preview' },
      { label: '$(light-bulb) O1 Mini', description: 'OpenAI - Smaller reasoning', value: 'o1-mini' },
      { label: '$(chip) Llama 3.1 405B', description: 'Meta - Largest (405B params)', value: 'Meta-Llama-3.1-405B-Instruct' },
      { label: '$(database) Llama 3.1 70B', description: 'Meta - Latest 70B', value: 'Meta-Llama-3.1-70B-Instruct' },
      { label: '$(symbol-misc) Llama 3.1 8B', description: 'Meta - Efficient 8B', value: 'Meta-Llama-3.1-8B-Instruct' },
      { label: '$(extensions) Llama 3 70B', description: 'Meta - 70B base model', value: 'Meta-Llama-3-70B-Instruct' },
      { label: '$(code) Llama 3 8B', description: 'Meta - 8B base model', value: 'Meta-Llama-3-8B-Instruct' },
      { label: '$(target) Phi-3.5 Mini', description: 'Microsoft - Latest mini', value: 'Phi-3.5-mini-instruct' },
      { label: '$(workspace-trusted) Phi-3.5 MoE', description: 'Microsoft - Mix of Experts', value: 'Phi-3.5-MoE-instruct' },
      { label: '$(server) Phi-3 Medium 128K', description: 'Microsoft - 128K context', value: 'Phi-3-medium-128k-instruct' },
      { label: '$(arrow-small-right) Phi-3 Mini 128K', description: 'Microsoft - Mini 128K', value: 'Phi-3-mini-128k-instruct' },
      { label: '$(pulse) Mistral Large', description: 'Mistral - Flagship', value: 'Mistral-large' },
      { label: '$(circuit-board) Mistral Large 2407', description: 'Mistral - Updated large', value: 'Mistral-large-2407' },
      { label: '$(flame) Mistral Nemo', description: 'Mistral - Efficient 12B', value: 'Mistral-Nemo' },
      { label: '$(beaker) Mistral Small', description: 'Mistral - Compact', value: 'Mistral-small' },
      { label: '$(tools) Cohere Command R', description: 'Cohere - Base model', value: 'Cohere-command-r' },
      { label: '$(tools) Cohere Command R+', description: 'Cohere - Plus variant', value: 'Cohere-command-r-plus' },
      { label: '$(symbol-parameter) Jamba 1.5 Large', description: 'AI21 - Hybrid large', value: 'AI21-Jamba-1.5-Large' },
      { label: '$(symbol-constant) Jamba 1.5 Mini', description: 'AI21 - Hybrid mini', value: 'AI21-Jamba-1.5-Mini' }
    ];

    const currentModel = vscode.workspace.getConfiguration('codeVisualizer').get<string>('githubModel', 'gpt-4o');
    const currentItem = models.find(m => m.value === currentModel);

    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: `Current: ${currentItem?.label || currentModel}`,
      title: 'Select AI Model for Diagram Generation',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await vscode.workspace.getConfiguration('codeVisualizer').update('githubModel', selected.value, vscode.ConfigurationTarget.Global);

      // Show confirmation with info about when change takes effect
      const choice = await vscode.window.showInformationMessage(
        `Model changed to: ${selected.description}\n\nNote: The change will take effect after reloading VS Code.`,
        'Reload Now',
        'Later'
      );

      if (choice === 'Reload Now') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    }
  }

  private async regenerateDiagram(): Promise<void> {
    // Check if there's a regeneration request from webview
    const regenerateRequest = this.context.globalState.get('lastRegenerateRequest') as any;

    if (regenerateRequest && Date.now() - regenerateRequest.timestamp < 30000) {
      // Use the stored request data
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        this.statusManager.showNotification('No active editor found', 'warning');
        return;
      }

      const functionInfo = this.functionDetector.extractFunctionAtPosition(editor.document, editor.selection.active);
      if (!functionInfo) {
        this.statusManager.showNotification('No function found at cursor position', 'warning');
        return;
      }

      // Clear the regeneration request
      this.context.globalState.update('lastRegenerateRequest', undefined);

      const cacheKey = `${functionInfo.name}:${functionInfo.code}`;

      // Generate new diagram with progress indicator
      await this.statusManager.showProgress('Regenerating diagram...', async (progress) => {
        progress('Analyzing code...');

        progress('Determining best diagram type...');
        const diagramType = this.diagramGenerator.analyzeBestDiagramType(functionInfo.code, functionInfo.language);

        progress(`Generating ${diagramType} diagram...`);
        const result = await this.diagramGenerator.generateDiagram(functionInfo, diagramType);

        progress('Saving as new version...');

        // Add as new version in cache
        const versionId = await this.cacheManager.addVersion(
          cacheKey,
          result.diagram,
          'regenerated',
          result.explanation,
          'Regenerated with AI'
        );

        // Update current version to the new one
        await this.cacheManager.setCurrentVersion(cacheKey, versionId);

        // Get updated cache with versions
        const cachedDiagram = await this.cacheManager.get(cacheKey);

        if (cachedDiagram) {
          // Update the webview with new diagram
          this.webviewManager.updateDiagram(
            cachedDiagram.diagram,
            cachedDiagram.diagramType as DiagramType,
            cachedDiagram.explanation
          );

          this.statusManager.showNotification('Diagram regenerated successfully!', 'info');
        }
      });
    } else {
      // Fallback to normal diagram generation
      await this.showDiagramPanel();
    }
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
