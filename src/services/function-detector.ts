import * as vscode from 'vscode';
import { FunctionInfo, CodeAnalysis } from '../types';
import { SUPPORTED_LANGUAGES, MAX_FUNCTION_SIZE } from '../utils/constants';
import { IFunctionDetectorService } from '../interfaces/function-detector.interface';

export class FunctionDetectorService implements IFunctionDetectorService {
  
  isSupported(document: vscode.TextDocument): boolean {
    return SUPPORTED_LANGUAGES.includes(document.languageId);
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
    
    if (functionCode.length > MAX_FUNCTION_SIZE) {
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
        if (i > startLine && line && !line.startsWith(' ') && !line.startsWith('\t')) {
          return i - 1;
        }
      }
    }
    
    return Math.min(startLine + 50, lines.length - 1); // Fallback: max 50 lines
  }

  private isFunctionDeclaration(line: string): boolean {
    const patterns = [
      /^\s*(export\s+)?(async\s+)?function\s+\w+/,           // JS/TS function
      /^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,  // Arrow function
      /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?\w+\s*\(/,  // Method
      /^\s*def\s+\w+/,                                        // Python
      /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/,  // Java/C#
      /^\s*func\s+\w+/,                                       // Go
      /^\s*(pub\s+)?fn\s+\w+/,                               // Rust
      /^\s*class\s+\w+/,                                      // Class definition
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
      /function\s+(\w+)/,                    // function name()
      /(?:const|let|var)\s+(\w+)\s*=/,      // const name =
      /(?:def|func|fn)\s+(\w+)/,            // def/func/fn name
      /class\s+(\w+)/,                      // class Name
      /(\w+)\s*\(/,                         // method()
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
    if (line.includes('class ')) return 'class';
    if (line.includes('async ')) return 'async';
    if (line.includes('function*')) return 'generator';
    if (line.includes('=>') || line.match(/=\s*\(/)) return 'arrow';
    if (line.includes('function ')) return 'function';
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
        
        if (functionCode.length <= MAX_FUNCTION_SIZE) {
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
    if (functionStart === -1) return null;
    
    const functionEnd = this.findFunctionEnd(lines, functionStart, language);
    return { start: functionStart, end: functionEnd };
  }

  // Note: These methods delegate to the existing private methods
  // Public versions for interface compliance
}