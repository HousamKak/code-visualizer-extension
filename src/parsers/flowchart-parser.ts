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
    let fixedLines: string[] = [];
    const nodeIds = new Set<string>();
    const nodeIdsFromEdges = new Set<string>();
    const connections: string[] = [];
    
    // Ensure header exists
    if (!lines.some(l => l.trim().startsWith('flowchart '))) {
      fixedLines.unshift('flowchart TD');
    }
    
    // First pass: collect nodes and connections
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('flowchart')) {
        fixedLines.push(line);
        continue;
      }
      
      // Extract node definitions
      const nodeDefMatch = trimmed.match(/^\s*([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\{[^}]+\}|\(\([^)]+\)\)|\[\[[^\]]+\]\])/);
      if (nodeDefMatch) {
        nodeIds.add(nodeDefMatch[1]);
        fixedLines.push(line);
        continue;
      }
      
      // Extract connections (keep all edges)
      if (trimmed.includes('-->')) {
        // Normalize labeled edges
        const normalizedConnection = trimmed.replace(/--\s*([^>-][^>]*)\s*-->/, '-- $1 -->');
        connections.push(normalizedConnection);
        
        // Extract node IDs from edges
        const edgeMatches = normalizedConnection.match(/([A-Za-z0-9_]+)\s*(?:--(?:\s*[^>-][^>]*\s*)?-->)\s*([A-Za-z0-9_]+)/g);
        if (edgeMatches) {
          edgeMatches.forEach(match => {
            const parts = match.split(/--(?:.*?)-->/);
            if (parts.length === 2) {
              nodeIdsFromEdges.add(parts[0].trim());
              nodeIdsFromEdges.add(parts[1].trim().split(/[\s|:]/)[0]);
            }
          });
        }
        continue;
      }
      
      fixedLines.push(line);
    }
    
    // Auto-declare missing nodes (STRICT.md section 3.3)
    const missing = [...nodeIdsFromEdges].filter(id => !nodeIds.has(id));
    const decls = missing.map(id => `    ${id}[${id}]`);
    const headerIdx = fixedLines.findIndex(l => l.trim().startsWith('flowchart '));
    if (headerIdx >= 0) {
      fixedLines.splice(headerIdx + 1, 0, ...decls);
    }
    
    // Add all connections (keep all edges as normalized)
    if (connections.length > 0) {
      fixedLines.push('');
      connections.forEach(connection => {
        fixedLines.push(`    ${connection}`);
      });
    }
    
    return fixedLines.join('\n')
      .replace(/^flowchart\s+TD\s*\n.*?^flowchart\s+TD/gm, 'flowchart TD')
      .replace(/\[(.*?)\]\[(.*?)\]/g, '[$1 $2]')
      .replace(/\n\s*\n\s*\n/g, '\n\n');
  }
}