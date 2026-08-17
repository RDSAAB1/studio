// Safely check if Chrome extension context is still valid
function isExtensionValid() {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Wrap chrome.runtime.sendMessage to safely catch "Extension context invalidated" errors
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = function (...args) {
    try {
      if (isExtensionValid()) {
        return originalSendMessage.apply(this, args);
      }
    } catch (e) {
      // Silently consume context invalidation
    }
  };
}

// Run immediately to handle print bypass and child page scraping
try {
  handleChildPages();
} catch (e) {}

function createSilentHiddenIframe(url) {
  if (!url) return;
  try {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed; width:1px; height:1px; left:-9999px; top:-9999px; opacity:0; pointer-events:none; border:none; z-index:-9999;";
    iframe.src = url;
    (document.body || document.documentElement).appendChild(iframe);

    setTimeout(() => {
      try { iframe.remove(); } catch(e) {}
    }, 12000);
  } catch (err) {
    console.error("eMandi Content: createSilentHiddenIframe error:", err);
  }
}

// Listen for messages from the popup (Only relevant on the coordinator page)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("eMandi Content: Received message from popup:", message);
  
  if (message.action === "ping") {
    sendResponse({ status: "ready" });
    return true;
  }

  if (message.action === "createSilentIframe" && message.url) {
    createSilentHiddenIframe(message.url);
    sendResponse({ success: true });
    return false;
  }

  if (message.action === "scrapeData") {
    const { prapatraStart, prapatraEnd } = message.config;
    console.log("eMandi Content: Triggering range scraping for range:", { prapatraStart, prapatraEnd });
    startRowByRowScraping(prapatraStart, prapatraEnd)
      .then(result => {
        console.log("eMandi Content: Range scraping completed successfully. Result count:", result.length);
        sendResponse({ success: true, count: result.length, data: result });
      })
      .catch(error => {
        if (error.message && error.message.includes("Extension context invalidated")) {
          console.warn("eMandi Content: Extension context invalidated. Reloading page...");
          window.location.reload();
        } else {
          console.error("eMandi Content: Scraping execution failed:", error);
          sendResponse({ success: false, error: error.message });
        }
      });
    return true; // Keep message channel open for async response
  }
});

// Helper for logger (works in coordinator and child pages)
function sendLog(message, type = "info") {
  console.log(`[eMandi Log] ${type.toUpperCase()}: ${message}`);
  if (!isExtensionValid()) return;
  const formatted = `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`;
  
  try {
    // Save directly to storage logs so it survives popup close
    chrome.storage.local.get("console_logs", (data) => {
      if (chrome.runtime.lastError || !isExtensionValid()) return;
      const existing = (data && data.console_logs) || "Logs cleared. Ready to search.";
      try {
        chrome.storage.local.set({ console_logs: existing + "\n" + formatted });
      } catch (e) {}
    });

    chrome.runtime.sendMessage({
      action: "log",
      message: formatted
    }, () => {
      const lastError = chrome.runtime.lastError;
    });
  } catch (e) {}
}

// Copy simulating Ctrl+A and Ctrl+C programmatically
function getCtrlASelectionText() {
  console.log("eMandi Content: Simulating Ctrl+A + Ctrl+C...");
  try {
    window.getSelection().removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(document.body);
    window.getSelection().addRange(range);
    const text = window.getSelection().toString();
    window.getSelection().removeAllRanges();
    console.log("eMandi Content: Selection text copied. Size:", text.length);
    return text.trim();
  } catch (e) {
    console.error("eMandi Content: Selection API failed, falling back to innerText", e);
    return document.body.innerText.trim();
  }
}



// Check if we are in one of the popped-up print or payment pages
function handleChildPages() {
  const url = window.location.href;
  console.log("eMandi Content: handleChildPages called for URL:", url);
  
  // Note: print bypass is handled securely and synchronously in the MAIN world via manifest.json using inject.js

  let retryCount = 0;
  const maxRetries = 60; // 60 trials * 25ms = 1.5 seconds max

  const doScrape = () => {
    // 1. Check if background has an active scraper task/batch
    chrome.runtime.sendMessage({ action: "getTask" }, (taskRes) => {
      chrome.runtime.sendMessage({ action: "getBatchStatus" }, (batchRes) => {
        const hasActiveTask = (taskRes && taskRes.task) || (batchRes && batchRes.items && batchRes.items.length > 0);
        
        // If NO active scraper task, the user opened this page manually — do NOT auto-close!
        if (!hasActiveTask) {
          console.log("eMandi Child: No active scraper task running. Leaving manually opened tab active.");
          return;
        }

        const pageText = document.body ? document.body.innerText : "";
        const isCoordinatorPage = url.includes("SixRList") || (url.includes("generated_6R") && !url.includes("print") && !url.includes("Receipt"));
        const isChildWindow = window.opener !== null || window.name !== "";

        const isPrintPage = !isCoordinatorPage && (
                            url.includes("/Receipt/print_6R_processing") || 
                            url.includes("/Receipt/print") ||
                            pageText.includes("कृषि उत्पादन मंडी समिति") || 
                            pageText.includes("विक्रेता के लिए वाउचर") ||
                            pageText.includes("प्रपत्र-6") ||
                            (isChildWindow && pageText.length > 100 && !pageText.includes("IFSC") && !pageText.includes("खाता संख्या"))
                          );
                            
        const isPaymentPage = !isCoordinatorPage && !isPrintPage && (
                              url.includes("ProcessSixR") || 
                              url.includes("printData") ||
                              pageText.includes("खाता संख्या") || 
                              pageText.includes("IFSC") || 
                              pageText.includes("आईएफएससी") ||
                              pageText.includes("भुगतान") ||
                              (isChildWindow && pageText.length > 100)
                            );

        console.log(`eMandi Child: Trial ${retryCount}. Classification:`, { isPrintPage, isPaymentPage });

        if (isPrintPage) {
          const fullPageText = getCtrlASelectionText();
          const isReady = fullPageText.length > 100 && (fullPageText.includes("प्रपत्र") || fullPageText.includes("विक्रेता") || fullPageText.includes("मंडी") || fullPageText.includes("क्रम"));
          if (!isReady) {
            console.log(`eMandi Child: Print text not fully ready (${fullPageText.length} chars). Retrying... Trial ${retryCount}`);
            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(doScrape, 25);
            }
            return;
          }

          let printData = { rawText: fullPageText };
          try {
            printData = parsePrintSlipHtml(document.body.innerHTML);
            printData.rawText = fullPageText;
          } catch (err) {
            console.error("eMandi Child: parsePrintSlipHtml failed:", err);
          }
          
          let extractedPrapatraNo = printData.prapatraNumber || "";
          if (!extractedPrapatraNo || extractedPrapatraNo === ":") {
            const pMatch = fullPageText.match(/\b\d{5,}\([^)]+\)\/6P\/\d+\b|\b\d+.*\/6P\/\d+\b/i) || 
                           fullPageText.match(/(?:प्रपत्र\s*-\s*6\s*नंबर|प्रपत्र\s*-\s*6|6R\s*No|Serial\s*No)[\s:]*([^\t\n\r\s:]+)/i);
            if (pMatch) extractedPrapatraNo = (pMatch[1] || pMatch[0]).trim();
          }

          chrome.storage.local.set({ workspace_f1: fullPageText });
          
          console.log("eMandi Child: Sending print_done for prapatra:", extractedPrapatraNo);
          chrome.runtime.sendMessage({ 
            action: "updateTaskStage", 
            prapatraNumber: extractedPrapatraNo,
            stage: "print_done",
            printDetails: printData 
          });

          if (window.self !== window.top && window.frameElement) {
            try { window.frameElement.remove(); } catch (e) {}
          }
        }
        else if (isPaymentPage) {
          const fullPageText = getCtrlASelectionText();
          const isReady = fullPageText.length > 100 && (fullPageText.includes("खाता") || fullPageText.includes("IFSC") || fullPageText.includes("आईएफएससी") || fullPageText.includes("भुगतान") || fullPageText.includes("प्रपत्र"));
          if (!isReady) {
            console.log(`eMandi Child: Payment text not fully ready (${fullPageText.length} chars). Retrying... Trial ${retryCount}`);
            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(doScrape, 25);
            }
            return;
          }

          let paymentData = { rawText: fullPageText };
          try {
            paymentData = parsePaymentDetailsHtml(document.body.innerHTML);
            paymentData.rawText = fullPageText;
          } catch (err) {
            console.error("eMandi Child: parsePaymentDetailsHtml failed:", err);
          }

          let extractedPrapatraNo = paymentData.prapatraNumber || "";
          if (!extractedPrapatraNo || extractedPrapatraNo === ":") {
            const pMatch = fullPageText.match(/\b\d{5,}\([^)]+\)\/6P\/\d+\b|\b\d+.*\/6P\/\d+\b/i) || 
                           fullPageText.match(/(?:प्रपत्र\s*-\s*6\s*नंबर|प्रपत्र\s*-\s*6|6R\s*No|Serial\s*No)[\s:]*([^\t\n\r\s:]+)/i);
            if (pMatch) extractedPrapatraNo = (pMatch[1] || pMatch[0]).trim();
          }
          
          chrome.storage.local.set({ workspace_f2: fullPageText });
          
          console.log("eMandi Child: Sending payment_done for prapatra:", extractedPrapatraNo);
          chrome.runtime.sendMessage({ 
            action: "updateTaskStage", 
            prapatraNumber: extractedPrapatraNo,
            stage: "payment_done",
            paymentDetails: paymentData 
          });

          if (window.self !== window.top && window.frameElement) {
            try { window.frameElement.remove(); } catch (e) {}
          }
        }
        else {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(doScrape, 25);
          }
        }
      });
    });
  };

  // Run scraping immediately if DOM is ready, otherwise register event listener
  if (document.readyState === "interactive" || document.readyState === "complete") {
    setTimeout(doScrape, 10);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(doScrape, 10));
  }
}

// Listen for intercepted popup window.open events from inject.js to open silent background tabs
window.addEventListener("eMandiOpenIntercepted", (e) => {
  const targetUrl = e.detail ? e.detail.url : null;
  if (targetUrl) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
        console.log("eMandi Content: Intercepted popup event. Requesting silent background tab:", targetUrl);
        chrome.runtime.sendMessage({ action: "openSilentBackgroundTab", url: targetUrl });
      }
    } catch (err) {
      // Silently ignore context invalidation when extension is reloaded
    }
  }
});

function isExtensionValid() {
  try {
    return typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

function extractDocText(doc) {
  if (!doc || !doc.body) return "";
  const clone = doc.body.cloneNode(true);
  clone.querySelectorAll("script, style, noscript").forEach(el => el.remove());
  clone.querySelectorAll("br, p, div, tr, li").forEach(el => {
    el.insertAdjacentText("beforebegin", "\n");
  });
  clone.querySelectorAll("td, th").forEach(el => {
    el.insertAdjacentText("afterend", "\t");
  });
  return clone.textContent.replace(/\t\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function fetchAndParseSilent(targetUrl, isPrintPage) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "fetchUrlSilently", url: targetUrl }, (res) => {
      if (res && res.success && res.html) {
        const html = res.html;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const fullPageText = extractDocText(doc);

        if (isPrintPage) {
          let printData = { rawText: fullPageText };
          try {
            printData = parsePrintSlipHtml(html);
            printData.rawText = fullPageText;
          } catch (e) {}

          let extractedPrapatraNo = printData.prapatraNumber || "";
          if (!extractedPrapatraNo) {
            const pMatch = fullPageText.match(/(?:प्रपत्र\s*-\s*6\s*नंबर|क्रम\s*संख्या|Serial No)\s*([^\t\n\r\s]+)/i);
            if (pMatch) extractedPrapatraNo = pMatch[1].trim();
          }

          resolve({ success: true, prapatraNumber: extractedPrapatraNo, data: printData });
        } else {
          let paymentData = { rawText: fullPageText };
          try {
            paymentData = parsePaymentDetailsHtml(html);
            paymentData.rawText = fullPageText;
          } catch (e) {}

          let extractedPrapatraNo = paymentData.prapatraNumber || "";
          if (!extractedPrapatraNo) {
            const pMatch = fullPageText.match(/(?:प्रपत्र\s*-\s*6\s*नंबर|क्रम\s*संख्या|Serial No)\s*([^\t\n\r\s]+)/i);
            if (pMatch) extractedPrapatraNo = pMatch[1].trim();
          }

          resolve({ success: true, prapatraNumber: extractedPrapatraNo, data: paymentData });
        }
      } else {
        resolve({ success: false });
      }
    });
  });
}

// Clean and resolve any URL string extracted from attributes, onclicks, or JavaScript calls
function cleanExtractedUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  let str = rawUrl.trim();

  // ONLY match strings that are actual URL paths containing Receipt, ProcessSixR, print, or .aspx
  const pathMatch = str.match(/['"](https?:\/\/[^'"]+|\/?[^'"]*(?:Receipt|TraderProcessing|ProcessSixR|print|\.aspx)[^'"]*)['"]/i) ||
                    str.match(/(https?:\/\/[^\s'"]+|\/?[^\s'"]*(?:Receipt|TraderProcessing|ProcessSixR|print|\.aspx)[^\s'"]*)/i);
  
  if (!pathMatch || !pathMatch[1]) return null;
  
  str = pathMatch[1].trim();

  // Reject plain IDs or Prapatra numbers like 35040315(190)/6P/00572 that are not valid page URLs
  const lower = str.toLowerCase();
  if (!lower.includes("receipt") && !lower.includes("processsixr") && !lower.includes("print") && !lower.includes(".aspx")) {
    return null;
  }

  // Remove leading javascript: prefix if any remains
  if (lower.startsWith("javascript:")) {
    str = str.substring(11).replace(/^['"\(\)]+|['"\(\)]+$/g, "").trim();
  }

  if (!str || str === "#" || str.toLowerCase().startsWith("javascript:")) return null;

  try {
    const resolved = new URL(str, baseUrl || window.location.href).href;
    return resolved;
  } catch (e) {
    return null;
  }
}

// Extract clean, fully resolved HTTP URL directly from button attributes or onclick JS
function extractUrlFromBtn(btn) {
  if (!btn) return null;
  
  // 1. Check direct href
  const href = btn.getAttribute("href") || "";
  if (href && href !== "#" && !href.toLowerCase().startsWith("javascript:")) {
    const cleanHref = cleanExtractedUrl(href);
    if (cleanHref) return cleanHref;
  }

  // 2. Check onclick, data attributes, and form action
  const onclick = btn.getAttribute("onclick") || "";
  const dataUrl = btn.getAttribute("data-url") || btn.getAttribute("data-href") || "";
  const formAction = btn.form ? (btn.form.getAttribute("action") || "") : "";

  const combined = `${href} ${onclick} ${dataUrl} ${formAction}`;
  const cleanFromCombined = cleanExtractedUrl(combined);
  if (cleanFromCombined) return cleanFromCombined;

  // 3. Check child elements
  const childLink = btn.querySelector("a[href], [onclick], input, button");
  if (childLink && childLink !== btn) {
    return extractUrlFromBtn(childLink);
  }

  return null;
}

// Extract trailing digits of serial sequence from string (e.g. 00580 -> 580)
function getTrailingNumber(str) {
  if (!str) return null;
  const p6Match = str.match(/\/6P\/(\d+)/i);
  if (p6Match) return parseInt(p6Match[1], 10);
  
  const match = str.match(/(\d+)\D*$/);
  return match ? parseInt(match[1], 10) : null;
}

function waitForBatchCompletion(timeoutMs = 12000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const timerObj = createUnthrottledInterval(async () => {
      chrome.runtime.sendMessage({ action: "getBatchStatus" }, (res) => {
        if (res && res.allDone) {
          timerObj.stop();
          resolve(res.items || []);
        } else if (Date.now() - startTime > timeoutMs) {
          console.warn("eMandi Coordinator: Batch completion timeout. Resolving available state.");
          timerObj.stop();
          resolve(res ? res.items || [] : []);
        }
      });
    }, 50);
  });
}

function getTaskState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getTask" }, (res) => {
      resolve(res ? res.task : null);
    });
  });
}

function waitForParallelCompletion(timeoutMs = 120000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const timerObj = createUnthrottledInterval(async () => {
      const state = await getTaskState();
      if (state && state.printDone && state.paymentDone) {
        timerObj.stop();
        resolve(state);
      } else if (Date.now() - startTime > timeoutMs) {
        timerObj.stop();
        resolve(state || {});
      }
    }, 20);
  });
}

function waitForTabsToClose() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "checkChildTabsClosed" }, () => {
      resolve();
    });
  });
}

// Automatically select "All" in the DataTables "Show entries" dropdown on SixRList
async function autoSelectAllEntries() {
  const selects = Array.from(document.querySelectorAll("select"));
  let lengthSelect = selects.find(sel => {
    const name = (sel.name || "").toLowerCase();
    const id = (sel.id || "").toLowerCase();
    const className = (sel.className || "").toLowerCase();
    return name.includes("length") || id.includes("length") || className.includes("length") || 
           Array.from(sel.options).some(o => o.text.trim().toLowerCase() === "all" || o.value === "-1" || o.value === "all");
  });

  if (!lengthSelect && selects.length > 0) {
    lengthSelect = selects.find(sel => Array.from(sel.options).some(o => o.text.trim().toLowerCase() === "all" || o.text.includes("100") || o.text.includes("50")));
  }

  if (lengthSelect) {
    let allOption = Array.from(lengthSelect.options).find(opt => {
      const txt = opt.text.trim().toLowerCase();
      const val = (opt.value || "").trim().toLowerCase();
      return txt === "all" || val === "-1" || val === "all" || txt.includes("सब") || txt.includes("सभी");
    });

    if (!allOption) {
      let maxVal = -1;
      Array.from(lengthSelect.options).forEach(opt => {
        const v = parseInt(opt.value, 10);
        if (!isNaN(v) && v > maxVal) {
          maxVal = v;
          allOption = opt;
        }
      });
    }

    if (allOption) {
      if (lengthSelect.value !== allOption.value) {
        sendLog(`'Show entries' ड्रॉपडाउन में '${allOption.text.trim()}' (सभी एन्ट्रीज़) स्वतः सेलेक्ट किया जा रहा है...`, "info");
        lengthSelect.value = allOption.value;
        lengthSelect.dispatchEvent(new Event("change", { bubbles: true }));
        // Sleep to let DataTables redraw and clear the previous table content
        await new Promise(resolve => setTimeout(resolve, 800));
        // Wait for DataTables to update all rows in DOM
        await waitForTableToLoad(15000);
      } else {
        sendLog(`'Show entries' में पहले से '${allOption.text.trim()}' सेलेक्टेड है।`, "info");
      }
    }
  } else {
    sendLog(`'Show entries' ड्रॉपडाउन नहीं मिला, सीधे तालिका से प्रपत्र खोजे जा रहे हैं...`, "info");
  }
}

// Clean prapatra number by extracting exact 6R pattern if surrounded by table text or labels
function cleanPrapatraNumber(str) {
  if (!str) return "";
  const match = String(str).match(/\b\d{5,}\([^)]+\)\/6P\/\d+\b|\b\d+.*\/6P\/\d+\b/i);
  if (match) return match[0].trim();
  return String(str).replace(/क्रम\s*संख्या|Serial\s*No/gi, "").replace(/[\s\u00A0]+/g, " ").trim();
}

// Clean and normalize Prapatra Number key to guarantee 0% duplicate rows across pages & sessions
function normalizePrapatraKey(str) {
  if (!str) return "";
  const cleaned = cleanPrapatraNumber(str);
  return cleaned.replace(/[\s\u00A0]+/g, "").trim().toLowerCase();
}

async function collectMatchedRowsAcrossPages(table, columnIndices, startNum, endNum) {
  const matchedRowsMap = new Map();
  let pageCount = 0;
  const maxPages = 50;

  const minNum = Math.min(startNum, endNum);
  const maxNum = Math.max(startNum, endNum);
  const expectedTotal = maxNum - minNum + 1;

  while (pageCount < maxPages) {
    pageCount++;
    const rows = Array.from(table.querySelectorAll("tbody tr"));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowData = parseRowBasicInfo(row, i, columnIndices);
      if (!rowData) continue;

      const rowNum = getTrailingNumber(rowData.prapatraNumber);
      if (rowNum !== null && startNum !== null && endNum !== null) {
        if (rowNum >= minNum && rowNum <= maxNum) {
          const key = normalizePrapatraKey(rowData.prapatraNumber);
          if (key && !matchedRowsMap.has(key)) {
            matchedRowsMap.set(key, { row, info: rowData, rowIndex: i, numericVal: rowNum });
          }
        }
      }
    }

    // Stop if we have collected all numbers in range
    if (matchedRowsMap.size >= expectedTotal) {
      console.log("eMandi Coordinator: All expected records found in range!");
      break;
    }

    // Check for Next pagination button
    const nextBtn = document.querySelector(".paginate_button.next:not(.disabled), li.next:not(.disabled) a, a.next:not(.disabled)");
    let activeNext = nextBtn;
    if (!activeNext) {
      const candidates = Array.from(document.querySelectorAll(".pagination a, .paginate_button, [class*='paginate'] a, button"));
      activeNext = candidates.find(el => {
        const txt = (el.textContent || el.innerText || "").trim().toLowerCase();
        const isNext = txt === "next" || txt === "अगला" || txt === "▶" || txt === ">";
        const isDisabled = el.classList.contains("disabled") || el.getAttribute("disabled") !== null || el.parentElement?.classList.contains("disabled");
        return isNext && !isDisabled;
      });
    }

    if (activeNext) {
      sendLog(`पेज ${pageCount}: ${matchedRowsMap.size} यूनिक रिकॉर्ड मिले। अगले पेज ('Next') पर नेविगेट किया जा रहा है...`, "info");
      activeNext.click();
      await new Promise(resolve => setTimeout(resolve, 800));
    } else {
      break;
    }
  }

  const result = Array.from(matchedRowsMap.values());
  result.sort((a, b) => a.numericVal - b.numericVal);
  return result;
}

// Main Coordinator Logic for Range Search
async function startRowByRowScraping(prapatraStart, prapatraEnd) {
  if (!isExtensionValid()) {
    console.warn("eMandi Content: Extension context invalidated. Auto-reloading page...");
    alert("एक्सटेंशन का नया वर्शन लोड हुआ है! eMandi पेज अपने-आप रिफ्रेश हो रहा है। रिफ्रेश के बाद 'स्क्रैप शुरू करें' पर फिर से क्लिक करें।");
    window.location.reload();
    throw new Error("Extension context invalidated — reloading page.");
  }

  // Activate silent popup interceptor in inject.js
  document.documentElement.setAttribute("data-mandi-scraper-active", "true");
  chrome.storage.local.set({ is_parsing_active: true });

  // Load existing records from storage database to check for duplicates and missing details
  const storageData = await new Promise(resolve => {
    chrome.storage.local.get({ emandi_records: [] }, resolve);
  });
  const dbRecords = storageData.emandi_records || [];
  const dbMap = new Map();
  dbRecords.forEach(rec => {
    const rawSixR = rec.prapatraNumber || rec.sixRNo;
    const key = normalizePrapatraKey(rawSixR);
    if (key) dbMap.set(key, rec);
  });

  sendLog(`खोज शुरू: प्रपत्र संख्या रेंज "${prapatraStart}" से "${prapatraEnd}"...`, "info");
  console.log("eMandi Coordinator: Locating table...");

  const startNum = getTrailingNumber(prapatraStart);
  const endNum = getTrailingNumber(prapatraEnd);
  sendLog(`रेंज संख्या पहचान: शुरू = ${startNum}, अंत = ${endNum}`, "info");

  // Step 1: Auto select "All" in Show Entries dropdown
  await autoSelectAllEntries();
  const table = await waitForTableToLoad(15000);

  if (!table) {
    console.error("eMandi Coordinator: Main data table not found on page.");
    throw new Error("6R तालिका नहीं मिली! कृपया सुनिश्चित करें कि आप 6RList पेज पर हैं।");
  }
  console.log("eMandi Coordinator: Main data table located successfully:", table);

  const columnIndices = getColumnIndices(table);
  sendLog(`कॉलम मैपिंग: ${JSON.stringify(columnIndices)}`, "info");

  // Step 2: Collect matched rows across pages if necessary
  const matchedRows = await collectMatchedRowsAcrossPages(table, columnIndices, startNum, endNum);

  if (matchedRows.length === 0) {
    console.warn("eMandi Coordinator: No rows matched search range.");
    sendLog(`रेंज के बीच कोई प्रपत्र संख्या नहीं मिली।`, "warn");
    return [];
  }

  console.log("eMandi Coordinator: Rows matched search range:", matchedRows.length, matchedRows);
  sendLog(`रेंज के बीच कुल ${matchedRows.length} रिकॉर्ड मिले।`, "info");
  
  const results = [];

  // Pre-extract all button URLs upfront (fast DOM operations, no network)
  const rowQueue = matchedRows.map(item => {
    const buttons = item.row.querySelectorAll("a, button, [onclick], input[type='button'], input[type='submit']");
    let printBtn = null;
    let paymentBtn = null;
    buttons.forEach(btn => {
      const href = (btn.getAttribute("href") || "").toLowerCase();
      const onclick = (btn.getAttribute("onclick") || "").toLowerCase();
      const text = (btn.innerText || btn.value || "").toLowerCase();
      const combined = `${href} ${onclick} ${text}`;
      if (combined.includes("print") || combined.includes("प्रिंट") || combined.includes("receipt") || btn.classList.contains("btn-warning")) {
        printBtn = btn;
      }
      if (combined.includes("processsixr") || combined.includes("भुगतान") || combined.includes("payment")) {
        paymentBtn = btn;
      }
    });
    return {
      item,
      printBtn,
      paymentBtn,
      printUrl: extractUrlFromBtn(printBtn),
      paymentUrl: extractUrlFromBtn(paymentBtn)
    };
  });

  // Process records strictly sequential (one by one): Fast silent in-memory fetch with tab fallback
  const processedKeys = new Set();

  for (let idx = 0; idx < matchedRows.length; idx++) {
    const item = matchedRows[idx];
    const key = normalizePrapatraKey(item.info.prapatraNumber);

    // Skip if this prapatra number was already processed in this run
    if (key && processedKeys.has(key)) {
      console.log(`eMandi: Prapatra ${item.info.prapatraNumber} already processed. Skipping duplicate.`);
      continue;
    }
    if (key) processedKeys.add(key);

    const buttons = item.row.querySelectorAll("a, button, [onclick], input[type='button'], input[type='submit']");
    let hasPrintBtn = false;
    let hasPaymentBtn = false;
    buttons.forEach(btn => {
      const href = (btn.getAttribute("href") || "").toLowerCase();
      const onclick = (btn.getAttribute("onclick") || "").toLowerCase();
      const text = (btn.innerText || btn.value || "").toLowerCase();
      const combined = `${href} ${onclick} ${text}`;
      if (combined.includes("print") || combined.includes("प्रिंट") || combined.includes("receipt") || btn.classList.contains("btn-warning")) {
        hasPrintBtn = true;
      }
      if (combined.includes("processsixr") || combined.includes("भुगतान") || combined.includes("payment")) {
        hasPaymentBtn = true;
      }
    });

    const existingDbRecord = key ? dbMap.get(key) : null;
    let preExistingPrint = null;
    let preExistingPayment = null;

    if (existingDbRecord) {
      const needPrint = hasPrintBtn && !existingDbRecord.printDetails;
      const needPayment = hasPaymentBtn && !existingDbRecord.paymentDetails;
      
      if (!needPrint && !needPayment) {
        console.log(`eMandi: Prapatra ${item.info.prapatraNumber} is already fully scraped in database. Skipping...`);
        sendLog(`⏭️ [${idx + 1}/${matchedRows.length}] प्रपत्र ${item.info.prapatraNumber} पहले से सुरक्षित है (स्किप किया गया)।`, "success");
        results.push(existingDbRecord);
        continue;
      } else {
        console.log(`eMandi: Prapatra ${item.info.prapatraNumber} has missing details (print: ${needPrint}, payment: ${needPayment}). Fetching missing details...`);
        sendLog(`🔄 [${idx + 1}/${matchedRows.length}] प्रपत्र ${item.info.prapatraNumber}: अधूरा डेटा मिला, पुनः फ़ेच किया जा रहा है...`, "info");
        preExistingPrint = existingDbRecord.printDetails || null;
        preExistingPayment = existingDbRecord.paymentDetails || null;
      }
    }

    const progress = Math.round(((idx + 1) / matchedRows.length) * 100);

    if (!isExtensionValid()) {
      alert("एक्सटेंशन का नया वर्शन लोड हुआ है! eMandi पेज अपने-आप रिफ्रेश हो रहा है। रिफ्रेश होने के बाद 'स्क्रैप शुरू करें' पर फिर से क्लिक करें।");
      window.location.reload();
      throw new Error("Extension context invalidated — reloading page.");
    }

    if (isExtensionValid()) {
      try {
        chrome.storage.local.set({
          progress_percent: progress,
          progress_status: `प्रोसेसिंग (${idx + 1}/${matchedRows.length}): प्रपत्र ${item.info.prapatraNumber}`
        });

        chrome.runtime.sendMessage({
          action: "progress",
          percent: progress,
          status: `प्रोसेसिंग (${idx + 1}/${matchedRows.length}): प्रपत्र ${item.info.prapatraNumber}`
        });
      } catch (e) {}
    }

    const entryStartTime = Date.now();
    let retriesLeft = 3;
    let isFullyScraped = false;

    const basicRecord = {
      scrapedAt: new Date().toLocaleString(),
      ...item.info,
      printDetails: preExistingPrint,
      paymentDetails: preExistingPayment
    };

    let printBtn = null;
    let paymentBtn = null;

    buttons.forEach(btn => {
      const href = (btn.getAttribute("href") || "").toLowerCase();
      const onclick = (btn.getAttribute("onclick") || "").toLowerCase();
      const text = (btn.innerText || btn.value || "").toLowerCase();
      const combined = `${href} ${onclick} ${text}`;
      
      if (combined.includes("print") || combined.includes("प्रिंट") || combined.includes("receipt") || btn.classList.contains("btn-warning")) {
        printBtn = btn;
      }
      if (combined.includes("processsixr") || combined.includes("भुगतान") || combined.includes("payment")) {
        paymentBtn = btn;
      }
    });

    const printUrl = extractUrlFromBtn(printBtn);
    const paymentUrl = extractUrlFromBtn(paymentBtn);

    while (retriesLeft > 0 && !isFullyScraped) {
      try {
        // Fast in-memory HTTP fetch for THIS single record
        let printRes = null;
        let paymentRes = null;

        const fetchPromises = [];
        if (printUrl && !basicRecord.printDetails) {
          fetchPromises.push(fetchAndParseSilent(printUrl, true).then(r => printRes = r));
        }
        if (paymentUrl && !basicRecord.paymentDetails) {
          fetchPromises.push(fetchAndParseSilent(paymentUrl, false).then(r => paymentRes = r));
        }

        if (fetchPromises.length > 0) {
          await Promise.all(fetchPromises);
        }

        if (printRes && printRes.success && printRes.data) {
          basicRecord.printDetails = printRes.data;
        }
        if (paymentRes && paymentRes.success && paymentRes.data) {
          basicRecord.paymentDetails = paymentRes.data;
        }

        // Fallback: If in-memory fetch is missing details, use hidden tab mode with extended wait (up to 12s)
        const needsPrintFallback = !!printBtn && !basicRecord.printDetails;
        const needsPaymentFallback = !!paymentBtn && !basicRecord.paymentDetails;

        if (needsPrintFallback || needsPaymentFallback) {
          console.log(`eMandi Coordinator: In-memory fetch incomplete for ${item.info.prapatraNumber}. Falling back to tab mode...`);
          sendLog(`⏳ [${idx + 1}/${matchedRows.length}] प्रपत्र ${item.info.prapatraNumber}: सर्वर धीमा है, पूरा विवरण लोड किया जा रहा है...`, "info");

          await setTaskState({
            prapatraNumber: item.info.prapatraNumber,
            needsPrint: needsPrintFallback,
            needsPayment: needsPaymentFallback,
            printDone: !needsPrintFallback,
            paymentDone: !needsPaymentFallback,
            current_record: basicRecord
          });

          if (needsPrintFallback) {
            if (printUrl) createSilentHiddenIframe(printUrl);
            else if (printBtn) printBtn.click();
          }
          if (needsPaymentFallback) {
            if (paymentUrl) createSilentHiddenIframe(paymentUrl);
            else if (paymentBtn) paymentBtn.click();
          }

          // Adaptive completion wait (up to 120s for slow server, but resolves instantly as soon as data arrives)
          const updatedTask = await waitForParallelCompletion(120000);
          await waitForTabsToClose();

          if (updatedTask && updatedTask.current_record) {
            if (updatedTask.current_record.printDetails) basicRecord.printDetails = updatedTask.current_record.printDetails;
            if (updatedTask.current_record.paymentDetails) basicRecord.paymentDetails = updatedTask.current_record.paymentDetails;
          }
        }

        // Verify data completeness before finishing row
        const printOk = !needsPrintFallback || !!basicRecord.printDetails;
        const paymentOk = !needsPaymentFallback || !!basicRecord.paymentDetails;

        if (printOk && paymentOk) {
          isFullyScraped = true;
        } else {
          retriesLeft--;
          if (retriesLeft > 0) {
            sendLog(`⏳ प्रपत्र ${item.info.prapatraNumber}: धीमा सर्वर रिस्पॉन्स, पुनः प्रयास किया जा रहा है...`, "info");
            await new Promise(resolve => setTimeout(resolve, 250));
          } else {
            isFullyScraped = true; // Max retries reached, keep entry with basic info so entry is 100% saved
          }
        }
      } catch (err) {
        retriesLeft--;
        if (retriesLeft <= 0) isFullyScraped = true;
      }
    }

    results.push(basicRecord);
    // Non-blocking background save so loop does not pause for storage write
    saveScrapedDataInContent([basicRecord]).catch(() => {});
    sendLog(`✅ [${idx + 1}/${matchedRows.length}] प्रपत्र ${item.info.prapatraNumber} (100% संकलित)!`, "success");

    const entryDuration = (Date.now() - entryStartTime) / 1000;
    if (entryDuration > 10) {
      console.warn("eMandi: Entry fetch took more than 10 seconds. Server might be down.");
      sendLog(`⚠️ eMandi सर्वर डाउन या धीमा है! प्रपत्र ${item.info.prapatraNumber} को लोड करने में ${Math.round(entryDuration)} सेकंड लगे।`, "warn");
      try {
        chrome.storage.local.set({
          progress_status: `⚠️ सर्वर धीमा/डाउन है (लोड समय: ${Math.round(entryDuration)}s)`
        });
        chrome.runtime.sendMessage({
          action: "progress",
          percent: progress,
          status: `⚠️ सर्वर धीमा/डाउन है (लोड समय: ${Math.round(entryDuration)}s)`
        });
      } catch (e) {}
    }

    // Microtask 0ms pause for instant iteration on fast entries
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Guaranteed final database sync
  await saveScrapedDataInContent(results);

  // Mark parsing 100% complete
  chrome.storage.local.set({ is_parsing_active: false });
  document.documentElement.removeAttribute("data-mandi-scraper-active");
  sendLog("🎉 100% स्क्रैपिंग पूर्ण हुई! 6R लिस्ट डेटा क्लाउड एवं डैशबोर्ड पर अपडेट किया जा रहा है...", "info");
  await new Promise(resolve => setTimeout(resolve, 50));

  console.log("eMandi Coordinator: Scraping session finished. Removing active task state...");
  await setTaskState(null);
  
  // Dispatch 100% complete dataset to Web App & Extension
  try {
    window.dispatchEvent(new CustomEvent("eMandiSyncData", { 
      detail: { records: results } 
    }));

    // Push 100% complete 6R records to Cloud D1 engine
    chrome.storage.local.get(["username", "companyId"], (uData) => {
      fetch(`/api/sync-extension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "push_6r",
          username: uData.username || "",
          companyId: uData.companyId || "",
          records: results
        })
      }).catch(() => {});
    });
  } catch (e) {}

  sendLog(`सारे कार्य 100% पूर्ण और सुरक्षित कर दिए गए हैं!`, "success");
  return results;
}

// Centralized deduplication helper for 6R records
function deduplicateRecords(records) {
  if (!Array.isArray(records)) return [];
  const map = new Map();
  records.forEach(rec => {
    if (!rec) return;
    const rawSixR = rec.prapatraNumber || rec.sixRNo || (rec.tableCache && rec.tableCache.prapatraNumber);
    const cleanSixR = cleanPrapatraNumber(rawSixR);
    const key = normalizePrapatraKey(cleanSixR || rawSixR);

    if (cleanSixR) {
      rec.prapatraNumber = cleanSixR;
      rec.sixRNo = cleanSixR;
      if (rec.tableCache) rec.tableCache.prapatraNumber = cleanSixR;
    }

    if (key && key !== "-") {
      if (map.has(key)) {
        const existing = map.get(key);
        const merged = { ...existing, ...rec };
        if (existing.printDetails || rec.printDetails) {
          merged.printDetails = { ...(existing.printDetails || {}), ...(rec.printDetails || {}) };
        }
        if (existing.paymentDetails || rec.paymentDetails) {
          merged.paymentDetails = { ...(existing.paymentDetails || {}), ...(rec.paymentDetails || {}) };
        }
        if (existing.tableCache || rec.tableCache) {
          merged.tableCache = { ...(existing.tableCache || {}), ...(rec.tableCache || {}) };
        }
        map.set(key, merged);
      } else {
        map.set(key, rec);
      }
    } else {
      const fallbackKey = `${rec.date || ''}_${rec.farmerDetails || rec.seller || ''}_${rec.qty || ''}`;
      if (!map.has(fallbackKey)) {
        map.set(fallbackKey, rec);
      }
    }
  });
  return Array.from(map.values());
}

// Direct Database Save from Content script
function saveScrapedDataInContent(newData) {
  newData.forEach(record => {
    if (!record.tableCache && record.printDetails?.rawText) {
      record.tableCache = parseRawFields(record.printDetails.rawText, record.paymentDetails?.rawText || "");
    }
  });

  return new Promise((resolve) => {
    chrome.storage.local.get(["username", "emandi_records"], (result) => {
      const username = result.username || "";
      const existing = result.emandi_records || [];
      const combined = [...existing, ...newData];
      const deduplicated = deduplicateRecords(combined);
      
      const updates = { emandi_records: deduplicated };
      if (username) {
        updates[`emandi_records_${username}`] = deduplicated;
      }
      
      chrome.storage.local.set(updates, () => {
        console.log("eMandi Content: Saved deduplicated scraped records to database. Count:", deduplicated.length);
        resolve();
      });
    });
  });
}

// Regex Helper to Parse fields from raw text in Content Script
function parseRawFields(voucherText, paymentText) {
  const data = {};
  if (!voucherText) return data;

  try {
    // 1. DATE (Matches date field e.g. 22/06/2026 09:36 AM or raw Hindi date labels)
    const dateMatch = voucherText.match(/(?:विक्रय\/\s*नीलाम\s*का\s*दिनांक|क्रय\s*[\/\s]*\s*नीलामी\s*का\s*दिनांक|दिनांक|Date of Sale)\s*([^\t\n\r\s]+)/i);
    data.date = dateMatch ? dateMatch[1].trim().replace(/\//g, "-") : "";

    // 2. FARMER DETAILS
    const sellerMatch = voucherText.match(/(?:विक्रेता\s*फर्म\s*\/\s*किसान\s*का\s*नाम\s*व\s*जिला|विक्रेता\s*किसान\s*का\s*नाम|Name of Seller)\s*([^\t\n\r]+)/i);
    const fatherMatch = voucherText.match(/(?:पिता\s*का\s*नाम|Father's Name)\s*([^\t\n\r]+)/i);
    const villageMatch = voucherText.match(/(?:गाँव\s*का\s*नाम|Village Name)\s*([^\t\n\r]+)/i);
    
    const sellerRaw = sellerMatch ? sellerMatch[1].trim() : "";
    const fatherName = fatherMatch ? fatherMatch[1].trim() : "";
    let villageName = villageMatch ? villageMatch[1].trim() : "";
    
    let sellerName = sellerRaw;
    if (sellerRaw && !villageName) {
      // Auto-extract village name from combined seller/firm/district string if separate village is missing
      const words = sellerRaw.split(/\s+/);
      if (words.length > 2) {
        villageName = words.pop();
        sellerName = words.join(" ");
      } else if (words.length === 2) {
        villageName = words[1];
        sellerName = words[0];
      }
    }
    
    data.farmerDetails = [sellerName, fatherName ? `S/O: ${fatherName}` : null, villageName].filter(Boolean).join(", ");

    // 3. MOBILE
    const mobileMatch = voucherText.match(/(?:मोबाइल\s*नंबर|Mobile Number)\s*([^\t\n\r\s]+)/i);
    data.mobile = mobileMatch ? mobileMatch[1].trim() : "";

    // 4. KHASRA
    const khasraMatch = voucherText.match(/(?:खसरा\s*नंबर\s*जिस\s*पर\s*उत्त्पादन\s*किया\s*गया\s*है|खसरा\s*नंबर|Khasra Number)\s*([^\t\n\r]+)/i);
    data.khasra = khasraMatch ? khasraMatch[1].trim() : "";

    // 5. 6R NO
    let prapatraNo = "";
    const combinedAllText = voucherText + " " + (paymentText || "");
    const directMatch = combinedAllText.match(/\b\d{5,}\([^)]+\)\/6P\/\d+\b|\b\d+.*\/6P\/\d+\b/i);
    if (directMatch) {
      prapatraNo = directMatch[0].trim();
    } else {
      const pMatch = combinedAllText.match(/(?:प्रपत्र\s*-\s*6\s*नंबर|प्रपत्र\s*-\s*6|6R\s*No|Serial\s*No)[\s:]*([^\t\n\r\s:]+)/i);
      if (pMatch && pMatch[1]) {
        prapatraNo = pMatch[1].trim();
      }
    }
    data.prapatraNumber = prapatraNo;

    // 6. QTY, RATE, AMT, FEE, CESS, TOTAL
    const cleanCropText = voucherText.replace(/[₹$,]/g, "");
    const cropRowMatch = cleanCropText.match(/([^\d\n\r]+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/);
    if (cropRowMatch) {
      const textVal = cropRowMatch[1].trim();
      const parts = textVal.split(/\t|\s{2,}/);
      if (parts.length >= 2) {
        data.commodity = parts[0].trim();
        data.variety = parts[1].trim();
      } else {
        const spaceIdx = textVal.indexOf(" ");
        if (spaceIdx !== -1) {
          data.commodity = textVal.substring(0, spaceIdx).trim();
          data.variety = textVal.substring(spaceIdx + 1).trim();
        } else {
          data.commodity = textVal;
          data.variety = "—";
        }
      }
      data.qty = parseFloat(cropRowMatch[2]).toFixed(2);
      data.rate = Math.round(parseFloat(cropRowMatch[3]));
      data.amt = Math.round(parseFloat(cropRowMatch[4]));
      data.fee = Math.round(parseFloat(cropRowMatch[6]));
      data.cess = Math.round(parseFloat(cropRowMatch[7]));
      data.total = Math.round(parseFloat(cropRowMatch[8]));
    } else {
      data.commodity = ""; data.variety = ""; data.qty = ""; data.rate = ""; data.amt = ""; data.fee = ""; data.cess = ""; data.total = "";
    }

    if (paymentText) {
      // 7. PAY DATE
      const dateMatches = paymentText.match(/\d{1,2}[-/](?:[A-Za-z]{3}|\d{1,2})[-/]\d{2,4}/gi);
      if (dateMatches && dateMatches.length > 0) {
        data.payDate = dateMatches[0].trim().replace(/\//g, "-");
      } else {
        const payDateMatch = paymentText.match(/(?:भुगतान\s*का\s*दिनांक|Date of Payment)\s*([^\t\n\r\s]+)/);
        data.payDate = payDateMatch ? payDateMatch[1].trim().split(" ")[0].replace(/\//g, "-") : "";
      }

      // 8. ACC NO
      const accMatch = paymentText.match(/(?:किसान\s*का\s*बैंक\s*खाता\s*संख्या|Account Number)\s*([^\t\n\r]+)/);
      data.accNo = accMatch ? accMatch[1].trim() : "";

      // 9. IFSC
      const ifscMatch = paymentText.match(/(?:IFSC\s*कोड|IFSC Code)\s*([^\t\n\r]+)/);
      data.ifsc = ifscMatch ? ifscMatch[1].trim() : "";

      // 10. UTR
      const utrMatch = paymentText.match(/(?:ट्रांसक्शन\s*नंबर|Transaction Number|UTR Number|UTR No)\s*([^\t\n\r]+)/);
      data.utr = utrMatch ? utrMatch[1].trim() : "";
    } else {
      data.payDate = ""; data.accNo = ""; data.ifsc = ""; data.utr = "";
    }
  } catch (err) {
    console.error("eMandi Content: parseRawFields error:", err);
  }

  return data;
}

// Web Worker Timer Helper — Bypasses Chrome background tab throttling (never throttled to 1000ms!)
function createUnthrottledInterval(callback, ms) {
  try {
    const blob = new Blob([`
      let timer = null;
      self.onmessage = function(e) {
        if (e.data.action === "start") {
          timer = setInterval(function() {
            self.postMessage("tick");
          }, e.data.ms);
        } else if (e.data.action === "stop") {
          if (timer) clearInterval(timer);
        }
      };
    `], { type: "application/javascript" });

    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = function() {
      callback();
    };
    worker.postMessage({ action: "start", ms });

    return {
      stop: function() {
        try {
          worker.postMessage({ action: "stop" });
          worker.terminate();
        } catch (e) {}
      }
    };
  } catch (err) {
    const timer = setInterval(callback, ms);
    return {
      stop: function() {
        clearInterval(timer);
      }
    };
  }
}

let keepAlivePort = null;
function startKeepAlivePort() {
  if (!keepAlivePort && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.connect) {
    try {
      keepAlivePort = chrome.runtime.connect({ name: "emandi_keepalive" });
      keepAlivePort.onDisconnect.addListener(() => {
        keepAlivePort = null;
      });
    } catch (e) {}
  }
}

function stopKeepAlivePort() {
  if (keepAlivePort) {
    try {
      keepAlivePort.disconnect();
    } catch (e) {}
    keepAlivePort = null;
  }
}

// State Machine Background Memory Helpers (centralized communication)
function setTaskState(state) {
  startKeepAlivePort();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "setTask", task: state }, (res) => {
      console.log("eMandi Coordinator: setTask response:", res);
      resolve();
    });
  });
}

// Poll storage waiting for the popped-up window to finish scraping
function getTaskState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getTask" }, (res) => {
      resolve(res ? res.task : null);
    });
  });
}

async function waitForStageChange(targetStage, timeoutMs = 15000) {
  const startTime = Date.now();
  console.log(`eMandi Coordinator: waitForStageChange polling started for targetStage: ${targetStage}...`);
  return new Promise((resolve, reject) => {
    const timerObj = createUnthrottledInterval(async () => {
      const state = await getTaskState();
      
      if (state && state.stage === targetStage) {
        console.log(`eMandi Coordinator: Stage change matched to ${targetStage}! Polling stopped.`);
        timerObj.stop();
        resolve(state);
      } else if (Date.now() - startTime > timeoutMs) {
        console.error(`eMandi Coordinator: Timeout waiting for stage change to ${targetStage}`);
        timerObj.stop();
        reject(new Error("पेज लोड या प्रतिक्रिया समय समाप्त (Timeout waiting for tab)"));
      }
    }, 25);
  });
}

async function waitForParallelCompletion(timeoutMs = 120000) {
  const startTime = Date.now();
  console.log("eMandi Coordinator: waitForParallelCompletion polling started (Unthrottled)...");
  return new Promise((resolve) => {
    const timerObj = createUnthrottledInterval(async () => {
      const state = await getTaskState();
      
      if (state && state.printDone && state.paymentDone) {
        console.log("eMandi Coordinator: Both parallel tab tasks completed successfully! Polling stopped.");
        timerObj.stop();
        resolve(state);
      } else if (Date.now() - startTime > timeoutMs) {
        console.warn("eMandi Coordinator: Timeout waiting for parallel tasks. Resolving currently available state.");
        timerObj.stop();
        resolve(state || {});
      }
    }, 20);
  });
}

function initBatchInBackground(items) {
  startKeepAlivePort();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "initBatch", items }, () => {
      resolve();
    });
  });
}

function waitForBatchCompletion(timeoutMs = 18000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const timerObj = createUnthrottledInterval(() => {
      chrome.runtime.sendMessage({ action: "getBatchStatus" }, (res) => {
        if (res && res.allDone) {
          console.log("eMandi Coordinator: All batch items completed successfully!");
          timerObj.stop();
          resolve(res.items || []);
        } else if (Date.now() - startTime > timeoutMs) {
          console.warn("eMandi Coordinator: Batch timeout reached. Returning available batch results.");
          timerObj.stop();
          resolve(res ? res.items || [] : []);
        }
      });
    }, 20);
  });
}

function findSixRTable() {
  const tables = document.querySelectorAll("table");
  for (const t of tables) {
    const text = t.innerText;
    if (text.includes("प्रपत्र-6") || text.includes("विक्रेता किसान") || text.includes("विवरण देखें") || text.includes("भुगतान विवरण") || text.includes("पृष्ठ संख्या")) {
      return t;
    }
  }
  // Fallback to the first table on the page if text matching fails
  return tables[0] || null;
}

async function waitForSpinnerToDisappear(timeoutMs = 20000) {
  const startTime = Date.now();
  console.log("eMandi: Checking for loading spinner / Please Wait overlay...");
  // Wait a small moment first to let the spinner render
  await new Promise(r => setTimeout(r, 400));
  
  while (Date.now() - startTime < timeoutMs) {
    let isSpinnerVisible = false;
    
    // Check for elements containing "Please Wait..." text
    const elements = Array.from(document.querySelectorAll("div, span, p"));
    for (const el of elements) {
      if (el.innerText && el.innerText.includes("Please Wait...")) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none") {
          isSpinnerVisible = true;
          break;
        }
      }
    }
    
    // Fallback: Check if there's any visible loading overlay by class/id
    if (!isSpinnerVisible) {
      const overlays = document.querySelectorAll("[class*='loading' i], [id*='loading' i], [class*='spinner' i], [id*='spinner' i]");
      for (const ov of overlays) {
        const rect = ov.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(ov).display !== "none") {
          isSpinnerVisible = true;
          break;
        }
      }
    }

    if (!isSpinnerVisible) {
      console.log("eMandi: Loader/Spinner is not visible. Proceeding...");
      return;
    }
    
    console.log("eMandi: Loading spinner is visible. Waiting...");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  console.warn("eMandi: Timeout waiting for spinner to disappear.");
}

async function waitForTableToLoad(timeoutMs = 15000) {
  // First wait for any "Please Wait..." spinner/loading overlay to disappear
  await waitForSpinnerToDisappear(timeoutMs);

  const startTime = Date.now();
  console.log("eMandi: Waiting for table rows to be valid and fully loaded...");
  while (Date.now() - startTime < timeoutMs) {
    const table = findSixRTable();
    if (table) {
      const rows = table.querySelectorAll("tbody tr");
      if (rows.length > 0) {
        const text = rows[0].innerText.toLowerCase();
        if (!text.includes("loading") && !text.includes("processing") && !text.includes("no data") && !text.includes("no records")) {
          // Add a small 100ms yield to let the browser finish DOM updates
          await new Promise(r => setTimeout(r, 100));
          return table;
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return findSixRTable();
}

function getColumnIndices(table) {
  const indices = {
    date: 1,
    prapatra: 2,
    seller: 3,
    buyer: 4,
    crop: 5,
    weight: 6,
    rate: 7,
    status: 9
  };

  if (!table) return indices;
  
  let headerCells = Array.from(table.querySelectorAll("th"));
  if (headerCells.length === 0) {
    const firstRow = table.querySelector("tr");
    if (firstRow) {
      headerCells = Array.from(firstRow.querySelectorAll("td"));
    }
  }
  
  if (headerCells.length === 0) return indices;

  headerCells.forEach((th, idx) => {
    const text = th.innerText.trim();
    if (text.includes("दिनांक") || text.includes("Date")) {
      indices.date = idx;
    } else if (text.includes("प्रपत्र-6") || text.includes("प्रपत्र") || text.includes("6R No") || text.includes("6R Number") || text.includes("वाउचर") || text.includes("पृष्ठ")) {
      indices.prapatra = idx;
    } else if (text.includes("किसान") || text.includes("विक्रेता") || text.includes("Seller") || text.includes("Farmer")) {
      indices.seller = idx;
    } else if (text.includes("क्रेता") || text.includes("Buyer") || text.includes("व्यापारी") || text.includes("Trader")) {
      indices.buyer = idx;
    } else if (text.includes("जिंस") || text.includes("Commodity") || text.includes("Crop") || text.includes("फसल")) {
      indices.crop = idx;
    } else if (text.includes("मात्रा") || text.includes("Weight") || text.includes("Qty") || text.includes("तौल")) {
      indices.weight = idx;
    } else if (text.includes("दर") || text.includes("Rate") || text.includes("Price")) {
      indices.rate = idx;
    } else if (text.includes("स्थिति") || text.includes("Status")) {
      indices.status = idx;
    }
  });

  return indices;
}

function parseRowBasicInfo(row, index, indices) {
  const cells = row.querySelectorAll("td");
  if (cells.length < 3) return null;

  const dateStr = cells[indices.date] ? cells[indices.date].innerText.trim() : "";
  let rawPrapatra = cells[indices.prapatra] ? cells[indices.prapatra].innerText.trim() : "";
  let prapatra = cleanPrapatraNumber(rawPrapatra);

  // Smart cell scanning fallback to detect true prapatra number (e.g. 35040315(190)/6P/00606)
  if (!prapatra || prapatra.includes("उत्पादक") || prapatra.includes("किसान") || prapatra.includes("भू-स्वामी")) {
    cells.forEach(td => {
      const txt = td.innerText.trim();
      const tdClean = cleanPrapatraNumber(txt);
      if (tdClean && tdClean.includes("/6P/")) {
        prapatra = tdClean;
      }
    });
  }
  if (!prapatra) prapatra = rawPrapatra;
  const seller = cells[indices.seller] ? cells[indices.seller].innerText.trim() : "";
  const buyer = cells[indices.buyer] ? cells[indices.buyer].innerText.trim() : "";
  const crop = cells[indices.crop] ? cells[indices.crop].innerText.trim() : "";
  const weight = cells[indices.weight] ? cells[indices.weight].innerText.trim() : "";
  const rate = cells[indices.rate] ? cells[indices.rate].innerText.trim() : "";
  const paymentStatus = cells[indices.status] ? cells[indices.status].innerText.trim() : "";

  return {
    index: index + 1,
    date: dateStr,
    prapatraNumber: prapatra,
    seller,
    buyer,
    crop,
    weight,
    rate,
    paymentStatus
  };
}

// Parses HTML of 6R print slip
function parsePrintSlipHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  const info = {};
  const cells = doc.querySelectorAll("td, th, span, div, p");
  
  cells.forEach(el => {
    const text = (el.textContent || "").trim();
    if (text.includes(":") && text.length < 100) {
      const idx = text.indexOf(":");
      const key = text.substring(0, idx).trim();
      const val = text.substring(idx + 1).trim();
      if (key && val) {
        info[key] = val;
      }
    }
  });

  const tables = doc.querySelectorAll("table");
  tables.forEach(table => {
    const rows = table.querySelectorAll("tr");
    rows.forEach(row => {
      const cols = row.querySelectorAll("td, th");
      if (cols.length >= 2) {
        for (let i = 0; i < cols.length; i += 2) {
          if (cols[i] && cols[i+1]) {
            const key = (cols[i].textContent || "").replace(":", "").trim();
            const val = (cols[i+1].textContent || "").trim();
            if (key) info[key] = val;
          }
        }
      }
    });
  });

  info.raw_text_summary = extractDocText(doc);
  return info;
}

// Parses HTML of payment details page
function parsePaymentDetailsHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  const info = {};
  const cells = doc.querySelectorAll("td, th, span, div, p");
  
  cells.forEach(el => {
    const text = (el.textContent || "").trim();
    if (text.includes(":") && text.length < 100) {
      const idx = text.indexOf(":");
      const key = text.substring(0, idx).trim();
      const val = text.substring(idx + 1).trim();
      if (key && val) {
        info[key] = val;
      }
    }
  });

  const tables = doc.querySelectorAll("table");
  tables.forEach((table, tableIdx) => {
    const tableData = [];
    const rows = table.querySelectorAll("tr");
    let headers = [];
    
    rows.forEach((row) => {
      const ths = row.querySelectorAll("th");
      if (ths.length > 0) {
        headers = Array.from(ths).map(th => (th.textContent || "").trim());
      } else {
        const tds = row.querySelectorAll("td");
        if (tds.length > 0) {
          const rowObj = {};
          tds.forEach((td, tdIdx) => {
            const hName = headers[tdIdx] || `Col_${tdIdx}`;
            rowObj[hName] = (td.textContent || "").trim();
          });
          tableData.push(rowObj);
        }
      }
    });
    info[`Table_${tableIdx}`] = tableData;
  });

  info.raw_text_summary = extractDocText(doc);
  return info;
}

// --- Localhost App Integration & Production Sync ---
// This block runs on localhost (dev) AND on netlify.app (production deployment)
const _hostname = window.location.hostname;
const _isAppHost = (
  _hostname === "localhost" ||
  _hostname === "127.0.0.1" ||
  _hostname.endsWith(".netlify.app") ||
  _hostname === "jrmd.netlify.app"
);

if (_isAppHost) {
  console.log("eMandi Content: Running on app host (" + _hostname + "). Registering sync event listeners...");

  const announceExtension = () => {
    window.dispatchEvent(new CustomEvent("eMandiExtensionStatus", { detail: { installed: true } }));
    console.log("eMandi Content: Announced extension status to React app.");
  };

  // Tell the React page that the scraper extension is installed and ready when page loads
  window.addEventListener("load", announceExtension);
  
  // Also dispatch immediately in case page is already loaded
  setTimeout(announceExtension, 200);

  // React app dispatches this whenever a component mounts — re-announce immediately
  window.addEventListener("eMandiAppReady", () => {
    console.log("eMandi Content: React app signaled ready. Re-announcing extension status...");
    announceExtension();
  });

  // Listen for sync request from the React page
  window.addEventListener("eMandiRequestSync", () => {
    console.log("eMandi Content: Sync requested by app. Reading storage...");
    chrome.storage.local.get({ emandi_records: [] }, (result) => {
      console.log("eMandi Content: Retrieved records from storage to sync:", result.emandi_records.length);
      
      // Dispatch the data back to the React page
      window.dispatchEvent(new CustomEvent("eMandiSyncData", { 
        detail: { records: result.emandi_records } 
      }));
    });
  });

  // Listen for clear storage request from the React page
  window.addEventListener("eMandiClearRecords", () => {
    chrome.storage.local.get(["is_parsing_active"], (res) => {
      if (res && res.is_parsing_active) {
        console.warn("eMandi Content: Clear records request PAUSED during 6R parsing/scraping to prevent data loss.");
        return; // BLOCK CLEARING WHILE PARSING IS IN PROGRESS!
      }
      console.log("eMandi Content: Clear records requested by app.");
      chrome.storage.local.set({ emandi_records: [] }, () => {
        console.log("eMandi Content: Storage database cleared successfully.");
        window.dispatchEvent(new CustomEvent("eMandiRecordsCleared", { detail: { success: true } }));
      });
    });
  });

  // Listen for supplier bank accounts sync from React app
  window.addEventListener("eMandiSyncSupplierBankAccounts", (event) => {
    const bankAccounts = (event.detail && event.detail.bankAccounts) || [];
    console.log("eMandi Content: Received eMandiSyncSupplierBankAccounts. Count:", bankAccounts.length);
    chrome.runtime.sendMessage({ action: "syncBankAccounts", accounts: bankAccounts }, (response) => {
      console.log("eMandi Content: Bank accounts sync response:", response);
    });
  });

  // Listen for RTGS statement records sync from React app
  window.addEventListener("eMandiSyncStatementRecords", (event) => {
    const statements = (event.detail && event.detail.statements) || [];
    console.log("eMandi Content: Received eMandiSyncStatementRecords. Count:", statements.length);
    chrome.runtime.sendMessage({ action: "syncStatementRecords", statements }, (response) => {
      console.log("eMandi Content: Statement records sync response:", response);
      // Notify the React app that sync is done
      window.dispatchEvent(new CustomEvent("eMandiStatementsSynced", {
        detail: { success: true, count: (response && response.count) || 0 }
      }));
    });
  });
}

// --- eMandi Portal Payment Details Filler Widget ---

function showToastNotification(msg) {
  const toast = document.createElement("div");
  toast.innerText = msg;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.backgroundColor = "#10b981";
  toast.style.color = "#ffffff";
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "8px";
  toast.style.zIndex = "9999999";
  toast.style.fontWeight = "bold";
  toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  toast.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function fillInput(element, value) {
  if (!element) return;
  try {
    let prototype = HTMLInputElement.prototype;
    if (element.tagName === "TEXTAREA") {
      prototype = HTMLTextAreaElement.prototype;
    } else if (element.tagName === "SELECT") {
      prototype = HTMLSelectElement.prototype;
    }
    
    const valSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (valSetter) {
      valSetter.call(element, value);
    } else {
      element.value = value;
    }
    
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    element.style.border = "2px solid #10b981";
    setTimeout(() => element.style.border = "", 1500);
  } catch (err) {
    console.error("eMandi: fillInput failed, using fallback.", err);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function getPaymentFormInputs() {
  const inputs = {
    accountNo: null,
    ifsc: null,
    transactionNo: null,
    amount: null,
    date: null,
    remarks: null,
    paymentMode: null,
    searchBox: null
  };

  // Direct IDs / Names search (ASP.NET patterns commonly used in eMandi)
  const allInputs = Array.from(document.querySelectorAll("input:not(#emandi-bank-filler-widget input), select:not(#emandi-bank-filler-widget select), textarea:not(#emandi-bank-filler-widget textarea)"));
  allInputs.forEach(inp => {
    const id = (inp.id || "").toLowerCase();
    const name = (inp.name || "").toLowerCase();
    
    // Match Account No
    if (id.includes("account") || name.includes("account") || id.includes("bankacc") || name.includes("bankacc") || id.includes("खाता") || name.includes("खाता")) {
      if (inp.type !== "hidden") inputs.accountNo = inp;
    }
    // Match IFSC
    if (id.includes("ifsc") || name.includes("ifsc")) {
      inputs.ifsc = inp;
    }
    // Match Transaction No / UTR (Do NOT match if it's the amount or date input)
    if ((id.includes("transaction") || name.includes("transaction") || id.includes("utr") || name.includes("utr") || id.includes("receipt") || name.includes("receipt") || id.includes("ref") || name.includes("ref")) &&
        !(id.includes("amount") || name.includes("amount") || id.includes("amt") || name.includes("amt") || id.includes("date") || name.includes("date") || id.includes("mode") || name.includes("mode"))) {
      if (!id.includes("trader") && !name.includes("trader") && !id.includes("merchant") && !name.includes("merchant")) {
        inputs.transactionNo = inp;
      }
    }
    // Match Amount
    if (id.includes("amount") || name.includes("amount") || id.includes("amt") || name.includes("amt") || id.includes("price") || name.includes("price") || id.includes("money") || name.includes("money")) {
      inputs.amount = inp;
    }
    // Match Remarks / Viveran / Vivaran
    if (id.includes("remark") || name.includes("remark") || id.includes("description") || name.includes("description") || id.includes("particular") || name.includes("particular") || id.includes("narration") || name.includes("narration") || id.includes("vivaran") || name.includes("vivaran") || id.includes("viveran") || name.includes("viveran") || id.includes("विवरण") || name.includes("विवरण")) {
      inputs.remarks = inp;
    }
    // Match Payment Mode dropdown
    if (id.includes("mode") || name.includes("mode") || id.includes("type") || name.includes("type") || id.includes("method") || name.includes("method")) {
      inputs.paymentMode = inp;
    }
    // Match Date
    if ((id.includes("date") || name.includes("date") || id.includes("तिथि") || name.includes("तिथि") || id.includes("दिनांक") || name.includes("दिनांक")) &&
        !(id.includes("mode") || name.includes("mode") || id.includes("type") || name.includes("type") || id.includes("method") || name.includes("method"))) {
      inputs.date = inp;
    }
    // Match search/filter box for farmer/supplier
    if (id.includes("search") || name.includes("search") || id.includes("filter") || name.includes("filter") || id.includes("supplier") || name.includes("supplier") || id.includes("farmer") || name.includes("farmer") || id.includes("find") || name.includes("find")) {
      inputs.searchBox = inp;
    }
  });

  // Fallback to searching nearby labels if not found by direct ID/name
  if (!inputs.accountNo || !inputs.ifsc || !inputs.date) {
    const allElements = Array.from(document.querySelectorAll("label, span, td, div, p"));
    allElements.forEach(el => {
      const text = el.textContent.trim();
      const getNearInput = (node) => {
        const parent = node.parentElement;
        if (!parent) return null;
        // Search inside parent first
        let inp = parent.querySelector("input:not([type='hidden'])");
        if (inp) return inp;
        // Search next elements
        let next = node.nextElementSibling;
        while (next) {
          if (next.tagName === "INPUT" && next.type !== "hidden") return next;
          inp = next.querySelector("input:not([type='hidden'])");
          if (inp) return inp;
          next = next.nextElementSibling;
        }
        // Search parent's next sibling
        let nextParent = parent.nextElementSibling;
        if (nextParent) {
          inp = nextParent.querySelector("input:not([type='hidden'])");
          if (inp) return inp;
        }
        return null;
      };

      if (text.includes("बैंक खाता संख्या") || text.includes("खाता संख्या")) {
        if (!inputs.accountNo) inputs.accountNo = getNearInput(el);
      }
      if (text.includes("IFSC") || text.includes("आईएफएससी") || text.includes("IFSC कोड")) {
        if (!inputs.ifsc) inputs.ifsc = getNearInput(el);
      }
      if (text.includes("तिथि") || text.includes("दिनांक") || text.includes("Date") || text.includes("Date of Payment") || text.includes("भुगतान का दिनांक")) {
        if (!inputs.date) inputs.date = getNearInput(el);
      }
    });
  }
  if (!inputs.accountNo) {
    inputs.accountNo = document.querySelector("input[name*='Account' i]:not(#emandi-bank-filler-widget *), input[id*='Account' i]:not(#emandi-bank-filler-widget *), input[name*='AccNo' i]:not(#emandi-bank-filler-widget *), input[id*='AccNo' i]:not(#emandi-bank-filler-widget *), input[name*='AcNo' i]:not(#emandi-bank-filler-widget *), input[id*='AcNo' i]:not(#emandi-bank-filler-widget *), input[name*='खाता' i]:not(#emandi-bank-filler-widget *), input[id*='खाता' i]:not(#emandi-bank-filler-widget *)");
  }
  if (!inputs.ifsc) {
    inputs.ifsc = document.querySelector("input[name*='IFSC' i]:not(#emandi-bank-filler-widget *), input[id*='IFSC' i]:not(#emandi-bank-filler-widget *)");
  }
  if (!inputs.date) {
    inputs.date = document.querySelector("input[name*='Date' i]:not(#emandi-bank-filler-widget *), input[id*='Date' i]:not(#emandi-bank-filler-widget *), input[name*='TxtDate' i]:not(#emandi-bank-filler-widget *), input[id*='TxtDate' i]:not(#emandi-bank-filler-widget *), input[name*='PayDate' i]:not(#emandi-bank-filler-widget *), input[id*='PayDate' i]:not(#emandi-bank-filler-widget *), input[name*='तिथि' i]:not(#emandi-bank-filler-widget *), input[id*='तिथि' i]:not(#emandi-bank-filler-widget *), input[name*='दिनांक' i]:not(#emandi-bank-filler-widget *), input[id*='दिनांक' i]:not(#emandi-bank-filler-widget *), input[placeholder*='Date' i]:not(#emandi-bank-filler-widget *)");
  }
  if (!inputs.transactionNo) {
    inputs.transactionNo = document.querySelector("input[name*='Transaction' i]:not(#emandi-bank-filler-widget *), input[id*='Transaction' i]:not(#emandi-bank-filler-widget *), input[name*='UTR' i]:not(#emandi-bank-filler-widget *), input[id*='UTR' i]:not(#emandi-bank-filler-widget *), input[name*='Receipt' i]:not(#emandi-bank-filler-widget *), input[id*='Receipt' i]:not(#emandi-bank-filler-widget *), input[name*='PaymentNo' i]:not(#emandi-bank-filler-widget *), input[id*='PaymentNo' i]:not(#emandi-bank-filler-widget *), input[name*='PayNo' i]:not(#emandi-bank-filler-widget *), input[id*='PayNo' i]:not(#emandi-bank-filler-widget *), input[name*='Ref' i]:not(#emandi-bank-filler-widget *), input[id*='Ref' i]:not(#emandi-bank-filler-widget *)");
  }
  if (!inputs.amount) {
    inputs.amount = document.querySelector("input[name*='Amount' i]:not(#emandi-bank-filler-widget *), input[id*='Amount' i]:not(#emandi-bank-filler-widget *), input[name*='Payment' i]:not([name*='No' i]):not([name*='Ref' i]):not([name*='Id' i]):not([name*='Num' i]):not(#emandi-bank-filler-widget *), input[id*='Payment' i]:not([id*='No' i]):not([id*='Ref' i]):not([id*='Id' i]):not([id*='Num' i]):not(#emandi-bank-filler-widget *)");
  }
  // Try to find amount in spans/labels if input isn't found
  if (!inputs.amount) {
    const amtSelectors = ["[id*='Amount']", "[id*='Amt']", "[id*='Payment']", "[id*='Total']", "[class*='Amount']", "[class*='Amt']"];
    for (const sel of amtSelectors) {
      const el = document.querySelector(sel + ":not(#emandi-bank-filler-widget *)");
      if (el && (el.innerText.trim() || el.value)) {
        inputs.amount = el;
        break;
      }
    }
  }
  if (!inputs.searchBox) {
    inputs.searchBox = document.querySelector("input[name*='Search']:not(#emandi-bank-filler-widget *), input[id*='Search']:not(#emandi-bank-filler-widget *), input[name*='Filter']:not(#emandi-bank-filler-widget *), input[id*='Filter']:not(#emandi-bank-filler-widget *), input[placeholder*='खोजें']:not(#emandi-bank-filler-widget *), input[placeholder*='Search']:not(#emandi-bank-filler-widget *)");
  }

  return inputs;
}

function getPageFarmerName() {
  // 1. Try to find by common ASP.NET label IDs/names or class patterns
  const selectors = [
    "input[id*='FarmerName']", "input[id*='SellerName']", "input[id*='KisanName']",
    "input[name*='FarmerName']", "input[name*='SellerName']", "input[name*='KisanName']",
    "span[id*='FarmerName']", "span[id*='SellerName']", "span[id*='KisanName']",
    "span[id*='lblFarmer']", "span[id*='lblSeller']", "span[id*='lblKisan']",
    "label[id*='FarmerName']", "label[id*='SellerName']", "label[id*='KisanName']",
    "[id*='lblFarmerName']", "[id*='lblSellerName']", "[id*='lblKisanName']"
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const val = (el.value || el.innerText || "").trim();
      if (val && val.length > 2 && val.length < 60) return val;
    }
  }

  // 2. Search all inputs on the page for farmer/seller names
  const allInputs = Array.from(document.querySelectorAll("input:not([type='hidden'])"));
  for (const inp of allInputs) {
    const id = (inp.id || "").toLowerCase();
    const name = (inp.name || "").toLowerCase();
    if (id.includes("farmername") || name.includes("farmername") || id.includes("sellername") || name.includes("sellername") || id.includes("kisanname") || name.includes("kisanname")) {
      const val = (inp.value || "").trim();
      if (val && val.length > 2 && val.length < 60) return val;
    }
  }

  // 3. Fallback: search DOM labels/cells
  const elements = Array.from(document.querySelectorAll("span, label, td, div, p, th"));
  for (const el of elements) {
    const text = el.innerText.trim();
    if (text.includes("किसान का नाम") || text.includes("विक्रेता का नाम") || text.includes("कृषक का नाम") || text.includes("विक्रेता का नाम व पता") || text.includes("Seller Name") || text.includes("Farmer Name")) {
      // Try finding the text in the next sibling element
      const next = el.nextElementSibling;
      if (next) {
        const val = (next.value || next.innerText || "").trim();
        if (val && val.length > 2 && val.length < 60) return val;
      }
      // If inside a table cell (td), find next td in same row
      if (el.tagName === "TD") {
        const parent = el.parentElement;
        if (parent) {
          const cells = Array.from(parent.querySelectorAll("td"));
          const idx = cells.indexOf(el);
          if (idx !== -1 && cells[idx + 1]) {
            const nameVal = (cells[idx + 1].value || cells[idx + 1].innerText || "").trim();
            if (nameVal && nameVal.length > 2 && nameVal.length < 60) return nameVal;
          }
        }
      }
      // Try parent inner text minus label text
      const parent = el.parentElement;
      if (parent) {
        const pText = parent.innerText.replace(text, "").replace(":", "").replace("-", "").trim();
        if (pText && pText.length > 2 && pText.length < 60) {
          return pText;
        }
      }
    }
  }
  return "";
}

function initBankDetailsFiller() {
  const url = window.location.href;
  if (!url.includes("SixRPaymentmaster")) return;

  console.log("eMandi Content: Initializing Bottom-docked Wide Bank & Statement Filler UI...");

  chrome.storage.local.get({ supplier_bank_accounts: [], statement_records: [] }, (result) => {
    const bankAccounts = result.supplier_bank_accounts || [];
    const statementRecords = result.statement_records || [];
    
    // Bottom Panel Container (Docked at the bottom where gray space is)
    const container = document.createElement("div");
    container.id = "emandi-bank-filler-widget";
    container.style.position = "fixed";
    container.style.bottom = "0";
    container.style.left = "245px"; // Leave space for orange sidebar menu
    container.style.right = "8px";
    container.style.height = "280px";
    container.style.backgroundColor = "#1e293b";
    container.style.color = "#ffffff";
    container.style.borderRadius = "12px 12px 0 0";
    container.style.boxShadow = "0 -10px 25px rgba(0, 0, 0, 0.4)";
    container.style.border = "1px solid #334155";
    container.style.borderBottom = "none";
    container.style.zIndex = "999999";
    container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    container.style.display = "none"; // Initially hidden, will show when there are matches
    container.style.flexDirection = "column";
    container.style.overflow = "hidden";
    container.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    container.style.transform = "translateY(0)"; // Initially open/expanded

    // Header Bar
    const header = document.createElement("div");
    header.style.height = "48px";
    header.style.padding = "0 16px";
    header.style.backgroundColor = "#0f172a";
    header.style.borderBottom = "1px solid #334155";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.cursor = "pointer";

    // Header Left (Title & Badge)
    const headerLeft = document.createElement("div");
    headerLeft.style.display = "flex";
    headerLeft.style.alignItems = "center";
    headerLeft.style.gap = "8px";

    const title = document.createElement("h3");
    title.innerText = "त्वरित डेटा चयन (Quick Fill Panel)";
    title.style.margin = "0";
    title.style.fontSize = "14px";
    title.style.fontWeight = "600";
    title.style.color = "#38bdf8";

    const badge = document.createElement("span");
    badge.innerText = `${bankAccounts.length + statementRecords.length} Items`;
    badge.style.fontSize = "10.5px";
    badge.style.backgroundColor = "#0369a1";
    badge.style.padding = "2px 8px";
    badge.style.borderRadius = "12px";
    badge.style.color = "#e0f2fe";
    badge.style.fontWeight = "600";

    headerLeft.appendChild(title);
    headerLeft.appendChild(badge);
    header.appendChild(headerLeft);

    // Header Center (Search input inside header for compactness)
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "किसान नाम, खाता संख्या, UTR या बैंक खोजें...";
    searchInput.style.width = "400px";
    searchInput.style.padding = "6px 12px";
    searchInput.style.borderRadius = "6px";
    searchInput.style.border = "1px solid #475569";
    searchInput.style.backgroundColor = "#1e293b";
    searchInput.style.color = "#ffffff";
    searchInput.style.fontSize = "12.5px";
    searchInput.style.outline = "none";
    searchInput.style.boxSizing = "border-box";
    searchInput.onclick = (e) => e.stopPropagation(); // Avoid triggering collapse when clicking input
    header.appendChild(searchInput);

    // Header Right (Collapse/Expand toggle button)
    const toggleBtn = document.createElement("button");
    toggleBtn.style.backgroundColor = "transparent";
    toggleBtn.style.color = "#94a3b8";
    toggleBtn.style.border = "none";
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.display = "flex";
    toggleBtn.style.alignItems = "center";
    toggleBtn.style.padding = "4px";
    toggleBtn.style.transition = "color 0.2s";
    toggleBtn.onmouseenter = () => toggleBtn.style.color = "#ffffff";
    toggleBtn.onmouseleave = () => toggleBtn.style.color = "#94a3b8";

    // Chevron Down SVG (initially expanded)
    toggleBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    header.appendChild(toggleBtn);
    container.appendChild(header);

    // Columns Content Wrapper (Side-by-side lists)
    const contentWrapper = document.createElement("div");
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "row";
    contentWrapper.style.flex = "1";
    contentWrapper.style.overflow = "hidden";
    contentWrapper.style.padding = "12px 16px";
    contentWrapper.style.gap = "16px";

    // Column 1: Bank Accounts
    const bankCol = document.createElement("div");
    bankCol.style.flex = "1";
    bankCol.style.display = "flex";
    bankCol.style.flexDirection = "column";
    bankCol.style.overflow = "hidden";

    const bankHeader = document.createElement("div");
    bankHeader.innerText = "🏦 बैंक खाता विवरण (D1 Accounts)";
    bankHeader.style.fontSize = "12.5px";
    bankHeader.style.fontWeight = "700";
    bankHeader.style.color = "#38bdf8";
    bankHeader.style.paddingBottom = "6px";
    bankHeader.style.borderBottom = "1px solid #334155";
    bankHeader.style.marginBottom = "8px";
    bankCol.appendChild(bankHeader);

    const bankList = document.createElement("div");
    bankList.style.flex = "1";
    bankList.style.overflowY = "auto";
    bankList.style.paddingRight = "4px";
    bankCol.appendChild(bankList);

    // Column 2: Statement Records
    const stmtCol = document.createElement("div");
    stmtCol.style.flex = "1";
    stmtCol.style.display = "flex";
    stmtCol.style.flexDirection = "column";
    stmtCol.style.overflow = "hidden";

    const stmtHeader = document.createElement("div");
    stmtHeader.innerText = "📄 बैंक स्टेटमेंट विवरण (UTR / Transactions)";
    stmtHeader.style.fontSize = "12.5px";
    stmtHeader.style.fontWeight = "700";
    stmtHeader.style.color = "#10b981";
    stmtHeader.style.paddingBottom = "6px";
    stmtHeader.style.borderBottom = "1px solid #334155";
    stmtHeader.style.marginBottom = "8px";
    stmtCol.appendChild(stmtHeader);

    const stmtList = document.createElement("div");
    stmtList.style.flex = "1";
    stmtList.style.overflowY = "auto";
    stmtList.style.paddingRight = "4px";
    stmtCol.appendChild(stmtList);

    contentWrapper.appendChild(bankCol);
    contentWrapper.appendChild(stmtCol);
    container.appendChild(contentWrapper);

    // Footer Bar
    const footer = document.createElement("div");
    footer.style.padding = "6px 16px";
    footer.style.backgroundColor = "#0f172a";
    footer.style.borderTop = "1px solid #334155";
    footer.style.fontSize = "11px";
    footer.style.color = "#94a3b8";
    footer.style.textAlign = "center";
    footer.innerText = "सिंक करने के लिए लोकल ऐप में 'Sync to eMandi Extension' का प्रयोग करें।";
    container.appendChild(footer);

    // Collapse / Expand toggle functionality
    let isCollapsed = false;
    const toggleCollapse = () => {
      isCollapsed = !isCollapsed;
      if (isCollapsed) {
        container.style.transform = "translateY(calc(100% - 48px))"; // Only show header at screen bottom
        toggleBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        `;
      } else {
        container.style.transform = "translateY(0)";
        toggleBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        `;
      }
    };
    header.onclick = toggleCollapse;

    const cleanAmountStr = (val) => {
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

    const isBankMatch = (accBank, stmtBank) => {
      if (!accBank || !stmtBank) return false;
      const b1 = accBank.toLowerCase().trim();
      const b2 = stmtBank.toLowerCase().trim();
      
      if (b1.includes(b2) || b2.includes(b1)) return true;
      
      const getAbbr = (str) => {
        if (str.includes("state bank") || str.includes("sbi")) return "sbi";
        if (str.includes("punjab national") || str.includes("pnb")) return "pnb";
        if (str.includes("baroda") || str.includes("bob") || str.includes("bupb") || str.includes("baroda uttar")) return "bob";
        if (str.includes("union") || str.includes("union bank")) return "union";
        if (str.includes("central bank") || str.includes("cbi")) return "cbi";
        if (str.includes("canara") || str.includes("cnb")) return "canara";
        return null;
      };
      
      const a1 = getAbbr(b1);
      const a2 = getAbbr(b2);
      if (a1 && a2 && a1 === a2) return true;
      
      const getTokens = (str) => {
        return str.split(/[^a-zA-Z0-9]/)
                  .map(t => t.trim().toLowerCase())
                  .filter(t => t.length > 2);
      };
      
      const tokens1 = getTokens(b1);
      const tokens2 = getTokens(b2);
      const ignoreTokens = ["bank", "india", "state", "national", "uttar", "pradesh"];
      const matchTokens1 = tokens1.filter(t => !ignoreTokens.includes(t));
      const matchTokens2 = tokens2.filter(t => !ignoreTokens.includes(t));
      
      return matchTokens1.some(t => matchTokens2.includes(t));
    };

    const getPageAmount = () => {
      const formInputs = getPaymentFormInputs();
      if (!formInputs.amount) return null;
      const val = formInputs.amount.value || formInputs.amount.innerText || "";
      return cleanAmountStr(val);
    };

    const getPageFarmerName = () => {
      const formInputs = getPaymentFormInputs();
      const searchBox = formInputs.searchBox || document.querySelector("input[name*='Search'], input[id*='Search'], input[name*='Filter'], input[id*='Filter'], input[placeholder*='खोजें'], input[placeholder*='Search']");
      return searchBox ? searchBox.value : "";
    };

    let activePageAmount = null;
    let activePageFarmerName = "";

    const renderList = (filterText = "") => {
      bankList.innerHTML = "";
      stmtList.innerHTML = "";
      
      const term = filterText.toLowerCase().trim();
      const pageAmount = activePageAmount;
      const pageFarmerName = activePageFarmerName;
      
      console.log("eMandi Widget: Rendering lists. Page Amount:", pageAmount, "Page Farmer Name:", pageFarmerName, "Search Term:", term);

      // 1. BASE STATEMENTS: If pageAmount is present, ONLY include statements matching that amount!
      // If no pageAmount and no manual widget search term, show empty list.
      let baseStatements = [];
      if (pageAmount) {
        baseStatements = statementRecords.filter(stmt => cleanAmountStr(stmt.amount) === pageAmount);
      } else if (term) {
        baseStatements = statementRecords;
      }

      // 2. BASE BANKS: If pageFarmerName is present, ONLY include matching bank accounts!
      // If no pageFarmerName and no manual widget search term, show empty list.
      let baseBanks = [];
      if (pageFarmerName) {
        baseBanks = bankAccounts.filter(acc => isNameMatch(acc.accountHolderName, pageFarmerName));
      } else if (baseStatements.length > 0) {
        baseBanks = bankAccounts.filter(acc => {
          return baseStatements.some(stmt => isNameMatch(acc.accountHolderName, stmt.name));
        });
      } else if (term) {
        baseBanks = bankAccounts;
      }

      // 3. APPLY SEARCH FILTER (if search term is entered in the widget search box)
      const termWords = term.split(/\s+/).filter(w => w.length > 0);
      
      const searchedBanks = baseBanks.filter(acc => {
        if (termWords.length === 0) return true;
        const name = (acc.accountHolderName || "").toLowerCase();
        const accNo = (acc.accountNumber || "");
        const bank = (acc.bankName || "").toLowerCase();
        
        return termWords.every(word => {
          return name.includes(word) || bank.includes(word) || accNo.includes(word);
        });
      });

      const searchedStatements = baseStatements.filter(stmt => {
        if (termWords.length === 0) return true;
        const name = (stmt.name || "").toLowerCase();
        const utr = (stmt.utr || "").toLowerCase();
        const check = (stmt.checkNo || "").toLowerCase();
        const amount = (stmt.amount || "").toLowerCase();
        const bank = (stmt.bankName || "").toLowerCase();
        const date = (stmt.date || "");
        
        return termWords.every(word => {
          return name.includes(word) || utr.includes(word) || check.includes(word) || amount.includes(word) || bank.includes(word) || date.includes(word);
        });
      });

      // 4. DEDUPLICATE STATEMENTS: Group by Name, Amount, and Date, and prefer UTR over Check No
      const finalStatements = [];
      searchedStatements.forEach(stmt => {
        const stmtAmt = cleanAmountStr(stmt.amount);
        const stmtDate = (stmt.date || "").replace(/[^0-9]/g, "");
        
        const existingIdx = finalStatements.findIndex(existing => {
          const namesMatch = isNameMatch(existing.name, stmt.name);
          const amountsMatch = cleanAmountStr(existing.amount) === stmtAmt;
          const datesMatch = (existing.date || "").replace(/[^0-9]/g, "") === stmtDate;
          return namesMatch && amountsMatch && datesMatch;
        });

        if (existingIdx === -1) {
          finalStatements.push(stmt);
        } else {
          const existing = finalStatements[existingIdx];
          
          const getScore = (s) => {
            const rawUtr = (s.utr || "").trim();
            if (!rawUtr || rawUtr === "—") return 0;
            if (/^\d{6}$/.test(rawUtr)) return 1;
            return 2;
          };
          
          if (getScore(stmt) > getScore(existing)) {
            finalStatements[existingIdx] = stmt;
          }
        }
      });

      // Sort bank accounts: put those that match the bank name of the matched statement(s) at the top!
      if (finalStatements.length > 0) {
        const stmtBankNames = finalStatements.map(s => s.bankName).filter(Boolean);
        searchedBanks.sort((a, b) => {
          const aMatchesBank = stmtBankNames.some(sBank => isBankMatch(a.bankName, sBank));
          const bMatchesBank = stmtBankNames.some(sBank => isBankMatch(b.bankName, sBank));
          if (aMatchesBank && !bMatchesBank) return -1;
          if (!aMatchesBank && bMatchesBank) return 1;
          return 0;
        });
      }

      // --- AUTOMATIC FORM POPULATE ON MATCH / FILTER ---
      // Only auto-fill if there is exactly one unique matched statement on the screen
      if (finalStatements.length === 1) {
        const stmt = finalStatements[0];
        const autoMatchName = stmt.name;
        
        const formInputs = getPaymentFormInputs();
        
        // Populate search box if empty
        const searchBoxField = formInputs.searchBox || document.querySelector("input[name*='Search'], input[id*='Search'], input[name*='Filter'], input[id*='Filter'], input[placeholder*='खोजें'], input[placeholder*='Search']");
        if (searchBoxField && !searchBoxField.value && window.emandiLastAutoFilledName !== stmt.name) {
          fillInput(searchBoxField, autoMatchName);
          searchBoxField.style.border = "2px solid #38bdf8";
          window.emandiLastAutoFilledName = stmt.name;
          console.log("eMandi Content: Automatically filled matched name in page search box:", autoMatchName);
        }

        const rawUtr = stmt.utr ? stmt.utr.trim() : "";
        const isUtrReallyCheck = /^\d{6}$/.test(rawUtr);
        const hasUtr = rawUtr && rawUtr !== "—" && !isUtrReallyCheck;
        const transRef = hasUtr ? rawUtr : (rawUtr || stmt.checkNo || "");
        const modeText = hasUtr ? "OK" : (transRef ? "TRANSFER" : "");

        // Populate Transaction/UTR number
        if (formInputs.transactionNo && transRef) {
          fillInput(formInputs.transactionNo, transRef);
        }

        // Populate Date
        if (formInputs.date) {
          let dateVal = stmt.date || "";
          if (formInputs.date.type === "date") {
            if (dateVal && dateVal.includes("/")) {
              const parts = dateVal.split("/");
              if (parts.length === 3) {
                dateVal = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
              }
            }
          } else {
            if (dateVal && dateVal.includes("-")) {
              const parts = dateVal.split("-");
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  dateVal = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                  dateVal = dateVal.replace(/-/g, "/");
                }
              }
            }
          }
          fillInput(formInputs.date, dateVal);
        }

        // Populate Payment Mode
        if (formInputs.paymentMode && stmt.description) {
          const descUpper = stmt.description.toUpperCase();
          let matchedMode = "";
          if (descUpper.includes("NEFT") || descUpper.includes("RTGS") || descUpper.includes("TRF")) {
            matchedMode = "RTGS/NEFT";
          } else if (descUpper.includes("UPI")) {
            matchedMode = "UPI";
          } else if (descUpper.includes("CARD")) {
            matchedMode = "Card Payment";
          } else if (descUpper.includes("DD")) {
            matchedMode = "DD";
          } else if (descUpper.includes("NET BANKING") || descUpper.includes("IB") || descUpper.includes("NETBANKING")) {
            matchedMode = "Net Banking";
          }

          if (matchedMode) {
            const options = Array.from(formInputs.paymentMode.options);
            const foundOpt = options.find(opt => 
              opt.text.toUpperCase().includes(matchedMode.toUpperCase()) || 
              opt.value.toUpperCase().includes(matchedMode.toUpperCase())
            );
            if (foundOpt) {
              fillInput(formInputs.paymentMode, foundOpt.value);
            }
          }
        }

        // Populate Remarks/vivaran
        if (modeText) {
          const remarksField = formInputs.remarks || document.querySelector("input[name*='Remarks'], input[id*='Remarks'], input[name*='Vivaran'], input[id*='Vivaran'], textarea[name*='Remarks'], textarea[id*='Remarks'], textarea[name*='Vivaran'], textarea[id*='Vivaran']");
          if (remarksField) {
            fillInput(remarksField, modeText);
          }
        }
        
        // Populate Bank Details from searchedBanks[0] (with a 1-second delay to ensure portal AJAX has finished)
        if (searchedBanks.length > 0) {
          const acc = searchedBanks[0];
          setTimeout(() => {
            const updatedInputs = getPaymentFormInputs();
            if (updatedInputs.accountNo) {
              fillInput(updatedInputs.accountNo, acc.accountNumber || "");
            }
            if (updatedInputs.ifsc) {
              fillInput(updatedInputs.ifsc, acc.ifscCode || "");
            }
          }, 1000);
        }
        
        showToastNotification("त्वरित मिलान: विवरण स्वतः भर दिए गए हैं! (Auto-matched & Filled!)");
      } else if (finalStatements.length === 0 && searchedBanks.length === 1) {
        // Fallback: If no statement matched but exactly one bank details matched
        const acc = searchedBanks[0];
        setTimeout(() => {
          const updatedInputs = getPaymentFormInputs();
          if (updatedInputs.accountNo) {
            fillInput(updatedInputs.accountNo, acc.accountNumber || "");
          }
          if (updatedInputs.ifsc) {
            fillInput(updatedInputs.ifsc, acc.ifscCode || "");
          }
        }, 1000);
      }

      const appendBankItem = (acc) => {
        const isBestMatch = finalStatements.some(stmt => isBankMatch(acc.bankName, stmt.bankName));
        const badgeLabel = isBestMatch ? "🎯 बेस्ट मैच (Name & Bank)" : "🎯 मैच";
        const badgeStyle = isBestMatch 
          ? "background-color: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);" 
          : "background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);";
        const defaultBg = "#1e293b";
        const defaultBorder = isBestMatch ? "1px solid #6366f1" : "1px solid #334155";
        const hoverBg = "#334155";
        const hoverBorder = isBestMatch ? "#818cf8" : "#4f46e5";

        const item = document.createElement("div");
        item.style.padding = "10px 12px";
        item.style.marginBottom = "6px";
        item.style.borderRadius = "8px";
        item.style.backgroundColor = defaultBg;
        item.style.border = defaultBorder;
        item.style.cursor = "pointer";
        item.style.transition = "all 0.2s ease";
        item.style.minHeight = "82px";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.justifyContent = "space-between";
        item.style.boxSizing = "border-box";

        item.onmouseenter = () => {
          item.style.backgroundColor = hoverBg;
          item.style.borderColor = hoverBorder;
        };
        item.onmouseleave = () => {
          item.style.backgroundColor = defaultBg;
          item.style.borderColor = isBestMatch ? "#6366f1" : "#334155";
        };

        item.onclick = () => {
          const formInputs = getPaymentFormInputs();
          if (formInputs.accountNo) {
            fillInput(formInputs.accountNo, acc.accountNumber || "");
          }
          if (formInputs.ifsc) {
            fillInput(formInputs.ifsc, acc.ifscCode || "");
          }
          
          const searchBoxField = formInputs.searchBox || document.querySelector("input[name*='Search'], input[id*='Search'], input[name*='Filter'], input[id*='Filter'], input[placeholder*='खोजें'], input[placeholder*='Search']");
          if (searchBoxField && acc.accountHolderName) {
            fillInput(searchBoxField, acc.accountHolderName);
          }

          showToastNotification(`खाता और IFSC भरा गया: ${acc.accountHolderName}`);
        };

        item.innerHTML = `
          <div style="font-weight: 600; font-size: 13px; color: #38bdf8; display: flex; justify-content: space-between; align-items: center; line-height: 1;">
            <span>${acc.accountHolderName || "Unknown"}</span>
            <span style="font-size: 9.5px; ${badgeStyle} padding: 2px 6px; border-radius: 4px; font-weight: bold; line-height: 1; height: fit-content;">${badgeLabel}</span>
          </div>
          <div style="font-size: 11.5px; color: #e2e8f0; margin-top: 2px; line-height: 1;">A/C: ${acc.accountNumber || "—"}</div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 1px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">IFSC: ${acc.ifscCode || "—"} | ${acc.bankName || ""}</div>
        `;
        bankList.appendChild(item);
      };

      const appendStatementItem = (stmt) => {
        const item = document.createElement("div");
        item.style.padding = "10px 12px";
        item.style.marginBottom = "6px";
        item.style.borderRadius = "8px";
        item.style.backgroundColor = "#1e293b";
        item.style.border = "1px solid #10b981";
        item.style.cursor = "pointer";
        item.style.transition = "all 0.2s ease";
        item.style.minHeight = "82px";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.justifyContent = "space-between";
        item.style.boxSizing = "border-box";

        item.onmouseenter = () => {
          item.style.backgroundColor = "#334155";
          item.style.borderColor = "#34d399";
        };
        item.onmouseleave = () => {
          item.style.backgroundColor = "#1e293b";
          item.style.borderColor = "#10b981";
        };

        item.onclick = () => {
          const formInputs = getPaymentFormInputs();
          const rawUtr = stmt.utr ? stmt.utr.trim() : "";
          const isUtrReallyCheck = /^\d{6}$/.test(rawUtr);
          const hasUtr = rawUtr && rawUtr !== "—" && !isUtrReallyCheck;
          const transRef = hasUtr ? rawUtr : (rawUtr || stmt.checkNo || "");
          const modeText = hasUtr ? "OK" : (transRef ? "TRANSFER" : "");

          if (formInputs.transactionNo && transRef) {
            fillInput(formInputs.transactionNo, transRef);
          }

          if (formInputs.date) {
            let dateVal = stmt.date || "";
            if (formInputs.date.type === "date") {
              if (dateVal && dateVal.includes("/")) {
                const parts = dateVal.split("/");
                if (parts.length === 3) {
                  dateVal = `${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`;
                }
              }
            } else {
              if (dateVal && dateVal.includes("-")) {
                const parts = dateVal.split("-");
                if (parts.length === 3) {
                  if (parts[0].length === 4) {
                    dateVal = `${parts[2]}/${parts[1]}/${parts[0]}`;
                  } else {
                    dateVal = dateVal.replace(/-/g, "/");
                  }
                }
              }
            }
            fillInput(formInputs.date, dateVal);
          }
          
          if (formInputs.paymentMode && stmt.description) {
            const descUpper = stmt.description.toUpperCase();
            let matchedMode = "";
            if (descUpper.includes("NEFT") || descUpper.includes("RTGS") || descUpper.includes("TRF")) {
              matchedMode = "RTGS/NEFT";
            } else if (descUpper.includes("UPI")) {
              matchedMode = "UPI";
            } else if (descUpper.includes("CARD")) {
              matchedMode = "Card Payment";
            } else if (descUpper.includes("DD")) {
              matchedMode = "DD";
            } else if (descUpper.includes("NET BANKING") || descUpper.includes("IB") || descUpper.includes("NETBANKING")) {
              matchedMode = "Net Banking";
            }

            if (matchedMode) {
              const options = Array.from(formInputs.paymentMode.options);
              const foundOpt = options.find(opt => 
                opt.text.toUpperCase().includes(matchedMode.toUpperCase()) || 
                opt.value.toUpperCase().includes(matchedMode.toUpperCase())
              );
              if (foundOpt) {
                fillInput(formInputs.paymentMode, foundOpt.value);
              }
            }
          }

          if (modeText) {
            const remarksField = formInputs.remarks || document.querySelector("input[name*='Remarks'], input[id*='Remarks'], input[name*='Vivaran'], input[id*='Vivaran'], textarea[name*='Remarks'], textarea[id*='Remarks'], textarea[name*='Vivaran'], textarea[id*='Vivaran']");
            if (remarksField) {
              fillInput(remarksField, modeText);
            }
          }

          const searchBoxField = formInputs.searchBox || document.querySelector("input[name*='Search'], input[id*='Search'], input[name*='Filter'], input[id*='Filter'], input[placeholder*='खोजें'], input[placeholder*='Search']");
          if (searchBoxField && stmt.name) {
            fillInput(searchBoxField, stmt.name);
          }

          // Match bank details by name and fill them
          const matchedAcc = bankAccounts.find(acc => isNameMatch(acc.accountHolderName, stmt.name));
          if (matchedAcc) {
            if (formInputs.accountNo) {
              fillInput(formInputs.accountNo, matchedAcc.accountNumber || "");
            }
            if (formInputs.ifsc) {
              fillInput(formInputs.ifsc, matchedAcc.ifscCode || "");
            }
          }

          showToastNotification(`${hasUtr ? "UTR" : "Check No"} (${transRef || "—"}), तिथि (${stmt.date || "—"}) भरी गई! | विवरण: ${modeText || "—"}`);
        };

        const displayLabel = (/^\d{6}$/.test((stmt.utr || "").trim())) ? "Check No" : "UTR";

        item.innerHTML = `
          <div style="font-weight: 600; font-size: 12.5px; color: #10b981; display: flex; justify-content: space-between; align-items: center; line-height: 1; font-family: monospace;">
            <span>${displayLabel}: ${stmt.utr || stmt.checkNo || "—"}</span>
            <span style="font-size: 9.5px; background-color: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: bold; line-height: 1; height: fit-content; font-family: sans-serif;">🎯 अमाउंट मैच</span>
          </div>
          <div style="font-size: 11.5px; color: #e2e8f0; margin-top: 2px; line-height: 1; display: flex; justify-content: space-between;">
            <span>Name: ${stmt.name || "—"}</span>
            <span style="font-weight: bold; color: #ef4444; font-size: 12px;">${stmt.amount || "—"}</span>
          </div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 1px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Date: ${stmt.date || "—"} | ${stmt.bankName || ""}</div>
        `;
        stmtList.appendChild(item);
      };

      // Render bank accounts
      if (searchedBanks.length > 0) {
        searchedBanks.forEach(acc => appendBankItem(acc));
      } else {
        const noData = document.createElement("div");
        if (!pageFarmerName && !term) {
          noData.innerText = "पेज पर किसान का नाम लोड होने की प्रतीक्षा है...";
        } else {
          noData.innerText = "कोई मिलान बैंक खाता नहीं मिला।";
        }
        noData.style.padding = "20px";
        noData.style.textAlign = "center";
        noData.style.color = "#94a3b8";
        noData.style.fontSize = "13px";
        bankList.appendChild(noData);
      }

      // Render statements
      if (finalStatements.length > 0) {
        finalStatements.forEach(stmt => appendStatementItem(stmt));
      } else {
        const noData = document.createElement("div");
        if (!pageAmount && !term) {
          noData.innerText = "पेज पर राशि (Amount) लोड होने की प्रतीक्षा है...";
        } else {
          noData.innerText = "कोई मिलान स्टेटमेंट रिकॉर्ड नहीं मिला।";
        }
        noData.style.padding = "20px";
        noData.style.textAlign = "center";
        noData.style.color = "#94a3b8";
        noData.style.fontSize = "13px";
        stmtList.appendChild(noData);
      }

      // Control panel visibility: show only if we have active matches or the user is searching manually.
      const hasMatches = searchedBanks.length > 0 || finalStatements.length > 0;
      const shouldShow = hasMatches || term !== "";
      if (shouldShow) {
        container.style.display = "flex";
      } else {
        container.style.display = "none";
      }
    };

    // Live listen for amount changes to update matching list dynamically
    const currentInputs = getPaymentFormInputs();
    if (currentInputs.amount && currentInputs.amount.addEventListener) {
      currentInputs.amount.addEventListener("input", () => renderList(searchInput.value));
      currentInputs.amount.addEventListener("change", () => renderList(searchInput.value));
    }

    // Polling interval to auto-detect programmatic changes in name or amount inputs
    let emptyCount = 0;
    setInterval(() => {
      const currentAmt = getPageAmount();
      const currentName = getPageFarmerName();
      
      if (!currentAmt && !currentName) {
        emptyCount++;
        if (emptyCount >= 3 && (activePageAmount !== null || activePageFarmerName !== "")) {
          activePageAmount = null;
          activePageFarmerName = "";
          console.log("eMandi Widget: Inputs stayed empty. Resetting list...");
          renderList(searchInput.value);
        }
        return;
      }
      
      emptyCount = 0;
      
      let changed = false;
      if (currentAmt && currentAmt !== activePageAmount) {
        activePageAmount = currentAmt;
        changed = true;
      }
      if (currentName && currentName !== activePageFarmerName) {
        activePageFarmerName = currentName;
        changed = true;
      }
      
      if (changed) {
        console.log("eMandi Widget: Detected page value change via polling. Re-rendering...", activePageAmount, activePageFarmerName);
        renderList(searchInput.value);
      }
    }, 500);

    searchInput.addEventListener("input", (e) => {
      renderList(e.target.value);
    });

    document.body.appendChild(container);
    renderList();
  });
}

// Initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBankDetailsFiller);
} else {
  initBankDetailsFiller();
}

// ==========================================
// AUTO RANGE SEARCH AND AUTOMATION FOR SixRList
// ==========================================

function findDateInputsAndSearch() {
  const inputs = Array.from(document.querySelectorAll("input"));
  let fromInput = null;
  let toInput = null;
  
  const labels = Array.from(document.querySelectorAll("label, span, td, div"));
  
  labels.forEach(el => {
    const text = el.innerText || "";
    if (text.includes("दिनांक से") || text.includes("Date From")) {
      const input = el.querySelector("input") || (el.nextElementSibling && el.nextElementSibling.querySelector("input")) || el.nextElementSibling;
      if (input && input.tagName === "INPUT") {
        fromInput = input;
      }
    }
    if (text.includes("दिनांक तक") || text.includes("Date To")) {
      const input = el.querySelector("input") || (el.nextElementSibling && el.nextElementSibling.querySelector("input")) || el.nextElementSibling;
      if (input && input.tagName === "INPUT") {
        toInput = input;
      }
    }
  });

  if (!fromInput || !toInput) {
    inputs.forEach(inp => {
      const id = (inp.id || "").toLowerCase();
      const name = (inp.name || "").toLowerCase();
      
      if (id.includes("from") || name.includes("from") || id.includes("start") || name.includes("start")) {
        fromInput = inp;
      }
      if (id.includes("to") || name.includes("to") || id.includes("end") || name.includes("end")) {
        toInput = inp;
      }
    });
  }

  if (!fromInput || !toInput) {
    const textInputs = inputs.filter(inp => inp.type === "text" || inp.type === "date");
    if (textInputs.length >= 2) {
      fromInput = textInputs[0];
      toInput = textInputs[1];
    }
  }

  let searchBtn = null;
  const buttons = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a.btn"));
  buttons.forEach(btn => {
    const text = (btn.innerText || btn.value || "").trim();
    if (text.includes("खोजें") || text.toLowerCase().includes("search") || text.toLowerCase().includes("submit")) {
      searchBtn = btn;
    }
  });

  return { fromInput, toInput, searchBtn };
}

function getLast3MonthsDates() {
  const today = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(today.getMonth() - 3);

  const pad = (n) => String(n).padStart(2, '0');

  const toDateStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
  const fromDateStr = `${pad(threeMonthsAgo.getDate())}/${pad(threeMonthsAgo.getMonth() + 1)}/${threeMonthsAgo.getFullYear()}`;

  return { fromDateStr, toDateStr };
}

function getLoadedTableRange() {
  const table = findSixRTable();
  if (!table) return null;
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  if (rows.length === 0) return null;

  const columnIndices = getColumnIndices(table);
  const numericList = [];
  const prapatraList = [];

  rows.forEach((row, i) => {
    const rowData = parseRowBasicInfo(row, i, columnIndices);
    if (rowData && rowData.prapatraNumber) {
      const num = getTrailingNumber(rowData.prapatraNumber);
      if (num !== null) {
        numericList.push(num);
        prapatraList.push(rowData.prapatraNumber);
      }
    }
  });

  if (numericList.length === 0) return null;

  const paired = prapatraList.map((p, idx) => ({ p, num: numericList[idx] }));
  paired.sort((a, b) => a.num - b.num);

  const minPrapatra = paired[0].p;
  const maxPrapatra = paired[paired.length - 1].p;

  return { minPrapatra, maxPrapatra };
}

async function handleAutoRunSearchFlow() {
  if (!isExtensionValid()) return;
  
  chrome.storage.local.get(["autoRunActive", "autoSearchState", "customDateFrom", "customDateTo"], async (data) => {
    if (!data.autoRunActive) {
      console.log("eMandi Content: Auto run is not active.");
      return;
    }

    console.log("eMandi Content: Auto run active. State:", data.autoSearchState);

    const { fromInput, toInput, searchBtn } = findDateInputsAndSearch();

    if (data.autoSearchState === "init") {
      if (!fromInput || !toInput || !searchBtn) {
        console.warn("eMandi Content: Could not find date inputs or search button for auto-run.");
        return;
      }

      const { fromDateStr, toDateStr } = getLast3MonthsDates();
      const finalFromDate = data.customDateFrom || fromDateStr;
      const finalToDate = data.customDateTo || toDateStr;
      console.log(`eMandi Content: Setting dates to: ${finalFromDate} to ${finalToDate}`);

      fillInput(fromInput, finalFromDate);
      fillInput(toInput, finalToDate);

      chrome.storage.local.set({ autoSearchState: "searching" }, async () => {
        console.log("eMandi Content: Clicking search button...");
        searchBtn.click();

        // 1. Wait a bit (1.5 seconds) for the search query to submit and loading to begin
        await new Promise(r => setTimeout(r, 1500));

        // 2. Wait for the query results table to load on the screen
        const table = await waitForTableToLoad(30000);

        if (table) {
          console.log("eMandi Content: Table loaded (AJAX). Selecting all entries...");
          await autoSelectAllEntries();
          await waitForTableToLoad(15000);
          console.log("eMandi Content: Finding range...");
          const range = getLoadedTableRange();
          if (range) {
            chrome.storage.local.get(["autoRunActive"], (res) => {
              if (res.autoRunActive) {
                chrome.storage.local.set({
                  autoRunActive: false,
                  autoSearchState: "done"
                }, () => {
                  console.log("eMandi Content: Sending startScrapeFromRange to dashboard (AJAX path)...");
                  chrome.runtime.sendMessage({
                    action: "startScrapeFromRange",
                    prapatraStart: range.minPrapatra,
                    prapatraEnd: range.maxPrapatra
                  });
                });
              }
            });
          }
        }
      });
    } 
    else if (data.autoSearchState === "searching") {
      console.log("eMandi Content: Waiting for search results to load...");
      
      const table = await waitForTableToLoad(30000);

      if (!table) {
        console.warn("eMandi Content: Table not loaded/found after search.");
        return;
      }

      console.log("eMandi Content: Table loaded. Selecting all entries...");
      await autoSelectAllEntries();
      await waitForTableToLoad(15000);
      console.log("eMandi Content: Finding range...");
      const range = getLoadedTableRange();
      if (range) {
        console.log("eMandi Content: Found loaded table range:", range);
        
        chrome.storage.local.set({
          autoRunActive: false,
          autoSearchState: "done"
        }, () => {
          console.log("eMandi Content: Sending startScrapeFromRange to dashboard...");
          chrome.runtime.sendMessage({
            action: "startScrapeFromRange",
            prapatraStart: range.minPrapatra,
            prapatraEnd: range.maxPrapatra
          });
        });
      } else {
        console.warn("eMandi Content: No 6R range found in table rows.");
        chrome.storage.local.set({
          autoRunActive: false,
          autoSearchState: "failed"
        });
      }
    }
  });
}

// Auto-run range extraction when the SixRList page loads
if (window.location.href.includes("SixRList")) {
  if (document.readyState === "interactive" || document.readyState === "complete") {
    setTimeout(handleAutoRunSearchFlow, 500);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(handleAutoRunSearchFlow, 500));
  }
}

async function handleAutoLoginFlow() {
  if (!isExtensionValid()) return;
  const loginFormFields = detectLoginPage();
  if (!loginFormFields) return;
  
  logOcr("Login page detected. Initiating credentials autofill and captcha solver...");
  
  const { emailInput, passwordInput, captchaImg, captchaInput } = loginFormFields;
  
  // Prevent browser autocomplete, date, or OTP suggestion interference
  captchaInput.setAttribute("autocomplete", "one-time-code");
  captchaInput.setAttribute("autocorrect", "off");
  captchaInput.setAttribute("autocapitalize", "off");
  captchaInput.setAttribute("spellcheck", "false");
  
  chrome.storage.local.get(["portal_email", "portal_password", "ocr_api_key", "autoRunActive"], async (res) => {
    if (res.autoRunActive) {
      chrome.storage.local.set({ redirectedForLogin: true });
    }
    // 1. Auto-fill Email/Username
    if (res.portal_email) {
      emailInput.value = res.portal_email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      emailInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    
    // 2. Auto-fill Password
    if (res.portal_password) {
      passwordInput.value = res.portal_password;
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    
    // 3. Solve and Auto-fill Captcha
    const trySolve = async () => {
      logOcr("Taking screenshot and preparing OCR request...");
      const code = await solveCaptchaViaOcrApi(captchaImg, res.ocr_api_key);
      if (code) {
        logOcr("OCR solved captcha successfully: " + code);
        captchaInput.value = code;
        captchaInput.dispatchEvent(new Event("input", { bubbles: true }));
        captchaInput.dispatchEvent(new Event("change", { bubbles: true }));
        
        // Auto-click the submit button after a short delay if autoRunActive is active
        chrome.storage.local.get(["autoRunActive"], (storageRes) => {
          if (storageRes.autoRunActive) {
            logOcr("Auto-run active. Submitting login form in 800ms...");
            setTimeout(() => {
              const loginBtn = document.querySelector('button[type="submit"], button#btn, input[type="submit"]');
              if (loginBtn) {
                logOcr("Clicking login button...");
                loginBtn.click();
              } else {
                const form = captchaInput.closest("form");
                if (form) {
                  logOcr("Submitting form directly...");
                  form.submit();
                } else {
                  logOcr("Login button and form not found.");
                }
              }
            }, 800);
          } else {
            logOcr("Auto-fill complete. Waiting for manual submit.");
          }
        });
      } else {
        logOcr("OCR failed to solve captcha. Please solve it manually.");
      }
    };
    
    captchaImg.addEventListener("load", trySolve);
    if (captchaImg.complete) {
      trySolve();
    }
  });
}

function detectLoginPage() {
  const emailInput = document.querySelector('input[type="email"], input[name*="Email" i]:not([type="hidden"]), input[name*="user" i]:not([type="hidden"])');
  const passwordInput = document.querySelector('input[type="password"]');
  const captchaImg = document.querySelector('img[src*="Captcha" i], img[id*="captcha" i]');
  const captchaInput = document.querySelector('input[id*="Captcha" i]:not([type="hidden"]), input[name*="captcha" i]:not([type="hidden"]), input[placeholder*="captcha" i]:not([type="hidden"])');
  
  if (emailInput && passwordInput && captchaImg && captchaInput) {
    return { emailInput, passwordInput, captchaImg, captchaInput };
  }
  return null;
}

// Run login flow on all page loads (if detected)
if (document.readyState === "interactive" || document.readyState === "complete") {
  setTimeout(handleAutoLoginFlow, 500);
} else {
  document.addEventListener("DOMContentLoaded", () => setTimeout(handleAutoLoginFlow, 500));
}

// Redirect to SixRList if autoRunActive is true and we are on dashboard / non-login pages
chrome.storage.local.get(["autoRunActive"], (res) => {
  if (res && res.autoRunActive) {
    const url = window.location.href;
    const isOnLoginPage = url.includes("Account/index") || url.includes("Account/Index") || url.includes("Traders/Login");
    const isOnSixR = url.includes("SixRList");
    
    if (!isOnLoginPage && !isOnSixR) {
      console.log("eMandi Scraper: Auto-run active. Redirecting to SixRList...");
      window.location.href = "https://emandi.up.gov.in/TraderProcessing/SixRList";
    }
  }
});

// Check if we just logged in and need to return focus to the extension dashboard
function checkPostLoginRedirect() {
  if (!isExtensionValid()) return;
  
  // Only check if we are NOT on a login page
  const isLogin = detectLoginPage();
  if (isLogin) return;
  
  chrome.storage.local.get(["redirectedForLogin"], (res) => {
    if (res && res.redirectedForLogin) {
      console.log("eMandi Content: Successful login detected. Requesting return to dashboard...");
      chrome.storage.local.set({ redirectedForLogin: false }, () => {
        chrome.runtime.sendMessage({ action: "focusDashboard" });
      });
    }
  });
}

// Run post-login redirect check
if (document.readyState === "interactive" || document.readyState === "complete") {
  setTimeout(checkPostLoginRedirect, 1000);
} else {
  document.addEventListener("DOMContentLoaded", () => setTimeout(checkPostLoginRedirect, 1000));
}


