import { useMemo } from 'react';
import { startOfDay, isSameDay, subDays, differenceInDays, addDays, format } from 'date-fns';

export interface VarietySummary {
    variety: string;
    totalQty: number;
    totalValue: number;
    avgRate: number;
    margin?: number;
    marginPct?: number;
}

const isDeletedRecord = (x: any) => {
    if (!x) return false;
    return x.isDeleted === true || x.isDeleted === 'true' || x.isDeleted === 1 || x.isDeleted === '1';
};

export function useReportCalculations(startDate: Date, endDate: Date, globalData: any, loans: any[], isActive: boolean = true) {
    return useMemo(() => {
        if (!isActive) return null;
        const normalizeVariety = (v: string) => {
            const name = (v || "").toUpperCase().trim();
            if (name.includes("WHEAT") || name.includes("GEHU") || name.includes("KANAK") || name.includes("WHEET")) return "WHEAT";
            if (name.includes("MUSTARD") || name.includes("SARSO") || name.includes("SARSON")) return "MUSTARD";
            if (name.includes("PADDY") || name.includes("DHAN") || name.includes(" धान")) return "PADDY";
            return name || "UNKNOWN";
        };

        const resolveMethod = (m: string) => {
            if (!m) return 'CASH';
            if (m === 'CashInHand') return 'CASH';
            if (m === 'CashAtHome') return 'HOME';
            const bank = (globalData.bankAccounts || []).find((b: any) => b.id === m);
            if (bank) {
                return bank.accountNumber ? bank.accountNumber.slice(-4) : 'BANK';
            }
            return m.toUpperCase();
        };

        const filterDate = startOfDay(startDate);
        const filterEndDate = startOfDay(endDate);
        const rangeInDays = differenceInDays(filterEndDate, filterDate) + 1;
        const offsetDate = (d: string | Date) => startOfDay(new Date(d));
        const isUntil = (d: any, target: Date) => offsetDate(d) <= target;
        const isDay = (d: any, target: Date) => isSameDay(offsetDate(d), target);

        const getBalancesAtDate = (date: Date) => {
            const bankBalances = new Map<string, number>();
            globalData.bankAccounts.forEach((acc: any) => bankBalances.set(acc.id, 0));
            let cashInHand = 0; let cashAtHome = 0;
            const targetDate = startOfDay(date);

            globalData.fundTransactions.filter((t: any) => isUntil(t.date, targetDate)).forEach((t: any) => {
                const amount = Number(t.amount) || 0;
                if (t.source === 'CashInHand') cashInHand -= amount;
                if (t.destination === 'CashInHand') cashInHand += amount;
                if (t.source === 'CashAtHome') cashAtHome -= amount;
                if (t.destination === 'CashAtHome') cashAtHome += amount;
                if (bankBalances.has(t.source)) bankBalances.set(t.source, (bankBalances.get(t.source) || 0) - amount);
                if (bankBalances.has(t.destination)) bankBalances.set(t.destination, (bankBalances.get(t.destination) || 0) + amount);
            });
            globalData.incomes.filter((i: any) => isUntil(i.date, targetDate)).forEach((i: any) => {
                if (i.isInternal) return; 
                const amt = Number(i.amount) || 0;
                const id = i.bankAccountId;
                if (id === 'CashAtHome') cashAtHome += amt;
                else if (id === 'CashInHand' || (i.paymentMethod === 'Cash' && !id)) cashInHand += amt;
                else if (id && bankBalances.has(id)) bankBalances.set(id, (bankBalances.get(id) || 0) + amt);
            });
            globalData.expenses.filter((e: any) => isUntil(e.date, targetDate)).forEach((e: any) => {
                if (e.isInternal) return; 
                const amt = Number(e.amount) || 0;
                const id = e.bankAccountId;
                if (id === 'CashAtHome') cashAtHome -= amt;
                else if (id === 'CashInHand' || (e.paymentMethod === 'Cash' && !id)) cashInHand -= amt;
                else if (id && bankBalances.has(id)) bankBalances.set(id, (bankBalances.get(id) || 0) - amt);
            });
            globalData.supplierPayments.filter((p: any) => isUntil(p.date, targetDate)).forEach((p: any) => {
                const amt = Number(p.amount) || 0;
                let id = p.bankAccountId;
                if (!id && (p.receiptType === 'RTGS' || p.receiptType === 'Online')) {
                    const accMatch = globalData.bankAccounts.find((acc: any) => acc.accountNumber === (p as any).bankAcNo);
                    if (accMatch) id = accMatch.id;
                }
                if (id === 'CashAtHome') cashAtHome -= amt;
                else if (id === 'CashInHand' || (p.receiptType === 'Cash' && !id)) cashInHand -= amt;
                else if (id && bankBalances.has(id)) bankBalances.set(id, (bankBalances.get(id) || 0) - amt);
            });
            globalData.customerPayments.filter((p: any) => isUntil(p.date, targetDate)).forEach((p: any) => {
                let amt = Number(p.amount) || 0;
                const isLedger = p.receiptType === 'Ledger' || p.paymentMethod === 'Ledger';
                if (isLedger) {
                    amt = -amt;
                }
                const id = p.bankAccountId;
                if (id === 'CashAtHome') cashAtHome += amt;
                else if (id === 'CashInHand' || (p.paymentMethod === 'Cash' && !id)) cashInHand += amt;
                else if (id && bankBalances.has(id)) bankBalances.set(id, (bankBalances.get(id) || 0) + amt);
            });

            return { bankBalances, cashInHand, cashAtHome, total: Array.from(bankBalances.values()).reduce((s, b) => s + b, 0) + cashInHand + cashAtHome };
        };

        const dayWiseLiquidity = Array.from({ length: rangeInDays }).map((_, i) => {
            const day = startOfDay(addDays(filterDate, i));
            const opening = getBalancesAtDate(subDays(day, 1));
            const closing = getBalancesAtDate(day);

            const accounts = ['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id), 'CD'];
            const metrics: Record<string, any> = {};

            accounts.forEach(id => {
                if (id === 'CD') {
                    const dayCdGiven = globalData.customerPayments.filter((p: any) => isDay(p.date, day) && !isDeletedRecord(p)).reduce((s: number, x: any) => s + (Number(x.cdAmount) || 0), 0);
                    const dayCdReceived = globalData.supplierPayments.filter((p: any) => isDay(p.date, day) && !isDeletedRecord(p)).reduce((s: number, x: any) => s + (Number(x.cdAmount) || 0), 0);
                    
                    // CD account doesn't have a "balance" in the traditional sense, but we can show it as a flow
                    metrics[id] = { 
                        opening: 0, 
                        closing: 0, 
                        income: Math.round(dayCdReceived), 
                        expense: Math.round(dayCdGiven) 
                    };
                    return;
                }

                const op = id === 'CashInHand' ? opening.cashInHand : id === 'CashAtHome' ? opening.cashAtHome : opening.bankBalances.get(id) || 0;
                const cl = id === 'CashInHand' ? closing.cashInHand : id === 'CashAtHome' ? closing.cashAtHome : closing.bankBalances.get(id) || 0;

                const dayIncs = globalData.incomes.filter((inc: any) => isDay(inc.date, day) && !inc.isInternal && (inc.bankAccountId === id || (id === 'CashInHand' && inc.paymentMethod === 'Cash' && !inc.bankAccountId))).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                const dayExps = globalData.expenses.filter((exp: any) => isDay(exp.date, day) && !exp.isInternal && (exp.bankAccountId === id || (id === 'CashInHand' && exp.paymentMethod === 'Cash' && !exp.bankAccountId))).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                const daySPmts = globalData.supplierPayments.filter((p: any) => isDay(p.date, day) && ((p.bankAccountId === id) || (id === 'CashInHand' && p.receiptType === 'Cash' && !p.bankAccountId) || (!p.bankAccountId && (p.receiptType === 'RTGS' || p.receiptType === 'Online') && globalData.bankAccounts.find((acc: any) => acc.id === id)?.accountNumber === (p as any).bankAcNo))).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                const dayCPmts = globalData.customerPayments.filter((p: any) => isDay(p.date, day) && (p.bankAccountId === id || (id === 'CashInHand' && p.paymentMethod === 'Cash' && !p.bankAccountId))).reduce((s: number, x: any) => {
                    let amt = Number(x.amount) || 0;
                    const isLedger = x.receiptType === 'Ledger' || x.paymentMethod === 'Ledger';
                    if (isLedger) {
                        amt = -amt;
                    }
                    return s + amt;
                }, 0);
                
                const dayFundIns = globalData.fundTransactions.filter((t: any) => isDay(t.date, day) && t.destination === id).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                const dayFundOuts = globalData.fundTransactions.filter((t: any) => isDay(t.date, day) && t.source === id).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);

                metrics[id] = { 
                    opening: Math.round(op), 
                    closing: Math.round(cl), 
                    income: Math.round(dayIncs + dayCPmts + dayFundIns), 
                    expense: Math.round(dayExps + daySPmts + dayFundOuts) 
                };
            });

            return { date: format(day, 'dd MMM'), metrics, totalOpening: Math.round(opening.total), totalClosing: Math.round(closing.total) };
        });

        const liquidSnapshot = getBalancesAtDate(filterEndDate);

        const periodScope = (d: any) => {
            const ed = offsetDate(d);
            return ed >= filterDate && ed <= filterEndDate;
        };

        const pMap = new Map<string, VarietySummary>();
        globalData.suppliers.filter((s: any) => periodScope(s.date)).forEach((s: any) => {
            const v = normalizeVariety(s.variety || '');
            if (!pMap.has(v)) pMap.set(v, { variety: v, totalQty: 0, totalValue: 0, avgRate: 0 });
            const e = pMap.get(v)!;
            const qty   = Number(s.netWeight) || 0;
            const lab   = Number(s.labouryAmount) || 0;
            const kn    = Number(s.kanta) || 0;
            const gross = qty * (Number(s.rate) || 0);
            e.totalQty   += qty;
            e.totalValue += Math.max(0, gross - lab - kn);
        });
        pMap.forEach(v => v.avgRate = v.totalQty > 0 ? v.totalValue / v.totalQty : 0);

        const sMap = new Map<string, VarietySummary>();
        globalData.customers.filter((c: any) => periodScope(c.date)).forEach((c: any) => {
            const v = normalizeVariety(c.variety || '');
            if (!sMap.has(v)) sMap.set(v, { variety: v, totalQty: 0, totalValue: 0, avgRate: 0 });
            const e = sMap.get(v)!;
            e.totalQty += Number(c.netWeight) || 0;
            e.totalValue += Number(c.amount) || 0;
        });
        sMap.forEach(v => v.avgRate = v.totalQty > 0 ? v.totalValue / v.totalQty : 0);

        const dayWiseFlows = Array.from({ length: rangeInDays }).map((_, i) => {
            const day = startOfDay(addDays(filterDate, i));
            const isDay = (d: any) => isSameDay(offsetDate(d), day);
            
            // 1. Supplier Payments
            const sPmts = (globalData.supplierPayments || []).filter((p: any) => isDay(p.date) && !isDeletedRecord(p));
            const sCash = sPmts.filter((p: any) => (p.receiptType || '').toLowerCase() === 'cash').reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            const sRtgs = sPmts.filter((p: any) => (p.receiptType || '').toLowerCase() === 'rtgs').reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            const gDist = sPmts.filter((p: any) => {
                const rt = (p.receiptType || '').toLowerCase();
                return rt === 'gov dist' || rt === 'gov.' || rt === 'gov' || rt.startsWith('gov');
            }).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

            // Ledger Supplier Payments
            const sLedger = sPmts.filter((p: any) => (p.receiptType || '').toLowerCase() === 'ledger');
            const sLedgerDebit = sLedger.filter((p: any) => {
                const drCrLower = String(p.drCr || "").trim().toLowerCase();
                return drCrLower !== 'credit' && (Number(p.amount) || 0) >= 0;
            }).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            const sLedgerCredit = sLedger.filter((p: any) => {
                const drCrLower = String(p.drCr || "").trim().toLowerCase();
                return drCrLower === 'credit' || (Number(p.amount) || 0) < 0;
            }).reduce((s: number, p: any) => s + Math.abs(Number(p.amount) || 0), 0);
            
            const sCdTotal = sPmts.reduce((s: number, p: any) => s + (Number(p.cdAmount) || 0), 0);
            
            // 2. Customer Payments
            const cPayments = (globalData.customerPayments || []).filter((p: any) => isDay(p.date) && !isDeletedRecord(p));
            const cPmts = cPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            const cCdTotal = cPayments.reduce((s: number, p: any) => s + (Number(p.cdAmount) || 0), 0);
            
            // 3. Manual Ledger Entries
            const mEntries = (globalData.ledgerEntries || []).filter((e: any) => isDay(e.date) && !isDeletedRecord(e));
            const mDebits = mEntries.reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0);
            const mCredits = mEntries.reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0);
            
            // 4. Incomes & Expenses (Raw)
            const expsRaw = (globalData.expenses || []).filter((e: any) => isDay(e.date) && !e.isInternal && !isDeletedRecord(e)).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
            const incsRaw = (globalData.incomes || []).filter((i: any) => isDay(i.date) && !i.isInternal && !isDeletedRecord(i)).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
            
            const exps = expsRaw + cCdTotal + sLedgerDebit + mDebits; // Customer CD + supplier ledger debits + manual ledger debits are expenses
            const incs = incsRaw + sCdTotal + sLedgerCredit + mCredits; // Supplier CD + supplier ledger credits + manual ledger credits are incomes
            
            const totalIncomes = incs + cPmts;
            const totalPayments = sCash + sRtgs + gDist;
            const ledgerOutflow = sLedgerDebit + mDebits;
            const seCash = sCash + exps;
            const netTotal = (totalPayments + ledgerOutflow + exps) - totalIncomes;
            return { 
                date: format(day, 'dd MMM'), 
                supplierCash: Math.round(sCash), 
                supplierRtgs: Math.round(sRtgs), 
                govDist: Math.round(gDist), 
                ledger: Math.round(ledgerOutflow),
                expenses: Math.round(exps), 
                incomes: Math.round(totalIncomes), 
                seCash: Math.round(seCash), 
                netTotal: Math.round(netTotal), 
                totalPayments: Math.round(totalPayments) 
            };
        });

        const varietyDayData: Record<string, any[]> = {};
        globalData.suppliers.filter((s: any) => periodScope(s.date)).forEach((s: any) => {
            const v = normalizeVariety(s.variety || '');
            if (!varietyDayData[v]) varietyDayData[v] = [];
            const dayStr = format(offsetDate(s.date), 'dd MMM yy');
            let dEntry = varietyDayData[v].find(de => de.date === dayStr);
            if (!dEntry) {
                dEntry = { 
                    date: dayStr, gross: 0, tier: 0, finalWt: 0, kartaWt: 0, netWt: 0, 
                    totalAmt: 0, kartaAmt: 0, afterKartaAmt: 0, labAmt: 0, kanAmt: 0, cdAmt: 0,
                    totalOriginal: 0, totalPaid: 0, netPayable: 0, finalNet: 0,
                    parchi: 0, totalRate: 0 
                };
                varietyDayData[v].push(dEntry);
            }
            const sAmt = Number(s.amount) || 0;
            const sKarta = Number(s.kartaAmount) || Number(s.kartaAmt) || 0;
            const afterKarta = sAmt - sKarta;
            const sLab = Number(s.labouryAmount) || 0;
            const sKan = Number(s.kanta) || 0;
            const netAmount = afterKarta - sLab - sKan;
            const actualCd = Number(s.cdAmount) !== undefined && !isNaN(Number(s.cdAmount)) ? Number(s.cdAmount) : (afterKarta * 0.01);
            const finalNetValue = netAmount - actualCd;

            dEntry.gross += Number(s.grossWeight) || 0;
            dEntry.tier += Number(s.teirWeight) || 0;
            dEntry.finalWt += Number(s.weight) || 0;
            dEntry.kartaWt += Number(s.kartaWeight) || 0;
            dEntry.netWt += Number(s.netWeight) || 0;
            dEntry.totalAmt += sAmt;
            dEntry.kartaAmt += sKarta;
            dEntry.afterKartaAmt += afterKarta;
            dEntry.labAmt += sLab;
            dEntry.kanAmt += sKan;
            dEntry.netPayable += netAmount;
            dEntry.cdAmt += actualCd;
            dEntry.finalNet += finalNetValue;
            dEntry.totalOriginal += Number(s.netAmount) || 0;
            dEntry.totalPaid += Number(s.paidAmount) || 0;
            dEntry.parchi += 1;
            dEntry.totalRate += Number(s.rate) || 0;
        });

        const consolidatedSupps = globalData.suppliers.filter((s: any) => periodScope(s.date));
        const consolidatedCusts = globalData.customers.filter((c: any) => periodScope(c.date));

        // --- EXACT MIRROR OF VARIETY ACCOUNTS LOGIC ---
        const stockMap = new Map<string, number>();
        const linkedIdsForStock = new Set<string>();

        // Step 1: Standardize all transactions into a single format (Matching expense-tracker-client.tsx)
        const allTransactionsForStock: any[] = [];

        // 1.1 Incomes & Expenses (Standard)
        [...(globalData.incomes || []), ...(globalData.expenses || [])].forEach(t => {
            if (isDeletedRecord(t)) return;
            allTransactionsForStock.push({
                ...t,
                id: t.id,
                transactionType: t.transactionType,
                entryType: t.entryType || t.transactionType, // Important: Mirroring logic
                quantity: Number(t.quantity) || 0,
                variety: t.variety || ''
            });
        });

        // 1.2 Suppliers (Purchases)
        (globalData.suppliers || []).forEach((s: any) => {
            allTransactionsForStock.push({
                id: `SUP-${s.id}`,
                transactionType: 'Expense',
                entryType: 'Buy',
                variety: s.variety,
                quantity: Number(s.netWeight || s.weight || 0)
            });
        });

        // 1.3 Customers (Sales)
        (globalData.customers || []).forEach((c: any) => {
            allTransactionsForStock.push({
                id: `CUS-${c.id}`,
                transactionType: 'Income',
                entryType: 'Sale',
                variety: c.variety,
                quantity: Number(c.netWeight || c.weight || 0)
            });
        });

        // Step 2: Calculate Stock using EXACT VarietyAccounts.tsx rules
        allTransactionsForStock.forEach(t => {
            if (!t.variety) return;
            
            // Skip manual tracker entries that are already linked to an external record
            if (!t.id.startsWith('SUP-') && !t.id.startsWith('CUS-') && linkedIdsForStock.has(t.id)) {
                return;
            }

            const varietyName = normalizeVariety(t.variety);
            const qty = t.quantity;
            const entryType = t.entryType;

            // EXACT LISTS FROM VarietyAccounts.tsx (Updated as per user request: Borrow Return -> Debit/In, Lend Return -> Credit/Out)
            const isIn = ['Buy', 'Expense', 'Extra Receive', 'Borrow Return', 'Lend'].includes(entryType);
            const isOut = ['Sale', 'Income', 'Loss', 'Use', 'Borrow', 'Lend Return'].includes(entryType);

            if (isIn) {
                stockMap.set(varietyName, (stockMap.get(varietyName) || 0) + qty);
            } else if (isOut) {
                stockMap.set(varietyName, (stockMap.get(varietyName) || 0) - qty);
            }
        });

        const consolidatedLedger = [
            ...(() => {
                const resultArr: any[] = [];
                const daysInRange = Array.from({ length: rangeInDays }).map((_, i) => addDays(filterDate, i));
                
                const opening = getBalancesAtDate(subDays(filterDate, 1));
                let opCashHand = opening.cashInHand;
                let opCashHome = opening.cashAtHome;
                const opBanks = opening.bankBalances;

                resultArr.push({ date: filterDate.toISOString(), particulars: "CASH IN HAND", id: 'OP-CASH', debit: 0, credit: opCashHand, type: 'Opening Balance' });
                resultArr.push({ date: filterDate.toISOString(), particulars: "CASH AT HOME", id: 'OP-HOME', debit: 0, credit: opCashHome, type: 'Opening Balance' });
                globalData.bankAccounts.forEach((acc: any) => {
                    resultArr.push({ date: filterDate.toISOString(), particulars: `${acc.bankName} (...${acc.accountNumber.slice(-4)})`, id: 'OP-BANK', debit: 0, credit: opBanks.get(acc.id) || 0, type: 'Opening Balance' });
                });

                daysInRange.forEach(dDate => {
                    const dStr = format(dDate, 'yyyy-MM-dd');
                    const daySupps = globalData.suppliers.filter((s: any) => isDay(s.date, dDate));
                    if (daySupps.length > 0) {
                        const varietyPurchases = new Map<string, any[]>();
                        daySupps.forEach((s: any) => {
                            const v = s.variety || 'Unknown';
                            if (!varietyPurchases.has(v)) varietyPurchases.set(v, []);
                            varietyPurchases.get(v)!.push(s);
                        });

                        // OUTFLOW: Variety Account (Stock coming in / Consolidated)
                        varietyPurchases.forEach((purchList, vName) => {
                            const vTotalAmt = purchList.reduce((sum, s) => {
                                return sum + (Number(s.netWeight) * Number(s.rate));
                            }, 0);
                            const vTotalWt = purchList.reduce((sum, s) => sum + (Number(s.netWeight) || 0), 0);
                            const vAvgRate = vTotalWt > 0 ? (purchList.reduce((sum, s) => sum + (Number(s.netWeight) * Number(s.rate)), 0) / vTotalWt).toFixed(0) : 0;
                            const vLab = purchList.reduce((sum, s) => sum + (Number(s.labouryAmount) || 0), 0);
                            const vKan = purchList.reduce((sum, s) => sum + (Number(s.kanta) || 0), 0);

                            if (vTotalAmt > 0) {
                                resultArr.push({
                                    date: dStr,
                                    particulars: `${vName} Account | ${vTotalWt.toFixed(2)} QTL @ ₹${vAvgRate} | Lab: ₹${vLab} | Kan: ₹${vKan}`,
                                    id: `PURCH-OUT-${vName}`,
                                    debit: Math.round(vTotalAmt),
                                    credit: 0,
                                    type: `Purchase::${vName}`,
                                    priority: 2
                                });
                            }
                        });

                        // INFLOW: Individual Supplier Accounts (Detailed)
                        daySupps.forEach((s: any) => {
                            const amt = Number(s.netAmount) || (Number(s.netWeight) * Number(s.rate) - Number(s.labouryAmount) - Number(s.kanta));
                            
                            const sName = s.companyName || s.name || s.partyName || s.supplierName || 'Supplier';
                            const sFatherVal = s.so || s.fatherName || s.supplierFatherName;
                            const sAddrVal = s.address || s.parchiAddress || s.supplierAddress;
                            const sFather = sFatherVal ? ` S/o ${sFatherVal}` : '';
                            const sAddr = sAddrVal ? ` | ${sAddrVal}` : '';
                            
                            if (amt > 0) {
                                resultArr.push({
                                    date: dStr,
                                    particulars: `${sName}${sFather}${sAddr} | ${Number(s.netWeight || 0).toFixed(2)} QTL @ ₹${s.rate}`,
                                    id: `PURCH-IN-${s.id || Math.random()}`,
                                    debit: 0,
                                    credit: Math.round(amt),
                                    type: `Purchase`,
                                    priority: 2
                                });
                            }
                        });
                        const dLab = daySupps.reduce((sum: number, p: any) => sum + (Number(p.labouryAmount) || 0), 0);
                        const dKan = daySupps.reduce((sum: number, p: any) => sum + (Number(p.kanta) || 0), 0);
                        if (dLab > 0) resultArr.push({
                            date: dStr, particulars: 'Sales Labour', id: 'LABR', debit: 0, credit: Math.round(dLab), type: 'Labour'
                        });
                        if (dKan > 0) resultArr.push({
                            date: dStr, particulars: 'Kanta Charges', id: 'KANTA', debit: 0, credit: Math.round(dKan), type: 'Kanta'
                        });
                    }

                    const daySales = globalData.customers.filter((c: any) => isDay(c.date, dDate));
                    
                    // OUTFLOW side: Consolidated by variety
                    const varietySales = new Map<string, any[]>();
                    daySales.forEach((s: any) => {
                        const v = s.variety || 'Unknown';
                        if (!varietySales.has(v)) varietySales.set(v, []);
                        varietySales.get(v)!.push(s);
                    });

                    varietySales.forEach((salesList, vName) => {
                        // Variety outflow = Gross (netWeight × rate) — stock leaving at base price
                        const vTotalAmt = salesList.reduce((sum, s) => sum + (Number(s.netWeight) * Number(s.rate)), 0);
                        const vTotalWt = salesList.reduce((sum, s) => sum + (Number(s.netWeight) || 0), 0);
                        const vAvgRate = vTotalWt > 0 ? (vTotalAmt / vTotalWt).toFixed(0) : 0;
                        if (vTotalAmt > 0) {
                            resultArr.push({
                                date: dStr,
                                particulars: `${vName} Account | ${vTotalWt.toFixed(2)} QTL @ ₹${vAvgRate}`,
                                id: `SALE-OUT-${vName}`,
                                debit: 0,
                                credit: Math.round(vTotalAmt),
                                type: `Sale::${vName}`,
                                priority: 2
                            });
                        }
                    });

                    // INFLOW side: Individual by customer — use netWeight × rate (matches particulars)
                    daySales.forEach((s: any) => {
                        const netWt = Number(s.netWeight) || 0;
                        const rate  = Number(s.rate) || 0;
                        const amt   = Math.round(netWt * rate);
                        const cName = s.companyName || s.name || 'Customer';
                        const cFather = s.so ? ` S/o ${s.so}` : '';
                        const cAddr = s.address ? ` | ${s.address}` : '';
                        if (amt > 0) {
                            resultArr.push({
                                date: dStr,
                                particulars: `${cName}${cFather}${cAddr} | ${netWt.toFixed(2)} QTL @ ₹${rate}`,
                                id: `SALE-IN-${s.id || Math.random()}`,
                                debit: amt,
                                credit: 0,
                                type: `Sale`,
                                priority: 2
                            });
                        }
                    });
                });
                return resultArr;
            })(),
            ...globalData.supplierPayments.filter((p: any) => periodScope(p.date) && !isDeletedRecord(p)).map((p: any) => {
                // Support finding supplier by checking comma separated parchi numbers or matching IDs
                const refNo = p.parchiNo || p.supplierId || '';
                const refArray = typeof refNo === 'string' 
                    ? refNo.split(',').map(s => s.trim()).filter(Boolean) 
                    : (refNo ? [String(refNo)] : []);

                const supplier = globalData.suppliers.find((s: any) => 
                    refArray.some(ref => String(s.srNo) === String(ref) || String(s.parchiNo) === String(ref)) || 
                    String(s.id) === String(p.supplierId) || 
                    String(s.srNo) === String(p.supplierId)
                );
                
                const sName = supplier?.companyName || supplier?.name || p.supplierName || p.partyName || p.payee || 'Supplier';
                const sFatherVal = supplier?.so || supplier?.fatherName || p.supplierFatherName || p.fatherName;
                const sAddrVal = supplier?.address || supplier?.parchiAddress || p.supplierAddress || p.address;
                const sFather = sFatherVal ? ` S/o ${sFatherVal}` : '';
                const sAddr = sAddrVal ? ` | ${sAddrVal}` : '';
                
                const bankMatch = globalData.bankAccounts?.find((b: any) => b.id === p.bankAccountId);
                let methodStr = 'Cash';
                if (bankMatch) {
                    methodStr = bankMatch.bankName;
                } else if (p.bankAccountId === 'Adjustment') {
                    methodStr = 'Adjustment';
                } else if (p.bankAccountId === 'CashInHand' || p.bankAccountId === 'CashAtHome') {
                    methodStr = 'Cash';
                } else {
                    methodStr = p.receiptType || 'Cash';
                }
                
                const refParts = [];
                if (p.parchiNo) refParts.push(`Parchi: ${p.parchiNo}`);
                if (p.utrNo) refParts.push(`UTR: ${p.utrNo}`);
                
                const shortMethod = methodStr.split(' ')[0].toUpperCase();
                
                const isLedger = p.receiptType === 'Ledger' || p.paymentMethod === 'Ledger';
                const drCrLower = String(p.drCr || "").trim().toLowerCase();
                const isCredit = isLedger && drCrLower === 'credit';
                const amt = Math.abs(Number(p.amount) || 0);

                return {
                    date: p.date,
                    particulars: `${p.paymentId ? `[${p.paymentId}] ` : ''}${sName}${sFather}${sAddr}${refParts.length > 0 ? ' | ' + refParts.join(' | ') : ''}`,
                    id: p.paymentId || 'PAY', 
                    debit: isCredit ? 0 : amt, 
                    credit: isCredit ? amt : 0, 
                    type: `SP-${shortMethod || 'CASH'}`,
                    priority: 3,
                    accountId: p.bankAccountId || (methodStr === 'Cash' || p.receiptType === 'Cash' ? 'CashInHand' : null),
                    checkNo: p.checkNo,
                    paymentMethod: methodStr === 'Cash' ? 'Cash' : methodStr
                };
            }),
            ...globalData.customerPayments.filter((p: any) => periodScope(p.date) && !isDeletedRecord(p)).map((p: any) => {
                // Find the linked sales parchi to get the actual customer name
                const refNo = p.receiptNo || p.parchiNo || (p.paidFor?.[0]?.srNo);
                
                // Handle comma-separated multiple parchi numbers (e.g., "C001, C002")
                const refArray = typeof refNo === 'string' 
                    ? refNo.split(',').map(s => s.trim()).filter(Boolean) 
                    : (refNo ? [String(refNo)] : []);

                const linkedParchi = globalData.customers.find((c: any) => 
                    refArray.some(ref => String(c.srNo) === String(ref) || String(c.parchiNo) === String(ref)) || 
                    (p.customerId && c.id === p.customerId)
                );
                
                // Get the most descriptive name possible
                const cName = linkedParchi 
                    ? (linkedParchi.companyName || linkedParchi.name || 'Customer') 
                    : (p.customerName || p.name || p.payee || 'Customer');
                
                const bankMatch = globalData.bankAccounts?.find((b: any) => b.id === p.bankAccountId);
                let methodStr = 'Cash';
                if (bankMatch) {
                    methodStr = bankMatch.bankName;
                } else if (p.bankAccountId === 'Adjustment') {
                    methodStr = 'Adjustment';
                } else if (p.bankAccountId === 'CashInHand' || p.bankAccountId === 'CashAtHome') {
                    methodStr = 'Cash';
                } else {
                    methodStr = p.paymentMethod || 'Cash';
                }
                
                const shortMethod = methodStr.split(' ')[0].toUpperCase();

                const isLedger = p.receiptType === 'Ledger' || p.paymentMethod === 'Ledger';
                const drCrLower = String(p.drCr || "").trim().toLowerCase();
                const isDebit = isLedger && drCrLower === 'debit';
                const amt = Math.abs(Number(p.amount) || 0);

                return {
                    date: p.date,
                    particulars: `${p.paymentId ? `[${p.paymentId}] ` : ''}${cName}${refNo ? ' | Parchi: ' + refNo : ''}`,
                    id: p.paymentId || 'REC', 
                    debit: isDebit ? amt : 0, 
                    credit: isDebit ? 0 : amt, 
                    type: `CR-${shortMethod || 'CASH'}`,
                    priority: 4,
                    accountId: p.bankAccountId || (methodStr === 'Cash' || p.paymentMethod === 'Cash' ? 'CashInHand' : null),
                    checkNo: p.checkNo,
                    paymentMethod: methodStr === 'Cash' ? 'Cash' : methodStr
                };
            }),
            ...globalData.incomes.filter((i: any) => periodScope(i.date) && !i.isInternal).map((i: any) => {
                const bankMatch = globalData.bankAccounts?.find((b: any) => b.id === i.bankAccountId);
                const methodStr = bankMatch ? bankMatch.bankName : (i.paymentMethod || 'Cash');
                const shortMethod = methodStr.split(' ')[0].toUpperCase();
                return {
                    date: i.date,
                    particulars: `${i.payee} | ${i.category}`,
                    id: i.transactionId || 'INC', debit: 0, credit: Number(i.amount) || 0, 
                    type: `INC-${shortMethod || 'CASH'}`,
                    priority: 5,
                    accountId: i.bankAccountId || (i.paymentMethod === 'Cash' ? 'CashInHand' : null)
                };
            }),
            ...(() => {
                const dayTagSumsDebit = new Map<string, number>();  // key: "date|type|particularsAccount" -> sum (for debits)
                const dayTagSumsCredit = new Map<string, number>(); // key: "date|type|particularsAccount" -> sum (for credits)
                const internalIncomes = globalData.incomes.filter((i: any) => periodScope(i.date) && i.isInternal);
                const internalExpenses = globalData.expenses.filter((e: any) => periodScope(e.date) && e.isInternal);
                
                // Track all internal entries (both incomes and expenses)
                const allInternal = [
                    ...internalIncomes.map((i: any) => ({ ...i, type: 'INCOME' })),
                    ...internalExpenses.map((e: any) => ({ ...e, type: 'EXPENSE' }))
                ];

                const result: any[] = [];

                allInternal.forEach((item: any) => {
                    const dStr = format(new Date(item.date), 'yyyy-MM-dd');
                    const amt = Number(item.amount) || 0;
                    
                    const tagType = (item.entryType === 'Buy')
                        ? 'Purchase'
                        : (item.entryType === 'Sale')
                            ? 'Sale'
                            : (item.entryType || item.category || item.subCategory || 'Internal');
                    
                    const particularsAccount = (item.entryType === 'Buy' || item.entryType === 'Sale')
                        ? (item.variety || item.entryType)
                        : tagType;

                    // Build descriptive particulars details for individual party entries (e.g., Sandeep Rice Mill | Husk | 123.6 Qty @ ₹525)
                    const displayId = item.transactionId || item.id || item.paymentId;
                    let partyDetails = `${displayId ? `[${displayId}] ` : ''}${item.payee || 'Party'}`;
                    const detailParts = [];
                    if (item.variety) detailParts.push(item.variety);
                    if (item.quantity) detailParts.push(`${item.quantity} Qty`);
                    if (item.rate) detailParts.push(`@ ₹${item.rate}`);
                    if (item.description) detailParts.push(item.description);
                    if (detailParts.length > 0) {
                        partyDetails = `${partyDetails} | ${detailParts.join(' | ')}`;
                    }

                    // Build descriptive particulars details for dynamic variety account entries (e.g., Husk Account | Sandeep Rice Mill | 123.6 Qty @ ₹525)
                    let varietyDetails = `${particularsAccount} Account`;
                    const varParts = [];
                    if (item.payee) varParts.push(item.payee);
                    if (item.quantity) varParts.push(`${item.quantity} Qty`);
                    if (item.rate) varParts.push(`@ ₹${item.rate}`);
                    if (item.description) varParts.push(item.description);
                    if (varParts.length > 0) {
                        varietyDetails = `${varietyDetails} | ${varParts.join(' | ')}`;
                    }

                    if (item.entryType === 'Sale') {
                        // Stock Sale: Debit Party, Credit Variety/Stock Account (Both individual / No consolidation)
                        // 1. Debit (outflow) side gets the individual Party name
                        result.push({
                            date: item.date,
                            particulars: partyDetails,
                            id: `INT-DR-PARTY-${item.id || item.transactionId || Math.random()}`,
                            debit: amt,
                            credit: 0,
                            type: tagType,
                            priority: 7
                        });

                        // 2. Credit (inflow) side gets the individual variety account
                        result.push({
                            date: item.date,
                            particulars: varietyDetails,
                            id: `INT-CR-VAR-${item.id || item.transactionId || Math.random()}`,
                            debit: 0,
                            credit: amt,
                            type: tagType,
                            priority: 7
                        });

                    } else if (item.entryType === 'Buy') {
                        // Stock Buy: Debit Variety/Stock Account, Credit Party (Both individual / No consolidation)
                        // 1. Debit (outflow) side gets the individual variety account
                        result.push({
                            date: item.date,
                            particulars: varietyDetails,
                            id: `INT-DR-VAR-${item.id || item.transactionId || Math.random()}`,
                            debit: amt,
                            credit: 0,
                            type: tagType,
                            priority: 7
                        });

                        // 2. Credit (inflow) side gets the individual Party name
                        result.push({
                            date: item.date,
                            particulars: partyDetails,
                            id: `INT-CR-PARTY-${item.id || item.transactionId || Math.random()}`,
                            debit: 0,
                            credit: amt,
                            type: tagType,
                            priority: 7
                        });

                    } else {
                        // Other Tagged Income/Expense (Salary, Brokerage, etc.): Debit Tag/Category (Consolidated), Credit Party (Individual)
                        // 1. Debit (outflow) side gets the consolidated variety/tag account
                        const debitKey = `${dStr}|${tagType}|${particularsAccount}`;
                        dayTagSumsDebit.set(debitKey, (dayTagSumsDebit.get(debitKey) || 0) + amt);

                        // 2. Credit (inflow) side gets the individual Party name
                        result.push({
                            date: item.date,
                            particulars: partyDetails,
                            id: `INT-CR-PARTY-${item.id || item.transactionId || Math.random()}`,
                            debit: 0,
                            credit: amt,
                            type: tagType,
                            priority: 7
                        });
                    }
                });

                // Add consolidated debit side rows (for non-stock entries like Brokerage, Salary, etc.)
                dayTagSumsDebit.forEach((sum, key) => {
                    const [dStr, tagType, particularsAccount] = key.split('|');
                    result.push({
                        date: dStr,
                        particulars: `${particularsAccount} Account`,
                        id: `INT-DR-${particularsAccount}-${dStr}`,
                        debit: sum,
                        credit: 0,
                        type: tagType,
                        priority: 7
                    });
                });

                // Add consolidated credit side rows (if any non-stock credits consolidate, though currently none do)
                dayTagSumsCredit.forEach((sum, key) => {
                    const [dStr, tagType, particularsAccount] = key.split('|');
                    result.push({
                        date: dStr,
                        particulars: `${particularsAccount} Account`,
                        id: `INT-CR-${particularsAccount}-${dStr}`,
                        debit: 0,
                        credit: sum,
                        type: tagType,
                        priority: 7
                    });
                });

                return result;
            })(),
            ...globalData.fundTransactions.filter((t: any) => periodScope(t.date)).flatMap((t: any) => {
                const amt = Number(t.amount) || 0;

                // Resolve a bank account ID to a human-readable label: "BankName (...XXXX)"
                const resolveAccLabel = (accId: string): string => {
                    if (!accId) return 'Unknown';
                    if (accId === 'CashInHand') return 'Cash in Hand';
                    if (accId === 'CashAtHome') return 'Cash at Home';
                    const bank = (globalData.bankAccounts || []).find((b: any) => b.id === accId);
                    if (bank) {
                        const name = bank.bankName || bank.name || 'Bank';
                        const acNo = bank.accountNumber ? `...${String(bank.accountNumber).slice(-4)}` : '';
                        return acNo ? `${name} (${acNo})` : name;
                    }
                    return accId; // fallback
                };

                const isCashAcc = (accId: string) => accId === 'CashInHand' || accId === 'CashAtHome';
                const srcIsCash  = isCashAcc(t.source);
                const destIsCash = isCashAcc(t.destination);

                const srcLabel  = resolveAccLabel(t.source);
                const destLabel = resolveAccLabel(t.destination);

                const debitEntry  = { date: t.date, particulars: `Transfer to ${destLabel}`,   id: 'AMT-OUT', debit: amt, credit: 0,   type: 'Internal Transfer', accountId: t.source,      transferSource: t.source, transferDest: t.destination };
                const creditEntry = { date: t.date, particulars: `Transfer from ${srcLabel}`,   id: 'AMT-IN',  debit: 0,   credit: amt, type: 'Internal Transfer', accountId: t.destination, transferSource: t.source, transferDest: t.destination };

                if (!srcIsCash && destIsCash) {
                    // Bank → Cash: only show on CREDIT side (cash receiving)
                    return [creditEntry];
                } else if (srcIsCash && !destIsCash) {
                    // Cash → Bank: only show on DEBIT side (cash sending)
                    return [debitEntry];
                } else {
                    // Bank → Bank  OR  Cash ↔ Cash: show BOTH sides
                    return [debitEntry, creditEntry];
                }
            }),
            ...globalData.expenses.filter((e: any) => periodScope(e.date) && !e.isInternal).map((e: any) => {
                const bankMatch = globalData.bankAccounts?.find((b: any) => b.id === e.bankAccountId);
                const methodStr = bankMatch ? bankMatch.bankName : (e.paymentMethod || 'Cash');
                const shortMethod = methodStr.split(' ')[0].toUpperCase();
                return {
                    date: e.date,
                    particulars: `${e.transactionId ? `[${e.transactionId}] ` : ''}${e.payee} | ${e.category}`,
                    id: e.transactionId || 'EXP', debit: Number(e.amount) || 0, credit: 0, 
                    type: `EXP-${shortMethod || 'CASH'}`,
                    priority: 6,
                    accountId: e.bankAccountId || (e.paymentMethod === 'Cash' ? 'CashInHand' : null)
                };
            }),
            ...(() => {
                const dayCdGroups = new Map<string, any[]>();
                globalData.supplierPayments.filter((p: any) => periodScope(p.date) && !isDeletedRecord(p) && (Number(p.cdAmount) || 0) > 0).forEach((p: any) => {
                    const d = format(new Date(p.date), 'yyyy-MM-dd');
                    if (!dayCdGroups.has(d)) dayCdGroups.set(d, []);
                    dayCdGroups.get(d)!.push(p);
                });

                const result: any[] = [];
                dayCdGroups.forEach((payments, dStr) => {
                    const dayTotal = payments.reduce((sum, p) => sum + (Number(p.cdAmount) || 0), 0);
                    // INFLOW Side: Consolidated
                    result.push({
                        date: dStr,
                        particulars: `CD Received Account`,
                        id: `CD-REC-IN-${dStr}`,
                        debit: 0,
                        credit: Math.round(dayTotal),
                        type: 'CD Received',
                        priority: 1
                    });

                    // OUTFLOW Side: Detailed per Supplier
                    payments.forEach(p => {
                        const supplier = globalData.suppliers.find((s: any) => 
                            String(s.id) === String(p.supplierId) || 
                            String(s.srNo) === String(p.supplierId) ||
                            (p.parchiNo && (String(s.srNo) === String(p.parchiNo) || String(s.parchiNo) === String(p.parchiNo)))
                        );
                        
                        const sName = supplier?.companyName || supplier?.name || p.supplierName || p.partyName || p.payee || 'Supplier';
                        const sFatherVal = supplier?.so || supplier?.fatherName || p.supplierFatherName || p.fatherName;
                        const sAddrVal = supplier?.address || supplier?.parchiAddress || p.supplierAddress || p.address;
                        const sFather = sFatherVal ? ` S/o ${sFatherVal}` : '';
                        const sAddr = sAddrVal ? ` | ${sAddrVal}` : '';
                        
                        result.push({
                            date: p.date,
                            particulars: `${sName}${sFather}${sAddr}`,
                            id: `CD-REC-OUT-${p.paymentId || Math.random()}`,
                            debit: Math.round(Number(p.cdAmount) || 0),
                            credit: 0,
                            type: 'CD Received',
                            priority: 1
                        });
                    });
                });
                return result;
            })(),
            ...globalData.customerPayments.filter((p: any) => periodScope(p.date) && !isDeletedRecord(p) && (Number(p.cdAmount) || 0) > 0).flatMap((p: any) => {
                const refNo = p.receiptNo || p.parchiNo || (p.paidFor?.[0]?.srNo);
                const refArray = typeof refNo === 'string' ? refNo.split(',').map(s => s.trim()).filter(Boolean) : (refNo ? [String(refNo)] : []);
                const linkedParchi = globalData.customers.find((c: any) => 
                    refArray.some(ref => String(c.srNo) === String(ref) || String(c.parchiNo) === String(ref)) || 
                    (p.customerId && c.id === p.customerId)
                );
                const cName = linkedParchi ? (linkedParchi.companyName || linkedParchi.name || 'Customer') : (p.customerName || p.name || 'Customer');
                const amt = Math.round(Number(p.cdAmount) || 0);
                return [
                    {
                        date: p.date,
                        particulars: `CD Given Account`,
                        id: `CD-GIV-DEB-${p.paymentId || Math.random()}`,
                        debit: amt,
                        credit: 0,
                        type: 'CD Given',
                        priority: 1,
                        accountId: 'CD'
                    },
                    {
                        date: p.date,
                        particulars: cName,
                        id: `CD-GIV-CRE-${p.paymentId || Math.random()}`,
                        debit: 0,
                        credit: amt,
                        type: 'CD Given',
                        priority: 1,
                        accountId: 'CD'
                    }
                ];
            }),
        ].sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            
            // 1. Compare by day first (ignore time)
            const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
            const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
            
            if (dayA !== dayB) return dayA - dayB;
            
            // 2. Same day: Internal Transfers always first
            if (a.id === 'AMT-IN' && b.id !== 'AMT-IN') return -1;
            if (b.id === 'AMT-IN' && a.id !== 'AMT-IN') return 1;
            
            // 3. Same day: Sort by TYPE PRIORITY (CD=1, PURCH=2, SP=3, CR=4, INC=5, EXP=6)
            const pA = a.priority ?? 99;
            const pB = b.priority ?? 99;
            if (pA !== pB) return pA - pB;
            
            // 4. Same priority: Sort by ID to keep sequential order (EX001, EX002...)
            const idDiff = a.id.localeCompare(b.id);
            if (idDiff !== 0) return idDiff;
            
            // 5. Final tie-breaker: Original time
            return dateA.getTime() - dateB.getTime();
        });

        const accountLedgers: Record<string, any[]> = {};
        const allAccountIds = ['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id), 'CD'];
        const openingSnapshot = getBalancesAtDate(subDays(filterDate, 1));
        
        allAccountIds.forEach(accId => {
            const accOpening = accId === 'CashInHand' ? openingSnapshot.cashInHand : accId === 'CashAtHome' ? openingSnapshot.cashAtHome : openingSnapshot.bankBalances.get(accId) || 0;
            const ledger: any[] = [{
                date: startDate.toISOString(),
                particulars: 'OPENING BALANCE',
                id: 'OP',
                debit: 0,
                credit: 0,
                balance: accOpening,
                type: 'System'
            }];
            
            let runningBal = accOpening;
            consolidatedLedger.filter(t => t.accountId === accId).forEach(t => {
                runningBal += (t.credit - t.debit);
                ledger.push({ ...t, balance: runningBal });
            });
            
            accountLedgers[accId] = ledger;
        });

        const totalInflow = dayWiseFlows.reduce((s,d) => s + d.incomes, 0);
        const totalOutflow = dayWiseFlows.reduce((s,d) => s + d.totalPayments + (d.ledger || 0) + d.expenses, 0);

        return {
            liquid: liquidSnapshot,
            dayWiseLiquidity,
            accountLedgers,
            purchases: Array.from(pMap.values()),
            sales: Array.from(sMap.values()),
            varietyStock: Array.from(stockMap.entries()).map(([variety, qty]) => ({ variety, qty })).sort((a,b) => b.qty - a.qty),
            distribution: {
                supplierCash: dayWiseFlows.reduce((s,d) => s + d.supplierCash, 0),
                supplierRtgs: dayWiseFlows.reduce((s,d) => s + d.supplierRtgs, 0),
                govDist: dayWiseFlows.reduce((s,d) => s + d.govDist, 0),
                ledger: dayWiseFlows.reduce((s,d) => s + (d.ledger || 0), 0),
                totalPayments: dayWiseFlows.reduce((s,d) => s + d.totalPayments, 0),
                expenses: dayWiseFlows.reduce((s,d) => s + d.expenses, 0),
                incomes: dayWiseFlows.reduce((s,d) => s + d.incomes, 0),
                seCash: dayWiseFlows.reduce((s,d) => s + d.seCash, 0),
                netTotalBalance: dayWiseFlows.reduce((s,d) => s + d.netTotal, 0)
            },
            dayWise: dayWiseFlows,
            varietyDayData,
            varietySaleDayData: (() => {
                const vsdd: Record<string, any[]> = {};
                globalData.customers.filter((c: any) => periodScope(c.date)).forEach((c: any) => {
                    const v = normalizeVariety(c.variety || '');
                    if (!vsdd[v]) vsdd[v] = [];
                    const dayStr = format(offsetDate(c.date), 'dd MMM yy');
                    let dEntry = vsdd[v].find(de => de.date === dayStr);
                    if (!dEntry) {
                        dEntry = { 
                            date: dayStr, 
                            finalWt: 0, 
                            netWt: 0, 
                            grossAmt: 0, 
                            netAmt: 0, 
                            count: 0, 
                            totalRate: 0,
                            avgRate: 0 
                        };
                        vsdd[v].push(dEntry);
                    }
                    dEntry.finalWt += Number(c.weight) || 0;
                    dEntry.netWt += Number(c.netWeight) || 0;
                    dEntry.grossAmt += Number(c.amount) || 0;
                    dEntry.netAmt += Number(c.originalNetAmount) || 0;
                    dEntry.totalRate += Number(c.rate) || 0;
                    dEntry.count += 1;
                });
                Object.values(vsdd).forEach(days => {
                    days.forEach(d => d.avgRate = d.count > 0 ? d.totalRate / d.count : 0);
                    days.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                });
                return vsdd;
            })(),
            consolidatedLedger,
            bankAccounts: globalData.bankAccounts || [],
            outflow: { 
                supplier: dayWiseFlows.reduce((s,d) => s + d.totalPayments, 0), 
                expenses: dayWiseFlows.reduce((s,d) => s + d.expenses, 0), 
                cdGiven: globalData.customerPayments.filter((p: any) => periodScope(p.date) && !isDeletedRecord(p)).reduce((s: number, p: any) => s + (Number(p.cdAmount) || 0), 0), 
                totalOutflow 
            },
            inflow: { 
                customer: dayWiseFlows.reduce((s,d) => s + d.incomes - (globalData.incomes.filter((i: any) => isDay(i.date, addDays(filterDate, dayWiseFlows.indexOf(d))) && !i.isInternal && !isDeletedRecord(i)).reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)), 0), 
                other: dayWiseFlows.reduce((s,d) => s + d.incomes, 0), 
                cdReceived: globalData.supplierPayments.filter((p: any) => periodScope(p.date) && !isDeletedRecord(p)).reduce((s: number, p: any) => s + (Number(p.cdAmount) || 0), 0), 
                totalInflow 
            },
            result: { netFlow: totalInflow - totalOutflow, stockDelta: 0 },
            urgentEMIs: (loans || [])?.filter(l => l.nextEmiDueDate && subDays(new Date(l.nextEmiDueDate), 2) <= new Date() && new Date(l.nextEmiDueDate) >= new Date()) || [],
            audit360: (() => {
                const dayGroups = new Map<string, Map<string, {
                    debits: { payee: string, amount: number, description?: string }[],
                    credits: { payee: string, amount: number, description?: string }[]
                }>>();

                const filteredIncomes = globalData.incomes.filter((i: any) => periodScope(i.date) && !i.isInternal);
                const filteredExpenses = globalData.expenses.filter((e: any) => periodScope(e.date) && !e.isInternal);
                const filteredSales = globalData.customers.filter((c: any) => periodScope(c.date));

                [...filteredIncomes, ...filteredExpenses, ...filteredSales.map((s: any) => ({
                    ...s,
                    payee: s.companyName || s.name || 'Customer',
                    category: 'SALES',
                    amount: s.amount,
                    isIncome: true
                }))].forEach((t: any) => {
                    const dStr = format(startOfDay(new Date(t.date)), 'yyyy-MM-dd');
                    if (!dayGroups.has(dStr)) dayGroups.set(dStr, new Map());
                    const subGroup = dayGroups.get(dStr)!;

                    const subCat = (t.category || 'Other').toUpperCase().trim();
                    if (!subGroup.has(subCat)) {
                        subGroup.set(subCat, { debits: [], credits: [] });
                    }
                    const g = subGroup.get(subCat)!;
                    
                    const isIncome = t.isIncome || ('transactionType' in t ? t.transactionType === 'Income' : (filteredIncomes.includes(t as any)));
                    
                    if (isIncome) {
                        g.credits.push({ payee: t.payee, amount: Number(t.amount) || 0, description: t.variety });
                    } else {
                        g.debits.push({ payee: t.payee, amount: Number(t.amount) || 0, description: t.description });
                    }
                });

                const rows: { date: string, particular: string, detail: string, debit: number, credit: number }[] = [];

                dayGroups.forEach((subGroup, dStr) => {
                    subGroup.forEach((data, subCat) => {
                        if (data.credits.length > 0) {
                            const uniquePayees = Array.from(new Set(data.credits.map(c => c.payee)));
                            const totalCredit = data.credits.reduce((s, c) => s + c.amount, 0);
                            const mergedDetail = data.credits.map(c => c.description).filter(Boolean).join(', ') || '-';
                            if (uniquePayees.length > 1) {
                                rows.push({ date: dStr, particular: subCat.toUpperCase(), detail: mergedDetail, debit: 0, credit: totalCredit });
                            } else {
                                const pName = uniquePayees[0] || subCat;
                                rows.push({ date: dStr, particular: `${pName} (${subCat})`, detail: mergedDetail, debit: 0, credit: totalCredit });
                            }
                        }
                        if (data.debits.length > 0) {
                            const uniquePayees = Array.from(new Set(data.debits.map(d => d.payee)));
                            const totalDebit = data.debits.reduce((s, d) => s + d.amount, 0);
                            const mergedDetail = data.debits.map(d => d.description).filter(Boolean).join(', ') || '-';
                            if (uniquePayees.length > 1) {
                                rows.push({ date: dStr, particular: subCat.toUpperCase(), detail: mergedDetail, debit: totalDebit, credit: 0 });
                            } else {
                                const pName = uniquePayees[0] || subCat;
                                rows.push({ date: dStr, particular: `${pName} (${subCat})`, detail: mergedDetail, debit: totalDebit, credit: 0 });
                            }
                        }
                    });
                });

                return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            })(),
            audit360Zones: (() => {
                const zones: Record<string, { label: string, rows: any[], total: number, stats: any }> = {
                    PURCHASE: { label: 'Purchase Zone', rows: [], total: 0, stats: { qty: 0, parchi: 0 } },
                    SALE: { label: 'Sale Zone', rows: [], total: 0, stats: { qty: 0, parchi: 0 } },
                    ADJ_INCOME: { label: 'Adjustment Income', rows: [], total: 0, stats: { margin: 0 } },
                    ADJ_EXPENSE: { label: 'Adjustment Expense', rows: [], total: 0, stats: { margin: 0 } },
                    EXPENSE: { label: 'Expense Zone', rows: [], total: 0, stats: { topCat: '' } },
                    INCOME: { label: 'Income Zone', rows: [], total: 0, stats: { topCat: '' } },
                    INTERNAL: { label: 'Internal Cashflow', rows: [], total: 0, stats: { count: 0 } },
                    LOAN: { label: 'Loan & Liabilities', rows: [], total: 0, stats: { count: 0 } }
                };

                const filterDate = startOfDay(startDate);
                const filterEndDate = startOfDay(endDate);

                let totalPurLab = 0, totalPurKan = 0;
                let totalSaleLab = 0, totalSaleKan = 0, totalBag = 0;

                let totalPurKrt = 0, totalPurBrk = 0;

                globalData.suppliers.filter((s: any) => periodScope(s.date)).forEach((s: any) => {
                    const amt = Number(s.netAmount) || 0;
                    const wt = Number(s.netWeight) || 0;
                    // Fallback: compute from rate if stored amount is missing/zero
                    const storedLab = Number(s.labouryAmount) || 0;
                    const computedLab = storedLab > 0 ? storedLab : (Number(s.labouryRate) || 0) * wt;
                    const lab = computedLab;
                    const kan = Number(s.kanta) || 0;
                    const krt = Number(s.kartaAmount) || Number(s.kartaAmt) || 0;
                    const brk = Number(s.brokerageAmount) || 0;

                    if (process.env.NODE_ENV !== 'production') {
                        console.debug('[AuditLedger] Supplier lab:', s.name, '| labouryAmount:', s.labouryAmount, '| labouryRate:', s.labouryRate, '| wt:', wt, '| computed lab:', lab);
                    }

                    zones.PURCHASE.rows.push({
                        date: s.date,
                        srNo: s.srNo,
                        name: s.name,
                        fatherName: s.fatherName || s.so || '',
                        address: s.address || [s.village, s.tehsil, s.district].filter(Boolean).join(', '),
                        item: s.name,
                        details: `${wt.toFixed(2)} QTL | ${s.variety}`,
                        rate: s.rate,
                        amount: amt,
                        laboury: lab, kanta: kan, kartaAmt: krt, brokerage: brk,
                        tag: s.id ? String(s.id).slice(-4) : '—'
                    });
                    zones.PURCHASE.total += amt;
                    zones.PURCHASE.stats.qty += wt;
                    zones.PURCHASE.stats.parchi++;

                    totalPurLab += lab;
                    totalPurKan += kan;
                    totalPurKrt += krt;
                    totalPurBrk += brk;
                });

                globalData.customers.filter((c: any) => {
                    const d = startOfDay(new Date(c.date));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach((c: any) => {
                    const amt = Number(c.amount) || 0;
                    const wt = Number(c.netWeight) || 0;
                    zones.SALE.rows.push({
                        date: c.date,
                        item: c.companyName || c.name,
                        details: `${wt.toFixed(2)} QTL Sold | ${c.variety}`,
                        amount: amt,
                        tag: 'SALE'
                    });
                    zones.SALE.total += amt;
                    zones.SALE.stats.qty += wt;
                    zones.SALE.stats.parchi++;

                    totalSaleLab += (Number(c.labouryAmount) || 0);
                    totalSaleKan += (Number(c.kanta) || 0);
                    totalBag += (Number((c as any).bagAmount) || 0);
                });

                const todayStr = (startDate || new Date()).toISOString();
                
                const grandTotalLab = totalPurLab + totalSaleLab;
                const grandTotalKan = totalPurKan + totalSaleKan;

                if (grandTotalLab > 0) {
                    zones.ADJ_EXPENSE.rows.push({ date: todayStr, item: 'TOTAL LABOURY', details: 'Operational Cost', amount: grandTotalLab, type: 'OUT', tag: 'LAB' });
                    zones.ADJ_EXPENSE.total += grandTotalLab;
                }
                if (grandTotalKan > 0) {
                    zones.ADJ_INCOME.rows.push({ date: todayStr, item: 'TOTAL KANTA', details: 'Margin Income', amount: grandTotalKan, type: 'IN', tag: 'KAN' });
                    zones.ADJ_INCOME.total += grandTotalKan;
                }
                if (totalBag > 0) {
                    zones.ADJ_INCOME.rows.push({ date: todayStr, item: 'BAG CHARGES', details: 'Margin Income', amount: totalBag, type: 'IN', tag: 'BAG' });
                    zones.ADJ_INCOME.total += totalBag;
                }
                if (totalPurKrt > 0) {
                    zones.ADJ_INCOME.rows.push({ date: todayStr, item: 'KARTA DEDUCTION', details: 'Margin Income', amount: totalPurKrt, type: 'IN', tag: 'KRT' });
                    zones.ADJ_INCOME.total += totalPurKrt;
                }
                if (totalPurBrk > 0) {
                    zones.ADJ_INCOME.rows.push({ date: todayStr, item: 'BROKERAGE MARGIN', details: 'Margin Income', amount: totalPurBrk, type: 'IN', tag: 'BRK' });
                    zones.ADJ_INCOME.total += totalPurBrk;
                }

                globalData.expenses.filter((e: any) => {
                    const d = startOfDay(new Date(e.date));
                    return d >= filterDate && d <= filterEndDate && !e.isInternal && !isDeletedRecord(e);
                                }).forEach((e: any) => {
                    const amt = Number(e.amount) || 0;
                    zones.EXPENSE.rows.push({ date: e.date, item: e.payee, details: e.subCategory || e.category, transactionId: e.transactionId || e.id || '—', amount: amt, paymentMethod: e.paymentMethod || 'Cash', tag: 'EXP', type: 'debit' });
                    zones.EXPENSE.total += amt;
                });

                // ── Add ALL supplier payments to Expense zones (RTGS, Gov, Online, Cash) ──
                globalData.supplierPayments.filter((p: any) => {
                    const d = startOfDay(new Date(p.date));
                    return d >= filterDate && d <= filterEndDate && !isDeletedRecord(p);
                }).forEach((p: any) => {
                    const amt = Number(p.amount) || 0;
                    const supplierName = p.supplierName || p.parchiName || p.customerId || 'Supplier';
                    
                    // Map supplier receiptType to breakdown ledger paymentMethod
                    // Breakdown uses: Cash, RTGS, Cheque (Gov), Online
                    let method = p.receiptType || 'Cash';
                    if (method === 'Transfer') method = 'Online'; // Standardize naming
                    
                    const linkedSupplier = globalData.suppliers.find((s: any) => s.id === p.supplierId || s.id === p.customerId);
                    const officialName = linkedSupplier?.name || '';
                    const supplierSrNo = linkedSupplier?.srNo || '';

                    zones.EXPENSE.rows.push({
                        date: p.date,
                        item: officialName && officialName !== supplierName ? `${officialName} / ${supplierName}` : (officialName || supplierName),
                        details: '',
                        transactionId: p.paymentId || p.id || '—',
                        amount: amt,
                        paymentMethod: method,
                        tag: 'SUP_PAY',
                        type: 'debit',
                        receiptNo: supplierSrNo || p.parchiNo || '—',
                        checkNo: p.checkNo || '—',
                        receiptName: p.bankAcName || '—'
                    });
                    zones.EXPENSE.total += amt;
                });

                // ── Add ALL customer payments to Expense zones (RTGS, Gov, Online, Cash) ──
                (globalData.customerPayments || []).filter((p: any) => {
                    const d = startOfDay(new Date(p.date));
                    return d >= filterDate && d <= filterEndDate && !isDeletedRecord(p);
                }).forEach((p: any) => {
                    const amt = Number(p.amount) || 0;
                    
                    const refNo = p.receiptNo || p.parchiNo || (p.paidFor?.[0]?.srNo);
                    const refArray = typeof refNo === 'string' 
                        ? refNo.split(',').map((s: string) => s.trim()).filter(Boolean) 
                        : (refNo ? [String(refNo)] : []);

                    const linkedParchi = globalData.customers?.find((c: any) => 
                        refArray.some((ref: string) => String(c.srNo) === String(ref) || String(c.parchiNo) === String(ref)) || 
                        (p.customerId && c.id === p.customerId)
                    );
                    
                    const customerName = linkedParchi 
                        ? (linkedParchi.companyName || linkedParchi.name || 'Customer') 
                        : (p.customerName || p.name || p.payee || 'Customer');
                    
                    let method = p.paymentMethod || p.receiptType || 'Cash';
                    const bankAccId = p.bankAccountId;
                    if (bankAccId === 'CashInHand' || bankAccId === 'CashAtHome' || method === 'Cash') {
                        method = 'Cash';
                    } else if (bankAccId || method === 'Bank' || method === 'Online' || method === 'Transfer' || method === 'RTGS') {
                        method = 'Online';
                    }
                    
                    const customerSrNo = linkedParchi?.srNo || '';

                    const isLedger = p.receiptType === 'Ledger' || p.paymentMethod === 'Ledger';
                    const isExplicitDebit = isLedger && String(p.drCr || '').toLowerCase() === 'debit';
                    const isCredit = !isExplicitDebit;

                    zones.EXPENSE.rows.push({
                        date: p.date,
                        item: customerName,
                        details: '',
                        transactionId: p.paymentId || p.id || '—',
                        amount: Math.abs(amt),
                        paymentMethod: method,
                        tag: 'CUS_PAY',
                        type: isCredit ? 'credit' : 'debit',
                        receiptNo: customerSrNo || p.parchiNo || '—',
                        checkNo: p.checkNo || '—',
                        receiptName: p.bankAcName || '—'
                    });
                    zones.EXPENSE.total += Math.abs(amt);
                });

                // ── Add manual ledger entries with debits (outflows) to Expense zones ──
                (globalData.ledgerEntries || []).filter((e: any) => {
                    const d = startOfDay(new Date(e.date));
                    return d >= filterDate && d <= filterEndDate && !isDeletedRecord(e) && (Number(e.debit) || 0) > 0;
                }).forEach((e: any) => {
                    const amt = Number(e.debit) || 0;
                    const account = (globalData.ledgerAccounts || []).find((a: any) => a.id === e.accountId);
                    const accountName = account?.name || 'Ledger Account';

                    zones.EXPENSE.rows.push({
                        date: e.date,
                        item: accountName,
                        details: e.particulars || 'Ledger Debit',
                        transactionId: e.id || '—',
                        amount: amt,
                        paymentMethod: 'Other',
                        tag: 'LEDGER_PAY'
                    });
                    zones.EXPENSE.total += amt;
                });

                globalData.incomes.filter((i: any) => {
                    const d = startOfDay(new Date(i.date));
                    return d >= filterDate && d <= filterEndDate && !i.isInternal && !isDeletedRecord(i);
                }).forEach((i: any) => {
                    const amt = Number(i.amount) || 0;
                    zones.INCOME.rows.push({ date: i.date, item: i.payee, details: i.category, amount: amt, tag: 'INC' });
                    zones.INCOME.total += amt;
                });

                // ── Add manual ledger entries with credits (inflows) to Income zones ──
                (globalData.ledgerEntries || []).filter((e: any) => {
                    const d = startOfDay(new Date(e.date));
                    return d >= filterDate && d <= filterEndDate && !isDeletedRecord(e) && (Number(e.credit) || 0) > 0;
                }).forEach((e: any) => {
                    const amt = Number(e.credit) || 0;
                    const account = (globalData.ledgerAccounts || []).find((a: any) => a.id === e.accountId);
                    const accountName = account?.name || 'Ledger Account';

                    zones.INCOME.rows.push({
                        date: e.date,
                        item: accountName,
                        details: e.particulars || 'Ledger Credit',
                        amount: amt,
                        tag: 'LEDGER_INC'
                    });
                    zones.INCOME.total += amt;
                });

                globalData.fundTransactions.filter((t: any) => {
                    const d = startOfDay(new Date(t.date));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach((t: any) => {
                    const amt = Number(t.amount) || 0;
                    const resolveLabel = (accId: string): string => {
                        if (!accId) return 'Unknown';
                        if (accId === 'CashInHand') return 'Cash in Hand';
                        if (accId === 'CashAtHome') return 'Cash at Home';
                        const bank = (globalData.bankAccounts || []).find((b: any) => b.id === accId);
                        if (bank) {
                            const name = bank.bankName || bank.name || 'Bank';
                            const acNo = bank.accountNumber ? `...${String(bank.accountNumber).slice(-4)}` : '';
                            return acNo ? `${name} (${acNo})` : name;
                        }
                        return accId;
                    };
                    const srcLbl  = resolveLabel(t.source);
                    const destLbl = resolveLabel(t.destination);
                    zones.INTERNAL.rows.push({ date: t.date, item: `${srcLbl} ➔ ${destLbl}`, details: t.description || 'Internal Transfer', amount: amt, tag: 'CASHFLOW' });
                    zones.INTERNAL.total += amt;
                    zones.INTERNAL.stats.count++;
                });

                // ── Add LOANS to the audit ──
                (loans || []).filter((l: any) => {
                    if (!l.startDate) return false;
                    const d = startOfDay(new Date(l.startDate));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach((l: any) => {
                    const amt = Number(l.totalAmount) || 0;
                    zones.LOAN.rows.push({
                        date: l.startDate,
                        item: l.loanName || l.lenderName || 'Lender',
                        details: `${l.loanType} | Rate: ${l.interestRate}%`,
                        amount: amt,
                        tag: 'LOAN'
                    });
                    zones.LOAN.total += amt;
                    zones.LOAN.stats.count++;
                });

                return Object.entries(zones).map(([key, zone]) => {
                    const maxAmt = Math.max(...zone.rows.map(r => r.amount), 1);
                    return {
                        key, ...zone,
                        rows: zone.rows.map(r => ({ ...r, intensity: (r.amount / maxAmt) * 100 }))
                                 .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    };
                });
            })()
        };
    }, [startDate, endDate, globalData, loans, isActive]);
}
