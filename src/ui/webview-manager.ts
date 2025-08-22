import * as vscode from 'vscode';
import { DiagramType, DiagramTypeConfig, FunctionInfo } from '../types';
import { generateNonce, escapeHtml } from '../utils/helpers';
import { DIAGRAM_THEMES } from '../utils/constants';
import { IWebviewManager } from '../interfaces/webview-manager.interface';

export class WebviewManager implements IWebviewManager {
  private currentPanel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  createDiagramPanel(diagram: string, diagramType: DiagramType, functionInfo: FunctionInfo): vscode.WebviewPanel {
    // Close existing panel
    if (this.currentPanel) {
      this.currentPanel.dispose();
    }

    // Create new panel
    this.currentPanel = vscode.window.createWebviewPanel(
      'codeVisualizerDiagram',
      `📊 ${functionInfo.name} - Diagram`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
          vscode.Uri.joinPath(this.context.extensionUri, 'out')
        ]
      }
    );

    // Set webview content
    this.currentPanel.webview.html = this.generateWebviewContent(diagram, diagramType, functionInfo, 'dark');

    // Handle panel disposal
    this.currentPanel.onDidDispose(() => {
      this.currentPanel = undefined;
    });

    return this.currentPanel;
  }



  // Interface methods
  updateDiagram(diagram: string, diagramType: DiagramType): void {
    if (this.currentPanel && this.currentPanel.webview) {
      this.currentPanel.webview.postMessage({
        command: 'updateDiagram',
        diagram,
        diagramType
      });
    }
  }

  closePanel(): void {
    if (this.currentPanel) {
      this.currentPanel.dispose();
      this.currentPanel = undefined;
    }
  }

  isPanelOpen(): boolean {
    return this.currentPanel !== undefined;
  }

  getCurrentPanel(): vscode.WebviewPanel | undefined {
    return this.currentPanel;
  }

  // Interface method implementation
  generateWebviewContent(
    diagram: string, 
    diagramType: DiagramType, 
    functionInfo: FunctionInfo,
    theme: string = 'dark'
  ): string {
    const nonce = generateNonce();
    const functionName = escapeHtml(functionInfo.name);
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${functionName} Diagram</title>
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.4/dist/mermaid.min.js"></script>
    </head>
    <body>
        <div id="diagram" class="mermaid">${escapeHtml(diagram)}</div>
        <script nonce="${nonce}">
            mermaid.initialize({ theme: '${theme}' });
        </script>
    </body>
    </html>`;
  }

  handleWebviewMessage(message: any): void {
    // Handle messages from webview
    switch (message.command) {
      case 'export':
        this.exportDiagram(message.format, message.path);
        break;
      case 'regenerate':
        // Handle regeneration
        break;
    }
  }

  async exportDiagram(format: 'png' | 'svg' | 'pdf', path: string): Promise<void> {
    // Export functionality would be implemented here
    throw new Error('Export functionality not yet implemented');
  }

  dispose(): void {
    if (this.currentPanel) {
      this.currentPanel.dispose();
    }
  }
}