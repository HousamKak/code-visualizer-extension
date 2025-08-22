import * as vscode from 'vscode';
import { IFunctionDetectorService } from '../../interfaces/function-detector.interface';
import { FunctionInfo, CodeAnalysis } from '../../types';

export class MockFunctionDetectorService implements IFunctionDetectorService {
  private supportedLanguages = ['javascript', 'typescript', 'python', 'java'];

  isSupported(document: vscode.TextDocument): boolean {
    return this.supportedLanguages.includes(document.languageId);
  }

  extractFunctionAtPosition(
    document: vscode.TextDocument, 
    position: vscode.Position
  ): FunctionInfo | null {
    // Mock function extraction
    return {
      code: `function mockFunction() {
        return "test";
      }`,
      name: 'mockFunction',
      type: 'function',
      startLine: position.line,
      endLine: position.line + 2,
      language: document.languageId
    };
  }

  getAllFunctions(document: vscode.TextDocument): FunctionInfo[] {
    // Mock multiple functions
    return [
      {
        code: 'function func1() { return 1; }',
        name: 'func1',
        type: 'function',
        startLine: 0,
        endLine: 2,
        language: document.languageId
      },
      {
        code: 'function func2() { return 2; }',
        name: 'func2',
        type: 'function',
        startLine: 4,
        endLine: 6,
        language: document.languageId
      }
    ];
  }

  analyzeCode(code: string, _language: string): CodeAnalysis {
    const complexityScore = Math.min(10, Math.floor(code.length / 100));
    const complexity = complexityScore < 3 ? 'simple' : complexityScore < 7 ? 'moderate' : 'complex';
    
    return {
      hasApiCalls: /\b(fetch|axios|http|request|api)\b/i.test(code),
      hasStateManagement: /\b(useState|setState|state|store|redux)\b/i.test(code),
      hasClassDefinition: /\bclass\s+\w+/i.test(code),
      hasAsyncOperations: /\b(async|await|Promise|then|catch)\b/i.test(code),
      hasEventHandlers: /\b(addEventListener|onClick|onSubmit|handleClick)\b/i.test(code),
      hasDataFlow: /\b(map|filter|reduce|pipe|transform)\b/i.test(code),
      hasUserInteraction: /\b(input|button|form|click|submit)\b/i.test(code),
      hasComplexConditions: (code.match(/\b(if|else|switch|case)\b/g) || []).length > 2,
      hasLoops: /\b(for|while|forEach|map|each)\b/i.test(code),
      hasErrorHandling: /\b(try|catch|throw|error|exception)\b/i.test(code),
      hasDatabaseOperations: /\b(query|select|insert|update|delete|database|sql)\b/i.test(code),
      isStateMachine: false,
      isClassHierarchy: false,
      isSequentialProcess: false,
      isEntityRelationship: false,
      complexity
    };
  }

  isPositionInFunction(
    _document: vscode.TextDocument, 
    position: vscode.Position
  ): boolean {
    // Mock check - assume position is in function if line > 0
    return position.line > 0;
  }

  getFunctionBoundaries(
    lines: string[], 
    startLine: number, 
    _language: string
  ): { start: number; end: number } | null {
    return {
      start: startLine,
      end: Math.min(startLine + 10, lines.length - 1)
    };
  }

  extractFunctionName(declaration: string, language: string): string {
    const patterns = {
      javascript: /function\s+(\w+)/,
      typescript: /function\s+(\w+)/,
      python: /def\s+(\w+)/,
      java: /\w+\s+(\w+)\s*\(/
    };
    
    const pattern = patterns[language as keyof typeof patterns] || /(\w+)/;
    const match = declaration.match(pattern);
    return match ? match[1] : 'unknown';
  }

  determineFunctionType(declaration: string, _language: string): string {
    if (declaration.includes('async')) return 'async';
    if (declaration.includes('*')) return 'generator';
    if (declaration.includes('static')) return 'static';
    return 'function';
  }
}