import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from "@/lib/utils";
import type { Expense } from "@/lib/definitions";

export type ViewMode = 'DETAIL' | 'DATE_WISE' | 'OVERALL';

interface TransactionTrailProps {
    reportData: any;
    viewMode: ViewMode;
    setViewMode: (v: ViewMode) => void;
}

const isDeletedRecord = (x: any) => {
    if (!x) return false;
    return x.isDeleted === true || x.isDeleted === 'true' || x.isDeleted === 1 || x.isDeleted === '1';
};

export const CashContraTrail: React.FC<TransactionTrailProps> = ({ reportData, viewMode, setViewMode }) => {

    const getProcessedData = (isCredit: boolean) => {
        const isCash = (acc: string) => acc === 'CashInHand' || acc === 'CashAtHome';

        let ledger = [...reportData.consolidatedLedger];

        // Process expenses from reportData.expenses
        if (reportData.expenses && Array.isArray(reportData.expenses)) {
            reportData.expenses.forEach((expense: Expense) => {
                if (isDeletedRecord(expense)) return;

                const amount = Number(expense.amount) || 0;
                if (amount === 0) return;

                const tags = (expense.description?.match(/#(\w+)/g) || []).map(tag => tag.substring(1).toUpperCase());
                const effectiveTags = tags.length > 0 ? tags : ['MISCELLANEOUS']; // Default tag if none found

                // 1. Credit entry for the Payee (person/entity receiving money)
                ledger.push({
                    id: `EXP-PAYEE-${expense.id}`,
                    date: expense.date,
                    particulars: expense.payee,
                    type: `EXPENSE::${expense.payee}`,
                    credit: amount,
                    debit: 0,
                    paymentMethod: expense.paymentMethod,
                    checkNo: (expense as any).checkNo,
                    priority: 2, // Higher priority for payee entries
                });

                // 2. Debit entry for each Tag (expense category)
                effectiveTags.forEach(tag => {
                    ledger.push({
                        id: `EXP-TAG-${expense.id}-${tag}`,
                        date: expense.date,
                        particulars: tag,
                        type: `EXPENSE::${tag}`,
                        debit: amount,
                        credit: 0,
                        paymentMethod: expense.paymentMethod,
                        checkNo: (expense as any).checkNo,
                        priority: 1, // Even higher priority for tag entries
                    });
                });
            });
        }

        ledger = ledger.filter((t: any) => {
            if (t.type === 'Opening Balance' && t.id === 'OP-BANK') return false;
            
            if (t.type === 'Internal Transfer') {
                const srcCash = isCash(t.transferSource);
                const destCash = isCash(t.transferDest);

                if (srcCash && destCash) return false;
                if (!srcCash && destCash) return t.credit > 0;
                if (srcCash && !destCash) return t.debit > 0;
                return true;
            }
            return true;
        });
        const contraEntries: any[] = [];
        
        // Generate contra entries for all non-cash transactions
        ledger.forEach((t: any) => {
            const p = t.particulars || '';
            const methodMatch = p.match(/\((.*?)\)/);
            const method = methodMatch ? methodMatch[1] : '';
            const [baseType, typeMethod] = t.type.split('::');
            
            // ONLY generate contra entries for bank-based transactions
            // EXP-CASH & pure cash entries never get contra. EXP-BOB (bank charges) DO get contra.
            const isInternalTag = t.id?.startsWith('INT-') || t.priority === 7;
            const isCashExpense = baseType === 'EXP-CASH' || (baseType.startsWith('EXP') && (typeMethod === 'CASH' || t.paymentMethod === 'Cash'));
            const isCashIncome  = baseType === 'INC-CASH' || (baseType.startsWith('INC') && (typeMethod === 'CASH' || t.paymentMethod === 'Cash'));
            const isPureCash    = isCashExpense || isCashIncome ||
                                  baseType === 'Internal Transfer' ||  // Fund transfers handle their own display — no bank contra needed
                                  baseType.startsWith('Purchase') || baseType.startsWith('Sale') || baseType === 'PURCH' ||
                                  baseType === 'CD Received' ||
                                  baseType === 'Adjustment' || baseType === 'Labour' || baseType === 'Kanta' ||
                                  isInternalTag ||
                                  baseType.endsWith('-CASH') ||
                                  t.paymentMethod === 'Cash' ||
                                  (baseType === 'EXPENSE' && t.paymentMethod === 'Cash');
            if (isPureCash) return;

            // Handle new short tag format: SP-BOB, CR-BOB, EXP-BOB etc.
            let activeMethod = typeMethod || method || '';
            if (!activeMethod) {
                const dashParts = t.type.split('-');
                if (dashParts.length > 1) {
                    activeMethod = dashParts.slice(1).join('-');
                }
            }
            
            const isBank = activeMethod && activeMethod.toLowerCase() !== 'cash' && activeMethod !== 'CashInHand' && activeMethod !== 'CashAtHome' && activeMethod !== 'P ADJUSTMENT';
            
            // Friendly display label for particulars
            const bankAccounts = reportData.bankAccounts || [];
            const accId = t.accountId || t.bankAccountId;
            let matchedBank = bankAccounts.find((b: any) => b.id === accId);
            if (!matchedBank && activeMethod) {
                const searchStr = activeMethod.toLowerCase();
                matchedBank = bankAccounts.find((b: any) => 
                    b.id?.toLowerCase() === searchStr ||
                    b.bankName?.toLowerCase().includes(searchStr) ||
                    searchStr.includes(b.bankName?.toLowerCase() || '')
                );
            }
            let bankLabel = activeMethod || 'Bank';
            if (matchedBank) {
                const name = matchedBank.bankName || activeMethod || 'Bank';
                const accNo = matchedBank.accountNumber ? String(matchedBank.accountNumber).trim() : '';
                const last4 = accNo.length >= 4 ? accNo.slice(-4) : accNo;
                bankLabel = last4 ? `${name} (...${last4})` : name;
            }
            
            if (isBank && baseType !== 'Opening Balance' && baseType !== 'Opening Bal.') {
                if (t.credit > 0) {
                    // It was an inflow to Bank. Add a contra outflow from Cash.
                    contraEntries.push({
                         ...t,
                         id: `contra-${t.id || Math.random()}`,
                         type: `Contra::${bankLabel}`,
                         particulars: `${bankLabel} Contra (${baseType})`,
                         debit: t.credit,
                         credit: 0
                    });
                } else if (t.debit > 0) {
                    // It was an outflow from Bank (e.g. SP-BOB). Add a contra inflow to Cash side.
                    contraEntries.push({
                         ...t,
                         id: `contra-${t.id || Math.random()}`,
                         type: `Contra::${bankLabel}`,
                         particulars: `${bankLabel} Contra (${baseType})`,
                         credit: t.debit,
                         debit: 0,
                         priority: t.priority || 3
                    });
                }
            }
        });
        
        ledger = [...ledger, ...contraEntries];

        // --- CONSOLIDATION LOGIC: Group by Check Number / Type ---
        const groupedMap = new Map<string, any>();
        const finalLedger: any[] = [];
        
        ledger.forEach(t => {
            const check = t.checkNo || '';
            const dStr = format(new Date(t.date), 'yyyy-MM-dd');
            const type = t.type || 'Other';
            
            // Group Contra entries by Day + Type + Check (if check exists, so different checks remain separate).
            // Group SP-/CR-/CD entries by Day + Type + Check (if check exists).
            const isContra = type.startsWith('Contra');
            const canGroup = isContra || (t.credit > 0 && check && (
                type.startsWith('SP-') || 
                type.startsWith('CR-') || 
                type.startsWith('CD Received')
            ));
            
            if (canGroup) {
                const key = (isContra && !check) ? `${dStr}|${type}` : `${dStr}|${type}|${check}`;
                if (!groupedMap.has(key)) {
                    groupedMap.set(key, { 
                        ...t, 
                        id: `CONSOL-${key}`,
                        _isConsolidated: true,
                        _originalParticulars: [t.particulars]
                    });
                } else {
                    const g = groupedMap.get(key);
                    g.debit += t.debit;
                    g.credit += t.credit;
                    if (!g._originalParticulars.includes(t.particulars)) {
                         g._originalParticulars.push(t.particulars);
                    }
                }
            } else {
                finalLedger.push(t);
            }
        });
        
        groupedMap.forEach(g => {
            const count = g._originalParticulars.length;
            const checkLabel = g.checkNo ? `Check: ${g.checkNo} | ` : '';
            const baseP = g.particulars;
            
            if (count > 1) {
                if (g.type.startsWith('Contra')) {
                    // Strip the "BOB Contra (INC-BOB)" style check details and make it clean
                    const bankName = g.type.split('::')[1] || 'Bank';
                    g.particulars = `${bankName} Contra (${count} Entries)`;
                } else {
                    g.particulars = `${checkLabel}${count} Rec/Pay | ${g._originalParticulars[0].split('|')[0]} & Others`;
                }
            } else {
                g.particulars = `${checkLabel}${baseP}`;
            }
            finalLedger.push(g);
        });
        
        ledger = finalLedger;
        // --- END CONSOLIDATION ---

        const transactions = ledger.filter((t: any) => {
            const baseTag = t.type?.split('::')[0] || '';
            const isStandardIncome = baseTag.startsWith('INC') || baseTag.startsWith('Income');
            const isStandardExpense = baseTag.startsWith('EXP') || baseTag.startsWith('Expense');
            
            if (isCredit) {
                // Inflow side: show if it has credit, but never show standard expense entries
                if (isStandardExpense) return false;
                return t.credit > 0;
            } else {
                // Outflow side: show if it has debit, but never show standard income entries
                if (isStandardIncome) return false;
                return t.debit > 0;
            }
        });
        
        if (viewMode === 'DETAIL') {
            return transactions.map((t: any) => ({
                date: t.date,
                particulars: t.particulars,
                type: t.type,
                amount: isCredit ? t.credit : t.debit,
                count: 1,
                subLine: '',
                priority: t.priority || 99
            })).sort((a: any, b: any) => {
                const dA = new Date(a.date); const dB = new Date(b.date);
                const dayA = new Date(dA.getFullYear(), dA.getMonth(), dA.getDate()).getTime();
                const dayB = new Date(dB.getFullYear(), dB.getMonth(), dB.getDate()).getTime();
                if (dayA !== dayB) return dayA - dayB;
                return (a.priority || 99) - (b.priority || 99);
            });
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
                    const isInflow = !t.debit;
                    if (isInflow) {
                        const vName = raw.split('Account')[0].trim();
                        ensure(`Purch-In-${vName}`, `Purchase::${vName}`, raw);
                        groups[`Purch-In-${vName}`].amount += amt;
                        groups[`Purch-In-${vName}`].count += (t.count || 1);
                        const qtyMatch = raw.match(/([\d.]+)\s*QTL/);
                        if (qtyMatch) groups[`Purch-In-${vName}`].extras.totalQty += parseFloat(qtyMatch[1]);
                        const labMatch = raw.match(/Lab:\s*₹([\d.]+)/);
                        if (labMatch) groups[`Purch-In-${vName}`].extras.labour += parseFloat(labMatch[1]);
                        const kanMatch = raw.match(/Kan:\s*₹([\d.]+)/);
                        if (kanMatch) groups[`Purch-In-${vName}`].extras.kanta += parseFloat(kanMatch[1]);
                    } else {
                        const sName = raw.split('|')[0].trim();
                        ensure(`Purch-Out-${sName}`, 'Purchase', sName);
                        groups[`Purch-Out-${sName}`].amount += amt;
                        groups[`Purch-Out-${sName}`].count += (t.count || 1);
                        const qtyMatch = raw.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                        if (qtyMatch) {
                            groups[`Purch-Out-${sName}`].extras.totalQty += parseFloat(qtyMatch[1]);
                            groups[`Purch-Out-${sName}`].extras.rateSum += parseFloat(qtyMatch[2]);
                            groups[`Purch-Out-${sName}`].extras.rateCount += 1;
                        }
                    }

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
                    const isOutflow = t.debit > 0;
                    if (isOutflow) {
                        const vName = raw.split('Account')[0].trim();
                        ensure(`Sale-Out-${vName}`, `Sale::${vName}`, raw);
                        groups[`Sale-Out-${vName}`].amount += amt;
                        groups[`Sale-Out-${vName}`].count += (t.count || 1);
                        const qtyMatch = raw.match(/([\d.]+)\s*QTL/);
                        if (qtyMatch) groups[`Sale-Out-${vName}`].extras.totalQty += parseFloat(qtyMatch[1]);
                    } else {
                        const cName = raw.split('|')[0].trim();
                        ensure(`Sale-In-${cName}`, 'Sale', cName);
                        groups[`Sale-In-${cName}`].amount += amt;
                        groups[`Sale-In-${cName}`].count += (t.count || 1);
                        const qtyMatch = raw.match(/([\d.]+)\s*QTL\s*@\s*₹([\d.]+)/);
                        if (qtyMatch) {
                            groups[`Sale-In-${cName}`].extras.totalQty += parseFloat(qtyMatch[1]);
                            groups[`Sale-In-${cName}`].extras.rateSum += parseFloat(qtyMatch[2]);
                            groups[`Sale-In-${cName}`].extras.rateCount += 1;
                        }
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

                } else if (t.type.startsWith('EXPENSE::')) {
                    const [, subType] = t.type.split('::');
                    const key = `EXPENSE::${subType}`;
                    ensure(key, 'Expense', subType);
                    groups[key].amount += amt;
                    groups[key].count += (t.count || 1);
                    // For EXPENSE::Payee, particulars is the payee name
                    // For EXPENSE::TAG, particulars is the tag name
                    if (t.particulars) groups[key].extras.lines.push(t.particulars);

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
                         adjMatch[1].split('|').slice(1).forEach((d: string) => groups[gKey].extras.lines.push(d.trim()));
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

                } else if (t.type.startsWith('Contra')) {
                    const method = t.type.split('::')[1];
                    const gKey = `Contra-${method}`;
                    ensure(gKey, 'Contra', `${method} Contra`);
                    groups[gKey].amount += amt;
                    groups[gKey].count += (t.count || 1);
                    const baseMatch = t.particulars.match(/\((.*?)\)/);
                    if (baseMatch) groups[gKey].extras.lines.push(baseMatch[1]);
                } else if (t.type === 'CD Received') {
                    if (isCredit) {
                        ensure('CD-Rec-Acc', 'CD Received', 'CD Received Account');
                        groups['CD-Rec-Acc'].amount += amt;
                        groups['CD-Rec-Acc'].count += (t.count || 1);
                    } else {
                        ensure(`CD-Rec-Out-${raw}`, 'CD Received', raw);
                        groups[`CD-Rec-Out-${raw}`].amount += amt;
                        groups[`CD-Rec-Out-${raw}`].count += (t.count || 1);
                    }

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
                } else if (g.type === 'Purchase' || g.type.startsWith('Purchase::')) {
                    if (g.type === 'Purchase') {
                        const avgRate = g.extras.rateCount > 0 ? (g.extras.rateSum / g.extras.rateCount).toFixed(0) : '0';
                        g.particulars = `${g.count} Receipts | ${g.particulars}::${g.extras.totalQty.toFixed(2)} QTL @ ₹${avgRate}`;
                    } else {
                        g.particulars = `${g.count} Purchases | ${g.particulars}`;
                    }
                } else if (g.type === 'Sale' || g.type.startsWith('Sale::')) {
                    if (g.type === 'Sale') {
                        const avgRate = g.extras.rateCount > 0 ? (g.extras.rateSum / g.extras.rateCount).toFixed(0) : '0';
                        g.particulars = `${g.count} Receipts | ${g.particulars}::${g.extras.totalQty.toFixed(2)} QTL @ ₹${avgRate}`;
                    } else {
                        g.particulars = `${g.count} Sales | ${g.particulars}`;
                    }
                } else if (g.type === 'Adjustment') {
                    if (uniqueLines.length > 0) {
                        g.particulars = `${g.particulars}::${uniqueLines.join(' | ')}`;
                    }
                } else if (g.type === 'Contra') {
                    const uniqueLines = [...new Set(g.extras.lines as string[])];
                    g.particulars = `${g.count} Records | ${g.particulars}${uniqueLines.length > 0 ? `::${uniqueLines.join(' | ')}` : ''}`;
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
            } else if (baseType === 'EXPENSE' || baseType === 'Income') {
                displayParticulars = `Consolidated ${baseType}`;
                if (baseType === 'EXPENSE') {
                    const [, subType] = t.type.split('::');
                    displayParticulars = `Expense: ${subType}`;
                }
            } else if (baseType === 'Adjustment') {
                const adjMatch = raw.match(/ADJUSTMENT \((.*?)\)/);
                displayParticulars = adjMatch ? adjMatch[1].split('|')[0].trim() : 'Adjustment';
            } else if (baseType === 'Purchase' || baseType === 'Sale' || baseType === 'CD Received') {
                displayParticulars = p;
            } else if (baseType === 'Labour' || baseType === 'Kanta') {
                displayParticulars = p;
            } else if (baseType === 'Transfer In' || baseType === 'Transfer Out') {
                displayParticulars = 'Fund Transfer';
                groupType = 'Fund Transfer';
            } else if (baseType === 'Opening Balance') {
                displayParticulars = p;
            } else if (baseType === 'Contra') {
                displayParticulars = p;
            } else if (baseType === 'Supplier Payment' || baseType === 'Customer Receipt') {
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
                    adjMatch[1].split('|').slice(1).forEach((d: string) => item.extras.lines.push(d.trim()));
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
                if (isCredit) {
                    // Purchase Inflow (Supplier) or Sale Inflow (Customer)
                    const avgRate = item.extras.rateCount > 0 ? (item.extras.rateSum / item.extras.rateCount).toFixed(0) : '0';
                    const pParts = item.particulars.split('|');
                    const mainInfo = pParts.length > 1 ? pParts.slice(0, -1).join('|').trim() : item.particulars.split('::')[0].trim();
                    item.particulars = `${item.count > 1 ? item.count + ' Receipts | ' : ''}${mainInfo}::${item.extras.totalQty.toFixed(2)} QTL @ ₹${avgRate}`;
                } else {
                    // Purchase Outflow (Variety) or Sale Outflow (Variety)
                    item.particulars = `${item.count > 1 ? item.count + ' Entries | ' : ''}${item.particulars}`;
                }
            } else if (baseType === 'Supplier Payment' || baseType === 'Customer Receipt') {
                item.particulars = `${item.count > 1 ? item.count + ' Records | ' : ''}${item.particulars}`;
            } else if (baseType === 'CD Received') {
                item.particulars = `${item.count > 1 ? item.count + ' CD Entries | ' : ''}${item.particulars}`;
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
            } else if (baseType === 'Contra') {
                item.particulars = `${item.count} Records | ${item.particulars}`;
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
        const raw = particulars || '';
        const [main, catInfo] = raw.split('::');
        
        // Extract leading [EXID] if present
        const idMatch = main.trim().match(/^\[(\w+)\]\s*(.*)$/);
        const idBadge = idMatch ? idMatch[1] : null;
        const mainText = idMatch ? idMatch[2] : main.trim();
        
        const fullText = catInfo
            ? `${mainText} · ${catInfo.split('|').map((s: string) => s.trim()).filter(Boolean).join(' · ')}`
            : mainText;
        return (
            <span className={`text-[11px] font-bold text-slate-800 truncate block max-w-full`} title={raw}>
                {idBadge && (
                    <span className="inline-block mr-1.5 px-1 py-0 rounded text-[9px] font-black font-mono bg-indigo-100 text-indigo-700 border border-indigo-200 leading-4">
                        {idBadge}
                    </span>
                )}
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
            'Contra': 'BANK',
            'Brokerage': 'BRK',
        };

        let displayType = shortForms[type] || type;
        if (type.startsWith('EXPENSE::')) {
            displayType = shortForms['Expense'] || 'EX';
            const [, subType] = type.split('::');
            displayType = `${displayType}-${subType.substring(0, 4)}`; // e.g., EX-SALA for Salary
        } else if (type === 'Sale' && method) {
            displayType = method.toUpperCase().trim();
        } else if (type === 'Purchase' && method) {
            displayType = method.toUpperCase().trim();
        } else if (method && type !== 'Opening Balance' && type !== 'Opening Bal.') {
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
            'Contra': 'bg-sky-600 text-white',
            'Brokerage': 'bg-rose-700 text-white',
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
                        <FileText size={14} className="text-slate-300" /> Section Y-II: Cash Book Ledger (Contra Mode)
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Double-Entry Ledger with Auto-Contra for Bank/Online</p>
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
