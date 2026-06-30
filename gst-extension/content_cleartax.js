(function () {
  console.log("GST ClearTax content script loaded");

  const urlParams = new URLSearchParams(window.location.search);
  const gstin = urlParams.get('gstin');

  if (gstin) {
    const checkAndFillInput = () => {
      const input = document.querySelector('input[placeholder*="GST" i]') || 
                    document.querySelector('input[id*="gst" i]') ||
                    document.querySelector('input[name*="gst" i]') ||
                    document.querySelector('input[type="text"]');

      if (input) {
        input.value = gstin;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        setTimeout(() => {
          // 1. Try keypress/Enter on the input
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          input.dispatchEvent(enterEvent);

          // 2. Try clicking submit/search buttons
          const btn = document.querySelector('button[type="submit"]') ||
                      document.querySelector('input[type="submit"]') ||
                      document.querySelector('.search-btn') ||
                      document.querySelector('[class*="search" i] button') ||
                      document.querySelector('button') ||
                      Array.from(document.querySelectorAll('span, div, button, a')).find(el => {
                        const txt = el.textContent || "";
                        return txt.includes('Search') || txt.includes('Verify') || txt.includes('Check') || txt.includes('Go');
                      });
          
          if (btn) {
            btn.click();
          }

          // 3. Try form submit as fallback
          const parentForm = input.closest('form');
          if (parentForm) {
            parentForm.submit();
          }
        }, 300);
      } else {
        setTimeout(checkAndFillInput, 200);
      }
    };
    checkAndFillInput();
  }

  let copyDone = false;
  const scrapeResults = () => {
    if (copyDone) return;
    const pageText = document.body.innerText;
    
    const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
    const bizNameIdx = lines.findIndex(l => l.toUpperCase() === "BUSINESS NAME");
    
    if (bizNameIdx !== -1 && bizNameIdx + 1 < lines.length) {
      const nextLine = lines[bizNameIdx + 1];
      const keysUpper = ["BUSINESS NAME", "PAN", "ADDRESS", "ENTITY TYPE", "NATURE OF BUSINESS", "PINCODE", "DEPARTMENT CODE", "REGISTRATION TYPE", "REGISTRATION DATE", "SEARCH", "GST"];
      
      // Check if the next line is a valid company name value (not another key)
      if (!keysUpper.includes(nextLine.toUpperCase()) && nextLine.length > 2) {
        const keys = ["Business Name", "PAN", "Address", "Entity Type", "Nature of business", "Pincode", "Department Code", "Registration Type", "Registration Date"];
        const extractedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const key of keys) {
            if (line.toUpperCase() === key.toUpperCase() && i + 1 < lines.length) {
              const val = lines[i + 1];
              if (!keysUpper.includes(val.toUpperCase())) {
                extractedLines.push(key);
                extractedLines.push(val);
              }
            }
          }
        }

        if (extractedLines.length > 0) {
          const textBlock = extractedLines.join('\n');
          copyDone = true;
          
          // Send message to background script to close tab and update app
          chrome.runtime.sendMessage({
            action: 'gst_search_success',
            details: textBlock
          });
          return;
        }
      }
    }
    
    setTimeout(scrapeResults, 800);
  };

  setTimeout(scrapeResults, 1000);

})();
