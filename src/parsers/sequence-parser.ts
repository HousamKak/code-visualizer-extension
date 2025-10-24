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
    let fixedLines: string[] = [];
    let indentLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      
      // Skip empty lines
      if (!line) {
        fixedLines.push('');
        continue;
      }
      
      // Header
      if (line === 'sequenceDiagram') {
        fixedLines.push(line);
        continue;
      }
      
      // Participant declarations
      if (line.startsWith('participant ')) {
        const cleanParticipant = line.replace(/participant\s+([^\s:]+).*/, 'participant $1');
        fixedLines.push(`    ${cleanParticipant}`);
        continue;
      }
      
      // Control structures
      if (line.startsWith('alt ') || line.startsWith('opt ') || line.startsWith('loop ')) {
        const controlWord = line.split(' ')[0];
        const condition = line.substring(controlWord.length).trim();
        // Remove any trailing colons or invalid text
        const cleanCondition = condition.replace(/[^a-zA-Z0-9\s_]/g, '').trim();
        const indent = '    '.repeat(indentLevel + 1);
        fixedLines.push(`${indent}${controlWord}${cleanCondition ? ' ' + cleanCondition : ''}`);
        indentLevel++;
        continue;
      }
      
      if (line === 'else' || line.startsWith('else ')) {
        const condition = line.substring(4).trim();
        const cleanCondition = condition.replace(/[^a-zA-Z0-9\s_]/g, '').trim();
        const indent = '    '.repeat(indentLevel);
        fixedLines.push(`${indent}else${cleanCondition ? ' ' + cleanCondition : ''}`);
        continue;
      }
      
      if (line === 'end') {
        indentLevel = Math.max(0, indentLevel - 1);
        const indent = '    '.repeat(indentLevel + 1);
        fixedLines.push(`${indent}end`);
        continue;
      }
      
      // Handle 'return' statements - this is the CRITICAL fix for your error
      if (line === 'return' || line.startsWith('return ')) {
        // Check if this return should be part of the previous message
        if (fixedLines.length > 0) {
          const lastLine = fixedLines[fixedLines.length - 1];
          // If the last line was a message and this is a bare 'return', skip it
          // Mermaid doesn't actually need explicit return statements in most cases
          if (lastLine.includes('->') && line === 'return') {
            continue; // Skip standalone return statements
          }
        }
        continue; // Skip all return statements as they're problematic in Mermaid
      }
      
      // Message arrows - the main content
      if (line.includes('->')) {
        // Clean up arrow syntax first
        line = line
          .replace(/->\s*>/g, ' -> ')
          .replace(/->>\s*>/g, ' ->> ')
          .replace(/-->/g, ' -> ')
          .replace(/-->>/g, ' ->> ')
          .replace(/\s*(->>?)\s*/g, ' $1 ');
        
        // Parse message: From -> To: Message
        const messageMatch = line.match(/^\s*([a-zA-Z0-9_]+)\s*(->>?)\s*([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
        if (messageMatch) {
          const [, from, arrow, to, message] = messageMatch;
          // Clean the message text
          const cleanMessage = message
            .replace(/[^\w\s().,;:!?-]/g, '') // Remove special chars
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
          
          const indent = '    '.repeat(indentLevel + 1);
          fixedLines.push(`${indent}${from} ${arrow} ${to}: ${cleanMessage}`);
        } else {
          console.warn(`Could not parse message line: "${line}"`);
          // Try to salvage the line
          const cleaned = line.replace(/[^\w\s\->>:().,;!?]/g, '').trim();
          if (cleaned.includes(':')) {
            const indent = '    '.repeat(indentLevel + 1);
            fixedLines.push(`${indent}${cleaned}`);
          }
        }
        continue;
      }
      
      // Notes
      if (line.toLowerCase().includes('note ')) {
        const noteMatch = line.match(/note\s+(over|left\s+of|right\s+of)\s+([^:]+):\s*(.*)$/i);
        if (noteMatch) {
          const [, position, participant, text] = noteMatch;
          const indent = '    '.repeat(indentLevel + 1);
          fixedLines.push(`${indent}Note ${position} ${participant}: ${text.trim()}`);
        }
        continue;
      }
      
      // Activate/Deactivate
      if (line.startsWith('activate ') || line.startsWith('deactivate ')) {
        const [command, participant] = line.split(' ');
        const indent = '    '.repeat(indentLevel + 1);
        fixedLines.push(`${indent}${command} ${participant}`);
        continue;
      }
      
      // If we get here, it's an unrecognized line - try to clean and include it
      const cleaned = line.replace(/[^\w\s\->>:().,;!?]/g, '').trim();
      if (cleaned.length > 0) {
        const indent = '    '.repeat(indentLevel + 1);
        fixedLines.push(`${indent}${cleaned}`);
      }
    }
    
    // Auto-declare participants (STRICT.md section 3.2)
    const participants = new Set<string>();
    for (const l of fixedLines) {
      const m = l.match(/^\s*([A-Za-z0-9_]+)\s*->>?\s*([A-Za-z0-9_]+)/);
      if (m) { 
        participants.add(m[1]); 
        participants.add(m[2]); 
      }
    }
    
    // Prepend participant lines if missing
    const headerIdx = fixedLines.findIndex(l => l.trim() === 'sequenceDiagram');
    const already = new Set(
      fixedLines.filter(l => l.trim().startsWith('participant '))
                .map(l => l.trim().split(/\s+/)[1])
    );
    const toDeclare = [...participants].filter(p => !already.has(p));
    const decls = toDeclare.map(p => `    participant ${p}`);
    fixedLines.splice(headerIdx + 1, 0, ...decls);
    
    // Final validation and cleanup
    let result = fixedLines.join('\n');
    
    // Remove any remaining problematic patterns
    result = result
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Max 2 consecutive newlines
      .replace(/^\s+$/gm, '') // Remove lines with only whitespace
      .trim();
    
    return result;
  }
}