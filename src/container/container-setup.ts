import * as vscode from 'vscode';
import { ServiceContainer } from './service-container';
import { serviceIdentifiers } from '../interfaces/container.interface';

// Import service implementations
import { AIProviderService } from '../services/ai-provider';
import { CacheManager } from '../services/cache-manager';
import { DiagramGeneratorService } from '../services/diagram-generator';
import { FunctionDetectorService } from '../services/function-detector';
import { StatusManager } from '../ui/status-manager';
import { WebviewManager } from '../ui/webview-manager';
import { HoverProvider } from '../ui/hover-provider';

export function setupContainer(context: vscode.ExtensionContext): ServiceContainer {
  const container = new ServiceContainer();

  // Register external dependencies
  container.registerInstance(serviceIdentifiers.EXTENSION_CONTEXT, context);

  // Register services
  container.registerSingleton(serviceIdentifiers.FUNCTION_DETECTOR, FunctionDetectorService);
  container.registerSingleton(serviceIdentifiers.CACHE_MANAGER, CacheManager);
  container.registerSingleton(serviceIdentifiers.AI_PROVIDER, AIProviderService);
  container.registerSingleton(serviceIdentifiers.DIAGRAM_GENERATOR, DiagramGeneratorService);

  // Register UI services
  container.registerSingleton(serviceIdentifiers.STATUS_MANAGER, StatusManager);
  container.registerSingleton(serviceIdentifiers.WEBVIEW_MANAGER, WebviewManager);
  container.registerSingleton(serviceIdentifiers.HOVER_PROVIDER, HoverProvider);

  // Set up dependencies manually (since we're not using decorators)
  setupDependencies(container);

  return container;
}

function setupDependencies(container: ServiceContainer): void {
  // CacheManager depends on ExtensionContext
  container.setDependencies(serviceIdentifiers.CACHE_MANAGER, [
    serviceIdentifiers.EXTENSION_CONTEXT
  ]);

  // DiagramGeneratorService depends on AIProviderService and ExtensionContext
  container.setDependencies(serviceIdentifiers.DIAGRAM_GENERATOR, [
    serviceIdentifiers.AI_PROVIDER,
    serviceIdentifiers.EXTENSION_CONTEXT
  ]);

  // WebviewManager depends on ExtensionContext
  container.setDependencies(serviceIdentifiers.WEBVIEW_MANAGER, [
    serviceIdentifiers.EXTENSION_CONTEXT
  ]);

  // HoverProvider depends on FunctionDetectorService and CacheManager
  container.setDependencies(serviceIdentifiers.HOVER_PROVIDER, [
    serviceIdentifiers.FUNCTION_DETECTOR,
    serviceIdentifiers.CACHE_MANAGER
  ]);
}