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
    let currentClass = '';
    let inClassDefinition = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this is a class definition
      const classMatch = line.match(/^class\s+(\w+)\s*\{?/);
      if (classMatch) {
        currentClass = classMatch[1];
        inClassDefinition = true;
        fixedLines.push(line.includes('{') ? line : `class ${currentClass} {`);
        continue;
      }
      
      // Check for end of class definition
      if (line === '}' && inClassDefinition) {
        fixedLines.push(line);
        inClassDefinition = false;
        currentClass = '';
        continue;
      }
      
      // Fix methods/fields with + or - prefixes outside of class definitions
      if (line.match(/^[+\-]\s*\w+/) && !inClassDefinition && currentClass) {
        const lastClassIndex = fixedLines.map((line, index) => 
          line.includes(`class ${currentClass}`) ? index : -1
        ).filter(i => i !== -1).pop() ?? -1;
        
        if (lastClassIndex !== -1) {
          if (!fixedLines[lastClassIndex].includes('{')) {
            fixedLines[lastClassIndex] = `class ${currentClass} {`;
          }
          fixedLines.push(`    ${line}`);
          continue;
        }
      }
      
      // Fix relationship syntax
      if (line.includes('-->') && !line.includes('note')) {
        const relationshipLine = line
          .replace(/\s*-->\s*([\w\s:]+)\s*:\s*Inherits/gi, ' --|> $1')
          .replace(/\s*-->\s*([\w\s:]+)\s*:\s*Uses/gi, ' --> $1 : uses')
          .replace(/\s*-->\s*([\w\s:]+)\s*:\s*Extends/gi, ' --|> $1')
          .replace(/\s*-->\s*([\w\s:]+)\s*:\s*Implements/gi, ' ..|> $1');
        fixedLines.push(relationshipLine);
        continue;
      }
      
      fixedLines.push(line);
    }
    
    // Ensure all class definitions are closed
    if (inClassDefinition) {
      fixedLines.push('}');
    }
    
    return fixedLines.join('\n')
      .replace(/class\s+(\w+)\s*class\s+(\w+)/gi, 'class $1\nclass $2')
      .replace(/(\w+)(--[|>*]|\.\.\|>)(\w+)/g, '$1 $2 $3');
  }
}