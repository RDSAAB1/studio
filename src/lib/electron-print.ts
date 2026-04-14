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
    // 🌐 Browser fallback: use iframe trick
    printViaIframe(fullHtml);
  }
}

/**
 * Convenience wrapper for printing a full HTML string directly.
 */
export async function printFullHtml(fullHtml: string): Promise<void> {
  return printHtmlContent(fullHtml);
}

function printViaIframe(fullHtml: string) {
  // For Web Browsers, the most robust way to print without layout collapsing or Chrome's iframe throtttling
  // is to open a temporary popup window, inject the precise HTML and styles, print, and auto-close.
  const printWindow = window.open('', '_blank', 'width=800,height=600,top=100,left=100');
  
  if (!printWindow) {
    // If popups are blocked, alert the user (very rare when triggered directly by a click event)
    console.warn("Print popup was blocked by the browser.");
    alert("Please allow popups for this site to print receipts.");
    return;
  }

  const iframeDoc = printWindow.document;
  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  // Copy app styles (Tailwind/CSS) robustly
  const headElements = document.querySelectorAll('link[rel="stylesheet"], style');
  headElements.forEach(el => {
    try {
      iframeDoc.head.appendChild(el.cloneNode(true));
    } catch { /* ignore */ }
  });

  // Fallback programmatic style copy (critical for dev environments like Next.js/Vite)
  Array.from(document.styleSheets).forEach(styleSheet => {
    try {
      if (styleSheet.href) return; // Handled by link tag clone
      const style = iframeDoc.createElement('style');
      style.textContent = Array.from(styleSheet.cssRules).map(r => r.cssText).join('');
      iframeDoc.head.appendChild(style);
    } catch { /* CORS - skip */ }
  });

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    
    // Clean up AFTER the print dialog closes
    printWindow.addEventListener('afterprint', () => {
      printWindow.close();
    });

    printWindow.focus();
    printWindow.print();
    
    // Fallback cleanup if afterprint doesn't fire
    setTimeout(() => {
      try { printWindow.close(); } catch {}
    }, 300000);
  };
  
  // Give it time to apply the cloned styles and fetch images
  printWindow.addEventListener('load', doPrint, { once: true });
  setTimeout(doPrint, 1500);
}
