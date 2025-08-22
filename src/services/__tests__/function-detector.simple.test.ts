import { FunctionDetectorService } from '../function-detector';

// Use global vscode mock from setup.ts
const vscode = (global as any).vscode;

describe('FunctionDetectorService - Basic Tests', () => {
  let service: FunctionDetectorService;
  let mockDocument: any;

  beforeEach(() => {
    service = new FunctionDetectorService();
    
    mockDocument = {
      languageId: 'javascript',
      getText: jest.fn(),
      lineAt: jest.fn(),
      fileName: 'test.js',
      uri: { fsPath: '/test.js' }
    };
  });

  it('should support JavaScript', () => {
    mockDocument.languageId = 'javascript';
    expect(service.isSupported(mockDocument)).toBe(true);
  });

  it('should support TypeScript', () => {
    mockDocument.languageId = 'typescript';
    expect(service.isSupported(mockDocument)).toBe(true);
  });

  it('should support Python', () => {
    mockDocument.languageId = 'python';
    expect(service.isSupported(mockDocument)).toBe(true);
  });

  it('should not support unsupported languages', () => {
    mockDocument.languageId = 'unsupported';
    expect(service.isSupported(mockDocument)).toBe(false);
  });

  it('should extract simple function', () => {
    const code = 'function test() {\n  return 42;\n}';
    mockDocument.getText.mockReturnValue(code);
    
    const position = new vscode.Position(1, 5);
    const result = service.extractFunctionAtPosition(mockDocument, position);
    
    expect(result).toBeDefined();
    expect(result?.name).toBe('test');
    expect(result?.type).toBe('function');
  });

  it('should return null for non-function positions', () => {
    const code = 'const x = 42;';
    mockDocument.getText.mockReturnValue(code);
    
    const position = new vscode.Position(0, 5);
    const result = service.extractFunctionAtPosition(mockDocument, position);
    
    expect(result).toBeNull();
  });

  it('should analyze code complexity', () => {
    const simpleCode = 'function simple() { return 42; }';
    const analysis = service.analyzeCode(simpleCode, 'javascript');
    
    expect(analysis).toBeDefined();
    expect(analysis.complexity).toBe('simple');
  });
});