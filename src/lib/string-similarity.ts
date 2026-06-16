export function levenshteinDistance(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  
  if (str1 === str2) return 0;
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return track[str2.length][str1.length];
}

export function getStringSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const str2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

export interface FuzzyCluster {
  id: string;
  field: 'address' | 'variety';
  variants: string[];
  suggestedSpelling: string;
  dbMatches: string[];
}

/**
 * Finds clusters of similar strings among the imported values,
 * and also checks them against existing database values.
 */
export function findFuzzyClusters(
  field: 'address' | 'variety',
  importedValues: string[],
  existingValues: string[],
  threshold = 0.75
): FuzzyCluster[] {
  // Normalize and filter out empty strings
  const cleanImported = Array.from(new Set(importedValues.map(v => v.trim()).filter(Boolean)));
  const cleanExisting = Array.from(new Set(existingValues.map(v => v.trim()).filter(Boolean)));
  
  const visited = new Set<string>();
  const clusters: FuzzyCluster[] = [];

  for (let i = 0; i < cleanImported.length; i++) {
    const current = cleanImported[i];
    if (visited.has(current.toLowerCase())) continue;

    const clusterVariants = [current];
    const dbMatches: string[] = [];

    // Find similar items within imported list
    for (let j = i + 1; j < cleanImported.length; j++) {
      const other = cleanImported[j];
      if (visited.has(other.toLowerCase())) continue;

      const similarity = getStringSimilarity(current, other);
      if (similarity >= threshold && similarity < 1.0) {
        clusterVariants.push(other);
        visited.add(other.toLowerCase());
      }
    }

    // Find similar items in database values
    for (const dbVal of cleanExisting) {
      // If exact match exists in DB, it will be added as a variant or standard
      if (dbVal.toLowerCase() === current.toLowerCase()) {
        if (!clusterVariants.includes(dbVal)) {
          clusterVariants.unshift(dbVal); // Put DB variant first
        }
        dbMatches.push(dbVal);
        continue;
      }
      
      const similarity = getStringSimilarity(current, dbVal);
      if (similarity >= threshold) {
        dbMatches.push(dbVal);
      }
    }

    // If we only found 1 variant and no DB matches (or only 1 exact DB match), it's not a cluster of conflicts
    const uniqueVariants = Array.from(new Set(clusterVariants));
    if (uniqueVariants.length <= 1 && dbMatches.length === 0) {
      continue;
    }

    // Determine default suggested spelling
    // If there is an exact DB match or close DB match, suggest it.
    // Otherwise, suggest the shortest/cleanest string or the first one.
    let suggested = uniqueVariants[0];
    if (dbMatches.length > 0) {
      // Prefer exact DB match or the closest DB match
      const exactMatch = dbMatches.find(m => uniqueVariants.some(v => v.toLowerCase() === m.toLowerCase()));
      if (exactMatch) {
        suggested = exactMatch;
      } else {
        suggested = dbMatches[0];
      }
    }

    clusters.push({
      id: `${field}-${Date.now()}-${Math.random()}`,
      field,
      variants: uniqueVariants,
      suggestedSpelling: suggested,
      dbMatches: Array.from(new Set(dbMatches)),
    });
    
    visited.add(current.toLowerCase());
  }

  return clusters;
}

export function findVarietyClusters(
  importedVarieties: string[],
  existingVarieties: string[],
  threshold = 0.75
): FuzzyCluster[] {
  const cleanImported = Array.from(new Set(importedVarieties.map(v => v.trim()).filter(Boolean)));
  const cleanExisting = Array.from(new Set(existingVarieties.map(v => v.trim()).filter(Boolean)));

  const standardVarieties = Array.from(new Set([
    ...cleanExisting,
    'WHEAT', 'GEHOO', 'POLISH', 'RICE BRAN', 'HUSK', 'BHOOSI'
  ]));

  const visited = new Set<string>();
  const clusters: FuzzyCluster[] = [];

  for (let i = 0; i < cleanImported.length; i++) {
    const current = cleanImported[i];
    if (visited.has(current.toLowerCase())) continue;

    const clusterVariants = [current];

    // Find similar items within the list
    for (let j = i + 1; j < cleanImported.length; j++) {
      const other = cleanImported[j];
      if (visited.has(other.toLowerCase())) continue;

      const similarity = getStringSimilarity(current, other);
      if (similarity >= threshold) {
        clusterVariants.push(other);
        visited.add(other.toLowerCase());
      }
    }

    // Suggested spelling: if there's a somewhat similar standard variety, suggest it, otherwise suggest the current one.
    let suggested = current;
    let highestSim = 0;
    for (const std of standardVarieties) {
      const sim = getStringSimilarity(current, std);
      if (sim > highestSim && sim >= 0.5) {
        highestSim = sim;
        suggested = std;
      }
    }

    clusters.push({
      id: `variety-${Date.now()}-${Math.random()}`,
      field: 'variety',
      variants: Array.from(new Set(clusterVariants)),
      suggestedSpelling: suggested,
      dbMatches: standardVarieties,
    });

    visited.add(current.toLowerCase());
  }

  return clusters;
}

