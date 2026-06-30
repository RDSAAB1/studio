(function () {
  console.log("LegalDev PAN background search script loaded");

  const urlParams = new URLSearchParams(window.location.search);
  const pan = urlParams.get('pan');

  if (!pan) return;

  const sessionKey = `legaldev_pan_searched_${pan}`;

  if (sessionStorage.getItem(sessionKey)) {
    console.log("Search already performed. Starting scraper.");
    waitForResultsThenSend(pan);
    return;
  }

  // ─── Helper: find the search/submit button ────────────────────────────────
  function findSearchButton() {
    return document.querySelector('button[type="submit"]') ||
           document.querySelector('input[type="submit"]') ||
           document.querySelector('#search_btn') ||
           document.querySelector('.search-btn') ||
           document.querySelector('[class*="search" i] button') ||
           document.querySelector('[class*="verify" i] button') ||
           Array.from(document.querySelectorAll('button')).find(el => {
             const txt = (el.textContent || el.value || "").trim();
             return /^(Search|Verify|Check|Go|Submit)$/i.test(txt);
           }) ||
           document.querySelector('button') ||
           document.querySelector('input[type="submit"]');
  }

  function getButtonText(btn) {
    return btn ? (btn.textContent || btn.value || "").trim().toUpperCase() : "";
  }

  function isButtonLoading(btn) {
    if (!btn) return false;
    const txt = getButtonText(btn);
    return txt.includes("SEARCHING") || txt.includes("LOADING") || txt.includes("WAIT") || btn.disabled;
  }

  // ─── Fill form and submit ─────────────────────────────────────────────────
  const checkAndFillInput = () => {
    const input = document.querySelector('input[placeholder*="PAN" i]') || 
                  document.querySelector('input[id*="pan" i]') ||
                  document.querySelector('input[name*="pan" i]') ||
                  document.querySelector('input[type="text"]');

    if (input) {
      input.focus();
      input.value = pan;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      input.blur();

      setTimeout(() => {
        sessionStorage.setItem(sessionKey, "true");

        const btn = findSearchButton();
        if (btn) {
          console.log("Clicking search button:", btn);
          btn.click();
        } else {
          const parentForm = input.closest('form');
          if (parentForm) parentForm.submit();
        }

        // ── Phase 1: Wait for button to enter "searching" state ──────────────
        // If it enters searching state, we know the API call started.
        // Then we move to Phase 2 which waits for it to finish.
        waitForSearchingState(pan);

      }, 600);
    } else {
      setTimeout(checkAndFillInput, 200);
    }
  };
  checkAndFillInput();

  // ─── Phase 1: Wait for button to enter "Searching..." state ─────────────
  function waitForSearchingState(searchedPan) {
    let attempts = 0;
    const maxAttempts = 15; // max ~3 seconds of waiting for loading to start
    let searchingDetected = false;

    const check = () => {
      const btn = findSearchButton();
      const loading = isButtonLoading(btn);
      console.log("Phase 1 - Waiting for searching state:", { loading, btnText: getButtonText(btn), attempts });

      if (loading) {
        searchingDetected = true;
        console.log("Search started (button is loading). Moving to Phase 2...");
        waitForSearchToFinish(searchedPan);
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        // Button never entered loading state — either very fast API or no loader
        // Skip directly to Phase 2 after a brief delay
        console.log("Button never entered loading state. Proceeding with Phase 2 after delay...");
        setTimeout(() => waitForSearchToFinish(searchedPan), 1500);
        return;
      }

      setTimeout(check, 200);
    };

    setTimeout(check, 300);
  }

  // ─── Phase 2: Wait for button to EXIT "Searching..." state ───────────────
  function waitForSearchToFinish(searchedPan) {
    let attempts = 0;
    const maxAttempts = 30; // max ~24 seconds

    const check = () => {
      const btn = findSearchButton();
      const loading = isButtonLoading(btn);
      console.log("Phase 2 - Waiting for search to finish:", { loading, btnText: getButtonText(btn), attempts });

      if (loading) {
        // Still searching — keep waiting
        attempts++;
        if (attempts >= maxAttempts) {
          console.log("Search timed out after waiting too long.");
          sendNoRecords(searchedPan);
          return;
        }
        setTimeout(check, 800);
        return;
      }

      // Button is back to normal → search is complete
      console.log("Search completed. Button back to normal. Now scraping results...");
      scrapeAndSend(searchedPan);
    };

    setTimeout(check, 500);
  }

  // ─── Phase 3: Scrape results and send to background ──────────────────────
  function scrapeAndSend(searchedPan) {
    const pageText = document.body.innerText;
    const gstinForPanRegex = new RegExp(`[0-9]{2}${searchedPan}[0-9A-Z]{3}`, "i");
    const table = document.querySelector('table');
    const hasTableRows = table && table.querySelectorAll('tr').length > 1;
    const hasGstinForPan = gstinForPanRegex.test(pageText);
    const hasNoRecords = pageText.includes("No records found") || 
                         pageText.includes("No GSTIN found") || 
                         pageText.includes("No GST details found") ||
                         pageText.includes("Invalid PAN") ||
                         pageText.includes("No GST linked");

    console.log("Phase 3 - Scraping:", { hasTableRows, hasGstinForPan, hasNoRecords });

    if (hasGstinForPan && hasTableRows) {
      const rows = Array.from(table.querySelectorAll('tr'));
      const textBlock = "GST Details\n" + rows.map(row => {
        return Array.from(row.querySelectorAll('th, td'))
          .map(cell => cell.innerText.trim()).join('\t');
      }).join('\n');

      if (textBlock.length > 50) {
        chrome.runtime.sendMessage({
          action: 'pan_search_success',
          details: textBlock
        });
        showToast("✅ PAN Details fetched! Closing tab...", "#10b981");
        return;
      }
    }

    if (hasNoRecords) {
      sendNoRecords(searchedPan);
      return;
    }

    // Fallback — data might be present but in a different format
    // Try again once more after a short delay
    setTimeout(() => {
      const retryText = document.body.innerText;
      const retryHasGstin = gstinForPanRegex.test(retryText);
      const retryTable = document.querySelector('table');
      if (retryHasGstin && retryTable) {
        const rows = Array.from(retryTable.querySelectorAll('tr'));
        const textBlock = "GST Details\n" + rows.map(row => {
          return Array.from(row.querySelectorAll('th, td'))
            .map(cell => cell.innerText.trim()).join('\t');
        }).join('\n');
        chrome.runtime.sendMessage({ action: 'pan_search_success', details: textBlock });
        showToast("✅ PAN Details fetched! Closing tab...", "#10b981");
      } else {
        sendNoRecords(searchedPan);
      }
    }, 1000);
  }

  function sendNoRecords(searchedPan) {
    chrome.runtime.sendMessage({
      action: 'pan_search_success',
      details: `GST Details\nNo records found for PAN ${searchedPan}`
    });
    showToast("❌ No GST records linked to this PAN!", "#ef4444");
  }

  // ─── Fallback (called if session already set on reload) ──────────────────
  function waitForResultsThenSend(searchedPan) {
    // If page reloaded after submit, just wait for page to stabilize then scrape
    const btn = findSearchButton();
    if (isButtonLoading(btn)) {
      waitForSearchToFinish(searchedPan);
    } else {
      setTimeout(() => scrapeAndSend(searchedPan), 1000);
    }
  }

  function showToast(message, color) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;top:20px;right:20px;background:${color};color:#fff;
      padding:12px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);
      z-index:999999;font-family:sans-serif;font-weight:bold;font-size:14px;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    document.title = message;
  }
})();
