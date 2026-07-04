// popup.js - Controls the scraper UI and handles communication with content.js

document.addEventListener("DOMContentLoaded", () => {
  // Restore current database counts
  updateRecordCount();
  resetUI();

  // Action Buttons
  const btnStart = document.getElementById("btn-start");
  const btnReset = document.getElementById("btn-reset");
  const btnExport = document.getElementById("btn-export");
  const btnClear = document.getElementById("btn-clear");

  btnStart.addEventListener("click", startExtraction);
  btnReset.addEventListener("click", resetUI);
  btnExport.addEventListener("click", exportDataToCSV);
  btnClear.addEventListener("click", clearStorage);

  // Listen for progress and logs from content.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "log") {
      logToConsole(message.message);
    } else if (message.action === "progress") {
      updateProgress(message.percent, message.status);
    }
  });
});

function logToConsole(message) {
  const consoleLog = document.getElementById("console-log");
  consoleLog.textContent += "\n" + message;
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function updateProgress(percent, statusText) {
  const bar = document.getElementById("progress-bar");
  const status = document.getElementById("progress-status");
  const percentText = document.getElementById("progress-percent");

  bar.style.width = percent + "%";
  percentText.innerText = percent + "%";
  status.innerText = statusText;
}

function resetUI() {
  updateProgress(0, "तैयार है (Ready)");
  document.getElementById("console-log").textContent = "Logs cleared. Ready to search.";
}

async function startExtraction() {
  resetUI();
  logToConsole("कनेक्शन चेक किया जा रहा है...");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes("emandi.up.gov.in")) {
    logToConsole("[ERROR] कृपया सुनिश्चित करें कि आप emandi.up.gov.in/TraderProcessing/SixRList पेज पर हैं!");
    alert("कृपया पहले eMandi 6R List पोर्टल ओपन करें!");
    return;
  }

  // Get single Prapatra number search value
  const prapatraSearch = document.getElementById("prapatra-single").value.trim();
  if (!prapatraSearch) {
    alert("कृपया खोजने के लिए प्रपत्र-6 नंबर दर्ज करें!");
    logToConsole("[WARN] प्रपत्र-6 नंबर इनपुट खाली है।");
    return;
  }

  const config = {
    prapatraSearch
  };

  logToConsole(`प्रपत्र-6: ${prapatraSearch} खोजने का अनुरोध भेजा जा रहा है...`);

  // Send message to scrape
  chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      // Content script not loaded, inject it
      logToConsole("कंटेंट स्क्रिप्ट लोड की जा रही है...");
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      }, () => {
        setTimeout(() => {
          sendMessageToScrape(tab.id, config);
        }, 500);
      });
    } else {
      sendMessageToScrape(tab.id, config);
    }
  });
}

function sendMessageToScrape(tabId, config) {
  document.getElementById("btn-start").disabled = true;

  chrome.tabs.sendMessage(tabId, { action: "scrapeData", config }, async (response) => {
    document.getElementById("btn-start").disabled = false;
    
    if (chrome.runtime.lastError) {
      logToConsole("[ERROR] संपर्क टूट गया: " + chrome.runtime.lastError.message);
      return;
    }

    if (response && response.success) {
      if (response.count > 0) {
        logToConsole(`[SUCCESS] सफलतापूर्वक ${response.count} रिकॉर्ड्स का डेटा संकलित कर लिया गया है।`);
        // Save data to Chrome Storage
        await saveScrapedData(response.data);
        updateRecordCount();
      } else {
        logToConsole("[WARN] कोई रिकॉर्ड नहीं मिला जो प्रपत्र संख्या से मेल खाता हो।");
      }
    } else {
      logToConsole("[ERROR] स्क्रैपिंग विफल रही: " + (response ? response.error : "Unknown Error"));
    }
  });
}

async function saveScrapedData(newData) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ emandi_records: [] }, (result) => {
      const existing = result.emandi_records;
      
      const mergedMap = new Map();
      existing.forEach(item => mergedMap.set(item.prapatraNumber, item));
      newData.forEach(item => mergedMap.set(item.prapatraNumber, item));
      
      const mergedArray = Array.from(mergedMap.values());
      
      chrome.storage.local.set({ emandi_records: mergedArray }, () => {
        resolve();
      });
    });
  });
}

function updateRecordCount() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    document.getElementById("record-count").innerText = result.emandi_records.length;
  });
}

function clearStorage() {
  if (confirm("क्या आप सुरक्षित किया हुआ सारा डेटा डिलीट करना चाहते हैं?")) {
    chrome.storage.local.set({ emandi_records: [] }, () => {
      updateRecordCount();
      resetUI();
      logToConsole("स्टोरेज खाली कर दी गई है।");
    });
  }
}

// Convert JSON to CSV and trigger download
function exportDataToCSV() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const data = result.emandi_records;
    if (data.length === 0) {
      alert("कोई डेटा सुरक्षित नहीं है!");
      return;
    }

    const headers = [
      "Sr No", "Date (दिनांक)", "Prapatra-6 (प्रपत्र-6)", "Seller Name", "Buyer Firm", "Crop (फसल)", 
      "Weight (तौल क्विंटल)", "Rate (दर)", "Payment Status", "Scraped Time",
      // Print page fields
      "Print - किसान का नाम", "Print - फसल", "Print - कुल वजन", "Print - दर", "Print - कुल मूल्य", 
      "Print - मंडी शुल्क", "Print - विकास सेस", "Print - शुद्ध भुगतान योग्य"
    ];

    let csvContent = "\ufeff" + headers.join(",") + "\n"; // BOM for Excel Hindi support

    data.forEach((row, index) => {
      const p = row.printDetails || {};
      
      const print_seller = p["विक्रेता किसान का नाम"] || p["किसान का नाम"] || p["Name of Seller"] || "";
      const print_crop = p["फसल का नाम"] || p["फसल"] || "";
      const print_wt = p["फसल का कुल तौल"] || p["कुल वजन"] || p["Weight"] || "";
      const print_rate = p["दर"] || p["Rate"] || "";
      const print_amt = p["कुल मूल्य"] || p["मूल्य"] || "";
      const print_fee = p["मंडी शुल्क"] || p["Mandi Fee"] || "";
      const print_cess = p["विकास सेस"] || p["Cess"] || "";
      const print_net = p["शुद्ध भुगतान"] || p["कुल भुगतान"] || p["Net Payable"] || "";

      const rowValues = [
        index + 1,
        escapeCSV(row.date),
        escapeCSV(row.prapatraNumber),
        escapeCSV(row.seller),
        escapeCSV(row.buyer),
        escapeCSV(row.crop),
        escapeCSV(row.weight),
        escapeCSV(row.rate),
        escapeCSV(row.paymentStatus),
        escapeCSV(row.scrapedAt),
        // Print slip values
        escapeCSV(print_seller),
        escapeCSV(print_crop),
        escapeCSV(print_wt),
        escapeCSV(print_rate),
        escapeCSV(print_amt),
        escapeCSV(print_fee),
        escapeCSV(print_cess),
        escapeCSV(print_net)
      ];

      csvContent += rowValues.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `emandi_data_${new Date().toISOString().split('T')[0]}.csv`);
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
