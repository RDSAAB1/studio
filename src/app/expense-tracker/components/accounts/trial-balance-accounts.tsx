import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { getTagOpeningBalances } from "@/lib/firestore/settings";
import type { DisplayTransaction } from "../../expense-tracker-client";

interface TrialBalanceProps {
  transactions: DisplayTransaction[];
}

const THRESHOLD = 0.5;

export const TrialBalanceAccounts: React.FC<TrialBalanceProps> = ({ transactions }) => {
  const [openingBalances, setOpeningBalances] = useState<Record<string, any>>({});

  const loadBalances = async () => {
    try {
      const data = await getTagOpeningBalances();
      setOpeningBalances(data || {});
    } catch (err) {
      console.error("Error loading tag opening balances for Trial Balance:", err);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  // Listen to cloud updates
  useEffect(() => {
    window.addEventListener('opening_balance_updated', loadBalances);
    return () => window.removeEventListener('opening_balance_updated', loadBalances);
  }, []);

  const tbData = useMemo(() => {
    const entries: { name: string; debit: number; credit: number }[] = [];

    // Group and calculate net balances for all relevant accounts
    const ledgers: Record<string, { totalIn: number; totalOut: number }> = {};

    const getParsedOpeningBal = (tag: string) => {
      const raw = openingBalances[tag.toUpperCase()];
      if (!raw) return { amount: 0, type: 'Dr' as const };
      if (typeof raw === 'number') {
        const isAsset = ['BUILDING', 'MACHINERY'].includes(tag.toUpperCase());
        return { amount: raw, type: isAsset ? ('Dr' as const) : ('Cr' as const) };
      }
      return { amount: Number(raw.amount) || 0, type: (raw.type || 'Dr') as 'Dr' | 'Cr' };
    };

    // Initialize ledgers with opening balances for all tags configured in settings
    Object.entries(openingBalances).forEach(([tag, raw]) => {
      const parsed = getParsedOpeningBal(tag);
      if (parsed.amount <= 0) return;

      let ledgerName = "";
      const upperTag = tag.toUpperCase();
      if (upperTag.startsWith('PARTY:')) {
        const partyName = toTitleCase(tag.replace(/^PARTY:/i, ''));
        ledgerName = `Party - ${partyName}`;
      } else if (upperTag === 'CAPITAL') ledgerName = "Capital Account";
      else if (upperTag === 'LIABILITIES') ledgerName = "Liabilities Account";
      else if (upperTag === 'BUILDING') ledgerName = "Building Account";
      else if (upperTag === 'MACHINERY') ledgerName = "Machinery Account";
      else if (upperTag === 'SALARY') ledgerName = "Salary Account";
      else if (upperTag === 'LABOURY') ledgerName = "Labour Account";
      else if (upperTag === 'TRANSPORT') ledgerName = "Transport Account";
      else if (upperTag === 'BROKERAGE') ledgerName = "Brokerage Account";
      else if (upperTag === 'MISCELLANEOUS') ledgerName = "Miscellaneous Account";
      else if (['PAYABLE', 'RECEIVABLE', 'INTEREST'].includes(upperTag)) ledgerName = "Interest Account";
      else ledgerName = toTitleCase(tag);

      if (ledgerName) {
        if (!ledgers[ledgerName]) {
          ledgers[ledgerName] = { totalIn: 0, totalOut: 0 };
        }
        if (parsed.type === 'Cr') {
          ledgers[ledgerName].totalIn += parsed.amount;
        } else {
          ledgers[ledgerName].totalOut += parsed.amount;
        }
      }
    });

    const capLiabPayees = new Set<string>();
    transactions.forEach(t => {
      const entryType = (t.entryType || '').toUpperCase().trim();
      const isCapital = entryType === 'CAPITAL';
      const isLiabilities = ['LIABILITIES', 'BORROW', 'BORROW RETURN'].includes(entryType);
      if (isCapital || isLiabilities) {
        const payeeName = toTitleCase((t.payee || '').trim());
        if (payeeName) {
          capLiabPayees.add(payeeName.toUpperCase());
        }
      }
    });

    transactions.forEach(t => {
      const subCat = (t.subCategory || '').toUpperCase().trim();
      const cat = (t.category || '').toUpperCase().trim();
      const entryType = (t.entryType || '').toUpperCase().trim();
      const payeeName = toTitleCase((t.payee || '').trim());

      const isMasterAccount = subCat === 'MASTER ACCOUNT';
      const isTargetTag = ['SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'MISCELLANEOUS', 'PAYABLE', 'RECEIVABLE', 'INTEREST'].includes(entryType);
      const isCapital = entryType === 'CAPITAL';
      const isLiabilities = ['LIABILITIES', 'BORROW', 'BORROW RETURN'].includes(entryType);
      const isBuilding = entryType === 'BUILDING';
      const isMachinery = entryType === 'MACHINERY';
      const isParty = (cat === 'PARTY LEDGER' || subCat === 'PARTY LEDGER' || subCat.includes('PARTY')) && payeeName && !capLiabPayees.has(payeeName.toUpperCase());

      // Include MASTER ACCOUNT, P&L tags, CAPITAL, LIABILITIES, BUILDING, MACHINERY tags, and PARTY LEDGERS
      if (!isMasterAccount && !isTargetTag && !isCapital && !isLiabilities && !isBuilding && !isMachinery && !isParty) return;

      let ledgerName = "";
      if (isCapital) {
        ledgerName = payeeName ? `Capital - ${payeeName}` : "Capital Account";
      } else if (isLiabilities) {
        ledgerName = payeeName ? `Liabilities - ${payeeName}` : "Liabilities Account";
      } else if (isBuilding) {
        ledgerName = "Building Account";
      } else if (isMachinery) {
        ledgerName = "Machinery Account";
      } else if (isTargetTag) {
        if (entryType === 'SALARY') ledgerName = "Salary Account";
        else if (entryType === 'LABOURY') ledgerName = "Labour Account";
        else if (entryType === 'TRANSPORT') ledgerName = "Transport Account";
        else if (entryType === 'BROKERAGE') ledgerName = "Brokerage Account";
        else if (entryType === 'MISCELLANEOUS') ledgerName = "Miscellaneous Account";
        else if (entryType === 'PAYABLE' || entryType === 'RECEIVABLE' || entryType === 'INTEREST') ledgerName = "Interest Account";
      } else if (isParty) {
        ledgerName = `Party - ${payeeName}`;
      } else {
        ledgerName = payeeName;
      }

      if (!ledgerName) return;

      const amount = Number(t.amount) || 0;
      const txType = (t.transactionType || "").toLowerCase();

      // Rule: Capital/Liabilities are always Credit; Party has specific rules; others use raw transactionType
      let isCr = false;
      if (isCapital || isLiabilities) {
        isCr = true;
      } else if (isParty) {
        isCr = ['INCOME', 'BUY', 'BORROW', 'LEND RETURN', 'CREDIT ADJUST', 'OPENING CR', 'EXTRA RECEIVE', 'PAYABLE', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'MISCELLANEOUS', 'CAPITAL', 'BUILDING', 'MACHINERY', 'LIABILITIES'].includes(entryType);
      } else {
        isCr = txType === 'income';
      }

      if (!ledgers[ledgerName]) {
        ledgers[ledgerName] = { totalIn: 0, totalOut: 0 };
      }

      if (isCr) {
        ledgers[ledgerName].totalIn += amount;
      } else {
        ledgers[ledgerName].totalOut += amount;
      }
    });

    // Populate entries with net Debit or Credit balances
    Object.entries(ledgers).forEach(([name, bal]) => {
      const net = bal.totalIn - bal.totalOut; // Credit (totalIn) - Debit (totalOut)

      if (Math.abs(net) <= THRESHOLD) return; // effectively zero balance — skip

      entries.push({
        name,
        debit: net < 0 ? Math.abs(net) : 0,   // net debit (totalOut > totalIn)
        credit: net > 0 ? net : 0,             // net credit (totalIn > totalOut)
      });
    });

    // Sort entries alphabetically by ledger name
    entries.sort((a, b) => a.name.localeCompare(b.name));

    const totalDr = entries.reduce((s, e) => s + e.debit, 0);
    const totalCr = entries.reduce((s, e) => s + e.credit, 0);
    const difference = Math.abs(totalDr - totalCr);
    const isBalanced = difference < 1;

    return { entries, totalDr, totalCr, isBalanced, difference };
  }, [transactions, openingBalances]);

  return (
    <div className="space-y-4">

      {/* Header Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-rose-50 border-rose-200 shadow-sm">
          <div className="px-5 py-4">
            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Total Debit (Dr)</p>
            <p className="text-2xl font-black text-rose-600 mt-1 tracking-tighter">{formatCurrency(tbData.totalDr)}</p>
          </div>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
          <div className="px-5 py-4">
            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Total Credit (Cr)</p>
            <p className="text-2xl font-black text-emerald-600 mt-1 tracking-tighter">{formatCurrency(tbData.totalCr)}</p>
          </div>
        </Card>
        <Card className={cn("shadow-sm border", tbData.isBalanced ? "bg-slate-900 border-slate-700" : "bg-amber-50 border-amber-300")}>
          <div className="px-5 py-4">
            <p className={cn("text-[10px] font-black uppercase tracking-widest", tbData.isBalanced ? "text-slate-300" : "text-amber-700")}>
              {tbData.isBalanced ? '✓ Trial Balance Matched' : '⚠ Difference'}
            </p>
            <p className={cn("text-2xl font-black mt-1 tracking-tighter", tbData.isBalanced ? "text-emerald-400" : "text-amber-600")}>
              {tbData.isBalanced ? 'Balanced' : formatCurrency(tbData.difference)}
            </p>
          </div>
        </Card>
      </div>

      {/* Trial Balance Table */}
      <Card className="border border-slate-200 shadow-lg overflow-hidden">
        <CardHeader className="bg-slate-800 text-white border-b border-slate-700 px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-widest">Master Account Trial Balance</CardTitle>
            <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">
              Master Accounts, Tags, Assets, Capital & Liabilities Ledgers — {tbData.entries.length} Active Accounts
            </p>
          </div>
          <div className={cn(
            "px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider border",
            tbData.isBalanced
              ? "bg-emerald-800 border-emerald-700 text-emerald-100"
              : "bg-amber-700 border-amber-600 text-amber-100"
          )}>
            {tbData.isBalanced ? '✓ Balanced' : '⚠ Check Entries'}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-transparent border-b border-slate-200">
                  <TableHead className="text-[11px] font-black uppercase text-slate-600 py-3 pl-6 w-[50%]">Account Name</TableHead>
                  <TableHead className="text-right text-[11px] font-black uppercase text-rose-600 py-3 pr-6 w-[25%]">Debit (Dr)</TableHead>
                  <TableHead className="text-right text-[11px] font-black uppercase text-emerald-600 py-3 pr-6 w-[25%]">Credit (Cr)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tbData.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-16 text-slate-300 font-bold uppercase text-xs">
                      No Ledger Entries Found
                    </TableCell>
                  </TableRow>
                ) : (
                  tbData.entries.map((entry, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 border-b border-slate-100">
                      <TableCell className="font-bold text-slate-800 text-xs py-3 pl-6 uppercase">{entry.name}</TableCell>
                      <TableCell className="text-right font-black text-rose-600 py-3 pr-6 tabular-nums">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600 py-3 pr-6 tabular-nums">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals Footer */}
          <div className="bg-slate-900 text-white px-6 py-3.5 grid grid-cols-2 border-t border-slate-700">
            <div className="font-black text-xs uppercase tracking-widest text-slate-300">Grand Total</div>
            <div className="grid grid-cols-2 text-right">
              <div className={cn("font-black tabular-nums pr-6", tbData.isBalanced ? "text-emerald-400" : "text-rose-400")}>
                {formatCurrency(tbData.totalDr)}
              </div>
              <div className={cn("font-black tabular-nums pr-2", tbData.isBalanced ? "text-emerald-400" : "text-rose-400")}>
                {formatCurrency(tbData.totalCr)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
