const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "settings", "theme-settings-card.tsx");
let content = fs.readFileSync(filePath, "utf-8");

const newColorsStr = `    headerBg: "#e58f06",
    headerMenuText: "#ffffff",
    headerHoverBg: "rgba(251, 152, 14, 0.55)",
    headerActiveBg: "#fb980e",
    profileAvatarBg: "#fb980e",
    
    submenuBg: "#ffffff",
    submenuText: "#db8b0a",
    submenuIcon: "#db8b0a",
    submenuHoverBg: "rgba(251, 152, 14, 0.3)",
    submenuHoverText: "#db8b0a",
    submenuActiveBg: "#fb980e",
    submenuActiveText: "#ffffff",

    settingsSubnavBg: "#ffffff",
    settingsSubnavText: "#db8b0a",
    settingsSubnavHoverBg: "rgba(251, 152, 14, 0.3)",
    settingsSubnavActiveBg: "#db8b0a",
    settingsSubnavActiveText: "#ffffff",
    settingsSubnavBorder: "rgba(203, 213, 225, 0.15)",

    tabBarBg: "#ffffff",
    tabBarText: "#db8b0a",
    tabBarHoverBg: "rgba(251, 152, 14, 0.3)",
    tabBarHoverText: "#db8b0a",
    tabBarActiveBg: "#db8b0a",
    tabBarActiveText: "#ffffff",
    tabBarBorder: "rgba(251, 152, 14, 0.13)",

    btnClearBg: "#b4040c",
    btnClearText: "#ffffff",
    btnSaveBg: "#db8b0a",
    btnSaveText: "#ffffff",
    btnImportBg: "#565758",
    btnImportText: "#ffffff",
    btnExportBg: "#565758",
    btnExportText: "#ffffff",
    btnDeleteBg: "#b4040c",
    btnDeleteText: "#ffffff",
    btnPrintBg: "#db8b0a",
    btnPrintText: "#ffffff",
    btnHoverBg: "transparent",

    dropdownBg: "#ffffff",
    dropdownText: "#334155",
    dropdownHoverBg: "rgba(251, 152, 14, 0.14)",
    dropdownHoverText: "#334155",
    dropdownActiveBg: "#db8b0a",
    dropdownActiveText: "#ffffff",
    dropdownBorder: "rgba(203, 213, 225, 0)",

    toggleActiveBg: "#e58e12",
    toggleActiveText: "#ffffff",
    toggleInactiveBg: "#ffffff",
    toggleInactiveText: "#475569",

    tableHeaderBg: "#db8b0a",
    tableHeaderText: "#ffffff",
    tableRowEvenBg: "#ffffff",
    tableRowOddBg: "#ffffff",
    tableRowHoverBg: "rgba(251, 152, 14, 0.04)",
    tableBorderColor: "rgba(203, 213, 225, 0.1)",
    
    primary: "#e58f06",
    tableFooter: "#db8b0a",
    background: "#f4f1ea",
    cardBg: "#ffffff"`;

const startIdxCustom = content.indexOf('const [customColors, setCustomColors] = useState({');
const endIdxCustom = content.indexOf('});', startIdxCustom);
if (startIdxCustom > -1 && endIdxCustom > -1) {
  content = content.substring(0, startIdxCustom) + 'const [customColors, setCustomColors] = useState({\n' + newColorsStr + '\n  });' + content.substring(endIdxCustom + 3);
}

const startIdxDefault = content.indexOf('colors: {\n      headerBg: "#F5A623",');
const endIdxDefault = content.indexOf('},\n  },\n  {', startIdxDefault);
if (startIdxDefault > -1 && endIdxDefault > -1) {
  const replacement = 'colors: {\n' + newColorsStr.split('\\n').map(line => '  ' + line).join('\\n') + '\n    }';
  content = content.substring(0, startIdxDefault) + replacement + content.substring(endIdxDefault + 5);
}

fs.writeFileSync(filePath, content, "utf-8");
console.log("Replaced colors successfully.");
