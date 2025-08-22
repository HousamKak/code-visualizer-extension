import * as vscode from 'vscode';

export interface IHoverProvider extends vscode.HoverProvider {
  /**
   * Provide hover information
   */
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null>;
  
  /**
   * Generate diagram for hover
   */
  generateHoverDiagram(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string | null>;
  
  /**
   * Check if hover should be shown at position
   */
  shouldShowHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean;
  
  /**
   * Clear hover cache
   */
  clearCache(): void;
  
  /**
   * Enable/disable hover functionality
   */
  setEnabled(enabled: boolean): void;
  
  /**
   * Check if hover is enabled
   */
  isEnabled(): boolean;

  /**
   * Dispose resources
   */
  dispose?(): void;
}