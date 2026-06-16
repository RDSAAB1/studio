// Test script to debug bag parsing logic
function parseBagsAndWeight(bagsValueRaw, varietyRaw) {
  const bagsStr = String(bagsValueRaw || '').trim().toUpperCase();
  const variety = String(varietyRaw || '').trim().toUpperCase();

  const numericBags = parseFloat(bagsStr);
  const isPureNumber = !isNaN(numericBags) && /^\d+(\.\d+)?$/.test(bagsStr);

  const isWheat = variety.includes("GEHOO") || variety.includes("WHEAT") || variety.includes("GEH") || variety.includes("WHE");
  const isRiceBranOrPolish = variety.includes("POLISH") || variety.includes("BRAN") || variety.includes("RICE");

  if (isPureNumber) {
    const totalBags = numericBags;
    let weightPerBag = 0;
    if (isWheat) {
      weightPerBag = 1.0;
    } else if (isRiceBranOrPolish) {
      weightPerBag = 0.2;
    } else {
      weightPerBag = 0.2;
    }
    return { bags: totalBags, bagWeightKg: weightPerBag };
  }

  let pptBags = 0;
  let juttBags = 0;
  let unnamedBags = 0;

  const matches = Array.from(bagsStr.matchAll(/(\d+(?:\.\d+)?)\s*([A-Z]*)/g));
  let hasMatches = false;

  for (const match of matches) {
    hasMatches = true;
    const num = parseFloat(match[1]);
    const word = match[2] || '';

    if (word.includes("JUT") || word.includes("JUTE") || word.includes("BARDANA")) {
      juttBags += num;
    } else if (word.includes("KATTA") || word.includes("KATT") || word.includes("PPT") || word.includes("BAG")) {
      pptBags += num;
    } else {
      unnamedBags += num;
    }
  }

  if (!hasMatches) {
    return { bags: 0, bagWeightKg: 0 };
  }

  let totalBags = pptBags + juttBags + unnamedBags;
  if (totalBags === 0) return { bags: 0, bagWeightKg: 0 };

  let totalWeightKg = 0;
  if (isWheat) {
    totalWeightKg = totalBags * 1.0;
  } else if (isRiceBranOrPolish) {
    let unnamedWeight = 0.2;
    if (bagsStr.includes("JUT") || bagsStr.includes("JUTE") || bagsStr.includes("BARDANA")) {
      if (!bagsStr.includes("KATTA") && !bagsStr.includes("PPT") && !bagsStr.includes("BAG")) {
        unnamedWeight = 0.7;
      }
    }
    totalWeightKg = (pptBags * 0.2) + (juttBags * 0.7) + (unnamedBags * unnamedWeight);
  } else {
    totalWeightKg = (pptBags * 0.2) + (juttBags * 0.7) + (unnamedBags * 0.2);
  }

  return {
    bags: totalBags,
    bagWeightKg: Number((totalWeightKg / totalBags).toFixed(4))
  };
}

console.log("90 KATTAPP 8 JUT KE:", parseBagsAndWeight("90 KATTAPP 8 JUT KE", "POLISH"));
console.log("90:", parseBagsAndWeight("90", "POLISH"));
console.log("90 (WHEAT):", parseBagsAndWeight("90", "WHEAT"));
console.log("90 KATTA:", parseBagsAndWeight("90 KATTA", "POLISH"));
console.log("8 JUT:", parseBagsAndWeight("8 JUT", "POLISH"));
console.log("90 KATTA 8 JUT (WHEAT):", parseBagsAndWeight("90 KATTA 8 JUT", "WHEAT"));
