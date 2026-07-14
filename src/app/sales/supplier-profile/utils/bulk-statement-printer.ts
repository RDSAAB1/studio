import { format } from 'date-fns';
import { formatCurrency, formatDisplayDate } from "@/lib/utils";
import type { CustomerSummary } from "@/lib/definitions";
import { generateStatementAsync, type StatementData, type StatementTransaction } from "./statement-generator";
import { renderParticularsHtml } from "../components/supplier-statement-preview";

/**
 * Utility to generate a combined printable HTML for multiple supplier statements.
 * Each statement starts on a new page.
 */

export interface BulkStatementProgress {
    current: number;
    total: number;
    supplierName: string;
}

export const generateBulkStatementHtml = async (
    suppliers: CustomerSummary[],
    onProgress?: (progress: BulkStatementProgress) => void,
    type: 'supplier' | 'customer' = 'supplier'
): Promise<string> => {
    const isCustomer = type === 'customer';
    
    let combinedHtml = `
        <html>
            <head>
                <title>Bulk Account Statements</title>
                <style>
                    @page { margin: 10mm 8mm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .statement-page { 
                        page-break-inside: avoid; 
                        break-inside: avoid;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 2px dashed #d1d5db;
                    }
                    .statement-page:last-child { 
                        border-bottom: none; 
                        margin-bottom: 0;
                        padding-bottom: 0;
                    }
                    
                    .index-page {
                        page-break-after: always;
                        margin-bottom: 40px;
                    }

                    table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #d1d5db; page-break-inside: auto; }
                    th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; font-size: 11px; color: #374151; }
                    th { background-color: #f3f4f6; font-weight: 600; color: #374151; border: 1px solid #d1d5db; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    tr { page-break-inside: avoid; }
                    
                    .header { margin-bottom: 15px; }
                    .header h1 { font-size: 20px; margin: 0 0 5px 0; color: #1f2937; }
                    .header p { font-size: 14px; margin: 2px 0; color: #1f2937; }
                    
                    .particulars-column { 
                        font-size: 10px !important; 
                        line-height: 1.2 !important; 
                        width: 43%;
                        color: #000;
                    }
                    
                    .amount-column { text-align: right; width: 12%; font-weight: 500; font-size: 10px !important; }
                    .cd-column { text-align: right; width: 8%; font-weight: 500; font-size: 10px !important; }
                    .balance-column { text-align: right; width: 13%; font-weight: 500; font-size: 11px !important; }
                    .date-column { width: 12%; color: #4b5563; font-weight: 500; font-size: 10px !important; }
                    
                    .totals-row { background-color: #f3f4f6; font-weight: 600; color: #374151; }
                    .text-red { color: #ef4444 !important; font-weight: 500; }
                    .text-green { color: #22c55e !important; font-weight: 500; }
                    .text-purple { color: #a855f7 !important; font-weight: 500; }
                    .text-orange { color: #f97316 !important; font-weight: 500; }

                    /* Simplified Summary Cards for Print */
                    .summary-grid { 
                        display: grid; 
                        grid-template-columns: repeat(4, 1fr); 
                        gap: 10px; 
                        margin-bottom: 20px; 
                    }
                    .summary-card { 
                        border: 1px solid #e5e7eb; 
                        padding: 8px; 
                        border-radius: 4px; 
                    }
                    .summary-label { font-size: 9px; color: #6b7280; text-transform: uppercase; }
                    .summary-value { font-size: 14px; font-weight: 600; color: #111827; }
                    .receipts-table th, .receipts-table td { font-size: 9px !important; color: #4b5563 !important; padding: 2px 4px !important; line-height: 1.2 !important; border: 1px solid #d1d5db !important; font-weight: 500; }
                    .receipts-table th { font-weight: 600 !important; color: #374151 !important; background-color: #f3f4f6 !important; }
                    .receipts-table tfoot td { font-size: 10px !important; font-weight: 700 !important; color: #374151 !important; }

                    @media print {
                        .no-print { display: none !important; }
                        th, td { border: 1px solid #d1d5db !important; }
                        th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
                        .totals-row { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
    `;

    // --- Generate Index Page ---
    let indexNetTotal = 0;
    let indexPaidTotal = 0;
    let indexCdTotal = 0;
    let indexOutstandingTotal = 0;

    combinedHtml += `
        <div class="index-page">
            <div style="border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="margin: 0; text-transform: uppercase; font-weight: 800; font-size: 28px; color: #1f2937;">Account Index Summary</h1>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #4b5563;">Generated for ${suppliers.length} ${isCustomer ? 'Customers' : 'Suppliers'} on ${format(new Date(), 'dd-MMM-yyyy HH:mm')}</p>
            </div>

            <table class="index-table">
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">S.N.</th>
                        <th>Account Details (Name, S/O, Address)</th>
                        <th style="text-align: right; width: 85px;">Net Amt.</th>
                        <th style="text-align: right; width: 85px;">${isCustomer ? 'Received Amt.' : 'Paid Amt.'}</th>
                        <th style="text-align: right; width: 65px;">CD</th>
                        <th style="text-align: right; width: 95px;">Outstanding</th>
                    </tr>
                </thead>
                <tbody>
    `;

    suppliers.forEach((s, idx) => {
        const netAmt = s.totalOriginalAmount || 0;
        const paidAmt = s.totalPaid || 0;
        const cdAmt = s.totalCdAmount || s.totalCd || 0;
        const outstanding = s.totalOutstanding || 0;

        indexNetTotal += netAmt;
        indexPaidTotal += paidAmt;
        indexCdTotal += cdAmt;
        indexOutstandingTotal += outstanding;

        const fatherName = s.so ? (s.so.toLowerCase().startsWith('s/o') ? s.so : `S/O ${s.so}`) : '';

        combinedHtml += `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="font-size: 11px; text-transform: uppercase; color: #000;">
                    <span style="font-weight: 700;">${s.name || ''}</span>
                    ${fatherName ? ` <span style="font-weight: 400;">(${fatherName})</span>` : ''}
                    ${s.address ? `, <span style="font-weight: 400; font-size: 10px;">${s.address}</span>` : ''}
                </td>
                <td style="text-align: right; font-weight: 500;">${formatCurrency(netAmt)}</td>
                <td style="text-align: right; font-weight: 500;">${formatCurrency(paidAmt)}</td>
                <td style="text-align: right; font-weight: 500;">${formatCurrency(cdAmt)}</td>
                <td style="text-align: right; font-weight: 700;">${formatCurrency(outstanding)}</td>
            </tr>
        `;
    });

    combinedHtml += `
                </tbody>
                <tfoot>
                    <tr style="background-color: #f3f4f6; font-weight: 800; color: #000;">
                        <td colspan="2" style="text-align: right;">GRAND TOTALS</td>
                        <td style="text-align: right;">${formatCurrency(indexNetTotal)}</td>
                        <td style="text-align: right;">${formatCurrency(indexPaidTotal)}</td>
                        <td style="text-align: right;">${formatCurrency(indexCdTotal)}</td>
                        <td style="text-align: right;">${formatCurrency(indexOutstandingTotal)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    // --- Generate Individual Statements ---
    for (let i = 0; i < suppliers.length; i++) {
        const supplier = suppliers[i];
        if (onProgress) {
            onProgress({ current: i + 1, total: suppliers.length, supplierName: supplier.name || 'Unknown' });
        }

        const statementData = await generateStatementAsync(supplier, undefined, type);
        const { transactions, totals } = statementData;

        // Build individual statement HTML
        combinedHtml += `
            <div class="statement-page">
                <div style="border-bottom: 1px solid #d1d5db; padding-bottom: 10px; margin-bottom: 15px; display: flex; align-items: flex-end;">
                    <h1 style="margin: 0; text-transform: uppercase; font-weight: 700; font-size: 24px; letter-spacing: -1px; color: #1f2937;">Account Statement</h1>
                </div>

                <div style="border: 1px solid #d1d5db; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
                    <div style="display: flex; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <div style="font-size: 9px; color: #4b5563; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Account Holder</div>
                            <div style="font-size: 16px; font-weight: 700; color: #4b5563; text-transform: uppercase;">${supplier.name || ''}</div>
                        </div>
                        <div style="flex: 1; border-left: 1px solid #e5e7eb; padding-left: 20px;">
                            <div style="font-size: 9px; color: #4b5563; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Father Name (S/O)</div>
                            <div style="font-size: 16px; font-weight: 700; color: #4b5563; text-transform: uppercase;">${supplier.so || 'N/A'}</div>
                        </div>
                    </div>
                    <div style="display: flex;">
                        <div style="flex: 1;">
                            <div style="font-size: 9px; color: #4b5563; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Contact Details</div>
                            <div style="font-size: 12px; font-weight: 700; color: #4b5563;">${supplier.contact || 'N/A'}</div>
                        </div>
                        <div style="flex: 1; border-left: 1px solid #e5e7eb; padding-left: 20px;">
                            <div style="font-size: 9px; color: #4b5563; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Registered Address</div>
                            <div style="font-size: 10px; font-weight: 700; color: #4b5563; text-transform: uppercase;">${supplier.address || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <!-- Professional 3-Column Summary Block -->
                <div style="border: 1px solid #d1d5db; padding: 12px; margin-bottom: 20px; border-radius: 4px; background: transparent;">
                    <div style="display: flex; gap: 20px;">
                        <!-- Column 1: Bill Info -->
                        <div style="flex: 1.2; border-right: 1px solid #e2e8f0; padding-right: 15px;">
                            <div style="font-size: 9px; color: #4b5563; font-weight: 700; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase;">${isCustomer ? '1. Sales Details' : '1. Purchase Details'}</div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Net Weight:</span><span style="font-weight: 600;">${Number(supplier.totalNetWeight || 0).toFixed(2)} kg</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Avg Rate:</span><span style="font-weight: 600;">${formatCurrency(supplier.averageRate || 0)}</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #ccc; padding-top: 4px; margin-top: 4px; font-weight: 700;"><span>Gross Total:</span><span>${formatCurrency(supplier.totalAmount || 0)}</span></div>
                        </div>

                        <!-- Column 2: Deductions -->
                        <div style="flex: 1.2; border-right: 1px solid #e2e8f0; padding-right: 15px;">
                            <div style="font-size: 9px; color: #4b5563; font-weight: 700; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase;">2. Deductions</div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Karta & Lab:</span><span style="font-weight: 600;">${formatCurrency((supplier.totalKartaAmount || 0) + (supplier.totalLabouryAmount || 0))}</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Kanta & Other:</span><span style="font-weight: 600;">${formatCurrency((supplier.totalKanta || 0) + (supplier.totalOtherCharges || 0))}</span></div>
                            
                            ${((supplier.ledgerCreditAmount || 0) > 0 || (supplier.ledgerDebitAmount || 0) > 0) ? `
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; color: #6d28d9;"><span>Ledger Impact:</span><span style="font-weight: 700; color: #6d28d9;">
                                ${isCustomer
                                    ? `${(supplier.ledgerDebitAmount || 0) >= (supplier.ledgerCreditAmount || 0) ? '+' : '-'}${formatCurrency(Math.abs((supplier.ledgerDebitAmount || 0) - (supplier.ledgerCreditAmount || 0)))}`
                                    : `${(supplier.ledgerCreditAmount || 0) >= (supplier.ledgerDebitAmount || 0) ? '+' : '-'}${formatCurrency(Math.abs((supplier.ledgerCreditAmount || 0) - (supplier.ledgerDebitAmount || 0)))}`
                                }
                            </span></div>
                            ` : ''}

                            <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #ccc; padding-top: 4px; margin-top: 4px; color: #dc2626; font-weight: 700;"><span>Total Ded:</span><span>-${formatCurrency(supplier.totalDeductions || 0)}</span></div>
                        </div>

                        <!-- Column 3: Status -->
                        <div style="flex: 1.5;">
                            <div style="font-size: 9px; color: #4b5563; font-weight: 700; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase;">3. Account Status</div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>${isCustomer ? 'Net Receivable' : 'Net Payable'}:</span><span style="font-weight: 700;">${formatCurrency(supplier.totalOriginalAmount || 0)}</span></div>
                            
                            ${(supplier.totalCdAmount || 0) > 0 ? `
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; color: #8b5cf6;"><span>CD Discount:</span><span style="font-weight: 700;">-${formatCurrency(supplier.totalCdAmount || 0)}</span></div>
                            ` : ''}
                            
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; color: #16a34a;"><span>${isCustomer ? 'Total Received' : 'Total Paid'}:</span><span style="font-weight: 700;">-${formatCurrency(totals.totalPaid)}</span></div>
                            
                            <div style="display: flex; justify-content: space-between; font-size: 14px; border-top: 1px solid #d1d5db; padding-top: 6px; margin-top: 6px; color: #dc2626; font-weight: 700;"><span>Outstanding:</span><span>${formatCurrency(totals.outstanding)}</span></div>
                        </div>
                    </div>
                </div>

                ${supplier.allTransactions && supplier.allTransactions.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px;">${isCustomer ? 'Sales Receipts Details' : 'Purchase Receipts Details'}</h3>
                    <table class="receipts-table" style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                        <thead>
                            <tr style="background-color: transparent;">
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: left;">SR No.</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: left;">Date</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: left;">Variety</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: left;">Vehicle</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">Term</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #ea580c;">Rate</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">Gross Wt.</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">Teir Wt.</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #ea580c;">Weight</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">K.Wt.</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">Net Wt.</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">Amount</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">Laboury</th>
                                <th style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #0f172a;">Net Amt.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${supplier.allTransactions.map(tx => `
                                <tr>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; color: #374151;">${tx.srNo}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; white-space: nowrap; color: #374151;">${format(new Date(tx.date), 'dd-MMM-yy')}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; color: #374151;">${tx.variety || ''}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; color: #374151;">${tx.vehicleNo || ''}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #374151;">${tx.term || ''}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #ea580c; font-weight: bold;">${Number(tx.rate || 0).toFixed(2)}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #374151;">${Number(tx.grossWeight || 0).toFixed(2)}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #374151;">${Number(tx.teirWeight || 0).toFixed(2)}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #ea580c; font-weight: bold;">${Number(tx.weight || 0).toFixed(2)}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #374151;">${Number(tx.kartaWeight || 0).toFixed(2)}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #374151;">${Number(tx.netWeight || 0).toFixed(2)}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #374151;">${formatCurrency(tx.amount || 0)}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #374151;">${formatCurrency(tx.labouryAmount || 0)}</td>
                                    <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(tx.originalNetAmount || tx.netAmount || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: transparent; font-weight: 700; color: #1f2937;">
                                <td colspan="6" style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; font-size: 8px;">GRAND TOTAL</td>
                                <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">${Number(supplier.totalGrossWeight || 0).toFixed(2)}</td>
                                <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">${Number(supplier.totalTeirWeight || 0).toFixed(2)}</td>
                                <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; color: #ea580c; font-weight: bold;">${Number(supplier.totalFinalWeight || 0).toFixed(2)}</td>
                                <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">${Number(supplier.totalKartaWeight || 0).toFixed(2)}</td>
                                <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">${Number(supplier.totalNetWeight || 0).toFixed(2)}</td>
                                <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">${formatCurrency(supplier.totalAmount || 0)}</td>
                                <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right;">${formatCurrency(supplier.totalLabouryAmount || 0)}</td>
                                <td style="border: 1px solid #d1d5db; padding: 1px 2px; text-align: right; font-size: 8px;">${formatCurrency(supplier.totalOriginalAmount || 0)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                ` : ''}

                <div>
                <table>
                    <thead>
                        <tr>
                            <th class="date-column">Date</th>
                            <th style="width: 43%">Particulars</th>
                            <th class="amount-column text-green">Credit</th>
                            <th class="amount-column text-red">Debit</th>
                            <th class="cd-column text-purple">CD</th>
                            <th class="balance-column text-orange">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let runningBalance = 0;
        transactions.forEach((t) => {
            runningBalance += (t.debit || 0) - (t.credit || 0);
            combinedHtml += `
                <tr>
                    <td class="date-column">${t.displayDate || t.date}</td>
                    <td class="particulars-column">${renderParticularsHtml(t.particulars, isCustomer)}</td>
                    <td class="amount-column ${isCustomer ? (t.creditPaid > 0 ? 'text-green' : '') : (t.debit > 0 ? 'text-green' : '')}">${isCustomer ? (t.creditPaid > 0 ? formatCurrency(t.creditPaid) : '-') : (t.debit > 0 ? formatCurrency(t.debit) : '-')}</td>
                    <td class="amount-column ${isCustomer ? (t.debit > 0 ? 'text-red' : '') : (t.creditPaid > 0 ? 'text-red' : '')}">${isCustomer ? (t.debit > 0 ? formatCurrency(t.debit) : '-') : (t.creditPaid > 0 ? formatCurrency(t.creditPaid) : '-')}</td>
                    <td class="cd-column ${t.creditCd > 0 ? 'text-purple' : ''}">${t.creditCd > 0 ? formatCurrency(t.creditCd) : '-'}</td>
                    <td class="balance-column text-orange">${formatCurrency(runningBalance)}</td>
                </tr>
            `;
        });

        combinedHtml += `
                    </tbody>
                    <tfoot>
                        <tr class="totals-row">
                            <td colspan="2">TOTALS</td>
                            <td class="amount-column text-green">${isCustomer ? formatCurrency(transactions.reduce((sum, t) => sum + t.creditPaid, 0)) : formatCurrency(transactions.reduce((sum, t) => sum + t.debit, 0))}</td>
                            <td class="amount-column text-red">${isCustomer ? formatCurrency(transactions.reduce((sum, t) => sum + t.debit, 0)) : formatCurrency(transactions.reduce((sum, t) => sum + t.creditPaid, 0))}</td>
                            <td class="amount-column text-purple">${formatCurrency(transactions.reduce((sum, t) => sum + t.creditCd, 0))}</td>
                            <td class="amount-column text-orange">${formatCurrency(totals.outstanding)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
        `;
    }

    combinedHtml += `
            </body>
        </html>
    `;

    return combinedHtml;
};
