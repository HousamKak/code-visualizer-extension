import { DiagramGeneratorService } from '../diagram-generator';
import { IAIProviderService } from '../../interfaces/ai-provider.interface';
import { FunctionInfo } from '../../types';

// Use global vscode mock from setup.ts
const vscode = (global as any).vscode;

describe('DiagramGeneratorService - Basic Tests', () => {
  let service: DiagramGeneratorService;
  let mockAIProvider: jest.Mocked<IAIProviderService>;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAIProvider = {
      generateDiagram: jest.fn(),
      getProviders: jest.fn(),
      isProviderAvailable: jest.fn(),
      getCurrentProvider: jest.fn(),
      setProvider: jest.fn(),
      testProvider: jest.fn(),
      getProviderNames: jest.fn()
    };

    mockContext = { extensionPath: '/test/extension' };
    
    // Mock vscode configuration with consistent behavior
    const mockConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'provider': return 'github';
          case 'fallbackProviders': return true;
          default: return undefined;
        }
      })
    };
    
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
    
    // Mock vscode commands
    (vscode.commands.executeCommand as jest.Mock).mockResolvedValue('test-token');
    
    service = new DiagramGeneratorService(mockAIProvider, mockContext);
  });

  it('should identify flowchart patterns', () => {
    const code = `
      function processData(data) {
        if (data.length === 0) return null;
        for (let i = 0; i < data.length; i++) {
          if (data[i].valid) return data[i];
        }
        return null;
      }
    `;

    const result = service.analyzeBestDiagramType(code, 'javascript');
    expect(result).toBe('flowchart');
  });

  it('should identify sequence diagram patterns', () => {
    const code = `
      async function fetchUserData() {
        const response = await fetch('/api/users');
        return response.json();
      }
    `;

    const result = service.analyzeBestDiagramType(code, 'javascript');
    expect(result).toBe('sequence');
  });

  it('should return available diagram types', () => {
    const configs = service.getAvailableDiagramTypes();
    
    expect(configs).toBeInstanceOf(Array);
    expect(configs.length).toBeGreaterThan(0);
    
    const types = configs.map(config => config.type);
    expect(types).toContain('flowchart');
    expect(types).toContain('sequence');
    expect(types).toContain('classDiagram');
  });

  it('should generate diagram successfully', async () => {
    const functionInfo: FunctionInfo = {
      name: 'testFunction',
      type: 'function',
      code: 'function testFunction() { return 42; }',
      language: 'javascript',
      startLine: 0,
      endLine: 2
    };

    const expectedDiagram = 'sequenceDiagram\n    AStart -> BEnd';
    mockAIProvider.generateDiagram.mockResolvedValue(expectedDiagram);

    const result = await service.generateDiagram(functionInfo);

    expect(result.diagram).toBe(expectedDiagram);
    expect(result.type).toBe('sequence');
  });

  it('should validate diagram syntax', () => {
    const validFlowchart = 'flowchart TD\n  A --> B\n  B --> C';
    const nullInvalid = null as any;

    expect(service.validateDiagram(validFlowchart, 'flowchart')).toBe(true);
    expect(service.validateDiagram(nullInvalid, 'flowchart')).toBe(false);
  });
});