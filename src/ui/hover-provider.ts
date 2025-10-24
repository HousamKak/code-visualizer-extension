import * as vscode from 'vscode';
import { FunctionInfo } from '../types';
import { IFunctionDetectorService } from '../interfaces/function-detector.interface';
import { ICacheManager } from '../interfaces/cache-manager.interface';
import { escapeHtml } from '../utils/helpers';
import { IHoverProvider } from '../interfaces/hover-provider.interface';

export class HoverProvider implements IHoverProvider {
  private debounceMap = new Map<string, NodeJS.Timeout>();
  private enabled = true;

  constructor(
    private functionDetector: IFunctionDetectorService,
    private cacheManager: ICacheManager
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Check if hover is enabled
    const hoverEnabled = vscode.workspace.getConfiguration('codeVisualizer').get<boolean>('enableHover', true);
    if (!hoverEnabled) {
      return null;
    }

    // Check if language is supported
    if (!this.functionDetector.isSupported(document)) {
      return null;
    }

    // Extract function at position
    const functionInfo = this.functionDetector.extractFunctionAtPosition(document, position);
    if (!functionInfo) {
      return null;
    }

    // Debounce hover requests
    const debounceKey = `${document.uri.toString()}:${position.line}:${position.character}`;
    const existingTimeout = this.debounceMap.get(debounceKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        this.debounceMap.delete(debounceKey);
        
        if (token.isCancellationRequested) {
          resolve(null);
          return;
        }

        try {
          const hover = await this.createHover(functionInfo);
          resolve(hover);
        } catch (error) {
          console.error('Error creating hover:', error);
          resolve(null);
        }
      }, 300); // 300ms debounce

      this.debounceMap.set(debounceKey, timeout);
    });
  }

  private async createHover(functionInfo: FunctionInfo): Promise<vscode.Hover> {
    // Check cache for existing diagram
    const cacheKey = `${functionInfo.name}:${functionInfo.code}`;
    const cachedDiagram = await this.cacheManager.get(cacheKey);
    
    if (cachedDiagram && cachedDiagram.metadata?.diagramType) {
      return this.createHoverWithDiagram(functionInfo, cachedDiagram.diagram, cachedDiagram.metadata.diagramType);
    } else {
      return this.createSimpleHover(functionInfo);
    }
  }

  private createHoverWithDiagram(functionInfo: FunctionInfo, diagram: string, diagramType: string): vscode.Hover {
    const markdownString = new vscode.MarkdownString();
    markdownString.isTrusted = true;
    markdownString.supportHtml = true;

    markdownString.appendMarkdown(`### 📊 ${functionInfo.name}\n\n`);
    markdownString.appendMarkdown(`**Diagram Available:** \`${diagramType}\` diagram is cached and ready\n\n`);
    markdownString.appendMarkdown(`**Function Info:**\n`);
    markdownString.appendMarkdown(`- Type: \`${functionInfo.type}\`\n`);
    markdownString.appendMarkdown(`- Language: \`${functionInfo.language}\`\n`);
    markdownString.appendMarkdown(`- Lines: ${functionInfo.startLine + 1}-${functionInfo.endLine + 1}\n`);
    markdownString.appendMarkdown(`- Size: ${functionInfo.code.length} characters\n\n`);
    markdownString.appendMarkdown('💡 *Use Ctrl+Shift+D to open interactive diagram*');

    return new vscode.Hover(markdownString);
  }

  private createSimpleHover(functionInfo: FunctionInfo): vscode.Hover {
    const markdownString = new vscode.MarkdownString();
    markdownString.isTrusted = true;
    markdownString.supportHtml = true;

    markdownString.appendMarkdown(`### 📊 ${functionInfo.name}\n\n`);
    markdownString.appendMarkdown('**No diagram cached. Generate one to see the visualization.**\n\n');
    markdownString.appendMarkdown(`**Function Info:**\n`);
    markdownString.appendMarkdown(`- Type: \`${functionInfo.type}\`\n`);
    markdownString.appendMarkdown(`- Language: \`${functionInfo.language}\`\n`);
    markdownString.appendMarkdown(`- Lines: ${functionInfo.startLine + 1}-${functionInfo.endLine + 1}\n`);
    markdownString.appendMarkdown(`- Size: ${functionInfo.code.length} characters\n\n`);
    markdownString.appendMarkdown('💡 *Use Ctrl+Shift+D to generate and view diagram*');

    return new vscode.Hover(markdownString);
  }

  // Interface methods
  async generateHoverDiagram(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string | null> {
    const functionInfo = this.functionDetector.extractFunctionAtPosition(document, position);
    if (!functionInfo) {return null;}

    const cacheKey = `${functionInfo.name}:${functionInfo.code}`;
    const cachedDiagram = await this.cacheManager.get(cacheKey);
    
    return cachedDiagram ? cachedDiagram.diagram : null;
  }

  shouldShowHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    if (!this.enabled) {return false;}
    if (!this.functionDetector.isSupported(document)) {return false;}
    
    const hoverEnabled = vscode.workspace.getConfiguration('codeVisualizer').get<boolean>('enableHover', true);
    return hoverEnabled;
  }

  clearCache(): void {
    this.cacheManager.clear();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {
    // Clear all debounce timeouts
    for (const timeout of this.debounceMap.values()) {
      clearTimeout(timeout);
    }
    this.debounceMap.clear();
  }
}