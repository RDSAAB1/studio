/**
 * Electron-compatible print utility.
 * 
 * In Electron, iframe.contentWindow.print() shows "This app does not support print preview".
 * The correct approach is to use webContents.print() via IPC on the main process.
 * This helper detects Electron and routes accordingly.
 */

export async function printHtmlContent(htmlContent: string, styles: string = ''): Promise<void> {
  const electron = typeof window !== 'undefined' ? (window as any).electron : undefined;

  // Check if htmlContent is already a full HTML document
  const isFullDocument = htmlContent.trim().toLowerCase().startsWith('<!doctype') || 
                         htmlContent.trim().toLowerCase().startsWith('<html');

  let fullHtml = htmlContent;
  if (!isFullDocument) {
    fullHtml = `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body { margin: 0; padding: 0; background: white !important; color: black !important; font-family: Arial, sans-serif; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            ${styles}
          </style>
          <script>
            window.onload = () => {
              // Any special print-time hydration can go here
            };
          </script>
        </head>
        <body class="is-print-window">
          ${htmlContent}
        </body>
      </html>
    `;
  }

  if (electron?.printHtml) {
    // ✅ Electron: use native webContents.print() via IPC
    const result = await electron.printHtml(fullHtml);
    if (!result?.success && result?.error) {
      console.error('[ElectronPrint] Print failed:', result.error);
      throw new Error(result.error);
    }
  } else {
    // 🌐 Browser fallback: use popup window
    console.log('[Print] Proceeding with web browser print. Full document:', isFullDocument);
    printViaIframe(fullHtml, isFullDocument);
  }
}

/**
 * Convenience wrapper for printing a full HTML string directly.
 */
export async function printFullHtml(fullHtml: string): Promise<void> {
  return printHtmlContent(fullHtml);
}

function printViaIframe(fullHtml: string, isFullDocument: boolean = false) {
  // Open a temporary popup window
  const printWindow = window.open('', '_blank', 'width=900,height=700,top=50,left=50');
  
  if (!printWindow) {
    console.warn("Print popup was blocked by the browser.");
    alert("Please allow popups for this site to print. Popup blocker might be preventing the report from opening.");
    return;
  }

  const iframeDoc = printWindow.document;
  
  // Write the HTML content
  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  // CRITICAL: If it's a full document (like our reports), it already has its own <style> block.
  // Cloning the app's entire Tailwind/Next.js CSS is redundant, slow, and often causes blank pages/errors.
  if (!isFullDocument) {
    console.log('[Print] Injecting parent styles for partial content...');
    // Copy app styles (Tailwind/CSS) robustly
    const headElements = document.querySelectorAll('link[rel="stylesheet"], style');
    headElements.forEach(el => {
      try {
        iframeDoc.head.appendChild(el.cloneNode(true));
      } catch { /* ignore */ }
    });

    // Fallback programmatic style copy
    Array.from(document.styleSheets).forEach(styleSheet => {
      try {
        if (styleSheet.href) return; // Handled by link tag clone
        const style = iframeDoc.createElement('style');
        style.textContent = Array.from(styleSheet.cssRules).map(r => r.cssText).join('');
        iframeDoc.head.appendChild(style);
      } catch { /* CORS - skip */ }
    });
  } else {
    console.log('[Print] Full document detected. Skipping parent style injection.');
  }

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    
    // Check if content actually exists
    if (!iframeDoc.body || iframeDoc.body.innerHTML.trim() === '') {
      console.warn('[Print] Content body is not ready yet.');
      return;
    }

    printed = true;
    console.log('[Print] Triggering native print dialog...');
    
    // Clean up AFTER the print dialog closes
    printWindow.addEventListener('afterprint', () => {
      console.log('[Print] User closed print dialog. Closing window.');
      printWindow.close();
    });

    printWindow.focus();
    printWindow.print();
    
    // Fallback cleanup
    setTimeout(() => {
      try { if (!printWindow.closed) printWindow.close(); } catch {}
    }, 60000);
  };
  
  // Use multiple triggers to ensure print dialog opens
  printWindow.addEventListener('load', () => {
    console.log('[Print] Window Load event fired.');
    doPrint();
  }, { once: true });

  // Safety timeouts
  setTimeout(doPrint, 500); 
  setTimeout(doPrint, 2500); 
}
