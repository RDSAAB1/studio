// popup.js - Handles simplified gateway hub popup actions

document.addEventListener("DOMContentLoaded", () => {
  const btnOpenDashboard = document.getElementById("btn-open-dashboard");

  // Open full-screen dashboard page
  btnOpenDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });

  // Check connection status & retrieve stats
  checkPortalConnection();
  loadQuickStats();

  // Reactive updates on storage change
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.emandi_records) {
      loadQuickStats();
    }
  });
});

function loadQuickStats() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const records = result.emandi_records;
    
    document.getElementById("stat-records").innerText = records.length;
    
    let totalQty = 0;
    const cleanNum = (val) => {
      if (val === undefined || val === null) return 0;
      const cleaned = String(val).replace(/,/g, "").replace(/[₹\s]/g, "");
      return parseFloat(cleaned) || 0;
    };

    records.forEach(r => {
      const tc = r.tableCache || parseRawFields(r.printDetails?.rawText || "", r.paymentDetails?.rawText || "");
      totalQty += cleanNum(tc.qty);
    });
    
    document.getElementById("stat-qty").innerText = totalQty.toFixed(2);
  });
}

function checkPortalConnection() {
  chrome.tabs.query({ url: "*://emandi.up.gov.in/*" }, (tabs) => {
    const dot = document.getElementById("status-dot");
    const txt = document.getElementById("status-text");
    
    if (tabs && tabs.length > 0) {
      dot.classList.add("online");
      txt.innerText = "Connected";
      txt.style.color = "#10b981";
    } else {
      dot.classList.remove("online");
      txt.innerText = "Disconnected";
      txt.style.color = "#ef4444";
    }
  });
}

// Simple parser copy for quick stats calculation
function parseRawFields(voucherText, paymentText) {
  const data = {};
  if (!voucherText) return data;

  try {
    const cropRowMatch = voucherText.match(/([^\d\n\r]+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/);
    if (cropRowMatch) {
      const cleanNum = (val) => parseFloat(String(val).replace(/,/g, "")) || 0;
      data.qty = cleanNum(cropRowMatch[2]).toFixed(2);
    } else {
      data.qty = "";
    }
  } catch (e) {}
  return data;
}
