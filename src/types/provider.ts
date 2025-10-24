import { DiagramType } from './diagram';

export interface APIProvider {
  name: string;
  endpoint: string;
  model: string;
  headers: (token: string) => Record<string, string>;
  buildBody: (prompt: string, diagramType?: DiagramType) => any;
  extractResponse: (data: any) => string;
}