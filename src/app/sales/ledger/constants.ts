export type StatementRow = {
  date: string;
  supplierCash: number;
  supplierRtgs: number;
  supplierPayments: number;
  incomes: number;
  expenses: number;
  seCash: number;
  netTotal: number;
};

export const STATEMENT_PRINT_ID = "statement-print-area";

export const STATEMENT_PRINT_STYLES = `
@page {
  size: A4 portrait;
  margin: 18mm;
}

.print-only {
  display: none;
}

@media print {
  body {
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
  }
  body * {
    visibility: hidden !important;
  }
  #${STATEMENT_PRINT_ID},
  #${STATEMENT_PRINT_ID} * {
    visibility: visible !important;
  }
  #${STATEMENT_PRINT_ID} {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    padding: 0 !important;
    background: #ffffff !important;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    color: #0f172a !important;
  }
  #${STATEMENT_PRINT_ID} .print-card {
    border: none !important;
    box-shadow: none !important;
  }
  #${STATEMENT_PRINT_ID} .print-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    border-bottom: 1px solid #cbd5f5 !important;
    padding-bottom: 12px !important;
    margin-bottom: 16px !important;
  }
  #${STATEMENT_PRINT_ID} .print-header h1 {
    font-size: 20px !important;
    font-weight: 600 !important;
    margin: 0 !important;
  }
  #${STATEMENT_PRINT_ID} .print-meta-line {
    margin: 4px 0 0 0 !important;
    font-size: 11px !important;
    color: #475569 !important;
  }
  #${STATEMENT_PRINT_ID} .print-meta {
    text-align: right !important;
    font-size: 11px !important;
    color: #475569 !important;
  }
  #${STATEMENT_PRINT_ID} .print-summary-table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin-bottom: 18px !important;
    font-size: 12px !important;
  }
  #${STATEMENT_PRINT_ID} .print-summary-table th {
    text-align: left !important;
    font-weight: 600 !important;
    padding: 6px 8px !important;
    background: #eef2ff !important;
    border: 1px solid #cbd5f5 !important;
  }
  #${STATEMENT_PRINT_ID} .print-summary-table td {
    padding: 6px 8px !important;
    border: 1px solid #cbd5f5 !important;
  }
  #${STATEMENT_PRINT_ID} .print-summary-table td.amount-cell {
    text-align: right !important;
    font-weight: 600 !important;
  }
  #${STATEMENT_PRINT_ID} .print-summary-table tr:nth-child(even) {
    background: #f8fafc !important;
  }
  #${STATEMENT_PRINT_ID} .print-summary-table tr.total-row th,
  #${STATEMENT_PRINT_ID} .print-summary-table tr.total-row td {
    background: #1e3a8a !important;
    color: #ffffff !important;
    border-color: #1e3a8a !important;
  }
  #${STATEMENT_PRINT_ID} table {
    border-collapse: collapse !important;
    width: 100% !important;
    font-size: 12px !important;
  }
  #${STATEMENT_PRINT_ID} thead {
    background: #eef2ff !important;
    color: #1e293b !important;
  }
  #${STATEMENT_PRINT_ID} tbody tr:nth-child(even) {
    background: #f8fafc !important;
  }
  #${STATEMENT_PRINT_ID} th,
  #${STATEMENT_PRINT_ID} td {
    border: 1px solid #cbd5f5 !important;
    padding: 8px 10px !important;
    text-align: right !important;
  }
  #${STATEMENT_PRINT_ID} th:first-child,
  #${STATEMENT_PRINT_ID} td:first-child {
    text-align: left !important;
  }
  #${STATEMENT_PRINT_ID} .print-footer {
    display: flex !important;
    justify-content: space-between !important;
    margin-top: 24px !important;
    font-size: 11px !important;
    color: #475569 !important;
  }
  #${STATEMENT_PRINT_ID} .print-signature {
    margin-top: 28px !important;
    border-top: 1px solid #cbd5f5 !important;
    padding-top: 6px !important;
    text-align: center !important;
    width: 180px !important;
  }
  .print-hidden {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
}
`;

