export interface FunctionInfo {
  code: string;
  name: string;
  type: 'function' | 'arrow' | 'method' | 'async' | 'generator' | 'class' | 'module';
  startLine: number;
  endLine: number;
  language: string;
}