// inject.js - Runs in main page context to override blocking window.print dialog
window.print = function() {
  console.log("Print dialog bypassed by eMandi Scraper Extension.");
};

// Override window.open to intercept print calls on newly opened popups immediately
const originalOpen = window.open;
window.open = function(url, name, specs) {
  console.log("eMandi inject.js: Intercepted window.open for URL:", url);
  const w = originalOpen(url, name, specs);
  if (w) {
    w.print = function() {
      console.log("Print dialog bypassed on dynamic popup window by eMandi Scraper Extension.");
    };
  }
  return w;
};
