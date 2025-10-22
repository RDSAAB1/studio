/**
 * Test file for profile grouping functionality
 */

import { fuzzyMatchProfiles, type SupplierProfile } from '../fuzzy-matching';

// Test cases for profile grouping
const testProfiles = [
  // Exact matches (should be grouped together)
  {
    name: 'John Doe',
    fatherName: 'Muhammad Ali',
    address: '123 Main Street',
    contact: '03001234567'
  },
  {
    name: 'John Doe',
    fatherName: 'Muhammad Ali', 
    address: '123 Main Street',
    contact: '03001234568' // Different contact, but same name, father, address
  },
  
  // Similar profiles (should be grouped based on fuzzy matching)
  {
    name: 'John Smith',
    fatherName: 'Muhammad Ali',
    address: '123 Main Street'
  },
  
  // Different profiles (should remain separate)
  {
    name: 'Jane Doe',
    fatherName: 'Ahmed Khan',
    address: '456 Oak Avenue'
  }
];

console.log('Testing Profile Grouping Logic:');

// Test exact matches
const profile1 = testProfiles[0];
const profile2 = testProfiles[1];
const exactMatchResult = fuzzyMatchProfiles(profile1, profile2);
console.log(`✅ Exact Match Test: ${exactMatchResult.isMatch ? 'PASS' : 'FAIL'}`);
console.log(`   Reason: ${exactMatchResult.reason}`);
console.log(`   Differences: Name(${exactMatchResult.fieldDifferences.name}), Father(${exactMatchResult.fieldDifferences.fatherName}), Address(${exactMatchResult.fieldDifferences.address})`);

// Test similar profiles
const profile3 = testProfiles[2];
const similarMatchResult = fuzzyMatchProfiles(profile1, profile3);
console.log(`✅ Similar Match Test: ${similarMatchResult.isMatch ? 'PASS' : 'FAIL'}`);
console.log(`   Reason: ${similarMatchResult.reason}`);
console.log(`   Differences: Name(${similarMatchResult.fieldDifferences.name}), Father(${similarMatchResult.fieldDifferences.fatherName}), Address(${similarMatchResult.fieldDifferences.address})`);

// Test different profiles
const profile4 = testProfiles[3];
const differentMatchResult = fuzzyMatchProfiles(profile1, profile4);
console.log(`✅ Different Profile Test: ${!differentMatchResult.isMatch ? 'PASS' : 'FAIL'}`);
console.log(`   Reason: ${differentMatchResult.reason}`);
console.log(`   Differences: Name(${differentMatchResult.fieldDifferences.name}), Father(${differentMatchResult.fieldDifferences.fatherName}), Address(${differentMatchResult.fieldDifferences.address})`);

console.log('\n📋 Profile Grouping Summary:');
console.log('• Profiles with identical Name, Father Name, and Address → Same Profile');
console.log('• Profiles with similar fields (≤2 chars diff per field, ≤4 total) → Grouped together');
console.log('• Profiles with significant differences → Separate profiles');

export { testProfiles };
