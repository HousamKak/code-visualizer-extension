import { DiagramType } from '../types';
import { DiagramParser } from './base-parser';
import { SequenceParser } from './sequence-parser';
import { FlowchartParser } from './flowchart-parser';
import { ClassParser } from './class-parser';

// Generic parser for simple diagram types that just need headers
class GenericParser extends DiagramParser {
  constructor(public readonly diagramType: DiagramType, private header: string) {
    super();
  }

  validate(diagram: string): boolean {
    return this.removeCodeBlocks(diagram).includes(this.header);
  }

  clean(diagram: string): string {
    let cleaned = this.removeCodeBlocks(diagram);
    cleaned = this.ensureHeader(cleaned, this.header);
    return this.cleanWhitespace(cleaned);
  }
}

export class ParserFactory {
  private static parsers: Map<DiagramType, DiagramParser> = new Map();
  
  static {
    // Initialize parsers map
    this.parsers.set('sequence', new SequenceParser());
    this.parsers.set('flowchart', new FlowchartParser());
    this.parsers.set('classDiagram', new ClassParser());
    this.parsers.set('stateDiagram', new GenericParser('stateDiagram', 'stateDiagram-v2'));
    this.parsers.set('erDiagram', new GenericParser('erDiagram', 'erDiagram'));
    this.parsers.set('journey', new GenericParser('journey', 'journey'));
    this.parsers.set('mindmap', new GenericParser('mindmap', 'mindmap'));
    this.parsers.set('timeline', new GenericParser('timeline', 'timeline'));
    this.parsers.set('gitGraph', new GenericParser('gitGraph', 'gitGraph'));
    this.parsers.set('quadrantChart', new GenericParser('quadrantChart', 'quadrantChart'));
    this.parsers.set('sankey', new GenericParser('sankey', 'sankey-beta'));
    this.parsers.set('block', new GenericParser('block', 'block-beta'));
  }

  static getParser(diagramType: DiagramType): DiagramParser {
    const parser = this.parsers.get(diagramType);
    if (!parser) {
      throw new Error(`No parser found for diagram type: ${diagramType}`);
    }
    return parser;
  }

  static cleanDiagram(diagram: string, diagramType: DiagramType): string {
    const parser = this.getParser(diagramType);
    return parser.clean(diagram);
  }

  static validateDiagram(diagram: string, diagramType: DiagramType): boolean {
    const parser = this.getParser(diagramType);
    return parser.validate(diagram);
  }
}

export * from './base-parser';
export * from './sequence-parser';
export * from './flowchart-parser';
export * from './class-parser';