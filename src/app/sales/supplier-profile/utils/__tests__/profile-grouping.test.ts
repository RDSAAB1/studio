import { fuzzyMatchProfiles, type SupplierProfile } from "../fuzzy-matching";

const testProfiles: SupplierProfile[] = [
  {
    name: "John Doe",
    fatherName: "Muhammad Ali",
    address: "123 Main Street",
    contact: "03001234567",
  },
  {
    name: "John Doe",
    fatherName: "Muhammad Ali",
    address: "123 Main Street",
    contact: "03001234568",
  },
  {
    name: "Jon Doe",
    fatherName: "Muhammad Ali",
    address: "123 Main Street",
  },
  {
    name: "Jane Doe",
    fatherName: "Ahmed Khan",
    address: "456 Oak Avenue",
  },
];

describe("fuzzyMatchProfiles", () => {
  it("returns exact match when all fields are identical", () => {
    const profile1 = testProfiles[0];
    const profile2 = testProfiles[1];

    const result = fuzzyMatchProfiles(profile1, profile2);

    expect(result.isMatch).toBe(true);
    expect(result.totalDifference).toBe(0);
  });

  it("treats slightly different name as similar when within thresholds", () => {
    const baseProfile = testProfiles[0];
    const similarProfile = testProfiles[2];

    const result = fuzzyMatchProfiles(baseProfile, similarProfile);

    expect(result.isMatch).toBe(true);
    expect(result.totalDifference).toBeGreaterThan(0);
  });

  it("marks clearly different profile as non match", () => {
    const baseProfile = testProfiles[0];
    const differentProfile = testProfiles[3];

    const result = fuzzyMatchProfiles(baseProfile, differentProfile);

    expect(result.isMatch).toBe(false);
  });
});

export { testProfiles };
