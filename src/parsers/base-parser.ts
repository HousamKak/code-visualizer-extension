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
    return diagram
      .replace(/```mermaid\n?/gi, '')
      .replace(/```\n?/gi, '');
  }
  
  protected cleanWhitespace(diagram: string): string {
    return diagram
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();
  }
}