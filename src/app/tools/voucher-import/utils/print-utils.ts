import { format } from "date-fns";
import type { MandiHeaderSettings } from "@/lib/definitions";
import type { CombinedEntry } from "../types";
import { displayDate } from "@/lib/formatters";
import { REPORT_BASE_CSS } from "@/lib/styles/report-styles";

const escapeHtml = (text?: string | null) => {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const generatePrintHtml = (
  source: CombinedEntry[],
  headerSettings: MandiHeaderSettings,
  isPreview: boolean
) => {
  const effectiveFirmName = headerSettings.firmName || "M/S JAGDAMBE RICE MILL";
  const firmAddressLine = headerSettings.firmAddress || "";
  const effectiveMandiName = headerSettings.mandiName || "";
  const effectiveLicense = headerSettings.licenseNo || "";
  const effectiveLicense2 = headerSettings.licenseNo2 || "";
  const effectiveMandiType = headerSettings.mandiType || "NON AMPC";
  const effectiveRegister = headerSettings.registerNo || "";
  const effectiveCommodity = headerSettings.commodity || "";
  const effectiveFinancialYear = headerSettings.financialYear || "";

  const commodityLabel = effectiveCommodity ? effectiveCommodity.toUpperCase() : "QUANTITY (QTL)";
  const districtInfo = source[0]?.district && source[0]?.tehsil 
    ? `${source[0].district} / ${source[0].tehsil}`
    : source[0]?.district || source[0]?.tehsil || "";

  const rowsHtml = source
    .map((entry, index) => {
      const totalMandiFee =
        entry.totalCharges ||
        Math.round(
          ((entry.mandiFee || 0) + (entry.developmentCess || 0)) * 100
        ) / 100;
        
      const farmerLine = [
        entry.sellerName,
        entry.fatherName ? `S/O: ${entry.fatherName}` : undefined,
        entry.village,
      ]
        .filter(Boolean)
        .join(", ");

      const utrValueRaw = entry.transactionNumber || entry.narration || "";
      const cleanedUtr = utrValueRaw.replace(/\D/g, "");
      const utrValue = cleanedUtr && (cleanedUtr.length === 5 || cleanedUtr.length === 6) && /^\d+$/.test(cleanedUtr)
        ? "TRANSFER" 
        : utrValueRaw;

      return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td style="text-align: center; white-space: nowrap;">${displayDate(entry.purchaseDate)}</td>
          <td>${escapeHtml(farmerLine)}</td>
          <td style="text-align: center; white-space: nowrap;">${escapeHtml(entry.mobile)}</td>
          <td style="text-align: center; white-space: nowrap;">${escapeHtml(entry.khasraNo)}</td>
          <td style="text-align: center; white-space: nowrap;">${escapeHtml(entry.voucherNo)}</td>
          <td class="numeric">${(entry.quantityQtl || 0).toFixed(2)}</td>
          <td class="numeric">${(entry.ratePerQtl || 0).toFixed(0)}</td>
          <td class="numeric">${(entry.grossAmount || 0).toFixed(0)}</td>
          <td class="numeric">${(entry.mandiFee || 0).toFixed(0)}</td>
          <td class="numeric">${(entry.developmentCess || 0).toFixed(0)}</td>
          <td class="numeric">${totalMandiFee.toFixed(0)}</td>
          <td style="text-align: center; white-space: nowrap;">${displayDate(entry.paymentDate)}</td>
          <td style="text-align: center; white-space: nowrap;">${escapeHtml(entry.bankAccount)}</td>
          <td style="text-align: center; white-space: nowrap;">${escapeHtml(entry.ifsc)}</td>
          <td style="text-align: center; white-space: nowrap;">${escapeHtml(utrValue)}</td>
        </tr>
      `;
    })
    .join("");

  const previewToolbar = isPreview
    ? `
    <div class="preview-toolbar">
      <div class="toolbar-title">REPORT PREVIEW MODE</div>
      <button class="print-btn" onclick="window.print()">PRINT NOW</button>
    </div>`
    : "";

  return `
    <html>
      <head>
        <title>Mandi Report - ${effectiveFirmName}</title>
        <style>${REPORT_BASE_CSS}</style>
      </head>
      <body>
        ${previewToolbar}
        <header class="report-header">
           <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h1 class="firm-name">${escapeHtml(effectiveFirmName)}</h1>
                <div class="firm-sub">${escapeHtml(firmAddressLine)}</div>
              </div>
              <div style="text-align: right; display: flex; flex-direction: column; gap: 4px;">
                <div class="chip" style="background: #0f172a; color: white;">IKAI: ${escapeHtml(effectiveLicense)}</div>
                <div class="chip" style="background: #0f172a; color: white;">TRADE: ${escapeHtml(effectiveLicense2)}</div>
              </div>
           </div>
           <div class="header-chips">
              <div class="chip">FY: ${escapeHtml(effectiveFinancialYear)}</div>
              <div class="chip">REG: ${escapeHtml(effectiveRegister)}</div>
              <div class="chip">${escapeHtml(effectiveCommodity)}</div>
              <div class="chip">MANDI: ${escapeHtml(effectiveMandiName)}</div>
              <div class="chip">RECORDS: ${source.length}</div>
           </div>
        </header>
        <main>
          <table>
            <thead>
              <tr>
                <th>SR</th><th>DATE</th><th>FARMER DETAILS</th><th>MOBILE</th><th>KHASRA</th><th>6R NO</th><th>QTY</th><th>RATE</th><th>AMT</th><th>FEE</th><th>CESS</th><th>TOTAL</th><th>PAY DATE</th><th>ACC NO</th><th>IFSC</th><th>UTR</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </main>
      </body>
    </html>
  `;
};
