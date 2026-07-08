// background.js - Centralized memory state and messaging service worker

let activeScrapeTask = null;
let mainTabId = null; // Track the main coordinator tab to restore focus

chrome.runtime.onInstalled.addListener(() => {
  console.log("eMandi Background: Installed.");
});

// When a new tab is created on emandi, if a scrape task is active,
// immediately return focus to the main coordinator tab.
chrome.tabs.onCreated.addListener((tab) => {
  if (!activeScrapeTask) return;
  if (!tab.url || !tab.url.includes("emandi.up.gov.in")) return;

  if (mainTabId) {
    // New popup opened — return focus to main coordinator tab immediately
    chrome.tabs.update(mainTabId, { active: true }).catch(() => {});
    console.log("eMandi Background: Restored focus to main tab:", mainTabId);
  }
});

// Central state manager
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("eMandi Background: Received message:", message);

  if (message.action === "setTask") {
    activeScrapeTask = message.task;
    // Remember the coordinator tab so we can return focus to it
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

        // After closing popups, restore focus to the main coordinator tab
        if (mainTabId) {
          chrome.tabs.update(mainTabId, { active: true }).catch(() => {});
          console.log("eMandi Background: Restored focus back to main coordinator tab:", mainTabId);
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
    sendResponse({ success: true });
    return false;
  }
});
