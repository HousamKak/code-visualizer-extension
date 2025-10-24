export const supportedLanguages = [
  'javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust', 'php', 'ruby',
  'cpp', 'c', 'kotlin', 'swift', 'scala', 'dart', 'lua', 'perl', 'r', 'matlab', 'sql'
];

export const cacheTtl = 1000 * 60 * 60 * 24; // 24 hours
export const maxFunctionSize = 5000;
export const maxCacheSize = 100;
export const cacheVersion = '2.0.0';
export const maxVersionHistory = 10; // Maximum number of versions to keep per diagram

export const diagramThemes = {
  light: 'default',
  dark: 'dark',
  forest: 'forest',
  neutral: 'neutral'
} as const;

export const nonceLength = 16;