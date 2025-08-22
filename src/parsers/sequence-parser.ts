import { DiagramParser } from './base-parser';
import { DiagramType } from '../types';

export class SequenceParser extends DiagramParser {
  readonly diagramType: DiagramType = 'sequence';

  validate(diagram: string): boolean {
    const cleanDiagram = this.removeCodeBlocks(diagram);
    return cleanDiagram.includes('sequenceDiagram') || 
           cleanDiagram.includes('participant') ||
           /\w+\s*->>?\s*\w+/.test(cleanDiagram);
  }

  clean(diagram: string): string {
    let cleaned = this.removeCodeBlocks(diagram);
    cleaned = this.ensureHeader(cleaned, 'sequenceDiagram');
    cleaned = this.fixSequenceSyntax(cleaned);
    return this.cleanWhitespace(cleaned);
  }

  private fixSequenceSyntax(diagram: string): string {
    const lines = diagram.split('\n');
    const fixedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Skip empty lines and diagram declaration
      if (!line.trim() || line.trim() === 'sequenceDiagram') {
        fixedLines.push(line);
        continue;
      }
      
      // Fix common sequence diagram syntax errors
      line = line
        // Fix the specific issue: "-> >" becomes "->"
        .replace(/->\s*>\s*/g, ' -> ')
        // Fix other invalid arrow patterns
        .replace(/-->\s*>/g, ' ->> ')
        .replace(/->\s*>/g, ' -> ')
        // Fix arrows with participant prefixes like "-> > -Synthesizer"
        .replace(/->\s*>\s*-(\w+)/g, ' -> $1')
        .replace(/->\s*>\s*(\w+)/g, ' -> $1')
        // Fix double arrows that should be single
        .replace(/-->>/g, ' ->> ')
        .replace(/-->/g, ' -> ')
        // Fix spacing around arrows
        .replace(/\s*->>\s*/g, ' ->> ')
        .replace(/\s*->\s*/g, ' -> ')
        // Fix participant declarations
        .replace(/participant\s+(\w+)\s*:\s*/g, 'participant $1 as ')
        // Fix activate/deactivate syntax
        .replace(/activate\s+([^:\n]+):\s*/g, 'activate $1')
        .replace(/deactivate\s+([^:\n]+):\s*/g, 'deactivate $1')
        // Fix note syntax
        .replace(/Note\s+over\s+([^:]+):\s*/g, 'Note over $1: ')
        .replace(/Note\s+left\s+of\s+([^:]+):\s*/g, 'Note left of $1: ')
        .replace(/Note\s+right\s+of\s+([^:]+):\s*/g, 'Note right of $1: ')
        // Fix alt/else/end blocks
        .replace(/alt\s+([^:\n]+):\s*/g, 'alt $1')
        .replace(/else\s+([^:\n]+):\s*/g, 'else $1')
        // Remove invalid characters that cause INVALID token errors (but preserve essential ones)
        .replace(/[^\w\s\->>:(),.'"]/g, '')
        // Fix malformed message syntax
        .replace(/:\s*([^:\n]*)\s*\(/g, ': $1(')
        .replace(/\)\s*$/g, ')')
        // Clean up multiple spaces
        .replace(/\s+/g, ' ')
        .trim();
      
      // Validate and fix participant names
      if (line.includes('participant ')) {
        line = line.replace(/participant\s+([^\s]+)/g, (match, name) => {
          const cleanName = name.replace(/[^\w]/g, '');
          return `participant ${cleanName}`;
        });
      }
      
      // Validate message syntax: Participant -> Participant: Message
      if (line.includes('->') && !line.includes('participant') && !line.includes('Note') && 
          !line.includes('activate') && !line.includes('deactivate')) {
        const messageMatch = line.match(/^\s*(\w+)\s*(->>?)\s*(\w+)\s*:\s*(.+)$/);
        if (messageMatch) {
          const [, from, arrow, to, message] = messageMatch;
          line = `    ${from} ${arrow} ${to}: ${message.trim()}`;
        } else if (line.includes('->') && line.includes(':')) {
          // Try to fix malformed message lines
          const parts = line.split(':');
          if (parts.length >= 2) {
            const arrowPart = parts[0].trim();
            const messagePart = parts.slice(1).join(':').trim();
            const arrowMatch = arrowPart.match(/(\w+)\s*(->>?)\s*(\w+)/);
            if (arrowMatch) {
              const [, from, arrow, to] = arrowMatch;
              line = `    ${from} ${arrow} ${to}: ${messagePart}`;
            }
          }
        }
      }
      
      fixedLines.push(line);
    }
    
    let fixed = fixedLines.join('\n');
    
    // Final cleanup
    fixed = fixed
      // Remove empty lines between sequence elements
      .replace(/\n\s*\n(\s*(activate|deactivate|alt|else|end))/g, '\n$1')
      // Ensure proper indentation
      .replace(/^(\s*)(activate|deactivate|alt|else|end|Note)/gm, '    $2')
      .replace(/^(\s*)(\w+\s*->>?\s*\w+)/gm, '    $2')
      // Clean up multiple newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return fixed;
  }
}