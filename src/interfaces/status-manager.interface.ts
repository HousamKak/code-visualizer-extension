export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface IStatusManager {
  /**
   * Show notification to user
   */
  showNotification(message: string, type: NotificationType, duration?: number): void;
  
  /**
   * Update status bar with current operation
   */
  updateStatus(message: string, isLoading?: boolean): void;
  
  /**
   * Clear status bar
   */
  clearStatus(): void;
  
  /**
   * Show progress indicator
   */
  showProgress(
    title: string, 
    task: (progress: (message: string, increment?: number) => void) => Promise<void>
  ): Promise<void>;
  
  /**
   * Set status bar priority
   */
  setPriority(priority: number): void;
  
  /**
   * Check if notifications are enabled
   */
  areNotificationsEnabled(): boolean;
  
  /**
   * Toggle notifications
   */
  toggleNotifications(enabled: boolean): void;

  /**
   * Dispose resources
   */
  dispose?(): void;
}