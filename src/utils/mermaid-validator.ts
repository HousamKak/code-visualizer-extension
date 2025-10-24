export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  cleanedDiagram?: string;
}

export interface ValidationError {
  line: number;
  column?: number;
  message: string;
  originalText: string;
  suggestion?: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  line: number;
  message: string;
  originalText: string;
}

export class MermaidSyntaxValidator {
  
  static validateSequenceDiagram(diagram: string): ValidationResult {
    const lines = diagram.split('\n');
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    let hasHeader = false;
    let indentLevel = 0;
    let openBlocks: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNumber = i + 1;
      
      if (!trimmed) {continue;}
      
      // Check for header
      if (trimmed === 'sequenceDiagram') {
        hasHeader = true;
        continue;
      }
      
      // Critical error: return statements
      if (trimmed === 'return' || trimmed.startsWith('return ')) {
        errors.push({
          line: lineNumber,
          message: 'CRITICAL: "return" statements cause parse errors in Mermaid',
          originalText: trimmed,
          suggestion: 'Remove this line - Mermaid sequence diagrams do not need explicit return statements',
          severity: 'error'
        });
        continue;
      }
      
      // Critical error: invalid arrow syntax
      if (trimmed.includes('-> >') || trimmed.includes('->> >') || trimmed.includes('- >')) {
        errors.push({
          line: lineNumber,
          message: 'CRITICAL: Invalid arrow syntax causes parse errors',
          originalText: trimmed,
          suggestion: 'Use only "->" or "->>" arrows',
          severity: 'error'
        });
      }
      
      // Participant validation
      if (trimmed.startsWith('participant ')) {
        const participantMatch = trimmed.match(/participant\s+([^\s:]+)/);
        if (participantMatch) {
          const participantName = participantMatch[1];
          if (!/^[a-zA-Z0-9_]+$/.test(participantName)) {
            errors.push({
              line: lineNumber,
              message: 'Invalid participant name - use only letters, numbers, underscore',
              originalText: trimmed,
              suggestion: `participant ${participantName.replace(/[^a-zA-Z0-9_]/g, '')}`,
              severity: 'error'
            });
          }
        }
      }
      
      // Message validation
      if (trimmed.includes('->')) {
        const messageMatch = trimmed.match(/^\s*([a-zA-Z0-9_]+)\s*(->>?)\s*([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
        if (!messageMatch) {
          errors.push({
            line: lineNumber,
            message: 'Invalid message format',
            originalText: trimmed,
            suggestion: 'Use format: "ParticipantA -> ParticipantB: Message text"',
            severity: 'error'
          });
        } else {
          const [, from, arrow, to, message] = messageMatch;
          
          // Check participant names
          if (!/^[a-zA-Z0-9_]+$/.test(from)) {
            errors.push({
              line: lineNumber,
              message: `Invalid participant name "${from}"`,
              originalText: trimmed,
              suggestion: `Use only letters, numbers, underscore`,
              severity: 'error'
            });
          }
          
          if (!/^[a-zA-Z0-9_]+$/.test(to)) {
            errors.push({
              line: lineNumber,
              message: `Invalid participant name "${to}"`,
              originalText: trimmed,
              suggestion: `Use only letters, numbers, underscore`,
              severity: 'error'
            });
          }
          
          // Check arrow syntax
          if (!arrow.match(/^->>?$/)) {
            errors.push({
              line: lineNumber,
              message: 'Invalid arrow syntax',
              originalText: trimmed,
              suggestion: 'Use only "->" or "->>" arrows',
              severity: 'error'
            });
          }
        }
      }
      
      // Control block validation
      if (trimmed.startsWith('alt ') || trimmed.startsWith('opt ') || trimmed.startsWith('loop ')) {
        const blockType = trimmed.split(' ')[0];
        openBlocks.push(blockType);
        indentLevel++;
        
        // Check for condition format
        const condition = trimmed.substring(blockType.length).trim();
        if (condition && !/^[a-zA-Z0-9_\s]+$/.test(condition)) {
          warnings.push({
            line: lineNumber,
            message: 'Consider simplifying condition text',
            originalText: trimmed
          });
        }
      }
      
      if (trimmed === 'else' || trimmed.startsWith('else ')) {
        if (openBlocks.length === 0 || openBlocks[openBlocks.length - 1] !== 'alt') {
          errors.push({
            line: lineNumber,
            message: 'else without matching alt block',
            originalText: trimmed,
            suggestion: 'Ensure proper alt/else/end structure',
            severity: 'error'
          });
        }
      }
      
      if (trimmed === 'end') {
        if (openBlocks.length === 0) {
          errors.push({
            line: lineNumber,
            message: 'end without matching block',
            originalText: trimmed,
            suggestion: 'Remove extra end statement',
            severity: 'error'
          });
        } else {
          openBlocks.pop();
          indentLevel--;
        }
      }
    }
    
    // Check for missing header
    if (!hasHeader) {
      errors.push({
        line: 1,
        message: 'Missing sequenceDiagram header',
        originalText: '',
        suggestion: 'Add "sequenceDiagram" as first line',
        severity: 'error'
      });
    }
    
    // Check for unclosed blocks
    if (openBlocks.length > 0) {
      errors.push({
        line: lines.length,
        message: `Unclosed blocks: ${openBlocks.join(', ')}`,
        originalText: '',
        suggestion: 'Add missing "end" statements',
        severity: 'error'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  static validateFlowchart(diagram: string): ValidationResult {
    const lines = diagram.split('\n');
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const nodes = new Set<string>();

    let hasHeader = /^flowchart\s+(TD|LR|BT|RL)/m.test(diagram);
    if (!hasHeader) {
      errors.push({ 
        line: 1, 
        message: 'Missing flowchart header', 
        originalText: '', 
        suggestion: 'Add "flowchart TD"', 
        severity: 'error' 
      });
    }

    lines.forEach((raw, idx) => {
      const line = raw.trim();
      if (!line || line.startsWith('flowchart')) {
        return;
      }

      // node decl
      const nd = line.match(/^([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\{[^}]+\}|\(\([^)]+\)\)|\[\[[^\]]+\]\])/);
      if (nd) {
        nodes.add(nd[1]);
      }

      // edge
      const ed = line.match(/^([A-Za-z0-9_]+)\s*--(?:\s*([^>]+)\s*)?-->\s*([A-Za-z0-9_]+)/);
      if (ed) {
        const [, a,, b] = ed;
        if (!/^[A-Za-z0-9_]+$/.test(a) || !/^[A-Za-z0-9_]+$/.test(b)) {
          errors.push({ 
            line: idx+1, 
            message: 'Invalid node id in edge', 
            originalText: raw, 
            severity: 'error' 
          });
        }
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateClass(diagram: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    if (!/^classDiagram/m.test(diagram)) {
      errors.push({ 
        line: 1, 
        message: 'Missing classDiagram header', 
        originalText: '', 
        suggestion: 'Add "classDiagram"', 
        severity: 'error' 
      });
    }
    
    // Basic relationship sanity
    const hasValidRelationships = /--\|>|\.\.>\||[*o]--|\-->/.test(diagram);
    if (diagram.includes('-->') && !hasValidRelationships) {
      errors.push({
        line: 1,
        message: 'Invalid class relationship syntax',
        originalText: '',
        suggestion: 'Use proper relationship syntax: --|>, ..|>, *--, o--, -->',
        severity: 'error'
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings };
  }

  static validateDiagram(diagram: string, type: string): ValidationResult {
    switch (type) {
      case 'sequence':
        return this.validateSequenceDiagram(diagram);
      case 'flowchart':
        return this.validateFlowchart(diagram);
      case 'classDiagram':
        return this.validateClass(diagram);
      default:
        return {
          isValid: true,
          errors: [],
          warnings: []
        };
    }
  }
}