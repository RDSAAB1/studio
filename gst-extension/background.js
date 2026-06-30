let appTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ─── GST (ClearTax) ───────────────────────────────────────────────────────
  if (message.action === 'open_background_tab') {
    if (sender.tab) {
      appTabId = sender.tab.id;
    }
    chrome.tabs.create({
      url: `https://cleartax.in/gst-number-search/?gstin=${encodeURIComponent(message.gstin)}`,
      active: false
    });
  }

  if (message.action === 'gst_search_success') {
    if (appTabId !== null) {
      chrome.tabs.sendMessage(appTabId, {
        action: 'fill_gst_details',
        details: message.details
      }).catch(err => {
        console.log("App tab not available or extension reloaded:", err);
      });
    }
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
  }

  // ─── PAN (LegalDev) ───────────────────────────────────────────────────────
  if (message.action === 'open_pan_background_tab') {
    if (sender.tab) {
      appTabId = sender.tab.id;
    }
    // Open LegalDev in a hidden background tab
    chrome.tabs.create({
      url: `https://legaldev.in/pan-to-gst?pan=${encodeURIComponent(message.pan)}`,
      active: false
    });
  }

  if (message.action === 'pan_search_success') {
    if (appTabId !== null) {
      chrome.tabs.sendMessage(appTabId, {
        action: 'fill_pan_details',
        details: message.details
      }).catch(err => {
        console.log("App tab not available or extension reloaded:", err);
      });
    }
    // Close the LegalDev background tab
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
  }
});
