import { DiagramType } from '../types';

export abstract class DiagramParser {
  abstract readonly diagramType: DiagramType;
  
  abstract validate(diagram: string): boolean;
  abstract clean(diagram: string): string;
  
  protected ensureHeader(diagram: string, header: string): string {
    if (!diagram.includes(header)) {
      return `${header}\n${diagram}`;
    }
    return diagram;
  }
  
  protected removeCodeBlocks(diagram: string): string {
    // Handle optional sentinels (STRICT.md section 3.5)
    const between = diagram.match(/<<MERMAID_START>>\s*([\s\S]*?)\s*<<MERMAID_END>>/);
    const core = between ? between[1] : diagram;
    return core.replace(/```mermaid\n?/gi, '').replace(/```\n?/gi, '');
  }
  
  protected cleanWhitespace(diagram: string): string {
    return diagram
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Collapse triple blank lines to one
      .replace(/[ \t]+$/gm, '') // Remove trailing spaces
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width Unicode characters (STRICT.md section 3.7)
      .trim();
  }
}