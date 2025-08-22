// Jest setup file for VS Code extension tests
import { jest } from '@jest/globals';

// Mock VS Code API
const vscode = {
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockImplementation((key: any, defaultValue?: any) => {
        switch (key) {
          case 'provider': return 'github';
          case 'fallbackProviders': return true;
          case 'timeout': return 10;
          case 'retryCount': return 3;
          case 'enableHover': return true;
          case 'enableAnalytics': return false;
          case 'cacheEnabled': return true;
          case 'cacheDuration': return 24;
          default: return defaultValue;
        }
      })
    }),
    getWorkspaceFolder: jest.fn(),
    createFileSystemWatcher: jest.fn(),
    onDidChangeConfiguration: jest.fn(),
    onDidSaveTextDocument: jest.fn(),
    openTextDocument: jest.fn(),
    applyEdit: jest.fn(),
    workspaceFolders: [],
    rootPath: '/test/workspace'
  },
  window: {
    createWebviewPanel: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    createStatusBarItem: jest.fn(),
    withProgress: jest.fn(),
    activeTextEditor: null,
    visibleTextEditors: []
  },
  languages: {
    registerHoverProvider: jest.fn(),
    registerCompletionItemProvider: jest.fn(),
    registerDefinitionProvider: jest.fn(),
    createDiagnosticCollection: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn().mockImplementation((command: any) => {
      if (command === 'codeVisualizer.getApiToken') {
        return Promise.resolve('test-token');
      }
      return Promise.resolve();
    })
  },
  Position: class {
    constructor(public line: number, public character: number) {}
    with = jest.fn();
    translate = jest.fn();
    compareTo = jest.fn();
    isAfter = jest.fn();
    isAfterOrEqual = jest.fn();
    isBefore = jest.fn();
    isBeforeOrEqual = jest.fn();
    isEqual = jest.fn();
  },
  Range: class {
    constructor(
      public start: any,
      public end: any
    ) {}
    contains = jest.fn();
    isEqual = jest.fn();
    intersection = jest.fn();
    union = jest.fn();
    with = jest.fn();
    isEmpty = jest.fn();
    isSingleLine = jest.fn();
  },
  Uri: {
    file: jest.fn((path: string) => ({ 
      scheme: 'file', 
      path, 
      fsPath: path,
      toString: () => `file://${path}`
    })),
    parse: jest.fn(),
    joinPath: jest.fn()
  },
  ViewColumn: {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  Disposable: {
    from: jest.fn()
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  },
  SecretStorage: class {
    get = jest.fn();
    store = jest.fn();
    delete = jest.fn();
    onDidChange = jest.fn();
  },
  ExtensionContext: class {
    subscriptions: any[] = [];
    workspaceState = {
      get: jest.fn(),
      update: jest.fn()
    };
    globalState = {
      get: jest.fn(),
      update: jest.fn()
    };
    extensionPath = '/test/extension';
    extensionUri = { scheme: 'file', path: '/test/extension' };
    globalStorageUri = { scheme: 'file', path: '/test/global', fsPath: '/test/global' };
    workspaceStorageUri = { scheme: 'file', path: '/test/workspace', fsPath: '/test/workspace' };
    secrets = {
      get: jest.fn(),
      store: jest.fn(),
      delete: jest.fn(),
      onDidChange: jest.fn()
    };
  },
  CancellationToken: {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn()
  }
};

// Mock Node.js modules
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn()
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(),
  basename: jest.fn(),
  extname: jest.fn(),
  resolve: jest.fn()
}));

jest.mock('https', () => ({
  request: jest.fn()
}));

jest.mock('http', () => ({
  request: jest.fn()
}));

// Make vscode available globally
(global as any).vscode = vscode;

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Setup test environment
beforeEach(() => {
  jest.clearAllMocks();
});

export { vscode };