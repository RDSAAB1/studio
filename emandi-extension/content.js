// content.js - Scrapes and fetches eMandi UP data by physically clicking and scraping pages

// Wrap chrome.runtime.sendMessage to safely catch "Extension context invalidated" errors
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = function (...args) {
    try {
      if (chrome.runtime.id) {
        return originalSendMessage.apply(this, args);
      }
    } catch (e) {
      console.warn("eMandi Extension: Extension context invalidated. Please refresh the page.", e);
    }
  };
}

// Run immediately to handle print bypass and child page scraping
handleChildPages();

// Listen for messages from the popup (Only relevant on the coordinator page)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("eMandi Content: Received message from popup:", message);
  
  if (message.action === "ping") {
    sendResponse({ status: "ready" });
    return true;
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
        console.error("eMandi Content: Scraping execution failed:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Helper for logger (works in coordinator and child pages)
function sendLog(message, type = "info") {
  console.log(`[eMandi Log] ${type.toUpperCase()}: ${message}`);
  const formatted = `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`;
  
  // Save directly to storage logs so it survives popup close
  chrome.storage.local.get("console_logs", (data) => {
    const existing = data.console_logs || "Logs cleared. Ready to search.";
    chrome.storage.local.set({ console_logs: existing + "\n" + formatted });
  });

  chrome.runtime.sendMessage({
    action: "log",
    message: formatted
  }, () => {
    const lastError = chrome.runtime.lastError;
  });
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
  const maxRetries = 40; // 40 trials * 150ms = 6 seconds max

  const doScrape = () => {
    chrome.runtime.sendMessage({ action: "getTask" }, (response) => {
      const task = response ? response.task : null;
      if (!task) {
        console.log("eMandi Child: No active task found in background. Skipping child scrape.");
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
                          (isChildWindow && task.stage === "print" && pageText.length > 100 && !pageText.includes("IFSC") && !pageText.includes("खाता संख्या"))
                        );
                          
      const isPaymentPage = !isCoordinatorPage && !isPrintPage && (
                            url.includes("ProcessSixR") || 
                            url.includes("printData") ||
                            pageText.includes("खाता संख्या") || 
                            pageText.includes("IFSC") || 
                            pageText.includes("आईएफएससी") ||
                            pageText.includes("भुगतान") ||
                            (isChildWindow && task.stage === "payment" && pageText.length > 100)
                          );

      console.log(`eMandi Child: Trial ${retryCount}. Classification:`, { isPrintPage, isPaymentPage, taskStage: task.stage });

      if (isPrintPage && task.stage === "print") {
        const fullPageText = getCtrlASelectionText();
        if (fullPageText.length < 50) {
          console.log("eMandi Child: text too short, retrying in next tick...");
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(doScrape, 150);
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
        
        chrome.storage.local.set({ workspace_f1: fullPageText });
        navigator.clipboard.writeText(fullPageText).catch(() => {});
        
        chrome.runtime.sendMessage({ 
          action: "updateTaskStage", 
          stage: "print_done",
          printDetails: printData 
        });
      }
      else if (isPaymentPage && task.stage === "payment") {
        const fullPageText = getCtrlASelectionText();
        if (fullPageText.length < 50) {
          console.log("eMandi Child: text too short, retrying in next tick...");
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(doScrape, 150);
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
        
        chrome.storage.local.set({ workspace_f2: fullPageText });
        navigator.clipboard.writeText(fullPageText).catch(() => {});
        
        chrome.runtime.sendMessage({ 
          action: "updateTaskStage", 
          stage: "payment_done",
          paymentDetails: paymentData 
        });
      }
      else {
        // If we are expecting a page but content is not ready/loaded yet
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`eMandi Child: Expected signature not found yet, retrying... Trial ${retryCount}`);
          setTimeout(doScrape, 150);
        } else {
          console.log("eMandi Child: Max retries reached. Exiting without scrape.");
        }
      }
    });
  };

  // Run scraping immediately if DOM is ready, otherwise register event listener
  if (document.readyState === "interactive" || document.readyState === "complete") {
    setTimeout(doScrape, 100);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(doScrape, 100));
  }
}

// Extract trailing digits of serial sequence from string (e.g. 00580 -> 580)
function getTrailingNumber(str) {
  if (!str) return null;
  const match = str.match(/(\d+)\D*$/);
  return match ? parseInt(match[1], 10) : null;
}

// Main Coordinator Logic for Range Search
async function startRowByRowScraping(prapatraStart, prapatraEnd) {
  sendLog(`खोज शुरू: प्रपत्र संख्या रेंज "${prapatraStart}" से "${prapatraEnd}"...`, "info");
  console.log("eMandi Coordinator: Locating table...");

  const startNum = getTrailingNumber(prapatraStart);
  const endNum = getTrailingNumber(prapatraEnd);
  sendLog(`रेंज संख्या पहचान: शुरू = ${startNum}, अंत = ${endNum}`, "info");

  const table = findSixRTable();
  if (!table) {
    console.error("eMandi Coordinator: Main data table not found on page.");
    throw new Error("6R तालिका नहीं मिली! कृपया सुनिश्चित करें कि आप 6RList पेज पर हैं।");
  }
  console.log("eMandi Coordinator: Main data table located successfully:", table);

  const columnIndices = getColumnIndices(table);
  sendLog(`कॉलम मैपिंग: ${JSON.stringify(columnIndices)}`, "info");

  const rows = Array.from(table.querySelectorAll("tbody tr"));
  sendLog(`तालिका में कुल ${rows.length} पंक्तियाँ (Rows) मिलीं।`, "info");
  
  // Find matching rows in numeric range
  const matchedRows = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowData = parseRowBasicInfo(row, i, columnIndices);
    if (!rowData) {
      console.log(`eMandi Coordinator: Row ${i} is not a data row. Skipping.`);
      continue;
    }

    const rowNum = getTrailingNumber(rowData.prapatraNumber);
    console.log(`eMandi Coordinator: Row ${i} parsed: ${rowData.prapatraNumber} -> number: ${rowNum}`);
    
    if (rowNum !== null && startNum !== null && endNum !== null) {
      if (rowNum >= startNum && rowNum <= endNum) {
        matchedRows.push({ row, info: rowData, rowIndex: i, numericVal: rowNum });
      }
    }
  }

  // Sort rows numerically in ascending order so they are processed sequence-wise!
  matchedRows.sort((a, b) => a.numericVal - b.numericVal);

  if (matchedRows.length === 0) {
    console.warn("eMandi Coordinator: No rows matched search range.");
    sendLog(`रेंज के बीच कोई प्रपत्र संख्या नहीं मिली।`, "warn");
    return [];
  }

  console.log("eMandi Coordinator: Rows matched search range:", matchedRows.length, matchedRows);
  sendLog(`रेंज के बीच ${matchedRows.length} रिकॉर्ड मिले।`, "info");
  
  const results = [];
  
  for (let idx = 0; idx < matchedRows.length; idx++) {
    const item = matchedRows[idx];
    const progress = Math.round(((idx + 1) / matchedRows.length) * 100);
    
    // Save progress to storage
    chrome.storage.local.set({
      progress_percent: progress,
      progress_status: `प्रोसेसिंग: ${idx + 1}/${matchedRows.length} (${item.info.prapatraNumber})`
    });

    chrome.runtime.sendMessage({
      action: "progress",
      percent: progress,
      status: `प्रोसेसिंग: ${idx + 1}/${matchedRows.length} (${item.info.prapatraNumber})`
    });

    try {
      sendLog(`प्रोसेसिंग रिकॉर्ड ${idx + 1}/${matchedRows.length}: प्रपत्र ${item.info.prapatraNumber}`, "process");
      console.log(`eMandi Coordinator: Processing row index ${item.rowIndex} (prapatra: ${item.info.prapatraNumber})`);
      
      const cells = item.row.querySelectorAll("td");
      const lastCell = cells[cells.length - 1];
      if (!lastCell) {
        throw new Error("Action column missing");
      }

      const buttons = lastCell.querySelectorAll("a, button");
      let printBtn = null;
      let paymentBtn = null;

      buttons.forEach(btn => {
        const href = btn.getAttribute("href") || "";
        const onclick = btn.getAttribute("onclick") || "";
        const text = btn.innerText || "";
        
        const isPrintMatch = href.includes("print") || onclick.includes("print") || btn.classList.contains("btn-warning") || text.includes("प्रिंट") || text.includes("Print");
        
        if (isPrintMatch) {
          printBtn = btn;
        } else if (href.includes("ProcessSixR") || onclick.includes("ProcessSixR") || text.includes("भुगतान विवरण") || text.includes("भुगतान") || text.includes("Payment")) {
          paymentBtn = btn;
        }
      });

      console.log("eMandi Coordinator: Identified row buttons:", { printBtn: !!printBtn, paymentBtn: !!paymentBtn });

      const basicRecord = {
        scrapedAt: new Date().toLocaleString(),
        ...item.info
      };

      // 1. Click Print Button
      if (printBtn) {
        sendLog(`  -> प्रिंट बटन पर क्लिक किया जा रहा है...`, "click");
        
        console.log("eMandi Coordinator: Setting active task state to 'print' in background memory...");
        await setTaskState({
          stage: "print",
          current_record: basicRecord
        });

        console.log("eMandi Coordinator: Triggering printBtn.click()...");
        printBtn.click();

        console.log("eMandi Coordinator: Waiting for print_done state change...");
        const updatedTask = await waitForStageChange("print_done", 15000);
        console.log("eMandi Coordinator: print_done state change received. Scraped print data:", updatedTask.current_record.printDetails);
        basicRecord.printDetails = updatedTask.current_record.printDetails;
      } else {
        sendLog(`  -> प्रिंट बटन नहीं मिला!`, "warn");
      }

      // 2. Click Payment Button
      if (paymentBtn) {
        sendLog(`  -> भुगतान विवरण बटन पर क्लिक किया जा रहा है...`, "click");

        console.log("eMandi Coordinator: Setting active task state to 'payment' in background memory...");
        await setTaskState({
          stage: "payment",
          current_record: basicRecord
        });

        console.log("eMandi Coordinator: Triggering paymentBtn.click()...");
        paymentBtn.click();

        console.log("eMandi Coordinator: Waiting for payment_done state change...");
        const updatedTask = await waitForStageChange("payment_done", 20000);
        console.log("eMandi Coordinator: payment_done state change received. Scraped payment data:", updatedTask.current_record.paymentDetails);
        basicRecord.paymentDetails = updatedTask.current_record.paymentDetails;
      } else {
        sendLog(`  -> भुगतान विवरण बटन नहीं मिला!`, "warn");
      }

      results.push(basicRecord);
      sendLog(`सफलतापूर्वक प्रपत्र ${item.info.prapatraNumber} संकलित हुआ।`, "success");

      // SAVE DIRECTLY TO DATABASE FROM CONTENT SCRIPT IMMEDIATELY!
      console.log("eMandi Coordinator: Automatically saving and parsing record directly into storage database...");
      await saveScrapedDataInContent([basicRecord]);
      
      // Auto clear the workspace cache in storage
      chrome.storage.local.set({
        workspace_f1: "",
        workspace_f2: ""
      });

      // Short delay between rows
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      console.error(`eMandi Coordinator: Error scraping row ${item.info.prapatraNumber}:`, err);
      sendLog(`त्रुटि (Error) प्रपत्र ${item.info.prapatraNumber} में: ${err.message}`, "error");
    }
  }

  // Wait 3 seconds to let final child tabs finish loading, scraping, and closing cleanly
  sendLog("स्क्रैपिंग पूर्ण हुई। अंतिम सफ़ाई (Cleanup) की जा रही है...", "info");
  await new Promise(resolve => setTimeout(resolve, 1500));

  console.log("eMandi Coordinator: Scraping session finished. Removing active task state...");
  await setTaskState(null);
  
  sendLog(`सारे कार्य पूर्ण और सुरक्षित कर दिए गए हैं!`, "success");
  return results;
}

// Direct Database Save from Content script
function saveScrapedDataInContent(newData) {
  newData.forEach(record => {
    if (!record.tableCache && record.printDetails?.rawText) {
      record.tableCache = parseRawFields(record.printDetails.rawText, record.paymentDetails?.rawText || "");
    }
  });

  return new Promise((resolve) => {
    chrome.storage.local.get({ emandi_records: [] }, (result) => {
      const existing = result.emandi_records;
      
      const mergedMap = new Map();
      existing.forEach(item => mergedMap.set(item.prapatraNumber, item));
      newData.forEach(item => mergedMap.set(item.prapatraNumber, item));
      
      const mergedArray = Array.from(mergedMap.values());
      
      chrome.storage.local.set({ emandi_records: mergedArray }, () => {
        console.log("eMandi Content: Saved scraped records directly to database.");
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
    const prapatraMatch = voucherText.match(/(?:क्रम\s*संख्या|Serial No)\s*([^\t\n\r\s]+)/i) || (paymentText ? paymentText.match(/(?:प्रपत्र\s*-\s*6\s*नंबर)\s*([^\t\n\r\s]+)/i) : null);
    data.prapatraNumber = prapatraMatch ? prapatraMatch[1].trim() : "";

    // 6. QTY, RATE, AMT, FEE, CESS, TOTAL
    const cropRowMatch = voucherText.match(/([^\d\n\r]+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/);
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

// State Machine Background Memory Helpers (centralized communication)
function setTaskState(state) {
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
    const timer = setInterval(async () => {
      const state = await getTaskState();
      
      if (state && state.stage === targetStage) {
        console.log(`eMandi Coordinator: Stage change matched to ${targetStage}! Polling stopped.`);
        clearInterval(timer);
        resolve(state);
      } else if (Date.now() - startTime > timeoutMs) {
        console.error(`eMandi Coordinator: Timeout waiting for stage change to ${targetStage}`);
        clearInterval(timer);
        reject(new Error("पेज लोड या प्रतिक्रिया समय समाप्त (Timeout waiting for tab)"));
      }
    }, 150);
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
  const prapatra = cells[indices.prapatra] ? cells[indices.prapatra].innerText.trim() : "";
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
    const text = el.innerText.trim();
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
      const cols = row.querySelectorAll("td");
      if (cols.length === 2) {
        const key = cols[0].innerText.replace(":", "").trim();
        const val = cols[1].innerText.trim();
        if (key) info[key] = val;
      }
    });
  });

  info.raw_text_summary = doc.body ? doc.body.innerText.replace(/\s+/g, ' ').substring(0, 1000) : "";
  return info;
}

// Parses HTML of payment details page
function parsePaymentDetailsHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  const info = {};
  const cells = doc.querySelectorAll("td, th, span, div, p");
  
  cells.forEach(el => {
    const text = el.innerText.trim();
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
        headers = Array.from(ths).map(th => th.innerText.trim());
      } else {
        const tds = row.querySelectorAll("td");
        if (tds.length > 0) {
          const rowObj = {};
          tds.forEach((td, tdIdx) => {
            const hName = headers[tdIdx] || `Col_${tdIdx}`;
            rowObj[hName] = td.innerText.trim();
          });
          tableData.push(rowObj);
        }
      }
    });
    info[`Table_${tableIdx}`] = tableData;
  });

  info.raw_text_summary = doc.body ? doc.body.innerText.replace(/\s+/g, ' ').substring(0, 1000) : "";
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
    console.log("eMandi Content: Clear records requested by app.");
    chrome.storage.local.set({ emandi_records: [] }, () => {
      console.log("eMandi Content: Storage database cleared successfully.");
      window.dispatchEvent(new CustomEvent("eMandiRecordsCleared", { detail: { success: true } }));
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


