import { DiagramParser } from './base-parser';
import { DiagramType } from '../types';

export class FlowchartParser extends DiagramParser {
  readonly diagramType: DiagramType = 'flowchart';

  validate(diagram: string): boolean {
    const cleanDiagram = this.removeCodeBlocks(diagram);
    return cleanDiagram.includes('flowchart') || 
           /\w+\s*-->\s*\w+/.test(cleanDiagram) ||
           /\w+\[(.*?)\]/.test(cleanDiagram);
  }

  clean(diagram: string): string {
    let cleaned = this.removeCodeBlocks(diagram);
    if (!cleaned.match(/flowchart\s+(TD|LR|BT|RL)/)) {
      cleaned = this.ensureHeader(cleaned, 'flowchart TD');
    }
    cleaned = this.fixFlowchartSyntax(cleaned);
    return this.cleanWhitespace(cleaned);
  }

  private fixFlowchartSyntax(diagram: string): string {
    const lines = diagram.split('\n');
    const fixedLines: string[] = [];
    const nodeIds = new Set<string>();
    const connections: string[] = [];
    
    // First pass: collect nodes and connections
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('flowchart')) {
        fixedLines.push(line);
        continue;
      }
      
      // Extract node definitions and connections
      if (trimmed.includes('-->')) {
        connections.push(trimmed);
        const matches = trimmed.match(/(\w+)\s*-->\s*(\w+)/g);
        if (matches) {
          matches.forEach(match => {
            const parts = match.split('-->');
            if (parts.length === 2) {
              nodeIds.add(parts[0].trim());
              nodeIds.add(parts[1].trim().split(/[\s|:]/)[0]);
            }
          });
        }
      } else if (trimmed.match(/^\s*\w+\[.*\]/) || trimmed.match(/^\s*\w+\{.*\}/) || trimmed.match(/^\s*\w+\(.*\)/)) {
        const nodeMatch = trimmed.match(/^\s*(\w+)/);
        if (nodeMatch) {
          nodeIds.add(nodeMatch[1]);
        }
        fixedLines.push(line);
      } else {
        fixedLines.push(line);
      }
    }
    
    // Add valid connections
    const validConnections: string[] = [];
    for (const connection of connections) {
      const matches = connection.match(/(\w+)\s*-->\s*(\w+)/g);
      if (matches) {
        matches.forEach(match => {
          const parts = match.split('-->');
          if (parts.length === 2) {
            const fromNode = parts[0].trim();
            let toNodePart = parts[1].trim();
            const toNode = toNodePart.split(/[\s|:]/)[0];
            
            if (nodeIds.has(fromNode) && nodeIds.has(toNode)) {
              const condition = toNodePart.includes('|') ? toNodePart.substring(toNodePart.indexOf('|')) : '';
              validConnections.push(`    ${fromNode} --> ${toNode}${condition}`);
            }
          }
        });
      }
    }
    
    // Add connections if not already present
    if (validConnections.length > 0) {
      fixedLines.push('');
      fixedLines.push(...validConnections);
    }
    
    return fixedLines.join('\n')
      .replace(/^flowchart\s+TD\s*\n.*?^flowchart\s+TD/gm, 'flowchart TD')
      .replace(/\[(.*?)\]\[(.*?)\]/g, '[$1 $2]')
      .replace(/\n\s*\n\s*\n/g, '\n\n');
  }
}