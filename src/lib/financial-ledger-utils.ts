import { format, subDays } from 'date-fns';

export interface LedgerEntry {
    date: string;
    particulars: string;
    id: string;
    debit: number;
    credit: number;
    type: string;
    accountId?: string | null;
    balance?: number;
}

export function generateAccountLedgers(
    globalData: any,
    startDate: Date,
    endDate: Date,
    initialBalances?: Map<string, number>
) {
    const periodScope = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= startDate && d <= endDate;
    };

    // 1. Build Consolidated Ledger
    const consolidatedLedger: LedgerEntry[] = [
        ...(globalData.supplierPayments || globalData.paymentHistory || []).filter((p: any) => periodScope(p.date)).map((p: any) => {
            const supplier = globalData.suppliers?.find((s: any) => s.id === p.supplierId);
            const sName = supplier ? supplier.name : (p.supplierName || 'Supplier');
            return {
                date: p.date,
                particulars: `${sName}${p.utrNo ? ' | UTR: ' + p.utrNo : ''}`,
                id: p.paymentId || 'PAY', debit: Number(p.amount) || 0, credit: 0, type: 'Supplier Payment',
                accountId: p.bankAccountId || (p.receiptType === 'Cash' || p.paymentMethod === 'Cash' ? 'CashInHand' : null)
            };
        }),
        ...(globalData.customerPayments || []).filter((p: any) => periodScope(p.date)).map((p: any) => {
            const refNo = p.receiptNo || p.parchiNo || (p.paidFor?.[0]?.srNo);
            const refArray = typeof refNo === 'string' 
                ? refNo.split(',').map((s: string) => s.trim()).filter(Boolean) 
                : (refNo ? [String(refNo)] : []);

            const linkedParchi = globalData.customers?.find((c: any) => 
                refArray.some((ref: string) => String(c.srNo) === String(ref) || String(c.parchiNo) === String(ref)) || 
                (p.customerId && c.id === p.customerId)
            );
            
            const cName = linkedParchi 
                ? (linkedParchi.companyName || linkedParchi.name || 'Customer') 
                : (p.customerName || p.name || p.payee || 'Customer');

            return {
                date: p.date,
                particulars: `${cName}${refNo ? ' | Parchi: ' + refNo : ''}`,
                id: p.paymentId || 'REC', debit: 0, credit: Number(p.amount) || 0, type: 'Customer Receipt',
                accountId: p.bankAccountId || (p.paymentMethod === 'Cash' ? 'CashInHand' : null)
            };
        }),
        ...(globalData.incomes || []).filter((i: any) => periodScope(i.date) && !i.isInternal).map((i: any) => ({
            date: i.date,
            particulars: `${i.payee} | ${i.category}`,
            id: i.transactionId || 'INC', debit: 0, credit: Number(i.amount) || 0, type: 'Income',
            accountId: i.bankAccountId || (i.paymentMethod === 'Cash' ? 'CashInHand' : null)
        })),
        ...(globalData.expenses || []).filter((e: any) => periodScope(e.date) && !e.isInternal).map((e: any) => ({
            date: e.date,
            particulars: `${e.payee} | ${e.category}`,
            id: e.transactionId || 'EXP', debit: Number(e.amount) || 0, credit: 0, type: 'Expense',
            accountId: e.bankAccountId || (e.paymentMethod === 'Cash' ? 'CashInHand' : null)
        })),
        ...(globalData.fundTransactions || []).filter((t: any) => periodScope(t.date)).flatMap((t: any) => {
            const amt = Number(t.amount) || 0;
            return [
                { date: t.date, particulars: `Transfer to ${t.destination}`, id: 'AMT-OUT', debit: amt, credit: 0, type: 'Internal Transfer', accountId: t.source },
                { date: t.date, particulars: `Transfer from ${t.source}`, id: 'AMT-IN', debit: 0, credit: amt, type: 'Internal Transfer', accountId: t.destination }
            ] as LedgerEntry[];
        }),
    ].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
        const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
        if (dayA !== dayB) return dayA - dayB;
        if (a.id === 'AMT-IN' && b.id !== 'AMT-IN') return -1;
        if (b.id === 'AMT-IN' && a.id !== 'AMT-IN') return 1;
        const creditDiff = b.credit - a.credit;
        if (creditDiff !== 0) return creditDiff;
        const idDiff = a.id.localeCompare(b.id);
        if (idDiff !== 0) return idDiff;
        return dateA.getTime() - dateB.getTime();
    });

    const accountLedgers: Record<string, LedgerEntry[]> = {};
    const allAccountIds = ['CashInHand', 'CashAtHome', ...(globalData.bankAccounts || []).map((a: any) => a.id)];
    
    allAccountIds.forEach(accId => {
        // Calculate Opening Balance
        // If initialBalances are provided, they represent the balance AT THE END of the period (current state).
        // To get the opening balance, we subtract all credits and add all debits within the period.
        let closingBal = initialBalances?.get(accId) || 0;
        const periodTransactions = consolidatedLedger.filter(t => t.accountId === accId);
        
        const periodInflow = periodTransactions.reduce((s, t) => s + t.credit, 0);
        const periodOutflow = periodTransactions.reduce((s, t) => s + t.debit, 0);
        
        let runningBal = closingBal - periodInflow + periodOutflow;
        
        const ledger: LedgerEntry[] = [{
            date: startDate.toISOString(),
            particulars: 'OPENING BALANCE',
            id: 'OP',
            debit: 0,
            credit: 0,
            balance: runningBal,
            type: 'System'
        }];
        
        periodTransactions.forEach(t => {
            runningBal += (t.credit - t.debit);
            ledger.push({ ...t, balance: runningBal });
        });
        
        accountLedgers[accId] = ledger;
    });

    return accountLedgers;
}
