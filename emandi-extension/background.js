// background.js - Centralized memory state and messaging service worker

let activeScrapeTask = null;
let mainTabId = null; // Track the main coordinator tab to restore focus
let dashboardTabId = null; // Track the dashboard tab separately to prioritize its focus

chrome.runtime.onInstalled.addListener(() => {
  console.log("eMandi Background: Installed.");
});




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

        // After closing popups, restore focus
        const targetTabId = dashboardTabId || mainTabId;
        if (targetTabId) {
          chrome.tabs.update(targetTabId, { active: true }).catch(() => {});
          console.log("eMandi Background: Restored focus back to:", targetTabId);
        }
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
        const isDuplicate = merged.some(oldStmt => {
          const oldUtr = (oldStmt.utr || "").trim();
          const newUtr = (newStmt.utr || "").trim();
          const oldCheck = (oldStmt.checkNo || "").trim();
          const newCheck = (newStmt.checkNo || "").trim();

          // A real UTR is one that is not empty and is not equal to the check number
          const oldHasRealUtr = oldUtr !== "" && oldUtr !== "—" && oldUtr !== "-" && oldUtr !== oldCheck;
          const newHasRealUtr = newUtr !== "" && newUtr !== "—" && newUtr !== "-" && newUtr !== newCheck;

          // 1. If BOTH have a real UTR and they match, it's a duplicate
          if (oldHasRealUtr && newHasRealUtr && oldUtr.toLowerCase() === newUtr.toLowerCase()) {
            return true;
          }

          // 2. Otherwise (if they are check numbers or mixed), they are only duplicates if ALL details match:
          // Name, Amount, Date, and Check number/reference
          const oldRef = oldUtr || oldCheck;
          const newRef = newUtr || newCheck;
          return newStmt.amount === oldStmt.amount &&
                 newStmt.date === oldStmt.date &&
                 (newStmt.name || "").toLowerCase().trim() === (oldStmt.name || "").toLowerCase().trim() &&
                 oldRef.toLowerCase() === newRef.toLowerCase();
        });
        if (!isDuplicate) merged.push(newStmt);
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
