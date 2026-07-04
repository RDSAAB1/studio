// content.js - Scrapes and fetches eMandi UP data by physically clicking and scraping pages

// Run automatically on page load to handle popup windows
handleChildPages();

// Listen for messages from the popup (Only relevant on the coordinator page)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ status: "ready" });
    return true;
  }

  if (message.action === "scrapeData") {
    const { prapatraSearch } = message.config;
    startRowByRowScraping(prapatraSearch)
      .then(result => {
        sendResponse({ success: true, count: result.length, data: result });
      })
      .catch(error => {
        console.error("Scraping error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Helper for logger
function sendLog(message, type = "info") {
  console.log(`[eMandi] ${type.toUpperCase()}: ${message}`);
  chrome.runtime.sendMessage({
    action: "log",
    message: `[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`
  });
}

// Check if we are in one of the popped-up print pages
function handleChildPages() {
  const url = window.location.href;
  
  if (url.includes("/Receipt/print_6R_processing")) {
    chrome.storage.local.get("active_scrape_task", (data) => {
      const task = data.active_scrape_task;
      if (task && task.stage === "print") {
        console.log("eMandi: Scraping print page...");
        const printData = parsePrintSlipHtml(document.body.innerHTML);
        
        task.current_record.printDetails = printData;
        task.stage = "print_done";
        
        chrome.storage.local.set({ active_scrape_task: task }, () => {
          console.log("eMandi: Print page done. Closing window.");
          window.close();
        });
      }
    });
  }
}

// Main Coordinator Logic
async function startRowByRowScraping(prapatraSearch) {
  sendLog(`खोज शुरू: प्रपत्र नंबर "${prapatraSearch}"...`, "info");

  const table = findSixRTable();
  if (!table) {
    throw new Error("6R तालिका नहीं मिली! कृपया सुनिश्चित करें कि आप 6RList पेज पर हैं।");
  }

  const rows = Array.from(table.querySelectorAll("tbody tr"));
  
  // Find matching rows (checking if the column contains the string we searched)
  const matchedRows = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowData = parseRowBasicInfo(row, i);
    if (!rowData) continue;

    // Direct substring or inclusion check
    if (rowData.prapatraNumber.toLowerCase().includes(prapatraSearch.toLowerCase())) {
      matchedRows.push({ row, info: rowData, rowIndex: i });
    }
  }

  if (matchedRows.length === 0) {
    sendLog(`कोई प्रपत्र नंबर "${prapatraSearch}" से मेल खाता हुआ नहीं मिला।`, "warn");
    return [];
  }

  sendLog(`समान प्रपत्र संख्या वाले ${matchedRows.length} रिकॉर्ड मिले।`, "info");
  
  const results = [];
  
  for (let idx = 0; idx < matchedRows.length; idx++) {
    const item = matchedRows[idx];
    const progress = Math.round(((idx + 1) / matchedRows.length) * 100);
    
    // Notify progress
    chrome.runtime.sendMessage({
      action: "progress",
      percent: progress,
      status: `प्रोसेसिंग: ${idx + 1}/${matchedRows.length} (${item.info.prapatraNumber})`
    });

    try {
      sendLog(`प्रोसेसिंग रिकॉर्ड ${idx + 1}/${matchedRows.length}: प्रपत्र ${item.info.prapatraNumber}`, "process");
      
      const cells = item.row.querySelectorAll("td");
      const lastCell = cells[cells.length - 1];
      if (!lastCell) {
        throw new Error("Action column missing");
      }

      const buttons = lastCell.querySelectorAll("a, button");
      let printBtn = null;

      buttons.forEach(btn => {
        const href = btn.getAttribute("href") || "";
        const onclick = btn.getAttribute("onclick") || "";
        const text = btn.innerText || "";
        
        if (href.includes("print_6R") || onclick.includes("print_6R") || btn.classList.contains("btn-warning") || text.includes("प्रिंट")) {
          printBtn = btn;
        }
      });

      const basicRecord = {
        scrapedAt: new Date().toLocaleString(),
        ...item.info
      };

      // Click Print Button ONLY
      if (printBtn) {
        sendLog(`  -> प्रिंट बटन पर क्लिक किया जा रहा है...`, "click");
        
        // Setup task state in storage
        await setTaskState({
          stage: "print",
          current_record: basicRecord
        });

        // Trigger Click
        printBtn.click();

        // Wait for page to open, scrape, update state to print_done, and close
        const updatedTask = await waitForStageChange("print_done", 15000);
        basicRecord.printDetails = updatedTask.current_record.printDetails;
        
        results.push(basicRecord);
        sendLog(`सफलतापूर्वक प्रपत्र ${item.info.prapatraNumber} संकलित हुआ।`, "success");
      } else {
        sendLog(`  -> प्रिंट बटन नहीं मिला!`, "warn");
      }

      // Short delay between rows
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err) {
      sendLog(`त्रुटि (Error) प्रपत्र ${item.info.prapatraNumber} में: ${err.message}`, "error");
    }
  }

  // Clear task when done
  await chrome.storage.local.remove("active_scrape_task");
  
  sendLog(`सारे कार्य पूर्ण!`, "success");
  return results;
}

// State Machine Storage Helpers
function setTaskState(state) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ active_scrape_task: state }, resolve);
  });
}

function getTaskState() {
  return new Promise((resolve) => {
    chrome.storage.local.get("active_scrape_task", (data) => {
      resolve(data.active_scrape_task);
    });
  });
}

// Poll storage waiting for the popped-up window to finish scraping and close
async function waitForStageChange(targetStage, timeoutMs = 15000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      const state = await getTaskState();
      
      if (state && state.stage === targetStage) {
        clearInterval(timer);
        resolve(state);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(timer);
        reject(new Error("पेज लोड या प्रतिक्रिया समय समाप्त (Timeout waiting for tab)"));
      }
    }, 400);
  });
}

function findSixRTable() {
  const tables = document.querySelectorAll("table");
  for (const t of tables) {
    if (t.innerText.includes("प्रपत्र-6") || t.innerText.includes("विक्रेता किसान")) {
      return t;
    }
  }
  return null;
}

function parseRowBasicInfo(row, index) {
  const cells = row.querySelectorAll("td");
  if (cells.length < 5) return null;

  const dateStr = cells[1] ? cells[1].innerText.trim() : "";
  const prapatra = cells[2] ? cells[2].innerText.trim() : "";
  const seller = cells[3] ? cells[3].innerText.trim() : "";
  const buyer = cells[4] ? cells[4].innerText.trim() : "";
  const crop = cells[5] ? cells[5].innerText.trim() : "";
  const weight = cells[6] ? cells[6].innerText.trim() : "";
  const rate = cells[7] ? cells[7].innerText.trim() : "";
  const paymentStatus = cells[9] ? cells[9].innerText.trim() : "";

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
