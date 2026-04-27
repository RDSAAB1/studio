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

export function useReportCalculations(startDate: Date, endDate: Date, globalData: any, loans: any[]) {
    return useMemo(() => {
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
                const amt = Number(p.amount) || 0;
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

            const accounts = ['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id)];
            const metrics: Record<string, any> = {};

            accounts.forEach(id => {
                const op = id === 'CashInHand' ? opening.cashInHand : id === 'CashAtHome' ? opening.cashAtHome : opening.bankBalances.get(id) || 0;
                const cl = id === 'CashInHand' ? closing.cashInHand : id === 'CashAtHome' ? closing.cashAtHome : closing.bankBalances.get(id) || 0;

                const dayIncs = globalData.incomes.filter((inc: any) => isDay(inc.date, day) && !inc.isInternal && (inc.bankAccountId === id || (id === 'CashInHand' && inc.paymentMethod === 'Cash' && !inc.bankAccountId))).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                const dayExps = globalData.expenses.filter((exp: any) => isDay(exp.date, day) && !exp.isInternal && (exp.bankAccountId === id || (id === 'CashInHand' && exp.paymentMethod === 'Cash' && !exp.bankAccountId))).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                const daySPmts = globalData.supplierPayments.filter((p: any) => isDay(p.date, day) && ((p.bankAccountId === id) || (id === 'CashInHand' && p.receiptType === 'Cash' && !p.bankAccountId) || (!p.bankAccountId && (p.receiptType === 'RTGS' || p.receiptType === 'Online') && globalData.bankAccounts.find((acc: any) => acc.id === id)?.accountNumber === (p as any).bankAcNo))).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                const dayCPmts = globalData.customerPayments.filter((p: any) => isDay(p.date, day) && (p.bankAccountId === id || (id === 'CashInHand' && p.paymentMethod === 'Cash' && !p.bankAccountId))).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
                
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
            const sPmts = globalData.supplierPayments.filter((p: any) => isDay(p.date));
            const sCash = sPmts.filter((p: any) => p.receiptType === 'Cash').reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            const sRtgs = sPmts.filter((p: any) => p.receiptType === 'RTGS').reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            const gDist = sPmts.filter((p: any) => p.receiptType === 'Gov Dist').reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            const cPmts = globalData.customerPayments.filter((p: any) => isDay(p.date) && !p.isDeleted).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            const exps = globalData.expenses.filter((e: any) => isDay(e.date) && !e.isInternal && !e.isDeleted).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
            const incs = globalData.incomes.filter((i: any) => isDay(i.date) && !i.isInternal && !i.isDeleted).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
            const totalIncomes = incs + cPmts;
            const totalPayments = sCash + sRtgs + gDist;
            const seCash = sCash + exps;
            const netTotal = (totalPayments + exps) - totalIncomes;
            return { date: format(day, 'dd MMM'), supplierCash: Math.round(sCash), supplierRtgs: Math.round(sRtgs), govDist: Math.round(gDist), totalPayments: Math.round(totalPayments), expenses: Math.round(exps), incomes: Math.round(totalIncomes), seCash: Math.round(seCash), netTotal: Math.round(netTotal) };
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

        const stockMap = new Map<string, number>();
        consolidatedSupps.forEach((s: any) => {
            const v = normalizeVariety(s.variety || '');
            stockMap.set(v, (stockMap.get(v) || 0) + (Number(s.weight) || 0));
        });
        consolidatedCusts.forEach((c: any) => {
            const v = normalizeVariety(c.variety || '');
            stockMap.set(v, (stockMap.get(v) || 0) - (Number(c.netWeight) || 0));
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
                        const dTotalWt = daySupps.reduce((sum: number, p: any) => sum + (Number(p.netWeight) || 0), 0);
                        const dTotalBags = daySupps.reduce((sum: number, p: any) => sum + (Number((p as any).bags) || 1), 0);
                        const dLab = daySupps.reduce((sum: number, p: any) => sum + (Number(p.labouryAmount) || 0), 0);
                        const dKan = daySupps.reduce((sum: number, p: any) => sum + (Number(p.kanta) || 0), 0);
                        const dNetGross = daySupps.reduce((sum: number, p: any) => sum + ((Number(p.netWeight) || 0) * (Number(p.rate) || 0)), 0);
                        const dPayableTotal = daySupps.reduce((sum: number, p: any) => sum + (Number(p.netAmount) || 0), 0);
                        const dAvgRate = dTotalWt > 0 ? (dNetGross / dTotalWt) : 0;
                        
                        // Net Purchase for the ledger = Gross - Labour - Kanta
                        const dNetPurchase = dNetGross - dLab - dKan;
                        // Other Adjustments (CD, Karta, etc) = dNetPurchase - Actual Payable
                        const dOtherAdj = dNetPurchase - dPayableTotal;

                        daySupps.forEach((s: any) => {
                            const qty    = Number(s.netWeight) || 0;
                            const bags   = Number((s as any).bags) || 1;
                            const rate   = Number(s.rate) || 0;
                            const gross  = qty * rate;
                            const vNameRaw = (s.variety || 'Generic').toUpperCase().trim();
                            const supplierInfo = `${s.name} S/O ${s.fatherName || s.so || ''}${s.address ? ', ' + s.address : ''}`;
                            
                            resultArr.push({
                                date: dStr,
                                particulars: `[${s.srNo}] ${supplierInfo}::${vNameRaw} | ${qty.toFixed(2)} QTL @ ₹${rate} | Lab: ₹${s.labouryAmount || 0} | Kan: ₹${s.kanta || 0}`,
                                id: s.id.slice(-6).toUpperCase(),
                                debit: Math.round(gross),
                                credit: 0,
                                type: 'Purchase'
                            });
                        });

                        if (dNetPurchase > 0) resultArr.push({
                            date: dStr,
                            particulars: `${dTotalBags} Receipts | ${dTotalWt.toFixed(2)} QTL @ ₹${dAvgRate.toFixed(2)}`,
                            id: 'PURCH', debit: 0, credit: Math.round(dNetPurchase), type: 'Purchase',
                            count: dTotalBags
                        });

                        if (dLab > 0) {
                            const labList = daySupps.filter((s: any) => (Number(s.labouryAmount) || 0) > 0);
                            let labCountTotal = 0;
                            const labGroups = labList.reduce((acc: any, s: any) => {
                                const amt = Number(s.labouryAmount);
                                const wt = Number(s.netWeight) || 0;
                                const rate = Number(s.labouryRate) || (wt > 0 ? (amt / wt) : 0);
                                const rKey = rate.toFixed(2); 
                                if (!acc[rKey]) acc[rKey] = { weight: 0, rate: rate, bags: 0 };
                                acc[rKey].weight += wt;
                                acc[rKey].bags += (Number((s as any).bags) || 1);
                                labCountTotal += (Number((s as any).bags) || 1);
                                return acc;
                            }, {});
                            const labParts = Object.values(labGroups).map((g: any) => `${g.weight.toFixed(2)} QTL @ ₹${g.rate.toFixed(2)}`);
                            resultArr.push({
                                date: dStr,
                                particulars: labParts.join(' | '),
                                id: 'LABR', debit: 0, credit: Math.round(dLab), type: 'Labour',
                                count: labCountTotal
                            });
                        }

                        if (dKan > 0) {
                            const kanList = daySupps.filter((s: any) => (Number(s.kanta) || 0) > 0);
                            let kanCountTotal = 0;
                            const kanGroups = kanList.reduce((acc: any, s: any) => {
                                const amt = Number(s.kanta);
                                const bags = Number((s as any).bags) || 1;
                                const rate = amt / bags;
                                const rKey = rate.toFixed(0);
                                if (!acc[rKey]) acc[rKey] = { count: 0, rate: rate };
                                acc[rKey].count += bags;
                                kanCountTotal += bags;
                                return acc;
                            }, {});
                            const kanParts = Object.values(kanGroups).map((g: any) => `PARCHI-${g.count}@${g.rate.toFixed(0)}`);
                            resultArr.push({
                                date: dStr,
                                particulars: kanParts.join(' | '),
                                id: 'KANTA', debit: 0, credit: Math.round(dKan), type: 'Kanta',
                                count: kanCountTotal
                            });
                        }

                        if (Math.abs(dOtherAdj) > 1) resultArr.push({
                            date: dStr,
                            particulars: `P ADJUSTMENT (Deductions: CD, Karta, Rounding)`,
                            id: 'PADJ', 
                            debit: dOtherAdj < 0 ? Math.round(Math.abs(dOtherAdj)) : 0,
                            credit: dOtherAdj > 0 ? Math.round(dOtherAdj) : 0, 
                            type: 'Adjustment'
                        });
                    }

                    const daySales = globalData.customers.filter((c: any) => isDay(c.date, dDate));
                    const dSalesNet = daySales.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
                    const dSalesParchiCount = daySales.length;
                    
                    const vLab   = daySales.reduce((s: number, p: any) => s + (Number(p.labouryAmount) || 0), 0);
                    const vKanta = daySales.reduce((s: number, p: any) => s + (Number(p.kanta) || 0), 0);
                    const vBagAm = daySales.reduce((s: number, p: any) => s + (Number((p as any).bagAmount || 0)), 0);
                    const vTrans = daySales.reduce((s: number, p: any) => s + (Number((p as any).transportAmount || 0)), 0);
                    const vOther = daySales.reduce((s: number, p: any) => s + (Number((p as any).otherCharges || 0)), 0);
                    const vBagWt = daySales.reduce((s: number, p: any) => s + (Number((p as any).bagWeightDeductionAmount || 0)), 0);

                    const dSalesNetBase = dSalesNet - (vLab + vKanta + vBagAm + vTrans + vOther + vBagWt);

                    const tBags = daySales.reduce((s: number, p: any) => s + (Number((p as any).bags) || 0), 0);
                    const tBagKgTotal = daySales.reduce((s: number, p: any) => s + ((Number((p as any).bags) || 0) * (Number((p as any).bagWeightKg) || 0)), 0);
                    const avgBagWt = tBags > 0 ? (tBagKgTotal / tBags).toFixed(2) : '0';
                    const tBagWtQtl = (tBagKgTotal / 100).toFixed(2);

                    const dSalesWtTotal = daySales.reduce((sum: number, s: any) => sum + (Number(s.netWeight) || 0), 0);
                    const dSalesAvgRate = dSalesWtTotal > 0 ? (dSalesNetBase / dSalesWtTotal) : 0;

                    if (dSalesNetBase > 0) resultArr.push({
                        date: dStr,
                        particulars: `ADJUSTMENT (S Net Sales Base | ${dSalesParchiCount} parchi | ${dSalesWtTotal.toFixed(2)} QTL @ ₹${dSalesAvgRate.toFixed(2)} | Total Bags: ${tBags})`,
                        id: 'SADJ', debit: Math.round(dSalesNetBase), credit: 0, type: 'Adjustment',
                        count: dSalesParchiCount
                    });

                    daySales.forEach((c: any) => {
                        const namePart = [c.name, c.companyName, c.address].filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()).join(', ');
                        const vName = (c.variety || 'Generic').toUpperCase().trim();
                        const qty = Number(c.netWeight) || 0;
                        const rate = Number(c.rate) || 0;

                        resultArr.push({
                            date: c.date,
                            particulars: `${namePart.split(',')[0]}::${vName} | ${qty.toFixed(2)} QTL @ ₹${rate}`,
                            id: c.id.slice(-6).toUpperCase(), debit: 0, credit: Number(c.amount) || 0, type: 'Sale'
                        });
                    });

                    const transMap = new Map<number, number>();
                    daySales.forEach((s: any) => {
                        const tr = Number((s as any).transportationRate) || 0;
                        const wt = Number(s.weight) || 0;
                        if (tr > 0 && wt > 0) transMap.set(tr, (transMap.get(tr) || 0) + wt);
                    });
                    const transDetail = Array.from(transMap.entries()).map(([r, w]) => `${w.toFixed(2)} QTL @ ₹${r}`).join(' + ');

                    if (Math.round(vLab) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Labour for ${tBags} Bags)`, id: 'SLE-LAB', debit: Math.round(vLab), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vKanta) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Kanta Charges)`, id: 'SLE-KN', debit: Math.round(vKanta), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vBagWt) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Bag Weight Adj | ${tBags} Bags @ ~${avgBagWt}kg | Total ${tBagWtQtl} QTL reduced)`, id: 'SLE-BW', debit: Math.round(vBagWt), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vBagAm) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Bag Charges | ${tBags} Bags)`, id: 'SLE-BG', debit: Math.round(vBagAm), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vTrans) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Transport/Freight | ${transDetail})`, id: 'SLE-TR', debit: Math.round(vTrans), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vOther) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Misc Income)`, id: 'SLE-OT', debit: Math.round(vOther), credit: 0, type: 'Adjustment'
                    });

                    const totalDebitTracked = dSalesNetBase + vLab + vKanta + vBagAm + vTrans + vOther + vBagWt;
                    const diff = dSalesNet - totalDebitTracked;
                    if (Math.round(diff) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Rounding Surplus)`, id: 'SLE-RS', debit: Math.round(diff), credit: 0, type: 'Adjustment'
                    });
                    else if (Math.round(diff) < -1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Rounding Loss)`, id: 'SLE-RL', debit: 0, credit: Math.round(Math.abs(diff)), type: 'Adjustment'
                    });
                });
                return resultArr;
            })(),
            ...globalData.supplierPayments.filter((p: any) => periodScope(p.date)).map((p: any) => {
                const method = p.receiptType || p.paymentMethod || 'Cash';
                const ref = p.utrNo || p.checkNo ? ` | Ref: ${p.utrNo || p.checkNo}` : '';
                const LinkedParchi = (p.paidFor as any[] || []).map((pf: any) => pf.srNo).filter(Boolean).join(', ') || p.parchiNo || '';
                const linked = LinkedParchi ? `[${LinkedParchi}] ` : '';
                       // Lookup supplier details (Father Name & Address) using Parchi Number primarily
                const pNameNorm = (p.supplierName || '').trim().toUpperCase();
                const parchiList = (p.paidFor as any[] || []).map((pf: any) => pf.srNo).filter(Boolean);
                const firstParchi = parchiList[0] || p.parchiNo;

                const sMatch = (globalData.suppliers || []).find((s: any) => 
                    (firstParchi && String(s.srNo) === String(firstParchi)) ||
                    (s.id && p.supplierId && s.id === p.supplierId) || 
                    ((s.name || '').trim().toUpperCase() === pNameNorm)
                ) || (globalData.vendors || []).find((v: any) => 
                    (v.id && p.supplierId && v.id === p.supplierId) || 
                    ((v.name || '').trim().toUpperCase() === pNameNorm)
                );
                
                const sDetails = sMatch ? ` S/O ${sMatch.fatherName || sMatch.so || ''}${sMatch.address ? ', ' + sMatch.address : ''}` : '';
                
                return {
                    date: p.date,
                    particulars: `${linked}${sMatch?.name || p.supplierName || 'Supplier'}${sDetails}${ref}`,
                    id: p.paymentId || 'PAY', debit: Number(p.amount) || 0, credit: 0, type: `Supplier Payment::${resolveMethod(method)}`
                };
            }),
            ...globalData.customerPayments.filter((p: any) => periodScope(p.date)).map((p: any) => {
                const method = p.receiptType || p.paymentMethod || 'Cash';
                const ref = (p as any).utrNo || (p as any).checkNo ? ` | Ref: ${(p as any).utrNo || (p as any).checkNo}` : '';
                const customer = globalData.customers.find((c: any) => c.id === p.customerId);
                const cName = customer ? (customer.companyName || customer.name || 'Customer') : 'Customer';
                return {
                    date: p.date,
                    particulars: `${cName}${ref}`,
                    id: p.paymentId || 'REC', debit: 0, credit: Number(p.amount) || 0, type: `Customer Receipt::${resolveMethod(method)}`
                };
            }),
            ...globalData.incomes.filter((i: any) => periodScope(i.date) && !i.isInternal).map((i: any) => ({
                date: i.date,
                particulars: `[${i.transactionId || 'N/A'}] ${i.payee.trim()}::${(i.category || '').trim()}${i.subCategory ? ' | ' + i.subCategory.trim() : ''}`,
                id: i.transactionId || 'INC', debit: 0, credit: Number(i.amount) || 0, type: `Income::${resolveMethod(i.paymentMethod || i.bankAccountId)}`
            })),
            ...globalData.expenses.filter((e: any) => periodScope(e.date) && !e.isInternal).map((e: any) => ({
                date: e.date,
                particulars: `[${e.transactionId || 'N/A'}] ${e.payee.trim()}::${(e.category || '').trim()}${e.subCategory ? ' | ' + e.subCategory.trim() : ''}`,
                id: e.transactionId || 'EXP', debit: Number(e.amount) || 0, credit: 0, type: `Expense::${resolveMethod(e.paymentMethod || e.bankAccountId)}`
            })),
            ...((globalData as any).loans || []).filter((l: any) => l.startDate && periodScope(l.startDate) && l.loanType !== 'OwnerCapital').map((l: any) => ({
                date: l.startDate,
                particulars: `${l.loanName || l.lenderName || 'Lender'} (${l.loanType})`,
                id: l.id?.slice(-6).toUpperCase() || 'LOAN',
                debit: 0,
                credit: Number(l.totalAmount) || 0,
                type: 'Loan'
            })),
            ...globalData.fundTransactions.filter((t: any) => periodScope(t.date)).flatMap((t: any) => {
                const amt = Number(t.amount) || 0;
                const isLiquidSrc = t.source === 'CashInHand' || t.source === 'CashAtHome' || globalData.bankAccounts.some((b: any) => b.id === t.source);
                const isLiquidDst = t.destination === 'CashInHand' || t.destination === 'CashAtHome' || globalData.bankAccounts.some((b: any) => b.id === t.destination);
                
                const srcLabel = t.source === 'CashInHand' ? 'Cash in Hand' : t.source === 'CashAtHome' ? 'Cash at Home' : (globalData.bankAccounts.find((b: any)=>b.id===t.source)?.bankName || t.source);
                const dstLabel = t.destination === 'CashInHand' ? 'Cash in Hand' : t.destination === 'CashAtHome' ? 'Cash at Home' : (globalData.bankAccounts.find((b: any)=>b.id===t.destination)?.bankName || t.destination);
                
                const results = [];
                if (isLiquidSrc) {
                    results.push({ date: t.date, particulars: `${srcLabel} → ${dstLabel}${t.description ? ' | ' + t.description : ''}`, id: t.id?.slice(-6).toUpperCase() || 'TRF', debit: amt, credit: 0, type: 'Transfer Out' });
                }
                if (isLiquidDst) {
                    results.push({ date: t.date, particulars: `${dstLabel} ← ${srcLabel}${t.description ? ' | ' + t.description : ''}`, id: t.id?.slice(-6).toUpperCase() || 'TRF', debit: 0, credit: amt, type: 'Transfer In' });
                }
                return results;
            }),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const totalInflow = dayWiseFlows.reduce((s,d) => s + d.incomes, 0);
        const totalOutflow = dayWiseFlows.reduce((s,d) => s + d.totalPayments + d.expenses, 0);

        return {
            liquid: liquidSnapshot,
            dayWiseLiquidity,
            purchases: Array.from(pMap.values()),
            sales: Array.from(sMap.values()),
            varietyStock: Array.from(stockMap.entries()).map(([variety, qty]) => ({ variety, qty })).sort((a,b) => b.qty - a.qty),
            distribution: {
                supplierCash: dayWiseFlows.reduce((s,d) => s + d.supplierCash, 0),
                supplierRtgs: dayWiseFlows.reduce((s,d) => s + d.supplierRtgs, 0),
                govDist: dayWiseFlows.reduce((s,d) => s + d.govDist, 0),
                totalPayments: dayWiseFlows.reduce((s,d) => s + d.totalPayments, 0),
                expenses: dayWiseFlows.reduce((s,d) => s + d.expenses, 0),
                incomes: dayWiseFlows.reduce((s,d) => s + d.incomes, 0),
                seCash: dayWiseFlows.reduce((s,d) => s + d.seCash, 0),
                netTotalBalance: dayWiseFlows.reduce((s,d) => s + d.netTotal, 0)
            },
            dayWise: dayWiseFlows,
            varietyDayData,
            consolidatedLedger,
            outflow: { supplier: dayWiseFlows.reduce((s,d) => s + d.totalPayments, 0), expenses: dayWiseFlows.reduce((s,d) => s + d.expenses, 0), cdReceived: 0, totalOutflow },
            inflow: { customer: 0, other: dayWiseFlows.reduce((s,d) => s + d.incomes, 0), cdGiven: 0, totalInflow },
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
                        tag: s.id.slice(-4)
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
                    return d >= filterDate && d <= filterEndDate && !e.isInternal && !e.isDeleted;
                }).forEach((e: any) => {
                    const amt = Number(e.amount) || 0;
                    zones.EXPENSE.rows.push({ date: e.date, item: e.payee, details: e.subCategory || e.category, transactionId: e.transactionId || e.id || '—', amount: amt, paymentMethod: e.paymentMethod || 'Cash', tag: 'EXP' });
                    zones.EXPENSE.total += amt;
                });

                // ── Add ALL supplier payments to Expense zones (RTGS, Gov, Online, Cash) ──
                globalData.supplierPayments.filter((p: any) => {
                    const d = startOfDay(new Date(p.date));
                    return d >= filterDate && d <= filterEndDate && !p.isDeleted;
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
                        receiptNo: supplierSrNo || p.parchiNo || '—',
                        checkNo: p.checkNo || '—',
                        receiptName: p.bankAcName || '—'
                    });
                    zones.EXPENSE.total += amt;
                });

                globalData.incomes.filter((i: any) => {
                    const d = startOfDay(new Date(i.date));
                    return d >= filterDate && d <= filterEndDate && !i.isInternal && !i.isDeleted;
                }).forEach((i: any) => {
                    const amt = Number(i.amount) || 0;
                    zones.INCOME.rows.push({ date: i.date, item: i.payee, details: i.category, amount: amt, tag: 'INC' });
                    zones.INCOME.total += amt;
                });

                globalData.fundTransactions.filter((t: any) => {
                    const d = startOfDay(new Date(t.date));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach((t: any) => {
                    const amt = Number(t.amount) || 0;
                    zones.INTERNAL.rows.push({ date: t.date, item: `${t.source} ➔ ${t.destination}`, details: t.description || 'Internal Transfer', amount: amt, tag: 'CASHFLOW' });
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
    }, [startDate, endDate, globalData, loans]);
}
