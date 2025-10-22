/**
 * Fuzzy Profile Categorization Rules Implementation
 * 
 * This utility implements the fuzzy matching logic for supplier profiles
 * based on word differences in Name, Father/Husband Name, and Address fields.
 */

export interface SupplierProfile {
  name: string;
  fatherName?: string;
  address?: string;
  contact?: string;
  srNo?: string;
}

export interface FuzzyMatchResult {
  isMatch: boolean;
  totalDifference: number;
  fieldDifferences: {
    name: number;
    fatherName: number;
    address: number;
  };
  reason?: string;
}

/**
 * Calculate character difference between two strings using Levenshtein distance
 */
function calculateCharacterDifference(str1: string, str2: string): number {
  if (!str1 && !str2) return 0;
  if (!str1 || !str2) return Math.max((str1 || '').length, (str2 || '').length);
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Calculate Levenshtein distance between characters
  const dp: number[][] = Array(s1.length + 1)
    .fill(null)
    .map(() => Array(s2.length + 1).fill(0));
  
  // Initialize base cases
  for (let i = 0; i <= s1.length; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= s2.length; j++) {
    dp[0][j] = j;
  }
  
  // Fill the dp table
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  
  return dp[s1.length][s2.length];
}

/**
 * Apply fuzzy matching rules to determine if two profiles are the same
 * 
 * Primary Rule: If Name, Father Name, and Address are all the same (0 character difference), they are the same profile
 * Secondary Rules: 
 * - Rule 1: Maximum 2 character difference per field
 * - Rule 2: Maximum 4 total cumulative character difference across all fields
 */
export function fuzzyMatchProfiles(profileA: SupplierProfile, profileB: SupplierProfile): FuzzyMatchResult {
  const nameDiff = calculateCharacterDifference(profileA.name || '', profileB.name || '');
  const fatherNameDiff = calculateCharacterDifference(profileA.fatherName || '', profileB.fatherName || '');
  const addressDiff = calculateCharacterDifference(profileA.address || '', profileB.address || '');
  
  const totalDifference = nameDiff + fatherNameDiff + addressDiff;
  
  // Primary Rule: If all 3 fields are exactly the same (0 difference), they are the same profile
  if (nameDiff === 0 && fatherNameDiff === 0 && addressDiff === 0) {
    return {
      isMatch: true,
      totalDifference: 0,
      fieldDifferences: { name: 0, fatherName: 0, address: 0 },
      reason: 'Exact match on all fields'
    };
  }
  
  // Rule 1: Maximum 2 character difference per field
  if (nameDiff > 2 || fatherNameDiff > 2 || addressDiff > 2) {
    return {
      isMatch: false,
      totalDifference,
      fieldDifferences: { name: nameDiff, fatherName: fatherNameDiff, address: addressDiff },
      reason: `Field difference exceeds 2 characters: Name(${nameDiff}), Father(${fatherNameDiff}), Address(${addressDiff})`
    };
  }
  
  // Rule 2: Maximum 4 total cumulative character difference
  if (totalDifference > 4) {
    return {
      isMatch: false,
      totalDifference,
      fieldDifferences: { name: nameDiff, fatherName: fatherNameDiff, address: addressDiff },
      reason: `Total difference exceeds 4 characters: ${totalDifference}`
    };
  }
  
  // Both rules satisfied - profiles match
  return {
    isMatch: true,
    totalDifference,
    fieldDifferences: { name: nameDiff, fatherName: fatherNameDiff, address: addressDiff }
  };
}

/**
 * Group suppliers by fuzzy matching
 */
export function groupSuppliersByFuzzyMatch(suppliers: SupplierProfile[]): SupplierProfile[][] {
  const groups: SupplierProfile[][] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < suppliers.length; i++) {
    if (processed.has(i)) continue;
    
    const currentGroup = [suppliers[i]];
    processed.add(i);
    
    for (let j = i + 1; j < suppliers.length; j++) {
      if (processed.has(j)) continue;
      
      const matchResult = fuzzyMatchProfiles(suppliers[i], suppliers[j]);
      if (matchResult.isMatch) {
        currentGroup.push(suppliers[j]);
        processed.add(j);
      }
    }
    
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Find similar profiles for a given profile
 */
export function findSimilarProfiles(targetProfile: SupplierProfile, allProfiles: SupplierProfile[]): {
  exact: SupplierProfile[];
  similar: Array<{ profile: SupplierProfile; matchResult: FuzzyMatchResult }>;
  different: SupplierProfile[];
} {
  const exact: SupplierProfile[] = [];
  const similar: Array<{ profile: SupplierProfile; matchResult: FuzzyMatchResult }> = [];
  const different: SupplierProfile[] = [];
  
  for (const profile of allProfiles) {
    if (profile === targetProfile) continue;
    
    const matchResult = fuzzyMatchProfiles(targetProfile, profile);
    
    if (matchResult.totalDifference === 0) {
      exact.push(profile);
    } else if (matchResult.isMatch) {
      similar.push({ profile, matchResult });
    } else {
      different.push(profile);
    }
  }
  
  return { exact, similar, different };
}

/**
 * Format serial number consistently to S00000 format
 */
export function formatSerialNumber(srNo: string | number): string {
  const numStr = String(srNo).replace(/[^0-9]/g, '');
  const paddedNum = numStr.padStart(5, '0');
  return `S${paddedNum}`;
}

/**
 * Parse serial number from formatted string (removes S prefix and leading zeros)
 */
export function parseSerialNumber(formattedSrNo: string): string {
  const numStr = formattedSrNo.replace(/^S/, '').replace(/^0+/, '');
  return numStr || '0';
}

/**
 * Extract numeric part from serial number for comparison
 */
export function getSerialNumberNumeric(srNo: string): string {
  return srNo.replace(/^S/, '').replace(/^0+/, '') || '0';
}
