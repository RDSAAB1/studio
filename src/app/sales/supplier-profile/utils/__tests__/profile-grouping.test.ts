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

// Test exact matches
const profile1 = testProfiles[0];
const profile2 = testProfiles[1];
const exactMatchResult = fuzzyMatchProfiles(profile1, profile2);



// Test similar profiles
const profile3 = testProfiles[2];
const similarMatchResult = fuzzyMatchProfiles(profile1, profile3);



// Test different profiles
const profile4 = testProfiles[3];
const differentMatchResult = fuzzyMatchProfiles(profile1, profile4);







export { testProfiles };
