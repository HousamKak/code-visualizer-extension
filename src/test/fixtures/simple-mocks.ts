/**
 * Simple mock objects for testing - avoiding complex builder patterns
 */

export const createMockDocument = (languageId: string = 'javascript', content: string = '') => ({
  languageId,
  fileName: `test.${languageId}`,
  getText: jest.fn().mockReturnValue(content),
  lineAt: jest.fn(),
  uri: { fsPath: `/test.${languageId}` },
  lineCount: content.split('\n').length
});

export const createMockContext = (secrets: Record<string, string> = {}) => ({
  globalStorageUri: { fsPath: '/test/storage' },
  subscriptions: [],
  secrets: {
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(secrets[key] || null)),
    store: jest.fn(),
    delete: jest.fn()
  }
});

export const createMockHttpResponse = (statusCode: number = 200, data: any = {}) => {
  const response = {
    statusCode,
    on: jest.fn()
  };
  
  response.on.mockImplementation((event: string, handler: Function) => {
    if (event === 'data') {
      handler(JSON.stringify(data));
    } else if (event === 'end') {
      handler();
    }
  });
  
  return response;
};

export const createMockHttpRequest = () => ({
  on: jest.fn(),
  write: jest.fn(),
  end: jest.fn()
});