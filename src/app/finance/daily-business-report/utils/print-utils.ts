import { format, isSameDay } from 'date-fns';
import { formatCurrency } from "@/lib/utils";

export const generateReportHtml = (
    reportData: any, 
    globalData: any, 
    startDate: Date, 
    endDate: Date,
    viewMode: 'DETAIL' | 'DATE_WISE' | 'OVERALL' = 'DATE_WISE'
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

    // TRANSACTION TRAIL LOGIC (MATCHING UI)
    const getProcessedData = (isCredit: boolean) => {
        const transactions = reportData.consolidatedLedger.filter((t: any) => isCredit ? t.credit > 0 : t.debit > 0);
        
        if (viewMode === 'DETAIL') {
            return transactions.map((t: any) => ({
                date: t.date,
                particulars: t.particulars,
                type: t.type,
                amount: isCredit ? t.credit : t.debit,
                count: 1
            })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }

        if (viewMode === 'OVERALL') {
            const groups: Record<string, { type: string; particulars: string; amount: number; count: number; extras: any }> = {};
            const ensure = (key: string, tag: string, p: string) => {
                if (!groups[key]) groups[key] = { type: tag, particulars: p, amount: 0, count: 0, extras: { lines: [] as string[], totalQty: 0, rateSum: 0, rateCount: 0, labour: 0, kanta: 0 } };
            };

            transactions.forEach((t: any) => {
                const amt = isCredit ? t.credit : t.debit;
                const raw = t.particulars;
                const type = t.type.split('::')[0];

                if (type === 'Purchase') {
                    ensure('Purchase', 'Purchase', 'Consolidated Stock Purchase');
                    groups['Purchase'].amount += amt;
                    groups['Purchase'].count += (t.count || 1);
                    const qtyMatch = raw.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                    if (qtyMatch) { groups['Purchase'].extras.totalQty += parseFloat(qtyMatch[1]); groups['Purchase'].extras.rateSum += parseFloat(qtyMatch[2]); groups['Purchase'].extras.rateCount += 1; }
                    const labMatch = raw.match(/Lab:\s*₹([\d.]+)/); if (labMatch) groups['Purchase'].extras.labour += parseFloat(labMatch[1]);
                    const kanMatch = raw.match(/Kan:\s*₹([\d.]+)/); if (kanMatch) groups['Purchase'].extras.kanta += parseFloat(kanMatch[1]);
                } else if (type === 'Labour' || type === 'Kanta') {
                    ensure(type, type, `Consolidated ${type} Charges`);
                    groups[type].amount += amt; groups[type].count += (t.count || 1);
                    if (raw) groups[type].extras.lines.push(raw);
                } else if (type === 'Sale') {
                    ensure('Sale', 'Sale', 'Consolidated Sales Receipts');
                    groups['Sale'].amount += amt; groups['Sale'].count += (t.count || 1);
                    const qtyMatch = raw.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                    if (qtyMatch) { groups['Sale'].extras.totalQty += parseFloat(qtyMatch[1]); groups['Sale'].extras.rateSum += parseFloat(qtyMatch[2]); groups['Sale'].extras.rateCount += 1; }
                } else if (type === 'Expense') {
                    // Extract Account Name: "[EX001] Kharch Khata" -> "Kharch Khata"
                    const accMatch = raw.match(/\]\s*(.*)/);
                    const accName = accMatch ? accMatch[1].trim() : 'Misc Expense';
                    const key = `EX::${accName}`;
                    ensure(key, 'EX', accName);
                    groups[key].amount += amt;
                    groups[key].count += (t.count || 1);
                    const detail = raw.split('|').slice(1).join('|').trim();
                    if (detail) groups[key].extras.lines.push(detail);
                } else {
                    ensure(type, type, `Consolidated ${type}`);
                    groups[type].amount += amt; groups[type].count += (t.count || 1);
                }
            });

            // Post-process Overall (Simplified for Print)
            Object.values(groups).forEach((g: any) => {
                if (g.type === 'Labour' || g.type === 'Kanta') {
                    const rateMap = new Map<string, { count: number, weight: number }>();
                    g.extras.lines.forEach((line: string) => {
                        line.split(' | ').forEach(part => {
                            const pMatch = part.match(/PARCHI-([\d.]+)@([\d.]+)/);
                            const wMatch = part.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                            if (pMatch) { const r = pMatch[2]; const ex = rateMap.get(r) || {count:0,weight:0}; rateMap.set(r, {...ex, count: ex.count + parseFloat(pMatch[1])}); }
                            else if (wMatch) { const r = wMatch[2]; const ex = rateMap.get(r) || {count:0,weight:0}; rateMap.set(r, {...ex, weight: ex.weight + parseFloat(wMatch[1])}); }
                        });
                    });
                    const sorted = Array.from(rateMap.entries()).slice(0, 2);
                    g.particulars = sorted.map(([r, d]) => d.weight > 0 ? `${d.weight.toFixed(2)}Q@₹${r}` : `P-${Math.round(d.count)}@${r}`).join(' | ') + (rateMap.size > 2 ? ` + ${rateMap.size - 2} more` : '');
                } else if (g.type === 'Purchase' || g.type === 'Sale') {
                    const avg = g.extras.rateCount > 0 ? (g.extras.rateSum / g.extras.rateCount).toFixed(0) : '0';
                    g.particulars = `${g.count} Recs | ${g.extras.totalQty.toFixed(2)} QTL @ ₹${avg}`;
                    if (g.type === 'Purchase') {
                        g.particulars += ` | Lab: ₹${Math.round(g.extras.labour)} | Kan: ₹${Math.round(g.extras.kanta)}`;
                    }
                } else if (g.type.includes('Transfer')) {
                    g.particulars = `${g.count} Records`;
                } else if (g.extras.lines && g.extras.lines.length > 0) {
                    const unique = [...new Set(g.extras.lines as string[])];
                    const summary = unique.join(' | ');
                    // particulars already contains the accName/category
                    if (summary) g.particulars = `${g.particulars} ( ${summary} )`;
                }
            });
            return Object.values(groups).sort((a: any, b: any) => a.type.localeCompare(b.type));
        }

        // DATE_WISE (Default)
        const grouped = new Map<string, any>();
        transactions.forEach((t: any) => {
            const dateStr = format(new Date(t.date), 'yyyy-MM-dd');
            const type = t.type.split('::')[0];
            const key = `${dateStr}||${type}||${t.particulars.split('::')[0]}`;
            if (!grouped.has(key)) {
                grouped.set(key, { date: t.date, type: t.type, particulars: t.particulars.split('::')[0], amount: 0, count: 0 });
            }
            const item = grouped.get(key);
            item.amount += isCredit ? t.credit : t.debit;
            item.count += (t.count || 1);
        });
        return Array.from(grouped.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    const inflows = getProcessedData(true);
    const outflows = getProcessedData(false);

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(companyName)} - 360° Audit</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@700&display=swap');
                
                @page { size: A4 landscape; margin: 5mm; }
                body { 
                    font-family: 'Inter', sans-serif; 
                    color: #0f172a; 
                    margin: 0; 
                    padding: 0; 
                    line-height: 1.3; 
                    font-size: 11px;
                    background: #fff;
                    -webkit-print-color-adjust: exact;
                }
                
                .header-card { background: #f1f5f9 !important; border: 1px solid #e2e8f0; color: #1e293b; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; margin-bottom: 10px; }
                .header-card h1 { margin: 0; font-size: 18.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; }
                .header-card p { margin: 0; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }

                .section-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px; break-inside: auto; overflow: hidden; }
                .section-header { background: #f8fafc !important; color: #1e293b !important; border-bottom: 1px solid #e2e8f0; padding: 6px 12px; font-size: 11.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center; }
                
                table { width: 100%; border-collapse: collapse; table-layout: fixed; break-inside: auto; }
                tr { break-inside: avoid; }
                th { background: #f8fafc !important; border: 1px solid #e2e8f0; padding: 4px 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #475569; }
                td { border: 1px solid #f1f5f9; padding: 3px 6px; vertical-align: middle; }
                
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .font-mono { font-family: 'JetBrains Mono', monospace; font-weight: 700; }
                .font-black { font-weight: 900; }
                
                /* Liquidity Styles */
                .liq-opening { color: #6366f1; font-weight: 700; }
                .liq-closing { color: #d97706; font-weight: 900; }
                .liq-income { color: #059669; font-weight: 900; }
                .liq-expense { color: #dc2626; font-weight: 900; }
                .liq-net { background: #ecfdf5 !important; color: #065f46; border: 1px solid #a7f3d0; padding: 1px 4px; border-radius: 2px; font-size: 9.5px; font-weight: 900; }

                /* Transaction Tag Styles */
                .tag { display: inline-block; width: 58px; text-align: center; padding: 2px 0; border-radius: 3px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #fff; }
                .tag-PURCH { background: #2563eb !important; } /* blue-600 */
                .tag-LABOUR { background: #ea580c !important; } /* orange-600 */
                .tag-KANTA { background: #ca8a04 !important; } /* yellow-600 */
                .tag-EX { background: #dc2626 !important; } /* red-600 */
                .tag-SP { background: #db2777 !important; } /* pink-600 */
                .tag-CUST { background: #059669 !important; } /* emerald-600 */
                .tag-SALE { background: #16a34a !important; } /* green-600 */
                .tag-IN { background: #0d9488 !important; } /* teal-600 */
                .tag-ADJ { background: #d97706 !important; } /* amber-600 */
                .tag-TRF { background: #0891b2 !important; } /* cyan-600 */
                .tag-TRF-↓ { background: #0d9488 !important; } /* teal-600 */
                .tag-TRF-↑ { background: #ea580c !important; } /* orange-600 */
                .tag-OPN { background: #475569 !important; } /* slate-600 */

                .part-main { font-size: 11px; font-weight: 700; color: #1e293b; display: block; }
                .part-sub  { font-size: 10px; font-weight: 600; color: #64748b; display: block; margin-top: 1px; padding-left: 6px; border-left: 2px solid #e2e8f0; }

                .footer-bar { background: #f8fafc !important; border-top: 1px solid #e2e8f0; color: #1e293b; padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; border-radius: 4px; }
                
                @media print {
                    .no-print { display: none; }
                    .page-break { page-break-before: always !important; break-before: page !important; }
                }
            </style>
        </head>
        <body>
            <div class="header-card">
                <div>
                    <h1>${escapeHtml(companyName)}</h1>
                    <p>360° Business Audit Report | PERIOD: ${dateRangeText}</p>
                </div>
                <div style="text-align: right;">
                    <p>GENERATED: ${new Date().toLocaleString('en-IN')}</p>
                    <p>BIZSUITE ERP SYSTEM | MODE: ${viewMode}</p>
                </div>
            </div>

            <!-- SECTION A: LIQUIDITY AUDIT MATRIX (2-ROW FORMAT) -->
            <div class="section-card">
                <div class="section-header">
                    <span>A: Liquidity Audit Matrix</span>
                    <span>Ledger Mode</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">DATE</th>
                            ${['Cash Hand', 'Cash Home', ...globalData.bankAccounts.map((a: any) => a.bankName)].map(name => `
                                <th colspan="2" style="border-right: 1px solid #e2e8f0;">${escapeHtml(name)}</th>
                            `).join('')}
                            <th style="width: 80px;">GRAND TOTAL</th>
                        </tr>
                        <tr style="font-size: 8.5px;">
                            <th></th>
                            ${['Cash Hand', 'Cash Home', ...globalData.bankAccounts.map((a: any) => a.bankName)].map(() => `
                                <th>OP / IN</th>
                                <th style="border-right: 1px solid #e2e8f0;">CL / OUT</th>
                            `).join('')}
                            <th>CLOSING</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.dayWiseLiquidity.map((d: any, i: number) => `
                            <!-- ROW 1: OP / CL -->
                            <tr style="background: #fff !important;">
                                <td rowspan="2" class="text-center font-black" style="border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">${d.date}</td>
                                ${['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id)].map(id => {
                                    const m = d.metrics[id] || { opening: 0, closing: 0, income: 0, expense: 0 };
                                    return `
                                        <td class="text-right font-mono liq-opening">${Math.round(m.opening).toLocaleString('en-IN')}</td>
                                        <td class="text-right font-mono liq-closing" style="border-right: 1px solid #e2e8f0;">${Math.round(m.closing || 0).toLocaleString('en-IN')}</td>
                                    `;
                                }).join('')}
                                <td rowspan="2" class="text-right font-mono font-black" style="border-bottom: 1px solid #e2e8f0;">
                                    <div style="font-size: 11.5px; color: #1e1b4b;">${Math.round(d.totalClosing).toLocaleString('en-IN')}</div>
                                </td>
                            </tr>
                            <!-- ROW 2: IN / OUT -->
                            <tr style="background: #fff !important; border-bottom: 1px solid #e2e8f0;">
                                ${['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id)].map(id => {
                                    const m = d.metrics[id] || { income: 0, expense: 0 };
                                    return `
                                        <td class="text-right font-mono liq-income" style="font-size: 9.5px;">${m.income > 0 ? '+' + Math.round(m.income).toLocaleString('en-IN') : ''}</td>
                                        <td class="text-right font-mono liq-expense" style="font-size: 9.5px; border-right: 1px solid #e2e8f0;">${m.expense > 0 ? '–' + Math.round(m.expense).toLocaleString('en-IN') : ''}</td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="background: #f8fafc !important; color: #1e293b; border-top: 1px solid #e2e8f0; padding: 6px 12px; display: flex; justify-content: flex-end; gap: 20px;">
                    <div class="text-right">
                        <p style="margin: 0; font-size: 8.5px; color: #64748b; text-transform: uppercase;">Opening Period Asset</p>
                        <p style="margin: 0; font-size: 12.5px; font-weight: 700; color: #1e293b;">${Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div class="text-right">
                        <p style="margin: 0; font-size: 8.5px; color: #4f46e5; text-transform: uppercase;">Grand Total Assets</p>
                        <p style="margin: 0; font-size: 14.5px; font-weight: 900; color: #1e1b4b;">₹${Math.round(reportData.liquid.total).toLocaleString('en-IN')}</p>
                    </div>
                </div>
            </div>

            <!-- SECTION B: FINANCIAL DISTRIBUTION LEDGER -->
            <div class="page-break"></div>
            <div class="section-card">
                <div class="section-header">
                    <span>B: Daily Financial Distribution Ledger</span>
                    <span>Performance Breakdown</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">Date</th>
                            <th>Supplier Cash</th>
                            <th>Supplier RTGS</th>
                            <th>Gov Dist.</th>
                            <th style="background: #f1f5f9 !important;">Total Payments</th>
                            <th style="color: #b91c1c;">Expenses</th>
                            <th style="color: #047857;">Income</th>
                            <th style="color: #7e22ce;">S/E Cash</th>
                            <th style="background: #f1f5f9 !important; color: #1e293b !important; border-left: 1px solid #e2e8f0;">Net Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.dayWise.map((d: any, i: number) => `
                            <tr style="background: #fff !important;">
                                <td class="text-center font-black">${d.date}</td>
                                <td class="text-right font-mono">${d.supplierCash.toFixed(2)}</td>
                                <td class="text-right font-mono">${d.supplierRtgs.toFixed(2)}</td>
                                <td class="text-right font-mono">${d.govDist.toFixed(2)}</td>
                                <td class="text-right font-mono font-black" style="background: #f1f5f9 !important;">${d.totalPayments.toFixed(2)}</td>
                                <td class="text-right font-mono font-black" style="color: #dc2626;">${d.expenses.toFixed(2)}</td>
                                <td class="text-right font-mono font-black" style="color: #059669;">${d.incomes.toFixed(2)}</td>
                                <td class="text-right font-mono font-black" style="color: #9333ea;">${d.seCash.toFixed(2)}</td>
                                <td class="text-right font-mono font-black" style="font-size: 11.5px;">${d.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                        <tr style="background: #f1f5f9 !important; color: #1e293b !important; font-weight: 900; border-top: 1px solid #e2e8f0;">
                            <td class="text-center" style="font-size: 9.5px;">PERIOD TOTAL</td>
                            <td class="text-right font-mono">${reportData.distribution.supplierCash.toFixed(2)}</td>
                            <td class="text-right font-mono">${reportData.distribution.supplierRtgs.toFixed(2)}</td>
                            <td class="text-right font-mono">${reportData.distribution.govDist.toFixed(2)}</td>
                            <td class="text-right font-mono" style="border-left: 1px solid #e2e8f0;">${reportData.distribution.totalPayments.toFixed(2)}</td>
                            <td class="text-right font-mono" style="color: #b91c1c;">${reportData.distribution.expenses.toFixed(2)}</td>
                            <td class="text-right font-mono" style="color: #047857;">${reportData.distribution.incomes.toFixed(2)}</td>
                            <td class="text-right font-mono" style="color: #6d28d9;">${reportData.distribution.seCash.toFixed(2)}</td>
                            <td class="text-right font-mono" style="font-size: 13.5px; background: #e0e7ff !important;">₹${reportData.distribution.netTotalBalance.toLocaleString('en-IN')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- SECTION B-II: VARIETY AUDIT Ledger -->
            <div class="page-break"></div>
            <div class="section-card">
                <div class="section-header">
                    <span>B-II: Variety Audit Ledger (Day-wise Breakdown)</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">Variety</th>
                            <th style="width: 45px;">Date</th>
                            <th style="width: 25px;">P</th>
                            <th>Gross</th>
                            <th>Final</th>
                            <th style="color: #b91c1c;">Karta</th>
                            <th style="color: #047857; font-weight: 900;">Net Wt</th>
                            <th>Rate</th>
                            <th>Amount</th>
                            <th style="color: #b91c1c;">Karta A</th>
                            <th style="color: #4f46e5; font-weight: 900;">A.KARTA</th>
                            <th style="width: 50px;">L/K</th>
                            <th>NET AMT</th>
                            <th style="color: #ea580c;">CD</th>
                            <th style="background: #f1f5f9 !important; color: #1e293b !important; font-weight: 900;">F.NET</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(reportData.varietyDayData || {}).map(([variety, days]: [string, any]) => {
                            const sortedDays = [...days].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                            const total = days.reduce((acc: any, d: any) => ({
                                parchi: acc.parchi + d.parchi,
                                gross: acc.gross + d.gross,
                                finalWt: acc.finalWt + d.finalWt,
                                kartaWt: acc.kartaWt + d.kartaWt,
                                netWt: acc.netWt + d.netWt,
                                totalAmt: acc.totalAmt + d.totalAmt,
                                kartaAmt: acc.kartaAmt + d.kartaAmt,
                                afterKartaAmt: acc.afterKartaAmt + d.afterKartaAmt,
                                labAmt: acc.labAmt + d.labAmt,
                                kanAmt: acc.kanAmt + d.kanAmt,
                                netPayable: acc.netPayable + d.netPayable,
                                cdAmt: acc.cdAmt + d.cdAmt,
                                finalNet: acc.finalNet + d.finalNet,
                                totalPaid: acc.totalPaid + d.totalPaid,
                                totalRate: acc.totalRate + d.totalRate
                            }), { 
                                parchi: 0, gross: 0, finalWt: 0, kartaWt: 0, netWt: 0, 
                                totalAmt: 0, kartaAmt: 0, afterKartaAmt: 0, labAmt: 0, kanAmt: 0, 
                                netPayable: 0, cdAmt: 0, finalNet: 0, totalPaid: 0, totalRate: 0 
                            });

                            return `
                                ${sortedDays.map((day, dIdx) => `
                                    <tr style="background: #fff !important;">
                                        ${dIdx === 0 ? `<td rowspan="${sortedDays.length + 1}" class="text-center font-black" style="border-right: 2px solid #e2e8f0; font-size: 9.5px; background: #fff !important;">${variety}</td>` : ''}
                                        <td class="text-center font-bold text-slate-400">${format(new Date(day.date), 'dd MMM')}</td>
                                        <td class="text-center">${day.parchi}</td>
                                        <td class="text-right font-mono">${day.gross.toFixed(2)}</td>
                                        <td class="text-right font-mono">${day.finalWt.toFixed(2)}</td>
                                        <td class="text-right font-mono text-red-600">${day.kartaWt.toFixed(2)}</td>
                                        <td class="text-right font-mono font-black text-emerald-700">${day.netWt.toFixed(2)}</td>
                                        <td class="text-right font-mono">${Math.round(day.totalRate / (day.parchi || 1))}</td>
                                        <td class="text-right font-mono">${Math.round(day.totalAmt).toLocaleString()}</td>
                                        <td class="text-right font-mono text-red-600">${Math.round(day.kartaAmt).toLocaleString()}</td>
                                        <td class="text-right font-mono font-black text-indigo-600">${Math.round(day.afterKartaAmt).toLocaleString()}</td>
                                        <td class="text-right font-mono">${Math.round(day.labAmt)}/${Math.round(day.kanAmt)}</td>
                                        <td class="text-right font-mono">${Math.round(day.netPayable).toLocaleString()}</td>
                                        <td class="text-right font-mono text-orange-600">${Math.round(day.cdAmt).toLocaleString()}</td>
                                        <td class="text-right font-mono font-black text-indigo-900">${Math.round(day.finalNet).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                                <tr style="background: #f1f5f9 !important; font-weight: 900; font-size: 10.5px;">
                                    <td class="text-center" style="color: #312e81; border-top: 1px solid #e2e8f0; padding: 3px 0;">TOT</td>
                                    <td class="text-center" style="border-top: 1px solid #e2e8f0; padding: 3px 0; color: #1e293b;">${total.parchi}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #1e293b;">${total.gross.toFixed(2)}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #1e293b;">${total.finalWt.toFixed(2)}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #991b1b;">${total.kartaWt.toFixed(2)}</td>
                                    <td class="text-right font-mono font-black" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #047857;">${total.netWt.toFixed(2)}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #1e293b;">${total.parchi > 0 ? Math.round(total.totalRate / total.parchi) : 0}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #1e293b;">${Math.round(total.totalAmt).toLocaleString()}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #991b1b;">${Math.round(total.totalKartaAmt || total.kartaAmt).toLocaleString()}</td>
                                    <td class="text-right font-mono font-black" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #4f46e5;">${Math.round(total.afterKartaAmt).toLocaleString()}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #1e293b;">${Math.round(total.labAmt)}/${Math.round(total.kanAmt)}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #1e293b;">${Math.round(total.netPayable).toLocaleString()}</td>
                                    <td class="text-right font-mono" style="border-top: 1px solid #e2e8f0; padding: 3px 2px; color: #c2410c;">${Math.round(total.cdAmt).toLocaleString()}</td>
                                    <td class="text-right font-mono font-black" style="background: #e2e8f0 !important; color: #1e1b4b !important; border-top: 1px solid #94a3b8; padding: 3px 2px;">${Math.round(total.finalNet).toLocaleString()}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="page-break"></div>
            <div class="section-card" style="break-inside: auto;">
                <div class="section-header">
                    <span>C: Horizontal Transaction Trail (Mode: ${viewMode})</span>
                </div>
                ${(() => {
                    const renderHeaderC = (title: string, amount: number, isReceipt: boolean) => `
                        <div style="background: ${isReceipt ? '#ecfdf5' : '#fff1f2'} !important; padding: 4px 10px; font-weight: 900; color: ${isReceipt ? '#065f46' : '#991b1b'}; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; break-inside: avoid;">
                            <span>${title}</span>
                            <span>${formatCurrency(amount)}</span>
                        </div>
                        <div style="display: flex; border-bottom: 1px solid #e2e8f0; background: #f8fafc !important; break-inside: avoid;">
                            ${viewMode !== 'OVERALL' ? '<div style="width: 40px; text-align: center; padding: 4px 2px; font-size: 9px; font-weight: 900; border-right: 1px solid #f1f5f9; color: #64748b;">DATE</div>' : ''}
                            ${viewMode !== 'DETAIL' ? '<div style="width: 30px; text-align: center; padding: 4px 2px; font-size: 9px; font-weight: 900; border-right: 1px solid #f1f5f9; color: #64748b;">FREQ</div>' : ''}
                            <div style="width: 50px; text-align: center; padding: 4px 2px; font-size: 9px; font-weight: 900; border-right: 1px solid #f1f5f9; color: #64748b;">TYPE</div>
                            <div style="flex: 1; padding: 4px 6px; font-size: 9px; font-weight: 900; border-right: 1px solid #f1f5f9; color: #64748b;">PARTICULARS</div>
                            <div style="width: 60px; text-align: right; padding: 4px 6px; font-size: 9px; font-weight: 900; color: #64748b;">AMOUNT</div>
                        </div>
                    `;

                    const renderItemC = (t: any, i: number, isReceipt: boolean) => {
                        const type = t.type.split('::')[0];
                        const shortForms: any = { 'Supplier Payment': 'SP', 'Customer Receipt': 'CUST', 'Transfer In': 'TRF-↓', 'Sale': 'SALE', 'Income': 'IN', 'Opening Balance': 'OPN', 'Adjustment': 'ADJ', 'Purchase': 'PURCH', 'Labour': 'LABOUR', 'Kanta': 'KANTA', 'Expense': 'EX', 'Transfer Out': 'TRF-↑' };
                        const sType = shortForms[type] || type.toUpperCase();
                        let dStr = '—';
                        try { dStr = format(new Date(t.date), 'dd MMM'); } catch(e) {}
                        // Line 1: main (before ::), Line 2: details (after ::) — only if exists
                        const [partMain, partCat] = (t.particulars || '').split('::');
                        const partDetail = partCat
                            ? partCat.split('|').map((s: string) => s.trim()).filter(Boolean).join(' · ')
                            : '';
                        const hasDetail = partDetail.length > 0;
                        return `
                            <div style="display: flex; border-bottom: 1px solid #f1f5f9; align-items: ${hasDetail ? 'flex-start' : 'center'}; break-inside: avoid; min-height: 20px; background: #fff !important;">
                                ${viewMode !== 'OVERALL' ? `<div style="width: 42px; text-align: center; padding: 4px 2px; border-right: 1px solid #f1f5f9; font-weight: 900; font-size: 10.5px;">${dStr}</div>` : ''}
                                ${viewMode !== 'DETAIL' ? `<div style="width: 32px; text-align: center; padding: 4px 2px; border-right: 1px solid #f1f5f9; font-weight: 900;">${t.count > 1 ? t.count + 'x' : '-'}</div>` : ''}
                                <div style="width: 52px; text-align: center; padding: 4px 2px; border-right: 1px solid #f1f5f9;">
                                    <span class="tag tag-${sType.replace(' ', '-')}">${sType}</span>
                                </div>
                                <div style="flex: 1; padding: 3px 6px; border-right: 1px solid #f1f5f9;">
                                    <span class="part-main">${escapeHtml(partMain.trim())}</span>
                                    ${hasDetail ? `<span class="part-sub">${escapeHtml(partDetail)}</span>` : ''}
                                </div>
                                <div style="width: 65px; text-align: right; padding: 3px 6px; font-family: monospace; font-weight: 900; font-size: 11px; color: ${isReceipt ? '#059669' : '#dc2626'};">
                                    ${Math.round(t.amount).toLocaleString()}
                                </div>
                            </div>
                        `;
                    };

                    const renderOverflowC = (remaining: any[], isReceipt: boolean) => {
                        if (remaining.length === 0) return '';
                        const color = isReceipt ? '#065f46' : '#991b1b';
                        const title = isReceipt ? 'Receipts (Continued)' : 'Payments (Continued)';
                        return `
                            <div style="margin-top: 10px; border-top: 2px dashed ${color}; padding-top: 5px;">
                                <div style="font-size: 10.5px; font-weight: 900; color: ${color}; text-align: center; margin-bottom: 5px; text-transform: uppercase;">${title} (Reclaiming Space)</div>
                                <div style="column-count: 2; column-gap: 15px; column-rule: 1px solid #e2e8f0;">
                                    ${remaining.map((t, i) => renderItemC(t, i, isReceipt)).join('')}
                                </div>
                            </div>
                        `;
                    };

                    const minC = Math.min(inflows.length, outflows.length);
                    const totalIn = inflows.reduce((s: number, t: any) => s + t.amount, 0);
                    const totalOut = outflows.reduce((s: number, t: any) => s + t.amount, 0);

                    return `
                        <div style="display: flex; border-bottom: 2px solid #e2e8f0;">
                            <div style="flex: 1; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column;">
                                ${renderHeaderC('Receipts (Inflow)', totalIn, true)}
                                ${inflows.slice(0, minC).map((t: any, i: number) => renderItemC(t, i, true)).join('')}
                            </div>
                            <div style="flex: 1.2; display: flex; flex-direction: column;">
                                ${renderHeaderC('Payments (Outflow)', totalOut, false)}
                                ${outflows.slice(0, minC).map((t: any, i: number) => renderItemC(t, i, false)).join('')}
                            </div>
                        </div>
                        ${renderOverflowC(inflows.slice(minC), true)}
                        ${renderOverflowC(outflows.slice(minC), false)}
                    `;
                })()}
                <!-- LEDGER FOOTER -->
                <div class="footer-bar">
                    <div style="display: flex; gap: 30px;">
                        <div>
                            <p style="margin: 0; font-size: 8.5px; color: #94a3b8; text-transform: uppercase;">Gross Inflow</p>
                            <p style="margin: 0; font-size: 12.5px; font-weight: 900; color: #34d399;">${formatCurrency(inflows.reduce((s: number, t: any) => s + t.amount, 0))}</p>
                        </div>
                        <div>
                            <p style="margin: 0; font-size: 8.5px; color: #94a3b8; text-transform: uppercase;">Gross Outflow</p>
                            <p style="margin: 0; font-size: 12.5px; font-weight: 900; color: #f87171;">${formatCurrency(outflows.reduce((s: number, t: any) => s + t.amount, 0))}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p style="margin: 0; font-size: 9.5px; color: #94a3b8; text-transform: uppercase;">Net Ledger Balance</p>
                        <p style="margin: 0; font-size: 16.5px; font-weight: 900;">${formatCurrency(inflows.reduce((s: number, t: any) => s + t.amount, 0) - outflows.reduce((s: number, t: any) => s + t.amount, 0))}</p>
                    </div>
                </div>
            </div>

            <!-- SECTION D: OPERATIONAL EXPENSE AUDIT LEDGER -->
            <div class="page-break"></div>
            <div class="section-card">
                <div class="section-header" style="background: #f1f5f9 !important; border-bottom: 1px solid #e2e8f0; color: #1e293b !important; padding: 10px 15px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                    <span style="font-size: 13.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #0f172a;">Section Z-II: Expense Breakdown Ledger</span>
                    <span style="font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Parallel Expense Distribution — Cash · RTGS · Gov · Online · Other</span>
                </div>
                
                ${(() => {
                    const expZone = reportData.audit360Zones?.find((z: any) => z.key === 'EXPENSE');
                    const allRows = expZone?.rows || [];
                    const isNumeric = (m: string) => /^\d{10,}$/.test(m || '');
                    
                    const groups = {
                        'Cash':   { rows: allRows.filter((r: any) => (r.paymentMethod === 'Cash' || !r.paymentMethod) && !isNumeric(r.paymentMethod)), label: '💵 Cash Expense', hBg: '#fff7ed', hTxt: '#ea580c', shDate: '#9a3412', shPart: '#c2410c', dBg: '#ffedd5', dTxt: '#c2410c', aBg: '#fff7ed', nTxt: '#7c2d12' },
                        'RTGS':   { rows: allRows.filter((r: any) => r.paymentMethod === 'RTGS'), label: '🏦 RTGS', hBg: '#eff6ff', hTxt: '#2563eb', shDate: '#1e40af', shPart: '#1d4ed8', dBg: '#dbeafe', dTxt: '#1d4ed8', aBg: '#eff6ff', nTxt: '#1e3a8a' },
                        'Gov':    { rows: allRows.filter((r: any) => r.paymentMethod === 'Cheque' || r.paymentMethod === 'Gov Dist'), label: '🏛️ Gov / Cheque', hBg: '#faf5ff', hTxt: '#9333ea', shDate: '#6b21a8', shPart: '#7e22ce', dBg: '#f3e8ff', dTxt: '#7e22ce', aBg: '#faf5ff', nTxt: '#581c87' },
                        'Online': { rows: allRows.filter((r: any) => r.paymentMethod === 'Online' || r.paymentMethod === 'Transfer'), label: '📱 Online', hBg: '#ecfeff', hTxt: '#0891b2', shDate: '#155e75', shPart: '#0e7490', dBg: '#cffafe', dTxt: '#0e7490', aBg: '#ecfeff', nTxt: '#164e63' },
                        'Other':  { rows: allRows.filter((r: any) => r.paymentMethod === 'Other' || isNumeric(r.paymentMethod)), label: '🔀 Other', hBg: '#fef2f2', hTxt: '#dc2626', shDate: '#9f1239', shPart: '#b91c1c', dBg: '#ffe4e6', dTxt: '#b91c1c', aBg: '#fef2f2', nTxt: '#7f1d1d' }
                    };

                    const renderHeader = (group: any) => `
                        <div style="background: ${group.hBg} !important; padding: 6px 10px; border-bottom: 2px solid ${group.hTxt}; display: flex; justify-content: space-between; align-items: center; break-inside: avoid;">
                            <span style="font-weight: 900; font-size: 10.5px; color: ${group.hTxt}; text-transform: uppercase;">${group.label}</span>
                            <span style="font-family: monospace; font-weight: 900; font-size: 12.5px; color: #1e293b;">₹${Math.round(group.rows.reduce((s: number, r: any) => s + r.amount, 0)).toLocaleString()}</span>
                        </div>
                        <div style="display: flex; border-bottom: 1px solid #e2e8f0; background: #f8fafc !important; break-inside: avoid;">
                            <div style="width: 40px; text-align: center; padding: 4px 2px; font-size: 9px; font-weight: 900; color: ${group.shDate}; border-right: 1px solid #e2e8f0;">DATE</div>
                            <div style="flex: 1; padding: 4px 6px; font-size: 9px; font-weight: 900; color: ${group.shPart}; border-right: 1px solid #e2e8f0;">PARTICULAR</div>
                            <div style="width: 50px; text-align: right; padding: 4px 6px; font-size: 9px; font-weight: 900; color: #1e293b;">AMT</div>
                        </div>
                    `;

                    const renderItem = (r: any, group: any) => {
                        let dStr = '—';
                        try { dStr = format(new Date(r.date), 'dd/MM'); } catch(e) {}
                        // ALL info inline on 1 line: badges + item name + extra details
                        const inlineBadges: string[] = [];
                        if (r.transactionId) inlineBadges.push(`<span style="background: #e2e8f0 !important; color: #334155; font-size: 9px; font-family: monospace; font-weight: 900; padding: 1px 3px; border-radius: 2px; border: 1px solid #cbd5e1; white-space: nowrap;">${r.transactionId}</span>`);
                        if (r.tag === 'SUP_PAY') inlineBadges.push(`<span style="background: #fbbf24 !important; color: #451a03; font-size: 9px; font-weight: 900; padding: 1px 3px; border-radius: 2px; white-space: nowrap;">SUP</span>`);
                        else if (r.details) inlineBadges.push(`<span style="background: #e0e7ff !important; color: #3730a3; font-size: 9px; font-weight: 900; padding: 1px 3px; border-radius: 2px; white-space: nowrap;">${escapeHtml(r.details)}</span>`);
                        if (r.receiptNo && r.receiptNo !== '—') inlineBadges.push(`<span style="color: #475569; font-size: 9px; font-weight: 700; white-space: nowrap;">${escapeHtml(r.receiptNo)}</span>`);
                        if (r.checkNo && r.checkNo !== '—') inlineBadges.push(`<span style="color: #2563eb; font-size: 9px; font-weight: 700; white-space: nowrap;">CHQ:${escapeHtml(r.checkNo)}</span>`);
                        if (r.receiptName && r.receiptName !== '—') inlineBadges.push(`<span style="color: #94a3b8; font-size: 9px; font-style: italic; white-space: nowrap;">(${escapeHtml(r.receiptName)})</span>`);
                        return `
                            <div style="display: flex; border-bottom: 1px solid #f1f5f9; align-items: center; break-inside: avoid; min-height: 20px;">
                                <div style="width: 42px; text-align: center; padding: 3px 2px; border-right: 1px solid #f1f5f9; background: #f8fafc !important;">
                                    <span style="display: inline-block; background: ${group.dBg} !important; color: ${group.dTxt}; font-size: 9.5px; font-weight: 900; padding: 1px 4px; border-radius: 2px;">${dStr}</span>
                                </div>
                                <div style="flex: 1; padding: 3px 6px; border-right: 1px solid #f1f5f9; overflow: hidden;">
                                    <div style="display: flex; align-items: center; gap: 4px; overflow: hidden;">
                                        ${inlineBadges.join('')}
                                        <span style="font-size: 10.5px; font-weight: 900; color: ${group.nTxt}; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.item)}</span>
                                    </div>
                                </div>
                                <div style="width: 55px; text-align: right; padding: 3px 6px; background: ${group.aBg} !important;">
                                    <span style="font-size: 11px; font-family: monospace; font-weight: 900; color: ${group.nTxt};">${Math.round(r.amount).toLocaleString()}</span>
                                </div>
                            </div>
                        `;
                    };

                    const renderOverflow = (remaining: any[], group: any, cols: number) => {
                        if (remaining.length === 0) return '';
                        return `
                            <div style="margin-top: 10px; border-top: 2px dashed ${group.hTxt}; padding-top: 5px;">
                                <div style="font-size: 10.5px; font-weight: 900; color: ${group.hTxt}; text-align: center; margin-bottom: 5px; text-transform: uppercase;">${group.label} (Continued - Reclaiming Space)</div>
                                <div style="column-count: ${cols}; column-gap: 15px; column-rule: 1px solid #e2e8f0;">
                                    ${remaining.map(r => renderItem(r, group)).join('')}
                                </div>
                            </div>
                        `;
                    };

                    const cashRows = groups.Cash.rows;
                    const rtgsRows = groups.RTGS.rows;
                    const min2 = Math.min(cashRows.length, rtgsRows.length);
                    
                    const govRows = groups.Gov.rows;
                    const onlineRows = groups.Online.rows;
                    const otherRows = groups.Other.rows;
                    const min3 = Math.min(govRows.length, onlineRows.length, otherRows.length);

                    return `
                        <!-- ROW 1: CASH & RTGS (PARALLEL) -->
                        <div style="display: flex; border-bottom: 1px solid #e2e8f0;">
                            <div style="flex: 1; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column;">
                                ${renderHeader(groups.Cash)}
                                ${cashRows.slice(0, min2).map((r: any) => renderItem(r, groups.Cash)).join('')}
                            </div>
                            <div style="flex: 1; display: flex; flex-direction: column;">
                                ${renderHeader(groups.RTGS)}
                                ${rtgsRows.slice(0, min2).map((r: any) => renderItem(r, groups.RTGS)).join('')}
                            </div>
                        </div>
                        ${renderOverflow(cashRows.slice(min2), groups.Cash, 2)}
                        ${renderOverflow(rtgsRows.slice(min2), groups.RTGS, 2)}

                        <!-- ROW 2: GOV, ONLINE, OTHER (3-COLUMN PARALLEL) -->
                        <div style="display: flex; margin-top: 15px; border-top: 1px solid #e2e8f0;">
                            <div style="flex: 1; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column;">
                                ${renderHeader(groups.Gov)}
                                ${govRows.slice(0, min3).map((r: any) => renderItem(r, groups.Gov)).join('')}
                            </div>
                            <div style="flex: 1; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column;">
                                ${renderHeader(groups.Online)}
                                ${onlineRows.slice(0, min3).map((r: any) => renderItem(r, groups.Online)).join('')}
                            </div>
                            <div style="flex: 1; display: flex; flex-direction: column;">
                                ${renderHeader(groups.Other)}
                                ${otherRows.slice(0, min3).map((r: any) => renderItem(r, groups.Other)).join('')}
                            </div>
                        </div>
                        ${renderOverflow(govRows.slice(min3), groups.Gov, 3)}
                        ${renderOverflow(onlineRows.slice(min3), groups.Online, 3)}
                        ${renderOverflow(otherRows.slice(min3), groups.Other, 3)}
                    `;
                })()}

                <div style="background: #f8fafc !important; color: #1e293b !important; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0;">
                    <span style="font-size: 12.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">Total Period Expenditure</span>
                    <span style="font-size: 18.5px; font-family: monospace; font-weight: 900; color: #0f172a;">₹${Math.round(reportData.distribution.expenses).toLocaleString()}</span>
                </div>
            </div>

            <div style="font-size: 9.5px; color: #94a3b8; margin-top: 20px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px; text-transform: uppercase; font-weight: 700;">
                BIZSUITE 360 AUDIT SYSTEM • CONFIDENTIAL AUDIT DATA
            </div>
        </body>
        </html>
    `;
};
