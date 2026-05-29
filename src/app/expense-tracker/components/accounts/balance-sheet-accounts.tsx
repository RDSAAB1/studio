import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { getTagOpeningBalances } from "@/lib/firestore/settings";
import type { DisplayTransaction } from "../../expense-tracker-client";

interface BalanceSheetProps {
  transactions: DisplayTransaction[];
}

const THRESHOLD = 0.5;

export const BalanceSheetAccounts: React.FC<BalanceSheetProps> = ({ transactions }) => {
  const [openingBalances, setOpeningBalances] = useState<Record<string, any>>({});

  const loadBalances = async () => {
    try {
      const data = await getTagOpeningBalances();
      setOpeningBalances(data || {});
    } catch (err) {
      console.error("Error loading tag opening balances for Balance Sheet:", err);
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

  const bsData = useMemo(() => {
    const assets: { name: string; amount: number }[] = [];
    const liabilities: { name: string; amount: number }[] = [];

    const getParsedOpeningBal = (tag: string) => {
      const raw = openingBalances[tag.toUpperCase()];
      if (!raw) return { amount: 0, type: 'Dr' as const };
      if (typeof raw === 'number') {
        const isAsset = ['BUILDING', 'MACHINERY'].includes(tag.toUpperCase());
        return { amount: raw, type: isAsset ? ('Dr' as const) : ('Cr' as const) };
      }
      return { amount: Number(raw.amount) || 0, type: (raw.type || 'Dr') as 'Dr' | 'Cr' };
    };

    // Load persisted opening balances from loaded state
    const bldOpening = getParsedOpeningBal('BUILDING');
    const macOpening = getParsedOpeningBal('MACHINERY');

    // ── STEP 1: Calculate Net Profit / Net Loss of Master Accounts (including P&L target tags) ──
    let pnlTotalIn = 0;
    let pnlTotalOut = 0;

    transactions.forEach(t => {
      const subCat = (t.subCategory || "").toUpperCase().trim();
      const entryType = (t.entryType || "").toUpperCase().trim();

      const isMasterAccount = subCat === "MASTER ACCOUNT";
      const isTargetTag = ['SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'MISCELLANEOUS', 'PAYABLE', 'RECEIVABLE', 'INTEREST'].includes(entryType);

      if (!isMasterAccount && !isTargetTag) return;

      const amount = Number(t.amount) || 0;
      const txType = (t.transactionType || "").toLowerCase();

      // Rule: Capital/Liabilities are always Credit; others use raw transactionType
      const isCapital = entryType === 'CAPITAL';
      const isLiabilities = ['LIABILITIES', 'BORROW', 'BORROW RETURN'].includes(entryType);
      
      const isCr = (isCapital || isLiabilities) ? true : txType === 'income';

      if (isCr) {
        pnlTotalIn += amount;
      } else {
        pnlTotalOut += amount;
      }
    });

    const pnlNetResult = pnlTotalIn - pnlTotalOut; // positive = Profit, negative = Loss

    // ── STEP 2: Group CAPITAL and LIABILITIES payee-wise; BUILDING and MACHINERY directly; PARTIES payee-wise ──
    const capGroups: Record<string, { totalIn: number; totalOut: number }> = {};
    const liabGroups: Record<string, { totalIn: number; totalOut: number }> = {};
    const partyGroups: Record<string, { totalIn: number; totalOut: number }> = {};

    // Pre-initialize partyGroups with opening balances
    Object.entries(openingBalances).forEach(([tag, raw]) => {
      const upperTag = tag.toUpperCase();
      if (upperTag.startsWith('PARTY:')) {
        const partyName = toTitleCase(tag.replace(/^PARTY:/i, ''));
        if (!partyGroups[partyName]) {
          partyGroups[partyName] = { totalIn: 0, totalOut: 0 };
        }
        const parsed = getParsedOpeningBal(tag);
        if (parsed.type === 'Cr') {
          partyGroups[partyName].totalIn += parsed.amount;
        } else {
          partyGroups[partyName].totalOut += parsed.amount;
        }
      }
    });

    let bldTotalIn = bldOpening.type === 'Cr' ? bldOpening.amount : 0;
    let bldTotalOut = bldOpening.type === 'Dr' ? bldOpening.amount : 0;
    let macTotalIn = macOpening.type === 'Cr' ? macOpening.amount : 0;
    let macTotalOut = macOpening.type === 'Dr' ? macOpening.amount : 0;

    const capLiabPayees = new Set<string>();
    transactions.forEach(t => {
      const entryType = (t.entryType || "").toUpperCase().trim();
      const isCapital = entryType === 'CAPITAL';
      const isLiabilities = ['LIABILITIES', 'BORROW', 'BORROW RETURN'].includes(entryType);
      if (isCapital || isLiabilities) {
        const payeeName = toTitleCase((t.payee || "").trim());
        if (payeeName) {
          capLiabPayees.add(payeeName.toUpperCase());
        }
      }
    });

    transactions.forEach(t => {
      const entryType = (t.entryType || "").toUpperCase().trim();
      const subCat = (t.subCategory || "").toUpperCase().trim();
      const cat = (t.category || "").toUpperCase().trim();
      const payeeName = toTitleCase((t.payee || "").trim()) || "Unknown Payee";
      const amount = Number(t.amount) || 0;
      const txType = (t.transactionType || "").toLowerCase();

      const isCapital = entryType === 'CAPITAL';
      const isLiabilities = ['LIABILITIES', 'BORROW', 'BORROW RETURN'].includes(entryType);
      const isBuilding = entryType === 'BUILDING';
      const isMachinery = entryType === 'MACHINERY';
      const isParty = (cat === 'PARTY LEDGER' || subCat === 'PARTY LEDGER' || subCat.includes('PARTY')) && payeeName !== "Unknown Payee" && !capLiabPayees.has(payeeName.toUpperCase());

      if (!isCapital && !isLiabilities && !isBuilding && !isMachinery && !isParty) return;

      if (isCapital) {
        if (!capGroups[payeeName]) {
          capGroups[payeeName] = { totalIn: 0, totalOut: 0 };
        }
        capGroups[payeeName].totalIn += amount;
      } else if (isLiabilities) {
        if (!liabGroups[payeeName]) {
          liabGroups[payeeName] = { totalIn: 0, totalOut: 0 };
        }
        liabGroups[payeeName].totalIn += amount;
      } else if (isBuilding) {
        const isCr = txType === 'income';
        if (isCr) bldTotalIn += amount;
        else bldTotalOut += amount;
      } else if (isMachinery) {
        const isCr = txType === 'income';
        if (isCr) macTotalIn += amount;
        else macTotalOut += amount;
      } else if (isParty) {
        if (!partyGroups[payeeName]) {
          partyGroups[payeeName] = { totalIn: 0, totalOut: 0 };
        }
        const isCr = ['INCOME', 'BUY', 'BORROW', 'LEND RETURN', 'CREDIT ADJUST', 'OPENING CR', 'EXTRA RECEIVE', 'PAYABLE', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'MISCELLANEOUS', 'CAPITAL', 'BUILDING', 'MACHINERY', 'LIABILITIES'].includes(entryType);
        if (isCr) {
          partyGroups[payeeName].totalIn += amount;
        } else {
          partyGroups[payeeName].totalOut += amount;
        }
      }
    });

    // Populate Capital Payee Accounts (Credit balances to Liabilities, Debit to Assets)
    Object.entries(capGroups).forEach(([name, acc]) => {
      const net = acc.totalIn - acc.totalOut;
      const displayName = `Capital - ${name}`;
      if (net > THRESHOLD) {
        liabilities.push({ name: displayName, amount: net });
      } else if (net < -THRESHOLD) {
        assets.push({ name: displayName, amount: Math.abs(net) });
      }
    });

    // Populate Liabilities Payee Accounts (Credit balances to Liabilities, Debit to Assets)
    Object.entries(liabGroups).forEach(([name, acc]) => {
      const net = acc.totalIn - acc.totalOut;
      const displayName = `Liabilities - ${name}`;
      if (net > THRESHOLD) {
        liabilities.push({ name: displayName, amount: net });
      } else if (net < -THRESHOLD) {
        assets.push({ name: displayName, amount: Math.abs(net) });
      }
    });

    // Populate Party Accounts (Credit balances to Liabilities, Debit to Assets)
    Object.entries(partyGroups).forEach(([name, acc]) => {
      const net = acc.totalIn - acc.totalOut;
      const displayName = `Party - ${name}`;
      if (net > THRESHOLD) {
        liabilities.push({ name: displayName, amount: net });
      } else if (net < -THRESHOLD) {
        assets.push({ name: displayName, amount: Math.abs(net) });
      }
    });

    // Populate Building (Directly, including opening balance)
    const bldNet = bldTotalIn - bldTotalOut;
    if (bldNet < -THRESHOLD) {
      assets.push({ name: "Building Account", amount: Math.abs(bldNet) });
    } else if (bldNet > THRESHOLD) {
      liabilities.push({ name: "Building Account", amount: bldNet });
    }

    // Populate Machinery (Directly, including opening balance)
    const macNet = macTotalIn - macTotalOut;
    if (macNet < -THRESHOLD) {
      assets.push({ name: "Machinery Account", amount: Math.abs(macNet) });
    } else if (macNet > THRESHOLD) {
      liabilities.push({ name: "Machinery Account", amount: macNet });
    }

    // Sort alphabetically by account name
    assets.sort((a, b) => a.name.localeCompare(b.name));
    liabilities.sort((a, b) => a.name.localeCompare(b.name));

    // Append dynamic Net Profit or Net Loss from P&L
    if (pnlNetResult > THRESHOLD) {
      liabilities.push({ name: 'NET PROFIT (FROM P&L)', amount: pnlNetResult });
    } else if (pnlNetResult < -THRESHOLD) {
      assets.push({ name: 'NET LOSS (FROM P&L)', amount: Math.abs(pnlNetResult) });
    }

    const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);

    return { assets, liabilities, totalAssets, totalLiabilities, pnlNetResult };
  }, [transactions, openingBalances]);

  const isProfit = bsData.pnlNetResult > THRESHOLD;
  const isLoss = bsData.pnlNetResult < -THRESHOLD;

  return (
    <div className="space-y-4">
      {/* Master Account Financial Notice */}
      <div className={cn(
        "rounded-lg border px-5 py-3 flex items-center justify-between",
        isProfit ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
      )}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Master Account Financial Net Balance
          </p>
          <p className={cn(
            "text-sm font-black mt-0.5",
            isProfit ? "text-emerald-700" : "text-rose-700"
          )}>
            {isProfit 
              ? `Net Profit of ${formatCurrency(bsData.pnlNetResult)} is taken to the Liabilities side.`
              : isLoss 
                ? `Net Loss of ${formatCurrency(Math.abs(bsData.pnlNetResult))} is taken to the Assets side.`
                : "No Net Profit or Loss computed."
            }
          </p>
        </div>
        <div className={cn(
          "text-xs font-black uppercase px-3 py-1.5 rounded border bg-white shadow-sm border-slate-200 text-slate-800"
        )}>
          {isProfit ? "✓ Profit calculated" : isLoss ? "✓ Loss calculated" : "No Impact"}
        </div>
      </div>

      {/* Balance Sheet Table */}
      <Card className="border border-slate-200 shadow-lg overflow-hidden">
        <CardHeader className="bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-widest">Master Account Balance Sheet</CardTitle>
            <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">
              Capital & Liabilities (Payee-wise), Building & Machinery Accounts & P&L Net Result
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">

            {/* LIABILITIES SIDE (CREDIT BALANCES) */}
            <div className="flex flex-col">
              <div className="bg-rose-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-black text-rose-800 uppercase tracking-widest">Liabilities & Capital Balances (Cr)</span>
                <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded uppercase">Cr</span>
              </div>
              <Table>
                <TableBody>
                  {bsData.liabilities.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-center py-12 text-slate-300 font-bold uppercase text-xs">
                        No Credit Balances
                      </TableCell>
                    </TableRow>
                  ) : (
                    bsData.liabilities.map((item, i) => (
                      <TableRow 
                        key={i} 
                        className={cn(
                          "border-b border-slate-100",
                          item.name.startsWith('NET PROFIT') 
                            ? "bg-emerald-50/50 hover:bg-emerald-100/60 font-extrabold" 
                            : "hover:bg-rose-50/20"
                        )}
                      >
                        <TableCell className={cn(
                          "py-3 pl-6 text-xs uppercase font-bold",
                          item.name.startsWith('NET PROFIT') ? "text-emerald-700 font-black" : "text-slate-800"
                        )}>
                          {item.name}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-black py-3 pr-6 tabular-nums text-xs",
                          item.name.startsWith('NET PROFIT') ? "text-emerald-600" : "text-slate-900"
                        )}>
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="mt-auto bg-rose-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between font-black text-xs text-rose-900 uppercase tracking-wider">
                <span>Total Liabilities</span>
                <span>{formatCurrency(bsData.totalLiabilities)}</span>
              </div>
            </div>

            {/* ASSETS SIDE (DEBIT BALANCES) */}
            <div className="flex flex-col">
              <div className="bg-emerald-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest">Assets & Debit Balances (Dr)</span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded uppercase">Dr</span>
              </div>
              <Table>
                <TableBody>
                  {bsData.assets.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-center py-12 text-slate-300 font-bold uppercase text-xs">
                        No Debit Balances
                      </TableCell>
                    </TableRow>
                  ) : (
                    bsData.assets.map((item, i) => (
                      <TableRow 
                        key={i} 
                        className={cn(
                          "border-b border-slate-100",
                          item.name.startsWith('NET LOSS') 
                            ? "bg-rose-50/50 hover:bg-rose-100 font-extrabold" 
                            : "hover:bg-emerald-50/20"
                        )}
                      >
                        <TableCell className={cn(
                          "py-3 pl-6 text-xs uppercase font-bold",
                          item.name.startsWith('NET LOSS') ? "text-rose-700 font-black" : "text-slate-800"
                        )}>
                          {item.name}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-black py-3 pr-6 tabular-nums text-xs",
                          item.name.startsWith('NET LOSS') ? "text-rose-600" : "text-slate-900"
                        )}>
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="mt-auto bg-emerald-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between font-black text-xs text-emerald-900 uppercase tracking-wider">
                <span>Total Assets</span>
                <span>{formatCurrency(bsData.totalAssets)}</span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
};
