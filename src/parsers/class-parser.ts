import { DiagramParser } from './base-parser';
import { DiagramType } from '../types';

export class ClassParser extends DiagramParser {
  readonly diagramType: DiagramType = 'classDiagram';

  validate(diagram: string): boolean {
    const cleanDiagram = this.removeCodeBlocks(diagram);
    return cleanDiagram.includes('classDiagram') || 
           cleanDiagram.includes('class ') ||
           /\w+\s*(\||>|\*|o)--/.test(cleanDiagram);
  }

  clean(diagram: string): string {
    let cleaned = this.removeCodeBlocks(diagram);
    cleaned = this.ensureHeader(cleaned, 'classDiagram');
    cleaned = this.fixClassSyntax(cleaned);
    return this.cleanWhitespace(cleaned);
  }

  private fixClassSyntax(diagram: string): string {
    const lines = diagram.split('\n');
    const fixedLines: string[] = [];
    const declared = new Set<string>();
    const prelude: string[] = [];
    let inClassDefinition = false;
    
    // Relationship normalization patterns (STRICT.md section 3.4)
    const REL = [
      { re: /:\s*Inherits?$/i, repl: ' --|> ' },
      { re: /:\s*Implements?$/i, repl: ' ..|> ' },
      { re: /:\s*Extends?$/i, repl: ' --|> ' },
      { re: /:\s*Uses?$/i, repl: ' --> ' },
    ];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Header
      if (line === 'classDiagram') {
        fixedLines.push(line);
        continue;
      }
      
      // Skip empty lines
      if (!line) {
        fixedLines.push('');
        continue;
      }
      
      // Check if this is a class definition
      const classMatch = line.match(/^class\s+([A-Za-z0-9_]+)\s*\{?/);
      if (classMatch) {
        const className = classMatch[1];
        declared.add(className);
        inClassDefinition = true;
        fixedLines.push(line.includes('{') ? line : `class ${className} {`);
        continue;
      }
      
      // Check for end of class definition
      if (line === '}' && inClassDefinition) {
        fixedLines.push(line);
        inClassDefinition = false;
        continue;
      }
      
      // Methods and fields inside class definition
      if (inClassDefinition && (line.match(/^[+\-#~]/) || line.match(/^\w+\s*:/))) {
        fixedLines.push(`    ${line}`);
        continue;
      }
      
      // Standalone class declaration (no braces)
      if (line.match(/^class\s+([A-Za-z0-9_]+)$/)) {
        const className = line.split(/\s+/)[1];
        declared.add(className);
        fixedLines.push(line);
        continue;
      }
      
      // Relationship normalization
      let s = line;
      for (const {re, repl} of REL) {
        s = s.replace(re, repl);
      }
      s = s.replace(/\s*-->\s*/g, ' --> ');
      
      // Ensure any class referenced in a relationship is declared at least once
      const names = [...s.matchAll(/\b([A-Za-z0-9_]+)\s*(?:--\|>|\.\.\|>|[*o-]{2}|-->)\s*([A-Za-z0-9_]+)/g)]
        .flatMap(m => [m[1], m[2]]);
      for (const name of names) {
        if (!declared.has(name)) {
          prelude.push(`class ${name}`);
          declared.add(name);
        }
      }
      
      if (s !== line) {
        fixedLines.push(s);
      } else {
        fixedLines.push(line);
      }
    }
    
    // Ensure any opened class definition gets closed (STRICT.md section 3.4)
    if (inClassDefinition) {
      fixedLines.push('}');
    }
    
    // Insert class declarations for referenced classes
    if (prelude.length > 0) {
      const headerIdx = fixedLines.findIndex(l => l.trim() === 'classDiagram');
      if (headerIdx >= 0) {
        fixedLines.splice(headerIdx + 1, 0, ...prelude);
      }
    }
    
    return fixedLines.join('\n')
      .replace(/class\s+(\w+)\s*class\s+(\w+)/gi, 'class $1\nclass $2')
      .replace(/(\w+)(--[|>*]|\.\.\|>)(\w+)/g, '$1 $2 $3');
  }
}