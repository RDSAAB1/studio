// inject.js - Runs in main page context to override blocking window.print dialog and intercept popups silently

(() => {
  if (window.eMandiHooked) {
    console.log("eMandi inject.js: Already hooked on this page.");
    return;
  }
  window.eMandiHooked = true;

  window.print = function() {
    console.log("Print dialog bypassed by eMandi Scraper Extension.");
  };

  // Override window.open to intercept print and payment calls silently
  const originalOpen = window.open;
  window.open = function(url, name, specs) {
    console.log("eMandi inject.js: Intercepted window.open for URL:", url);
    
    const isTarget = url && (
      url.includes("print") ||
      url.includes("Receipt") ||
      url.includes("ProcessSixR") ||
      url.includes("printData")
    );

    const isScraperActive = document.documentElement.getAttribute("data-mandi-scraper-active") === "true";

    if (isTarget && isScraperActive) {
      console.log("eMandi inject.js: Blocking popup and sending silent event for URL:", url);
      window.dispatchEvent(new CustomEvent("eMandiOpenIntercepted", { detail: { url } }));
      
      // Return mock window object to prevent errors in caller scripts
      return {
        print: function() {},
        blur: function() {},
        close: function() {},
        focus: function() {},
        document: { write: function() {}, close: function() {} }
      };
    }

    const w = originalOpen(url, name, specs);
    if (w) {
      w.print = function() {
        console.log("Print dialog bypassed on dynamic popup window by eMandi Scraper Extension.");
      };
    }
    return w;
  };
})();
