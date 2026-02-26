import { formatCurrency, formatSrNo, toTitleCase, cn } from '../utils';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('formats number to INR currency', () => {
      expect(formatCurrency(1000)).toContain('1,000');
      expect(formatCurrency(1000)).toContain('₹');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toContain('0');
    });

    it('handles NaN', () => {
      expect(formatCurrency(NaN)).toContain('0');
    });
  });

  describe('formatSrNo', () => {
    it('formats serial number with default prefix', () => {
      expect(formatSrNo(1)).toBe('S00001');
    });

    it('formats serial number with custom prefix', () => {
      expect(formatSrNo(1, 'C')).toBe('C00001');
    });

    it('pads number with zeros', () => {
      expect(formatSrNo(123)).toBe('S00123');
    });
  });

  describe('toTitleCase', () => {
    it('converts string to title case', () => {
      expect(toTitleCase('hello world')).toBe('Hello World');
    });

    it('handles mixed case', () => {
      expect(toTitleCase('hELLo WoRLd')).toBe('Hello World');
    });

    it('handles empty string', () => {
      expect(toTitleCase('')).toBe('');
    });
  });

  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('handles conditional classes', () => {
      expect(cn('class1', false && 'class2')).toBe('class1');
    });
  });
});
