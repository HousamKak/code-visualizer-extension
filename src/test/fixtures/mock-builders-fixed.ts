import * as vscode from 'vscode';
import { FunctionInfo, DiagramCache, APIProvider } from '../../types';

/**
 * Simplified builder classes for creating mock objects in tests
 */

export class MockDocumentBuilder {
  private document: any = {};

  constructor() {
    this.reset();
  }

  reset(): this {
    this.document = {
      languageId: 'javascript',
      fileName: 'test.js',
      uri: { scheme: 'file', path: '/test.js', fsPath: '/test.js' },
      lineCount: 10,
      isDirty: false,
      isClosed: false,
      version: 1,
      eol: vscode.EndOfLine.LF,
      isUntitled: false,
      getText: jest.fn().mockReturnValue(''),
      lineAt: jest.fn(),
      save: jest.fn(),
      getWordRangeAtPosition: jest.fn(),
      validatePosition: jest.fn(),
      validateRange: jest.fn(),
      positionAt: jest.fn(),
      offsetAt: jest.fn()
    };
    return this;
  }

  withLanguage(languageId: string): this {
    this.document.languageId = languageId;
    const extension = this.getExtensionForLanguage(languageId);
    this.document.fileName = `test.${extension}`;
    this.document.uri = {
      scheme: 'file',
      path: `/test.${extension}`,
      fsPath: `/test.${extension}`
    };
    return this;
  }

  withContent(content: string): this {
    const lines = content.split('\n');
    this.document.lineCount = lines.length;
    this.document.getText.mockReturnValue(content);
    this.document.lineAt.mockImplementation((line: number) => ({
      text: lines[line] || '',
      lineNumber: line,
      range: new vscode.Range(line, 0, line, lines[line]?.length || 0),
      rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
      firstNonWhitespaceCharacterIndex: lines[line]?.search(/\S/) || 0,
      isEmptyOrWhitespace: !lines[line]?.trim()
    }));
    return this;
  }

  withFileName(fileName: string): this {
    this.document.fileName = fileName;
    this.document.uri = {
      scheme: 'file',
      path: `/${fileName}`,
      fsPath: `/${fileName}`
    };
    return this;
  }

  build(): any {
    return this.document;
  }

  private getExtensionForLanguage(languageId: string): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      csharp: 'cs',
      go: 'go',
      rust: 'rs',
      php: 'php',
      ruby: 'rb',
      cpp: 'cpp',
      c: 'c'
    };
    return extensions[languageId] || 'txt';
  }
}

export class MockContextBuilder {
  private context: any = {};

  constructor() {
    this.reset();
  }

  reset(): this {
    this.context = {
      subscriptions: [],
      extensionPath: '/test/extension',
      extensionUri: { scheme: 'file', path: '/test/extension' },
      globalStorageUri: { scheme: 'file', path: '/test/global', fsPath: '/test/global' },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([])
      },
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([])
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
        onDidChange: jest.fn()
      }
    };
    return this;
  }

  withSecrets(secrets: Record<string, string>): this {
    this.context.secrets.get.mockImplementation((key: string) => 
      Promise.resolve(secrets[key] || null));
    return this;
  }

  build(): any {
    return this.context;
  }
}

export class MockFunctionInfoBuilder {
  private functionInfo: Partial<FunctionInfo> = {};

  constructor() {
    this.reset();
  }

  reset(): this {
    this.functionInfo = {
      name: 'testFunction',
      type: 'function',
      code: 'function testFunction() { return 42; }',
      language: 'javascript',
      startLine: 0,
      endLine: 2
    };
    return this;
  }

  withName(name: string): this {
    this.functionInfo.name = name;
    return this;
  }

  withType(type: FunctionInfo['type']): this {
    this.functionInfo.type = type;
    return this;
  }

  withCode(code: string): this {
    this.functionInfo.code = code;
    return this;
  }

  withLanguage(language: string): this {
    this.functionInfo.language = language;
    return this;
  }

  build(): FunctionInfo {
    return this.functionInfo as FunctionInfo;
  }
}

export class MockHttpResponseBuilder {
  private response: any = {};
  private data: string[] = [];

  constructor() {
    this.reset();
  }

  reset(): this {
    this.response = {
      statusCode: 200,
      on: jest.fn()
    };
    this.data = [];
    return this;
  }

  withStatusCode(statusCode: number): this {
    this.response.statusCode = statusCode;
    return this;
  }

  withJsonData(data: any): this {
    this.data.push(JSON.stringify(data));
    return this;
  }

  build(): any {
    this.response.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'data') {
        this.data.forEach(chunk => handler(chunk));
      } else if (event === 'end') {
        handler();
      }
    });
    return this.response;
  }
}

export const MockBuilders = {
  document: () => new MockDocumentBuilder(),
  context: () => new MockContextBuilder(),
  functionInfo: () => new MockFunctionInfoBuilder(),
  httpResponse: () => new MockHttpResponseBuilder()
};