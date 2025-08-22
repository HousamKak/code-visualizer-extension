import * as crypto from 'crypto';
import { NONCE_LENGTH } from './constants';

export function generateNonce(): string {
  return crypto.randomBytes(NONCE_LENGTH).toString('base64');
}

export function hashCode(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}