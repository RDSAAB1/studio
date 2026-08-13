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

// Central batch and task state manager
let activeBatchMap = new Map();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "emandi_keepalive") {
    console.log("eMandi Background: Keep-alive port connected. Service Worker active for background tab processing.");
    port.onDisconnect.addListener(() => {
      console.log("eMandi Background: Keep-alive port disconnected.");
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("eMandi Background: Received message:", message.action);

  if (message.action === "fetchUrlSilently") {
    let targetUrl = message.url || "";
    if (sender.tab && sender.tab.url && !targetUrl.startsWith("http")) {
      try {
        targetUrl = new URL(targetUrl, sender.tab.url).href;
      } catch (e) {}
    }
    console.log("eMandi Background: Fetching URL silently with 3.5s adaptive timeout:", targetUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // Adaptive 3.5 second timeout

    fetch(targetUrl, { credentials: "include", signal: controller.signal })
      .then(res => res.text())
      .then(html => {
        clearTimeout(timeoutId);
        sendResponse({ success: true, html });
      })
      .catch(err => {
        clearTimeout(timeoutId);
        const reason = err.name === "AbortError" ? "timeout" : err.message;
        console.warn("eMandi Background: fetchUrlSilently failed:", reason);
        sendResponse({ success: false, error: reason });
      });

    return true; // Keep async response open
  }

  if (message.action === "openSilentBackgroundTab") {
    let targetUrl = message.url || "";
    if (sender.tab && sender.tab.url && !targetUrl.startsWith("http")) {
      try {
        targetUrl = new URL(targetUrl, sender.tab.url).href;
      } catch (e) {}
    }
    console.log("eMandi Background: Requesting silent offscreen iframe creation for URL:", targetUrl);
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { action: "createSilentIframe", url: targetUrl }, (res) => {
        if (chrome.runtime.lastError || !res) {
          chrome.tabs.create({ url: targetUrl, active: false });
        }
      });
    } else {
      chrome.tabs.create({ url: targetUrl, active: false });
    }
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "checkChildTabsClosed") {
    chrome.tabs.query({}, (tabs) => {
      const childTabs = tabs.filter(t => {
        const u = (t.url || "").toLowerCase();
        return !u.includes("sixrlist") && (u.includes("receipt") || u.includes("processsixr") || u.includes("print"));
      });

      if (childTabs.length > 0) {
        console.log(`eMandi Background: Force-closing ${childTabs.length} lingering child tabs before next record...`);
        let closedCount = 0;
        childTabs.forEach(ct => {
          chrome.tabs.remove(ct.id, () => {
            const _e = chrome.runtime.lastError;
            closedCount++;
            if (closedCount >= childTabs.length) {
              sendResponse({ success: true, allClosed: true });
            }
          });
        });
      } else {
        sendResponse({ success: true, allClosed: true });
      }
    });
    return true; // Keep async channel open for response
  }

  if (message.action === "setDashboardActive") {
    if (sender.tab && sender.tab.id) {
      dashboardTabId = sender.tab.id;
      console.log("eMandi Background: Dashboard tab focus set to:", dashboardTabId);
    }
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "initBatch") {
    if (sender.tab && sender.tab.id) {
      mainTabId = sender.tab.id;
      console.log("eMandi Background: Main coordinator tab ID set to:", mainTabId);
    }
    activeBatchMap.clear();
    if (Array.isArray(message.items)) {
      message.items.forEach(item => {
        activeBatchMap.set(item.prapatraNumber, {
          prapatraNumber: item.prapatraNumber,
          needsPrint: item.needsPrint,
          needsPayment: item.needsPayment,
          printDone: !item.needsPrint,
          paymentDone: !item.needsPayment,
          printDetails: null,
          paymentDetails: null,
          record: item.record
        });
      });
    }
    console.log("eMandi Background: Batch initialized with count:", activeBatchMap.size);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "getBatchStatus") {
    const list = Array.from(activeBatchMap.values());
    const allDone = list.length > 0 && list.every(item => item.printDone && item.paymentDone);
    sendResponse({ success: true, allDone, items: list });
    return false;
  }

  if (message.action === "setTask") {
    activeScrapeTask = message.task;
    if (sender.tab && sender.tab.id) {
      mainTabId = sender.tab.id;
    }
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "getTask") {
    sendResponse({ success: true, task: activeScrapeTask });
    return false;
  }

  if (message.action === "updateTaskStage") {
    const pNo = message.prapatraNumber;
    console.log("eMandi Background: Received updateTaskStage for prapatra:", pNo, "stage:", message.stage);
    
    let matchedBatchItem = null;
    if (activeBatchMap.size > 0) {
      if (pNo && activeBatchMap.has(pNo)) {
        matchedBatchItem = activeBatchMap.get(pNo);
      } else if (pNo) {
        const matchDigits = pNo.match(/\d+/g);
        const trailing = matchDigits ? matchDigits[matchDigits.length - 1] : null;
        if (trailing) {
          const targetNum = parseInt(trailing, 10);
          for (const [k, v] of activeBatchMap.entries()) {
            const kDigits = k.match(/\d+/g);
            const kTrailing = kDigits ? kDigits[kDigits.length - 1] : null;
            if (kTrailing && parseInt(kTrailing, 10) === targetNum) {
              matchedBatchItem = v;
              break;
            }
          }
        }
      }
    }

    if (matchedBatchItem) {
      if (message.stage === "print_done") {
        matchedBatchItem.printDone = true;
        if (message.printDetails) matchedBatchItem.printDetails = message.printDetails;
      } else if (message.stage === "payment_done") {
        matchedBatchItem.paymentDone = true;
        if (message.paymentDetails) matchedBatchItem.paymentDetails = message.paymentDetails;
      }
      console.log(`eMandi Background: Batch record ${matchedBatchItem.prapatraNumber} updated. printDone: ${matchedBatchItem.printDone}, paymentDone: ${matchedBatchItem.paymentDone}`);
    } else if (activeScrapeTask) {
      const taskPNoKey = (activeScrapeTask.prapatraNumber || "").replace(/[\s\u00A0]+/g, "").trim().toLowerCase();
      const incomingPNoKey = (pNo || "").replace(/[\s\u00A0]+/g, "").trim().toLowerCase();
      
      const getTrailNum = (str) => {
        if (!str) return null;
        const m = str.match(/(\d+)\D*$/);
        return m ? parseInt(m[1], 10) : null;
      };

      const isMatch = !pNo || !taskPNoKey || taskPNoKey === incomingPNoKey || (
        getTrailNum(taskPNoKey) !== null && getTrailNum(taskPNoKey) === getTrailNum(incomingPNoKey)
      );

      if (isMatch) {
        if (message.stage === "print_done") {
          activeScrapeTask.printDone = true;
          if (message.printDetails && activeScrapeTask.current_record) {
            activeScrapeTask.current_record.printDetails = message.printDetails;
          }
        } else if (message.stage === "payment_done") {
          activeScrapeTask.paymentDone = true;
          if (message.paymentDetails && activeScrapeTask.current_record) {
            activeScrapeTask.current_record.paymentDetails = message.paymentDetails;
          }
        } else {
          activeScrapeTask.stage = message.stage;
        }
      } else {
        console.warn(`eMandi Background: Task stage update mismatch! Active prapatra: ${activeScrapeTask.prapatraNumber}, Incoming prapatra: ${pNo}. Ignored to prevent cross-contamination.`);
      }
    }

    // Auto close child tab ONLY if it is not the main coordinator page and not the dashboard tab
    const senderUrl = (sender.tab && sender.tab.url) || "";
    const isMainPageUrl = senderUrl.includes("SixRList") || (senderUrl.includes("generated_6R") && !senderUrl.includes("print") && !senderUrl.includes("Receipt"));

    if (sender.tab && sender.tab.id && !isMainPageUrl && sender.tab.id !== mainTabId && sender.tab.id !== dashboardTabId && (matchedBatchItem || activeScrapeTask)) {
      const tabIdToClose = sender.tab.id;
      console.log("eMandi Background: Auto-closing child tab ID:", tabIdToClose, "URL:", senderUrl);
      chrome.tabs.remove(tabIdToClose, () => {
        const _err = chrome.runtime.lastError;
        if (_err) {
          console.warn("eMandi Background: tabs.remove deferred (user dragging tab):", _err.message);
          setTimeout(() => {
            chrome.tabs.remove(tabIdToClose, () => {
              const _ignored = chrome.runtime.lastError;
            });
          }, 300);
        }
      });
    }
    
    sendResponse({ success: true });
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
