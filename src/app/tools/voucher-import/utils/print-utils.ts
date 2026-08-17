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
          <td class="numeric">${(entry.mandiFee || 0).toFixed(2)}</td>
          <td class="numeric">${(entry.developmentCess || 0).toFixed(2)}</td>
          <td class="numeric">${totalMandiFee.toFixed(2)}</td>
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
                <div class="chip" style="background: #0f172a; color: white;">मिल: ${escapeHtml(effectiveLicense)}</div>
                <div class="chip" style="background: #0f172a; color: white;">थोक व्यापारी एवं आढ़तिया: ${escapeHtml(effectiveLicense2)}</div>
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

export const generateOfficial6RPrintHtml = (
  source: CombinedEntry[],
  headerSettings: MandiHeaderSettings
) => {
  const slipsHtml = source.map((entry) => {
    const bookNo = entry.bookNo || (voucherNo.includes("(") ? voucherNo.split("(")[0] : "—");
    const voucherNoVal = voucherNo;
    const mandiName = entry.mandiName || headerSettings.mandiName || "Powayan";
    const buyerFirm = entry.buyerFirm || headerSettings.firmName || "JAGDAMBE RICE MILL";
    const buyerLicense = entry.buyerLicense || headerSettings.licenseNo || "L/2024/190/35040315";
    const purchaseDate = displayDate(entry.purchaseDate).replace(/-/g, "/");
    const mandiSiteType = entry.mandiSiteType || headerSettings.mandiType || "उपमण्डी स्थल";
    const mandiSiteName = entry.mandiSiteName || "Banda";
    const sellerName = entry.sellerName || "—";
    const fatherName = entry.fatherName || "—";
    let district = entry.district || "";
    if (!district || district === "NA" || district === "—" || district === "-") {
      district = "Shahjahanpur (शाहजहाँपुर)";
    }
    let tehsil = entry.tehsil || "";
    if (!tehsil || tehsil === "NA" || tehsil === "—" || tehsil === "-") {
      tehsil = "Powayan";
    }
    const village = entry.village || "—";
    const khasraNo = entry.khasraNo || "—";
    const khasraArea = entry.khasraArea || "—";
    const mobile = entry.mobile || "—";
    const commodity = entry.commodity || "धान";
    const variety = entry.variety || "—";
    const quantity = (entry.quantityQtl || 0).toFixed(2);
    const rate = (entry.ratePerQtl || 0).toFixed(2);
    const grossVal = (entry.grossAmount || 0).toFixed(2);
    const netVal = (entry.paymentAmount || entry.grossAmount || 0).toFixed(2);
    const feeVal = (entry.mandiFee || 0).toFixed(2);
    const cessVal = (entry.developmentCess || 0).toFixed(2);
    const totalMandiVal = ((entry.mandiFee || 0) + (entry.developmentCess || 0)).toFixed(2);
    const qrData = `SerialNo:${entry.voucherNo || ""},Date of Issue:${purchaseDate},Crop:${commodity},Mandi:${mandiName},InstrumentType:6R,http://emandi.up.gov.in/`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&ecc=M&data=${encodeURIComponent(qrData)}`;

    const renderPanel = (copyTitle: string) => `
      <div class="panel">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0px;">
          <div style="width: 85px; height: 85px; margin-left: 8px;">
            <img src="/up_mandi_logo.png" style="width: 85px; height: 85px; object-fit: contain; border: none; display: block;" alt="UP Mandi Logo" />
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
            <td class="value" style="font-size: 10px; font-weight: bold;">${voucherNoVal}</td>
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
            <td class="value" colspan="3" style="font-weight: bold; color: black;">${entry.sellerType || "भू-स्वामी उत्पादक"}</td>
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

  return `
    <html>
      <head>
        <title>eMandi 6R Slips Bulk Print</title>
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
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
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
      </head>
      <body>
        ${slipsHtml}
      </body>
    </html>
  `;
};
