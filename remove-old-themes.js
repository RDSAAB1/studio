const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "lib", "firestore", "theme-sync.ts");
let content = fs.readFileSync(filePath, "utf-8");

// Replace Array.from(presetMap.values()) with filtered array
const searchStr = "Array.from(presetMap.values())";
const replacementStr = "Array.from(presetMap.values()).filter(p => !['classic-amber', 'deep-slate-dark', 'emerald-finance'].includes(p.id))";

content = content.split(searchStr).join(replacementStr);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Filtered out deprecated themes successfully.");
