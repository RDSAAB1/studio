// dashboard.js - Controls the full-screen scraper dashboard UI

document.addEventListener("DOMContentLoaded", () => {
  console.log("eMandi Dashboard: DOMContentLoaded triggered. Setting up UI...");
  console.log("Diagnostic - window.pdfjsLib:", typeof window.pdfjsLib, "window.pdfjs:", typeof window.pdfjs);
  
  // Navigation Tabs Toggling
  const navItems = document.querySelectorAll(".nav-item");
  const panels = document.querySelectorAll(".dashboard-panel");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tabName = item.getAttribute("data-tab");
      
      navItems.forEach(nav => nav.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      
      item.classList.add("active");
      const targetPanel = document.getElementById(`panel-${tabName}`);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    });
  });

  // Action Buttons
  const btnStart = document.getElementById("btn-start");
  const btnReset = document.getElementById("btn-reset");
  const btnExport = document.getElementById("btn-export");
  const btnClear = document.getElementById("btn-clear");
  const btnPasteF1 = document.getElementById("btn-paste-f1");
  const btnPasteF2 = document.getElementById("btn-paste-f2");
  const btnProcessManual = document.getElementById("btn-process-manual");
  const btnClearWorkspace = document.getElementById("btn-clear-workspace");
  const btnClearConsoleLogs = document.getElementById("btn-clear-console-logs");
  const btnViewAllTable = document.getElementById("btn-view-all-table");
  const searchDbInput = document.getElementById("search-db-input");

  btnStart.addEventListener("click", startExtraction);
  btnReset.addEventListener("click", resetScraperRange);
  btnExport.addEventListener("click", exportDataToCSV);
  btnClear.addEventListener("click", clearStorage);
  btnProcessManual.addEventListener("click", processManualWorkspace);
  
  if (btnClearWorkspace) {
    btnClearWorkspace.addEventListener("click", () => {
      document.getElementById("workspace-f1").value = "";
      document.getElementById("workspace-f2").value = "";
      saveWorkspaceState();
    });
  }

  if (btnClearConsoleLogs) {
    btnClearConsoleLogs.addEventListener("click", () => {
      document.getElementById("console-log").textContent = "Logs cleared. Ready.";
      chrome.storage.local.set({ console_logs: "Logs cleared. Ready." });
    });
  }

  if (btnViewAllTable) {
    btnViewAllTable.addEventListener("click", () => {
      const dbNav = document.querySelector(".nav-item[data-tab='database']");
      if (dbNav) dbNav.click();
    });
  }

  const btnParseStatement = document.getElementById("btn-parse-statement");
  if (btnParseStatement) {
    btnParseStatement.addEventListener("click", parseStatementLogs);
  }

  const btnClearStatementInput = document.getElementById("btn-clear-statement-input");
  if (btnClearStatementInput) {
    btnClearStatementInput.addEventListener("click", () => {
      const t = document.getElementById("statement-input-textarea");
      if (t) t.value = "";
      chrome.storage.local.set({ statement_records: [] }, () => {
        renderStatementTable();
      });
    });
  }

  if (searchDbInput) {
    searchDbInput.addEventListener("input", renderPreviewTable);
  }

  const searchBanksInput = document.getElementById("search-banks-input");
  if (searchBanksInput) {
    searchBanksInput.addEventListener("input", renderBanksTable);
  }

  const clearBankBtn = document.getElementById("clear-bank-data-btn");
  if (clearBankBtn) {
    clearBankBtn.addEventListener("click", clearAllBankData);
  }

  // Restore current database counts and render table
  updateRecordStats();
  renderPreviewTable();
  renderBanksTable();
  renderStatementTable();
  restoreWorkspaceState(); // Restore state when dashboard opens

  // Input listeners to save state automatically
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
    try {
      const text = await navigator.clipboard.readText();
      txtF1.value = text;
      logToConsole("Field 1 (मंडी वाउचर) में क्लिपबोर्ड से डेटा पेस्ट किया गया।");
      saveWorkspaceState();
    } catch (err) {
      logToConsole("[WARN] क्लिपबोर्ड पढ़ने में असमर्थ: " + err.message);
    }
  });

  btnPasteF2.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      txtF2.value = text;
      logToConsole("Field 2 (भुगतान विवरण) में क्लिपबोर्ड से डेटा पेस्ट किया गया।");
      saveWorkspaceState();
    } catch (err) {
      logToConsole("[WARN] क्लिपबोर्ड पढ़ने में असमर्थ: " + err.message);
    }
  });

  // Listen for progress, logs and real-time pasting from content.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "log") {
      logToConsole(message.message);
    } else if (message.action === "progress") {
      updateProgress(message.percent, message.status);
    } else if (message.action === "pasteToField") {
      if (message.field === 1) {
        txtF1.value = message.text;
        logToConsole("वाउचर डेटा स्वचालित रूप से Field 1 में पेस्ट हुआ।");
      } else if (message.field === 2) {
        txtF2.value = message.text;
        logToConsole("भुगतान विवरण डेटा स्वचालित रूप से Field 2 में पेस्ट हुआ।");
      }
      saveWorkspaceState();
    }
  });

  // Listen to storage changes to update UI in real-time (reactive)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.workspace_f1) {
        txtF1.value = changes.workspace_f1.newValue || "";
      }
      if (changes.workspace_f2) {
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
      if (changes.emandi_records) {
        updateRecordStats();
        renderPreviewTable();
      }
      if (changes.supplier_bank_accounts) {
        renderBanksTable();
      }
    }
  });

  // Mode Toggle for Statement Parser
  const modeTextBtn = document.getElementById("stmt-mode-text");
  const modeFileBtn = document.getElementById("stmt-mode-file");
  const textModeArea = document.getElementById("stmt-text-mode-area");
  const fileModeArea = document.getElementById("stmt-file-mode-area");

  if (modeTextBtn && modeFileBtn && textModeArea && fileModeArea) {
    modeTextBtn.addEventListener("click", () => {
      modeTextBtn.className = "btn btn-primary";
      modeFileBtn.className = "btn btn-secondary";
      textModeArea.style.display = "block";
      fileModeArea.style.display = "none";
    });
    modeFileBtn.addEventListener("click", () => {
      modeTextBtn.className = "btn btn-secondary";
      modeFileBtn.className = "btn btn-primary";
      textModeArea.style.display = "none";
      fileModeArea.style.display = "block";
    });
  }

  // Excel Upload Drag & Drop & Browse Wiring
  const dropZone = document.getElementById("excel-drop-zone");
  const fileInput = document.getElementById("excel-file-input");
  
  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());
    
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#38bdf8";
      dropZone.style.background = "rgba(56, 189, 248, 0.05)";
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "#475569";
      dropZone.style.background = "rgba(15,23,42,0.5)";
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#475569";
      dropZone.style.background = "rgba(15,23,42,0.5)";
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleSelectedExcelFile(files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleSelectedExcelFile(e.target.files[0]);
      }
    });
  }

  const btnClearExcel = document.getElementById("btn-clear-excel-file");
  if (btnClearExcel) {
    btnClearExcel.addEventListener("click", clearExcelFileSelection);
  }

  const btnParseExcel = document.getElementById("btn-parse-excel");
  if (btnParseExcel) {
    btnParseExcel.addEventListener("click", () => {
      if (currentExcelFile && currentExcelFile.name.toLowerCase().endsWith(".pdf")) {
        parseUploadedPDF();
      } else {
        parseUploadedExcel();
      }
    });
  }
});


function logToConsole(message) {
  const consoleLog = document.getElementById("console-log");
  consoleLog.textContent += "\n" + message;
  consoleLog.scrollTop = consoleLog.scrollHeight;
  saveWorkspaceState();
}

function cleanNum(val) {
  if (val === undefined || val === null) return 0;
  const cleaned = String(val).replace(/,/g, "").replace(/[₹\s]/g, "");
  return parseFloat(cleaned) || 0;
}

function updateProgress(percent, statusText) {
  const bar = document.getElementById("progress-bar");
  const status = document.getElementById("progress-status");
  const percentText = document.getElementById("progress-percent");

  bar.style.width = percent + "%";
  percentText.innerText = percent + "%";
  status.innerText = statusText;
  saveWorkspaceState();
}

// Restore saved UI inputs & log state on dashboard reload
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
    if (data.workspace_f1) document.getElementById("workspace-f1").value = data.workspace_f1;
    if (data.workspace_f2) document.getElementById("workspace-f2").value = data.workspace_f2;
    if (data.prapatra_start) document.getElementById("prapatra-start").value = data.prapatra_start;
    if (data.prapatra_end) document.getElementById("prapatra-end").value = data.prapatra_end;
    
    if (data.console_logs) {
      document.getElementById("console-log").textContent = data.console_logs;
    }
    
    const percent = data.progress_percent || 0;
    const statusText = data.progress_status || "तैयार है (System Ready)";
    
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

function resetScraperRange() {
  document.getElementById("prapatra-start").value = "";
  document.getElementById("prapatra-end").value = "";
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-percent").innerText = "0%";
  document.getElementById("progress-status").innerText = "तैयार है (Ready)";
  saveWorkspaceState();
}

async function startExtraction() {
  logToConsole("कनेक्शन चेक किया जा रहा है...");
  
  // Set this dashboard tab as the active focus tab in background script
  chrome.runtime.sendMessage({ action: "setDashboardActive" }, (res) => {
    if (chrome.runtime.lastError) {
      console.warn("eMandi Dashboard: setDashboardActive message failed:", chrome.runtime.lastError);
    } else {
      console.log("eMandi Dashboard: setDashboardActive sent successfully:", res);
    }
  });
  
  const emandiTabs = await chrome.tabs.query({ url: "*://emandi.up.gov.in/*" });
  if (emandiTabs.length === 0) {
    alert("कृपया पहले eMandi portal (emandi.up.gov.in) को ब्राउज़र में किसी टैब पर खोलें!");
    logToConsole("[ERROR] eMandi पोर्टल का कोई सक्रिय टैब नहीं मिला।");
    return;
  }
  
  // Choose the active or first matching tab
  const tab = emandiTabs.find(t => t.active) || emandiTabs[0];
  console.log("eMandi Dashboard: Selected tab for scraping:", tab);

  const prapatraStart = document.getElementById("prapatra-start").value.trim();
  const prapatraEnd = document.getElementById("prapatra-end").value.trim();

  if (!prapatraStart || !prapatraEnd) {
    alert("कृपया खोजने के लिए प्रारंभ संख्या और अंतिम संख्या दोनों दर्ज करें!");
    logToConsole("[WARN] रेंज इनपुट खाली है।");
    return;
  }

  const config = {
    prapatraStart,
    prapatraEnd
  };

  logToConsole(`रेंज प्रपत्र-6: ${prapatraStart} से ${prapatraEnd} खोजने का अनुरोध भेजा जा रहा है...`);
  document.getElementById("btn-start").disabled = true;

  // Send message to scrape
  console.log("eMandi Dashboard: Pinging content script on tab", tab.id);
  chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      console.log("eMandi Dashboard: Content script not responding. Injecting inject.js (MAIN) and content.js manually...");
      logToConsole("कंटेंट स्क्रिप्ट लोड की जा रही है...");
      
      // First, inject inject.js in the MAIN world to hook window.open
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["inject.js"],
        world: "MAIN"
      }, () => {
        // Then, inject content.js in the ISOLATED world (top frame only)
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false },
          files: ["content.js"]
        }, () => {
          console.log("eMandi Dashboard: Both scripts injected. Delaying for script load...");
          setTimeout(() => {
            sendMessageToScrape(tab.id, config);
          }, 500);
        });
      });
    } else {
      console.log("eMandi Dashboard: Content script is alive. Sending scrape request.");
      sendMessageToScrape(tab.id, config);
    }
  });
}

function sendMessageToScrape(tabId, config) {
  console.log("eMandi Dashboard: sendMessageToScrape invoked. Tab ID:", tabId, "Config:", config);
  chrome.tabs.sendMessage(tabId, { action: "scrapeData", config }, async (response) => {
    document.getElementById("btn-start").disabled = false;
    console.log("eMandi Dashboard: Scrape response received from tab:", response);
    
    if (chrome.runtime.lastError) {
      console.error("eMandi Dashboard: Scrape message communication failed:", chrome.runtime.lastError);
      logToConsole("[ERROR] संपर्क टूट गया: " + chrome.runtime.lastError.message);
      return;
    }

    if (response && response.success) {
      if (response.count > 0) {
        logToConsole(`[SUCCESS] सफलतापूर्वक ${response.count} रिकॉर्ड्स का डेटा संकलित कर लिया गया है।`);
        await saveScrapedData(response.data);
        
        // Auto Clear workspace inputs and cache since parsing is completed
        console.log("eMandi Dashboard: Auto-clearing fields and storage cache...");
        document.getElementById("workspace-f1").value = "";
        document.getElementById("workspace-f2").value = "";
        chrome.storage.local.set({
          workspace_f1: "",
          workspace_f2: ""
        });
      } else {
        console.warn("eMandi Dashboard: No matching rows found on page.");
        logToConsole("[WARN] कोई रिकॉर्ड नहीं मिला जो प्रपत्र संख्या से मेल खाता हो।");
      }
    } else {
      console.error("eMandi Dashboard: Scrape failed:", response ? response.error : "response is empty");
      logToConsole("[ERROR] स्क्रैपिंग विफल रही: " + (response ? response.error : "Unknown Error"));
    }
  });
}

// Regex Helper to Parse fields from raw text
function parseRawFields(voucherText, paymentText) {
  const data = {};
  if (!voucherText) return data;

  try {
    // 1. DATE
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
    const cropRowMatch = voucherText.match(/([^\d\n\r]+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/);
    if (cropRowMatch) {
      const cleanNum = (val) => parseFloat(String(val).replace(/,/g, "")) || 0;
      data.qty = cleanNum(cropRowMatch[2]).toFixed(2);
      data.rate = Math.round(cleanNum(cropRowMatch[3]));
      data.amt = Math.round(cleanNum(cropRowMatch[4]));
      data.fee = Math.round(cleanNum(cropRowMatch[6]));
      data.cess = Math.round(cleanNum(cropRowMatch[7]));
      data.total = Math.round(cleanNum(cropRowMatch[8]));
    } else {
      data.qty = ""; data.rate = ""; data.amt = ""; data.fee = ""; data.cess = ""; data.total = "";
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
    console.error("eMandi Dashboard Parser: parsing error:", err);
  }

  return data;
}

// Action for manual process button
async function processManualWorkspace() {
  const voucherText = document.getElementById("workspace-f1").value.trim();
  const paymentText = document.getElementById("workspace-f2").value.trim();

  if (!voucherText && !paymentText) {
    alert("कृपया पहले वाउचर या भुगतान विवरण फ़ील्ड में डेटा पेस्ट करें!");
    return;
  }

  logToConsole("मैनुअल डेटा पार्स किया जा रहा है...");
  const parsedRecord = parseRawFields(voucherText, paymentText);

  if (!parsedRecord.prapatraNumber) {
    alert("त्रुटि: प्रपत्र-6 नंबर पार्स करने में विफल! कृपया पेस्ट किए गए डेटा की जाँच करें।");
    logToConsole("[ERROR] प्रपत्र संख्या (6R No) नहीं मिली।");
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
    paymentStatus: "मैनुअल पार्स",
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

  await saveScrapedData([newRecord]);
  
  // Clear fields
  document.getElementById("workspace-f1").value = "";
  document.getElementById("workspace-f2").value = "";
  saveWorkspaceState();

  logToConsole(`[SUCCESS] सफलतापूर्वक प्रपत्र ${parsedRecord.prapatraNumber} का डेटा पार्स कर टेबल में जोड़ा गया।`);
  
  // Notify user and switch to DB tab
  const dbNav = document.querySelector(".nav-item[data-tab='database']");
  if (dbNav) dbNav.click();
}

// Render dynamic table rows with searching and formatting
function renderPreviewTable() {
  const searchQuery = document.getElementById("search-db-input").value.trim().toLowerCase();

  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const data = result.emandi_records;
    
    // Sort records newest first
    const sortedData = [...data].sort((a, b) => {
      const aNo = parseInt(a.prapatraNumber) || 0;
      const bNo = parseInt(b.prapatraNumber) || 0;
      return bNo - aNo;
    });

    const filteredData = sortedData.filter(row => {
      const tc = parseRawFields(row.printDetails?.rawText || "", row.paymentDetails?.rawText || "");
      const nameMatch = (tc.farmerDetails || "").toLowerCase().includes(searchQuery);
      const noMatch = (tc.prapatraNumber || "").toLowerCase().includes(searchQuery);
      return nameMatch || noMatch;
    });

    // Render Database Tab Full Table
    const tbody = document.getElementById("preview-table-body");
    tbody.innerHTML = "";

    if (filteredData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="17" style="text-align: center; padding: 24px; color: var(--text-dark);">कोई मिलान रिकॉर्ड नहीं मिला (No records found).</td></tr>`;
    }

    filteredData.forEach((row, index) => {
      const tc = parseRawFields(row.printDetails?.rawText || "", row.paymentDetails?.rawText || "");
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${tc.date || row.date || ""}</td>
        <td class="farmer-col" title="${tc.farmerDetails || row.seller || ""}">${tc.farmerDetails || row.seller || ""}</td>
        <td>${tc.mobile || ""}</td>
        <td>${tc.khasra || ""}</td>
        <td><span class="badge badge-success">${tc.prapatraNumber || row.prapatraNumber || ""}</span></td>
        <td><b>${tc.qty || row.weight || ""}</b></td>
        <td>₹${tc.rate || row.rate || ""}</td>
        <td>₹${tc.amt ? tc.amt.toLocaleString("en-IN") : ""}</td>
        <td>₹${tc.fee || ""}</td>
        <td>₹${tc.cess || ""}</td>
        <td><b>₹${tc.total ? tc.total.toLocaleString("en-IN") : ""}</b></td>
        <td>${tc.payDate || ""}</td>
        <td>${tc.accNo || ""}</td>
        <td>${tc.ifsc || ""}</td>
        <td>${tc.utr || ""}</td>
        <td style="text-align: center;">
          <button class="btn-delete-row" data-id="${row.prapatraNumber}" title="डिलीट करें">
            <svg class="svg-icon" viewBox="0 0 24 24" width="14" height="14" style="fill: none; stroke: currentColor;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Add click listeners to delete buttons
    document.querySelectorAll(".btn-delete-row").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const rowId = btn.getAttribute("data-id");
        deleteRecord(rowId);
      });
    });

    // Render Dashboard Tab Overview Table (Last 5 records)
    const dashboardTbody = document.getElementById("dashboard-recent-tbody");
    dashboardTbody.innerHTML = "";
    
    const recentRecords = sortedData.slice(0, 5);
    if (recentRecords.length === 0) {
      dashboardTbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 16px; color: var(--text-dark);">कोई रिकॉर्ड उपलब्ध नहीं है।</td></tr>`;
    }

    recentRecords.forEach((row, index) => {
      const tc = parseRawFields(row.printDetails?.rawText || "", row.paymentDetails?.rawText || "");
      const totalFees = cleanNum(tc.fee) + cleanNum(tc.cess);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${tc.date || row.date || ""}</td>
        <td class="farmer-col" title="${tc.farmerDetails || row.seller || ""}">${tc.farmerDetails.split(",")[0] || row.seller || ""}</td>
        <td><span class="badge badge-success">${tc.prapatraNumber || row.prapatraNumber || ""}</span></td>
        <td><b>${tc.qty || row.weight || ""}</b></td>
        <td>₹${tc.rate || row.rate || ""}</td>
        <td>₹${tc.amt ? tc.amt.toLocaleString("en-IN") : ""}</td>
        <td>₹${totalFees.toFixed(0)}</td>
        <td>${tc.utr || "—"}</td>
      `;
      dashboardTbody.appendChild(tr);
    });
  });
}

async function saveScrapedData(newData) {
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
        updateRecordStats();
        renderPreviewTable();
        resolve();
      });
    });
  });
}

function deleteRecord(prapatraNumber) {
  if (confirm(`क्या आप वाकई प्रपत्र संख्या ${prapatraNumber} का रिकॉर्ड हटाना चाहते हैं?`)) {
    chrome.storage.local.get({ emandi_records: [] }, (result) => {
      const filtered = result.emandi_records.filter(r => r.prapatraNumber !== prapatraNumber);
      chrome.storage.local.set({ emandi_records: filtered }, () => {
        logToConsole(`प्रपत्र ${prapatraNumber} डेटाबेस से हटा दिया गया।`);
        updateRecordStats();
        renderPreviewTable();
      });
    });
  }
}

function updateRecordStats() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const records = result.emandi_records;
    
    document.getElementById("stat-total-records").innerText = records.length;
    
    let totalQty = 0;
    let totalAmt = 0;
    let totalFees = 0;

    records.forEach(r => {
      const tc = parseRawFields(r.printDetails?.rawText || "", r.paymentDetails?.rawText || "");
      totalQty += cleanNum(tc.qty);
      totalAmt += cleanNum(tc.amt) || (cleanNum(tc.qty) * cleanNum(tc.rate));
      totalFees += cleanNum(tc.fee) + cleanNum(tc.cess);
    });

    document.getElementById("stat-total-qty").innerText = totalQty.toFixed(2);
    document.getElementById("stat-total-amt").innerText = "₹" + Math.round(totalAmt).toLocaleString("en-IN");
    document.getElementById("stat-total-fees").innerText = "₹" + Math.round(totalFees).toLocaleString("en-IN");
  });
}

function clearStorage() {
  if (confirm("क्या आप सुरक्षित किया हुआ सारा डेटा हमेशा के लिए हटाना चाहते हैं?")) {
    chrome.storage.local.set({ emandi_records: [] }, () => {
      updateRecordStats();
      renderPreviewTable();
      resetScraperRange();
      logToConsole("स्थानीय डेटाबेस पूरी तरह साफ़ कर दिया गया है।");
    });
  }
}

function exportDataToCSV() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const data = result.emandi_records;
    if (data.length === 0) {
      alert("कोई डेटा उपलब्ध नहीं है!");
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

function renderBanksTable() {
  const tbody = document.getElementById("banks-table-body");
  if (!tbody) return;

  const searchInput = document.getElementById("search-banks-input");
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";

  chrome.storage.local.get({ supplier_bank_accounts: [] }, (result) => {
    const accounts = result.supplier_bank_accounts;
    tbody.innerHTML = "";

    const filtered = accounts.filter(acc => {
      return (acc.accountHolderName || "").toLowerCase().includes(searchQuery) ||
             (acc.accountNumber || "").includes(searchQuery) ||
             (acc.bankName || "").toLowerCase().includes(searchQuery) ||
             (acc.ifscCode || "").toLowerCase().includes(searchQuery);
    });

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">कोई सिंक किए गए बैंक खाते नहीं मिले।</td>`;
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach((acc, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td style="font-weight: 600; color: #38bdf8;">${acc.accountHolderName || "—"}</td>
        <td>${acc.bankName || "—"}</td>
        <td>${acc.accountNumber || "—"}</td>
        <td>${acc.ifscCode || "—"}</td>
        <td>${acc.accountType || "—"}</td>
        <td><span style="font-size: 11px; padding: 2px 6px; background-color: #334155; border-radius: 4px; color: #cbd5e1;">${acc.supplierId || "—"}</span></td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function clearAllBankData() {
  const confirmed = confirm(
    "⚠️ This will permanently delete ALL saved bank accounts from the extension.\n\nAre you sure you want to clear all bank data?"
  );
  if (!confirmed) return;

  chrome.storage.local.set({ supplier_bank_accounts: [] }, () => {
    console.log("eMandi: All bank account data cleared by user.");
    renderBanksTable();
    // Show success toast
    const toast = document.createElement("div");
    toast.textContent = "✓ All bank data cleared successfully.";
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #166534; color: #bbf7d0; border: 1px solid #16a34a;
      padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
      z-index: 99999; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  });
}

function parseStatementLogs() {
  const textarea = document.getElementById("statement-input-textarea");
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) {
    alert("कृपया पहले बैंक स्टेटमेंट का डेटा बॉक्स में पेस्ट करें!");
    return;
  }

  processStatementText(text);
}

function parseUploadedPDF() {
  if (!currentExcelFile) {
    alert("Please select a PDF file first.");
    return;
  }

  // Set the worker source for pdf.js (local file)
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const arrayBuffer = e.target.result;
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const items = textContent.items;
        if (!items || items.length === 0) continue;

        // Group items by Y coordinate with a vertical proximity threshold (e.g. 8px)
        // Sort items first by Y descending (top-to-bottom)
        const sortedItems = [...items].sort((a, b) => b.transform[5] - a.transform[5]);
        
        const lines = [];
        let currentLine = [];
        let activeY = null;
        const tolerance = 8; // vertical proximity tolerance in points

        sortedItems.forEach(item => {
          const y = item.transform[5];
          if (activeY === null) {
            currentLine.push(item);
            activeY = y;
          } else if (Math.abs(y - activeY) <= tolerance) {
            currentLine.push(item);
          } else {
            // Sort previous line left-to-right
            currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
            lines.push(currentLine);
            currentLine = [item];
            activeY = y;
          }
        });

        if (currentLine.length > 0) {
          currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
          lines.push(currentLine);
        }

        // Join each line's items with tabs
        lines.forEach(lineItems => {
          const lineText = lineItems.map(item => item.str).join("\t");
          fullText += lineText + "\n";
        });
      }

      console.log("eMandi statement parser: Reconstructed PDF Text:\n", fullText);
      processStatementText(fullText);

    } catch (err) {
      alert("Error parsing PDF file: " + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(currentExcelFile);
}

function processStatementText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const parsedData = [];

  // 1. Look for Date and Check number label in the text block (e.g. "DATE\t08-07-2026", "CHK\t00410")
  let blockDate = "";
  const dateMatch = text.match(/(?:DATE)\s*[\t ]*([0-9]{2}-[0-9]{2}-[0-9]{4}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
  if (dateMatch) {
    blockDate = dateMatch[1].trim();
  }

  let blockCheckNo = "";
  const checkMatch = text.match(/(?:CHK)\s*[\t ]*([0-9]{3,8})/i);
  if (checkMatch) {
    blockCheckNo = checkMatch[1].trim().padStart(6, "0");
  }

  const newBankAccountsToSave = [];
  const transactions = [];
  let currentTx = null;

  lines.forEach(line => {
    const lineLower = line.toLowerCase();
    
    // Ignore header rows or footer labels (pre-split check)
    if (lineLower.includes("value date") || lineLower.includes("instrument id") ||
        lineLower.includes("transaction date") || lineLower.includes("ifcs code") || lineLower.includes("account no") ||
        lineLower.includes("pl send rtgs") || lineLower.includes("jagdambe rice mill") || lineLower.includes("devkali road") ||
        (lineLower.startsWith("date") || lineLower.startsWith("chk")) ||
        (lineLower.includes("s.n") && lineLower.includes("name") && lineLower.includes("bank")) ||
        (lineLower.includes("sr") && lineLower.includes("utr") && lineLower.includes("recipient")) ||
        lineLower.includes("page ") || lineLower.includes("statement of account") || 
        lineLower.includes("customer id") || lineLower.includes("micr code") || 
        lineLower.includes("nominee reg") || lineLower.includes("balance") || 
        lineLower.includes("transaction date") || lineLower.includes("value date")) {
      return;
    }

    let parts = [];
    if (line.includes("\t")) {
      parts = line.split("\t").map(p => p.trim());
    } else {
      parts = line.split(/ {2,}/).map(p => p.trim());
    }

    const cleanParts = parts.filter(Boolean);
    if (cleanParts.length === 0) return;

    // Check if this line starts with a date or has a date in the first 2 columns
    let txDate = "";
    for (let i = 0; i < Math.min(2, cleanParts.length); i++) {
      const p = cleanParts[i];
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(p)) {
        txDate = p;
        break;
      }
    }

    // Also check if parts starts with a serial number (for Excel report/chart format compatibility)
    const startsWithSrNum = /^\d+$/.test(parts[0]);

    if (txDate || startsWithSrNum) {
      // Start new transaction
      if (currentTx) {
        transactions.push(currentTx);
      }
      currentTx = {
        date: txDate,
        startsWithSrNum: startsWithSrNum,
        parts: parts,
        cleanParts: cleanParts,
        narrationParts: [],
        amounts: [],
        nonDecimals: []
      };

      // Extract parts for potential standard transaction
      cleanParts.forEach(p => {
        if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(p)) return; // skip dates
        
        const cleanP = p.replace(/,/g, "");
        if (!isNaN(parseFloat(cleanP)) && cleanP.includes(".")) {
          currentTx.amounts.push(p);
        } else {
          // If it contains letters, it's part of narration
          if (/[a-zA-Z]/.test(p)) {
            currentTx.narrationParts.push(p);
          } else {
            currentTx.nonDecimals.push(p);
          }
        }
      });

    } else {
      // Continuation of previous transaction narration/amount
      if (currentTx) {
        cleanParts.forEach(p => {
          const cleanP = p.replace(/,/g, "");
          if (!isNaN(parseFloat(cleanP)) && cleanP.includes(".")) {
            currentTx.amounts.push(p);
          } else {
            if (/[a-zA-Z]/.test(p)) {
              currentTx.narrationParts.push(p);
            } else {
              currentTx.nonDecimals.push(p);
            }
          }
        });
      }
    }
  });

  if (currentTx) {
    transactions.push(currentTx);
  }

  // Now process all accumulated transactions
  transactions.forEach(tx => {
    // If it is an Excel report format or chart format, parse it directly from its original cleanParts
    if (tx.startsWithSrNum) {
      const parts = tx.parts;
      const cleanParts = tx.cleanParts;
      const hasIfsc = parts.some(p => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(p));
      
      // 1. Report Row format
      const isReportFormat = tx.startsWithSrNum && parts.length >= 5 && !hasIfsc && 
        (parts.some(p => p.toLowerCase().includes("bank")) || parts.some(p => p.toLowerCase().includes("baroda") || p.toLowerCase().includes("national") || p.toLowerCase().includes("hdfc") || p.toLowerCase().includes("sbi")));

      if (isReportFormat) {
        let dateVal = parts[1] || "—";
        let utrVal = parts[2] || "—";
        let nameVal = parts[3] || "—";
        let bankVal = parts[4] || "—";
        let amountVal = parts[5] || "—";

        if (dateVal === "—" || dateVal === "-") dateVal = "—";
        if (utrVal === "—" || utrVal === "-") utrVal = "—";
        if (nameVal === "—" || nameVal === "-") nameVal = "—";
        if (bankVal === "—" || bankVal === "-") bankVal = "—";

        const amtClean = amountVal.replace(/^-/, "").replace(/,/g, "").split(".")[0].trim();
        if (amtClean && amtClean !== "—" && amtClean !== "") {
          if (dateVal.replace(/,/g, "").trim() === amtClean) dateVal = blockDate || "—";
          if (utrVal.replace(/,/g, "").trim() === amtClean) utrVal = "—";
        }

        if (dateVal !== "—" && !/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(dateVal)) {
          if (utrVal === "—" || utrVal === "") utrVal = dateVal;
          dateVal = blockDate || "—";
        }

        parsedData.push({
          date: dateVal,
          utr: utrVal,
          checkNo: blockCheckNo || "",
          name: nameVal,
          bankName: bankVal,
          amount: amountVal.replace(/^-/, "").replace(/,/g, "").trim()
        });
        return;
      }

      // 2. Chart Format
      const isChartFormat = tx.startsWithSrNum && (hasIfsc || parts.some(p => p.toLowerCase().includes("bank")));
      if (isChartFormat) {
        const name = cleanParts[1] || "—";
        let accountNo = "—";
        const acMatch = cleanParts.find(p => /^\d{9,18}$/.test(p));
        if (acMatch) accountNo = acMatch;
        let ifsc = "—";
        const ifscMatch = cleanParts.find(p => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(p));
        if (ifscMatch) ifsc = ifscMatch;
        let amount = "—";
        const amtMatch = cleanParts.find((p, idx) => idx > 1 && /^\d+(\.\d+)?$/.test(p.replace(/,/g, "")) && p !== acMatch && !/^\d$/.test(p));
        if (amtMatch) amount = amtMatch.replace(/,/g, "");
        let bank = "—";
        const bankMatch = cleanParts.find(p => {
          const pLower = p.toLowerCase();
          return (pLower.includes("bank") || pLower.includes("bob") || pLower.includes("pnb") || pLower.includes("sbi") || pLower.includes("hdfc")) && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(p);
        });
        if (bankMatch) bank = bankMatch;

        if (accountNo !== "—" && ifsc !== "—") {
          newBankAccountsToSave.push({
            accountHolderName: name.toUpperCase(),
            accountNumber: accountNo,
            ifscCode: ifsc.toUpperCase(),
            bankName: bank.toUpperCase()
          });
        }

        parsedData.push({
          date: blockDate || "—",
          utr: blockCheckNo || "—",
          checkNo: blockCheckNo || "",
          name: name,
          bankName: bank,
          amount: amount
        });
        return;
      }
    }

    // 3. Standard Bank statement format parsing (Heuristic-based)
    // Join narration parts together
    let description = "";
    tx.narrationParts.forEach(part => {
      if (!description) {
        description = part;
      } else if (description.endsWith("-") || part.startsWith("-")) {
        description = description + part;
      } else {
        description = description + " " + part;
      }
    });

    const descLower = description.toLowerCase();
    if (descLower.includes("charges for") || descLower.includes("charges") || descLower.includes("bank charges") || descLower.includes("fee") || descLower.includes("chg")) return;

    let utr = "—";
    let chkVal = "";
    let name = "—";
    let bankName = "—";
    let amountVal = "—";

    // First amount is always the transaction amount (Withdrawal or Deposit), second is the Balance
    if (tx.amounts.length > 0) {
      amountVal = tx.amounts[0];
    }

    let isOnlineTransfer = false;
    if (description.includes("NEFT-") || description.includes("RTGS-")) {
      isOnlineTransfer = true;
      const descParts = description.split("-");
      if (descParts.length >= 2) utr = descParts[1].trim();
      if (descParts.length >= 3) name = descParts[2].trim();
      if (descParts.length >= 4) bankName = descParts.slice(3).join("-").trim();
    } else {
      const descParts = description.split("-");
      name = descParts[0].trim();
      if (descParts.length > 1) bankName = descParts.slice(1).join("-").trim();
    }

    // Check for check number (6 digits) in nonDecimals
    tx.nonDecimals.forEach(p => {
      if (!isNaN(parseInt(p, 10)) && p.length <= 6) {
        chkVal = String(p).padStart(6, "0");
        // Only set utr to check number if it's not an online transfer (which has its own UTR)
        if (!isOnlineTransfer) {
          utr = chkVal;
        }
      }
    });

    // Also look inside description for a check number if not found and not online transfer
    if (!chkVal) {
      const checkMatch = description.match(/\b([0-9]{6})\b/);
      if (checkMatch) {
        chkVal = checkMatch[1];
        if (!isOnlineTransfer) {
          utr = chkVal;
        }
      }
    }

    const amtClean = amountVal.replace(/^-/, "").replace(/,/g, "").split(".")[0].trim();
    let finalUtr = utr;
    let finalDate = tx.date;
    
    if (amtClean && amtClean !== "—" && amtClean !== "") {
      if (finalUtr.replace(/,/g, "").trim() === amtClean) finalUtr = "—";
      if (finalDate.replace(/,/g, "").trim() === amtClean) finalDate = blockDate || "—";
    }

    if (finalDate && finalDate !== "—") {
      finalDate = robustNormalizeDate(finalDate);
    }
    if (!finalDate) finalDate = "—";

    parsedData.push({
      date: finalDate,
      utr: finalUtr,
      checkNo: chkVal || "",
      name: name,
      bankName: bankName,
      amount: amountVal
    });
  });

  // Save to Chrome Local Storage Database by merging with existing data (e.g. synced RTGS data)
  chrome.storage.local.get({ statement_records: [], supplier_bank_accounts: [] }, (result) => {
    const existing = result.statement_records || [];
    const merged = [...existing];

    // Add unique bank accounts extracted from the chart
    const existingBanks = result.supplier_bank_accounts || [];
    const mergedBanks = [...existingBanks];

    newBankAccountsToSave.forEach(newBank => {
      const bankExists = mergedBanks.some(b => 
        (b.accountNumber || "").trim() === (newBank.accountNumber || "").trim()
      );
      if (!bankExists) {
        mergedBanks.push(newBank);
        console.log("eMandi Statement Parser: Saved new bank details from excel to auto-fill storage:", newBank);
      }
    });

    // Variables are already initialized in get callback, just write to storage.
    chrome.storage.local.set({ supplier_bank_accounts: mergedBanks });

    parsedData.forEach(newStmt => {
      // Check if it's already present in existing records
      const isDuplicate = merged.some(oldStmt => {
        const oldUtr = (oldStmt.utr || "").trim();
        const newUtr = (newStmt.utr || "").trim();
        const oldCheck = (oldStmt.checkNo || "").trim();
        const newCheck = (newStmt.checkNo || "").trim();

        const oldHasRealUtr = oldUtr !== "" && oldUtr !== "—" && oldUtr !== "-" && oldUtr !== oldCheck;
        const newHasRealUtr = newUtr !== "" && newUtr !== "—" && newUtr !== "-" && newUtr !== newCheck;

        // Duplicate if UTR matches
        if (oldHasRealUtr && newHasRealUtr && oldUtr.toLowerCase() === newUtr.toLowerCase()) {
          return true;
        }

        // Duplicate if all details (amount, date, name, ref) match
        const oldRef = oldUtr || oldCheck;
        const newRef = newUtr || newCheck;
        return newStmt.amount === oldStmt.amount &&
               newStmt.date === oldStmt.date &&
               (newStmt.name || "").toLowerCase().trim() === (oldStmt.name || "").toLowerCase().trim() &&
               oldRef.toLowerCase() === newRef.toLowerCase();
      });

      if (!isDuplicate) {
        merged.push(newStmt);
      }
    });

    chrome.storage.local.set({ statement_records: merged }, () => {
      console.log("eMandi Dashboard: Merged and saved statement records. Total:", merged.length);
      renderStatementTable();
    });
  });
}

function renderStatementTable() {
  const tbody = document.getElementById("statement-table-body");
  if (!tbody) return;

  chrome.storage.local.get({ statement_records: [] }, (result) => {
    const parsedData = result.statement_records;
    tbody.innerHTML = "";
    
    if (parsedData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">कोई पार्स किया गया डेटा नहीं है। कृपया ऊपर स्टेटमेंट पेस्ट करें।</td></tr>`;
      return;
    }

    parsedData.forEach((row, index) => {
      // Remove any leading negative signs and parse as float
      const rawAmt = parseFloat((row.amount || "").toString().replace(/^-/, "").replace(/,/g, "").trim());
      let displayAmt = row.amount;
      if (!isNaN(rawAmt)) {
        // Format as Indian Currency with decimals (e.g., 1,07,880.00)
        displayAmt = new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(rawAmt);
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${row.date}</td>
        <td style="font-family: monospace; font-weight: 600; color: #38bdf8;">${row.utr}</td>
        <td style="font-weight: 500;">${row.name}</td>
        <td>${row.bankName}</td>
        <td style="font-weight: 600; color: #ef4444; text-align: right; padding-right: 20px;">${displayAmt}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// Global Excel Processing State
let currentExcelWorkbook = null;
let currentExcelFile = null;

function handleSelectedExcelFile(file) {
  if (!file) return;
  currentExcelFile = file;

  const isPDF = file.name.toLowerCase().endsWith(".pdf");

  // Show info area
  const fileBadge = document.getElementById("excel-filename-badge");
  if (fileBadge) fileBadge.textContent = file.name;
  
  const fileInfo = document.getElementById("excel-file-info");
  if (fileInfo) fileInfo.style.display = "block";

  const sheetContainer = document.getElementById("sheet-selector-container");
  if (sheetContainer) {
    sheetContainer.style.display = isPDF ? "none" : "flex";
  }

  const parseBtn = document.getElementById("btn-parse-excel");
  if (parseBtn) parseBtn.removeAttribute("disabled");

  if (isPDF) {
    currentExcelWorkbook = null; // No workbook for PDF
    console.log("eMandi statement parser: Loaded PDF file successfully:", file.name);
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      currentExcelWorkbook = workbook;

      // Populate sheets select dropdown
      const sheetSelect = document.getElementById("excel-sheet-select");
      if (sheetSelect) {
        sheetSelect.innerHTML = "";
        workbook.SheetNames.forEach(name => {
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          sheetSelect.appendChild(opt);
        });
      }

      console.log("eMandi statement parser: Loaded Excel file successfully:", file.name);
    } catch (err) {
      alert("Error reading Excel file: " + err.message);
      clearExcelFileSelection();
    }
  };
  reader.readAsArrayBuffer(file);
}

function clearExcelFileSelection() {
  currentExcelWorkbook = null;
  currentExcelFile = null;

  const fileInput = document.getElementById("excel-file-input");
  if (fileInput) fileInput.value = "";

  const fileInfo = document.getElementById("excel-file-info");
  if (fileInfo) fileInfo.style.display = "none";

  const parseBtn = document.getElementById("btn-parse-excel");
  if (parseBtn) parseBtn.setAttribute("disabled", "true");
}


// Robust Date Normalization Helper
function robustNormalizeDate(input) {
  if (!input) return "";
  
  // If it's a JS Date object
  if (input instanceof Date && !isNaN(input.getTime())) {
    const dd = String(input.getDate()).padStart(2, "0");
    const mm = String(input.getMonth() + 1).padStart(2, "0");
    const yyyy = input.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  let str = input.toString().trim();
  if (!str) return "";

  // If it's an Excel serial date number (e.g. 46211)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    const dateObj = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const dd = String(dateObj.getDate()).padStart(2, "0");
      const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
      const yyyy = dateObj.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  // Match standard date formats like D/M/YY, DD-MM-YYYY, etc.
  const match = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (match) {
    let dd = match[1].padStart(2, "0");
    let mm = match[2].padStart(2, "0");
    let yyyy = match[3];
    if (yyyy.length === 2) {
      yyyy = "20" + yyyy;
    }
    return `${dd}/${mm}/${yyyy}`;
  }

  // Fallback to JS Date parsing
  const parsedTime = Date.parse(str.replace(/-/g, "/"));
  if (!isNaN(parsedTime)) {
    const dateObj = new Date(parsedTime);
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const yyyy = dateObj.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return "";
}

function parseUploadedExcel() {
  if (!currentExcelWorkbook) {
    alert("Please select a file first.");
    return;
  }

  const sheetSelect = document.getElementById("excel-sheet-select");
  const sheetName = sheetSelect ? sheetSelect.value : currentExcelWorkbook.SheetNames[0];
  const sheet = currentExcelWorkbook.Sheets[sheetName];
  if (!sheet) {
    alert("Selected sheet not found.");
    return;
  }

  // Convert Sheet to 2D Array
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length === 0) {
    alert("The selected sheet is empty.");
    return;
  }

  // Identify column mapping dynamically
  let colIndexName = -1;
  let colIndexAccount = -1;
  let colIndexIfsc = -1;
  let colIndexBank = -1;
  let colIndexAmount = -1;
  let colIndexDate = -1;
  let colIndexUtr = -1;

  let headerRowIndex = -1;

  // Search first 20 rows for headers
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const row = rows[r];
    let matchesCount = 0;
    
    // Check if this row contains the Name column (mandatory for header)
    const hasNameHeader = row.some(cell => {
      const val = (cell || "").toString().toLowerCase().trim();
      return val.includes("name") || val.includes("recipient") || val.includes("holder") || val.includes("particulars") || val.includes("किसान का नाम");
    });

    if (hasNameHeader) {
      for (let c = 0; c < row.length; c++) {
        const val = (row[c] || "").toString().toLowerCase().trim();
        if (val.includes("name") || val.includes("recipient") || val.includes("holder") || val.includes("particulars") || val.includes("किसान का नाम")) {
          matchesCount++;
        } else if (val.includes("account") || val.includes("ac no") || val.includes("acc") || val.includes("खाता")) {
          matchesCount++;
        } else if (val.includes("ifsc") || val.includes("ifcs") || val.includes("code")) {
          matchesCount++;
        } else if (val.includes("bank") || val.includes("branch") || val.includes("बैंक")) {
          matchesCount++;
        } else if (val.includes("amount") || val.includes("amt") || val.includes("value") || val.includes("राशि")) {
          if (!val.includes("date")) matchesCount++;
        } else if (val.includes("date") || val.includes("दिनांक")) {
          matchesCount++;
        } else if (val.includes("utr") || val.includes("ref") || val.includes("instrument") || val.includes("check") || val.includes("chk") || val.includes("reference")) {
          matchesCount++;
        }
      }
    }

    // If we matched at least 3 column headers, we consider this row the header row
    if (matchesCount >= 3) {
      headerRowIndex = r;
      
      // Map columns ONLY on this true header row
      colIndexName = -1;
      colIndexAccount = -1;
      colIndexIfsc = -1;
      colIndexBank = -1;
      colIndexAmount = -1;
      colIndexDate = -1;
      colIndexUtr = -1;

      for (let c = 0; c < row.length; c++) {
        const val = (row[c] || "").toString().toLowerCase().trim();
        if (val.includes("name") || val.includes("recipient") || val.includes("holder") || val.includes("particulars") || val.includes("किसान का नाम")) {
          colIndexName = c;
        } else if (val.includes("account") || val.includes("ac no") || val.includes("acc") || val.includes("खाता")) {
          colIndexAccount = c;
        } else if (val.includes("ifsc") || val.includes("ifcs") || val.includes("code")) {
          colIndexIfsc = c;
        } else if (val.includes("bank") || val.includes("branch") || val.includes("बैंक")) {
          colIndexBank = c;
        } else if (val.includes("amount") || val.includes("amt") || val.includes("value") || val.includes("राशि")) {
          if (!val.includes("date")) colIndexAmount = c;
        } else if (val.includes("date") || val.includes("दिनांक")) {
          colIndexDate = c;
        } else if (val.includes("utr") || val.includes("ref") || val.includes("instrument") || val.includes("check") || val.includes("chk") || val.includes("reference")) {
          colIndexUtr = c;
        }
      }
      break;
    }
  }

  // Fallback heuristic if header row not found
  if (headerRowIndex === -1) {
    colIndexName = 1;
    colIndexAccount = 2;
    colIndexIfsc = 3;
    colIndexAmount = 4;
    colIndexBank = 6;
    headerRowIndex = 0;
  }

  // Extract block metadata (DATE, CHK) from rows above the header row
  let blockDate = "";
  let blockCheckNo = "";
  for (let r = 0; r < headerRowIndex; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = (row[c] || "").toString().toLowerCase().trim();
      const cleanVal = val.replace(/:/g, "").trim();
      if (cleanVal === "date" || cleanVal === "दिनांक" || cleanVal === "tariq" || cleanVal === "तारीख") {
        for (let nextC = c + 1; nextC < row.length; nextC++) {
          const nextVal = row[nextC];
          if (nextVal !== null && nextVal !== undefined && nextVal.toString().trim() !== "") {
            blockDate = robustNormalizeDate(nextVal);
            break;
          }
        }
      } else if (cleanVal === "chk" || cleanVal === "check" || cleanVal === "check no" || cleanVal === "utr" || cleanVal === "ref no" || cleanVal === "ref.no" || cleanVal === "चेक" || cleanVal === "चेक नंबर" || cleanVal === "चेक नं") {
        for (let nextC = c + 1; nextC < row.length; nextC++) {
          const nextVal = row[nextC];
          if (nextVal !== null && nextVal !== undefined && nextVal.toString().trim() !== "") {
            blockCheckNo = nextVal.toString().trim().padStart(6, "0");
            break;
          }
        }
      }
    }
  }

  console.log("eMandi statement parser: Extracted block metadata - Date:", blockDate, "CheckNo:", blockCheckNo);

  const parsedStatements = [];
  const newBankAccountsToSave = [];

  // Parse data rows below the header
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Check if the row contains values
    const hasValues = row.some(cell => cell !== null && cell !== undefined && cell.toString().trim() !== "");
    if (!hasValues) continue;

    const nameVal = colIndexName !== -1 ? (row[colIndexName] || "").toString().trim() : "";
    const accountVal = colIndexAccount !== -1 ? (row[colIndexAccount] || "").toString().trim() : "";
    const ifscVal = colIndexIfsc !== -1 ? (row[colIndexIfsc] || "").toString().trim() : "";
    let bankVal = colIndexBank !== -1 ? (row[colIndexBank] || "").toString().trim() : "";
    const amountVal = colIndexAmount !== -1 ? (row[colIndexAmount] || "").toString().trim() : "";
    let dateVal = colIndexDate !== -1 ? (row[colIndexDate] || "").toString().trim() : "";
    let utrVal = colIndexUtr !== -1 ? (row[colIndexUtr] || "").toString().trim() : "";

    // Skip empty name or metadata rows (like footer totals, e.g. "PL SEND RTGS" or sum values)
    if (!nameVal || nameVal === "—" || nameVal.toLowerCase().includes("name") || nameVal.toLowerCase().includes("holder") || nameVal.toLowerCase().includes("send rtgs")) {
      continue;
    }
    if (accountVal.toLowerCase().includes("account")) {
      continue;
    }

    // Clean Amount: remove negative sign & commas
    let cleanedAmt = amountVal.replace(/^-/, "").replace(/,/g, "").trim();
    if (!cleanedAmt || isNaN(parseFloat(cleanedAmt))) continue;

    // Build Bank details if available
    // Ensure bankName is not identical to IFSC code
    if (bankVal && /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(bankVal)) {
      bankVal = "—";
    }

    // Save Bank detail registry entry if valid account & IFSC present
    if (accountVal && ifscVal && /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscVal)) {
      newBankAccountsToSave.push({
        accountHolderName: nameVal.toUpperCase(),
        accountNumber: accountVal,
        ifscCode: ifscVal.toUpperCase(),
        bankName: bankVal ? bankVal.toUpperCase() : "—"
      });
    }

    // Fallback to block metadata (DATE, CHK) if row-level values are missing or '—'
    if ((!dateVal || dateVal === "—" || dateVal === "-") && blockDate) {
      dateVal = blockDate;
    }
    if ((!utrVal || utrVal === "—" || utrVal === "-") && blockCheckNo) {
      utrVal = blockCheckNo;
    }

    // Format Date correctly
    if (dateVal) {
      dateVal = robustNormalizeDate(dateVal);
    }

    // Clean Date and UTR if they match the amount (fallback)
    const amtClean = cleanedAmt.split(".")[0].trim();
    if (amtClean && amtClean !== "—" && amtClean !== "") {
      if (dateVal.replace(/,/g, "").trim() === amtClean) {
        dateVal = "—";
      }
      if (utrVal.replace(/,/g, "").trim() === amtClean) {
        utrVal = "—";
      }
    }

    // Double check dateVal validity
    if (!dateVal) {
      dateVal = "—";
    }

    parsedStatements.push({
      date: dateVal || "—",
      utr: utrVal || "—",
      checkNo: blockCheckNo || "",
      name: nameVal || "—",
      bankName: bankVal || "—",
      amount: cleanedAmt
    });
  }

  if (parsedStatements.length === 0) {
    alert("Could not extract any valid transactions from the sheet.");
    return;
  }

  // Merge and save to database
  chrome.storage.local.get({ statement_records: [], supplier_bank_accounts: [] }, (result) => {
    const existingStmts = result.statement_records || [];
    const mergedStmts = [...existingStmts];

    const existingBanks = result.supplier_bank_accounts || [];
    const mergedBanks = [...existingBanks];

    // Save unique banks
    newBankAccountsToSave.forEach(newBank => {
      const bankExists = mergedBanks.some(b => 
        (b.accountNumber || "").trim() === (newBank.accountNumber || "").trim()
      );
      if (!bankExists) {
        mergedBanks.push(newBank);
        console.log("eMandi Statement Parser: Saved new bank details from Excel file:", newBank);
      }
    });
    chrome.storage.local.set({ supplier_bank_accounts: mergedBanks });

    // Save statement records
    let addedCount = 0;
    parsedStatements.forEach(newStmt => {
      const isDuplicate = mergedStmts.some(oldStmt => {
        const oldUtr = (oldStmt.utr || "").trim();
        const newUtr = (newStmt.utr || "").trim();
        const oldCheck = (oldStmt.checkNo || "").trim();
        const newCheck = (newStmt.checkNo || "").trim();

        const oldHasRealUtr = oldUtr !== "" && oldUtr !== "—" && oldUtr !== "-" && oldUtr !== oldCheck;
        const newHasRealUtr = newUtr !== "" && newUtr !== "—" && newUtr !== "-" && newUtr !== newCheck;

        if (oldHasRealUtr && newHasRealUtr && oldUtr.toLowerCase() === newUtr.toLowerCase()) {
          return true;
        }

        const oldRef = oldUtr || oldCheck;
        const newRef = newUtr || newCheck;
        return newStmt.amount === oldStmt.amount &&
               newStmt.date === oldStmt.date &&
               (newStmt.name || "").toLowerCase().trim() === (oldStmt.name || "").toLowerCase().trim() &&
               oldRef.toLowerCase() === newRef.toLowerCase();
      });

      if (!isDuplicate) {
        mergedStmts.push(newStmt);
        addedCount++;
      }
    });

    chrome.storage.local.set({ statement_records: mergedStmts }, () => {
      alert(`Success! Successfully parsed Excel sheet. Loaded ${parsedStatements.length} transactions (${addedCount} new added).`);
      renderStatementTable();
      clearExcelFileSelection();
    });
  });
}

