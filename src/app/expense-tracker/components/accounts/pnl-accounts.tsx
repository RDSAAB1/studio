import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import type { DisplayTransaction } from "../../expense-tracker-client";

interface PnlAccountsProps {
  transactions: DisplayTransaction[];
}

export const PnlAccounts: React.FC<PnlAccountsProps> = ({ transactions }) => {
  const pnlData = useMemo(() => {

    // ledgerName -> { name: string; totalIn (Cr), totalOut (Dr) }
    const ledgers: Record<string, { name: string; totalIn: number; totalOut: number }> = {};

    transactions.forEach(t => {
      const subCategory = (t.subCategory || "").toUpperCase().trim();
      const entryType = (t.entryType || "").toUpperCase().trim();

      const isMasterAccount = subCategory === 'MASTER ACCOUNT';
      const isTargetTag = ['SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'MISCELLANEOUS', 'PAYABLE', 'RECEIVABLE', 'INTEREST'].includes(entryType);

      // FILTER: Include if subCategory is MASTER ACCOUNT, OR if entryType is Salary/Laboury/Transport/Brokerage/Miscellaneous/Interest tags
      if (!isMasterAccount && !isTargetTag) return;

      // Group into generic ledger name if it's a target tag; otherwise group by payee
      let ledgerName = "";
      if (isTargetTag) {
        if (entryType === 'SALARY') ledgerName = "Salary Account";
        else if (entryType === 'LABOURY') ledgerName = "Labour Account";
        else if (entryType === 'TRANSPORT') ledgerName = "Transport Account";
        else if (entryType === 'BROKERAGE') ledgerName = "Brokerage Account";
        else if (entryType === 'MISCELLANEOUS') ledgerName = "Miscellaneous Account";
        else if (entryType === 'PAYABLE' || entryType === 'RECEIVABLE' || entryType === 'INTEREST') ledgerName = "Interest Account";
      } else {
        ledgerName = toTitleCase((t.payee || "").trim());
      }

      if (!ledgerName) return;

      const amount = Number(t.amount) || 0;
      const txType = (t.transactionType || "").toLowerCase();
      const isCr = txType === 'income';
      const isDr = txType === 'expense';

      if (!isCr && !isDr) return;

      if (!ledgers[ledgerName]) {
        ledgers[ledgerName] = { name: ledgerName, totalIn: 0, totalOut: 0 };
      }

      if (isCr) {
        ledgers[ledgerName].totalIn += amount;   // Credit side (inflow)
      } else if (isDr) {
        ledgers[ledgerName].totalOut += amount;  // Debit side (outflow)
      }
    });

    const debitSide: { name: string; totalIn: number; totalOut: number; balance: number }[] = [];
    const creditSide: { name: string; totalIn: number; totalOut: number; balance: number }[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    Object.values(ledgers).forEach(acc => {
      const balance = acc.totalIn - acc.totalOut; // Credit (totalIn) - Debit (totalOut)

      // Use 0.5 threshold to avoid displaying effectively zero near-zero balances
      if (balance < -0.5) {
        // Net Debit → Debit side of P&L
        debitSide.push({ ...acc, balance: Math.abs(balance) });
        totalDebit += Math.abs(balance);
      } else if (balance > 0.5) {
        // Net Credit → Credit side of P&L
        creditSide.push({ ...acc, balance });
        totalCredit += balance;
      }
    });

    // Sort alphabetically by ledger name
    debitSide.sort((a, b) => a.name.localeCompare(b.name));
    creditSide.sort((a, b) => a.name.localeCompare(b.name));

    return {
      debitSide,
      creditSide,
      totalDebit,
      totalCredit,
      netProfit: totalCredit - totalDebit,
    };
  }, [transactions]);

  return (
    <div className="space-y-4">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-rose-50 border-rose-200 shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-black text-rose-800 uppercase tracking-widest leading-none">Total Debits (Dr)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-600 tracking-tighter">{formatCurrency(pnlData.totalDebit)}</div>
            <p className="text-[10px] font-bold text-rose-400 uppercase mt-1 tracking-wider">{pnlData.debitSide.length} Ledger(s)</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-black text-emerald-800 uppercase tracking-widest leading-none">Total Credits (Cr)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(pnlData.totalCredit)}</div>
            <p className="text-[10px] font-bold text-emerald-400 uppercase mt-1 tracking-wider">{pnlData.creditSide.length} Ledger(s)</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "shadow-md transition-all duration-300",
          pnlData.netProfit >= 0 ? "bg-slate-900 border-slate-800" : "bg-rose-950 border-rose-900"
        )}>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-black text-white uppercase tracking-widest leading-none">
              Net {pnlData.netProfit >= 0 ? 'Profit' : 'Loss'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-black tracking-tighter",
              pnlData.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {formatCurrency(Math.abs(pnlData.netProfit))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traditional Two-Column P&L Sheet */}
      <Card className="border border-slate-200 shadow-lg overflow-hidden">
        <CardHeader className="bg-purple-950 text-white border-b border-purple-900 px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-widest">Profit & Loss Statement</CardTitle>
            <CardDescription className="text-xs font-bold text-purple-200 uppercase mt-0.5">
              Master Accounts & Tag Ledgers (Salary, Labour, Transport, Brokerage, Interest, Miscellaneous included)
            </CardDescription>
          </div>
          <div className="bg-purple-800 border border-purple-700 text-purple-100 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider">
            {pnlData.debitSide.length + pnlData.creditSide.length} Accounts
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">

            {/* 🔴 DEBIT SIDE (Dr) */}
            <div className="flex flex-col min-h-[300px]">
              <div className="bg-rose-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between sticky top-0">
                <span className="text-[11px] font-black text-rose-800 uppercase tracking-widest">Dr — Expenses / Loss</span>
                <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded uppercase">Debit</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/60 border-b border-slate-100">
                    <TableHead className="text-[11px] font-black uppercase text-slate-600 py-2">Account (Payee)</TableHead>
                    <TableHead className="text-right text-[11px] font-black uppercase text-slate-600 py-2">Amount (Dr)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pnlData.debitSide.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-16 text-slate-300 font-bold uppercase text-xs">
                        No Debit Ledgers
                      </TableCell>
                    </TableRow>
                  ) : (
                    pnlData.debitSide.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-rose-50/20 border-b border-slate-100">
                        <TableCell className="font-bold text-slate-800 text-xs py-2.5 uppercase">{item.name}</TableCell>
                        <TableCell className="text-right font-black text-rose-600 py-2.5 tabular-nums">
                          {formatCurrency(item.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="mt-auto bg-rose-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between font-black text-xs text-rose-900 uppercase tracking-wider">
                <span>Total Debit (Net)</span>
                <span>{formatCurrency(pnlData.totalDebit)}</span>
              </div>
            </div>

            {/* 🟢 CREDIT SIDE (Cr) */}
            <div className="flex flex-col min-h-[300px]">
              <div className="bg-emerald-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between sticky top-0">
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest">Cr — Incomes / Gains</span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded uppercase">Credit</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/60 border-b border-slate-100">
                    <TableHead className="text-[11px] font-black uppercase text-slate-600 py-2">Account (Payee)</TableHead>
                    <TableHead className="text-right text-[11px] font-black uppercase text-slate-600 py-2">Amount (Cr)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pnlData.creditSide.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-16 text-slate-300 font-bold uppercase text-xs">
                        No Credit Ledgers
                      </TableCell>
                    </TableRow>
                  ) : (
                    pnlData.creditSide.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-emerald-50/20 border-b border-slate-100">
                        <TableCell className="font-bold text-slate-800 text-xs py-2.5 uppercase">{item.name}</TableCell>
                        <TableCell className="text-right font-black text-emerald-600 py-2.5 tabular-nums">
                          {formatCurrency(item.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="mt-auto bg-emerald-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between font-black text-xs text-emerald-900 uppercase tracking-wider">
                <span>Total Credit (Net)</span>
                <span>{formatCurrency(pnlData.totalCredit)}</span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

    </div>
  );
};
