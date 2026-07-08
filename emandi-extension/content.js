// content.js - Scrapes and fetches eMandi UP data by physically clicking and scraping pages

console.log("eMandi Content Script: script execution started.");

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

// --- Localhost App Integration ---
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  console.log("eMandi Content: Running on localhost app. Registering sync event listeners...");

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
    console.log("eMandi Content: Sync requested by localhost app. Reading storage...");
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
    console.log("eMandi Content: Clear records requested by localhost app.");
    chrome.storage.local.set({ emandi_records: [] }, () => {
      console.log("eMandi Content: Storage database cleared successfully.");
      window.dispatchEvent(new CustomEvent("eMandiRecordsCleared", { detail: { success: true } }));
    });
  });
}
