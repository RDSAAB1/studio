// background.js - Centralized memory state and messaging service worker

let activeScrapeTask = null;
let mainTabId = null; // Track the main coordinator tab to restore focus
let dashboardTabId = null; // Track the dashboard tab separately to prioritize its focus

chrome.runtime.onInstalled.addListener(() => {
  console.log("eMandi Background: Installed.");
});const cleanAmountStr = (val) => {
  if (!val) return null;
  if (typeof val === "number") return Math.round(Math.abs(val));
  const valStr = String(val).trim();
  const noCommas = valStr.replace(/,/g, "");
  const match = noCommas.match(/-?\d+(\.\d+)?/);
  if (match) {
    const floatVal = parseFloat(match[0]);
    return Math.round(Math.abs(floatVal));
  }
  return null;
};

const isNameMatch = (accName, stmtName) => {
  if (!accName || !stmtName) return false;
  const a = accName.toLowerCase().trim();
  const s = stmtName.toLowerCase().trim();
  
  if (a === s) return true;
  
  const ignoreWords = ["singh", "kumar", "devi", "ram", "lal", "prasad", "sharma", "verma", "gupta", "details", "account"];
  
  const getTokens = (nameStr) => {
    return nameStr.split(/[^a-zA-Z0-9\u0900-\u097F]/)
                  .map(w => w.trim())
                  .filter(w => w.length > 2 && !ignoreWords.includes(w));
  };

  const tokensA = getTokens(a);
  const tokensS = getTokens(s);
  
  if (tokensA.length === 0 || tokensS.length === 0) return false;
  
  return tokensA.some(ta => tokensS.includes(ta));
};

// Central state manager
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("eMandi Background: Received message:", message);

  if (message.action === "setDashboardActive") {
    if (sender.tab && sender.tab.id) {
      dashboardTabId = sender.tab.id;
      console.log("eMandi Background: Dashboard tab focus set to:", dashboardTabId);
    }
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "setTask") {
    activeScrapeTask = message.task;
    // Remember the coordinator tab so we can return focus to it if dashboard is not active
    if (sender.tab && sender.tab.id) {
      mainTabId = sender.tab.id;
      console.log("eMandi Background: Main coordinator tab set to:", mainTabId);
    }
    console.log("eMandi Background: Task set to:", activeScrapeTask);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "getTask") {
    console.log("eMandi Background: Returning task:", activeScrapeTask);
    sendResponse({ success: true, task: activeScrapeTask });
    return false;
  }

  if (message.action === "updateTaskStage") {
    if (activeScrapeTask) {
      activeScrapeTask.stage = message.stage;
      if (message.printDetails) activeScrapeTask.current_record.printDetails = message.printDetails;
      if (message.paymentDetails) activeScrapeTask.current_record.paymentDetails = message.paymentDetails;
      console.log("eMandi Background: Task updated to:", activeScrapeTask);
      
      // Auto close the tab that sent the copy completion update
      if (sender.tab && sender.tab.id) {
        console.log("eMandi Background: Auto-closing child tab with ID:", sender.tab.id);
        chrome.tabs.remove(sender.tab.id).catch(() => {});
      }

      // Proactively sweep and close any other lingering print/payment popups
      chrome.tabs.query({ url: "*://emandi.up.gov.in/*" }, (tabs) => {
        tabs.forEach(t => {
          if (t.url.includes("print") || t.url.includes("Receipt") || t.url.includes("ProcessSixR")) {
            console.log("eMandi Background: Sweeping lingering child tab:", t.id, t.url);
            chrome.tabs.remove(t.id).catch(() => {});
          }
        });

      });
      
      sendResponse({ success: true, task: activeScrapeTask });
    } else {
      console.warn("eMandi Background: Cannot update task, no task exists.");
      sendResponse({ success: false, error: "No active task" });
    }
    return false;
  }

  if (message.action === "clearTask") {
    activeScrapeTask = null;
    mainTabId = null;
    dashboardTabId = null;
    sendResponse({ success: true });
    return false;
  }

  // ---- RTGS & Bank Sync Handlers (called via content script message passing) ----

  if (message.action === "syncBankAccounts") {
    const accounts = message.accounts || [];
    chrome.storage.local.set({ supplier_bank_accounts: accounts }, () => {
      console.log("eMandi Background: Supplier bank accounts saved. Count:", accounts.length);
      sendResponse({ success: true, count: accounts.length });
    });
    return true; // async
  }

  if (message.action === "syncStatementRecords") {
    const newStatements = message.statements || [];
    chrome.storage.local.get({ statement_records: [] }, (result) => {
      const current = result.statement_records || [];
      const merged = [...current];
      
      newStatements.forEach(newStmt => {
        const newAmt = cleanAmountStr(newStmt.amount);
        const newDate = (newStmt.date || "").replace(/[^0-9]/g, "");
        
        const existingIdx = merged.findIndex(oldStmt => {
          const oldAmt = cleanAmountStr(oldStmt.amount);
          const oldDate = (oldStmt.date || "").replace(/[^0-9]/g, "");
          const namesMatch = isNameMatch(oldStmt.name, newStmt.name);
          return namesMatch && oldAmt === newAmt && oldDate === newDate;
        });

        const getScore = (s) => {
          const rawUtr = (s.utr || "").trim();
          const rawCheck = (s.checkNo || "").trim();
          const ref = rawUtr || rawCheck;
          if (!ref || ref === "—" || ref === "-") return 0;
          if (/^\d{6}$/.test(ref)) return 1;
          return 2;
        };

        if (existingIdx === -1) {
          merged.push(newStmt);
        } else {
          const existing = merged[existingIdx];
          if (getScore(newStmt) > getScore(existing)) {
            merged[existingIdx] = newStmt;
          }
        }
      });
      
      chrome.storage.local.set({ statement_records: merged }, () => {
        console.log("eMandi Background: Statement records merged and saved. Total:", merged.length);
        sendResponse({ success: true, count: merged.length });
      });
    });
    return true; // async
  }
});

// Open dashboard when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// Clear default badge text permanently
chrome.action.setBadgeText({ text: "" });

// Dynamically set green/red status icon
function updateActionIcon() {
  chrome.tabs.query({ url: "*://emandi.up.gov.in/*" }, (tabs) => {
    const isConnected = tabs && tabs.length > 0;
    const path = isConnected ? "icon_connected.png" : "icon_disconnected.png";
    try {
      chrome.action.setIcon({ path: path });
    } catch (err) {
      // Silently ignore icon errors
    }
  });
}

// Update icon whenever tab focus changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateActionIcon();
});

chrome.tabs.onUpdated.addListener(updateActionIcon);
chrome.tabs.onRemoved.addListener(updateActionIcon);

// Initialize icon status
updateActionIcon();

// Prevent focus loss to newly created print/payment tabs during active scraping
chrome.tabs.onCreated.addListener((tab) => {
  if (activeScrapeTask) {
    const targetTabId = dashboardTabId || mainTabId;
    if (targetTabId && tab.id !== targetTabId) {
      setTimeout(() => {
        chrome.tabs.update(targetTabId, { active: true }).catch(() => {});
      }, 50);
    }
  }
});
