/**
 * Sanitizes a string input by removing potentially dangerous characters
 * and trimming whitespace.
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>?/gm, '');
  // Trim whitespace
  sanitized = sanitized.trim();
  return sanitized;
}

/**
 * Sanitizes an object by recursively sanitizing all string properties.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeString(obj) as any;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as any;
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = sanitizeObject((obj as any)[key]);
      }
    }
    return result;
  }
  
  return obj;
}
