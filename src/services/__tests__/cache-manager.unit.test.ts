import { CacheManager } from '../cache-manager';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('vscode');
jest.mock('fs/promises');
jest.mock('path');

describe('CacheManager Unit Tests', () => {
  let cacheManager: CacheManager;
  const mockContext = {
    globalStorageUri: { fsPath: '/mock/storage' },
    globalState: {
      get: jest.fn(),
      update: jest.fn()
    }
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = new CacheManager(mockContext);
  });

  describe('constructor', () => {
    it('should initialize with extension context', () => {
      expect(cacheManager).toBeDefined();
      expect(cacheManager).toBeInstanceOf(CacheManager);
    });
  });

  describe('get method', () => {
    it('should return null for non-existent key', async () => {
      const result = await cacheManager.get('non-existent');
      expect(result).toBeNull();
    });

    it('should implement ICacheManager interface', () => {
      expect(typeof cacheManager.get).toBe('function');
      expect(typeof cacheManager.set).toBe('function');
      expect(typeof cacheManager.has).toBe('function');
      expect(typeof cacheManager.delete).toBe('function');
      expect(typeof cacheManager.clear).toBe('function');
      expect(typeof cacheManager.getStats).toBe('function');
      expect(typeof cacheManager.generateKey).toBe('function');
      expect(typeof cacheManager.cleanup).toBe('function');
    });
  });

  describe('set method', () => {
    it('should be callable with key and value', async () => {
      await expect(cacheManager.set('test-key', 'diagram content')).resolves.not.toThrow();
    });
  });

  describe('has method', () => {
    it('should return false for non-existent key', () => {
      const result = cacheManager.has('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('delete method', () => {
    it('should not throw for non-existent key', async () => {
      await expect(cacheManager.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clear method', () => {
    it('should not throw when clearing empty cache', async () => {
      await expect(cacheManager.clear()).resolves.not.toThrow();
    });
  });

  describe('getStats method', () => {
    it('should return stats object', () => {
      const result = cacheManager.getStats();
      expect(typeof result).toBe('object');
      expect(typeof result.totalEntries).toBe('number');
      expect(typeof result.cacheSize).toBe('number');
    });
  });
});