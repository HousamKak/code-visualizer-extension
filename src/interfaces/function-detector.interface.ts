import * as vscode from 'vscode';
import { FunctionInfo, CodeAnalysis } from '../types';

export interface IFunctionDetectorService {
  /**
   * Check if document language is supported
   */
  isSupported(document: vscode.TextDocument): boolean;
  
  /**
   * Extract function information at specific position
   */
  extractFunctionAtPosition(
    document: vscode.TextDocument, 
    position: vscode.Position
  ): FunctionInfo | null;
  
  /**
   * Get all functions in document
   */
  getAllFunctions(document: vscode.TextDocument): FunctionInfo[];
  
  /**
   * Analyze code structure and complexity
   */
  analyzeCode(code: string, language: string): CodeAnalysis;
  
  /**
   * Check if position is within a function
   */
  isPositionInFunction(
    document: vscode.TextDocument, 
    position: vscode.Position
  ): boolean;
  
  /**
   * Get function boundaries
   */
  getFunctionBoundaries(
    lines: string[], 
    startLine: number, 
    language: string
  ): { start: number; end: number } | null;
  
  /**
   * Extract function name from declaration
   */
  extractFunctionName(declaration: string, language: string): string;
  
  /**
   * Determine function type (async, generator, etc.)
   */
  determineFunctionType(declaration: string, language: string): string;
}