import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, cn } from "@/lib/utils";
import { Printer, FileText, ArrowLeft } from 'lucide-react';
import { printHtmlContent } from "@/lib/electron-print";

interface AccountLedgerViewProps {
    accountName: string;
    accountNumber?: string;
    ledgerData: any[];
    onBack: () => void;
}

export const AccountLedgerView: React.FC<AccountLedgerViewProps> = ({ 
    accountName, 
    accountNumber,
    ledgerData,
    onBack
}) => {
    const handlePrint = async () => {
        const html = `
            <html>
                <head>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; color: #000; line-height: 1.1; }
                        .header { text-align: center; border-bottom: 2pt solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                        .header h1 { margin: 0; font-size: 18pt; text-transform: uppercase; letter-spacing: 1pt; font-weight: 900; color: #000; }
                        .header p { margin: 4px 0 0; font-size: 9pt; color: #000; font-weight: bold; text-transform: uppercase; }
                        
                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background: #f8f8f8; color: #000; font-weight: 900; text-transform: uppercase; border: 0.5pt solid #000; padding: 5px 8px; font-size: 7pt; text-align: left; }
                        td { border: 0.1pt solid #ccc; padding: 4px 6px; font-size: 7.5pt; vertical-align: top; color: #000; font-weight: 500; }
                        
                        .text-right { text-align: right; }
                        .font-mono { font-family: 'Courier New', Courier, monospace; font-weight: bold; }
                        .debit { color: #000; font-weight: 600; }
                        .credit { color: #000; font-weight: 600; }
                        .bal-cell { background-color: #fcfcfc; font-weight: 900; border-left: 1pt solid #000; color: #000; }
                        
                        .summary-box { margin-top: 20px; border-top: 1.5pt solid #000; padding-top: 10px; display: flex; justify-content: flex-end; }
                        .summary-item { text-align: right; margin-left: 30px; color: #000; }
                        .summary-label { font-size: 7pt; font-weight: 900; text-transform: uppercase; color: #000; display: block; }
                        .summary-value { font-size: 11pt; font-weight: 900; font-family: 'Courier New', Courier, monospace; color: #000; }
                        
                        .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #000; border-top: 0.5pt solid #000; padding-top: 8px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${accountName}</h1>
                        ${accountNumber ? `<p style="font-size: 10pt; color: #000; margin-top: 4px;">A/C No: ${accountNumber}</p>` : ''}
                        <p>Detailed Transaction Audit Ledger | Forensic Account Statement</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 15%">Date</th>
                                <th style="width: 45%">Particulars / Transaction Description</th>
                                <th style="width: 10%">Ref ID</th>
                                <th style="width: 10%" class="text-right">Debit (Out)</th>
                                <th style="width: 10%" class="text-right">Credit (In)</th>
                                <th style="width: 10%" class="text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ledgerData.map(t => `
                                <tr>
                                    <td>${format(new Date(t.date), 'dd-MM-yyyy')}</td>
                                    <td>
                                        <span style="font-weight: 600; color: #000;">${t.particulars}</span>
                                        <span style="font-size: 6.5pt; color: #000; text-transform: uppercase; margin-left: 8px; font-weight: 400;">(${t.type})</span>
                                    </td>
                                    <td class="font-mono">${t.id || '—'}</td>
                                    <td class="text-right font-mono debit">${t.debit > 0 ? t.debit.toLocaleString('en-IN', {minimumFractionDigits: 0}) : ''}</td>
                                    <td class="text-right font-mono credit">${t.credit > 0 ? t.credit.toLocaleString('en-IN', {minimumFractionDigits: 0}) : ''}</td>
                                    <td class="text-right font-mono bal-cell">${t.balance.toLocaleString('en-IN', {minimumFractionDigits: 0})}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="summary-box">
                        <div class="summary-item">
                            <span class="summary-label">Total Debit (Out)</span>
                            <span class="summary-value" style="color: #000;">
                                ₹${ledgerData.reduce((s, t) => s + (t.debit || 0), 0).toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Total Credit (In)</span>
                            <span class="summary-value" style="color: #000;">
                                ₹${ledgerData.reduce((s, t) => s + (t.credit || 0), 0).toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div class="summary-item" style="border-left: 1.5pt solid #000; padding-left: 15px;">
                            <span class="summary-label">Final Closing Balance</span>
                            <span class="summary-value">₹${(ledgerData[ledgerData.length - 1]?.balance || 0).toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    <div class="footer">
                        <span>Generated: ${format(new Date(), 'dd MMM yyyy HH:mm:ss')}</span>
                        <span>Authorized Digital Audit Copy</span>
                    </div>
                </body>
            </html>
        `;
        await printHtmlContent(html);
    };

    return (
        <div className="flex flex-col space-y-4">
            {/* Header with Back and Account Details */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors group"
                    >
                        <ArrowLeft size={20} className="text-slate-600 group-hover:text-slate-900" />
                    </button>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{accountName}</h2>
                        {accountNumber && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A/C NO:</span>
                                <span className="text-[12px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{accountNumber}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Live Forensic Audit View</span>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-100">
                            <FileText size={18} className="text-white" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Account Audit Trail</h3>
                    </div>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-black transition-all shadow-lg"
                    >
                        <Printer size={14} /> PRINT DETAILED LEDGER
                    </button>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]">
                    <Table>
                        <TableHeader className="sticky top-0 z-50 bg-slate-100 shadow-sm">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[120px] text-[10px] font-black text-slate-500 uppercase px-6">Date</TableHead>
                                <TableHead className="text-[10px] font-black text-slate-500 uppercase">Particulars</TableHead>
                                <TableHead className="w-[120px] text-[10px] font-black text-slate-500 uppercase">Ref ID</TableHead>
                                <TableHead className="text-right w-[150px] text-[10px] font-black text-slate-500 uppercase">Debit (Out)</TableHead>
                                <TableHead className="text-right w-[150px] text-[10px] font-black text-slate-500 uppercase">Credit (In)</TableHead>
                                <TableHead className="text-right w-[180px] text-[10px] font-black text-slate-500 uppercase px-6">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ledgerData.map((t, idx) => (
                                <TableRow key={idx} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 group">
                                    <TableCell className="text-[11px] font-bold text-slate-500 py-4 px-6">
                                        {format(new Date(t.date), 'dd MMM yyyy')}
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <span className="text-[12px] font-black text-slate-900">
                                            {t.particulars}
                                        </span>
                                        <span className="ml-2 text-[9px] text-indigo-600 font-black uppercase opacity-60">
                                            • {t.type}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-[11px] font-mono text-slate-400 py-4">
                                        {t.id || '—'}
                                    </TableCell>
                                    <TableCell className="text-right py-4">
                                        {t.debit > 0 ? (
                                            <span className="text-[12px] font-mono font-black text-red-600 bg-red-50 px-2 py-1 rounded">
                                                ₹{Math.round(t.debit).toLocaleString('en-IN')}
                                            </span>
                                        ) : (
                                            <span className="text-slate-200">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right py-4">
                                        {t.credit > 0 ? (
                                            <span className="text-[12px] font-mono font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                ₹{Math.round(t.credit).toLocaleString('en-IN')}
                                            </span>
                                        ) : (
                                            <span className="text-slate-200">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right py-4 px-6">
                                        <span className="text-sm font-mono font-black text-slate-900">
                                            ₹{Math.round(t.balance).toLocaleString('en-IN')}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Quick Summary Cards at Bottom */}
                <div className="grid grid-cols-3 gap-0 border-t border-slate-200 bg-slate-900 text-white">
                    <div className="p-6 border-r border-white/10 group hover:bg-red-500/10 transition-colors">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Debit (Out)</p>
                        <p className="text-2xl font-mono font-black text-red-400">
                            {formatCurrency(ledgerData.reduce((s, t) => s + (t.debit || 0), 0))}
                        </p>
                    </div>
                    <div className="p-6 border-r border-white/10 group hover:bg-emerald-500/10 transition-colors">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Credit (In)</p>
                        <p className="text-2xl font-mono font-black text-emerald-400">
                            {formatCurrency(ledgerData.reduce((s, t) => s + (t.credit || 0), 0))}
                        </p>
                    </div>
                    <div className="p-6 bg-white/5">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">Final Closing Balance</p>
                        <p className="text-3xl font-mono font-black text-white">
                            {formatCurrency(ledgerData[ledgerData.length - 1]?.balance || 0)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
