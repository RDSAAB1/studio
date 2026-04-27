import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from "@/lib/utils";

export type ViewMode = 'DETAIL' | 'DATE_WISE' | 'OVERALL';

interface TransactionTrailProps {
    reportData: any;
    viewMode: ViewMode;
    setViewMode: (v: ViewMode) => void;
}

export const TransactionTrail: React.FC<TransactionTrailProps> = ({ reportData, viewMode, setViewMode }) => {

    const getProcessedData = (isCredit: boolean) => {
        const ledger = reportData.consolidatedLedger;
        const transactions = ledger.filter((t: any) => isCredit ? t.credit > 0 : t.debit > 0);
        
        if (viewMode === 'DETAIL') {
            return transactions.map((t: any) => ({
                date: t.date,
                particulars: t.particulars,
                type: t.type,
                amount: isCredit ? t.credit : t.debit,
                count: 1,
                subLine: ''
            })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }

        if (viewMode === 'OVERALL') {
            const groups: Record<string, { type: string; particulars: string; amount: number; count: number; subLine: string; extras: any }> = {};

            const ensure = (key: string, tag: string, p: string) => {
                if (!groups[key]) groups[key] = { type: tag, particulars: p, amount: 0, count: 0, subLine: '', extras: { lines: [] as string[], totalQty: 0, rateSum: 0, rateCount: 0, labour: 0, kanta: 0 } };
            };

            transactions.forEach((t: any) => {
                const amt = isCredit ? t.credit : t.debit;
                const raw = t.particulars;

                if (t.type === 'Purchase') {
                    ensure('Purchase', 'Purchase', 'Consolidated Stock Purchase');
                    groups['Purchase'].amount += amt;
                    groups['Purchase'].count += (t.count || 1);
                    const qtyMatch = raw.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                    if (qtyMatch) {
                        groups['Purchase'].extras.totalQty += parseFloat(qtyMatch[1]);
                        groups['Purchase'].extras.rateSum += parseFloat(qtyMatch[2]);
                        groups['Purchase'].extras.rateCount += 1;
                    }
                    const labMatch = raw.match(/Lab:\s*₹([\d.]+)/);
                    if (labMatch) groups['Purchase'].extras.labour += parseFloat(labMatch[1]);
                    const kanMatch = raw.match(/Kan:\s*₹([\d.]+)/);
                    if (kanMatch) groups['Purchase'].extras.kanta += parseFloat(kanMatch[1]);

                } else if (t.type === 'Labour') {
                    ensure('Labour', 'Labour', 'Consolidated Labour Charges');
                    groups['Labour'].amount += amt;
                    groups['Labour'].count += (t.count || 1);
                    if (raw) groups['Labour'].extras.lines.push(raw);

                } else if (t.type === 'Kanta') {
                    ensure('Kanta', 'Kanta', 'Consolidated Kanta Charges');
                    groups['Kanta'].amount += amt;
                    groups['Kanta'].count += (t.count || 1);
                    if (raw) groups['Kanta'].extras.lines.push(raw);

                } else if (t.type === 'Sale') {
                    ensure('Sale', 'Sale', 'Consolidated Sales Receipts');
                    groups['Sale'].amount += amt;
                    groups['Sale'].count += (t.count || 1);
                    const qtyMatch = raw.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                    if (qtyMatch) {
                        groups['Sale'].extras.totalQty += parseFloat(qtyMatch[1]);
                        groups['Sale'].extras.rateSum += parseFloat(qtyMatch[2]);
                        groups['Sale'].extras.rateCount += 1;
                    }
                    const name = raw.split('::')[0].trim();
                    if (name && !name.toLowerCase().includes('consolidated')) {
                        groups['Sale'].extras.lines.push(name);
                    }

                } else if (t.type.startsWith('Customer Receipt')) {
                    const mMatch = raw.match(/\((.*?)\)/);
                    const method = mMatch ? mMatch[1] : (t.type.split('::')[1] || 'Cash');
                    const gKey = `Customer Receipt-${method}`;
                    ensure(gKey, 'Customer Receipt', `Customer Receipts (${method})`);
                    groups[gKey].amount += amt;
                    groups[gKey].count += (t.count || 1);
                    const name = raw.split('|')[0].trim();
                    if (name && !name.toLowerCase().includes('consolidated')) {
                        groups[gKey].extras.lines.push(name);
                    }

                } else if (t.type.startsWith('Expense')) {
                    // Extract Account Name: "[EX001] Kharch Khata" -> "Kharch Khata"
                    const accMatch = raw.match(/\]\s*(.*)/);
                    const accName = accMatch ? accMatch[1].trim() : 'Misc Expense';
                    const key = `EX::${accName}`;
                    ensure(key, 'Expense', accName);
                    groups[key].amount += amt;
                    groups[key].count += (t.count || 1);
                    // Extract the detail part: "1 Payments | [EX001] Kharch Khata" -> remove the prefix
                    const detail = raw.split('|').slice(1).join('|').trim();
                    if (detail) groups[key].extras.lines.push(detail);

                } else if (t.type.startsWith('Income')) {
                    const parts = raw.split(' - ');
                    const payee = parts[0]?.trim() || '';
                    const catRaw = parts.length > 1 ? parts[1] : raw;
                    const cat = catRaw.split('(')[0].trim();
                    const gKey = `Income-${cat}`;
                    ensure(gKey, 'Income', `Income: ${cat}`);
                    groups[gKey].amount += amt;
                    groups[gKey].count += (t.count || 1);
                    if (payee && !payee.toLowerCase().includes('consolidated')) groups[gKey].extras.lines.push(payee);

                } else if (t.type === 'Adjustment') {
                    const adjMatch = raw.match(/ADJUSTMENT \((.*?)\)/);
                    const adjCat = adjMatch ? adjMatch[1].split('|')[0].trim() : 'Adjustment';
                    const gKey = `Adjustment-${adjCat}`;
                    ensure(gKey, 'Adjustment', adjCat);
                    groups[gKey].amount += amt;
                    groups[gKey].count += (t.count || 1);
                    if (adjMatch && adjMatch[1].includes('|')) {
                         adjMatch[1].split('|').slice(1).forEach(d => groups[gKey].extras.lines.push(d.trim()));
                    } else if (adjMatch) {
                         groups[gKey].extras.lines.push(adjMatch[1].trim());
                    }

                } else if (t.type.startsWith('Transfer')) {
                    const typeLabel = t.type.includes('In') ? 'Fund Transfer ↓' : 'Fund Transfer ↑';
                    const pLabel = t.type.includes('In') ? 'Cash Transfer (Inflow)' : 'Cash Transfer (Outflow)';
                    ensure(t.type, typeLabel, pLabel);
                    groups[t.type].amount += amt;
                    groups[t.type].count += (t.count || 1);
                    const name = raw.split('|')[0].trim();
                    if (name && !name.toLowerCase().includes('consolidated')) {
                        groups[t.type].extras.lines.push(name);
                    }

                } else if (t.type === 'Opening Balance') {
                    const gKey = `OPN-${raw}`; 
                    ensure(gKey, 'Opening Bal.', raw);
                    groups[gKey].amount += amt;
                    groups[gKey].count += (t.count || 1);

                } else {
                    ensure(t.type, t.type, `Consolidated ${t.type}`);
                    groups[t.type].amount += amt;
                    groups[t.type].count += (t.count || 1);
                }
            });

            // Post-processing for Overall
            Object.values(groups).forEach((g: any) => {
                g.subLine = '';
                g.subNames = [];
                const uniqueLines = [...new Set(g.extras.lines as string[])];

                if (g.type === 'Labour' || g.type === 'Kanta') {
                    const rateMap = new Map<string, { count: number, weight: number }>();
                    g.extras.lines.forEach((line: string) => {
                        line.split(' | ').forEach(part => {
                            const pMatch = part.match(/PARCHI-([\d.]+)@([\d.]+)/);
                            const wMatch = part.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                            
                            if (pMatch) {
                                const count = parseFloat(pMatch[1]);
                                const rate = pMatch[2];
                                const existing = rateMap.get(rate) || { count: 0, weight: 0 };
                                rateMap.set(rate, { ...existing, count: existing.count + count });
                            } else if (wMatch) {
                                const weight = parseFloat(wMatch[1]);
                                const rate = wMatch[2];
                                const existing = rateMap.get(rate) || { count: 0, weight: 0 };
                                rateMap.set(rate, { ...existing, weight: existing.weight + weight });
                            } else {
                                const existing = rateMap.get(part) || { count: 0, weight: 0 };
                                rateMap.set(part, { ...existing, count: existing.count + 1 });
                            }
                        });
                    });
                    const sortedRates = Array.from(rateMap.entries()).sort((a, b) => (b[1].count + b[1].weight) - (a[1].count + a[1].weight));
                    const rateParts = sortedRates.slice(0, 3).map(([rate, data]) => {
                        if (g.type === 'Labour' && data.weight > 0) {
                            return `${data.weight.toFixed(2)} QTL @ ₹${rate}`;
                        }
                        return `PARCHI-${Math.round(data.count)}@${rate}`;
                    });
                    if (sortedRates.length > 3) {
                        g.particulars = rateParts.join(' | ') + ` | + ${sortedRates.length - 3} more rates`;
                    } else {
                        g.particulars = rateParts.join(' | ');
                    }
                } else if (g.type === 'Purchase' || g.type === 'Sale') {
                    const avgRate = g.extras.rateCount > 0 ? (g.extras.rateSum / g.extras.rateCount).toFixed(0) : '0';
                    const prefix = g.type === 'Purchase' ? 'Purchase' : 'Sales';
                    const names = uniqueLines.length > 0 ? ` | ${uniqueLines.slice(0, 3).join(', ')}${uniqueLines.length > 3 ? '...' : ''}` : '';
                    g.particulars = `${prefix}: ${g.count} Receipts::${g.extras.totalQty.toFixed(2)} QTL @ ₹${avgRate}${names}`;
                    if (g.type === 'Purchase') {
                        g.particulars += ` | Lab: ₹${Math.round(g.extras.labour)} | Kan: ₹${Math.round(g.extras.kanta)}`;
                    }
                } else if (g.type === 'Adjustment') {
                    if (uniqueLines.length > 0) {
                        g.particulars = `${g.particulars}::${uniqueLines.join(' | ')}`;
                    }
                } else if (g.type.includes('Transfer')) {
                    g.particulars = `${g.count} Records`;
                } else if (g.type === 'Customer Receipt' || g.type === 'Expense' || g.type === 'Income' || g.type.startsWith('EX::')) {
                    const label = g.type === 'Customer Receipt' ? 'Receipts' : (g.type.startsWith('EX::') ? 'Payments' : 'Records');
                    const namesPart = uniqueLines.join(' | ');
                    g.particulars = `${g.count} ${label} | ${g.particulars}::${namesPart}`;
                }
            });

            return Object.values(groups).sort((a: any, b: any) => a.type.localeCompare(b.type));
        }

        // DATE_WISE
        const grouped = new Map<string, any>();
        transactions.forEach((t: any) => {
            const dateStr = format(new Date(t.date), 'yyyy-MM-dd');
            let p = t.particulars || '';
            const raw = p;
            
            const methodMatch = p.match(/\((.*?)\)/);
            const method = methodMatch ? methodMatch[1] : '';
            
            const [baseType, typeMethod] = t.type.split('::');
            const activeMethod = typeMethod || method || (baseType === 'Expense' ? 'Cash' : '');
            
            let displayParticulars = '';
            let groupType = baseType;

            if (baseType === 'Supplier Payment') {
                displayParticulars = 'Consolidated Supplier Payments';
            } else if (baseType === 'Customer Receipt') {
                displayParticulars = 'Consolidated Customer Receipts';
            } else if (baseType === 'Expense' || baseType === 'Income') {
                displayParticulars = `Consolidated ${baseType}`;
            } else if (baseType === 'Adjustment') {
                const adjMatch = raw.match(/ADJUSTMENT \((.*?)\)/);
                displayParticulars = adjMatch ? adjMatch[1].split('|')[0].trim() : 'Adjustment';
            } else if (baseType === 'Purchase' || baseType === 'Sale') {
                displayParticulars = `Consolidated ${baseType}`;
            } else if (baseType === 'Labour' || baseType === 'Kanta') {
                displayParticulars = p;
            } else if (baseType === 'Transfer In' || baseType === 'Transfer Out') {
                displayParticulars = 'Fund Transfer';
                groupType = 'Fund Transfer';
            } else if (baseType === 'Opening Balance') {
                displayParticulars = p;
            } else {
                displayParticulars = `Consolidated ${baseType}`;
            }

            const key = `${dateStr}||${groupType}||${activeMethod}||${displayParticulars}`;
            
            if (!grouped.has(key)) {
                grouped.set(key, {
                    date: t.date,
                    type: activeMethod ? `${groupType}::${activeMethod}` : groupType,
                    particulars: displayParticulars,
                    amount: 0,
                    count: 0,
                    subLine: '',
                    subNames: [],
                    extras: { totalQty: 0, rateSum: 0, rateCount: 0, labour: 0, kanta: 0, lines: [] as string[] }
                });
            }
            
            const item = grouped.get(key);
            item.amount += isCredit ? (t.credit || 0) : (t.debit || 0);
            item.count += (t.count || 1);
            
            // Collect names and specific details for DateWise
            if (['Expense', 'Income', 'Transfer In', 'Transfer Out', 'Customer Receipt', 'Sale', 'Labour', 'Kanta'].includes(baseType)) {
                let name = '';
                if (baseType === 'Expense' || baseType === 'Income') {
                    const first = raw.split(' - ')[0]?.trim() || '';
                    const idMatch = first.match(/\]\s*(.*)/);
                    name = idMatch ? idMatch[1].trim() : first;
                    if (name.includes('::')) name = name.split('::')[0].trim();
                } else if (baseType === 'Labour' || baseType === 'Kanta') {
                    name = raw; // Store full string for parsing
                } else {
                    name = raw.split(baseType === 'Sale' ? '::' : (raw.includes('|') ? '|' : '::'))[0].trim();
                }
                if (name && !name.toLowerCase().includes('consolidated')) {
                    item.extras.lines.push(name);
                }
            }

            if (baseType === 'Purchase' || baseType === 'Sale') {
                const qtyMatch = raw.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                if (qtyMatch) {
                    item.extras.totalQty += parseFloat(qtyMatch[1]);
                    item.extras.rateSum += parseFloat(qtyMatch[2]);
                    item.extras.rateCount += 1;
                }
                const labMatch = raw.match(/Lab:\s*₹([\d.]+)/);
                if (labMatch) item.extras.labour += parseFloat(labMatch[1]);
                const kanMatch = raw.match(/Kan:\s*₹([\d.]+)/);
                if (kanMatch) item.extras.kanta += parseFloat(kanMatch[1]);
            }

            if (baseType === 'Adjustment') {
                const adjMatch = raw.match(/ADJUSTMENT \((.*?)\)/);
                if (adjMatch && adjMatch[1].includes('|')) {
                    adjMatch[1].split('|').slice(1).forEach(d => item.extras.lines.push(d.trim()));
                } else if (adjMatch) {
                    item.extras.lines.push(adjMatch[1].trim());
                }
            }
        });

        const result = Array.from(grouped.values()).map(item => {
            const [baseType] = item.type.split('::');
            const uniqueLines = [...new Set(item.extras.lines as string[])];

            if (['Expense', 'Income', 'Fund Transfer', 'Customer Receipt'].includes(baseType)) {
                if (uniqueLines.length > 0) {
                    const label = baseType === 'Customer Receipt' ? 'Receipts' : (baseType === 'Expense' ? 'Payments' : 'Records');
                    const namesPart = uniqueLines.slice(0, 4).join(', ') + (uniqueLines.length > 4 ? ` & ${uniqueLines.length - 4} more` : '');
                    item.particulars = `${item.count} ${label} | ${namesPart}`;
                }
            } else if (baseType === 'Purchase' || baseType === 'Sale') {
                const avgRate = item.extras.rateCount > 0 ? (item.extras.rateSum / item.extras.rateCount).toFixed(0) : '0';
                const prefix = baseType === 'Purchase' ? 'Purchase' : 'Sales';
                const names = uniqueLines.length > 0 ? ` | ${uniqueLines.slice(0, 3).join(', ')}${uniqueLines.length > 3 ? '...' : ''}` : '';
                item.particulars = `${prefix}: ${item.count} Receipts::${item.extras.totalQty.toFixed(2)} QTL @ ₹${avgRate}${names}`;
                if (baseType === 'Purchase') {
                    item.particulars += ` | Lab: ₹${item.extras.labour} | Kan: ₹${item.extras.kanta}`;
                }
            } else if (baseType === 'Labour' || baseType === 'Kanta') {
                const rateMap = new Map<string, { count: number, weight: number }>();
                item.extras.lines.forEach((line: string) => {
                    line.split(' | ').forEach(part => {
                        const pMatch = part.match(/PARCHI-([\d.]+)@([\d.]+)/);
                        const wMatch = part.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                        
                        if (pMatch) {
                            const count = parseFloat(pMatch[1]);
                            const rate = pMatch[2];
                            const existing = rateMap.get(rate) || { count: 0, weight: 0 };
                            rateMap.set(rate, { ...existing, count: existing.count + count });
                        } else if (wMatch) {
                            const weight = parseFloat(wMatch[1]);
                            const rate = wMatch[2];
                            const existing = rateMap.get(rate) || { count: 0, weight: 0 };
                            rateMap.set(rate, { ...existing, weight: existing.weight + weight });
                        } else {
                            const existing = rateMap.get(part) || { count: 0, weight: 0 };
                            rateMap.set(part, { ...existing, count: existing.count + 1 });
                        }
                    });
                });
                const sortedRates = Array.from(rateMap.entries()).sort((a, b) => (b[1].count + b[1].weight) - (a[1].count + a[1].weight));
                const rateParts = sortedRates.slice(0, 3).map(([rate, data]) => {
                    if (baseType === 'Labour' && data.weight > 0) {
                        return `${data.weight.toFixed(2)} QTL @ ₹${rate}`;
                    }
                    return `PARCHI-${Math.round(data.count)}@${rate}`;
                });
                if (sortedRates.length > 3) {
                    item.particulars = rateParts.join(' | ') + ` | + ${sortedRates.length - 3} more rates`;
                } else {
                    item.particulars = rateParts.join(' | ');
                }
            } else if (baseType === 'Adjustment') {
                if (uniqueLines.length > 0) {
                    item.particulars = `${item.particulars}::${uniqueLines.join(' | ')}`;
                }
            } else if (baseType === 'Supplier Payment') {
                item.particulars = item.particulars.split('::')[0];
            }

            return item;
        });
        
        return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.type.localeCompare(b.type));
    };

    const inflows = getProcessedData(true);
    const outflows = getProcessedData(false);

    const totalInflow = inflows.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalOutflow = outflows.reduce((sum: number, t: any) => sum + t.amount, 0);

    const renderParticulars = (particulars: string, color: 'emerald' | 'rose') => {
        const [main, catInfo] = (particulars || '').split('::');
        const fullText = catInfo
            ? `${main.trim()} · ${catInfo.split('|').map((s: string) => s.trim()).filter(Boolean).join(' · ')}`
            : main.trim();
        return (
            <span
                className={`text-[11px] font-bold text-slate-800 truncate block max-w-full`}
                title={fullText}
            >
                {fullText}
            </span>
        );
    };

    const renderTag = (rawType: string) => {
        const [type, method] = rawType.split('::');

        const shortForms: Record<string, string> = {
            'Supplier Payment': 'SP',
            'Customer Receipt': 'CUST',
            'Transfer In': 'TRF ↓',
            'Transfer Out': 'TRF ↑',
            'Fund Transfer': 'TRF',
            'Fund Transfer ↓': 'TRF ↓',
            'Fund Transfer ↑': 'TRF ↑',
            'Owner Capital': 'CAP',
            'Owner Capital ↑': 'CAP ↑',
            'Loan / Capital': 'LOAN',
            'Opening Bal.': 'OPN',
            'Opening Balance': 'OPN',
            'Adjustment': 'ADJ',
            'P ADJUSTMENT': 'P ADJ',
            'Purchase': 'PURCH',
            'Kanta': 'KANTA',
            'Expense': 'EX',
            'Income': 'IN',
        };

        let displayType = shortForms[type] || type;
        if (method && type !== 'Opening Balance' && type !== 'Opening Bal.') {
            const m = method.toUpperCase().trim();
            // If it's a bank with last 4 digits (e.g. HDFC-1234), keep it
            // Otherwise use full word for common methods
            const mDisplay = m.includes('-') ? m : ((m === 'CASH' || m === 'RTGS') ? m : (m.length > 4 ? m.slice(0, 3) : m));
            displayType = `${displayType}-${mDisplay}`;
        }

        const styles: any = {
            'Purchase': 'bg-blue-600 text-white',
            'Labour': 'bg-orange-600 text-white',
            'Kanta': 'bg-yellow-600 text-white',
            'Expense': 'bg-red-600 text-white',
            'Supplier Payment': 'bg-pink-600 text-white',
            'Customer Receipt': 'bg-emerald-600 text-white',
            'Transfer Out': 'bg-orange-700 text-white',
            'Transfer In': 'bg-teal-600 text-white',
            'Loan': 'bg-indigo-600 text-white',
            'P ADJUSTMENT': 'bg-blue-600 text-white',
            'Liquid': 'bg-slate-600 text-white',
            'Fund Transfer': 'bg-cyan-600 text-white',
            'Fund Transfer ↓': 'bg-teal-600 text-white',
            'Fund Transfer ↑': 'bg-orange-600 text-white',
            'Owner Capital': 'bg-violet-700 text-white',
            'Owner Capital ↑': 'bg-purple-700 text-white',
            'Loan / Capital': 'bg-violet-600 text-white',
            'Opening Bal.': 'bg-slate-600 text-white',
            'Opening Balance': 'bg-slate-600 text-white',
            'Adjustment': 'bg-amber-600 text-white',
            'Sale': 'bg-green-600 text-white',
            'Income': 'bg-teal-600 text-white',
        };
        const defaultStyle = 'bg-emerald-600 text-white';
        return (
            <span className={`inline-block w-[72px] text-center px-0.5 py-1 rounded-[4px] text-[11px] font-bold uppercase whitespace-nowrap tracking-tighter ${styles[type] || defaultStyle}`}>
                {displayType}
            </span>
        );
    };

    const renderSubNames = (names: string[], color: 'emerald' | 'rose') => {
        if (!names || names.length === 0) return null;
        return (
            <div className="mt-1 pl-2 border-l-2 border-slate-300">
                <p className="text-[8.5px] text-slate-600 font-medium leading-[1.7]">
                    {names.join(', ')}
                </p>
            </div>
        );
    };

    const isFreqVisible = viewMode !== 'DETAIL';
    const isDateVisible = viewMode !== 'OVERALL';

    return (
        <Card className="shadow-none border border-slate-200 bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 border-b py-3 flex flex-row items-center justify-between text-white">
                <div className="flex flex-col">
                    <CardTitle className="text-[13px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileText size={14} className="text-slate-300" /> Section Y: Horizontal Transaction Trail
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Chronological Double-Entry Ledger</p>
                </div>
                <div className="flex gap-1 bg-slate-800 p-1 rounded-md">
                    <button onClick={() => setViewMode('DETAIL')} className={`text-[11px] font-black uppercase px-3 py-1 rounded transition-colors ${viewMode === 'DETAIL' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Detailed</button>
                    <button onClick={() => setViewMode('DATE_WISE')} className={`text-[11px] font-black uppercase px-3 py-1 rounded transition-colors ${viewMode === 'DATE_WISE' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Date-wise</button>
                    <button onClick={() => setViewMode('OVERALL')} className={`text-[11px] font-black uppercase px-3 py-1 rounded transition-colors ${viewMode === 'OVERALL' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Overall</button>
                </div>
            </CardHeader>
            <CardContent className="p-0 border-x">
                <div className="grid grid-cols-1 xl:grid-cols-[45%_55%] divide-y xl:divide-y-0 divide-slate-300">
                    
                    {/* INFLOWS / RECEIPTS (LEFT) */}
                    <div className="bg-white">
                        <div className="bg-emerald-50/50 border-b border-emerald-100 p-2 flex justify-between items-center sticky top-0 z-10">
                            <span className="text-[12px] font-black uppercase text-emerald-800 flex items-center gap-1">
                                <ArrowDownLeft size={14} /> Receipts (Inflow)
                            </span>
                            <span className="text-base font-black text-emerald-700">{formatCurrency(totalInflow)}</span>
                        </div>
                        <div className="overflow-auto max-h-[600px] scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent bg-slate-50 border-b-2 border-slate-300">
                                        {isDateVisible && <TableHead className="text-[11px] font-black h-9 text-slate-500 uppercase px-3 w-[65px] border-r border-slate-300">Date</TableHead>}
                                        {isFreqVisible && <TableHead className="text-[11px] font-black h-9 text-slate-500 uppercase px-3 w-[40px] border-r border-slate-300">Freq</TableHead>}
                                        <TableHead className="text-[11px] font-black h-9 text-slate-500 uppercase px-1 w-[78px] border-r border-slate-300">Type</TableHead>
                                        <TableHead className="text-[11px] font-black h-9 text-slate-500 uppercase px-3 border-r border-slate-300">Particulars</TableHead>
                                        <TableHead className="text-right text-[11px] font-black h-9 text-slate-500 uppercase px-3 w-[90px]">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inflows.map((t: any, i: number) => (
                                        <TableRow key={`in-${i}`} className="hover:bg-slate-50 border-b border-slate-200">
                                            {isDateVisible && <TableCell className="font-bold text-slate-700 py-2.5 text-[11px] whitespace-nowrap px-3 border-r border-slate-200 align-top">{format(new Date(t.date), 'dd MMM')}</TableCell>}
                                            {isFreqVisible && <TableCell className="font-bold text-slate-700 py-2.5 text-[11px] whitespace-nowrap px-3 text-center bg-slate-50/30 border-r border-slate-200 align-top">{t.count > 1 ? `${t.count}x` : '-'}</TableCell>}
                                            <TableCell className="py-2.5 px-1 border-r border-slate-200 text-center align-top">{renderTag(t.type)}</TableCell>
                                            <TableCell className="py-2.5 px-3 border-r border-slate-200 align-top">
                                                {renderParticulars(t.particulars, 'emerald')}
                                                {t.subLine && <div className="mt-1 text-[10px] font-mono text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 inline-block">{t.subLine}</div>}
                                                {renderSubNames(t.subNames, 'emerald')}
                                            </TableCell>
                                            <TableCell className="text-right py-2.5 text-[12px] font-black font-mono text-emerald-600 px-3 align-top">
                                                {formatCurrency(t.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {inflows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={isDateVisible ? 5 : 4} className="text-center py-6 text-slate-400 text-[10px] uppercase font-bold">No Receipts Found</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* OUTFLOWS / PAYMENTS (RIGHT) */}
                    <div className="bg-white xl:border-l-[6px] xl:border-double xl:border-slate-300">
                        <div className="bg-red-50/50 border-b border-red-100 p-2 flex justify-between items-center sticky top-0 z-10">
                            <span className="text-[12px] font-black uppercase text-red-800 flex items-center gap-1">
                                <ArrowUpRight size={14} /> Payments (Outflow)
                            </span>
                            <span className="text-base font-black text-red-700">{formatCurrency(totalOutflow)}</span>
                        </div>
                        <div className="overflow-auto max-h-[600px] scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent bg-slate-50 border-b-2 border-slate-300">
                                        {isDateVisible && <TableHead className="text-[11px] font-black h-9 text-slate-500 uppercase px-3 w-[65px] border-r border-slate-300">Date</TableHead>}
                                        {isFreqVisible && <TableHead className="text-[11px] font-black h-9 text-slate-500 uppercase px-3 w-[40px] border-r border-slate-300">Freq</TableHead>}
                                        <TableHead className="text-[11px] font-black h-9 text-slate-500 uppercase px-1 w-[78px] border-r border-slate-300">Type</TableHead>
                                        <TableHead className="text-[11px] font-black h-9 text-slate-500 uppercase px-3 border-r border-slate-300">Particulars</TableHead>
                                        <TableHead className="text-right text-[11px] font-black h-9 text-slate-500 uppercase px-3 w-[90px]">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {outflows.map((t: any, i: number) => (
                                        <TableRow key={`out-${i}`} className="hover:bg-slate-50 border-b border-slate-200">
                                            {isDateVisible && <TableCell className="font-bold text-slate-700 py-2.5 text-[11px] whitespace-nowrap px-3 border-r border-slate-200 align-top">{format(new Date(t.date), 'dd MMM')}</TableCell>}
                                            {isFreqVisible && <TableCell className="font-bold text-slate-700 py-2.5 text-[11px] whitespace-nowrap px-3 text-center bg-slate-50/30 border-r border-slate-200 align-top">{t.count > 1 ? `${t.count}x` : '-'}</TableCell>}
                                            <TableCell className="py-2.5 px-1 border-r border-slate-200 text-center align-top">{renderTag(t.type)}</TableCell>
                                            <TableCell className="py-2.5 px-3 border-r border-slate-200 align-top">
                                                {renderParticulars(t.particulars, 'rose')}
                                                {t.subLine && <div className="mt-1 text-[10px] font-mono text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 inline-block">{t.subLine}</div>}
                                                {renderSubNames(t.subNames, 'rose')}
                                            </TableCell>
                                            <TableCell className="text-right py-2.5 text-[12px] font-black font-mono text-red-600 px-3 align-top">
                                                {formatCurrency(t.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {outflows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={isDateVisible ? 5 : 4} className="text-center py-6 text-slate-400 text-[10px] uppercase font-bold">No Payments Found</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                </div>

                {/* LEDGER SUMMARY BAR */}
                <div className="bg-slate-900 border-t border-slate-700 p-3 flex justify-between items-center px-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${totalInflow >= totalOutflow ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                        <div className="flex flex-col">
                            <span className="text-[12px] font-black uppercase tracking-[0.1em] text-white">Daily Ledger Balance</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Transactional Variance</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col items-end border-r border-slate-700 pr-8">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Gross Inflow</span>
                            <span className="text-[13px] font-black font-mono text-emerald-400">{formatCurrency(totalInflow)}</span>
                        </div>
                        <div className="flex flex-col items-end border-r border-slate-700 pr-8">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Gross Outflow</span>
                            <span className="text-[13px] font-black font-mono text-rose-400">{formatCurrency(totalOutflow)}</span>
                        </div>
                        <div className="flex flex-col items-end min-w-[120px]">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-0.5">
                                {totalInflow >= totalOutflow ? 'Surplus (+)' : 'Deficit (-)'}
                            </span>
                            <span className={`text-xl font-black font-mono leading-none ${totalInflow >= totalOutflow ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalInflow >= totalOutflow ? '+' : ''}{formatCurrency(totalInflow - totalOutflow)}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
