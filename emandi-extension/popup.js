// popup.js - Controls the scraper UI and handles communication with content.js

console.log("eMandi Popup: Script execution started.");

document.addEventListener("DOMContentLoaded", () => {
  console.log("eMandi Popup: DOMContentLoaded triggered. Setting up UI...");
  
  // Restore current database counts and render table
  updateRecordCount();
  renderPreviewTable();
  restoreWorkspaceState(); // Restore state when popup opens

  // Action Buttons
  const btnStart = document.getElementById("btn-start");
  const btnReset = document.getElementById("btn-reset");
  const btnExport = document.getElementById("btn-export");
  const btnClear = document.getElementById("btn-clear");
  const btnPasteF1 = document.getElementById("btn-paste-f1");
  const btnPasteF2 = document.getElementById("btn-paste-f2");
  const btnProcessManual = document.getElementById("btn-process-manual");

  btnStart.addEventListener("click", startExtraction);
  btnReset.addEventListener("click", resetUI);
  btnExport.addEventListener("click", exportDataToCSV);
  btnClear.addEventListener("click", clearStorage);
  btnProcessManual.addEventListener("click", processManualWorkspace);

  // Monitor manual edits to save state
  const txtF1 = document.getElementById("workspace-f1");
  const txtF2 = document.getElementById("workspace-f2");
  const startInput = document.getElementById("prapatra-start");
  const endInput = document.getElementById("prapatra-end");

  txtF1.addEventListener("input", saveWorkspaceState);
  txtF2.addEventListener("input", saveWorkspaceState);
  startInput.addEventListener("input", saveWorkspaceState);
  endInput.addEventListener("input", saveWorkspaceState);

  // Paste Buttons Logic
  btnPasteF1.addEventListener("click", async () => {
    console.log("eMandi Popup: Paste F1 clicked. Reading clipboard...");
    try {
      const text = await navigator.clipboard.readText();
      txtF1.value = text;
      logToConsole("Field 1 में क्लिपबोर्ड से डेटा पेस्ट किया गया।");
      saveWorkspaceState();
    } catch (err) {
      console.error("eMandi Popup: Failed to read clipboard for Field 1:", err);
      logToConsole("[WARN] क्लिपबोर्ड पढ़ने में असमर्थ: " + err.message);
    }
  });

  btnPasteF2.addEventListener("click", async () => {
    console.log("eMandi Popup: Paste F2 clicked. Reading clipboard...");
    try {
      const text = await navigator.clipboard.readText();
      txtF2.value = text;
      logToConsole("Field 2 में क्लिपबोर्ड से डेटा पेस्ट किया गया।");
      saveWorkspaceState();
    } catch (err) {
      console.error("eMandi Popup: Failed to read clipboard for Field 2:", err);
      logToConsole("[WARN] क्लिपबोर्ड पढ़ने में असमर्थ: " + err.message);
    }
  });

  // Listen for progress, logs and real-time pasting from content.js
  chrome.runtime.onMessage.addListener((message) => {
    console.log("eMandi Popup: Received runtime message:", message);
    if (message.action === "log") {
      logToConsole(message.message);
    } else if (message.action === "progress") {
      updateProgress(message.percent, message.status);
    } else if (message.action === "pasteToField") {
      console.log(`eMandi Popup: Real-time pasting to Field ${message.field}. Text size:`, message.text.length);
      if (message.field === 1) {
        txtF1.value = message.text;
        logToConsole("वाउचर डेटा पॉपअप के Field 1 में पेस्ट हुआ।");
      } else if (message.field === 2) {
        txtF2.value = message.text;
        logToConsole("भुगतान विवरण डेटा पॉपअप के Field 2 में पेस्ट हुआ।");
      }
      saveWorkspaceState();
    }
  });

  // Listen to storage changes to update UI in real-time (reactive)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.workspace_f1) {
        console.log("eMandi Popup: Reactive update of Field 1 from storage.");
        txtF1.value = changes.workspace_f1.newValue || "";
      }
      if (changes.workspace_f2) {
        console.log("eMandi Popup: Reactive update of Field 2 from storage.");
        txtF2.value = changes.workspace_f2.newValue || "";
      }
      if (changes.console_logs) {
        const consoleLog = document.getElementById("console-log");
        consoleLog.textContent = changes.console_logs.newValue || "";
        consoleLog.scrollTop = consoleLog.scrollHeight;
      }
      if (changes.progress_percent) {
        document.getElementById("progress-bar").style.width = changes.progress_percent.newValue + "%";
        document.getElementById("progress-percent").innerText = changes.progress_percent.newValue + "%";
      }
      if (changes.progress_status) {
        document.getElementById("progress-status").innerText = changes.progress_status.newValue || "";
      }
    }
  });
});

function logToConsole(message) {
  const consoleLog = document.getElementById("console-log");
  consoleLog.textContent += "\n" + message;
  consoleLog.scrollTop = consoleLog.scrollHeight;
  saveWorkspaceState();
}

function updateProgress(percent, statusText) {
  console.log(`eMandi Popup: Progress update -> ${percent}%: ${statusText}`);
  const bar = document.getElementById("progress-bar");
  const status = document.getElementById("progress-status");
  const percentText = document.getElementById("progress-percent");

  bar.style.width = percent + "%";
  percentText.innerText = percent + "%";
  status.innerText = statusText;
  saveWorkspaceState();
}

// Restore saved UI inputs & log state on popup reload
function restoreWorkspaceState() {
  chrome.storage.local.get([
    "workspace_f1",
    "workspace_f2",
    "console_logs",
    "prapatra_start",
    "prapatra_end",
    "progress_percent",
    "progress_status"
  ], (data) => {
    console.log("eMandi Popup: Restoring saved state:", data);
    
    if (data.workspace_f1) document.getElementById("workspace-f1").value = data.workspace_f1;
    if (data.workspace_f2) document.getElementById("workspace-f2").value = data.workspace_f2;
    if (data.prapatra_start) document.getElementById("prapatra-start").value = data.prapatra_start;
    if (data.prapatra_end) document.getElementById("prapatra-end").value = data.prapatra_end;
    
    if (data.console_logs) {
      document.getElementById("console-log").textContent = data.console_logs;
    }
    
    const percent = data.progress_percent || 0;
    const statusText = data.progress_status || "तैयार है (Ready)";
    
    document.getElementById("progress-bar").style.width = percent + "%";
    document.getElementById("progress-percent").innerText = percent + "%";
    document.getElementById("progress-status").innerText = statusText;
  });
}

// Save inputs & log states to local storage
function saveWorkspaceState() {
  const f1 = document.getElementById("workspace-f1").value;
  const f2 = document.getElementById("workspace-f2").value;
  const logs = document.getElementById("console-log").textContent;
  const start = document.getElementById("prapatra-start").value;
  const end = document.getElementById("prapatra-end").value;
  const percent = parseInt(document.getElementById("progress-percent").innerText) || 0;
  const statusText = document.getElementById("progress-status").innerText;

  chrome.storage.local.set({
    workspace_f1: f1,
    workspace_f2: f2,
    console_logs: logs,
    prapatra_start: start,
    prapatra_end: end,
    progress_percent: percent,
    progress_status: statusText
  });
}

function resetUI() {
  console.log("eMandi Popup: UI Reset triggered.");
  
  // Reset DOM values
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-percent").innerText = "0%";
  document.getElementById("progress-status").innerText = "तैयार है (Ready)";
  document.getElementById("console-log").textContent = "Logs cleared. Ready to search.";
  document.getElementById("workspace-f1").value = "";
  document.getElementById("workspace-f2").value = "";

  // Clear workspace cache in storage
  chrome.storage.local.set({
    workspace_f1: "",
    workspace_f2: "",
    console_logs: "Logs cleared. Ready to search.",
    progress_percent: 0,
    progress_status: "तैयार है (Ready)"
  });
}

async function startExtraction() {
  console.log("eMandi Popup: startExtraction triggered.");
  resetUI();
  logToConsole("कनेक्शन चेक किया जा रहा है...");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("eMandi Popup: Current active tab retrieved:", tab);

  if (!tab || !tab.url.includes("emandi.up.gov.in")) {
    console.warn("eMandi Popup: Active tab is not on emandi.up.gov.in domain. URL:", tab ? tab.url : "none");
    logToConsole("[ERROR] कृपया सुनिश्चित करें कि आप SixRList या generated_6R पेज पर हैं!");
    alert("कृपया पहले eMandi SixRList या generated_6R पोर्टल ओपन करें!");
    return;
  }

  const prapatraStart = document.getElementById("prapatra-start").value.trim();
  const prapatraEnd = document.getElementById("prapatra-end").value.trim();
  console.log("eMandi Popup: Search range:", { prapatraStart, prapatraEnd });

  if (!prapatraStart || !prapatraEnd) {
    console.warn("eMandi Popup: Empty range search inputs.");
    alert("कृपया खोजने के लिए प्रारंभ संख्या और अंतिम संख्या दोनों दर्ज करें!");
    logToConsole("[WARN] रेंज इनपुट खाली है।");
    return;
  }

  const config = {
    prapatraStart,
    prapatraEnd
  };

  logToConsole(`रेंज प्रपत्र-6: ${prapatraStart} से ${prapatraEnd} खोजने का अनुरोध भेजा जा रहा है...`);

  // Send message to scrape
  console.log("eMandi Popup: Pinging content script on tab", tab.id);
  chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      console.log("eMandi Popup: Content script not responding. Injecting content.js manually...");
      logToConsole("कंटेंट स्क्रिप्ट लोड की जा रही है...");
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      }, () => {
        console.log("eMandi Popup: Content script injection finished. Delaying for script load...");
        setTimeout(() => {
          sendMessageToScrape(tab.id, config);
        }, 500);
      });
    } else {
      console.log("eMandi Popup: Content script is alive. Sending scrape request.");
      sendMessageToScrape(tab.id, config);
    }
  });
}

function sendMessageToScrape(tabId, config) {
  console.log("eMandi Popup: sendMessageToScrape invoked. Tab ID:", tabId, "Config:", config);
  document.getElementById("btn-start").disabled = true;

  chrome.tabs.sendMessage(tabId, { action: "scrapeData", config }, async (response) => {
    document.getElementById("btn-start").disabled = false;
    console.log("eMandi Popup: Scrape response received from tab:", response);
    
    if (chrome.runtime.lastError) {
      console.error("eMandi Popup: Scrape message communication failed:", chrome.runtime.lastError);
      logToConsole("[ERROR] संपर्क टूट गया: " + chrome.runtime.lastError.message);
      return;
    }

    if (response && response.success) {
      if (response.count > 0) {
        logToConsole(`[SUCCESS] सफलतापूर्वक ${response.count} रिकॉर्ड्स का डेटा संकलित कर लिया गया है।`);
        
        // Save data to Chrome Storage
        console.log("eMandi Popup: Saving scraped records to storage...");
        await saveScrapedData(response.data);
        updateRecordCount();
        renderPreviewTable();
        
        // Auto Clear workspace inputs and cache since parsing is completed
        console.log("eMandi Popup: Auto-clearing fields and storage cache...");
        document.getElementById("workspace-f1").value = "";
        document.getElementById("workspace-f2").value = "";
        chrome.storage.local.set({
          workspace_f1: "",
          workspace_f2: ""
        });
        logToConsole("[SUCCESS] डेटा स्वचालित रूप से पार्स होकर तालिका में जोड़ दिया गया है और इनपुट फ़ील्ड साफ़ कर दिए गए हैं।");
      } else {
        console.warn("eMandi Popup: No matching rows found on page.");
        logToConsole("[WARN] कोई रिकॉर्ड नहीं मिला जो प्रपत्र संख्या से मेल खाता हो।");
      }
    } else {
      console.error("eMandi Popup: Scrape failed:", response ? response.error : "response is empty");
      logToConsole("[ERROR] स्क्रैपिंग विफल रही: " + (response ? response.error : "Unknown Error"));
    }
  });
}

// Regex Helper to Parse fields from raw text
function parseRawFields(voucherText, paymentText) {
  console.log("eMandi Popup: parseRawFields parser started.");
  const data = {};

  try {
    // 1. DATE (क्रय / नीलामी का दिनांक)
    const dateMatch = voucherText.match(/(?:क्रय\s*[\/\s]*\s*नीलामी\s*का\s*दिनांक|Date of Sale)\s*([^\t\n\r]+)/);
    data.date = dateMatch ? dateMatch[1].trim().replace(/\//g, "-") : "";

    // 2. FARMER DETAILS
    const sellerMatch = voucherText.match(/(?:विक्रेता\s*किसान\s*का\s*नाम|Name of Seller)\s*([^\t\n\r]+)/);
    const fatherMatch = voucherText.match(/(?:पिता\s*का\s*नाम|Father's Name)\s*([^\t\n\r]+)/);
    const villageMatch = voucherText.match(/(?:गाँव\s*का\s*नाम|Village Name)\s*([^\t\n\r]+)/);
    
    const sellerName = sellerMatch ? sellerMatch[1].trim() : "";
    const fatherName = fatherMatch ? fatherMatch[1].trim() : "";
    const villageName = villageMatch ? villageMatch[1].trim() : "";
    data.farmerDetails = `${sellerName}, S/O: ${fatherName}, ${villageName}`;

    // 3. MOBILE (मोबाइल नंबर)
    const mobileMatch = voucherText.match(/(?:मोबाइल\s*नंबर|Mobile Number)\s*([^\t\n\r]+)/);
    data.mobile = mobileMatch ? mobileMatch[1].trim() : "";

    // 4. KHASRA (खसरा नंबर)
    const khasraMatch = voucherText.match(/(?:खसरा\s*नंबर\s*जिस\s*पर\s*उत्त्पादन\s*किया\s*गया\s*है|खसरा\s*नंबर|Khasra Number)\s*([^\t\n\r]+)/);
    data.khasra = khasraMatch ? khasraMatch[1].trim() : "";

    // 5. 6R NO (क्रम संख्या)
    const prapatraMatch = voucherText.match(/(?:क्रम\s*संख्या|Serial No)\s*([^\t\n\r]+)/) || paymentText.match(/(?:प्रपत्र\s*-\s*6\s*नंबर)\s*([^\t\n\r]+)/);
    data.prapatraNumber = prapatraMatch ? prapatraMatch[1].trim() : "";

    // 6. QTY, RATE, AMT, FEE, CESS, TOTAL
    const cropRowMatch = voucherText.match(/([^\d\s\t\n\r]{2,10})\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/);
    if (cropRowMatch) {
      data.qty = parseFloat(cropRowMatch[2]).toFixed(2);
      data.rate = Math.round(parseFloat(cropRowMatch[3]));
      data.amt = Math.round(parseFloat(cropRowMatch[4]));
      data.fee = Math.round(parseFloat(cropRowMatch[6]));
      data.cess = Math.round(parseFloat(cropRowMatch[7]));
      data.total = Math.round(parseFloat(cropRowMatch[8]));
    } else {
      data.qty = "";
      data.rate = "";
      data.amt = "";
      data.fee = "";
      data.cess = "";
      data.total = "";
    }

    // 7. PAY DATE (भुगतान का दिनांक)
    const payDateMatch = paymentText.match(/(?:भुगतान\s*का\s*दिनांक|Date of Payment)\s*([^\t\n\r\s]+)/);
    data.payDate = payDateMatch ? payDateMatch[1].trim().split(" ")[0].replace(/\//g, "-") : "";

    // 8. ACC NO (किसान का बैंक खाता संख्या)
    const accMatch = paymentText.match(/(?:किसान\s*का\s*बैंक\s*खाता\s*संख्या|Account Number)\s*([^\t\n\r]+)/);
    data.accNo = accMatch ? accMatch[1].trim() : "";

    // 9. IFSC (बैंक खाते का IFSC कोड)
    const ifscMatch = paymentText.match(/(?:IFSC\s*कोड|IFSC Code)\s*([^\t\n\r]+)/);
    data.ifsc = ifscMatch ? ifscMatch[1].trim() : "";

    // 10. UTR (ट्रांसक्शन नंबर)
    const utrMatch = paymentText.match(/(?:ट्रांसक्शन\s*नंबर|Transaction Number|UTR Number|UTR No)\s*([^\t\n\r]+)/);
    data.utr = utrMatch ? utrMatch[1].trim() : "";

    console.log("eMandi Popup: parseRawFields output:", data);
  } catch (err) {
    console.error("eMandi Popup: parseRawFields error:", err);
  }

  return data;
}

// Action for manual process button
async function processManualWorkspace() {
  console.log("eMandi Popup: processManualWorkspace triggered.");
  const voucherText = document.getElementById("workspace-f1").value.trim();
  const paymentText = document.getElementById("workspace-f2").value.trim();

  if (!voucherText && !paymentText) {
    console.warn("eMandi Popup: Manual process clicked but both fields are empty.");
    alert("कृपया पहले Field 1 या Field 2 में डेटा पेस्ट करें!");
    return;
  }

  logToConsole("डेटा पार्स (Parse) किया जा रहा है...");
  const parsedRecord = parseRawFields(voucherText, paymentText);

  if (!parsedRecord.prapatraNumber) {
    console.error("eMandi Popup: Manual parse failed to retrieve prapatraNumber.");
    alert("त्रुटि: प्रपत्र-6 नंबर पार्स करने में विफल! कृपया पेस्ट किए गए डेटा की जाँच करें।");
    logToConsole("[ERROR] प्रपत्र संख्या नहीं मिली।");
    return;
  }

  const newRecord = {
    scrapedAt: new Date().toLocaleString(),
    date: parsedRecord.date,
    prapatraNumber: parsedRecord.prapatraNumber,
    seller: parsedRecord.farmerDetails.split(",")[0],
    buyer: "",
    crop: "",
    weight: parsedRecord.qty,
    rate: parsedRecord.rate,
    paymentStatus: "पार्स किया गया",
    printDetails: {
      rawText: voucherText,
      "किसान का नाम": parsedRecord.farmerDetails.split(",")[0],
      "तौल": parsedRecord.qty,
      "दर": parsedRecord.rate,
      "कुल मूल्य": parsedRecord.amt,
      "मंडी शुल्क": parsedRecord.fee,
      "विकास सेस": parsedRecord.cess,
      "शुद्ध भुगतान": parsedRecord.amt
    },
    paymentDetails: {
      rawText: paymentText,
      "बैंक का नाम": "",
      "खाता संख्या": parsedRecord.accNo,
      "आईएफएससी": parsedRecord.ifsc,
      "यूटीआर नंबर": parsedRecord.utr,
      "यूटीआर दिनांक": parsedRecord.payDate,
      "भुगतान राशि": parsedRecord.amt
    },
    tableCache: parsedRecord
  };

  console.log("eMandi Popup: Saving manually parsed record:", newRecord);
  await saveScrapedData([newRecord]);
  updateRecordCount();
  renderPreviewTable();

  // Clear workspace fields and cache
  document.getElementById("workspace-f1").value = "";
  document.getElementById("workspace-f2").value = "";
  saveWorkspaceState();

  logToConsole(`[SUCCESS] सफलतापूर्वक प्रपत्र ${parsedRecord.prapatraNumber} का डेटा पार्स कर टेबल में जोड़ा गया।`);
}

// Render dynamic preview table rows
function renderPreviewTable() {
  console.log("eMandi Popup: renderPreviewTable rendering rows...");
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const data = result.emandi_records;
    console.log("eMandi Popup: Rendering database size:", data.length);
    const tbody = document.getElementById("preview-table-body");
    tbody.innerHTML = "";

    data.forEach((row, index) => {
      const tc = row.tableCache || parseRawFields(row.printDetails?.rawText || "", row.paymentDetails?.rawText || "");
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${tc.date || row.date || ""}</td>
        <td>${tc.farmerDetails || row.seller || ""}</td>
        <td>${tc.mobile || ""}</td>
        <td>${tc.khasra || ""}</td>
        <td>${tc.prapatraNumber || row.prapatraNumber || ""}</td>
        <td><b>${tc.qty || row.weight || ""}</b></td>
        <td><b>${tc.rate || row.rate || ""}</b></td>
        <td><b>${tc.amt || ""}</b></td>
        <td>${tc.fee || ""}</td>
        <td>${tc.cess || ""}</td>
        <td><b>${tc.total || ""}</b></td>
        <td>${tc.payDate || ""}</td>
        <td>${tc.accNo || ""}</td>
        <td>${tc.ifsc || ""}</td>
        <td>${tc.utr || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

async function saveScrapedData(newData) {
  console.log("eMandi Popup: saveScrapedData triggered. Records:", newData);
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
        console.log("eMandi Popup: Records set in storage completed.");
        resolve();
      });
    });
  });
}

function updateRecordCount() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    console.log("eMandi Popup: Total records in database is", result.emandi_records.length);
    document.getElementById("record-count").innerText = result.emandi_records.length;
  });
}

function clearStorage() {
  console.log("eMandi Popup: clearStorage triggered.");
  if (confirm("क्या आप सुरक्षित किया हुआ सारा डेटा डिलीट करना चाहते हैं?")) {
    chrome.storage.local.set({ emandi_records: [] }, () => {
      updateRecordCount();
      renderPreviewTable();
      resetUI();
      logToConsole("स्टोरेज खाली कर दी गई है।");
    });
  }
}

// Convert JSON to CSV and trigger download
function exportDataToCSV() {
  console.log("eMandi Popup: exportDataToCSV triggered.");
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const data = result.emandi_records;
    if (data.length === 0) {
      console.warn("eMandi Popup: Export requested but database is empty.");
      alert("कोई डेटा सुरक्षित नहीं है!");
      return;
    }

    const headers = [
      "SR", "DATE", "FARMER DETAILS", "MOBILE", "KHASRA", "6R NO", "QTY", "RATE", "AMT", "FEE", "CESS", "TOTAL", "PAY DATE", "ACC NO", "IFSC", "UTR"
    ];

    let csvContent = "\ufeff" + headers.join(",") + "\n";

    data.forEach((row, index) => {
      const tc = row.tableCache || parseRawFields(row.printDetails?.rawText || "", row.paymentDetails?.rawText || "");
      
      const rowValues = [
        index + 1,
        escapeCSV(tc.date),
        escapeCSV(tc.farmerDetails),
        escapeCSV(tc.mobile),
        escapeCSV(tc.khasra),
        escapeCSV(tc.prapatraNumber),
        escapeCSV(tc.qty),
        escapeCSV(tc.rate),
        escapeCSV(tc.amt),
        escapeCSV(tc.fee),
        escapeCSV(tc.cess),
        escapeCSV(tc.total),
        escapeCSV(tc.payDate),
        escapeCSV(tc.accNo),
        escapeCSV(tc.ifsc),
        escapeCSV(tc.utr)
      ];

      csvContent += rowValues.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `emandi_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("eMandi Popup: CSV downloaded successfully.");
  });
}

function escapeCSV(val) {
  if (val === undefined || val === null) return '""';
  let str = String(val).replace(/"/g, '""');
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str}"`;
  }
  return str;
}
