import * as vscode from 'vscode';
import { IStatusManager, NotificationType } from '../interfaces/status-manager.interface';

export class StatusManager implements IStatusManager {
  private statusBarItem: vscode.StatusBarItem;
  private notificationsEnabled = true;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'codeVisualizer.showAnalytics';
  }

  updateStatus(message: string, isLoading?: boolean): void {
    if (message) {
      const icon = isLoading ? '$(sync~spin)' : '$(code)';
      this.statusBarItem.text = `${icon} ${message}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  clearStatus(): void {
    this.statusBarItem.hide();
  }

  showNotification(message: string, type: NotificationType = 'info', duration?: number): void {
    if (!this.notificationsEnabled) {return;}
    switch (type) {
      case 'error':
        vscode.window.showErrorMessage(message);
        break;
      case 'warning':
        vscode.window.showWarningMessage(message);
        break;
      case 'success':
        vscode.window.showInformationMessage(`✅ ${message}`);
        break;
      default:
        vscode.window.showInformationMessage(message);
        break;
    }
  }

  async showProgress(
    title: string,
    task: (progress: (message: string, increment?: number) => void) => Promise<void>
  ): Promise<void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
      },
      async (progress) => {
        const progressCallback = (message: string, increment?: number) => {
          progress.report({ message, increment });
        };
        await task(progressCallback);
      }
    );
  }

  setPriority(priority: number): void {
    // Status bar priority is readonly, would need to recreate item
    // For now, just store the priority value
  }

  areNotificationsEnabled(): boolean {
    return this.notificationsEnabled;
  }

  toggleNotifications(enabled: boolean): void {
    this.notificationsEnabled = enabled;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}