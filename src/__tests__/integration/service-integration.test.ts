import * as vscode from 'vscode';
import { setupContainer } from '../../container/container-setup';
import { ServiceContainer } from '../../container/service-container';
import { serviceIdentifiers } from '../../interfaces/container.interface';
import { IFunctionDetectorService } from '../../interfaces/function-detector.interface';
import { IAIProviderService } from '../../interfaces/ai-provider.interface';
import { IDiagramGeneratorService } from '../../interfaces/diagram-generator.interface';

jest.mock('vscode');

describe('Service Integration Tests', () => {
  let container: ServiceContainer;
  const mockContext = {
    globalStorageUri: { fsPath: '/mock/storage' },
    globalState: {
      get: jest.fn(),
      update: jest.fn()
    },
    secrets: {
      get: jest.fn(),
      store: jest.fn()
    }
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    container = setupContainer(mockContext);
  });

  describe('Container Setup', () => {
    it('should resolve function detector service', () => {
      const service = container.resolve<IFunctionDetectorService>(serviceIdentifiers.FUNCTION_DETECTOR);
      expect(service).toBeDefined();
      expect(typeof service.getAllFunctions).toBe('function');
      expect(typeof service.extractFunctionAtPosition).toBe('function');
    });

    it('should resolve AI provider service', () => {
      const service = container.resolve<IAIProviderService>(serviceIdentifiers.AI_PROVIDER);
      expect(service).toBeDefined();
      expect(typeof service.generateDiagram).toBe('function');
      expect(typeof service.getProviders).toBe('function');
    });

    it('should resolve diagram generator service', () => {
      const service = container.resolve<IDiagramGeneratorService>(serviceIdentifiers.DIAGRAM_GENERATOR);
      expect(service).toBeDefined();
      expect(typeof service.generateDiagram).toBe('function');
    });

    it('should provide singleton instances', () => {
      const service1 = container.resolve<IAIProviderService>(serviceIdentifiers.AI_PROVIDER);
      const service2 = container.resolve<IAIProviderService>(serviceIdentifiers.AI_PROVIDER);
      expect(service1).toBe(service2);
    });
  });

  describe('Service Interactions', () => {
    it('should have compatible service interfaces', () => {
      const functionDetector = container.resolve<IFunctionDetectorService>(serviceIdentifiers.FUNCTION_DETECTOR);
      const aiProvider = container.resolve<IAIProviderService>(serviceIdentifiers.AI_PROVIDER);
      const diagramGenerator = container.resolve<IDiagramGeneratorService>(serviceIdentifiers.DIAGRAM_GENERATOR);

      // Test that services can work together
      expect(functionDetector).toBeDefined();
      expect(aiProvider).toBeDefined();
      expect(diagramGenerator).toBeDefined();

      // Verify expected provider names
      const providerNames = aiProvider.getProviderNames();
      expect(providerNames).toContain('github');
      expect(providerNames).toContain('openai');
    });

    it('should handle basic analysis', () => {
      const functionDetector = container.resolve<IFunctionDetectorService>(serviceIdentifiers.FUNCTION_DETECTOR);
      
      const sampleCode = `function hello() { console.log('world'); }`;
      const analysis = functionDetector.analyzeCode(sampleCode, 'javascript');
      expect(analysis).toBeDefined();
      expect(typeof analysis.hasAsyncOperations).toBe('boolean');
    });
  });
});