import { format, isSameDay } from 'date-fns';
import { formatCurrency } from "@/lib/utils";

export const generateReportHtml = (
    reportData: any, 
    globalData: any, 
    startDate: Date, 
    endDate: Date
) => {
    const escapeHtml = (value?: string | null) => {
        if (!value) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    };

    const dateRangeText = isSameDay(startDate, endDate)
        ? format(startDate, 'dd MMM yyyy')
        : `${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`;

    const companyName = globalData.receiptSettings?.companyName || 'Daily Business Report';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(companyName)} - ${dateRangeText}</title>
            <style>
                body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; margin: 0; padding: 20px; line-height: 1.2; background: #fff; letter-spacing: -0.01em; }
                .header { text-align: left; border-bottom: 3.5px solid #1a365d; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
                .header-left h1 { margin: 0; color: #1a365d; font-size: 32px; font-weight: 900; letter-spacing: -0.04em; line-height: 0.9; }
                .header-left p { margin: 8px 0 0 0; color: #64748b; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
                .header-right { text-align: right; color: #94a3b8; font-size: 9px; font-weight: 600; text-transform: uppercase; }

                .section { margin-bottom: 45px; page-break-inside: auto !important; margin-top: 35px; }
                .section-title { font-size: 11px; font-weight: 900; color: #ffffff; background: #334155 !important; padding: 8px 12px; margin-bottom: 0px; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px 4px 0 0; -webkit-print-color-adjust: exact; }
                
                .v-ledger-table { width: 100%; border-collapse: collapse; margin-top: 0px; margin-bottom: 0px; border: 0.5px solid #cbd5e1; table-layout: fixed; }
                .v-ledger-table th { background: #334155 !important; color: #ffffff !important; padding: 7px 5px; font-size: 8.5px; border: 0.5px solid #ffffff33; text-transform: uppercase; font-weight: 900; letter-spacing: 0.2px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .v-ledger-table td { padding: 5px 4px; font-size: 9px; border: 0.5px solid #cbd5e1; text-align: center; color: #0f172a; font-weight: 500; }
                .v-ledger-table tr:nth-child(even) { background: #fcfcfc; }
                
                .v-header-label { background: #334155 !important; color: white; padding: 8px 12px; font-weight: 900; font-size: 11px; display: flex; justify-content: space-between; border: 1px solid #334155; border-bottom: none; margin-top: 30px; margin-bottom: 0px; border-radius: 4px 4px 0 0; -webkit-print-color-adjust: exact; }
                
                .row-main { font-weight: 800; color: #0f172a; font-size: 10px; }
                .row-sub { font-size: 8px; color: #64748b; font-weight: 600; }
                .val-label { color: #2563eb; font-weight: 900; }
                .cut-label { color: #dc2626; font-weight: 900; }
                
                .total-row { background: #1e293b !important; color: white !important; font-weight: 900 !important; }
                .total-row td { border-color: #334155; color: white !important; font-weight: 900; font-size: 10px; }
                .total-row .row-sub { color: #cbd5e1 !important; }

                .result-box { display: flex; gap: 20px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
                .result-item { flex: 1; text-align: center; }
                .result-item label { display: block; font-size: 10px; font-weight: 900; color: #64748b; margin-bottom: 5px; text-transform: uppercase; }
                .result-item span { font-size: 18px; font-weight: 900; }
                .positive { color: #059669; }
                .negative { color: #dc2626; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-left">
                    <h1>${escapeHtml(companyName)}</h1>
                    <p>360° Business Audit Report | Period: ${dateRangeText}</p>
                </div>
                <div class="header-right">
                    Generated: ${new Date().toLocaleString('en-IN')}<br>
                    Business Intelligence Dashboard
                </div>
            </div>

            <div class="section">
                <div class="section-title">Section A: Opening Period Liquidity Asset</div>
                <table class="v-ledger-table">
                    <thead>
                        <tr>
                            <th>ASSET NAME</th>
                            <th style="text-align: right;">VALUE (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Cash in Hand</td><td style="text-align: right;">${Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</td></tr>
                        <tr class="total-row"><td>TOTAL OPENING ASSETS</td><td style="text-align: right;">${Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Section B: Variety-Wise Procurement (Stock In)</div>
                <table class="v-ledger-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Variety</th>
                            <th style="text-align: right;">Total Qty (QTL)</th>
                            <th style="text-align: right;">Avg Rate (₹)</th>
                            <th style="text-align: right;">Purchase Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.purchases.map((p: any) => `
                            <tr>
                                <td style="text-align: left; font-weight: 600;">${p.variety}</td>
                                <td style="text-align: right;">${p.totalQty.toFixed(2)}</td>
                                <td style="text-align: right;">${formatCurrency(p.avgRate)}</td>
                                <td style="text-align: right; font-weight: 700;">${formatCurrency(p.totalValue)}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td style="text-align: left;">CONSOLIDATED PROCUREMENT</td>
                            <td style="text-align: right;">${reportData.purchases.reduce((s: number, p: any) => s + p.totalQty, 0).toFixed(2)}</td>
                            <td style="text-align: right;">-</td>
                            <td style="text-align: right;">${formatCurrency(reportData.purchases.reduce((s: number, p: any) => s + p.totalValue, 0))}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Section C: Financial Outflow Distribution</div>
                <table class="v-ledger-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Distribution Category</th>
                            <th style="text-align: right;">Cash Payout (₹)</th>
                            <th style="text-align: right;">RTGS/Bank (₹)</th>
                            <th style="text-align: right;">Total (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="text-align: left;">Farmer Payments</td>
                            <td style="text-align: right;">${formatCurrency(reportData.distribution.supplierCash)}</td>
                            <td style="text-align: right;">${formatCurrency(reportData.distribution.supplierRtgs)}</td>
                            <td style="text-align: right; font-weight: 700;">${formatCurrency(reportData.distribution.totalPayments)}</td>
                        </tr>
                        <tr>
                            <td style="text-align: left;">Operational Expenses</td>
                            <td style="text-align: right;">${formatCurrency(reportData.distribution.expenses)}</td>
                            <td style="text-align: right;">-</td>
                            <td style="text-align: right; font-weight: 700;">${formatCurrency(reportData.distribution.expenses)}</td>
                        </tr>
                        <tr class="total-row">
                            <td style="text-align: left;">NET PERIOD OUTFLOW</td>
                            <td colspan="3" style="text-align: right; font-size: 14px;">${formatCurrency(reportData.distribution.totalPayments + reportData.distribution.expenses)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Section D: Internal Inflow & Income</div>
                <table class="v-ledger-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Revenue Category</th>
                            <th style="text-align: right;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style="text-align: left;">Direct Incomes (Misc/Other)</td><td style="text-align: right;">${formatCurrency(reportData.distribution.incomes)}</td></tr>
                        <tr class="total-row"><td>TOTAL PERIOD INCOME</td><td style="text-align: right;">${formatCurrency(reportData.distribution.incomes)}</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="section" style="page-break-before: always;">
                <div class="section-title">Section E: 360° Audit Matrix Ledger (Incomes/Expenses)</div>
                <table class="v-ledger-table" style="table-layout: auto;">
                    <thead>
                        <tr>
                            <th style="text-align: left; width: 12%;">Date</th>
                            <th style="text-align: left; width: 25%;">Particular</th>
                            <th style="text-align: left; width: 33%;">Detail</th>
                            <th style="text-align: right; width: 15%;">Debit (EXP)</th>
                            <th style="text-align: right; width: 15%;">Credit (INC)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.audit360.map((r: any) => `
                            <tr>
                                <td style="text-align: left; font-weight: 700;">${format(new Date(r.date), 'dd/MM/yyyy')}</td>
                                <td style="text-align: left; font-weight: 600;">${escapeHtml(r.particular)}</td>
                                <td style="text-align: left; color: #64748b; font-size: 8px;">${escapeHtml(r.detail)}</td>
                                <td style="text-align: right; font-weight: 800; color: #dc2626;">${r.debit > 0 ? r.debit.toLocaleString('en-IN') : '-'}</td>
                                <td style="text-align: right; font-weight: 800; color: #059669;">${r.credit > 0 ? r.credit.toLocaleString('en-IN') : '-'}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td colspan="3" style="text-align: left;">CONSOLIDATED AUDIT TOTALS</td>
                            <td style="text-align: right;">${reportData.audit360.reduce((s: number, r: any) => s + r.debit, 0).toLocaleString('en-IN')}</td>
                            <td style="text-align: right;">${reportData.audit360.reduce((s: number, r: any) => s + r.credit, 0).toLocaleString('en-IN')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Section F: Audited Sales Recap</div>
                <table class="v-ledger-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Variety Name</th>
                            <th style="text-align: right;">Qty Sold (QTL)</th>
                            <th style="text-align: right;">Value (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.sales.map((v: any) => `
                            <tr>
                                <td style="text-align: left; font-weight: 600;">${v.variety}</td>
                                <td style="text-align: right;">${v.totalQty.toFixed(2)}</td>
                                <td style="text-align: right; font-weight: 700;">${formatCurrency(v.totalValue)}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td style="text-align: left;">NET SALES SUMMARY</td>
                            <td style="text-align: right;">${reportData.sales.reduce((s: number, v: any) => s + v.totalQty, 0).toFixed(2)}</td>
                            <td style="text-align: right;">${formatCurrency(reportData.sales.reduce((s: number, v: any) => s + v.totalValue, 0))}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="section" style="page-break-before: always;">
                <div class="section-title">Section G: Net Business Result</div>
                <div class="result-box">
                    <div class="result-item">
                        <label>DAILY NET FLOW</label>
                        <span class="${reportData.result.netFlow >= 0 ? 'positive' : 'negative'}">
                            ${formatCurrency(reportData.result.netFlow)}
                        </span>
                    </div>
                    <div class="result-item">
                        <label>STOCK DELTA (In vs Out)</label>
                        <span class="${reportData.result.stockDelta >= 0 ? 'positive' : 'negative'}">
                            ${reportData.result.stockDelta.toFixed(2)} QTL
                        </span>
                    </div>
                </div>
            </div>

            <div class="section" style="page-break-before: always;">
                <div class="section-title">Section H: Consolidated Transaction Trail</div>
                <table class="v-ledger-table" style="table-layout: auto;">
                    <thead>
                        <tr>
                            <th style="text-align: left; width: 8%;">Date</th>
                            <th style="text-align: left; width: 10%;">Type</th>
                            <th style="text-align: left; width: 38%;">Particulars</th>
                            <th style="text-align: left; width: 10%;">Ref ID</th>
                            <th style="text-align: right; width: 12%;">Debit (DR)</th>
                            <th style="text-align: right; width: 12%;">Credit (CR)</th>
                            <th style="text-align: right; width: 10%;">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(() => {
                            let runningBal = 0;
                            return reportData.consolidatedLedger.map((t: any) => {
                                runningBal += (t.credit - t.debit);
                                const typeColors: Record<string, {bg: string, color: string}> = {
                                    'Purchase':         { bg: '#fee2e2', color: '#b91c1c' },
                                    'Labour':           { bg: '#f0fdf4', color: '#15803d' },
                                    'Kanta':            { bg: '#f0fdf4', color: '#15803d' },
                                    'Expense':          { bg: '#fef2f2', color: '#991b1b' },
                                    'Supplier Payment': { bg: '#fff1f2', color: '#be123c' },
                                    'Transfer Out':     { bg: '#fff7ed', color: '#9a3412' },
                                    'Transfer In':      { bg: '#f0fdfa', color: '#0f766e' },
                                    'Loan':             { bg: '#eef2ff', color: '#3730a3' },
                                    'Sale':             { bg: '#f0fdf4', color: '#14532d' },
                                    'Customer Receipt': { bg: '#f0fdf4', color: '#15803d' },
                                    'Income':           { bg: '#ecfdf5', color: '#064e3b' },
                                    'P ADJUSTMENT':     { bg: '#f0f9ff', color: '#075985' },
                                    'Liquid':           { bg: '#f8fafc', color: '#1e293b' },
                                };
                                const tc = typeColors[t.type] || { bg: '#f1f5f9', color: '#64748b' };
                                return `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="text-align: left; font-weight: 700;">${format(new Date(t.date), 'dd MMM')}</td>
                                        <td><span style="display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 7.5px; font-weight: 900; background: ${tc.bg}; color: ${tc.color};">${escapeHtml(t.type)}</span></td>
                                        <td style="text-align: left;">${escapeHtml(t.particulars)}</td>
                                        <td>${escapeHtml(t.id)}</td>
                                        <td style="text-align: right; color: #b91c1c;">${t.debit > 0 ? t.debit.toLocaleString('en-IN') : '-'}</td>
                                        <td style="text-align: right; color: #15803d;">${t.credit > 0 ? t.credit.toLocaleString('en-IN') : '-'}</td>
                                        <td style="text-align: right; font-weight: 900;">${Math.round(runningBal).toLocaleString('en-IN')}</td>
                                    </tr>
                                `;
                            }).join('');
                        })()}
                    </tbody>
                </table>
            </div>

            <div style="font-size: 10px; color: #94a3b8; margin-top: 50px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                BIZSUITE 360 AUDIT SYSTEM • SYSTEM GENERATED ON ${new Date().toLocaleString('en-IN')}
            </div>
        </body>
        </html>
    `;
};
