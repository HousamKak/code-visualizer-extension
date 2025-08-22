export type ServiceIdentifier<T = {}> = string | symbol | Function;
export type ServiceFactory<T = any> = () => T;

export interface IServiceContainer {
  /**
   * Register a service with the container
   */
  register<T>(identifier: ServiceIdentifier<T>, implementation: new (...args: any[]) => T): void;
  
  /**
   * Register a singleton service
   */
  registerSingleton<T>(identifier: ServiceIdentifier<T>, implementation: new (...args: any[]) => T): void;
  
  /**
   * Register a factory function
   */
  registerFactory<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void;
  
  /**
   * Register an instance
   */
  registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): void;
  
  /**
   * Resolve a service from the container
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T;
  
  /**
   * Check if service is registered
   */
  isRegistered<T>(identifier: ServiceIdentifier<T>): boolean;
  
  /**
   * Clear all registrations
   */
  clear(): void;
  
  /**
   * Get all registered service identifiers
   */
  getRegisteredServices(): ServiceIdentifier[];
}

export const SERVICE_IDENTIFIERS = {
  // Services
  AI_PROVIDER: Symbol('AIProviderService'),
  CACHE_MANAGER: Symbol('CacheManager'),
  DIAGRAM_GENERATOR: Symbol('DiagramGeneratorService'),
  FUNCTION_DETECTOR: Symbol('FunctionDetectorService'),
  
  // UI
  STATUS_MANAGER: Symbol('StatusManager'),
  WEBVIEW_MANAGER: Symbol('WebviewManager'),
  HOVER_PROVIDER: Symbol('HoverProvider'),
  
  // External Dependencies
  EXTENSION_CONTEXT: Symbol('ExtensionContext'),
  FILE_SYSTEM: Symbol('FileSystem'),
  HTTP_CLIENT: Symbol('HttpClient')
} as const;