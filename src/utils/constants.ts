export const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'csharp', 'go', 'rust', 'php', 'ruby',
  'cpp', 'c', 'kotlin', 'swift', 'scala', 'dart', 'lua', 'perl', 'r', 'matlab', 'sql'
];

export const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
export const MAX_FUNCTION_SIZE = 5000;
export const MAX_CACHE_SIZE = 100;
export const CACHE_VERSION = '2.0.0';

export const DIAGRAM_THEMES = {
  LIGHT: 'default',
  DARK: 'dark',
  FOREST: 'forest',
  NEUTRAL: 'neutral'
} as const;

export const NONCE_LENGTH = 16;