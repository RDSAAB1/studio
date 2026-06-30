console.log("GST App extension script loaded");

// ─── GST (ClearTax) ────────────────────────────────────────────────────────
window.addEventListener('START_GST_SEARCH', (event) => {
  const gstin = event.detail.gstin;
  if (gstin) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'open_background_tab',
        gstin: gstin
      });
    } else {
      console.warn("GST Extension helper is not available. Please reload the extension and refresh the webpage.");
    }
  }
});

// ─── PAN (LegalDev) ────────────────────────────────────────────────────────
window.addEventListener('START_PAN_SEARCH', (event) => {
  const pan = event.detail.pan;
  if (pan) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'open_pan_background_tab',
        pan: pan
      });
    } else {
      console.warn("GST Extension helper is not available. Please reload the extension and refresh the webpage.");
    }
  }
});

// ─── Listen for messages from the background service worker ────────────────
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fill_gst_details') {
      window.dispatchEvent(new CustomEvent('GST_SEARCH_RESULT', {
        detail: { text: message.details }
      }));
    }
    if (message.action === 'fill_pan_details') {
      window.dispatchEvent(new CustomEvent('PAN_SEARCH_RESULT', {
        detail: { text: message.details }
      }));
    }
  });
}
