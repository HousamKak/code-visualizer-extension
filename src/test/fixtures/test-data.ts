import { FunctionInfo, DiagramCache, CacheMetadata, DiagramType } from '../../types';

/**
 * Test fixtures and sample data for unit and integration tests
 */

// Sample function code snippets for different languages
export const sampleFunctions = {
  javascript: {
    simple: `
function calculateSum(a, b) {
  return a + b;
}`,
    complex: `
async function processUserData(userId, options = {}) {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }
    
    const user = await fetch(\`/api/users/\${userId}\`);
    if (!user.ok) {
      throw new Error('User not found');
    }
    
    const userData = await user.json();
    
    if (options.includePermissions) {
      const permissions = await fetch(\`/api/users/\${userId}/permissions\`);
      userData.permissions = await permissions.json();
    }
    
    return userData;
  } catch (error) {
    console.error('Failed to process user data:', error);
    throw error;
  }
}`,
    arrow: `
const processItems = (items) => {
  return items
    .filter(item => item.active)
    .map(item => ({ ...item, processed: true }))
    .sort((a, b) => a.priority - b.priority);
};`,
    class: `
class UserManager {
  constructor(database) {
    this.database = database;
    this.cache = new Map();
  }
  
  async getUser(id) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    
    const user = await this.database.findById(id);
    this.cache.set(id, user);
    return user;
  }
  
  invalidateCache(id) {
    this.cache.delete(id);
  }
}`
  },

  typescript: {
    interface: `
interface UserService {
  getUser(id: string): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
}

class DatabaseUserService implements UserService {
  constructor(private db: Database) {}
  
  async getUser(id: string): Promise<User> {
    const result = await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
    return result.rows[0];
  }
  
  async updateUser(id: string, data: Partial<User>): Promise<User> {
    await this.db.query('UPDATE users SET ? WHERE id = ?', [data, id]);
    return this.getUser(id);
  }
}`,
    generic: `
function identity<T>(arg: T): T {
  return arg;
}

function mapAsync<T, U>(
  items: T[],
  mapper: (item: T) => Promise<U>
): Promise<U[]> {
  return Promise.all(items.map(mapper));
}`,
    decorators: `
class ApiController {
  @Get('/users/:id')
  @Authorize(['read:users'])
  async getUser(@Param('id') id: string): Promise<UserResponse> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.transformUser(user);
  }
}`
  },

  python: {
    simple: `
def calculate_average(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)`,
    class: `
class DataProcessor:
    def __init__(self, config):
        self.config = config
        self.processed_count = 0
    
    async def process_batch(self, items):
        results = []
        for item in items:
            try:
                processed = await self.process_item(item)
                results.append(processed)
                self.processed_count += 1
            except Exception as e:
                print(f"Failed to process item {item}: {e}")
        return results
    
    async def process_item(self, item):
        # Simulate async processing
        await asyncio.sleep(0.1)
        return item.upper()`,
    generator: `
def fibonacci_generator(n):
    a, b = 0, 1
    count = 0
    while count < n:
        yield a
        a, b = b, a + b
        count += 1`
  },

  java: {
    method: `
public class StringUtils {
    public static String reverseString(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        
        StringBuilder reversed = new StringBuilder();
        for (int i = input.length() - 1; i >= 0; i--) {
            reversed.append(input.charAt(i));
        }
        
        return reversed.toString();
    }
}`,
    stream: `
public List<User> getActiveUsers() {
    return users.stream()
        .filter(User::isActive)
        .filter(user -> user.getLastLoginDate().isAfter(LocalDate.now().minusDays(30)))
        .sorted(Comparator.comparing(User::getLastLoginDate).reversed())
        .collect(Collectors.toList());
}`
  }
};

// Sample FunctionInfo objects
export const sampleFunctionInfo: Record<string, FunctionInfo> = {
  simple: {
    name: 'calculateSum',
    type: 'function',
    code: sampleFunctions.javascript.simple,
    language: 'javascript',
    startLine: 1,
    endLine: 3
  },
  
  complex: {
    name: 'processUserData',
    type: 'async',
    code: sampleFunctions.javascript.complex,
    language: 'javascript',
    startLine: 1,
    endLine: 20
  },
  
  arrow: {
    name: 'processItems',
    type: 'arrow',
    code: sampleFunctions.javascript.arrow,
    language: 'javascript',
    startLine: 1,
    endLine: 5
  },
  
  method: {
    name: 'getUser',
    type: 'method',
    code: sampleFunctions.javascript.class,
    language: 'javascript',
    startLine: 6,
    endLine: 13
  },
  
  typescript: {
    name: 'getUser',
    type: 'async',
    code: sampleFunctions.typescript.interface,
    language: 'typescript',
    startLine: 6,
    endLine: 9
  },
  
  python: {
    name: 'process_batch',
    type: 'async',
    code: sampleFunctions.python.class,
    language: 'python',
    startLine: 5,
    endLine: 14
  }
};

// Sample diagram outputs for different types
export const sampleDiagrams = {
  flowchart: `flowchart TD
    A[Start] --> B{Check Input}
    B -->|Valid| C[Process Data]
    B -->|Invalid| D[Throw Error]
    C --> E[Return Result]
    D --> F[End]
    E --> F`,
    
  sequence: `sequenceDiagram
    participant C as Client
    participant S as Server
    participant D as Database
    
    C->>S: Request User Data
    S->>D: Query User
    D-->>S: User Data
    S->>D: Query Permissions
    D-->>S: Permissions
    S-->>C: Complete User Object`,
    
  classDiagram: `classDiagram
    class UserManager {
        -database: Database
        -cache: Map
        +constructor(database)
        +getUser(id): Promise~User~
        +invalidateCache(id): void
    }
    
    class Database {
        +findById(id): Promise~User~
        +save(user): Promise~User~
    }
    
    UserManager --> Database : uses`,
    
  stateDiagram: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : startProcess
    Loading --> Success : processComplete
    Loading --> Error : processFailed
    Success --> Idle : reset
    Error --> Idle : reset
    Error --> Loading : retry`,
    
  erDiagram: `erDiagram
    USER {
        int id PK
        string name
        string email
        datetime created_at
    }
    
    ORDER {
        int id PK
        int user_id FK
        decimal total
        datetime created_at
    }
    
    USER ||--o{ ORDER : places`
};

// Sample cache entries
export const sampleCacheEntries: Record<string, DiagramCache> = {
  simple: {
    diagram: sampleDiagrams.flowchart,
    hash: 'abc123def456',
    timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    lastAccessed: Date.now() - 1000 * 60 * 2, // 2 minutes ago
    accessCount: 3,
    metadata: {
      functionName: 'calculateSum',
      diagramType: 'flowchart',
      language: 'javascript'
    }
  },
  
  complex: {
    diagram: sampleDiagrams.sequence,
    hash: 'def456ghi789',
    timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    lastAccessed: Date.now() - 1000 * 60 * 10, // 10 minutes ago
    accessCount: 1,
    metadata: {
      functionName: 'processUserData',
      diagramType: 'sequence',
      language: 'javascript',
      codeAnalysis: {
        complexity: 'high',
        hasAsync: true,
        hasConditions: true,
        hasLoops: false,
        functionCount: 1
      }
    }
  },
  
  expired: {
    diagram: sampleDiagrams.flowchart,
    hash: 'expired123',
    timestamp: Date.now() - 1000 * 60 * 60 * 25, // 25 hours ago (expired)
    lastAccessed: Date.now() - 1000 * 60 * 60 * 24, // 24 hours ago
    accessCount: 5,
    metadata: {
      functionName: 'oldFunction',
      diagramType: 'flowchart'
    }
  }
};

// Mock AI provider responses
export const mockAiResponses = {
  success: {
    statusCode: 200,
    body: JSON.stringify({
      choices: [{
        message: {
          content: sampleDiagrams.flowchart
        }
      }]
    })
  },
  
  error: {
    statusCode: 500,
    body: JSON.stringify({
      error: 'Internal server error'
    })
  },
  
  unauthorized: {
    statusCode: 401,
    body: JSON.stringify({
      error: 'Unauthorized'
    })
  },
  
  timeout: {
    statusCode: 408,
    body: JSON.stringify({
      error: 'Request timeout'
    })
  },
  
  malformed: {
    statusCode: 200,
    body: 'invalid json response'
  }
};

// Test configuration objects
export const testConfigurations = {
  default: {
    provider: 'github',
    fallbackProviders: true,
    enableAnalytics: true,
    autoExport: false,
    maxFunctionSize: 5000,
    diagramTheme: 'dark',
    cacheEnabled: true,
    cacheDuration: 24,
    timeout: 10,
    retryCount: 3
  },
  
  minimal: {
    provider: 'github',
    fallbackProviders: false,
    enableAnalytics: false,
    autoExport: false,
    cacheEnabled: false
  },
  
  performance: {
    provider: 'local',
    fallbackProviders: false,
    cacheEnabled: true,
    cacheDuration: 168, // 1 week
    timeout: 30,
    retryCount: 1
  }
};

// Error scenarios for testing
export const errorScenarios = {
  networkError: new Error('Network connection failed'),
  timeoutError: new Error('Request timeout'),
  authError: new Error('Authentication failed'),
  parseError: new Error('Failed to parse response'),
  cacheError: new Error('Cache operation failed'),
  validationError: new Error('Invalid input parameters')
};

// Performance test data
export const performanceData = {
  largeFunctions: Array.from({ length: 10 }, (_, i) => ({
    name: `largeFunction${i}`,
    type: 'function' as const,
    code: `function largeFunction${i}() {\n${'  console.log("line");\n'.repeat(100)}\n}`,
    language: 'javascript' as const,
    startLine: i * 102,
    endLine: i * 102 + 101
  })),
  
  concurrentRequests: Array.from({ length: 20 }, (_, i) => ({
    functionInfo: {
      name: `concurrentFunction${i}`,
      type: 'function' as const,
      code: `function concurrentFunction${i}() { return ${i}; }`,
      language: 'javascript' as const,
      startLine: i,
      endLine: i + 2
    },
    expectedDiagram: `flowchart TD\n  A[Start] --> B[Return ${i}]\n  B --> C[End]`
  }))
};

// VS Code mock data
export const vscodeMockData = {
  positions: {
    start: { line: 0, character: 0 },
    middle: { line: 5, character: 10 },
    end: { line: 20, character: 0 }
  },
  
  ranges: {
    singleLine: { start: { line: 5, character: 0 }, end: { line: 5, character: 20 } },
    multiLine: { start: { line: 5, character: 0 }, end: { line: 10, character: 15 } }
  },
  
  documents: {
    javascript: {
      languageId: 'javascript',
      fileName: 'test.js',
      uri: { scheme: 'file', path: '/test/test.js', fsPath: '/test/test.js' },
      lineCount: 50,
      getText: () => sampleFunctions.javascript.complex
    },
    
    typescript: {
      languageId: 'typescript',
      fileName: 'test.ts',
      uri: { scheme: 'file', path: '/test/test.ts', fsPath: '/test/test.ts' },
      lineCount: 30,
      getText: () => sampleFunctions.typescript.interface
    },
    
    python: {
      languageId: 'python',
      fileName: 'test.py',
      uri: { scheme: 'file', path: '/test/test.py', fsPath: '/test/test.py' },
      lineCount: 40,
      getText: () => sampleFunctions.python.class
    }
  }
};

// Helper functions for test setup
export const TestHelpers = {
  /**
   * Create a mock VS Code document with specified content
   */
  createMockDocument(languageId: string, content: string) {
    return {
      languageId,
      getText: () => content,
      lineAt: (line: number) => ({
        text: content.split('\n')[line] || '',
        lineNumber: line
      }),
      uri: { fsPath: `/test/file.${languageId}` },
      fileName: `file.${languageId}`,
      lineCount: content.split('\n').length
    };
  },

  /**
   * Create a mock AI provider response
   */
  createMockAIResponse(diagram: string, statusCode: number = 200) {
    return {
      statusCode,
      on: jest.fn((event: string, handler: Function) => {
        if (event === 'data') {
          handler(JSON.stringify({
            choices: [{ message: { content: diagram } }]
          }));
        } else if (event === 'end') {
          handler();
        }
      })
    };
  },

  /**
   * Create a mock cache entry
   */
  createMockCacheEntry(diagram: string, metadata: any = {}): DiagramCache {
    return {
      diagram,
      hash: Math.random().toString(36),
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      metadata
    };
  },

  /**
   * Generate test function with specified complexity
   */
  generateTestFunction(complexity: 'low' | 'medium' | 'high'): string {
    switch (complexity) {
      case 'low':
        return 'function simple() { return 42; }';
      
      case 'medium':
        return `
function medium(data) {
  if (!data) return null;
  for (let i = 0; i < data.length; i++) {
    if (data[i].valid) return data[i];
  }
  return null;
}`;
      
      case 'high':
        return `
function high(data, options = {}) {
  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid data');
  }
  
  const results = [];
  const cache = new Map();
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const key = options.keyFn ? options.keyFn(item) : item.id;
    
    if (cache.has(key)) {
      continue;
    }
    
    try {
      if (item.type === 'user') {
        const processed = await processUser(item);
        if (processed && processed.valid) {
          results.push(processed);
          cache.set(key, processed);
        }
      } else if (item.type === 'admin') {
        if (item.permissions && item.permissions.length > 0) {
          for (const permission of item.permissions) {
            if (permission.level > 5) {
              results.push(item);
              cache.set(key, item);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
      if (options.throwOnError) {
        throw error;
      }
    }
  }
  
  return options.sortResults ? 
    results.sort((a, b) => a.priority - b.priority) : 
    results;
}`;
      
      default:
        return 'function unknown() { return null; }';
    }
  }
};