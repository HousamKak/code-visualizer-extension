import * as vscode from 'vscode';
import { DiagramType, FunctionInfo } from '../types';

export interface IWebviewManager {
  /**
   * Create diagram panel with diagram, explanation, and version history
   */
  createDiagramPanel(
    diagram: string,
    diagramType: DiagramType,
    functionInfo: FunctionInfo,
    explanation?: string,
    versions?: any[]
  ): vscode.WebviewPanel;

  /**
   * Update existing diagram panel
   */
  updateDiagram(diagram: string, diagramType: DiagramType, explanation?: string): void;
  
  /**
   * Close current panel
   */
  closePanel(): void;
  
  /**
   * Check if panel is currently open
   */
  isPanelOpen(): boolean;
  
  /**
   * Get current panel
   */
  getCurrentPanel(): vscode.WebviewPanel | undefined;
  
  /**
   * Generate HTML content for webview
   */
  generateWebviewContent(
    diagram: string, 
    diagramType: DiagramType, 
    functionInfo: FunctionInfo,
    theme: string
  ): string;
  
  /**
   * Handle webview messages
   */
  handleWebviewMessage(message: any): void;
  
  /**
   * Export diagram to file
   */
  exportDiagram(format: 'png' | 'svg' | 'pdf', path: string): Promise<void>;

  /**
   * Dispose resources
   */
  dispose?(): void;
}