import {
  formatSerialNumber,
  parseSerialNumber,
  getSerialNumberNumeric,
} from "../fuzzy-matching";

const testCases = [
  { input: "555", expected: "S00555" },
  { input: "1234", expected: "S01234" },
  { input: "1", expected: "S00001" },
  { input: "12345", expected: "S12345" },
  { input: 555, expected: "S00555" },
  { input: "S00555", expected: "S00555" },
  { input: "abc555def", expected: "S00555" },
];

const parseTestCases = [
  { input: "S00555", expected: "555" },
  { input: "S01234", expected: "1234" },
  { input: "S00001", expected: "1" },
  { input: "S12345", expected: "12345" },
];

const numericTestCases = [
  { input: "S00555", expected: "555" },
  { input: "S01234", expected: "1234" },
  { input: "S00001", expected: "1" },
  { input: "S12345", expected: "12345" },
];

describe("serial number helpers", () => {
  it("formats various inputs into S00000 format", () => {
    for (const { input, expected } of testCases) {
      expect(formatSerialNumber(input as any)).toBe(expected);
    }
  });

  it("parses formatted serial numbers back to numeric string", () => {
    for (const { input, expected } of parseTestCases) {
      expect(parseSerialNumber(input)).toBe(expected);
    }
  });

  it("extracts numeric part for comparison", () => {
    for (const { input, expected } of numericTestCases) {
      expect(getSerialNumberNumeric(input)).toBe(expected);
    }
  });
});

export { testCases, parseTestCases, numericTestCases };























