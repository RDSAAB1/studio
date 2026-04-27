import { format } from 'date-fns';
import { formatCurrency, formatDisplayDate } from "@/lib/utils";
import type { CustomerSummary } from "@/lib/definitions";
import { generateStatementAsync, type StatementData, type StatementTransaction } from "./statement-generator";

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
                        border-bottom: 2px dashed #cbd5e1;
                    }
                    .statement-page:last-child { 
                        border-bottom: none; 
                        margin-bottom: 0;
                        padding-bottom: 0;
                    }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #cbd5e1; }
                    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; font-size: 12px; color: #475569; }
                    th { background-color: #f8fafc; font-weight: 600; color: #475569; border: 1px solid #cbd5e1; }
                    
                    .header { margin-bottom: 15px; }
                    .header h1 { font-size: 20px; margin: 0 0 5px 0; color: #334155; }
                    .header p { font-size: 14px; margin: 2px 0; color: #334155; }
                    
                    .particulars-column { 
                        font-family: 'Courier New', monospace !important; 
                        font-size: 11px !important; 
                        line-height: 1.2 !important; 
                        white-space: pre !important; 
                        width: 43%;
                        color: #000;
                    }
                    
                    .amount-column { text-align: right; width: 12%; font-weight: 500; font-size: 11px !important; }
                    .cd-column { text-align: right; width: 8%; font-weight: 500; font-size: 11px !important; }
                    .balance-column { text-align: right; width: 13%; font-weight: 500; font-size: 12px !important; }
                    .date-column { width: 12%; color: #64748b; font-weight: 500; font-size: 11px !important; }
                    
                    .totals-row { background-color: #f8fafc; font-weight: 600; color: #475569; }
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
                    .receipts-table th, .receipts-table td { font-size: 10px !important; color: #64748b !important; padding: 2px 4px !important; line-height: 1.2 !important; border: 1px solid #cbd5e1 !important; font-weight: 500; }
                    .receipts-table th { font-weight: 600 !important; color: #475569 !important; background-color: #f8fafc !important; }
                    .receipts-table tfoot td { font-size: 11px !important; font-weight: 700 !important; color: #475569 !important; }

                    @media print {
                        .no-print { display: none !important; }
                        th, td { border: 1px solid #cbd5e1 !important; }
                        th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
                        .totals-row { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
    `;

    for (let i = 0; i < suppliers.length; i++) {
        const supplier = suppliers[i];
        if (onProgress) {
            onProgress({ current: i + 1, total: suppliers.length, supplierName: supplier.name || 'Unknown' });
        }

        const statementData = await generateStatementAsync(supplier);
        const { transactions, totals } = statementData;

        // Build individual statement HTML
        combinedHtml += `
            <div class="statement-page">
                <div style="border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 15px; display: flex; align-items: flex-end;">
                    <h1 style="margin: 0; text-transform: uppercase; font-weight: 700; font-size: 24px; letter-spacing: -1px; color: #334155;">Account Statement</h1>
                </div>

                <div style="border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
                    <div style="display: flex; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <div style="font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Account Holder</div>
                            <div style="font-size: 16px; font-weight: 700; color: #64748b; text-transform: uppercase;">${supplier.name || ''}</div>
                        </div>
                        <div style="flex: 1; border-left: 1px solid #e5e7eb; padding-left: 20px;">
                            <div style="font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Father Name (S/O)</div>
                            <div style="font-size: 16px; font-weight: 700; color: #64748b; text-transform: uppercase;">${supplier.so || 'N/A'}</div>
                        </div>
                    </div>
                    <div style="display: flex;">
                        <div style="flex: 1;">
                            <div style="font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Contact Details</div>
                            <div style="font-size: 12px; font-weight: 700; color: #64748b;">${supplier.contact || 'N/A'}</div>
                        </div>
                        <div style="flex: 1; border-left: 1px solid #e5e7eb; padding-left: 20px;">
                            <div style="font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Registered Address</div>
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">${supplier.address || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <!-- Professional 3-Column Summary Block -->
                <div style="border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 20px; border-radius: 4px; background: transparent;">
                    <div style="display: flex; gap: 20px;">
                        <!-- Column 1: Bill Info -->
                        <div style="flex: 1.2; border-right: 1px solid #e2e8f0; padding-right: 15px;">
                            <div style="font-size: 9px; color: #64748b; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase;">1. Purchase Details</div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Net Weight:</span><span style="font-weight: 600;">${(supplier.totalNetWeight || 0).toFixed(2)} kg</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Avg Rate:</span><span style="font-weight: 600;">${formatCurrency(supplier.averageRate || 0)}</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #ccc; padding-top: 4px; margin-top: 4px; font-weight: 700;"><span>Gross Total:</span><span>${formatCurrency(supplier.totalAmount || 0)}</span></div>
                        </div>

                        <!-- Column 2: Deductions -->
                        <div style="flex: 1.2; border-right: 1px solid #e2e8f0; padding-right: 15px;">
                            <div style="font-size: 9px; color: #64748b; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase;">2. Deductions</div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Karta & Lab:</span><span style="font-weight: 600;">${formatCurrency((supplier.totalKartaAmount || 0) + (supplier.totalLabouryAmount || 0))}</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Kanta & Other:</span><span style="font-weight: 600;">${formatCurrency((supplier.totalKanta || 0) + (supplier.totalOtherCharges || 0))}</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #ccc; padding-top: 4px; margin-top: 4px; color: #dc2626; font-weight: 700;"><span>Total Ded:</span><span>-${formatCurrency(supplier.totalDeductions || 0)}</span></div>
                        </div>

                        <!-- Column 3: Status -->
                        <div style="flex: 1.5;">
                            <div style="font-size: 9px; color: #64748b; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase;">3. Account Status</div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;"><span>Net Payable:</span><span style="font-weight: 700;">${formatCurrency(supplier.totalOriginalAmount || 0)}</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; color: #16a34a;"><span>Total Paid:</span><span style="font-weight: 700;">${formatCurrency(totals.totalPaid)}</span></div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 6px; color: #dc2626; font-weight: 700;"><span>Outstanding:</span><span>${formatCurrency(totals.outstanding)}</span></div>
                        </div>
                    </div>
                </div>

                ${supplier.allTransactions && supplier.allTransactions.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px;">Purchase Receipts Details</h3>
                    <table class="receipts-table" style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                        <thead>
                            <tr style="background-color: transparent;">
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: left;">SR No.</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: left;">Date</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: left;">Variety</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: left;">Vehicle</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">Term</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">Rate</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">Gross Wt.</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">Teir Wt.</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">Weight</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">K.Wt.</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">Net Wt.</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">Amount</th>
                                <th style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #0f172a;">Net Amt.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${supplier.allTransactions.map(tx => `
                                <tr>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; color: #475569;">${tx.srNo}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; white-space: nowrap; color: #475569;">${format(new Date(tx.date), 'dd-MMM-yy')}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; color: #475569;">${tx.variety || ''}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; color: #475569;">${tx.vehicleNo || ''}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #475569;">${tx.term || ''}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #475569;">${tx.rate?.toFixed(2)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #475569;">${tx.grossWeight?.toFixed(2) || '0.00'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #475569;">${tx.teirWeight?.toFixed(2) || '0.00'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #475569;">${tx.weight?.toFixed(2) || '0.00'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #475569;">${tx.kartaWeight?.toFixed(2) || '0.00'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #475569;">${tx.netWeight?.toFixed(2) || '0.00'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; color: #475569;">${formatCurrency(tx.amount || 0)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(tx.originalNetAmount || tx.netAmount || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background-color: transparent; font-weight: 700; color: #1e293b;">
                                <td colspan="6" style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; font-size: 8px;">GRAND TOTAL</td>
                                <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">${supplier.totalGrossWeight?.toFixed(2) || '0.00'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">${supplier.totalTeirWeight?.toFixed(2) || '0.00'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">${supplier.totalFinalWeight?.toFixed(2) || '0.00'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">${supplier.totalKartaWeight?.toFixed(2) || '0.00'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">${supplier.totalNetWeight?.toFixed(2) || '0.00'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right;">${formatCurrency(supplier.totalAmount || 0)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 1px 2px; text-align: right; font-size: 8px;">${formatCurrency(supplier.totalOriginalAmount || 0)}</td>
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
                            <th class="amount-column text-red">Debit</th>
                            <th class="amount-column text-green">Paid</th>
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
                    <td class="particulars-column">${t.particulars}</td>
                    <td class="amount-column ${t.debit > 0 ? 'text-red' : ''}">${t.debit > 0 ? formatCurrency(t.debit) : '-'}</td>
                    <td class="amount-column ${t.creditPaid > 0 ? 'text-green' : ''}">${t.creditPaid > 0 ? formatCurrency(t.creditPaid) : '-'}</td>
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
                            <td class="amount-column text-red">${formatCurrency(transactions.reduce((sum, t) => sum + t.debit, 0))}</td>
                            <td class="amount-column text-green">${formatCurrency(transactions.reduce((sum, t) => sum + t.creditPaid, 0))}</td>
                            <td class="amount-column text-purple">${formatCurrency(transactions.reduce((sum, t) => sum + t.creditCd, 0))}</td>
                            <td class="amount-column text-orange">${formatCurrency(totals.outstanding)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }

    combinedHtml += `
            </body>
        </html>
    `;

    return combinedHtml;
};
