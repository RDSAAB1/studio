/**
 * eMandi Extension - Cloud Synchronization Module
 * Handles cloud fetching and syncing for accounts, company details, 6R records, and bank accounts.
 */

window.CloudSyncModule = (function() {
  let lastLoadedUserForBankAccounts = "";
  let lastLoadedUserForCompanyProfile = "";

  function syncBankAccountsFromCloud(apiBaseUrl, username, companyId, callback) {
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
        if (resData && resData.success) {
          // 1. Sync Bank Accounts
          if (Array.isArray(resData.bankAccounts) && resData.bankAccounts.length > 0) {
            const fetchedAccounts = resData.bankAccounts;
            chrome.storage.local.set({ supplier_bank_accounts: fetchedAccounts }, () => {
              console.log(`eMandi CloudSyncModule: Successfully synced ${fetchedAccounts.length} bank accounts from cloud for ${username}`);
            });
          }

          // 2. Sync 6R Mandi Reports if returned from Cloud
          if (Array.isArray(resData.mandiReports) && resData.mandiReports.length > 0) {
            const cloudRecords = resData.mandiReports;
            const recordsKey = `emandi_records_${cleanUser}`;
            
            chrome.storage.local.get({ emandi_records: [] }, (result) => {
              const localRecords = result.emandi_records || [];
              
              // Merge local and cloud 6R records (deduplicated by prapatraNumber)
              const recordMap = new Map();
              localRecords.forEach(r => {
                if (r && r.prapatraNumber) recordMap.set(r.prapatraNumber, r);
              });
              cloudRecords.forEach(r => {
                if (r && (r.prapatraNumber || r.id)) {
                  const key = r.prapatraNumber || r.id;
                  if (!recordMap.has(key)) {
                    recordMap.set(key, r);
                  }
                }
              });

              const mergedRecords = Array.from(recordMap.values());
              chrome.storage.local.set({
                emandi_records: mergedRecords,
                [recordsKey]: mergedRecords
              }, () => {
                console.log(`eMandi CloudSyncModule: Merged ${mergedRecords.length} 6R records from cloud for ${username}`);
                if (typeof window.renderPreviewTable === "function") {
                  window.renderPreviewTable();
                }
              });
            });
          }

          if (callback) callback(resData);
        }
      })
      .catch(err => {
        console.debug("eMandi CloudSyncModule: Cloud sync skipped:", err);
      });
  }

  function resetCache() {
    lastLoadedUserForBankAccounts = "";
    lastLoadedUserForCompanyProfile = "";
  }

  return {
    syncBankAccountsFromCloud,
    resetCache
  };
})();
