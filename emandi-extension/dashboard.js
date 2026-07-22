// dashboard.js - Controls the full-screen scraper dashboard UI

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
      timeLeftContainer.textContent = "लाइफटाइम (Lifetime)";
      timeLeftContainer.style.color = "#22c55e"; // green
      timeLeftContainer.style.background = "rgba(34, 197, 94, 0.12)";
      timeLeftContainer.style.borderColor = "rgba(34, 197, 94, 0.2)";
      return;
    }

    const diff = expiry - Date.now();
    if (diff <= 0) {
      timeLeftContainer.textContent = "समाप्त (Expired)";
      timeLeftContainer.style.color = "#ef4444"; // red
      timeLeftContainer.style.background = "rgba(239, 68, 68, 0.12)";
      timeLeftContainer.style.borderColor = "rgba(239, 68, 68, 0.2)";
      return;
    }

    const secs = Math.floor(diff / 1000) % 60;
    const mins = Math.floor(diff / (1000 * 60)) % 60;
    const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    let text = "";
    if (days > 0) text += `${days}d `;
    if (hours > 0 || days > 0) text += `${hours}h `;
    if (mins > 0 || hours > 0 || days > 0) text += `${mins}m `;
    text += `${secs}s`;

    timeLeftContainer.textContent = text;
    if (diff < 60000) {
      // Less than 1 minute (Danger)
      timeLeftContainer.style.color = "#ef4444";
      timeLeftContainer.style.background = "rgba(239, 68, 68, 0.12)";
      timeLeftContainer.style.borderColor = "rgba(239, 68, 68, 0.2)";
    } else {
      // Normal countdown (Warning)
      timeLeftContainer.style.color = "#f59e0b";
      timeLeftContainer.style.background = "rgba(245, 158, 11, 0.12)";
      timeLeftContainer.style.borderColor = "rgba(245, 158, 11, 0.2)";
    }
  }

  function backupCurrentUserRecords(callback) {
    chrome.storage.local.get(["username", "emandi_records"], (data) => {
      if (data.username && data.emandi_records) {
        const backupKey = `emandi_records_${data.username}`;
        chrome.storage.local.set({ [backupKey]: data.emandi_records }, () => {
          if (callback) callback();
        });
      } else {
        if (callback) callback();
      }
    });
  }

  function restoreNewUserRecords(newUsername, callback) {
    const backupKey = `emandi_records_${newUsername}`;
    chrome.storage.local.get(backupKey, (data) => {
      const records = data[backupKey] || [];
      chrome.storage.local.set({ emandi_records: records }, () => {
        if (typeof renderPreviewTable === "function") {
          renderPreviewTable();
        }
        if (callback) callback();
      });
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
        if (subInfoBlock) subInfoBlock.style.display = "block";
        if (switchBtn) switchBtn.style.display = "inline-flex";

        const isVerified = data.subscription_verified === true;
        const isNotExpired = data.subscription_expiry ? (data.subscription_expiry > Date.now()) : false;

        if (isVerified && isNotExpired) {
          // Fully authorized
          if (subscriptionLockOverlay) subscriptionLockOverlay.classList.remove("show");
          updateCountdown(data.subscription_expiry, data.subscription_duration);
        } else {
          // Locked - subscription required or expired
          if (subscriptionLockOverlay) subscriptionLockOverlay.classList.add("show");
          updateVerifyButtonState();
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

      const email = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!email || !password || password.length < 6) {
        if (signupErrorMsg) {
          signupErrorMsg.textContent = "कृपया वैध ईमेल और कम से कम 6 अक्षरों का पासवर्ड दर्ज करें।";
          signupErrorMsg.style.display = "block";
        }
        return;
      }

      try {
        const apiKey = "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true })
        });

        if (response.ok) {
          const resData = await response.json();
          const targetUser = resData.email || email;
          restoreNewUserRecords(targetUser, () => {
            chrome.storage.local.set({
              username: targetUser,
              companyId: "default",
              idToken: resData.idToken || ""
            }, () => {
              showToast("Registration successful! Please activate your license code.", "success");
              // Clear inputs
              if (emailInput) emailInput.value = "";
              if (passwordInput) passwordInput.value = "";
              checkAuthAndSubscription();
            });
          });
        } else {
          const errData = await response.json();
          const errMsg = errData.error?.message || "रजिस्ट्रेशन असफल!";
          if (signupErrorMsg) {
            signupErrorMsg.textContent = errMsg === "EMAIL_EXISTS" ? "यह ईमेल पहले से रजिस्टर्ड है!" : errMsg;
            signupErrorMsg.style.display = "block";
          }
        }
      } catch (err) {
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

      try {
        const isEmail = username.includes("@");
        if (isEmail) {
          // Direct Firebase sign-in for master accounts/email registrations
          const apiKey = "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU";
          const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username, password, returnSecureToken: true })
          });

          if (response.ok) {
            const resData = await response.json();
            const targetUser = resData.email || username;
            restoreNewUserRecords(targetUser, () => {
              chrome.storage.local.set({
                username: targetUser,
                companyId: "default",
                idToken: resData.idToken || ""
              }, () => {
                checkAuthAndSubscription();
              });
            });
            return;
          }
        } else {
          // Fallback to deployed server company-users/login for employee accounts (username + password)
          const response = await fetch("https://jrmd.netlify.app/api/company-users/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });

          if (response.ok) {
            const resData = await response.json();
            if (resData.success) {
              const targetUser = resData.username || username;
              restoreNewUserRecords(targetUser, () => {
                chrome.storage.local.set({
                  username: targetUser,
                  companyId: resData.companyId || "",
                  idToken: resData.idToken || resData.customToken || ""
                }, () => {
                  checkAuthAndSubscription();
                });
              });
              return;
            }
          }
        }
        
        // Show invalid credentials error
        if (loginErrorMsg) {
          loginErrorMsg.textContent = "ग़लत यूज़र आईडी या पासवर्ड!";
          loginErrorMsg.style.display = "block";
        }
      } catch (err) {
        console.error("Login API error:", err);
        if (loginErrorMsg) {
          loginErrorMsg.textContent = "कनेक्शन एरर! कृपया सुनिश्चित करें कि आपका मुख्य सॉफ़्टवेयर (localhost:3000) चालू है।";
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
    let digits = 7;
    if (duration === "testing") digits = 3;
    else if (duration === "trial") digits = 7;
    else if (duration === "monthly") digits = 7;
    else if (duration === "yearly") digits = 10;
    else if (duration === "lifetime") digits = 15;

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
      // Send notification email to RDSAAB1@GMAIL.COM using /api/send-email
      const subject = `eMandi Scraper Subscription Code Request: ${data.username}`;
      const body = `User "${data.username}" has requested a subscription code.\nDuration: ${duration.toUpperCase()}\nCompany ID: ${data.companyId}\nGenerated Code: ${code}`;
      
      try {
        const response = await fetch("https://jrmd.netlify.app/api/send-email", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${data.idToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            to: "RDSAAB1@GMAIL.COM",
            subject: subject,
            body: body,
            attachments: [],
            userId: data.username,
            erp: data.companyId
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

      chrome.storage.local.get(["generated_subscription_code", "pending_duration", "username"], (data) => {
        if (!data.generated_subscription_code) {
          if (activationErrorMsg) {
            activationErrorMsg.textContent = "Please click 'Generate Code' first.";
            activationErrorMsg.style.display = "block";
          }
          return;
        }

        if (enteredCode === data.generated_subscription_code) {
          // Calculate expiration timestamp
          const duration = data.pending_duration || "monthly";
          let durationMs = 30 * 24 * 60 * 60 * 1000; // default 1 month
          
          if (duration === "testing") durationMs = 1 * 60 * 1000; // 1 Minute testing
          else if (duration === "trial") durationMs = 30 * 24 * 60 * 60 * 1000; // 1 Month Trial
          else if (duration === "monthly") durationMs = 30 * 24 * 60 * 60 * 1000;
          else if (duration === "yearly") durationMs = 365 * 24 * 60 * 60 * 1000;
          else if (duration === "lifetime") durationMs = 99999 * 24 * 60 * 60 * 1000; // Lifetime far future

          const expiry = Date.now() + durationMs;

          const keysToSet = {
            subscription_verified: true,
            subscription_expiry: expiry,
            subscription_duration: duration
          };

          // Mark free trial as used for this username
          if (duration === "trial" && data.username) {
            keysToSet[`free_trial_used_${data.username}`] = true;
          }

          chrome.storage.local.set(keysToSet, () => {
            showToast("License activation successful! Extension unlocked.", "success");
            if (codeInput) codeInput.value = "";
            checkAuthAndSubscription();
          });
        } else {
          if (activationErrorMsg) {
            activationErrorMsg.textContent = "Invalid code! Please enter the correct code.";
            activationErrorMsg.style.display = "block";
          }
        }
      });
    });
  }

  // Bind Switch Account
  const btnSwitchAccount = document.getElementById("btn-switch-account");
  if (btnSwitchAccount) {
    btnSwitchAccount.addEventListener("click", () => {
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
          "emandi_records"
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

  if (btnStart) btnStart.addEventListener("click", startExtraction);
  if (btnReset) btnReset.addEventListener("click", resetScraperRange);
  if (btnExport) btnExport.addEventListener("click", exportDataToCSV);
  if (btnClear) btnClear.addEventListener("click", clearStorage);
  if (btnClearTable) btnClearTable.addEventListener("click", clearStorage);
  if (btnProcessManual) btnProcessManual.addEventListener("click", processManualWorkspace);
  
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
      logToConsole(message.message);
    } else if (message.action === "progress") {
      updateProgress(message.percent, message.status);
    } else if (message.action === "pasteToField") {
      if (message.field === 1 && txtF1) {
        txtF1.value = message.text;
        logToConsole("वाउचर डेटा स्वचालित रूप से Field 1 में पेस्ट हुआ।");
      } else if (message.field === 2 && txtF2) {
        txtF2.value = message.text;
        logToConsole("भुगतान विवरण डेटा स्वचालित रूप से Field 2 में पेस्ट हुआ।");
      }
      saveWorkspaceState();
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
  const searchInput = document.getElementById("search-db-input");
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";

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

    // Render Database Tab Full Table (if element exists)
    const tbody = document.getElementById("preview-table-body");
    if (tbody) {
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
    }

    // Render Dashboard Tab Overview Table (Last 5 records)
    const dashboardTbody = document.getElementById("dashboard-recent-tbody");
    dashboardTbody.innerHTML = "";
    
    const recentRecords = sortedData;
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
  chrome.storage.local.get({ emandi_records: [] }, (result) => {
    const record = result.emandi_records.find(r => r.prapatraNumber === prapatraNumber);
    const details = record ? {
      "प्रपत्र संख्या": record.prapatraNumber || "—",
      "किसान का नाम": record.farmerName || "—",
      "भुगतान राशि": record.netAmount ? ("₹" + record.netAmount) : "—",
      "दिनांक": record.transactionDate || "—"
    } : null;

    showCustomConfirm(`क्या आप वाकई इस रिकॉर्ड को हटाना चाहते हैं?`, (confirmed) => {
      if (confirmed) {
        const filtered = result.emandi_records.filter(r => r.prapatraNumber !== prapatraNumber);
        chrome.storage.local.set({ emandi_records: filtered }, () => {
          logToConsole(`प्रपत्र ${prapatraNumber} डेटाबेस से हटा दिया गया।`);
          showToast(`प्रपत्र ${prapatraNumber} डेटाबेस से हटा दिया गया।`, "success");
          updateRecordStats();
          renderPreviewTable();
        });
      }
    }, details);
  });
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
  showCustomConfirm("क्या आप सुरक्षित किया हुआ सारा डेटा हमेशा के लिए हटाना चाहते हैं?", (confirmed) => {
    if (confirmed) {
      chrome.storage.local.set({ emandi_records: [] }, () => {
        updateRecordStats();
        renderPreviewTable();
        resetScraperRange();
        logToConsole("स्थानीय डेटाबेस पूरी तरह साफ़ कर दिया गया है।");
        showToast("स्थानीय डेटाबेस सफलतापूर्वक साफ़ कर दिया गया है।", "success");
      });
    }
  });
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

        // Dynamic column header X coordinates detection
        let headerX = [54, 108, 162, 370, 470, 530, 580]; // default fallbacks
        items.forEach(item => {
          const str = (item.str || "").toUpperCase().replace(/\s+/g, "");
          if (str.includes("TRAN.DATE") || str.includes("TRANDATE") || str.includes("TXNDATE")) {
            headerX[0] = item.transform[4];
          } else if (str.includes("VALUEDATE") || str.includes("VALUE.DATE")) {
            headerX[1] = item.transform[4];
          } else if (str.includes("NARRATION") || str.includes("PARTICULARS")) {
            headerX[2] = item.transform[4];
          } else if (str.includes("CHQ.NO") || str.includes("CHQNO") || str.includes("INSTRUMENT")) {
            headerX[3] = item.transform[4];
          } else if (str.includes("WITHDRAWAL") || str.includes("DEBIT")) {
            headerX[4] = item.transform[4];
          } else if (str.includes("DEPOSIT") || str.includes("CREDIT")) {
            headerX[5] = item.transform[4];
          } else if (str.includes("BALANCE")) {
            headerX[6] = item.transform[4];
          }
        });

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
        line: line,
        isPdfLine: line.includes("\t") && parts.length === 7,
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

    // First amount is always the transaction amount (Withdrawal or Deposit), second is the Balance
    if (tx.amounts.length > 0) {
      amountVal = tx.amounts[0];
    }

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

