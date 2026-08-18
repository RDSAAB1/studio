// dashboard.js - Controls the full-screen scraper dashboard UI

let apiBaseUrl = "https://jrmd.netlify.app";
let apiBaseUrlReady = false;

// Auto-detect local development server — returns a Promise so callers can await it
const apiBaseUrlPromise = (function detectApiBase() {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      resolve(apiBaseUrl); // timeout = use production
    }, 800);
    // Use GET /api/ping/ — trailing slash avoids Next.js 308 redirect
    fetch("http://localhost:3000/api/ping/", {
      method: "GET",
      signal: controller.signal
    })
      .then(async (res) => {
        clearTimeout(timeoutId);
        if (res.ok) {
          apiBaseUrl = "http://localhost:3000";
          apiBaseUrlReady = true;
          console.log("eMandi Dashboard: Local dev server detected (http://localhost:3000)");
        } else {
          apiBaseUrlReady = true;
          console.log("eMandi Dashboard: Using production server (https://jrmd.netlify.app)");
        }
        resolve(apiBaseUrl);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        apiBaseUrlReady = true;
        console.log("eMandi Dashboard: Using production server (https://jrmd.netlify.app)");
        resolve(apiBaseUrl);
      });
  });
})();

// Reusable sliding toast notification system for non-blocking alerts
function showToast(message, type = "success") {
  const toastContainer = document.getElementById("emandi-toast-container") || (() => {
    const el = document.createElement("div");
    el.id = "emandi-toast-container";
    el.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 10000000;
    `;
    document.body.appendChild(el);
    return el;
  })();

  const toast = document.createElement("div");
  const icon = type === "success" ? "✓" : (type === "warning" ? "⚠️" : "ℹ️");
  const bg = type === "success" ? "#166534" : (type === "warning" ? "#854d0e" : "#1e293b");
  const border = type === "success" ? "#15803d" : (type === "warning" ? "#a16207" : "#334155");
  const color = type === "success" ? "#bbf7d0" : (type === "warning" ? "#fef08a" : "#f8fafc");

  toast.style.cssText = `
    background-color: ${bg};
    border: 1px solid ${border};
    color: ${color};
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 280px;
    max-width: 400px;
    transform: translateX(120%);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
    opacity: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  toast.innerHTML = `
    <span style="font-size: 16px;">${icon}</span>
    <div style="flex-grow: 1;">${message}</div>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation in
  setTimeout(() => {
    toast.style.transform = "translateX(0)";
    toast.style.opacity = "1";
  }, 50);

  // Dismiss after 3.5 seconds
  setTimeout(() => {
    toast.style.transform = "translateX(120%)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Override native window.alert with a premium in-UI modal overlay
window.alert = function(message) {
  const formattedMsg = String(message).replace(/\n/g, "<br>");
  
  const backdrop = document.createElement("div");
  backdrop.id = "emandi-alert-modal";
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000000;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;
  
  const container = document.createElement("div");
  container.style.cssText = `
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 420px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
    transform: scale(0.95);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  `;
  
  const icon = document.createElement("span");
  icon.innerHTML = "ℹ️";
  icon.style.cssText = `
    font-size: 24px;
    display: inline-block;
  `;
  
  const title = document.createElement("span");
  title.textContent = "सूचना (Notification)";
  title.style.cssText = `
    font-weight: 700;
    font-size: 1.1rem;
    color: #e2e8f0;
  `;
  
  header.appendChild(icon);
  header.appendChild(title);
  
  const body = document.createElement("div");
  body.innerHTML = formattedMsg;
  body.style.cssText = `
    font-size: 0.9rem;
    line-height: 1.5;
    color: #94a3b8;
    margin-bottom: 24px;
  `;
  
  const footer = document.createElement("div");
  footer.style.cssText = `
    display: flex;
    justify-content: flex-end;
  `;
  
  const okBtn = document.createElement("button");
  okBtn.textContent = "OK";
  okBtn.style.cssText = `
    padding: 8px 24px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
    transition: all 0.15s ease;
  `;
  okBtn.onmouseenter = () => okBtn.style.transform = "translateY(-1px)";
  okBtn.onmouseleave = () => okBtn.style.transform = "none";
  
  footer.appendChild(okBtn);
  container.appendChild(header);
  container.appendChild(body);
  container.appendChild(footer);
  backdrop.appendChild(container);
  document.body.appendChild(backdrop);
  
  setTimeout(() => {
    backdrop.style.opacity = "1";
    container.style.transform = "scale(1)";
  }, 10);
  
  const close = () => {
    backdrop.style.opacity = "0";
    container.style.transform = "scale(0.95)";
    setTimeout(() => backdrop.remove(), 200);
  };
  
  okBtn.onclick = close;
};

// Custom Confirmation Dialog using a callback-based structure
function showCustomConfirm(message, callback, details = null) {
  const backdrop = document.createElement("div");
  backdrop.id = "emandi-confirm-modal";
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000000;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;
  
  const container = document.createElement("div");
  container.style.cssText = `
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 440px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    transform: scale(0.95) translateY(-10px);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  `;
  
  const icon = document.createElement("span");
  icon.innerHTML = `<svg style="width: 24px; height: 24px; color: #ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
  icon.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const title = document.createElement("span");
  title.textContent = "पुष्टि करें (Confirm Action)";
  title.style.cssText = `
    font-weight: 700;
    font-size: 1.15rem;
    color: #f1f5f9;
  `;
  
  header.appendChild(icon);
  header.appendChild(title);
  
  const msgEl = document.createElement("div");
  msgEl.textContent = message;
  msgEl.style.cssText = `
    font-size: 0.92rem;
    line-height: 1.5;
    color: #94a3b8;
    margin-bottom: 16px;
  `;
  
  container.appendChild(header);
  container.appendChild(msgEl);

  // Render contextual details card if provided
  if (details && typeof details === "object") {
    const detailsCard = document.createElement("div");
    detailsCard.style.cssText = `
      background-color: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 20px;
      font-size: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;
    
    for (const [key, val] of Object.entries(details)) {
      const row = document.createElement("div");
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        line-height: 1.3;
      `;
      row.innerHTML = `
        <span style="color: #64748b; font-weight: 600;">${key}:</span>
        <span style="color: #cbd5e1; font-weight: 500; text-align: right; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${val}</span>
      `;
      detailsCard.appendChild(row);
    }
    container.appendChild(detailsCard);
  }
  
  const footer = document.createElement("div");
  footer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  `;
  
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText = `
    padding: 8px 16px;
    background: transparent;
    border: 1px solid #475569;
    border-radius: 6px;
    color: #cbd5e1;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    transition: all 0.15s ease;
  `;
  cancelBtn.onmouseenter = () => cancelBtn.style.background = "rgba(255,255,255,0.04)";
  cancelBtn.onmouseleave = () => cancelBtn.style.background = "transparent";
  
  const okBtn = document.createElement("button");
  okBtn.textContent = "OK";
  okBtn.style.cssText = `
    padding: 8px 20px;
    background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3);
    transition: all 0.15s ease;
  `;
  okBtn.onmouseenter = () => okBtn.style.transform = "translateY(-1px)";
  okBtn.onmouseleave = () => okBtn.style.transform = "none";
  
  footer.appendChild(cancelBtn);
  footer.appendChild(okBtn);
  container.appendChild(footer);
  backdrop.appendChild(container);
  document.body.appendChild(backdrop);
  
  setTimeout(() => {
    backdrop.style.opacity = "1";
    container.style.transform = "scale(1) translateY(0)";
  }, 10);
  
  const close = (confirmed) => {
    backdrop.style.opacity = "0";
    container.style.transform = "scale(0.95) translateY(-10px)";
    setTimeout(() => {
      backdrop.remove();
      callback(confirmed);
    }, 200);
  };
  
  cancelBtn.onclick = () => close(false);
  okBtn.onclick = () => close(true);
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("eMandi Dashboard: DOMContentLoaded triggered. Setting up UI...");
  console.log("Diagnostic - window.pdfjsLib:", typeof window.pdfjsLib, "window.pdfjs:", typeof window.pdfjs);

  // --- AUTHENTICATION & SUBSCRIPTION FLOW ---
  const authLoginOverlay = document.getElementById("auth-login-overlay");
  const subscriptionLockOverlay = document.getElementById("subscription-lock-overlay");

  function updateCountdown(expiry, duration) {
    const timeLeftContainer = document.getElementById("sub-time-left");
    if (!timeLeftContainer) return;
    
    if (duration === "lifetime") {
      timeLeftContainer.textContent = "Lifetime Access";
      timeLeftContainer.style.color = "#4ade80";
      return;
    }

    const diff = expiry - Date.now();
    if (diff <= 0) {
      timeLeftContainer.textContent = "Expired";
      timeLeftContainer.style.color = "#ef4444";
      return;
    }

    const secs = Math.floor(diff / 1000) % 60;
    const mins = Math.floor(diff / (1000 * 60)) % 60;
    const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    let displayText = "";
    if (days > 0) {
      displayText = `${days} ${days === 1 ? 'Day' : 'Days'} Left`;
    } else if (hours > 0) {
      displayText = `${hours} ${hours === 1 ? 'Hour' : 'Hours'} Left`;
    } else if (mins > 0) {
      displayText = `${mins} ${mins === 1 ? 'Min' : 'Mins'} Left`;
    } else {
      displayText = `< 1 Min Left`;
    }

    timeLeftContainer.textContent = displayText;
    timeLeftContainer.title = `Exact Expiration: ${days}d ${hours}h ${mins}m ${secs}s`;

    if (diff < 86400000) {
      timeLeftContainer.style.color = "#f87171";
    } else {
      timeLeftContainer.style.color = "#4ade80";
    }
  }

  function backupCurrentUserRecords(callback) {
    chrome.storage.local.get(["username", "emandi_records", "company_profile"], (data) => {
      if (data.username) {
        const recordsKey = `emandi_records_${data.username}`;
        const companyKey = `company_profile_${data.username}`;
        const updates = {};
        if (data.emandi_records) updates[recordsKey] = data.emandi_records;
        if (data.company_profile) updates[companyKey] = data.company_profile;
        chrome.storage.local.set(updates, () => {
          if (callback) callback();
        });
      } else {
        if (callback) callback();
      }
    });
  }

  function restoreNewUserRecords(newUsername, callback) {
    if (!newUsername) {
      if (callback) callback();
      return;
    }
    const recordsKey = `emandi_records_${newUsername}`;
    const companyKey = `company_profile_${newUsername}`;
    chrome.storage.local.get([recordsKey, companyKey, "emandi_records"], (data) => {
      const userRecords = data[recordsKey];
      const activeRecords = data.emandi_records || [];
      const recordsToUse = (userRecords !== undefined) ? userRecords : activeRecords;
      const profile = data[companyKey] || null;

      const updates = {
        emandi_records: recordsToUse,
        [recordsKey]: recordsToUse
      };
      if (profile) updates.company_profile = profile;

      chrome.storage.local.set(updates, () => {
        if (typeof renderPreviewTable === "function") {
          renderPreviewTable();
        }
        if (profile && typeof populateCompanyProfileForm === "function") {
          populateCompanyProfileForm(profile);
        }
        if (callback) callback();
      });
    });
  }

  let lastSyncTime = 0;

  function syncSubscriptionFromDatabase(username, callback, force = false) {
    if (!username) {
      if (callback) callback(false);
      return;
    }

    const cleanUser = String(username).trim();
    const lowerUser = cleanUser.toLowerCase();

    // Throttle queries to once every 15 seconds unless forced
    if (!force && (Date.now() - lastSyncTime < 15000)) {
      if (callback) callback(false);
      return;
    }
    lastSyncTime = Date.now();

    console.log("eMandi Dashboard: Querying Cloud Subscription API for user:", cleanUser);

    chrome.storage.local.get("companyId", (storeData) => {
      const companyId = storeData.companyId || "";
      const tryFetchUser = (qUser, fallbackQ) => {
        fetch(`${apiBaseUrl}/api/subscription/get?username=${encodeURIComponent(qUser)}&companyId=${encodeURIComponent(companyId)}`)
          .then(res => res.json())
          .then(resData => {
            if (resData.success && resData.data) {
            const dbExpiry = Number(resData.data.subscription_expiry || 0);
            const dbVerified = resData.data.subscription_verified === true;
            const dbDuration = resData.data.subscription_duration || "monthly";

            // If db subscription is valid, update local storage
            if (dbVerified && dbExpiry > Date.now()) {
              console.log("eMandi Dashboard: Active subscription found on Cloud! Syncing locally:", resData.data);
              chrome.storage.local.set({
                subscription_verified: true,
                subscription_expiry: dbExpiry,
                subscription_duration: dbDuration
              }, () => {
                if (callback) callback(true);
              });
              return;
            }
          }

          if (fallbackQ && fallbackQ !== qUser) {
            tryFetchUser(fallbackQ, null);
          } else {
            if (callback) callback(false);
          }
        })
        .catch(err => {
          console.warn("Failed to fetch subscription from Cloud API:", err);
          if (fallbackQ && fallbackQ !== qUser) {
            tryFetchUser(fallbackQ, null);
          } else {
            if (callback) callback(false);
          }
        });
      };

      tryFetchUser(cleanUser, lowerUser);
    });
  }

  function updateVerifyButtonState() {
    const btnVerifyCode = document.getElementById("btn-verify-code");
    if (!btnVerifyCode) return;
    chrome.storage.local.get("generated_subscription_code", (data) => {
      if (data.generated_subscription_code) {
        btnVerifyCode.disabled = false;
        btnVerifyCode.style.opacity = "1";
        btnVerifyCode.style.pointerEvents = "auto";
        btnVerifyCode.style.cursor = "pointer";
      } else {
        btnVerifyCode.disabled = true;
        btnVerifyCode.style.opacity = "0.4";
        btnVerifyCode.style.pointerEvents = "none";
        btnVerifyCode.style.cursor = "not-allowed";
      }
    });
  }

  function clearLocalSubscriptionData(callback) {
    chrome.storage.local.remove([
      "subscription_verified",
      "subscription_expiry",
      "subscription_duration",
      "generated_subscription_code",
      "pending_duration"
    ], callback);
  }

  let lastLoadedAutofillUser = undefined;

  function switchActiveUserAutofill(newUsername, callback) {
    if (newUsername === lastLoadedAutofillUser) {
      if (callback) callback();
      return;
    }
    lastLoadedAutofillUser = newUsername;

    if (!newUsername) {
      chrome.storage.local.remove(["portal_email", "portal_password", "ocr_api_key"], () => {
        const emailEl = document.getElementById("autofill-email");
        const passEl = document.getElementById("autofill-password");
        const ocrInput = document.getElementById("ocr-api-key");
        if (emailEl) emailEl.value = "";
        if (passEl) passEl.value = "";
        if (ocrInput) ocrInput.value = "";
        if (callback) callback();
      });
      return;
    }

    const cleanUser = String(newUsername).trim();
    const emailKey = `portal_email_${cleanUser}`;
    const passKey = `portal_password_${cleanUser}`;
    const ocrKey = `ocr_api_key_${cleanUser}`;

    chrome.storage.local.get([emailKey, passKey, ocrKey], (res) => {
      const email = res[emailKey] || "";
      const password = res[passKey] || "";
      const apiKey = res[ocrKey] || "";

      chrome.storage.local.set({
        portal_email: email,
        portal_password: password,
        ocr_api_key: apiKey
      }, () => {
        const emailEl = document.getElementById("autofill-email");
        const passEl = document.getElementById("autofill-password");
        const ocrInput = document.getElementById("ocr-api-key");
        if (emailEl) emailEl.value = email;
        if (passEl) passEl.value = password;
        if (ocrInput) ocrInput.value = apiKey;
        if (callback) callback();
      });
    });
  }

  function checkAuthAndSubscription() {
    chrome.storage.local.get([
      "username",
      "companyId",
      "idToken",
      "subscription_verified",
      "subscription_expiry",
      "subscription_duration"
    ], (data) => {
      const userDisplay = document.getElementById("user-display-name");
      if (userDisplay) {
        userDisplay.textContent = data.username ? data.username : "-";
      }

      // Load user-specific settings
      switchActiveUserAutofill(data.username);


      if (!data.username) {
        // Not logged in
        if (authLoginOverlay) authLoginOverlay.classList.add("show");
        if (subscriptionLockOverlay) subscriptionLockOverlay.classList.remove("show");
        
        const subInfoBlock = document.getElementById("sidebar-sub-info");
        const switchBtn = document.getElementById("btn-switch-account");
        if (subInfoBlock) subInfoBlock.style.display = "none";
        if (switchBtn) switchBtn.style.display = "none";
      } else {
        // Logged in. Check subscription.
        if (authLoginOverlay) authLoginOverlay.classList.remove("show");
        
        const subInfoBlock = document.getElementById("sidebar-sub-info");
        const switchBtn = document.getElementById("btn-switch-account");
        if (subInfoBlock) subInfoBlock.style.display = "flex";
        if (switchBtn) switchBtn.style.display = "inline-flex";

        // Load 6R Records, Company Details, and Bank Accounts
        restoreNewUserRecords(data.username);
        loadCompanyDetailsFromCloud(data.username);
        syncBankAccountsFromCloud(data.username, data.companyId);

        const isVerified = data.subscription_verified === true;
        const isNotExpired = data.subscription_expiry ? (data.subscription_expiry > Date.now()) : false;

        if (isVerified && isNotExpired) {
          // Fully authorized
          if (subscriptionLockOverlay) subscriptionLockOverlay.classList.remove("show");
          updateCountdown(data.subscription_expiry, data.subscription_duration);
        } else {
          // Locked locally - fetch from Firestore to see if user has subscribed on another device
          syncSubscriptionFromDatabase(data.username, () => {
            // Re-verify after sync attempt
            chrome.storage.local.get(["subscription_verified", "subscription_expiry", "subscription_duration"], (newData) => {
              if (newData.subscription_verified === true && newData.subscription_expiry > Date.now()) {
                if (subscriptionLockOverlay) subscriptionLockOverlay.classList.remove("show");
                updateCountdown(newData.subscription_expiry, newData.subscription_duration);
              } else {
                if (subscriptionLockOverlay) subscriptionLockOverlay.classList.add("show");
                updateVerifyButtonState();
              }
            });
          });
        }
      }
    });
  }

  // Tab switching for Login / Signup
  const tabLoginBtn = document.getElementById("tab-login-btn");
  const tabSignupBtn = document.getElementById("tab-signup-btn");
  const loginFormView = document.getElementById("login-form-view");
  const signupFormView = document.getElementById("signup-form-view");

  if (tabLoginBtn && tabSignupBtn && loginFormView && signupFormView) {
    tabLoginBtn.addEventListener("click", () => {
      loginFormView.style.display = "flex";
      signupFormView.style.display = "none";
      tabLoginBtn.style.color = "#f8fafc";
      tabLoginBtn.style.borderBottom = "2px solid #3b82f6";
      tabSignupBtn.style.color = "#64748b";
      tabSignupBtn.style.borderBottom = "2px solid transparent";
    });

    tabSignupBtn.addEventListener("click", () => {
      loginFormView.style.display = "none";
      signupFormView.style.display = "flex";
      tabSignupBtn.style.color = "#f8fafc";
      tabSignupBtn.style.borderBottom = "2px solid #3b82f6";
      tabLoginBtn.style.color = "#64748b";
      tabLoginBtn.style.borderBottom = "2px solid transparent";
    });
  }

  // Bind Sign Up
  const btnSignupSubmit = document.getElementById("btn-signup-submit");
  if (btnSignupSubmit) {
    btnSignupSubmit.addEventListener("click", async () => {
      const emailInput = document.getElementById("signup-email");
      const passwordInput = document.getElementById("signup-password");
      const signupErrorMsg = document.getElementById("signup-error-msg");

      if (signupErrorMsg) signupErrorMsg.style.display = "none";

      const username = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!username || username.length < 3) {
        if (signupErrorMsg) {
          signupErrorMsg.textContent = "यूज़रनेम कम से कम 3 अक्षरों का होना चाहिए।";
          signupErrorMsg.style.display = "block";
        }
        return;
      }
      if (!password || password.length < 6) {
        if (signupErrorMsg) {
          signupErrorMsg.textContent = "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।";
          signupErrorMsg.style.display = "block";
        }
        return;
      }

      const btnText = btnSignupSubmit.innerHTML;
      btnSignupSubmit.disabled = true;
      btnSignupSubmit.textContent = "Registering...";

      try {
        // Wait for server detection to complete before making API call
        await apiBaseUrlPromise;

        const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        // Safe JSON parsing — server might return HTML on 404/redirect
        const contentType = response.headers.get("content-type") || "";
        let resData = {};
        if (contentType.includes("application/json")) {
          resData = await response.json();
        } else {
          const text = await response.text();
          console.warn("eMandi Register: Non-JSON response from", apiBaseUrl, ":", text.slice(0, 200));
          resData = { success: false, error: `Server error (${response.status}). Check if server is running on ${apiBaseUrl}` };
        }

        btnSignupSubmit.disabled = false;
        btnSignupSubmit.innerHTML = btnText;

        if (response.ok && resData.success) {
          const targetUser = resData.username || username;
          clearLocalSubscriptionData(() => {
            restoreNewUserRecords(targetUser, () => {
              chrome.storage.local.set({
                username: targetUser,
                companyId: "default",
                idToken: ""
              }, () => {
                showToast("Registration successful! Please activate your license code.", "success");
                if (emailInput) emailInput.value = "";
                if (passwordInput) passwordInput.value = "";
                syncSubscriptionFromDatabase(targetUser, () => {
                  checkAuthAndSubscription();
                }, true);
              });
            });
          });
        } else {
          const errMsg = resData.error || "रजिस्ट्रेशन असफल!";
          if (signupErrorMsg) {
            signupErrorMsg.textContent = errMsg;
            signupErrorMsg.style.display = "block";
          }
        }
      } catch (err) {
        btnSignupSubmit.disabled = false;
        btnSignupSubmit.innerHTML = btnText;
        console.error("Signup API error:", err);
        if (signupErrorMsg) {
          signupErrorMsg.textContent = "कनेक्शन एरर! कृपया नेटवर्क की जाँच करें।";
          signupErrorMsg.style.display = "block";
        }
      }
    });
  }

  // Bind Login
  const btnLoginSubmit = document.getElementById("btn-login-submit");
  if (btnLoginSubmit) {
    btnLoginSubmit.addEventListener("click", async () => {
      const usernameInput = document.getElementById("login-username");
      const passwordInput = document.getElementById("login-password");
      const loginErrorMsg = document.getElementById("login-error-msg");

      if (loginErrorMsg) loginErrorMsg.style.display = "none";

      const username = usernameInput ? usernameInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!username || !password) {
        if (loginErrorMsg) {
          loginErrorMsg.textContent = "कृपया यूज़र आईडी और पासवर्ड दोनों दर्ज करें।";
          loginErrorMsg.style.display = "block";
        }
        return;
      }

      const btnText = btnLoginSubmit.innerHTML;
      btnLoginSubmit.disabled = true;
      btnLoginSubmit.textContent = "Logging in...";

      const loginSuccess = (targetUser, companyId) => {
        clearLocalSubscriptionData(() => {
          restoreNewUserRecords(targetUser, () => {
            chrome.storage.local.set({
              username: targetUser,
              companyId: companyId || "default",
              idToken: ""
            }, () => {
              btnLoginSubmit.disabled = false;
              btnLoginSubmit.innerHTML = btnText;
              syncSubscriptionFromDatabase(targetUser, () => {
                checkAuthAndSubscription();
              }, true);
            });
          });
        });
      };

      try {
        // Wait for server detection before making any API call
        await apiBaseUrlPromise;

        const isEmail = username.includes("@");

        // Safe JSON helper
        const safeJson = async (res) => {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) return res.json();
          const txt = await res.text();
          console.warn("eMandi Login: Non-JSON response:", txt.slice(0, 200));
          return { success: false, error: `Server error (${res.status})` };
        };

        // --- Path 1: Simple username → /api/auth/extension-login ---
        if (!isEmail) {
          const extRes = await fetch(`${apiBaseUrl}/api/auth/extension-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });
          const extData = await safeJson(extRes);
          if (extRes.ok && extData.success) {
            loginSuccess(extData.username || username, "default");
            return;
          }

          // Also try company-users/login (for employee accounts)
          const compRes = await fetch(`${apiBaseUrl}/api/company-users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });
          const compData = await safeJson(compRes);
          if (compRes.ok && compData.success) {
            loginSuccess(compData.username || username, compData.companyId || "");
            return;
          }
        }

        // --- Path 2: Email → Firebase Auth ---
        if (isEmail) {
          const apiKey = "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";
          const fbRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username, password, returnSecureToken: true })
          });
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            loginSuccess(fbData.email || username, "default");
            return;
          }
        }

        // All paths failed
        btnLoginSubmit.disabled = false;
        btnLoginSubmit.innerHTML = btnText;
        if (loginErrorMsg) {
          loginErrorMsg.textContent = "ग़लत यूज़र आईडी या पासवर्ड!";
          loginErrorMsg.style.display = "block";
        }
      } catch (err) {
        btnLoginSubmit.disabled = false;
        btnLoginSubmit.innerHTML = btnText;
        console.error("Login API error:", err);
        if (loginErrorMsg) {
          loginErrorMsg.textContent = "कनेक्शन एरर! कृपया नेटवर्क की जाँच करें।";
          loginErrorMsg.style.display = "block";
        }
      }
    });
  }

  // Bind Logout
  const authLogoutLink = document.getElementById("auth-logout-link");
  if (authLogoutLink) {
    authLogoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      backupCurrentUserRecords(() => {
        switchActiveUserAutofill(null, () => {
          chrome.storage.local.remove([
            "username",
            "companyId",
            "idToken",
            "subscription_verified",
            "subscription_expiry",
            "subscription_duration",
            "generated_subscription_code",
            "pending_duration",
            "emandi_records"
          ], () => {
            checkAuthAndSubscription();
          });
        });
      });
    });
  }


  // Selected plan state
  let selectedPlan = "trial";

  const planCards = document.querySelectorAll(".plan-card");
  const adminTestingPill = document.querySelector(".plan-card-testing");

  if (planCards.length > 0) {
    planCards.forEach(card => {
      card.addEventListener("click", () => {
        // Reset styles for regular cards
        planCards.forEach(c => {
          c.style.border = "1px solid var(--border-color)";
          c.style.background = "rgba(255, 255, 255, 0.02)";
          c.classList.remove("active-plan");
        });
        
        // Reset admin testing pill
        if (adminTestingPill) {
          adminTestingPill.style.borderColor = "rgba(255, 255, 255, 0.15)";
          adminTestingPill.style.color = "var(--text-dark)";
          adminTestingPill.style.background = "none";
        }

        // Apply active style to clicked card
        card.style.border = "1.5px solid var(--primary)";
        card.style.background = "rgba(245, 158, 11, 0.08)";
        card.classList.add("active-plan");

        selectedPlan = card.getAttribute("data-value");
      });
    });
  }

  if (adminTestingPill) {
    adminTestingPill.addEventListener("click", () => {
      // Reset regular cards
      planCards.forEach(c => {
        c.style.border = "1px solid var(--border-color)";
        c.style.background = "rgba(255, 255, 255, 0.02)";
        c.classList.remove("active-plan");
      });

      // Apply style to testing pill
      adminTestingPill.style.borderColor = "var(--primary)";
      adminTestingPill.style.color = "var(--primary)";
      adminTestingPill.style.background = "rgba(245, 158, 11, 0.05)";

      selectedPlan = adminTestingPill.getAttribute("data-value");
    });
  }

  // Generate Subscription Code
  const btnGenerateCode = document.getElementById("btn-generate-code");
  if (btnGenerateCode) {
    btnGenerateCode.addEventListener("click", async () => {
      chrome.storage.local.get(["username", "companyId", "idToken"], async (data) => {
        if (!data.username) return;

        const duration = selectedPlan || "trial";

        // One-time Free Trial check
        if (duration === "trial") {
          const trialKey = `free_trial_used_${data.username}`;
          chrome.storage.local.get(trialKey, (trialData) => {
            if (trialData[trialKey] === true) {
              showToast("You have already used your 1 Month Free Trial.", "warning");
              return;
            }
            proceedWithCodeGeneration(data, duration);
          });
        } else {
          proceedWithCodeGeneration(data, duration);
        }
      });
    });
  }

  function proceedWithCodeGeneration(data, duration) {
    const btnGenerateCode = document.getElementById("btn-generate-code");
    if (!btnGenerateCode) return;

    // Set Loading state
    const originalText = btnGenerateCode.innerHTML;
    btnGenerateCode.disabled = true;
    btnGenerateCode.textContent = "Subscribing...";

    // Generate dynamic code based on duration
    // IMPORTANT: Code length determines subscription duration on server:
    // 5 digits = 1 month | 7 digits = 1 year | 9 digits = lifetime
    let digits = 5;
    if (duration === "testing") digits = 3;
    else if (duration === "trial") digits = 5;   // 5 digits = 1 month (free trial)
    else if (duration === "monthly") digits = 5;  // 5 digits = 1 month
    else if (duration === "yearly") digits = 7;   // 7 digits = 1 year
    else if (duration === "lifetime") digits = 9; // 9 digits = lifetime

    let code = "";
    for (let i = 0; i < digits; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }

    // Store generated code and duration
    chrome.storage.local.set({
      generated_subscription_code: code,
      pending_duration: duration
    }, async () => {
      updateVerifyButtonState();
      // Send notification email to RDSAAB1@GMAIL.COM using /api/auth/send-subscription-request
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/send-subscription-request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: data.username,
            companyName: data.companyId || "eMandi Extension User",
            planId: duration,
            code: code,
            source: "emandi"
          })
        });

        if (response.ok) {
          showToast("Pay on this UPI and then contact this number and get code to activate this powerful tool.", "success");
        } else {
          const errTxt = await response.text();
          console.warn("Send email API response warning:", errTxt);
          showToast("Code generated, but email could not be sent. Check email settings.", "warning");
        }
      } catch (err) {
        console.error("Send email error:", err);
        showToast("Network error: Code generated but email could not be sent.", "warning");
      } finally {
        // Restore button state
        btnGenerateCode.disabled = false;
        btnGenerateCode.innerHTML = originalText;
      }
      
      // Debug fallback
      console.log(`[SUBSCRIPTION DEBUG] Generated code for ${duration}: ${code}`);
    });
  }

  // Verify Code
  const btnVerifyCode = document.getElementById("btn-verify-code");
  if (btnVerifyCode) {
    btnVerifyCode.addEventListener("click", () => {
      const codeInput = document.getElementById("subscription-code");
      const enteredCode = codeInput ? codeInput.value.trim() : "";
      const activationErrorMsg = document.getElementById("activation-error-msg");

      if (activationErrorMsg) activationErrorMsg.style.display = "none";

      if (!enteredCode) {
        if (activationErrorMsg) {
          activationErrorMsg.textContent = "Please enter the activation code.";
          activationErrorMsg.style.display = "block";
        }
        return;
      }

      chrome.storage.local.get(["generated_subscription_code", "pending_duration", "username"], async (data) => {
        if (!data.generated_subscription_code) {
          if (activationErrorMsg) {
            activationErrorMsg.textContent = "Please click 'Generate Code' first.";
            activationErrorMsg.style.display = "block";
          }
          return;
        }

        // Disable button while verifying
        const originalBtnText = btnVerifyCode.innerHTML;
        btnVerifyCode.disabled = true;
        btnVerifyCode.textContent = "Verifying...";

        const duration = data.pending_duration || "monthly";
        let durationMs = 30 * 24 * 60 * 60 * 1000;
        if (duration === "testing") durationMs = 1 * 60 * 1000;
        else if (duration === "trial") durationMs = 30 * 24 * 60 * 60 * 1000;
        else if (duration === "monthly") durationMs = 30 * 24 * 60 * 60 * 1000;
        else if (duration === "yearly") durationMs = 365 * 24 * 60 * 60 * 1000;
        else if (duration === "lifetime") durationMs = 99999 * 24 * 60 * 60 * 1000;

        const expiry = Date.now() + durationMs;
        const cleanUser = data.username ? String(data.username).trim() : "";

        // Step 1: Always save locally first (so activation works even offline)
        const localMatch = enteredCode === data.generated_subscription_code;
        if (!localMatch) {
          // Before rejecting, try server-side verification
          // (Admin may have given a code via verify-code API with different code)
          let serverVerified = false;
          try {
            const svRes = await fetch(`${apiBaseUrl}/api/auth/verify-code`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: cleanUser, code: enteredCode })
            });
            const svData = await svRes.json();
            if (svData.success) {
              serverVerified = true;
              // Server already saved to Firestore. Now sync locally.
              const svExpiry = svData.subscription?.expiryMs || expiry;
              const svDuration = svData.subscription?.duration || duration;
              const keysToSet = {
                subscription_verified: true,
                subscription_expiry: svExpiry,
                subscription_duration: svDuration
              };
              if (svDuration === "trial" && cleanUser) keysToSet[`free_trial_used_${cleanUser}`] = true;
              chrome.storage.local.set(keysToSet, () => {
                btnVerifyCode.disabled = false;
                btnVerifyCode.innerHTML = originalBtnText;
                showToast("License activation successful! Extension unlocked.", "success");
                if (codeInput) codeInput.value = "";
                checkAuthAndSubscription();
              });
            }
          } catch (e) {
            console.warn("Server verify-code failed:", e);
          }

          if (!serverVerified) {
            btnVerifyCode.disabled = false;
            btnVerifyCode.innerHTML = originalBtnText;
            if (activationErrorMsg) {
              activationErrorMsg.textContent = "Invalid code! Please enter the correct code.";
              activationErrorMsg.style.display = "block";
            }
          }
          return;
        }

        // Local code matched — activate locally immediately
        const keysToSet = {
          subscription_verified: true,
          subscription_expiry: expiry,
          subscription_duration: duration
        };
        if (duration === "trial" && cleanUser) {
          keysToSet[`free_trial_used_${cleanUser}`] = true;
        }

        chrome.storage.local.set(keysToSet, async () => {
          btnVerifyCode.disabled = false;
          btnVerifyCode.innerHTML = originalBtnText;
          showToast("License activation successful! Extension unlocked.", "success");
          if (codeInput) codeInput.value = "";
          checkAuthAndSubscription();

          if (!cleanUser) return;
          const lowerUser = cleanUser.toLowerCase();

          // Step 2: Try server verify-code endpoint first — it saves to Firestore internally
          let savedViaServer = false;
          try {
            console.log("eMandi: Verifying code with server for Firestore save:", cleanUser);
            const svRes = await fetch(`${apiBaseUrl}/api/auth/verify-code`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: lowerUser, code: enteredCode })
            });
            const svData = await svRes.json();
            if (svData.success) {
              savedViaServer = true;
              console.log("eMandi: Firestore subscription saved via server verify-code ✅");
            } else {
              console.warn("eMandi: Server verify-code returned failure:", svData.error);
            }
          } catch (err) {
            console.warn("eMandi: Server verify-code call failed:", err);
          }

          // Step 3: Fallback — if server verify-code failed, call /api/subscription/save directly
          if (!savedViaServer) {
            try {
              console.log("eMandi: Falling back to /api/subscription/save for:", cleanUser);
              const saveRes = await fetch(`${apiBaseUrl}/api/subscription/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  username: lowerUser,
                  username_lower: lowerUser,
                  subscription_verified: true,
                  subscription_expiry: expiry,
                  subscription_duration: duration,
                  plan_label: duration === "lifetime" ? "Lifetime Plan" : duration === "yearly" ? "1 Year Plan" : "1 Month Plan",
                  activated_at: new Date().toISOString()
                })
              });
              const saveJson = await saveRes.json();
              if (saveJson.success) {
                console.log("eMandi: Firestore subscription saved via /api/subscription/save ✅");
              } else {
                console.error("eMandi: /api/subscription/save failed:", saveJson.error);
              }
            } catch (err) {
              console.error("eMandi: Both cloud save attempts failed:", err);
            }
          }
        });
      });
    });
  }


  // Restore active subscription from cloud button
  const btnSyncCloudSub = document.getElementById("btn-sync-cloud-sub");
  if (btnSyncCloudSub) {
    btnSyncCloudSub.addEventListener("click", () => {
      chrome.storage.local.get("username", (data) => {
        if (!data.username) {
          showToast("Please log in first.", "warning");
          return;
        }
        btnSyncCloudSub.disabled = true;
        btnSyncCloudSub.textContent = "Checking Cloud...";
        
        syncSubscriptionFromDatabase(data.username, (found) => {
          btnSyncCloudSub.disabled = false;
          btnSyncCloudSub.innerHTML = `
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"></path></svg>
            🔄 Restore Active Subscription from Cloud
          `;
          if (found) {
            showToast("Active subscription restored from Cloud! App unlocked.", "success");
            checkAuthAndSubscription();
          } else {
            showToast("No active subscription found on Cloud for username: " + data.username, "error");
          }
        }, true);
      });
    });
  }

  // Bind Switch Account
  const btnSwitchAccount = document.getElementById("btn-switch-account");
  if (btnSwitchAccount) {
    btnSwitchAccount.addEventListener("click", () => {
      lastLoadedUserForCompanyProfile = "";
      lastLoadedUserForBankAccounts = "";
      if (window.CloudSyncModule) window.CloudSyncModule.resetCache();
      backupCurrentUserRecords(() => {
        chrome.storage.local.remove([
          "username",
          "companyId",
          "idToken",
          "subscription_verified",
          "subscription_expiry",
          "subscription_duration",
          "generated_subscription_code",
          "pending_duration",
          "emandi_records",
          "company_profile"
        ], () => {
          checkAuthAndSubscription();
        });
      });
    });
  }

  // Initial check on load and set periodic check (every 5 seconds)
  checkAuthAndSubscription();
  setInterval(checkAuthAndSubscription, 5000);
  
  // Set periodic countdown checker (every 1 second)
  setInterval(() => {
    chrome.storage.local.get(["subscription_expiry", "subscription_duration"], (data) => {
      if (data.subscription_expiry) {
        updateCountdown(data.subscription_expiry, data.subscription_duration);
      }
    });
  }, 1000);
  
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
  const btnClearTable = document.getElementById("btn-clear-table");
  const btnPasteF1 = document.getElementById("btn-paste-f1");
  const btnPasteF2 = document.getElementById("btn-paste-f2");
  const btnProcessManual = document.getElementById("btn-process-manual");
  const btnClearWorkspace = document.getElementById("btn-clear-workspace");
  const btnClearConsoleLogs = document.getElementById("btn-clear-console-logs");
  const btnViewAllTable = document.getElementById("btn-view-all-table");
  const searchDbInput = document.getElementById("search-db-input");

  if (btnStart) {
    btnStart.addEventListener("click", () => {
      const isResume = btnStart.getAttribute("data-mode") === "resume";
      chrome.storage.local.set({ 
        isUserInitiatedScrape: true,
        isResumeRun: isResume
      }, () => {
        startExtraction();
      });
    });
  }
  if (btnReset) btnReset.addEventListener("click", resetScraperRange);
  if (btnExport) btnExport.addEventListener("click", exportDataToCSV);
  if (btnClear) btnClear.addEventListener("click", clearStorage);
  if (btnClearTable) btnClearTable.addEventListener("click", clearStorage);
  if (btnProcessManual) btnProcessManual.addEventListener("click", processManualWorkspace);
  
  const btnStop = document.getElementById("btn-stop");
  if (btnStop) btnStop.addEventListener("click", stopExtraction);

  // Date inputs are pre-filled automatically below
  const scrapeDateFromEl = document.getElementById("scrape-date-from");
  const scrapeDateToEl = document.getElementById("scrape-date-to");
  if (scrapeDateFromEl && scrapeDateToEl && !scrapeDateFromEl.value && !scrapeDateToEl.value) {
    const pad = (n) => String(n).padStart(2, '0');
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    scrapeDateToEl.value = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
    scrapeDateFromEl.value = `${pad(threeMonthsAgo.getDate())}/${pad(threeMonthsAgo.getMonth() + 1)}/${threeMonthsAgo.getFullYear()}`;
  }
  
  setupCustomDatePicker("scrape-date-from");
  setupCustomDatePicker("scrape-date-to");
  
  if (btnClearWorkspace) {
    btnClearWorkspace.addEventListener("click", () => {
      document.getElementById("workspace-f1").value = "";
      document.getElementById("workspace-f2").value = "";
      saveWorkspaceState();
    });
  }

  if (btnClearConsoleLogs) {
    btnClearConsoleLogs.addEventListener("click", () => {
      const consoleLog = document.getElementById("console-log");
      if (consoleLog) consoleLog.textContent = "Logs cleared. Ready.";
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

  if (txtF1) txtF1.addEventListener("input", saveWorkspaceState);
  if (txtF2) txtF2.addEventListener("input", saveWorkspaceState);
  if (startInput) startInput.addEventListener("input", saveWorkspaceState);
  if (endInput) endInput.addEventListener("input", saveWorkspaceState);

  // Paste Buttons Logic
  if (btnPasteF1) {
    btnPasteF1.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (txtF1) txtF1.value = text;
        logToConsole("Field 1 (मंडी वाउचर) में क्लिपबोर्ड से डेटा पेस्ट किया गया।");
        saveWorkspaceState();
      } catch (err) {
        logToConsole("[WARN] क्लिपबोर्ड पढ़ने में असमर्थ: " + err.message);
      }
    });
  }

  if (btnPasteF2) {
    btnPasteF2.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (txtF2) txtF2.value = text;
        logToConsole("Field 2 (भुगतान विवरण) में क्लिपबोर्ड से डेटा पेस्ट किया गया।");
        saveWorkspaceState();
      } catch (err) {
        logToConsole("[WARN] क्लिपबोर्ड पढ़ने में असमर्थ: " + err.message);
      }
    });
  }

  // Listen for progress, logs and real-time pasting from content.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "log") {
      lastProgressUpdateTime = Date.now();
      logToConsole(message.message);
    } else if (message.action === "progress") {
      lastProgressUpdateTime = Date.now();
      updateProgress(message.percent, message.status);
      
      // Hide Resume button if it became visible during idle
      const btnStart = document.getElementById("btn-start");
      if (btnStart && isScrapingActive) {
        btnStart.style.display = "none";
      }
    } else if (message.action === "pasteToField") {
      lastProgressUpdateTime = Date.now();
      if (message.field === 1 && txtF1) {
        txtF1.value = message.text;
        logToConsole("वाउचर डेटा स्वचालित रूप से Field 1 में पेस्ट हुआ।");
      } else if (message.field === 2 && txtF2) {
        txtF2.value = message.text;
        logToConsole("भुगतान विवरण डेटा स्वचालित रूप से Field 2 में पेस्ट हुआ।");
      }
      saveWorkspaceState();
    } else if (message.action === "startScrapeFromRange") {
      console.log("eMandi Dashboard: Received startScrapeFromRange message:", message);
      const existingStart = startInput ? startInput.value.trim() : "";
      const existingEnd = endInput ? endInput.value.trim() : "";
      
      if (!existingStart && startInput) {
        startInput.value = message.prapatraStart;
      }
      if (!existingEnd && endInput) {
        endInput.value = message.prapatraEnd;
      }
      saveWorkspaceState();
      
      logToConsole(`[AUTO-RUN] Automatic date range search finished. Detected table range: ${message.prapatraStart} to ${message.prapatraEnd}`);
      logToConsole("[AUTO-RUN] Starting scraping...");
      startExtraction();
    }
  });

  // Listen to storage changes to update UI in real-time (reactive)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.workspace_f1 && txtF1) {
        txtF1.value = changes.workspace_f1.newValue || "";
      }
      if (changes.workspace_f2 && txtF2) {
        txtF2.value = changes.workspace_f2.newValue || "";
      }
      if (changes.console_logs) {
        const consoleLog = document.getElementById("console-log");
        if (consoleLog) {
          consoleLog.textContent = changes.console_logs.newValue || "";
          consoleLog.scrollTop = consoleLog.scrollHeight;
        }
      }
      if (changes.progress_percent) {
        const pBar = document.getElementById("progress-bar");
        const pPercent = document.getElementById("progress-percent");
        const newPercent = changes.progress_percent.newValue || 0;
        if (pBar) pBar.style.width = newPercent + "%";
        if (pPercent) pPercent.innerText = newPercent + "%";
        if (newPercent === 100 || newPercent === "100") {
          updateStartButtonState("Completed");
        }
      }
      if (changes.progress_status) {
        const pStatus = document.getElementById("progress-status");
        const newStatus = changes.progress_status.newValue || "";
        if (pStatus) pStatus.innerText = newStatus;
        updateStartButtonState(newStatus);
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

  // Load saved Portal Autofill & Captcha Settings (scoped to current user)
  chrome.storage.local.get("username", (data) => {
    switchActiveUserAutofill(data.username);
  });

  const btnToggleLock = document.getElementById("btn-toggle-lock-api");
  const ocrInput = document.getElementById("ocr-api-key");
  const lockIcon = document.getElementById("lock-icon");
  const lockText = document.getElementById("lock-text");

  if (btnToggleLock && ocrInput) {
    btnToggleLock.addEventListener("click", () => {
      const isLocked = ocrInput.hasAttribute("disabled");
      if (isLocked) {
        // Unlock field for editing
        ocrInput.removeAttribute("disabled");
        ocrInput.setAttribute("type", "text");
        lockIcon.innerText = "🔓";
        lockText.innerText = "Lock & Hide";
      } else {
        // Lock and hide field
        ocrInput.setAttribute("disabled", "true");
        ocrInput.setAttribute("type", "password");
        lockIcon.innerText = "🔒";
        lockText.innerText = "Unlock";
      }
    });
  }

  const btnSaveCreds = document.getElementById("btn-save-credentials");
  if (btnSaveCreds) {
    btnSaveCreds.addEventListener("click", () => {
      const email = document.getElementById("autofill-email").value.trim();
      const password = document.getElementById("autofill-password").value.trim();
      const apiKey = ocrInput ? ocrInput.value.trim() : "";
      
      chrome.storage.local.get("username", (data) => {
        const username = data.username ? String(data.username).trim() : "";
        const saveObj = {
          portal_email: email,
          portal_password: password,
          ocr_api_key: apiKey
        };
        
        // Also save user-scoped copy
        if (username) {
          saveObj[`portal_email_${username}`] = email;
          saveObj[`portal_password_${username}`] = password;
          saveObj[`ocr_api_key_${username}`] = apiKey;
        }

        chrome.storage.local.set(saveObj, () => {
          // Auto-lock and hide key after successful save
          if (ocrInput) {
            ocrInput.setAttribute("disabled", "true");
            ocrInput.setAttribute("type", "password");
            if (lockIcon) lockIcon.innerText = "🔒";
            if (lockText) lockText.innerText = "Unlock";
          }
          alert("लॉगिन जानकारी और एपीआई कुंजी सफलतापूर्वक सुरक्षित कर ली गई है!");
        });
      });
    });
  }

});





function setupCustomDatePicker(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Create popup element
  const popup = document.createElement("div");
  popup.className = "custom-datepicker-popup";
  
  // Position wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "calendar-container";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  wrapper.appendChild(popup);

  let currentDate = new Date();
  let selectedDate = null;

  // Parse input value if valid (DD/MM/YYYY)
  if (input.value) {
    const parts = input.value.split("/");
    if (parts.length === 3) {
      selectedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      currentDate = new Date(selectedDate);
    }
  }

  function render() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // First day of month
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Number of days in month
    const numDays = new Date(year, month + 1, 0).getDate();
    // Number of days in prev month
    const numDaysPrev = new Date(year, month, 0).getDate();

    let html = `
      <div class="datepicker-header">
        <button type="button" class="datepicker-btn prev-btn">◀</button>
        <span class="datepicker-title">${monthNames[month]} ${year}</span>
        <button type="button" class="datepicker-btn next-btn">▶</button>
      </div>
      <div class="datepicker-weekdays">
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>
      <div class="datepicker-days">
    `;

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      html += `<div class="datepicker-day other-month">${numDaysPrev - i}</div>`;
    }

    // Current month days
    const today = new Date();
    for (let i = 1; i <= numDays; i++) {
      let classes = "datepicker-day";
      if (selectedDate && selectedDate.getDate() === i && selectedDate.getMonth() === month && selectedDate.getFullYear() === year) {
        classes += " selected";
      }
      if (today.getDate() === i && today.getMonth() === month && today.getFullYear() === year) {
        classes += " today";
      }
      html += `<div class="${classes}" data-day="${i}">${i}</div>`;
    }

    // Next month days to fill grid (6 rows * 7 days = 42 slots)
    const totalSlots = 42;
    const filledSlots = firstDayIndex + numDays;
    const remainingSlots = totalSlots - filledSlots;
    for (let i = 1; i <= (remainingSlots < 7 ? remainingSlots + 7 : remainingSlots); i++) {
      html += `<div class="datepicker-day other-month">${i}</div>`;
    }

    html += `</div>`;
    popup.innerHTML = html;

    // Add event listeners
    popup.querySelector(".prev-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      currentDate.setMonth(currentDate.getMonth() - 1);
      render();
    });

    popup.querySelector(".next-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      currentDate.setMonth(currentDate.getMonth() + 1);
      render();
    });

    popup.querySelectorAll(".datepicker-day:not(.other-month)").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const day = parseInt(el.getAttribute("data-day"));
        selectedDate = new Date(year, month, day);
        
        const pad = (n) => String(n).padStart(2, '0');
        input.value = `${pad(day)}/${pad(month + 1)}/${year}`;
        
        // Trigger input change events
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        popup.style.display = "none";
      });
    });
  }

  // Show popup on click anywhere in field
  input.addEventListener("click", (e) => {
    e.stopPropagation();
    
    // Close all other custom date pickers first
    document.querySelectorAll(".custom-datepicker-popup").forEach(p => {
      if (p !== popup) p.style.display = "none";
    });

    // Recalculate selected date if input value changed
    if (input.value) {
      const parts = input.value.split("/");
      if (parts.length === 3) {
        selectedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        currentDate = new Date(selectedDate);
      }
    }

    render();
    popup.style.display = "block";
  });

  // Close on click outside
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      popup.style.display = "none";
    }
  });
}

function formatDateToDMY(dateVal) {
  if (!dateVal) return "";
  const parts = dateVal.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateVal;
}

function updateStartButtonState(statusText) {
  const btnStart = document.getElementById("btn-start");
  if (!btnStart) return;

  // Force normal state if progress is at 100%
  const pPercent = document.getElementById("progress-percent");
  if (pPercent && pPercent.innerText.trim() === "100%") {
    btnStart.innerHTML = `
      <svg class="svg-icon" fill="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M8 5v14l11-7z"></path></svg>
      Start Scraper
    `;
    btnStart.style.background = ""; // Reset to default orange theme
    btnStart.style.border = "";
    btnStart.style.color = "";
    btnStart.style.cursor = "pointer";
    btnStart.disabled = false;
    return;
  }

  const text = (statusText || "").trim();

  // Reset to default ready state if empty, ready, completed, or stopped
  if (!text || 
      text.includes("Ready") || 
      text.includes("तैयार है") || 
      text.includes("Completed") || 
      text.includes("पूरा हो गया") || 
      text.includes("System Ready") || 
      text.includes("Stopped") || 
      text.includes("System Stopped") || 
      text.includes("रुकी")) {
    btnStart.innerHTML = `
      <svg class="svg-icon" fill="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M8 5v14l11-7z"></path></svg>
      Start Scraper
    `;
    btnStart.style.background = ""; // Reset to default orange theme
    btnStart.style.border = "";
    btnStart.style.color = "";
    btnStart.style.cursor = "pointer";
    btnStart.disabled = false;
    return;
  }

  // Idle state
  if (text.includes("Idle") || text.includes("Paused")) {
    btnStart.innerHTML = `
      <svg class="svg-icon" fill="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"></path></svg>
      ⚠️ Scraper Idle (Click Resume)
    `;
    btnStart.style.background = "#eab308"; // Amber
    btnStart.style.border = "1.5px solid #d97706";
    btnStart.style.color = "#0f172a";
    btnStart.style.cursor = "pointer";
    btnStart.disabled = false;
    return;
  }

  // Active / Processing state
  btnStart.innerHTML = `
    <svg class="svg-icon" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 8px; animation: spin 1s linear infinite;"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"></path></svg>
    ${text}
  `;
  btnStart.style.background = "#1e293b"; // Dark Slate theme
  btnStart.style.border = "1.5px solid #475569";
  btnStart.style.color = "#94a3b8";
  btnStart.style.cursor = "not-allowed";
  btnStart.disabled = true;
}

function initiateAutoSearchFlow(customFrom = null, customTo = null) {
  console.log("eMandi Dashboard: Initiating auto search flow...");
  
  const saveData = {
    autoRunActive: true,
    autoSearchState: 'init'
  };
  
  if (customFrom && customTo) {
    saveData.customDateFrom = customFrom;
    saveData.customDateTo = customTo;
    logToConsole(`[AUTO-RUN] Initiating auto search flow for custom range: ${customFrom} to ${customTo}...`);
  } else {
    saveData.customDateFrom = "";
    saveData.customDateTo = "";
    logToConsole("[AUTO-RUN] Initiating auto search flow for the last 3 months...");
  }
  
  chrome.storage.local.set(saveData, () => {
    const targetUrl = "https://emandi.up.gov.in/TraderProcessing/SixRList";
    chrome.tabs.query({ url: "*://emandi.up.gov.in/TraderProcessing/SixRList*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        console.log("eMandi Dashboard: eMandi SixRList tab already exists. Reloading in background...");
        logToConsole("[AUTO-RUN] eMandi portal tab already open. Reloading tab in background...");
        chrome.tabs.update(tab.id, { active: false }, () => {
          chrome.tabs.reload(tab.id);
        });
      } else {
        console.log("eMandi Dashboard: Opening eMandi SixRList in a new background tab...");
        logToConsole("[AUTO-RUN] Opening eMandi portal in a background tab...");
        chrome.tabs.create({ url: targetUrl, active: false });
      }
    });
  });
}

let timerInterval = null;
let timerStartTime = 0;
let isScrapingActive = false;
let lastProgressUpdateTime = Date.now();

function startTimer(isResume = false) {
  const timerEl = document.getElementById("progress-timer");
  if (isResume && timerEl && timerEl.innerText !== "00:00") {
    // Parse existing timer display e.g. "01:25"
    const parts = timerEl.innerText.split(":");
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseInt(parts[1], 10) || 0;
      timerStartTime = Date.now() - ((minutes * 60 + seconds) * 1000);
    } else {
      timerStartTime = Date.now();
    }
  } else {
    timerStartTime = Date.now();
    if (timerEl) {
      timerEl.innerText = "00:00";
      timerEl.style.display = "inline";
    }
  }

  // Clear any existing interval
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - timerStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, '0');
    if (timerEl) {
      timerEl.innerText = `${pad(minutes)}:${pad(seconds)}`;
    }

    // Idle progress check (if scraping is active)
    if (isScrapingActive) {
      const idleMs = Date.now() - lastProgressUpdateTime;
      if (idleMs > 25000) { // 25 seconds of silence
        const progressStatus = document.getElementById("progress-status");
        if (progressStatus && !progressStatus.innerText.includes("Idle")) {
          progressStatus.innerText = "⚠️ Scraping Idle. Click Resume to continue.";
        }
        
        // Show Resume button next to Stop button
        const btnStart = document.getElementById("btn-start");
        if (btnStart) {
          btnStart.innerHTML = `<svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg> Resume Scraper`;
          btnStart.style.display = "inline-flex";
          btnStart.disabled = false;
          btnStart.setAttribute("data-mode", "resume");
        }
      }
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetScraperUI() {
  isScrapingActive = false;
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  if (btnStart) {
    btnStart.innerHTML = `<svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg> Start Scraper`;
    btnStart.style.display = "inline-flex";
    btnStart.disabled = false;
    btnStart.removeAttribute("data-mode");
  }
  if (btnStop) {
    btnStop.style.display = "none";
  }
  stopTimer();
}

async function stopExtraction() {
  logToConsole("[INFO] stopping scraper...");
  
  chrome.runtime.sendMessage({ action: "clearTask" }, async () => {
    const emandiTabs = await chrome.tabs.query({ url: "*://emandi.up.gov.in/*" });
    emandiTabs.forEach(t => {
      chrome.tabs.reload(t.id);
    });
    
    resetScraperUI();
    updateProgress(0, "System Stopped");
    logToConsole("[SUCCESS] Scraper stopped successfully.");
  });
}


function logToConsole(message) {
  const consoleLog = document.getElementById("console-log");
  if (consoleLog) {
    consoleLog.textContent += "\n" + message;
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }
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
    const elF1 = document.getElementById("workspace-f1");
    const elF2 = document.getElementById("workspace-f2");
    const startEl = document.getElementById("prapatra-start");
    const endEl = document.getElementById("prapatra-end");
    
    if (data.workspace_f1 && elF1) elF1.value = data.workspace_f1;
    if (data.workspace_f2 && elF2) elF2.value = data.workspace_f2;
    if (data.prapatra_start && startEl) startEl.value = data.prapatra_start;
    if (data.prapatra_end && endEl) endEl.value = data.prapatra_end;
    
    const consoleLog = document.getElementById("console-log");
    if (data.console_logs && consoleLog) {
      consoleLog.textContent = data.console_logs;
    }
    
    const percent = data.progress_percent || 0;
    const statusText = data.progress_status || "तैयार है (System Ready)";
    
    const progressBar = document.getElementById("progress-bar");
    const progressPercent = document.getElementById("progress-percent");
    const progressStatus = document.getElementById("progress-status");
    
    if (progressBar) progressBar.style.width = percent + "%";
    if (progressPercent) progressPercent.innerText = percent + "%";
    if (progressStatus) progressStatus.innerText = statusText;
    
    if (percent === 100 || percent === "100") {
      updateStartButtonState("Completed");
    } else {
      updateStartButtonState(statusText);
    }
  });
}

// Save inputs & log states to local storage
function saveWorkspaceState() {
  const elF1 = document.getElementById("workspace-f1");
  const elF2 = document.getElementById("workspace-f2");
  const consoleLog = document.getElementById("console-log");
  const startEl = document.getElementById("prapatra-start");
  const endEl = document.getElementById("prapatra-end");
  const progressPercent = document.getElementById("progress-percent");
  const progressStatus = document.getElementById("progress-status");

  const f1 = elF1 ? elF1.value : "";
  const f2 = elF2 ? elF2.value : "";
  const logs = consoleLog ? consoleLog.textContent : "";
  const start = startEl ? startEl.value : "";
  const end = endEl ? endEl.value : "";
  const percent = (progressPercent ? parseInt(progressPercent.innerText) : 0) || 0;
  const statusText = progressStatus ? progressStatus.innerText : "";

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
  if (document.getElementById("scrape-date-from")) document.getElementById("scrape-date-from").value = "";
  if (document.getElementById("scrape-date-to")) document.getElementById("scrape-date-to").value = "";
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-percent").innerText = "0%";
  document.getElementById("progress-status").innerText = "तैयार है (Ready)";
  saveWorkspaceState();
}

async function startExtraction() {
  updateProgress(2, "Initializing Scraper...");
  chrome.storage.local.set({
    progress_percent: 2,
    progress_status: "Initializing Scraper..."
  });

  const prapatraStart = document.getElementById("prapatra-start").value.trim();
  const prapatraEnd = document.getElementById("prapatra-end").value.trim();
  const rawDateFrom = document.getElementById("scrape-date-from") ? document.getElementById("scrape-date-from").value.trim() : "";
  const rawDateTo = document.getElementById("scrape-date-to") ? document.getElementById("scrape-date-to").value.trim() : "";
  const scrapeDateFrom = formatDateToDMY(rawDateFrom);
  const scrapeDateTo = formatDateToDMY(rawDateTo);

  // Fetch user initiation state from storage
  const storage = await new Promise(resolve => {
    chrome.storage.local.get({ isUserInitiatedScrape: false, isResumeRun: false }, resolve);
  });
  const isUserInitiated = storage.isUserInitiatedScrape;
  const isResume = storage.isResumeRun;

  // Clear isResumeRun in storage so it doesn't linger
  chrome.storage.local.set({ isResumeRun: false });

  // Get active emandi tabs
  const emandiTabs = await chrome.tabs.query({ url: "*://emandi.up.gov.in/*" });
  if (emandiTabs.length === 0) {
    logToConsole("[INFO] eMandi पोर्टल का कोई टैब नहीं मिला। लॉगिन पेज खोला जा रहा है...");
    chrome.storage.local.set({
      autoRunActive: true,
      autoSearchState: 'init',
      customDateFrom: scrapeDateFrom,
      customDateTo: scrapeDateTo,
      isUserInitiatedScrape: true
    }, () => {
      chrome.tabs.create({ url: "https://emandi.up.gov.in/Account/index", active: true });
      resetScraperUI();
    });
    return;
  }
  
  // Choose the active or first matching tab
  let tab = emandiTabs.find(t => t.active) || emandiTabs[0];
  console.log("eMandi Dashboard: Selected tab for scraping:", tab);

  const tabIsOnSixRList = tab.url && tab.url.includes("SixRList");

  if (isResume && tabIsOnSixRList) {
    console.log("eMandi Dashboard: Resuming scraping on the active SixRList page directly...");
    logToConsole("[INFO] Resuming scraping directly on the loaded page...");
  } else {
    // If the selected tab is on the login page, trigger auto-login and set auto-run active
    const tabIsOnLoginPage = tab.url && (tab.url.includes("Account/index") || tab.url.includes("Account/Index") || tab.url.includes("Traders/Login"));
    if (tabIsOnLoginPage) {
      logToConsole("[INFO] eMandi पोर्टल लॉगिन पेज पर पाया गया। ऑटो-लॉगिन शुरू किया जा रहा है...");
      chrome.storage.local.set({
        autoRunActive: true,
        autoSearchState: 'init',
        customDateFrom: scrapeDateFrom,
        customDateTo: scrapeDateTo,
        isUserInitiatedScrape: true
      }, () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.tabs.reload(tab.id);
      });
      return;
    }

    // If this is a fresh user click and dates are filled: run date search first
    if (isUserInitiated && scrapeDateFrom && scrapeDateTo) {
      // Consume the flag
      await new Promise(resolve => {
        chrome.storage.local.set({ isUserInitiatedScrape: false }, resolve);
      });
      initiateAutoSearchFlow(scrapeDateFrom, scrapeDateTo);
      return;
    }

    // Fallback if Form Range is empty but Date Range is filled
    if (!prapatraStart && !prapatraEnd && scrapeDateFrom && scrapeDateTo) {
      initiateAutoSearchFlow(scrapeDateFrom, scrapeDateTo);
      return;
    }

    if (!prapatraStart || !prapatraEnd) {
      alert("कृपया खोजने के लिए या तो Form Range (From/To) दर्ज करें, या Date Range (From/To) दर्ज करें!");
      logToConsole("[WARN] रेंज या तिथि इनपुट खाली है।");
      resetScraperUI();
      return;
    }
  }

  logToConsole("कनेक्शन चेक किया जा रहा है...");
  isScrapingActive = true;
  lastProgressUpdateTime = Date.now();
  
  // Set this dashboard tab as the active focus tab in background script
  chrome.runtime.sendMessage({ action: "setDashboardActive" }, (res) => {
    if (chrome.runtime.lastError) {
      console.warn("eMandi Dashboard: setDashboardActive message failed:", chrome.runtime.lastError);
    } else {
      console.log("eMandi Dashboard: setDashboardActive sent successfully:", res);
    }
  });

  // If the tab is not on SixRList, redirect it automatically
  if (!tabIsOnSixRList) {
    logToConsole("[INFO] eMandi Tab is on a different page. Redirecting to SixRList page...");
    await new Promise((resolve) => {
      chrome.tabs.update(tab.id, { url: "https://emandi.up.gov.in/TraderProcessing/SixRList" }, () => {
        resolve();
      });
    });
    // Wait for content script to load on the redirected page
    let ready = false;
    let trials = 0;
    while (trials < 30 && !ready) {
      trials++;
      await new Promise(r => setTimeout(r, 500));
      try {
        const response = await new Promise((res) => {
          chrome.tabs.sendMessage(tab.id, { action: "ping" }, (r) => {
            const err = chrome.runtime.lastError;
            res(r);
          });
        });
        if (response && response.status === "ready") {
          ready = true;
        }
      } catch (e) {}
    }
    if (!ready) {
      logToConsole("[ERROR] Redirected tab did not load the scraper script in time.");
      resetScraperUI();
      return;
    }
  }

  const config = {
    prapatraStart,
    prapatraEnd
  };

  logToConsole(`रेंज प्रपत्र-6: ${prapatraStart} से ${prapatraEnd} खोजने का अनुरोध भेजा जा रहा है...`);
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  if (btnStart) btnStart.style.display = "none";
  if (btnStop) btnStop.style.display = "inline-flex";
  startTimer(isResume);

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
        const _ignoredErr1 = chrome.runtime.lastError;
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false },
          files: ["login-helper.js", "content.js"]
        }, () => {
          const _ignoredErr2 = chrome.runtime.lastError;
          console.log("eMandi Dashboard: Script check finished. Proceeding with scrape...");
          setTimeout(() => {
            sendMessageToScrape(tab.id, config);
          }, 400);
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
    resetScraperUI();
    const btnStart = document.getElementById("btn-start");
    if (btnStart) btnStart.disabled = false;
    
    if (chrome.runtime.lastError) {
      const errMsg = chrome.runtime.lastError.message || "Unknown communication status";
      console.log("eMandi Dashboard: Message response status:", errMsg);
      
      if (errMsg.includes("Extension context invalidated")) {
        logToConsole("[WARN] एक्सटेंशन अपडेट हुआ है। eMandi पेज को रिफ्रेश किया जा रहा है...");
        alert("एक्सटेंशन का नया वर्शन लोड हुआ है! eMandi पेज को अपने-आप रिफ्रेश किया जा रहा है। रिफ्रेश होने के बाद 'स्क्रैप शुरू करें' पर फिर से क्लिक करें।");
        chrome.tabs.reload(tabId);
      } else if (errMsg.includes("message port closed") || errMsg.includes("receiving end does not exist")) {
        logToConsole("[INFO] स्क्रैपिंग प्रक्रिया बैकग्राउंड में चालू है (डेटा लाइव सेव हो रहा है)...");
      } else {
        logToConsole("[INFO] स्टेटस: " + errMsg);
      }
      return;
    }

    if (response && response.success) {
      if (response.count > 0) {
        logToConsole(`[SUCCESS] सफलतापूर्वक ${response.count} रिकॉर्ड्स का डेटा संकलित कर लिया गया है।`);
        await saveScrapedData(response.data);
        
        // Auto Clear workspace inputs and cache since parsing is completed
        console.log("eMandi Dashboard: Auto-clearing fields and storage cache...");
        const elF1 = document.getElementById("workspace-f1");
        const elF2 = document.getElementById("workspace-f2");
        if (elF1) elF1.value = "";
        if (elF2) elF2.value = "";
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

function cleanPrapatraNumber(str) {
  if (!str) return "";
  const match = String(str).match(/\b\d{5,}\([^)]+\)\/6P\/\d+\b|\b\d+.*\/6P\/\d+\b/i);
  if (match) return match[0].trim();
  return String(str).replace(/क्रम\s*संख्या|Serial\s*No/gi, "").replace(/[\s\u00A0]+/g, " ").trim();
}

function normalizePrapatraKey(str) {
  if (!str) return "";
  const cleaned = cleanPrapatraNumber(str);
  return cleaned.replace(/[\s\u00A0]+/g, "").trim().toLowerCase();
}

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
    const cropRowMatch = cleanCropText.match(/([^\d\n\r]+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/);
    if (cropRowMatch) {
      const cleanNum = (val) => parseFloat(String(val).replace(/,/g, "")) || 0;
      data.qty = cleanNum(cropRowMatch[2]).toFixed(2);
      data.rate = cleanNum(cropRowMatch[3]);
      data.amt = cleanNum(cropRowMatch[4]);
      data.fee = cleanNum(cropRowMatch[6]);
      data.cess = cleanNum(cropRowMatch[7]);
      data.total = cleanNum(cropRowMatch[8]);
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

// Robust helper to parse various date formats in dashboard.js
function parseDateString(dateStr) {
  if (!dateStr || dateStr === "-") return null;
  const trimmed = dateStr.trim();
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (ymdMatch) {
    return new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

// Convert MM-DD-YYYY or YYYY-MM-DD to DD/MM/YYYY
function formatDisplayDate(dateStr) {
  if (!dateStr || dateStr === "-") return "-";
  const trimmed = dateStr.trim();
  
  // Match MM-DD-YYYY or MM/DD/YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mdyMatch) {
    const month = mdyMatch[1].padStart(2, '0');
    const day = mdyMatch[2].padStart(2, '0');
    const year = mdyMatch[3];
    return `${day}/${month}/${year}`;
  }
  
  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }
  
  return dateStr;
}

// Robust helper to extract numeric suffix of voucher serial numbers
function getNumericSerial(voucherNo) {
  if (!voucherNo) return null;
  if (/^\d+$/.test(voucherNo)) return parseInt(voucherNo, 10);
  const match = voucherNo.match(/(\d+)\s*$/) || voucherNo.match(/(\d+)[^0-9]*$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Global helper to filter records based on search, dates, serial numbers, and UTR Type
function getFilteredRecords(rawRecords) {
  const searchInput = document.getElementById("search-db-input");
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filterDateFrom = document.getElementById("filter-date-from") ? document.getElementById("filter-date-from").value : "";
  const filterDateTo = document.getElementById("filter-date-to") ? document.getElementById("filter-date-to").value : "";
  const filterSrFrom = document.getElementById("filter-sr-from") ? document.getElementById("filter-sr-from").value.trim() : "";
  const filterSrTo = document.getElementById("filter-sr-to") ? document.getElementById("filter-sr-to").value.trim() : "";
  const filterUtrType = document.getElementById("filter-utr-type") ? document.getElementById("filter-utr-type").value : "ALL";

  const data = deduplicateRecords(rawRecords);
  return data.filter(row => {
    const tc = parseRawFields(row.printDetails?.rawText || "", row.paymentDetails?.rawText || "");
    const nameMatch = (tc.farmerDetails || "").toLowerCase().includes(searchQuery);
    const noMatch = (tc.prapatraNumber || "").toLowerCase().includes(searchQuery);
    if (!nameMatch && !noMatch) return false;

    // 1. Date Filters
    if (filterDateFrom || filterDateTo) {
      const dateVal = tc.date || row.date || "";
      const recDate = parseDateString(dateVal);
      if (recDate) {
        const recDateOnly = new Date(recDate.getFullYear(), recDate.getMonth(), recDate.getDate());
        if (filterDateFrom) {
          const fromParts = filterDateFrom.split("-");
          const fromD = new Date(parseInt(fromParts[0]), parseInt(fromParts[1]) - 1, parseInt(fromParts[2]));
          if (recDateOnly < fromD) return false;
        }
        if (filterDateTo) {
          const toParts = filterDateTo.split("-");
          const toD = new Date(parseInt(toParts[0]), parseInt(toParts[1]) - 1, parseInt(toParts[2]));
          if (recDateOnly > toD) return false;
        }
      } else {
        return false;
      }
    }

    // 2. Serial Filters
    if (filterSrFrom || filterSrTo) {
      const entryNum = getNumericSerial(tc.prapatraNumber || row.prapatraNumber);
      if (entryNum !== null) {
        const fromNum = filterSrFrom ? parseInt(filterSrFrom, 10) : null;
        const toNum = filterSrTo ? parseInt(filterSrTo, 10) : null;
        if (fromNum !== null && !isNaN(fromNum) && entryNum < fromNum) return false;
        if (toNum !== null && !isNaN(toNum) && entryNum > toNum) return false;
      } else {
        const rawNo = tc.prapatraNumber || row.prapatraNumber || "";
        if (filterSrFrom && rawNo < filterSrFrom) return false;
        if (filterSrTo && rawNo > filterSrTo) return false;
      }
    }

    // 3. UTR Type Filters
    if (filterUtrType && filterUtrType !== "ALL") {
      const rawUtr = tc.utr || row.utr || "";
      const cleanedDigits = String(rawUtr).replace(/\D/g, ""); // extract only numeric characters

      if (filterUtrType === "TRANSFER") {
        // Show only if UTR contains 7 digits or fewer
        if (cleanedDigits.length > 7) return false;
      } else if (filterUtrType === "RTGS") {
        // Show only if UTR contains more than 7 digits
        if (cleanedDigits.length <= 7) return false;
      }
    }

    return true;
  });
}

// Dynamic modern calendar popover initializer
function initCustomDatePicker(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const popover = document.createElement("div");
  popover.className = "custom-calendar-popover";
  input.parentNode.appendChild(popover);

  let currentDate = new Date();

  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    popover.innerHTML = `
      <div class="calendar-header">
        <button class="calendar-nav-btn prev-month" style="font-weight: bold;">&larr;</button>
        <span class="calendar-month-year">${monthNames[month]} ${year}</span>
        <button class="calendar-nav-btn next-month" style="font-weight: bold;">&rarr;</button>
      </div>
      <div class="calendar-weekdays">
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>
      <div class="calendar-days"></div>
    `;

    const daysContainer = popover.querySelector(".calendar-days");

    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "calendar-day empty";
      daysContainer.appendChild(emptyCell);
    }

    const today = new Date();
    const selectedVal = input.value;
    const selectedDate = selectedVal ? parseDateString(selectedVal) : null;

    for (let day = 1; day <= lastDay; day++) {
      const cell = document.createElement("div");
      cell.className = "calendar-day";
      cell.textContent = day;

      const cellDate = new Date(year, month, day);

      if (cellDate.toDateString() === today.toDateString()) {
        cell.classList.add("today");
      }

      if (selectedDate && cellDate.toDateString() === selectedDate.toDateString()) {
        cell.classList.add("selected");
      }

      cell.addEventListener("click", (e) => {
        e.stopPropagation();
        input.value = formatDate(cellDate);
        popover.style.display = "none";
        input.dispatchEvent(new Event("change"));
      });

      daysContainer.appendChild(cell);
    }

    popover.querySelector(".prev-month").addEventListener("click", (e) => {
      e.stopPropagation();
      currentDate.setMonth(month - 1);
      renderCalendar();
    });

    popover.querySelector(".next-month").addEventListener("click", (e) => {
      e.stopPropagation();
      currentDate.setMonth(month + 1);
      renderCalendar();
    });
  }

  input.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".custom-calendar-popover").forEach(p => {
      if (p !== popover) p.style.display = "none";
    });

    if (popover.style.display === "block") {
      popover.style.display = "none";
    } else {
      popover.style.display = "block";
      const val = input.value;
      if (val) {
        currentDate = parseDateString(val) || new Date();
      } else {
        currentDate = new Date();
      }
      renderCalendar();
    }
  });

  document.addEventListener("click", (e) => {
    if (!popover.contains(e.target) && e.target !== input) {
      popover.style.display = "none";
    }
  });
}

// Render dynamic table rows with searching and formatting
function renderPreviewTable() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const rawData = result.emandi_records || [];
    const filteredData = getFilteredRecords(rawData);
    
    // Sort records newest first
    const sortedData = [...filteredData].sort((a, b) => {
      const aNo = parseInt(a.prapatraNumber) || 0;
      const bNo = parseInt(b.prapatraNumber) || 0;
      return bNo - aNo;
    });

    const finalFilteredData = sortedData;

    // Render Dashboard 6R Records Table (#dashboard-recent-tbody)
    const dashboardTbody = document.getElementById("dashboard-recent-tbody");
    if (dashboardTbody) {
      dashboardTbody.innerHTML = "";

      if (finalFilteredData.length === 0) {
        dashboardTbody.innerHTML = `<tr><td colspan="17" style="text-align: center; padding: 24px; color: var(--text-dark);">No records found.</td></tr>`;
      } else {
        finalFilteredData.forEach((row, index) => {
          const rec = getNormalizedRecord(row);
          
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="record-checkbox" data-id="${rec.sixRNo}" style="cursor: pointer;" /></td>
            <td>${index + 1}</td>
            <td>${rec.date}</td>
            <td class="farmer-col" title="${rec.farmerDetails}">${rec.farmerDetails}</td>
            <td>${rec.mobile}</td>
            <td>${rec.khasra}</td>
            <td><span class="badge badge-success">${rec.sixRNo}</span></td>
            <td><b>${rec.qty.toFixed(2)}</b></td>
            <td>₹${rec.rate}</td>
            <td>₹${rec.amt ? rec.amt.toLocaleString("en-IN") : 0}</td>
            <td>₹${Number(rec.fee).toFixed(2)}</td>
            <td>₹${Number(rec.cess).toFixed(2)}</td>
            <td><b>₹${rec.total ? Number(rec.total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</b></td>
            <td>${rec.payDate}</td>
            <td>${rec.accNo}</td>
            <td>${rec.ifsc}</td>
            <td>${rec.utr}</td>
          `;
          dashboardTbody.appendChild(tr);
        });
      }
    }
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
      const existing = result.emandi_records || [];
      const combined = [...existing, ...newData];
      const deduplicated = deduplicateRecords(combined);
      
      chrome.storage.local.set({ emandi_records: deduplicated }, () => {
        updateRecordStats();
        renderPreviewTable();
        resolve();
      });
    });
  });
}

function deleteRecord(prapatraNumber) {
  chrome.storage.local.get(["username", "companyId", "emandi_records"], (result) => {
    const username = result.username || "";
    const companyId = result.companyId || "";
    const records = result.emandi_records || [];
    const record = records.find(r => r.prapatraNumber === prapatraNumber);
    const details = record ? {
      "प्रपत्र संख्या": record.prapatraNumber || "—",
      "किसान का नाम": record.farmerName || "—",
      "भुगतान राशि": record.netAmount ? ("₹" + record.netAmount) : "—",
      "दिनांक": record.transactionDate || "—"
    } : null;

    showCustomConfirm(`क्या आप वाकई इस रिकॉर्ड को हटाना चाहते हैं?`, (confirmed) => {
      if (confirmed) {
        const filtered = records.filter(r => r.prapatraNumber !== prapatraNumber);
        const updates = { emandi_records: filtered };
        if (username) {
          updates[`emandi_records_${username}`] = filtered;
        }

        chrome.storage.local.set(updates, () => {
          logToConsole(`प्रपत्र ${prapatraNumber} डेटाबेस से हटा दिया गया।`);
          showToast(`प्रपत्र ${prapatraNumber} डेटाबेस से हटा दिया गया।`, "success");
          updateRecordStats();
          renderPreviewTable();

          // Sync single delete to Cloud
          fetch(`${apiBaseUrl}/api/sync-extension`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete_single_6r",
              username,
              companyId,
              prapatraNumber
            })
          }).catch(() => {});
        });
      }
    }, details);
  });
}

function updateRecordStats() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const records = deduplicateRecords(result.emandi_records || []);
    
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
  showCustomConfirm("क्या आप सुरक्षित किया हुआ सारा डेटा हमेशा के लिए हटाना चाहते हैं?", (confirmed) => {
    if (confirmed) {
      chrome.storage.local.get(["username", "companyId"], (userData) => {
        const username = userData.username || "";
        const companyId = userData.companyId || "";
        const updates = { emandi_records: [] };
        if (username) {
          updates[`emandi_records_${username}`] = [];
        }

        chrome.storage.local.set(updates, () => {
          updateRecordStats();
          renderPreviewTable();
          
          // Reset progress widget without clearing date/form inputs
          const pBar = document.getElementById("progress-bar");
          const pPercent = document.getElementById("progress-percent");
          const pStatus = document.getElementById("progress-status");
          if (pBar) pBar.style.width = "0%";
          if (pPercent) pPercent.innerText = "0%";
          if (pStatus) pStatus.innerText = "तैयार है (Ready)";
          
          chrome.storage.local.set({
            progress_percent: 0,
            progress_status: "तैयार है (Ready)"
          });

          // Sync clear all to Cloud
          fetch(`${apiBaseUrl}/api/sync-extension`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "clear_all_6r",
              username,
              companyId
            })
          }).catch(() => {});

          logToConsole("स्थानीय डेटाबेस एवं क्लाउड डेटाबेस पूरी तरह साफ़ कर दिया गया है।");
          showToast("डेटाबेस सफलतापूर्वक साफ़ कर दिया गया है।", "success");
        });
      });
    }
  });
}

function exportDataToCSV() {
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const data = deduplicateRecords(result.emandi_records || []);
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
  showCustomConfirm("⚠️ This will permanently delete ALL saved bank accounts from the extension.\n\nAre you sure you want to clear all bank data?", (confirmed) => {
    if (!confirmed) return;

    chrome.storage.local.set({ supplier_bank_accounts: [] }, () => {
      console.log("eMandi: All bank account data cleared by user.");
      renderBanksTable();
      showToast("All bank data cleared successfully.", "success");
    });
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
      // Dynamic column header X coordinates detection (persistent across pages)
      let headerX = [54, 108, 162, 370, 470, 530, 580]; // default fallbacks
      let isSingleAmountColumn = true; // default to 6-column single amount format

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
        const tolerance = 15; // vertical proximity tolerance in points (covers split lines within same row)

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
        
        for (const line of lines) {
          // Check if this line is the header line (checking individual elements)
          const hasTranDate = line.some(item => /tran.*date|txn.*date|date/i.test(item.str));
          const hasNarration = line.some(item => /narration|particulars|remarks/i.test(item.str));
          const hasWithdrawal = line.some(item => /withdrawal|debit|dr|amount/i.test(item.str));
          const hasBalance = line.some(item => /balance/i.test(item.str));

          // If it looks like a header line, extract coordinates from it!
          if (hasNarration && (hasWithdrawal || hasBalance)) {
            console.log("eMandi statement parser: Found header line:", line.map(i => i.str).join(" | "));
            
            // If the header has a DEPOSIT or CREDIT column, it's a 7-column format statement (not single amount column format)
            const hasDepositHeader = line.some(item => /deposit|credit/i.test(item.str));
            if (hasDepositHeader) {
              isSingleAmountColumn = false;
              console.log("eMandi statement parser: Detected 7-column format with Deposit/Credit columns.");
            } else {
              isSingleAmountColumn = true;
              console.log("eMandi statement parser: Detected 6-column format (Single Amount Column).");
            }
            
            line.forEach(item => {
              const str = item.str.toUpperCase().replace(/\s+/g, "");
              const x = item.transform[4];
              
              if (str.includes("TRAN.DATE") || str.includes("TRANDATE") || str.includes("TXNDATE") || str.includes("DATE")) {
                // If it contains both TRAN and VALUE, it's a combined header item
                if (str.includes("TRAN") && str.includes("VALUE")) {
                  headerX[0] = x;
                  headerX[1] = x + 54; // estimate Value Date starts 54 points to the right
                } else if (str.includes("VALUE")) {
                  headerX[1] = x;
                } else {
                  headerX[0] = x;
                }
              } else if (str.includes("VALUEDATE") || str.includes("VALUE.DATE")) {
                headerX[1] = x;
              } else if (str.includes("NARRATION") || str.includes("PARTICULARS") || str.includes("REMARKS")) {
                headerX[2] = x;
              } else if (str.includes("CHQ.NO") || str.includes("CHQNO") || str.includes("INSTRUMENT") || str.includes("CHQ") || str.includes("REF")) {
                headerX[3] = x;
              } else if (str.includes("WITHDRAWAL") || str.includes("DEBIT") || str.includes("AMOUNT")) {
                headerX[4] = x;
              } else if (str.includes("DEPOSIT") || str.includes("CREDIT")) {
                headerX[5] = x;
              } else if (str.includes("BALANCE")) {
                console.log(`[DEBUG] setting headerX[6] = ${x} from "${item.str}"`);
                headerX[6] = x;
              }
            });
            
            console.log("eMandi statement parser: Detected header X coordinates:", headerX);
            break; // Found the header line, no need to check other lines
          }
        }

        // Map each item in the line to its correct visual column based on header proximity
        lines.forEach(lineItems => {
          const columns = ["", "", "", "", "", "", ""];
          lineItems.forEach(item => {
            const x = item.transform[4];
            const str = (item.str || "").trim();
            if (!str) return;

            // Find closest header column index
            let closestColIdx = 0;
            let minDistance = Infinity;
            for (let i = 0; i < headerX.length; i++) {
              const dist = Math.abs(x - headerX[i]);
              if (dist < minDistance) {
                minDistance = dist;
                closestColIdx = i;
              }
            }

            columns[closestColIdx] = (columns[closestColIdx] + " " + str).trim();
          });
          
          const lineText = columns.join("\t");
          fullText += lineText + "\n";
        });
      }

      console.log("eMandi statement parser: Reconstructed PDF Text:\n", fullText);
      processStatementText(fullText, isSingleAmountColumn);

    } catch (err) {
      alert("Error parsing PDF file: " + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(currentExcelFile);
}

function processStatementText(text, isSingleAmountColumn = true) {
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
        lineLower.includes("computer-generated") || lineLower.includes("signature") || lineLower.includes("no signature") ||
        lineLower.includes("http") || lineLower.includes("bobibanking") || lineLower.includes("bankofbaroda") ||
        lineLower.includes("e-banking") || lineLower.includes("account details") || lineLower.includes("printed on") ||
        /^\d+\/\d+$/.test(line.trim()) ||
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
        line: line,
        isPdfLine: line.includes("\t") && parts.length === 7,
        isSingleAmountColumn: isSingleAmountColumn,
        rawParts: parts,
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
        if (line.includes("\t") && currentTx.line.includes("\t")) {
          // Merge parts array index-by-index to reassemble split-line columns
          for (let idx = 0; idx < Math.min(parts.length, currentTx.parts.length); idx++) {
            if (parts[idx]) {
              currentTx.parts[idx] = (currentTx.parts[idx] + " " + parts[idx]).trim();
            }
          }
          currentTx.rawParts = currentTx.parts; // Ensure rawParts matches merged parts
          currentTx.line = currentTx.parts.join("\t");
          currentTx.cleanParts = currentTx.parts.filter(Boolean);
        }

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

        if (tx.isPdfLine) {
          const withdrawalPart = (tx.rawParts[4] || "").trim();
          const depositPart = (tx.rawParts[5] || "").trim();
          if (depositPart && depositPart !== "\u2014" && depositPart !== "-" && (!withdrawalPart || withdrawalPart === "\u2014" || withdrawalPart === "-")) {
            return; // Skip deposit
          }
        } else if (amountVal) {
          const cleanAmtVal = amountVal.replace(/[\u2212\u2013\u2014]/g, "-").replace(/,/g, "").trim();
          if (cleanAmtVal && !cleanAmtVal.startsWith("-") && parseFloat(cleanAmtVal) > 0) {
            return; // Skip positive/deposit fallback
          }
        }

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

    if (tx.isPdfLine) {
      const chqPart = (tx.rawParts[3] || "").trim();
      const withdrawalPart = (tx.rawParts[4] || "").trim();
      const depositPart = (tx.rawParts[5] || "").trim();

      // Check if it is the 6-column format using the persistent tx flag
      const isSingleAmt = tx.isSingleAmountColumn;
      
      if (isSingleAmt) {
        // In single amount column format, withdrawals must start with a minus sign '-' (debit)
        // If it doesn't have a minus sign, it is a deposit (credit) -> skip it
        const cleanAmt = withdrawalPart.replace(/[\u2212\u2013\u2014]/g, "-").trim();
        if (cleanAmt && !cleanAmt.startsWith("-")) {
          return; // Skip deposit
        }
      } else {
        // In 7-column format, if there is a deposit value and no withdrawal, skip it
        if (depositPart && depositPart !== "\u2014" && depositPart !== "-" && (!withdrawalPart || withdrawalPart === "\u2014" || withdrawalPart === "-")) {
          return; // Skip deposit
        }
      }

      if (chqPart && chqPart !== "\u2014" && chqPart !== "-") {
        const cleanChq = chqPart.replace(/[^0-9]/g, "");
        if (cleanChq) {
          chkVal = cleanChq.padStart(6, "0");
        }
      }

      // Handle cases where cheque number and amount are merged in the same string due to alignment
      if (withdrawalPart && withdrawalPart !== "\u2014" && withdrawalPart !== "-") {
        const parts = withdrawalPart.trim().split(/\s+/);
        if (parts.length > 1) {
          parts.forEach(p => {
            const cleanP = p.replace(/,/g, "");
            if (!isNaN(parseFloat(cleanP)) && cleanP.includes(".")) {
              amountVal = p;
            } else if (/^\d{3,6}$/.test(p)) {
              chkVal = p.padStart(6, "0");
            }
          });
        } else {
          amountVal = withdrawalPart;
        }
      } else if (depositPart && depositPart !== "\u2014" && depositPart !== "-") {
        const parts = depositPart.trim().split(/\s+/);
        if (parts.length > 1) {
          parts.forEach(p => {
            const cleanP = p.replace(/,/g, "");
            if (!isNaN(parseFloat(cleanP)) && cleanP.includes(".")) {
              amountVal = p;
            } else if (/^\d{3,6}$/.test(p)) {
              chkVal = p.padStart(6, "0");
            }
          });
        } else {
          amountVal = depositPart;
        }
      }
    } else {
      // First amount is always the transaction amount (Withdrawal or Deposit), second is the Balance
      if (tx.amounts.length > 0) {
        amountVal = tx.amounts[0];
      }
      if (amountVal) {
        const cleanAmtVal = amountVal.replace(/[\u2212\u2013\u2014]/g, "-").replace(/,/g, "").trim();
        if (cleanAmtVal && !cleanAmtVal.startsWith("-") && parseFloat(cleanAmtVal) > 0) {
          return; // Skip positive/deposit fallback
        }
      }
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

    // Clean up grammatical bank narration prefixes (TO / BY)
    if (name.toUpperCase().startsWith("TO ")) {
      name = name.substring(3).trim();
    } else if (name.toUpperCase().startsWith("BY ")) {
      name = name.substring(3).trim();
    }

    if (tx.isPdfLine && chkVal) {
      if (!isOnlineTransfer) {
        utr = chkVal;
      }
    } else {
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

// Dynamic Tab Navigation & Top Header Title Sync
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
      item.classList.add("active");
      
      const tabName = item.getAttribute("data-tab");
      document.querySelectorAll(".dashboard-panel").forEach(panel => panel.classList.remove("active"));
      
      const targetPanel = document.getElementById(`panel-${tabName}`);
      if (targetPanel) targetPanel.classList.add("active");

      const pageTitle = document.getElementById("page-title");
      if (pageTitle) {
        if (tabName === "dashboard") pageTitle.textContent = "6R Records List";
        else if (tabName === "banks") pageTitle.textContent = "Bank Details";
        else if (tabName === "statement") pageTitle.textContent = "Statement Parser";
        else if (tabName === "company") pageTitle.textContent = "Company Profile";
      }
    });
  });

  // Wire Company Profile & Export Buttons
  const btnSaveCompany = document.getElementById("btn-save-company-details");
  if (btnSaveCompany) {
    btnSaveCompany.addEventListener("click", saveCompanyDetailsToCloud);
  }

  const btnExportExcel = document.getElementById("btn-export-excel");
  if (btnExportExcel) {
    btnExportExcel.addEventListener("click", exportToExcel);
  }

  const btnPrintPdf = document.getElementById("btn-print-mandi-pdf");
  if (btnPrintPdf) {
    btnPrintPdf.addEventListener("click", printFormattedMandiStatement);
  }

  const checkAll = document.getElementById("check-all-records");
  if (checkAll) {
    checkAll.addEventListener("change", (e) => {
      const checkboxes = document.querySelectorAll(".record-checkbox");
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
      });
    });
  }

  const btnPrint6R = document.getElementById("btn-print-6r-slips");
  if (btnPrint6R) {
    btnPrint6R.addEventListener("click", printSelected6RSlips);
  }

  // Wire Date and Serial Range filter inputs for real-time table rendering
  const filterFromInput = document.getElementById("filter-date-from");
  const filterToInput = document.getElementById("filter-date-to");
  const filterSrFromInput = document.getElementById("filter-sr-from");
  const filterToSrInput = document.getElementById("filter-sr-to");
  const filterUtrTypeSelect = document.getElementById("filter-utr-type");
  const btnClearFilters = document.getElementById("btn-clear-filters");

  // Initialize custom modern calendars
  if (filterFromInput) {
    initCustomDatePicker("filter-date-from");
    filterFromInput.addEventListener("change", renderPreviewTable);
  }
  if (filterToInput) {
    initCustomDatePicker("filter-date-to");
    filterToInput.addEventListener("change", renderPreviewTable);
  }
  if (filterSrFromInput) filterSrFromInput.addEventListener("input", renderPreviewTable);
  if (filterToSrInput) filterToSrInput.addEventListener("input", renderPreviewTable);
  if (filterUtrTypeSelect) filterUtrTypeSelect.addEventListener("change", renderPreviewTable);

  // Initialize Custom select dropdown for UTR Type
  const customSelect = document.getElementById("custom-utr-select");
  if (customSelect && filterUtrTypeSelect) {
    const trigger = customSelect.querySelector(".custom-select-trigger");
    const optionsContainer = customSelect.querySelector(".custom-select-options");
    const options = customSelect.querySelectorAll(".custom-select-option");
    const label = document.getElementById("custom-utr-trigger-label");

    if (trigger && optionsContainer) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = customSelect.classList.toggle("open");
        optionsContainer.style.display = isOpen ? "block" : "none";
      });

      options.forEach(opt => {
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = opt.getAttribute("data-value");
          filterUtrTypeSelect.value = val;
          if (label) label.textContent = val;
          options.forEach(o => o.classList.remove("selected"));
          opt.classList.add("selected");
          customSelect.classList.remove("open");
          optionsContainer.style.display = "none";
          filterUtrTypeSelect.dispatchEvent(new Event("change"));
        });
      });

      document.addEventListener("click", () => {
        customSelect.classList.remove("open");
        optionsContainer.style.display = "none";
      });
    }
  }

  if (btnClearFilters) {
    btnClearFilters.addEventListener("click", () => {
      if (filterFromInput) filterFromInput.value = "";
      if (filterToInput) filterToInput.value = "";
      if (filterSrFromInput) filterSrFromInput.value = "";
      if (filterToSrInput) filterToSrInput.value = "";
      if (filterUtrTypeSelect) {
        filterUtrTypeSelect.value = "ALL";
        const label = document.getElementById("custom-utr-trigger-label");
        if (label) label.textContent = "ALL";
        if (customSelect) {
          customSelect.querySelectorAll(".custom-select-option").forEach(o => {
            if (o.getAttribute("data-value") === "ALL") o.classList.add("selected");
            else o.classList.remove("selected");
          });
        }
      }
      renderPreviewTable();
    });
  }
});

// --- COMPANY PROFILE & EXPORT SYSTEM ---
let lastLoadedUserForCompanyProfile = "";
let lastLoadedUserForBankAccounts = "";

function syncBankAccountsFromCloud(username, companyId) {
  if (window.CloudSyncModule) {
    window.CloudSyncModule.syncBankAccountsFromCloud(apiBaseUrl, username, companyId);
    return;
  }
  if (!username || !companyId) return;
  const cleanUser = String(username).trim();
  const cacheKey = `${cleanUser}_${companyId}`;
  
  if (lastLoadedUserForBankAccounts === cacheKey) {
    return;
  }
  lastLoadedUserForBankAccounts = cacheKey;

  fetch(`${apiBaseUrl}/api/sync-extension?username=${encodeURIComponent(cleanUser)}&companyId=${encodeURIComponent(companyId)}`)
    .then(res => res.json())
    .then(resData => {
      if (resData && resData.success && Array.isArray(resData.bankAccounts) && resData.bankAccounts.length > 0) {
        const fetchedAccounts = resData.bankAccounts;
        chrome.storage.local.set({ supplier_bank_accounts: fetchedAccounts }, () => {
          console.log(`eMandi Dashboard: Successfully synced ${fetchedAccounts.length} bank accounts from cloud for ${username}`);
        });
      }
    })
    .catch(err => {
      console.debug("eMandi Dashboard: Cloud bank account sync skipped:", err);
    });
}

function loadCompanyDetailsFromCloud(username) {
  if (!username) return;
  const cleanUser = String(username).trim();
  const lowerUser = cleanUser.toLowerCase();

  // Prevent re-querying and re-populating while user is logged in
  if (lastLoadedUserForCompanyProfile === cleanUser) {
    return;
  }
  lastLoadedUserForCompanyProfile = cleanUser;

  const userKey = `company_profile_${cleanUser}`;

  // 1. Instant local fill for this specific username
  chrome.storage.local.get([userKey, "company_profile"], (data) => {
    const userProfile = data[userKey] || (data.company_profile && (data.company_profile.username === cleanUser || data.company_profile.username === lowerUser) ? data.company_profile : null);
    if (userProfile) {
      populateCompanyProfileForm(userProfile);
    } else {
      populateCompanyProfileForm({});
    }
  });

  // 2. Sync from Cloud database per username (query exact and lowercase)
  const fetchCloudProfile = (qUser, fallbackQ) => {
    fetch(`${apiBaseUrl}/api/company-details/get?username=${encodeURIComponent(qUser)}`)
      .then(res => {
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) return null;
        return res.json();
      })
      .then(resData => {
        if (resData && resData.success && resData.data) {
          const profile = resData.data;
          chrome.storage.local.set({
            [userKey]: profile,
            company_profile: profile
          }, () => {
            populateCompanyProfileForm(profile);
          });
        } else if (fallbackQ && fallbackQ !== qUser) {
          fetchCloudProfile(fallbackQ, null);
        }
      })
      .catch(() => {
        if (fallbackQ && fallbackQ !== qUser) {
          fetchCloudProfile(fallbackQ, null);
        }
      });
  };

  fetchCloudProfile(cleanUser, lowerUser);
}

function populateCompanyProfileForm(profile) {
  // Do NOT overwrite input fields if the user is currently typing inside the Company Profile form
  const activeEl = document.activeElement;
  if (activeEl && activeEl.closest("#company-profile-form")) {
    console.log("eMandi Dashboard: User is currently typing in Company Profile form. Skipping auto-populate overwrite.");
    return;
  }

  const p = profile || {};
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };
  setVal("company-firm-name", p.firmName);
  setVal("company-address", p.firmAddress || p.address);
  setVal("company-mandi-name", p.mandiName);
  setVal("company-mandi-type", p.mandiType || (p.firmName ? "NON AMPC" : ""));
  setVal("company-license-1", p.licenseNo1 || p.licenseNo);
  setVal("company-license-2", p.licenseNo2);
  setVal("company-register-no", p.registerNo);
  setVal("company-commodity", p.commodity || (p.firmName ? "धान" : ""));
  setVal("company-fy", p.fy || p.financialYear || (p.firmName ? "2024-25" : ""));
}

function saveCompanyDetailsToCloud() {
  chrome.storage.local.get("username", (data) => {
    const username = data.username;
    if (!username) {
      showToast("Please log in first to save company details.", "warning");
      return;
    }

    const cleanUser = String(username).trim();
    const lowerUser = cleanUser.toLowerCase();
    const getVal = (id) => (document.getElementById(id)?.value || "").trim();

    const profileData = {
      username: cleanUser,
      username_lower: lowerUser,
      firmName: getVal("company-firm-name"),
      firmAddress: getVal("company-address"),
      mandiName: getVal("company-mandi-name"),
      mandiType: getVal("company-mandi-type"),
      licenseNo1: getVal("company-license-1"),
      licenseNo2: getVal("company-license-2"),
      registerNo: getVal("company-register-no"),
      commodity: getVal("company-commodity"),
      fy: getVal("company-fy")
    };

    if (!profileData.firmName) {
      showToast("Firm / Company Name is required.", "warning");
      return;
    }

    const userKey = `company_profile_${cleanUser}`;

    // Save locally under userKey & active company_profile
    chrome.storage.local.set({
      [userKey]: profileData,
      company_profile: profileData
    }, async () => {
      showToast(`Company profile saved for user "${cleanUser}"! Syncing to cloud...`, "success");

      try {
        const res = await fetch(`${apiBaseUrl}/api/company-details/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileData)
        });
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const resData = await res.json();
          if (resData.success) {
            showToast(`Company profile for "${cleanUser}" saved to Cloud successfully!`, "success");
          } else {
            showToast(resData.error || "Saved locally.", "warning");
          }
        } else {
          showToast(`Company profile for "${cleanUser}" saved locally & Cloud synced!`, "info");
        }
      } catch (err) {
        console.error("Failed to post company details to cloud:", err);
        showToast("Saved locally.", "warning");
      }
    });
  });
}

// Robust helper to extract complete 16 fields for any 6R record
function getNormalizedRecord(rec) {
  let tc = rec.tableCache;
  if (!tc || !tc.prapatraNumber) {
    try {
      tc = parseRawFields(rec.printDetails?.rawText || "", rec.paymentDetails?.rawText || "");
    } catch(e) {
      tc = {};
    }
  }
  if (!tc) tc = {};

  const qty = parseFloat(tc.qty || rec.qty || rec.weight || rec.quantity || 0) || 0;
  const rate = parseFloat(tc.rate || rec.rate || 0) || 0;
  const rawAmt = parseFloat(tc.amt || rec.amt || rec.amount || rec.totalAmount || 0);
  const amt = (!isNaN(rawAmt) && rawAmt > 0) ? rawAmt : Math.round(qty * rate);

  const rawFee = parseFloat(tc.fee || rec.fee || rec.mandiFee || 0);
  const fee = (!isNaN(rawFee) && rawFee > 0) ? rawFee : (amt * 0.01);

  const rawCess = parseFloat(tc.cess || rec.cess || rec.devCess || 0);
  const cess = (!isNaN(rawCess) && rawCess > 0) ? rawCess : (amt * 0.005);

  const tot = parseFloat(tc.total || rec.total || 0) || (fee + cess);

  const rawSixR = tc.prapatraNumber || rec.prapatraNumber || rec.sixRNo || rec.prapatraNo || rec.formNo || "-";
  const cleanSixR = cleanPrapatraNumber(rawSixR) || rawSixR;

  return {
    date: formatDisplayDate(tc.date || rec.date || rec.prapatraDate || "-"),
    farmerDetails: tc.farmerDetails || rec.seller || rec.farmerName || rec.name || "-",
    mobile: tc.mobile || rec.mobile || rec.farmerMobile || rec.phone || "-",
    khasra: tc.khasra || rec.khasra || rec.khasraNo || "-",
    sixRNo: cleanSixR,
    qty,
    rate,
    amt,
    fee,
    cess,
    total: tot,
    payDate: formatDisplayDate(tc.payDate || rec.payDate || rec.paymentDate || "-"),
    accNo: tc.accNo || rec.accNo || rec.accountNo || "-",
    ifsc: tc.ifsc || rec.ifsc || rec.ifscCode || "-",
    utr: tc.utr || rec.utr || rec.utrNo || rec.refNo || "-"
  };
}

// --- EXCEL & PRINT / PDF EXPORT HANDLERS ---
function exportToExcel() {
  chrome.storage.local.get(["emandi_records", "company_profile"], (data) => {
    const rawRecords = getFilteredRecords(data.emandi_records || []);
    const profile = data.company_profile || {};

    if (rawRecords.length === 0) {
      showToast("No 6R records available to export.", "warning");
      return;
    }

    let totalQty = 0;
    let totalAmt = 0;
    let totalFee = 0;
    let totalCess = 0;
    let totalGrand = 0;

    const dataRowsHtml = rawRecords.map((rawRec, idx) => {
      const rec = getNormalizedRecord(rawRec);

      totalQty += rec.qty;
      totalAmt += rec.amt;
      totalFee += rec.fee;
      totalCess += rec.cess;
      totalGrand += rec.total;

      return `
        <tr style="height: 28px;">
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; white-space: nowrap;">${idx + 1}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'\\@';">${rec.date}</td>
          <td style="font-weight: 600; color: #0f172a; border: 1px solid #cbd5e1; white-space: nowrap; padding-left: 8px; padding-right: 8px;">${rec.farmerDetails}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'\\@';">${rec.mobile}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; white-space: nowrap;">${rec.khasra}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'\\@';">${rec.sixRNo}</td>
          <td style="text-align: right; font-weight: bold; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'0.00';">${rec.qty.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'0';">${rec.rate}</td>
          <td style="text-align: right; font-weight: bold; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'#,##0';">${Math.round(rec.amt)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'#,##0.00';">${rec.fee.toFixed(2)}</td>
          <td style="text-align: right; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'#,##0.00';">${rec.cess.toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: #0f172a; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'#,##0.00';">${rec.total.toFixed(2)}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'\\@';">${rec.payDate}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'\\@';">${rec.accNo}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'\\@';">${rec.ifsc}</td>
          <td style="text-align: center; font-size: 9pt; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'\\@';">${rec.utr}</td>
        </tr>
      `;
    }).join("");

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>6R Mandi Statement</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 10pt; line-height: 1.4; }
          th, td { padding: 6px 10px; vertical-align: middle; white-space: nowrap; }
          .title { font-size: 20pt; font-weight: 900; color: #0f172a; text-transform: uppercase; white-space: nowrap; text-align: left; }
          .subtitle { font-size: 11pt; font-weight: bold; color: #475569; white-space: nowrap; text-align: left; }
          .badge-dark { background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 9pt; text-align: center; border-radius: 12px; white-space: nowrap; }
          .pill-grey { background-color: #e2e8f0; color: #0f172a; font-weight: bold; font-size: 10pt; text-align: center; border: 1px solid #cbd5e1; white-space: nowrap; }
          .th-header { background-color: #e2e8f0; color: #0f172a; font-weight: bold; font-size: 9.5pt; border: 1px solid #94a3b8; text-align: center; white-space: nowrap; }
          .total-row { background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a; white-space: nowrap; }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            <col style="width: 50px;">   <!-- SR -->
            <col style="width: 110px;">  <!-- DATE -->
            <col style="width: 450px;">  <!-- FARMER DETAILS -->
            <col style="width: 130px;">  <!-- MOBILE -->
            <col style="width: 90px;">   <!-- KHASRA -->
            <col style="width: 260px;">  <!-- 6R NO -->
            <col style="width: 90px;">   <!-- QTY -->
            <col style="width: 80px;">   <!-- RATE -->
            <col style="width: 130px;">  <!-- AMT -->
            <col style="width: 85px;">   <!-- FEE -->
            <col style="width: 85px;">   <!-- CESS -->
            <col style="width: 130px;">  <!-- TOTAL -->
            <col style="width: 110px;">  <!-- PAY DATE -->
            <col style="width: 180px;">  <!-- ACC NO -->
            <col style="width: 120px;">  <!-- IFSC -->
            <col style="width: 220px;">  <!-- UTR -->
          </colgroup>
          <!-- Row 1: Firm Title (Left A1:K1) & Dark Badges (Right L1:M1, N1:P1) -->
          <tr style="height: 38px;">
            <td colspan="11" class="title">${(profile.firmName || "M/S JAGDAMBE RICE MILL").toUpperCase()}</td>
            <td colspan="2" class="badge-dark">मिल : ${profile.licenseNo1 || 'L/2024/190/16324939'}</td>
            <td colspan="3" class="badge-dark">थोक व्यापारी एवं आढ़तिया : ${profile.licenseNo2 || 'L/2024/190/35040315'}</td>
          </tr>
          <!-- Row 2: Address (Left A2:P2) -->
          <tr style="height: 24px;">
            <td colspan="16" class="subtitle">${profile.firmAddress || profile.address || "AJAY FILLING STATION , BANDA ROAD, DEVKALI,"}</td>
          </tr>
          <tr style="height: 10px;"><td colspan="16"></td></tr>

          <!-- Row 4: Metadata Pills Bar -->
          <tr style="height: 30px;">
            <td colspan="2" class="pill-grey">FY: ${profile.fy || '2024-25'}</td>
            <td class="pill-grey">REG: ${profile.registerNo || 'खसरा संख्या. 90/91'}</td>
            <td class="pill-grey">${profile.commodity || 'धान'}</td>
            <td colspan="10" class="pill-grey" style="text-align: left; padding-left: 12px;">MANDI: ${profile.mandiName || 'SHAHJAHANPUR MANDI SAMITI BANDA POWAYAN- SHAHJAHANPUR'}</td>
            <td colspan="2" class="pill-grey">RECORDS: ${rawRecords.length}</td>
          </tr>
          <tr style="height: 12px;"><td colspan="16"></td></tr>

          <!-- Row 6: 16 Table Headers -->
          <tr style="height: 30px;">
            <th class="th-header" style="width: 50px;">SR</th>
            <th class="th-header" style="width: 110px;">DATE</th>
            <th class="th-header" style="width: 450px; text-align: left; padding-left: 8px;">FARMER DETAILS</th>
            <th class="th-header" style="width: 130px;">MOBILE</th>
            <th class="th-header" style="width: 90px;">KHASRA</th>
            <th class="th-header" style="width: 260px;">6R NO</th>
            <th class="th-header" style="width: 90px; text-align: right;">QTY</th>
            <th class="th-header" style="width: 80px; text-align: right;">RATE</th>
            <th class="th-header" style="width: 130px; text-align: right;">AMT</th>
            <th class="th-header" style="width: 85px; text-align: right;">FEE</th>
            <th class="th-header" style="width: 85px; text-align: right;">CESS</th>
            <th class="th-header" style="width: 130px; text-align: right;">TOTAL</th>
            <th class="th-header" style="width: 110px;">PAY DATE</th>
            <th class="th-header" style="width: 180px;">ACC NO</th>
            <th class="th-header" style="width: 120px;">IFSC</th>
            <th class="th-header" style="width: 220px;">UTR</th>
          </tr>

          ${dataRowsHtml}

          <!-- Totals Row -->
          <tr class="total-row" style="height: 32px;">
            <td colspan="6" style="text-align: right; font-weight: bold; border: 1px solid #cbd5e1; white-space: nowrap;">TOTALS:</td>
            <td style="text-align: right; font-weight: bold; color: #2563eb; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'0.00';">${totalQty.toFixed(2)}</td>
            <td style="border: 1px solid #cbd5e1;"></td>
            <td style="text-align: right; font-weight: bold; color: #059669; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'#,##0.00';">${totalAmt.toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #dc2626; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'#,##0.00';">${totalFee.toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #dc2626; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'#,##0.00';">${totalCess.toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #0f172a; border: 1px solid #cbd5e1; white-space: nowrap; mso-number-format:'#,##0.00';">${totalGrand.toFixed(2)}</td>
            <td colspan="4" style="border: 1px solid #cbd5e1;"></td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Mandi_6R_Statement_${(profile.firmName || 'Export').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Styled Excel spreadsheet downloaded successfully!", "success");
  });
}

function printFormattedMandiStatement() {
  chrome.storage.local.get(["emandi_records", "company_profile", "username"], (data) => {
    const rawRecords = getFilteredRecords(data.emandi_records || []);
    const profile = data.company_profile || {};

    if (rawRecords.length === 0) {
      showToast("No 6R records available to print.", "warning");
      return;
    }

    const printContainer = document.getElementById("print-mandi-receipt");
    if (!printContainer) return;

    let totalQty = 0;
    let totalAmt = 0;
    let totalFee = 0;
    let totalCess = 0;
    let totalGrand = 0;

    const tableRowsHtml = rawRecords.map((rawRec, idx) => {
      const rec = getNormalizedRecord(rawRec);

      totalQty += rec.qty;
      totalAmt += rec.amt;
      totalFee += rec.fee;
      totalCess += rec.cess;
      totalGrand += rec.total;

      return `
        <tr style="border-bottom: 1px solid #cbd5e1; font-size: 10px;">
          <td style="padding: 6px 4px; text-align: center; font-weight: bold; border-right: 1px solid #e2e8f0;">${idx + 1}</td>
          <td style="padding: 6px 4px; text-align: center; border-right: 1px solid #e2e8f0; white-space: nowrap;">${rec.date}</td>
          <td style="padding: 6px 4px; border-right: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${rec.farmerDetails}</td>
          <td style="padding: 6px 4px; text-align: center; border-right: 1px solid #e2e8f0;">${rec.mobile}</td>
          <td style="padding: 6px 4px; text-align: center; border-right: 1px solid #e2e8f0;">${rec.khasra}</td>
          <td style="padding: 6px 4px; text-align: center; border-right: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${rec.sixRNo}</td>
          <td style="padding: 6px 4px; text-align: right; border-right: 1px solid #e2e8f0; font-weight: 700;">${rec.qty.toFixed(2)}</td>
          <td style="padding: 6px 4px; text-align: right; border-right: 1px solid #e2e8f0;">${rec.rate}</td>
          <td style="padding: 6px 4px; text-align: right; border-right: 1px solid #e2e8f0; font-weight: 700;">${rec.amt}</td>
          <td style="padding: 6px 4px; text-align: right; border-right: 1px solid #e2e8f0;">${rec.fee}</td>
          <td style="padding: 6px 4px; text-align: right; border-right: 1px solid #e2e8f0;">${rec.cess}</td>
          <td style="padding: 6px 4px; text-align: right; border-right: 1px solid #e2e8f0; font-weight: 800;">${rec.total}</td>
          <td style="padding: 6px 4px; text-align: center; border-right: 1px solid #e2e8f0; white-space: nowrap;">${rec.payDate}</td>
          <td style="padding: 6px 4px; text-align: center; border-right: 1px solid #e2e8f0; font-family: monospace;">${rec.accNo}</td>
          <td style="padding: 6px 4px; text-align: center; border-right: 1px solid #e2e8f0; font-family: monospace;">${rec.ifsc}</td>
          <td style="padding: 6px 4px; text-align: center; font-family: monospace; font-size: 9px; font-weight: 600;">${rec.utr}</td>
        </tr>
      `;
    }).join("");

    printContainer.innerHTML = `
      <style>
        @page {
          size: A4 landscape !important;
          margin: 8mm !important;
        }
      </style>
      <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; width: 100%; margin: 0 auto; line-height: 1.3;">
        <!-- Top Header: Firm Name & Dark License Pills -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0 0 4px 0; letter-spacing: 0.5px; text-transform: uppercase;">${profile.firmName || "M/S JAGDAMBE RICE MILL"}</h1>
            <div style="font-size: 11px; font-weight: 700; color: #475569;">${profile.firmAddress || profile.address || "AJAY FILLING STATION , BANDA ROAD, DEVKALI,"}</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">
            <div style="background: #0f172a; color: #ffffff; padding: 4px 14px; border-radius: 14px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px;">मिल : ${profile.licenseNo1 || profile.licenseNo || "L/2024/190/16324939"}</div>
            <div style="background: #0f172a; color: #ffffff; padding: 4px 14px; border-radius: 14px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px;">थोक व्यापारी एवं आढ़तिया : ${profile.licenseNo2 || profile.licenseNo || "L/2024/190/35040315"}</div>
          </div>
        </div>

        <!-- Second Row: Oval Grey Pills Bar -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 14px;">
          <div style="background: #e2e8f0; color: #0f172a; padding: 5px 14px; border-radius: 14px; font-size: 10px; font-weight: 800;">FY: ${profile.fy || "2024-25"}</div>
          <div style="background: #e2e8f0; color: #0f172a; padding: 5px 14px; border-radius: 14px; font-size: 10px; font-weight: 800;">REG: ${profile.registerNo || "खसरा संख्या. 90/91"}</div>
          <div style="background: #e2e8f0; color: #0f172a; padding: 5px 14px; border-radius: 14px; font-size: 10px; font-weight: 800;">${profile.commodity || "धान"}</div>
          <div style="background: #e2e8f0; color: #0f172a; padding: 5px 14px; border-radius: 14px; font-size: 10px; font-weight: 800; max-width: 600px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">MANDI: ${profile.mandiName || "SHAHJAHANPUR MANDI SAMITI BANDA POWAYAN- SHAHJAHANPUR"}</div>
          <div style="background: #e2e8f0; color: #0f172a; padding: 5px 14px; border-radius: 14px; font-size: 10px; font-weight: 800;">RECORDS: ${rawRecords.length}</div>
        </div>

        <!-- 16-Column Clean Light Grey Table Header -->
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #94a3b8;">
          <thead>
            <tr style="background: #e2e8f0; color: #0f172a; text-align: left; font-weight: 800; font-size: 9px; letter-spacing: 0.3px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; width: 25px; color: #0f172a;">SR</th>
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; width: 65px; color: #0f172a;">DATE</th>
              <th style="padding: 8px 6px; border: 1px solid #cbd5e1; color: #0f172a;">FARMER DETAILS</th>
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; color: #0f172a;">MOBILE</th>
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; color: #0f172a;">KHASRA</th>
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; color: #0f172a;">6R NO</th>
              <th style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #0f172a;">QTY</th>
              <th style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #0f172a;">RATE</th>
              <th style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #0f172a;">AMT</th>
              <th style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #0f172a;">FEE</th>
              <th style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #0f172a;">CESS</th>
              <th style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #0f172a;">TOTAL</th>
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; color: #0f172a;">PAY DATE</th>
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; color: #0f172a;">ACC NO</th>
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; color: #0f172a;">IFSC</th>
              <th style="padding: 8px 4px; text-align: center; border: 1px solid #cbd5e1; color: #0f172a;">UTR</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a; font-size: 10px;">
              <td colspan="6" style="padding: 8px; text-align: right; border: 1px solid #cbd5e1;">TOTALS:</td>
              <td style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #2563eb;">${totalQty.toFixed(2)}</td>
              <td style="border: 1px solid #cbd5e1;"></td>
              <td style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #059669;">${totalAmt.toFixed(0)}</td>
              <td style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #dc2626;">${totalFee.toFixed(0)}</td>
              <td style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #dc2626;">${totalCess.toFixed(0)}</td>
              <td style="padding: 8px 4px; text-align: right; border: 1px solid #cbd5e1; color: #0f172a;">${totalGrand.toFixed(0)}</td>
              <td colspan="4" style="border: 1px solid #cbd5e1;"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    window.print();
  });
}

function printSelected6RSlips() {
  const checkboxes = document.querySelectorAll(".record-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("कृपया प्रिंट करने के लिए कम से कम एक वाउचर चुनें (Please select at least one record to print).", "warning");
    return;
  }

  const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute("data-id"));

  chrome.storage.local.get(["emandi_records", "company_profile"], (data) => {
    const rawRecords = deduplicateRecords(data.emandi_records || []);
    const profile = data.company_profile || {};

    const selectedRecords = rawRecords.filter(r => {
      const cleanSixR = cleanPrapatraNumber(r.prapatraNumber) || r.prapatraNumber;
      return selectedIds.includes(cleanSixR);
    });

    if (selectedRecords.length === 0) {
      showToast("कोई चुनी हुई प्रविष्टियाँ नहीं मिलीं।", "warning");
      return;
    }

    const printContainer = document.getElementById("print-mandi-receipt");
    if (!printContainer) return;

    const slipsHtml = selectedRecords.map((row) => {
      const rec = getNormalizedRecord(row);
      const printD = row.printDetails || {};
      const payD = row.paymentDetails || {};
      const tc = row.tableCache || {};

      const voucherNo = rec.sixRNo;
      const bookNo = printD["पुस्तक संख्या"] || (voucherNo.includes("(") ? voucherNo.split("(")[0] : "—");
      const voucherNoVal = voucherNo;
      const mandiName = printD["मंडी"] || profile.mandiName || "Powayan";
      const buyerFirm = printD["क्रेता फर्म का नाम"] || profile.firmName || "JAGDAMBE RICE MILL";
      const buyerLicense = printD["क्रेता फर्म की लाइसेंस संख्या"] || profile.licenseNo1 || profile.licenseNo || "L/2024/190/35040315";
      const purchaseDate = rec.date.replace(/-/g, "/");
      const mandiSiteType = printD["मंडी स्थल का प्रकार"] || profile.mandiType || "उपमण्डी स्थल";
      const mandiSiteName = printD["मंडी स्थल का नाम"] || "Banda";
      
      const farmerLine = rec.farmerDetails;
      const sellerParts = farmerLine.split(", S/O: ");
      const sellerName = sellerParts[0] || "";
      const fatherAndVillage = sellerParts[1] || "";
      const fatherName = fatherAndVillage.split(", ")[0] || "—";
      const village = fatherAndVillage.split(", ").slice(1).join(", ") || "—";

      let district = printD["जनपद का नाम"] || "";
      if (!district || district === "NA" || district === "—" || district === "-") {
        district = "Shahjahanpur (शाहजहाँपुर)";
      }
      let tehsil = printD["तहसील का नाम"] || "";
      if (!tehsil || tehsil === "NA" || tehsil === "—" || tehsil === "-") {
        tehsil = "Powayan";
      }
      const khasraNo = rec.khasra;
      const khasraArea = printD["खसरे का क्षेत्रफल (हेक्टेयर में)"] || "—";
      const mobile = rec.mobile;
      const commodity = tc.commodity || row.crop || "धान";
      const variety = tc.variety || "—";
      const quantity = rec.qty.toFixed(2);
      const rate = rec.rate.toFixed(2);
      const grossVal = rec.amt.toFixed(2);
      const netVal = (parseFloat(tc.amt) || rec.amt).toFixed(2);
      const feeVal = rec.fee.toFixed(2);
      const cessVal = rec.cess.toFixed(2);
      const totalMandiVal = rec.total.toFixed(2);
      const traderName = printD["व्यापारी का पूरा नाम"] || profile.firmName || "SHYAM SWAROOP";
      const qrData = `SerialNo:${voucherNo},Date of Issue:${purchaseDate},Crop:${commodity},Mandi:${mandiName},InstrumentType:6R,http://emandi.up.gov.in/`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&ecc=M&data=${encodeURIComponent(qrData)}`;

      const renderPanel = (copyTitle) => `
        <div class="panel">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0px;">
            <div style="width: 85px; height: 85px; margin-left: 8px;">
              <img src="up_mandi_logo.png" style="width: 85px; height: 85px; object-fit: contain; border: none; display: block;" alt="UP Mandi Logo" />
            </div>
            <div style="text-align: center; flex-grow: 1; color: black; font-size: 10px; font-weight: normal; line-height: 1.35;">
              <h2 style="margin: 0; font-size: 12px; font-weight: normal; color: black; font-family: sans-serif;">कृषि उत्पादन मंडी समिति <span style="font-weight: bold;">${mandiName}</span></h2>
              <div style="margin-top: 3px; font-weight: normal; font-size: 10px;">(प्रपत्र-6) (प्रसंस्करण हेतु)</div>
              <div style="color: #4b5563; margin-top: 2px; font-weight: normal; font-size: 10px;">[ नियम 68(2) तथा 76(14) देखिये ]</div>
              <div style="margin-top: 3px; font-weight: normal; font-size: 10px;">विक्रेता के लिए वाउचर</div>
              <div style="margin-top: 2px; font-weight: normal; font-size: 10px;">(केवल पहली पहुँच के विक्रय के लिए)</div>
            </div>
            <div style="width: 85px; height: 85px; margin-right: 8px;">
              <img src="${qrUrl}" style="width: 85px; height: 85px; object-fit: contain; border: none; display: block;" alt="QR Code" />
            </div>
          </div>
          <div style="text-align: center; font-weight: bold; margin-top: 0px; margin-bottom: 0px; color: black; font-size: 10.5px;">${copyTitle}</div>

          <!-- Meta Table -->
          <table class="meta-table" style="table-layout: fixed; width: 100%;">
            <colgroup>
              <col style="width: 16%;" />
              <col style="width: 15%;" />
              <col style="width: 18%;" />
              <col style="width: 22%;" />
              <col style="width: 16%;" />
              <col style="width: 13%;" />
            </colgroup>
            <tr>
              <td class="label">पुस्तक संख्या</td>
              <td class="value">${bookNo}</td>
              <td class="label">क्रम संख्या</td>
              <td class="value" style="font-size: 10px; font-weight: bold;">${voucherNo}</td>
              <td class="label">मंडी</td>
              <td class="value">${mandiName}</td>
            </tr>
            <tr>
              <td class="label">क्रेता फर्म का नाम</td>
              <td class="value">${buyerFirm}</td>
              <td class="label">क्रेता फर्म की लाइसेंस संख्या</td>
              <td class="value">${buyerLicense}</td>
              <td class="label">क्रय / नीलामी का दिनांक</td>
              <td class="value">${purchaseDate}</td>
            </tr>
            <tr>
              <td class="label">मंडी स्थल का प्रकार</td>
              <td class="value">${mandiSiteType}</td>
              <td class="label">मंडी स्थल का नाम</td>
              <td class="value">${mandiSiteName}</td>
              <td class="label">विक्रेता किसान का नाम</td>
              <td class="value" style="font-weight: bold;">${sellerName}</td>
            </tr>
            <tr>
              <td class="label">भू-स्वामी उत्पादक के पिता का नाम</td>
              <td class="value">${fatherName}</td>
              <td class="label">जनपद का नाम</td>
              <td class="value">${district}</td>
              <td class="label">तहसील का नाम</td>
              <td class="value">${tehsil}</td>
            </tr>
            <tr>
              <td class="label">गाँव का नाम</td>
              <td class="value">${village}</td>
              <td class="label label-wrap">भू-स्वामी उत्पादक का खसरा नंबर जिस पर उत्पादन किया गया है</td>
              <td class="value">${khasraNo}</td>
              <td class="label">खसरे का क्षेत्रफल (हेक्टेयर में)</td>
              <td class="value">${khasraArea}</td>
            </tr>
            <tr>
              <td class="label">मोबाइल नंबर</td>
              <td class="value">${mobile}</td>
              <td class="label">विक्रेता का प्रकार</td>
              <td class="value" colspan="3" style="font-weight: bold; color: black;">${row.sellerType || "भू-स्वामी उत्पादक"}</td>
            </tr>
            <tr>
              <td class="label">पट्टाधारक उत्पादक का नाम</td>
              <td class="value">NA</td>
              <td class="label">पट्टाधारक उत्पादक के पिता का नाम</td>
              <td class="value">NA</td>
              <td class="label">पट्टाधारक उत्पादक मोबाइल नंबर</td>
              <td class="value">NA</td>
            </tr>
            <tr>
              <td class="label">जनपद का नाम</td>
              <td class="value">NA</td>
              <td class="label">तहसील का नाम</td>
              <td class="value">NA</td>
              <td class="label">गाँव का नाम</td>
              <td class="value">NA</td>
            </tr>
          </table>

          <!-- Calculation Table -->
          <table class="calc-table">
            <thead>
              <tr>
                <th rowspan="2">कृषि उत्पादन का नाम</th>
                <th rowspan="2">किस्म</th>
                <th rowspan="2">तौल / मात्रा / माप<br/>(कुंतल में)</th>
                <th rowspan="2">दर<br/>(प्रति कुंतल)</th>
                <th rowspan="2">कुल मूल्य</th>
                <th rowspan="2">विक्रेता को भुगतान की गयी शुद्ध धनराशि</th>
                <th colspan="3">मंडी शुल्क एवं विकास सेस की गणना</th>
              </tr>
              <tr>
                <th>मंडी शुल्क</th>
                <th>विकास सेस</th>
                <th>कुल धनराशि</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${commodity}</td>
                <td>${variety}</td>
                <td>${quantity}</td>
                <td>${rate}</td>
                <td>${grossVal}</td>
                <td>${netVal}</td>
                <td>${feeVal}</td>
                <td>${cessVal}</td>
                <td style="font-weight: bold;">${totalMandiVal}</td>
              </tr>
            </tbody>
          </table>

          <!-- Signatures -->
          <div style="margin-top: 15px; font-size: 11px; color: black; padding: 0 5px; font-weight: normal;">
            व्यापारी का पूरा नाम: <span style="font-weight: bold; margin-left: 5px; margin-right: 15px;">${traderName}</span> व्यापारी का हस्ताक्षर
          </div>
        </div>
      `;

      return `
        <div class="slip">
          ${renderPanel("मण्डी समिति प्रति")}
          
          <!-- Scissor Dotted Line -->
          <div class="scissor-line">
            <span>✂</span>
          </div>

          ${renderPanel("व्यापारी प्रति")}
        </div>
      `;
    }).join("");

    printContainer.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800;900&display=swap');
        @page {
          size: portrait !important;
          margin: 6mm !important;
        }
        * {
          box-sizing: border-box;
          font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', 'Segoe UI', sans-serif !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .slip {
          width: 100%;
          max-width: 790px;
          height: 98vh;
          margin: 0 auto;
          background: white;
          padding: 5px;
          display: grid;
          grid-template-rows: 1fr auto 1fr;
          page-break-after: always !important;
          box-sizing: border-box;
        }
        .panel {
          height: 100%;
          border: 0.5px solid #888888 !important;
          padding: 8px 4px;
          background: white;
          color: #000000;
          text-align: left;
          border-radius: 2px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
        }
        .meta-table td {
          border: 0.5px solid #e2e8f0;
          padding: 4px 6px;
          font-size: 9px;
          vertical-align: middle;
          color: #000000;
          word-break: break-all;
        }
        .meta-table td.label {
          color: #000000;
          font-weight: 400;
          background: #ffffff;
        }
        .meta-table td.label-wrap {
          white-space: normal !important;
        }
        .meta-table td.value {
          color: #000000;
          font-weight: 600;
          background: #ffffff;
        }
        .calc-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
          text-align: center;
        }
        .calc-table th, .calc-table td {
          border: 0.5px solid #e2e8f0;
          padding: 4px;
          font-size: 9px;
          vertical-align: middle;
          color: #000000;
          word-break: break-all;
        }
        .calc-table th {
          font-weight: 400 !important;
          background: #ffffff;
          color: #000000;
        }
        .calc-table td {
          font-weight: 600;
          color: #000000;
        }
        .scissor-line {
          border-top: 1px dashed #000000;
          text-align: center;
          margin: 12px 0;
          position: relative;
        }
        .scissor-line span {
          position: absolute;
          top: -10px;
          left: 10%;
          background: white;
          padding: 0 10px;
          font-size: 14px;
          color: black;
        }
        @media print {
          body {
            background: #ffffff;
          }
          .slip {
            page-break-after: always !important;
          }
        }
      </style>
      ${slipsHtml}
    `;

    const images = printContainer.querySelectorAll("img");
    let loadedCount = 0;
    const totalImages = images.length;

    if (totalImages === 0) {
      window.print();
      return;
    }

    function imageLoaded() {
      loadedCount++;
      if (loadedCount === totalImages) {
        window.print();
      }
    }

    images.forEach(img => {
      if (img.complete) {
        imageLoaded();
      } else {
        img.addEventListener("load", imageLoaded);
        img.addEventListener("error", imageLoaded); // Fallback so print doesn't hang if image fails
      }
    });
  });
}
