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
        <body>
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

function printViaIframe(htmlContent: string, styles: string = '') {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  const fullHtml = `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; padding: 0; background: white !important; color: black !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    ${styles}
  </style></head><body>${htmlContent}</body></html>`;

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  // Copy app styles
  Array.from(document.styleSheets).forEach(styleSheet => {
    try {
      const style = iframeDoc.createElement('style');
      style.textContent = Array.from(styleSheet.cssRules).map(r => r.cssText).join('');
      iframeDoc.head.appendChild(style);
    } catch { /* CORS - skip */ }
  });

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 1000);
  };
  iframe.contentWindow?.addEventListener('load', doPrint, { once: true });
  setTimeout(doPrint, 800);
}
