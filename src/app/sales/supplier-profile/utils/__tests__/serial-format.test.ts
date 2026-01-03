/**
 * Test file for serial number formatting functions
 */

import { formatSerialNumber, parseSerialNumber, getSerialNumberNumeric } from '../fuzzy-matching';

// Test cases for serial number formatting
const testCases = [
  { input: '555', expected: 'S00555' },
  { input: '1234', expected: 'S01234' },
  { input: '1', expected: 'S00001' },
  { input: '12345', expected: 'S12345' },
  { input: 555, expected: 'S00555' },
  { input: 'S00555', expected: 'S00555' }, // Already formatted
  { input: 'abc555def', expected: 'S00555' }, // Extract numbers only
];

// Test cases for parsing
const parseTestCases = [
  { input: 'S00555', expected: '555' },
  { input: 'S01234', expected: '1234' },
  { input: 'S00001', expected: '1' },
  { input: 'S12345', expected: '12345' },
];

// Test cases for numeric extraction
const numericTestCases = [
  { input: 'S00555', expected: '555' },
  { input: 'S01234', expected: '1234' },
  { input: 'S00001', expected: '1' },
  { input: 'S12345', expected: '12345' },
];

// Run tests

testCases.forEach(({ input, expected }) => {
  const result = formatSerialNumber(input);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';

});

parseTestCases.forEach(({ input, expected }) => {
  const result = parseSerialNumber(input);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';

});

numericTestCases.forEach(({ input, expected }) => {
  const result = getSerialNumberNumeric(input);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';

});

export { testCases, parseTestCases, numericTestCases };























