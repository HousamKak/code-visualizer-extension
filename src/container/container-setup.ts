import * as vscode from 'vscode';
import { ServiceContainer } from './service-container';
import { SERVICE_IDENTIFIERS } from '../interfaces/container.interface';

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
  container.registerInstance(SERVICE_IDENTIFIERS.EXTENSION_CONTEXT, context);

  // Register services
  container.registerSingleton(SERVICE_IDENTIFIERS.FUNCTION_DETECTOR, FunctionDetectorService);
  container.registerSingleton(SERVICE_IDENTIFIERS.CACHE_MANAGER, CacheManager);
  container.registerSingleton(SERVICE_IDENTIFIERS.AI_PROVIDER, AIProviderService);
  container.registerSingleton(SERVICE_IDENTIFIERS.DIAGRAM_GENERATOR, DiagramGeneratorService);

  // Register UI services
  container.registerSingleton(SERVICE_IDENTIFIERS.STATUS_MANAGER, StatusManager);
  container.registerSingleton(SERVICE_IDENTIFIERS.WEBVIEW_MANAGER, WebviewManager);
  container.registerSingleton(SERVICE_IDENTIFIERS.HOVER_PROVIDER, HoverProvider);

  // Set up dependencies manually (since we're not using decorators)
  setupDependencies(container);

  return container;
}

function setupDependencies(container: ServiceContainer): void {
  // CacheManager depends on ExtensionContext
  container.setDependencies(SERVICE_IDENTIFIERS.CACHE_MANAGER, [
    SERVICE_IDENTIFIERS.EXTENSION_CONTEXT
  ]);

  // DiagramGeneratorService depends on AIProviderService and ExtensionContext
  container.setDependencies(SERVICE_IDENTIFIERS.DIAGRAM_GENERATOR, [
    SERVICE_IDENTIFIERS.AI_PROVIDER,
    SERVICE_IDENTIFIERS.EXTENSION_CONTEXT
  ]);

  // WebviewManager depends on ExtensionContext
  container.setDependencies(SERVICE_IDENTIFIERS.WEBVIEW_MANAGER, [
    SERVICE_IDENTIFIERS.EXTENSION_CONTEXT
  ]);

  // HoverProvider depends on FunctionDetectorService and CacheManager
  container.setDependencies(SERVICE_IDENTIFIERS.HOVER_PROVIDER, [
    SERVICE_IDENTIFIERS.FUNCTION_DETECTOR,
    SERVICE_IDENTIFIERS.CACHE_MANAGER
  ]);
}