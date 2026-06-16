import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowRight, History, Calculator, BookOpen } from 'lucide-react';
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { format } from "date-fns";
import { getTagOpeningBalances, saveTagOpeningBalance, deleteTagOpeningBalance } from "@/lib/firestore/settings";
import type { DisplayTransaction } from "../../expense-tracker-client";

interface AccountSummary {
  name: string;
  type: string; // 'ASSET/LIABILITY' or 'INCOME/EXPENSE'
  totalIn: number;
  totalOut: number;
  balance: number;
  transactionCount: number;
  lastDate: Date | null;
  transactions: DisplayTransaction[];
  isParty: boolean;
}

interface LedgerAccountsProps {
  transactions: DisplayTransaction[];
}

export const LedgerAccounts: React.FC<LedgerAccountsProps> = ({ transactions }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const [openingBalances, setOpeningBalances] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Load opening balances from cloud settings
  const loadBalances = async () => {
    try {
      const data = await getTagOpeningBalances();
      setOpeningBalances(data || {});
    } catch (err) {
      console.error("Error loading tag opening balances from cloud:", err);
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

  // Helper to parse opening balance
  const getParsedOpeningBal = (name: string, isParty: boolean) => {
    const key = isParty ? `PARTY:${name.toUpperCase()}` : name.toUpperCase();
    const raw = openingBalances[key];
    if (!raw) return { amount: 0, type: 'Dr' as const };
    if (typeof raw === 'number') {
      const isAsset = ['BUILDING', 'MACHINERY'].includes(name.toUpperCase());
      return { amount: raw, type: isAsset ? ('Dr' as const) : ('Cr' as const) };
    }
    return { amount: Number(raw.amount) || 0, type: (raw.type || 'Dr') as 'Dr' | 'Cr' };
  };

  const handleDeleteOpeningBal = async () => {
    if (!selectedAccount) return;
    const summary = accountSummaries.find(s => s.name === selectedAccount);
    if (!summary) return;
    setIsSaving(true);
    try {
      const key = summary.isParty ? `PARTY:${selectedAccount.toUpperCase()}` : selectedAccount.toUpperCase();
      await deleteTagOpeningBalance(key);
      window.dispatchEvent(new Event('opening_balance_updated'));
    } catch (err) {
      console.error("Error deleting opening balance:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const accountSummaries = useMemo(() => {
    const summaries: Record<string, AccountSummary> = {};

    // Pre-initialize any Party Accounts from opening balances
    Object.keys(openingBalances || {}).forEach(k => {
      if (k.startsWith('PARTY:')) {
        const partyName = toTitleCase(k.replace('PARTY:', ''));
        if (!summaries[partyName]) {
          summaries[partyName] = {
            name: partyName,
            type: 'BALANCE',
            totalIn: 0,
            totalOut: 0,
            balance: 0,
            transactionCount: 0,
            lastDate: null,
            transactions: [],
            isParty: true
          };
        }
      }
    });

    transactions.forEach(t => {
      const category = (t.category || "").toUpperCase().trim();
      const subCategory = (t.subCategory || "").toUpperCase().trim();
      const payee = (t.payee || "").toUpperCase().trim();
      
      if (!category && !payee) return;

      const rawEntryType = (t.entryType || "").toUpperCase();
      const consolidateCategories = ['STAFF', 'LABOUR', 'LABOURY', 'BROKERAGE', 'TRANSPORT', 'MISSLENIOUR', 'MISCELLANEOUS', 'BUILDING', 'MACHINERY', 'CAPITAL'];

      // User requested: Do not take adjust amounts for STAFF, LABOUR, BROKERAGE, etc.
      if (['CREDIT ADJUST', 'DEBIT ADJUST'].includes(rawEntryType)) {
          if (consolidateCategories.some(c => subCategory.includes(c) || category.includes(c))) {
              return; // Completely ignore adjustments for these accounts
          }
      }

      // Determine Account Name based on User's logic
      let accountName = "UNCATEGORIZED";
      let isParty = false;

      if (category === 'PARTY LEDGER' || subCategory === 'PARTY LEDGER') {
          // Party ledgers are tracked by the Payee name (Person/Company)
          accountName = payee || "UNKNOWN PARTY";
          isParty = true;
      } else if (subCategory) {
          // Strictly create accounts based on Sub-Category
          accountName = subCategory;
      } else if (category) {
          // Fallback if Sub-Category is accidentally left blank
          accountName = category;
      } else {
          accountName = payee;
      }

      if (accountName === "UNCATEGORIZED" || !accountName) return;

      // Normalize
      accountName = toTitleCase(accountName);

      if (!summaries[accountName]) {
        summaries[accountName] = {
          name: accountName,
          type: isParty || ['Capital', 'Machinery', 'Building', 'Liabilities'].includes(accountName) ? 'BALANCE' : 'PNL',
          totalIn: 0,
          totalOut: 0,
          balance: 0,
          transactionCount: 0,
          lastDate: null,
          transactions: [],
          isParty: isParty
        };
      }

      const s = summaries[accountName];
      s.transactionCount++;
      s.transactions.push(t);

      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      if (!s.lastDate || tDate > s.lastDate) {
        s.lastDate = tDate;
      }

      const amount = Number(t.amount) || 0;
      const entryType = (t.entryType || t.transactionType || "").toUpperCase();
      
      let isIncome = false;
      let isExpense = false;

      if (isParty) {
          isIncome = ['INCOME', 'BUY', 'BORROW', 'LEND RETURN', 'CREDIT ADJUST', 'OPENING CR', 'EXTRA RECEIVE', 'PAYABLE', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'MISCELLANEOUS', 'CAPITAL', 'BUILDING', 'MACHINERY', 'LIABILITIES'].includes(entryType);
          isExpense = ['EXPENSE', 'SALE', 'LEND', 'BORROW RETURN', 'DEBIT ADJUST', 'OPENING DR', 'LOSS', 'USE', 'RECEIVABLE'].includes(entryType);
      } else {
          isExpense = ['EXPENSE', 'BUY', 'LOSS', 'USE', 'LEND', 'BORROW RETURN', 'RECEIVABLE', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'BUILDING', 'MACHINERY', 'MISCELLANEOUS'].includes(entryType);
          isIncome = ['INCOME', 'SALE', 'EXTRA RECEIVE', 'LEND RETURN', 'BORROW', 'PAYABLE', 'LIABILITIES', 'CAPITAL', 'OPENING CR'].includes(entryType);
      }

      if (isIncome) {
          s.totalIn += amount;
      } else if (isExpense) {
          s.totalOut += amount;
      }
    });

    Object.values(summaries).forEach(s => {
      const parsed = getParsedOpeningBal(s.name, s.isParty);
      if (parsed.amount > 0) {
        if (parsed.type === 'Cr') {
          s.totalIn += parsed.amount;
        } else {
          s.totalOut += parsed.amount;
        }
      }
      s.balance = s.totalIn - s.totalOut;
    });

    return Object.values(summaries).sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions, openingBalances]);

  const filteredSummaries = useMemo(() => {
    return accountSummaries.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [accountSummaries, searchTerm]);

  const selectedSummary = useMemo(() => {
    if (!selectedAccount) return null;
    return accountSummaries.find(s => s.name === selectedAccount) || null;
  }, [selectedAccount, accountSummaries]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER & SEARCH */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Ledger Accounts
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            Manage all master accounts and party ledgers
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="SEARCH ACCOUNT..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs font-bold uppercase tracking-wider bg-slate-50 border-slate-200 focus-visible:ring-primary"
          />
        </div>
      </div>

      {!selectedSummary ? (
        /* GRID VIEW OF ALL ACCOUNTS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSummaries.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <Calculator className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">No Accounts Found</p>
            </div>
          ) : (
            filteredSummaries.map((s, idx) => (
              <Card 
                key={idx} 
                className="overflow-hidden border-slate-200 hover:border-primary/30 hover:shadow-md transition-all group bg-white cursor-pointer"
                onClick={() => setSelectedAccount(s.name)}
              >
                <div className="h-1 w-full bg-slate-200 group-hover:bg-primary transition-colors" />
                <CardContent className="p-4 relative">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-widest leading-tight pr-4">
                        {s.name}
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                        {s.transactionCount} Transactions
                      </p>
                    </div>
                    <div className="h-6 w-6 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                      <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-primary" />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-end">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Balance</p>
                      <p className={cn(
                        "text-lg font-black tracking-tighter mt-0.5 tabular-nums",
                        s.balance > 0 ? "text-emerald-600" : s.balance < 0 ? "text-rose-600" : "text-slate-700"
                      )}>
                        {formatCurrency(Math.abs(s.balance))}
                        <span className="text-[10px] ml-1 opacity-60">{s.balance > 0 ? 'Cr' : s.balance < 0 ? 'Dr' : ''}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* DETAILED LEDGER VIEW FOR SELECTED ACCOUNT */
        <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-300">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-2">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedAccount(null)}
                className="h-8 px-3 border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
              >
                <ArrowRight className="h-3.5 w-3.5 mr-2 rotate-180" /> Back
              </Button>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{selectedSummary.name}</h2>
            </div>

            {getParsedOpeningBal(selectedSummary.name, selectedSummary.isParty).amount > 0 && (
              <Button
                size="sm"
                onClick={handleDeleteOpeningBal}
                disabled={isSaving}
                className="h-8 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[9px] tracking-wider rounded disabled:opacity-50"
              >
                {isSaving ? 'Deleting...' : 'Delete Opening Balance'}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total In (Cr)</p>
                <p className="text-xl font-black text-emerald-600 mt-1 tabular-nums">{formatCurrency(selectedSummary.totalIn)}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Out (Dr)</p>
                <p className="text-xl font-black text-rose-600 mt-1 tabular-nums">{formatCurrency(selectedSummary.totalOut)}</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm bg-white sm:col-span-2">
              <CardContent className="p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Closing Balance</p>
                <p className={cn(
                  "text-xl font-black mt-1 tabular-nums",
                  selectedSummary.balance > 0 ? "text-emerald-700" : selectedSummary.balance < 0 ? "text-rose-700" : "text-slate-700"
                )}>
                  {formatCurrency(Math.abs(selectedSummary.balance))}
                  <span className="text-xs ml-2 opacity-70 font-bold">{selectedSummary.balance > 0 ? '(CREDIT)' : selectedSummary.balance < 0 ? '(DEBIT)' : ''}</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-200 shadow-sm overflow-hidden rounded-xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-4 flex flex-row justify-between items-center">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-slate-400" />
                Ledger Entries
              </CardTitle>
              <Badge variant="secondary" className="text-[9px] font-bold uppercase">{selectedSummary.transactionCount} Entries</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Date</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Particulars</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-32">Dr (Out)</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-32">Cr (In)</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-32">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const parsed = getParsedOpeningBal(selectedSummary.name, selectedSummary.isParty);
                      const isDr = parsed.type === 'Dr';
                      const startBalance = isDr ? -parsed.amount : parsed.amount;
                      let runningBalance = startBalance;

                      const computedList = selectedSummary.transactions
                        .sort((a, b) => {
                           const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                           if (dateCompare !== 0) return dateCompare;
                           return (a.transactionId || '').localeCompare(b.transactionId || '');
                        })
                        .map((t) => {
                          const amount = Number(t.amount) || 0;
                          const rawType = (t.entryType || t.transactionType || "").toUpperCase();
                          
                          const isPartyAccount = selectedSummary.name !== 'Capital' && selectedSummary.name !== 'Machinery' && selectedSummary.name !== 'Building' && selectedSummary.name !== 'Liabilities' && !selectedSummary.name.startsWith('Capital -') && !selectedSummary.name.startsWith('Liabilities -');
                          
                          let isIn = false;
                          if (selectedSummary.type === 'BALANCE' && isPartyAccount) {
                            isIn = ['INCOME', 'BUY', 'BORROW', 'LEND RETURN', 'CREDIT ADJUST', 'OPENING CR', 'EXTRA RECEIVE', 'PAYABLE', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'MISCELLANEOUS', 'CAPITAL', 'BUILDING', 'MACHINERY', 'LIABILITIES'].includes(rawType);
                          } else {
                            isIn = ['INCOME', 'SALE', 'EXTRA RECEIVE', 'LEND RETURN', 'BORROW', 'PAYABLE', 'LIABILITIES', 'CAPITAL'].includes(rawType);
                          }
                          
                          if (isIn) runningBalance += amount;
                          else runningBalance -= amount;

                          return { ...t, isIn, runningBalance };
                        })
                        .reverse();

                      return (
                        <>
                          {computedList.map((t, idx) => (
                            <tr key={t.id || idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 text-xs font-bold text-slate-600">
                                {format(new Date(t.date), "dd-MM-yyyy")}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-900">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span>{toTitleCase(t.payee)}</span>
                                    <span className="text-[9px] font-black text-primary uppercase tracking-tighter bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{t.transactionId}</span>
                                  </div>
                                  {(t.category || t.subCategory || (t as any).remarks) && (
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                      {[t.category, t.subCategory, (t as any).remarks].filter(Boolean).join(' • ')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-rose-600 tabular-nums">
                                {!t.isIn ? formatCurrency(t.amount) : '-'}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-emerald-600 tabular-nums">
                                {t.isIn ? formatCurrency(t.amount) : '-'}
                              </td>
                              <td className={cn("px-4 py-3 text-[11px] font-black text-right tabular-nums", t.runningBalance > 0 ? "text-emerald-700" : t.runningBalance < 0 ? "text-rose-700" : "text-slate-600")}>
                                {formatCurrency(Math.abs(t.runningBalance))} {t.runningBalance > 0 ? 'Cr' : t.runningBalance < 0 ? 'Dr' : ''}
                              </td>
                            </tr>
                          ))}

                          {parsed.amount > 0 && (
                            <tr className="bg-primary/5 font-medium">
                              <td className="px-4 py-3 text-xs text-slate-400 font-semibold">—</td>
                              <td className="px-4 py-3 text-xs font-black text-primary italic uppercase">Opening Balance</td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-rose-600 tabular-nums">
                                {isDr ? formatCurrency(parsed.amount) : '-'}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-emerald-600 tabular-nums">
                                {!isDr ? formatCurrency(parsed.amount) : '-'}
                              </td>
                              <td className={cn("px-4 py-3 text-[11px] font-black text-right tabular-nums", startBalance > 0 ? "text-emerald-700" : startBalance < 0 ? "text-rose-700" : "text-slate-600")}>
                                {formatCurrency(parsed.amount)} {isDr ? 'Dr' : 'Cr'}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
