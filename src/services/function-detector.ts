import * as vscode from 'vscode';
import { FunctionInfo, CodeAnalysis } from '../types';
import { supportedLanguages, maxFunctionSize } from '../utils/constants';
import { IFunctionDetectorService } from '../interfaces/function-detector.interface';

export class FunctionDetectorService implements IFunctionDetectorService {
  
  isSupported(document: vscode.TextDocument): boolean {
    return supportedLanguages.includes(document.languageId);
  }

  extractFunctionAtPosition(document: vscode.TextDocument, position: vscode.Position): FunctionInfo | null {
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = position.line;
    
    // Try to find the function that contains this position
    let functionStart = this.findFunctionStart(lines, currentLine);
    if (functionStart === -1) {
      return null;
    }
    
    let functionEnd = this.findFunctionEnd(lines, functionStart, document.languageId);
    
    // Extract function code
    const functionLines = lines.slice(functionStart, functionEnd + 1);
    const functionCode = functionLines.join('\n');
    
    if (functionCode.length > maxFunctionSize) {
      return null; // Function too large
    }
    
    // Extract function name and type
    const functionName = this.extractFunctionName(functionLines[0], document.languageId);
    const functionType = this.determineFunctionType(functionLines[0], document.languageId);
    
    return {
      code: functionCode,
      name: functionName,
      type: functionType,
      startLine: functionStart,
      endLine: functionEnd,
      language: document.languageId
    };
  }

  private findFunctionStart(lines: string[], currentLine: number): number {
    // Search backwards from current line to find function declaration
    for (let i = currentLine; i >= 0; i--) {
      const line = lines[i].trim();
      if (this.isFunctionDeclaration(line)) {
        // Check if this is a decorator, look for the actual function after it
        if (line.startsWith('@')) {
          // Look ahead for the actual function definition
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const nextLine = lines[j].trim();
            if (this.isFunctionDeclaration(nextLine) && !nextLine.startsWith('@')) {
              return i; // Return the decorator line as the start
            }
          }
        }
        return i;
      }
      // Stop if we hit another function or class
      if (this.isBlockEnd(line) && i < currentLine) {
        break;
      }
    }
    return -1;
  }

  private findFunctionEnd(lines: string[], startLine: number, language: string): number {
    let braceCount = 0;
    let inFunction = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Count braces for block-based languages
      if (this.isBlockBasedLanguage(language)) {
        for (const char of line) {
          if (char === '{') {
            braceCount++;
            inFunction = true;
          } else if (char === '}') {
            braceCount--;
            if (inFunction && braceCount === 0) {
              return i;
            }
          }
        }
      } else {
        // For indentation-based languages like Python
        // Skip empty lines - they don't end the function
        if (!line) {
          continue;
        }

        // If we find a line at the same or lower indentation level than the function def
        // AND it's not a comment or decorator, then the function has ended
        if (i > startLine) {
          const isAtBaseLevel = !line.startsWith(' ') && !line.startsWith('\t');
          const isComment = line.startsWith('#');
          const isDecorator = line.startsWith('@');

          if (isAtBaseLevel && !isComment && !isDecorator) {
            return i - 1;
          }
        }
      }
    }
    
    return Math.min(startLine + 50, lines.length - 1); // Fallback: max 50 lines
  }

  private isFunctionDeclaration(line: string): boolean {
    const patterns = [
      // JavaScript/TypeScript functions
      /^\s*(export\s+)?(async\s+)?function\s+\w+/,           // function declaration
      /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,  // Arrow function
      /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?function/,  // Function expression
      
      // Methods and class members
      /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?\w+\s*\(/,  // Method
      /^\s*(public|private|protected)?\s*(static\s+)?(get|set)\s+\w+/,      // Getters/setters
      /^\s*\w+\s*\([^)]*\)\s*\{/,                            // Simple method
      /^\s*async\s+\w+\s*\(/,                                // Async method
      
      // Class definitions
      /^\s*(export\s+)?(abstract\s+)?class\s+\w+/,           // Class definition
      /^\s*(export\s+)?interface\s+\w+/,                     // Interface definition
      /^\s*(export\s+)?type\s+\w+\s*=/,                      // Type definition
      /^\s*(export\s+)?enum\s+\w+/,                          // Enum definition
      
      // Python
      /^\s*def\s+\w+/,                                        // Python function
      /^\s*async\s+def\s+\w+/,                               // Python async function
      /^\s*class\s+\w+/,                                      // Python class
      /^\s*@\w+/,                                             // Python decorator (task functions often use decorators)
      
      // Java/C#
      /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?\w+(?:<[^>]+>)?\s+\w+(?:<[^>]*>)?\s*\(/,  // Java/C# method with generics
      /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?Task(?:<[^>]+>)?\s+\w+\s*\(/,  // C# Task methods
      /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?void\s+\w+\s*\(/,  // C# void methods
      /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/,  // Simple Java/C# method
      /^\s*@\w+/,                                             // Java/C# annotation
      
      // Go
      /^\s*func\s+(\(\w+\s+\*?\w+\)\s+)?\w+/,               // Go function (with or without receiver)
      /^\s*type\s+\w+\s+(struct|interface)/,                 // Go type definition
      
      // Rust
      /^\s*(pub\s+)?fn\s+\w+/,                               // Rust function
      /^\s*(pub\s+)?async\s+fn\s+\w+/,                       // Rust async function
      /^\s*impl\s+(\w+\s+for\s+)?\w+/,                       // Rust impl block
      /^\s*(pub\s+)?struct\s+\w+/,                           // Rust struct
      /^\s*(pub\s+)?trait\s+\w+/,                            // Rust trait
      
      // Task/worker functions (common patterns)
      /^\s*(export\s+)?task\s+\w+/,                          // Task definition
      /^\s*(export\s+)?worker\s+\w+/,                        // Worker definition
      /^\s*\w+\.task\s*\(/,                                  // Method chaining task
      /^\s*@task\b/,                                          // Task decorator
      /^\s*@celery\.task\b/,                                  // Celery task decorator
    ];
    
    return patterns.some(pattern => pattern.test(line));
  }

  private isBlockEnd(line: string): boolean {
    return line === '}' || line === 'end' || line.includes('endfunction');
  }

  private isBlockBasedLanguage(language: string): boolean {
    const blockBased = ['javascript', 'typescript', 'java', 'csharp', 'go', 'rust', 'php', 'cpp', 'c'];
    return blockBased.includes(language);
  }

  public extractFunctionName(line: string, language: string): string {
    // Try different patterns based on language
    const patterns = [
      // Functions
      /function\s+(\w+)/,                           // function name()
      /(?:const|let|var)\s+(\w+)\s*=/,             // const name =
      /(?:def|func|fn)\s+(\w+)/,                   // def/func/fn name
      /async\s+def\s+(\w+)/,                       // async def name
      /async\s+fn\s+(\w+)/,                        // async fn name
      
      // Classes and types
      /(?:class|interface|enum|struct|trait)\s+(\w+)/,  // class/interface/enum/struct/trait Name
      /type\s+(\w+)\s*=/,                          // type Name =
      /impl\s+(?:\w+\s+for\s+)?(\w+)/,            // impl Name or impl Trait for Name
      
      // C# Methods with return types (more specific first)
      /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?Task(?:<[^>]+>)?\s+(\w+)\s*\(/,  // C# Task<T> method
      /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?void\s+(\w+)\s*\(/,  // C# void method
      /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?\w+(?:<[^>]+>)?\s+(\w+)(?:<[^>]*>)?\s*\(/,  // C# typed method with optional generics
      /(?:public|private|protected)?\s*(?:static\s+)?(\w+)(?:<[^>]*>)?\s*\(/,  // C# method with optional generics (fallback)
      
      // Methods (more specific first)
      /(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\(/,  // method()
      /(?:get|set)\s+(\w+)/,                       // getter/setter
      /async\s+(\w+)\s*\(/,                        // async method()
      
      // Task patterns
      /task\s+(\w+)/,                              // task name
      /worker\s+(\w+)/,                            // worker name
      /(\w+)\.task\s*\(/,                          // obj.task()
      /@(?:task|celery\.task)\s*\n?\s*def\s+(\w+)/, // decorated task function
      /@(\w+)/,                                    // @decorator (use decorator name)
      
      // Fallback - any word followed by parentheses
      /(\w+)\s*\(/,                                // method()
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return 'unnamed';
  }

  public determineFunctionType(line: string, language: string): FunctionInfo['type'] {
    // Check for class-related constructs first
    if (line.includes('class ') || line.includes('interface ') || line.includes('enum ')) {return 'class';}
    if (line.includes('struct ') || line.includes('trait ') || line.includes('impl ')) {return 'class';}
    if (line.match(/type\s+\w+\s*=/)) {return 'class';}
    
    // Check for generators
    if (line.includes('function*')) {return 'generator';}
    
    // Check for arrow functions
    if (line.includes('=>') || line.match(/=\s*\(/)) {return 'arrow';}
    
    // Check for regular functions
    if (line.includes('function ') || line.includes('def ') || line.includes('fn ') || line.includes('func ')) {return 'function';}
    
    // Check for C# method patterns (should be 'method' even if async)
    if (language === 'csharp' && (
      line.match(/(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:Task|void|\w+(?:<[^>]+>)?)\s+\w+\s*\(/) ||
      line.includes('get ') || line.includes('set ')
    )) {
      return 'method';
    }
    
    // Check for async patterns (but not C# methods which are handled above)
    if (line.includes('async ') && !line.includes('class') && language !== 'csharp') {return 'async';}
    
    // Check for task/worker patterns
    if (line.includes('@task') || line.includes('task ') || line.includes('worker ') || line.match(/@\w+/)) {return 'async';}
    
    // Check for getters/setters
    if (line.includes('get ') || line.includes('set ')) {return 'method';}
    
    // Default to method for anything else
    return 'method';
  }

  analyzeCode(code: string, language: string): CodeAnalysis {
    const analysis: CodeAnalysis = {
      hasApiCalls: false,
      hasStateManagement: false,
      hasClassDefinition: false,
      hasAsyncOperations: false,
      hasEventHandlers: false,
      hasDataFlow: false,
      hasUserInteraction: false,
      hasComplexConditions: false,
      hasLoops: false,
      hasErrorHandling: false,
      hasDatabaseOperations: false,
      isStateMachine: false,
      isClassHierarchy: false,
      isSequentialProcess: false,
      isEntityRelationship: false,
      complexity: 'simple'
    };

    // Analyze code patterns
    analysis.hasApiCalls = /\b(fetch|axios|http|request|api)\b/i.test(code);
    analysis.hasStateManagement = /\b(useState|setState|state|store|redux)\b/i.test(code);
    analysis.hasClassDefinition = /\bclass\s+\w+/i.test(code);
    analysis.hasAsyncOperations = /\b(async|await|Promise|then|catch)\b/i.test(code);
    analysis.hasEventHandlers = /\b(addEventListener|onClick|onSubmit|handleClick)\b/i.test(code);
    analysis.hasDataFlow = /\b(map|filter|reduce|pipe|transform)\b/i.test(code);
    analysis.hasUserInteraction = /\b(input|button|form|click|submit)\b/i.test(code);
    analysis.hasComplexConditions = (code.match(/\b(if|else|switch|case)\b/g) || []).length > 2;
    analysis.hasLoops = /\b(for|while|forEach|map|each)\b/i.test(code);
    analysis.hasErrorHandling = /\b(try|catch|throw|error|exception)\b/i.test(code);
    analysis.hasDatabaseOperations = /\b(query|select|insert|update|delete|database|sql)\b/i.test(code);

    // Determine diagram type preferences
    analysis.isStateMachine = analysis.hasStateManagement && (analysis.hasComplexConditions || analysis.hasEventHandlers);
    analysis.isClassHierarchy = analysis.hasClassDefinition && /\b(extends|implements|inherit)\b/i.test(code);
    analysis.isSequentialProcess = analysis.hasAsyncOperations && analysis.hasApiCalls;
    analysis.isEntityRelationship = analysis.hasDatabaseOperations && /\b(table|entity|model|schema)\b/i.test(code);

    // Determine complexity
    const complexityFactors = [
      analysis.hasComplexConditions,
      analysis.hasLoops,
      analysis.hasAsyncOperations,
      analysis.hasErrorHandling,
      analysis.hasClassDefinition
    ].filter(Boolean).length;

    if (complexityFactors >= 3) {
      analysis.complexity = 'complex';
    } else if (complexityFactors >= 1) {
      analysis.complexity = 'moderate';
    }

    return analysis;
  }

  // Additional interface methods
  getAllFunctions(document: vscode.TextDocument): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const text = document.getText();
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (this.isFunctionDeclaration(line)) {
        const functionEnd = this.findFunctionEnd(lines, i, document.languageId);
        const functionCode = lines.slice(i, functionEnd + 1).join('\n');
        
        if (functionCode.length <= maxFunctionSize) {
          functions.push({
            code: functionCode,
            name: this.extractFunctionName(line, document.languageId),
            type: this.determineFunctionType(line, document.languageId),
            startLine: i,
            endLine: functionEnd,
            language: document.languageId
          });
        }
      }
    }
    
    return functions;
  }

  isPositionInFunction(document: vscode.TextDocument, position: vscode.Position): boolean {
    return this.extractFunctionAtPosition(document, position) !== null;
  }

  getFunctionBoundaries(lines: string[], startLine: number, language: string): { start: number; end: number } | null {
    const functionStart = this.findFunctionStart(lines, startLine);
    if (functionStart === -1) {return null;}
    
    const functionEnd = this.findFunctionEnd(lines, functionStart, language);
    return { start: functionStart, end: functionEnd };
  }

  // Note: These methods delegate to the existing private methods
  // Public versions for interface compliance
}