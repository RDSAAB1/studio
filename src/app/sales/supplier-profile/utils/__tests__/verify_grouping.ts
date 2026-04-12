import { fuzzyMatchProfiles } from "../fuzzy-matching";

const profile1 = {
    name: "Manvinder Singh",
    fatherName: "Dheer Singh",
    address: "Devkali"
};

const profile2 = {
    name: "Manvendra Singh",
    fatherName: "Dheer Singh",
    address: "Devkali"
};

const result = fuzzyMatchProfiles(profile1, profile2);
console.log("Match Result:", result.isMatch);
console.log("Total Difference:", result.totalDifference);
console.log("Reason:", result.reason);

if (result.isMatch) {
    console.log("SUCCESS: Manvinder and Manvendra are now matched!");
} else {
    console.log("FAILURE: Still not matched.");
}
