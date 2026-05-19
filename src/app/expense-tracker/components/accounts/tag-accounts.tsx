import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Tag as TagIcon, 
  History, 
  ChevronRight, 
  BarChart3
} from 'lucide-react';
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { format } from "date-fns";
import { getTagOpeningBalances, saveTagOpeningBalance } from "@/lib/firestore/settings";
import type { DisplayTransaction } from "../../expense-tracker-client";

interface TagSummary {
  tag: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
  lastUsedDate: Date | null;
  transactions: DisplayTransaction[];
}

interface TagAccountsProps {
  transactions: DisplayTransaction[];
}

const THRESHOLD = 0.5;

export const TagAccounts: React.FC<TagAccountsProps> = ({ transactions }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [openingBalances, setOpeningBalances] = useState<Record<string, any>>({});
  const [openingBalInput, setOpeningBalInput] = useState("");
  const [openingTypeInput, setOpeningTypeInput] = useState<'Dr' | 'Cr'>('Dr');
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

  // Parse opening balance details helper
  const getParsedOpeningBal = (tag: string) => {
    const raw = openingBalances[tag.toUpperCase()];
    if (!raw) return { amount: 0, type: 'Dr' as const };
    if (typeof raw === 'number') {
      const isAsset = ['BUILDING', 'MACHINERY'].includes(tag.toUpperCase());
      return { amount: raw, type: isAsset ? ('Dr' as const) : ('Cr' as const) };
    }
    return { amount: Number(raw.amount) || 0, type: (raw.type || 'Dr') as 'Dr' | 'Cr' };
  };

  // Sync opening balance inputs when selectedTag changes
  useEffect(() => {
    if (selectedTag) {
      const parsed = getParsedOpeningBal(selectedTag);
      setOpeningBalInput(parsed.amount > 0 ? parsed.amount.toString() : "");
      setOpeningTypeInput(parsed.type);
    }
  }, [selectedTag, openingBalances]);

  const handleSaveOpeningBal = async () => {
    if (!selectedTag) return;
    setIsSaving(true);
    try {
      const val = Number(openingBalInput) || 0;
      await saveTagOpeningBalance(selectedTag, val, openingTypeInput);
      window.dispatchEvent(new Event('opening_balance_updated'));
    } catch (err) {
      console.error("Error saving opening balance to cloud:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const tagSummaries = useMemo(() => {
    const summaries: Record<string, TagSummary> = {};
    const tagRegex = /#(\w+)/g;

    // Initialize standard tags so they are always visible even without transactions
    const STANDARD_TAGS = ['SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'CAPITAL', 'LIABILITIES', 'BUILDING', 'MACHINERY', 'MISCELLANEOUS', 'INTEREST', 'LEND'];
    STANDARD_TAGS.forEach(tag => {
      summaries[tag] = {
        tag,
        totalIncome: 0,
        totalExpense: 0,
        netBalance: 0,
        transactionCount: 0,
        lastUsedDate: null,
        transactions: []
      };
    });

    // Pre-initialize any other tags that have opening balances saved in the cloud
    Object.keys(openingBalances || {}).forEach(k => {
      const upperTag = k.toUpperCase();
      if (!summaries[upperTag]) {
        summaries[upperTag] = {
          tag: upperTag,
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
          transactionCount: 0,
          lastUsedDate: null,
          transactions: []
        };
      }
    });

    transactions.forEach(t => {
      const desc = t.description || "";
      const remarks = t.remarks || "";
      const combinedText = `${desc} ${remarks}`.toUpperCase();
      const entryType = (t.entryType || "").toUpperCase().trim();
      
      // 1. Extract explicit hashtags
      const explicitTags = combinedText.match(tagRegex) || [];
      const tagsToProcess = new Set<string>(explicitTags.map(tag => tag.substring(1)));

      // 2. Auto-tagging for 'Lend', 'Borrow', and 'Interest'
      if (entryType === 'LEND' || entryType === 'LEND RETURN') tagsToProcess.add('LEND');
      if (entryType === 'BORROW' || entryType === 'BORROW RETURN') tagsToProcess.add('BORROW');
      
      const adjustTypes = ['SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'CAPITAL', 'LIABILITIES', 'BUILDING', 'MACHINERY', 'MISCELLANEOUS', 'RECEIVABLE', 'PAYABLE'];
      if (adjustTypes.includes(entryType)) {
        tagsToProcess.add(entryType);
      }

      if (tagsToProcess.size === 0) return;

      tagsToProcess.forEach(tag => {
        let normalizedTag = tag.toUpperCase();
        if (normalizedTag === 'BORROW') {
          normalizedTag = 'LIABILITIES';
        }
        if (normalizedTag === 'PAYABLE' || normalizedTag === 'RECEIVABLE') {
          normalizedTag = 'INTEREST';
        }
        
        if (!summaries[normalizedTag]) {
          summaries[normalizedTag] = {
            tag: normalizedTag,
            totalIncome: 0,
            totalExpense: 0,
            netBalance: 0,
            transactionCount: 0,
            lastUsedDate: null,
            transactions: []
          };
        }

        const s = summaries[normalizedTag];
        s.transactionCount++;
        s.transactions.push(t);

        const tDate = t.date instanceof Date ? t.date : new Date(t.date);
        if (!s.lastUsedDate || tDate > s.lastUsedDate) {
          s.lastUsedDate = tDate;
        }

        const amount = Number(t.amount) || 0;
        const txType = (t.transactionType || "").toLowerCase();

        // Rule: Capital/Liabilities are Credit; others use raw transactionType
        const isCapital = normalizedTag === 'CAPITAL';
        const isLiabilities = normalizedTag === 'LIABILITIES';
        
        const isCr = (isCapital || isLiabilities) ? true : txType === 'income';

        if (isCr) {
          s.totalIncome += amount; // Credit
        } else {
          s.totalExpense += amount; // Debit
        }
        
        s.netBalance = s.totalIncome - s.totalExpense;
      });
    });

    return Object.values(summaries).sort((a, b) => b.transactionCount - a.transactionCount);
  }, [transactions]);

  const filteredSummaries = useMemo(() => {
    const list = tagSummaries.filter(s => 
      s.tag.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return list.sort((a, b) => {
      const parsedA = getParsedOpeningBal(a.tag);
      const isDrA = parsedA.type === 'Dr';
      const balA = a.netBalance + (isDrA ? -parsedA.amount : parsedA.amount);

      const parsedB = getParsedOpeningBal(b.tag);
      const isDrB = parsedB.type === 'Dr';
      const balB = b.netBalance + (isDrB ? -parsedB.amount : parsedB.amount);

      return Math.abs(balB) - Math.abs(balA);
    });
  }, [tagSummaries, searchTerm, openingBalances]);

  const selectedSummary = useMemo(() => {
    return tagSummaries.find(s => s.tag === selectedTag);
  }, [tagSummaries, selectedTag]);

  const parsedOpening = selectedTag ? getParsedOpeningBal(selectedTag) : { amount: 0, type: 'Dr' as const };

  if (selectedTag && selectedSummary) {
    const isGroupedTag = ['CAPITAL', 'LIABILITIES'].includes(selectedTag.toUpperCase());

    // Adjust totals dynamically according to Dr / Cr opening type
    const isOpeningDr = parsedOpening.type === 'Dr';
    const adjustedTotalExpense = selectedSummary.totalExpense + (isOpeningDr ? parsedOpening.amount : 0);
    const adjustedTotalIncome = selectedSummary.totalIncome + (!isOpeningDr ? parsedOpening.amount : 0);
    const adjustedNetBalance = adjustedTotalIncome - adjustedTotalExpense;

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-2">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedTag(null)}
              className="h-8 px-3 hover:bg-slate-100 font-bold uppercase tracking-wider text-[10px] border-slate-200"
            >
              <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
              Back to List
            </Button>
            <div className="h-4 w-[1px] bg-slate-300" />
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <TagIcon className="h-5 w-5 text-purple-600" />
              {selectedTag} Details
            </h2>
          </div>

          {/* Opening Balance Set Card with Dr/Cr options for ALL tag accounts */}
          <div className="flex flex-wrap items-center gap-2 bg-purple-50/50 border border-purple-200 px-3 py-1.5 rounded-lg w-full lg:w-auto shadow-sm">
            <div className="flex flex-col mr-1">
              <span className="text-[8px] font-black uppercase text-purple-800 tracking-wider">☁ Set Cloud Opening Balance</span>
              <span className="text-[7px] font-medium text-purple-500 uppercase tracking-tight">Starting Balance</span>
            </div>
            
            <div className="flex gap-2">
              {/* Type Select (Dr / Cr Toggle Buttons) */}
              <div className="flex rounded border border-purple-200 bg-white overflow-hidden h-7 shrink-0">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setOpeningTypeInput('Dr')}
                  className={cn(
                    "px-3 text-[10px] font-black uppercase transition-colors shrink-0 flex items-center justify-center",
                    openingTypeInput === 'Dr' 
                      ? "bg-rose-600 text-white font-extrabold" 
                      : "text-rose-600 hover:bg-rose-50/50 bg-white"
                  )}
                >
                  Dr
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setOpeningTypeInput('Cr')}
                  className={cn(
                    "px-3 text-[10px] font-black uppercase transition-colors border-l border-purple-200 shrink-0 flex items-center justify-center",
                    openingTypeInput === 'Cr' 
                      ? "bg-emerald-600 text-white font-extrabold" 
                      : "text-emerald-700 hover:bg-emerald-50/50 bg-white"
                  )}
                >
                  Cr
                </button>
              </div>

              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-500">₹</span>
                <Input 
                  type="number"
                  placeholder="0.00" 
                  value={openingBalInput}
                  disabled={isSaving}
                  onChange={(e) => setOpeningBalInput(e.target.value)}
                  className="pl-5 h-7 border-purple-200 bg-white font-black text-[10px] text-purple-950 focus:border-purple-400 focus:ring-0 disabled:opacity-50"
                />
              </div>
            </div>

            <Button 
              size="sm"
              onClick={handleSaveOpeningBal}
              disabled={isSaving}
              className="h-7 px-3.5 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[8px] tracking-wider rounded disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Credit</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(adjustedTotalIncome)}</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Debit</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(adjustedTotalExpense)}</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closing Balance</p>
              <p className={cn("text-2xl font-black mt-1", adjustedNetBalance >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {formatCurrency(Math.abs(adjustedNetBalance))} {adjustedNetBalance >= 0 ? 'Cr' : 'Dr'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-slate-200 shadow-sm overflow-hidden rounded-xl bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-slate-400" />
                {isGroupedTag ? `Consolidated Payee Balances: ${selectedTag}` : `Account Ledger: ${selectedTag}`}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[9px] font-bold uppercase">
                  {isGroupedTag ? 'Grouped by Payee Name' : `${selectedSummary.transactionCount + (parsedOpening.amount > 0 ? 1 : 0)} Entries`}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[15%]">Last Date</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[45%]">Payee Account</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-[15%]">Debit (Paid)</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-[15%]">Credit (Rec)</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right w-[15%]">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    if (isGroupedTag) {
                      // ── GROUPED MODE (Capital & Liabilities Accounts) ──
                      const payeeGroups: Record<string, { transactions: DisplayTransaction[]; latestDate: Date }> = {};

                      selectedSummary.transactions.forEach(t => {
                        const name = toTitleCase((t.payee || "").trim()) || "Unknown Payee";
                        const tDate = t.date instanceof Date ? t.date : new Date(t.date);

                        if (!payeeGroups[name]) {
                          payeeGroups[name] = { transactions: [], latestDate: tDate };
                        }
                        payeeGroups[name].transactions.push(t);
                        if (tDate > payeeGroups[name].latestDate) {
                          payeeGroups[name].latestDate = tDate;
                        }
                      });

                      const sortedPayeeList = Object.entries(payeeGroups)
                        .map(([name, group]) => {
                          let totalIn = 0;
                          let totalOut = 0;

                          group.transactions.forEach(t => {
                            const amount = Number(t.amount) || 0;
                            const txType = (t.transactionType || "").toLowerCase();
                            
                            const entryType = (t.entryType || "").toUpperCase().trim();
                            const isCapital = entryType === 'CAPITAL';
                            const isLiabilities = ['LIABILITIES', 'BORROW', 'BORROW RETURN'].includes(entryType);

                            const isCr = (isCapital || isLiabilities) ? true : txType === 'income';

                            if (isCr) totalIn += amount;
                            else totalOut += amount;
                          });

                          const net = totalIn - totalOut; // positive = Credit (Cr), negative = Debit (Dr)
                          return {
                            name,
                            latestDate: group.latestDate,
                            debit: net < -THRESHOLD ? Math.abs(net) : 0,
                            credit: net > THRESHOLD ? net : 0,
                            netBalance: net,
                            count: group.transactions.length
                          };
                        })
                        .filter(item => Math.abs(item.netBalance) > THRESHOLD)
                        .sort((a, b) => a.name.localeCompare(b.name));

                      if (sortedPayeeList.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="text-center py-16 text-slate-300 font-bold uppercase text-xs">
                              No Consolidated Balances Found
                            </td>
                          </tr>
                        );
                      }

                      return sortedPayeeList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-slate-600">
                            {format(item.latestDate, "dd-MM-yyyy")}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{item.name}</span>
                              <Badge className="bg-purple-100 text-purple-800 border border-purple-200 text-[8px] font-black uppercase hover:bg-purple-100">
                                {item.count} {item.count === 1 ? 'Entry' : 'Entries'}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[11px] font-black text-right text-rose-600 tabular-nums">
                            {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                          </td>
                          <td className="px-4 py-3 text-[11px] font-black text-right text-emerald-600 tabular-nums">
                            {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-[11px] font-black text-right tabular-nums",
                            item.netBalance >= 0 ? "text-emerald-700" : "text-rose-700"
                          )}>
                            {formatCurrency(Math.abs(item.netBalance))} {item.netBalance >= 0 ? 'Cr' : 'Dr'}
                          </td>
                        </tr>
                      ));

                    } else {
                      // ── STANDARD TRANSACTION-WISE MODE (Other tags) ──
                      const startBalance = isOpeningDr ? -parsedOpening.amount : parsedOpening.amount;
                      let runningBal = startBalance;
                      
                      const computedList = selectedSummary.transactions
                        .sort((a, b) => {
                          const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                          if (dateCompare !== 0) return dateCompare;
                          return (a.transactionId || '').localeCompare(b.transactionId || '');
                        })
                        .map((t) => {
                          const amount = Number(t.amount) || 0;
                          const txType = (t.transactionType || "").toLowerCase();
                          const isCr = txType === 'income';
                          
                          if (isCr) runningBal += amount;
                          else runningBal -= amount;

                          return { ...t, isIncome: isCr, runningBal };
                        })
                        .sort((a, b) => {
                           const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
                           if (dateCompare !== 0) return dateCompare;
                           return (b.transactionId || '').localeCompare(b.transactionId || '');
                        });

                      return (
                        <>
                          {computedList.map((t, idx) => (
                            <tr key={t.id || idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 text-xs font-bold text-slate-600">{format(new Date(t.date), "dd-MM-yyyy")}</td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <span>{toTitleCase(t.payee)}</span>
                                  <span className="text-[9px] font-black text-primary uppercase tracking-tighter bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{t.transactionId}</span>
                                  {t.variety && <span className="text-[9px] text-slate-400 font-medium">({t.variety})</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-rose-600 tabular-nums">
                                {!t.isIncome ? formatCurrency(t.amount) : '-'}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-emerald-600 tabular-nums">
                                {t.isIncome ? formatCurrency(t.amount) : '-'}
                              </td>
                              <td className={cn("px-4 py-3 text-[11px] font-black text-right tabular-nums", t.runningBal >= 0 ? "text-slate-900" : "text-amber-800")}>
                                {formatCurrency(Math.abs(t.runningBal))} {t.runningBal >= 0 ? 'Cr' : 'Dr'}
                              </td>
                            </tr>
                          ))}

                          {/* Chronological first row: Opening Balance */}
                          {parsedOpening.amount > 0 && (
                            <tr className="bg-purple-50/20 font-medium">
                              <td className="px-4 py-3 text-xs text-slate-400 font-semibold">—</td>
                              <td className="px-4 py-3 text-xs font-black text-purple-800 italic uppercase">Opening Balance</td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-rose-600 tabular-nums">
                                {isOpeningDr ? formatCurrency(parsedOpening.amount) : '—'}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-emerald-600 tabular-nums">
                                {!isOpeningDr ? formatCurrency(parsedOpening.amount) : '—'}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-black text-right text-rose-700 tabular-nums">
                                {formatCurrency(parsedOpening.amount)} {isOpeningDr ? 'Dr' : 'Cr'}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    }
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <TagIcon className="h-5 w-5 text-purple-600" />
            Tag Accounts
          </h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Analyze financials by custom tags (using #tag in remarks)</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search tags..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 border-slate-200 bg-white/70 backdrop-blur-sm font-bold uppercase text-xs"
          />
        </div>
      </div>

      <Card className="border border-slate-200 shadow-md overflow-hidden rounded-xl bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-800">
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 w-[30%] pl-6">Tag Name</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-center w-[15%]">Transactions</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-right w-[15%]">Turnover</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-right w-[20%]">Opening Balance</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-right w-[20%] pr-6">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.map((s) => {
                  const parsed = getParsedOpeningBal(s.tag);
                  const isDr = parsed.type === 'Dr';
                  const displayBal = s.netBalance + (isDr ? -parsed.amount : parsed.amount);
                  const turnover = s.totalIncome + s.totalExpense;

                  return (
                    <tr 
                      key={s.tag} 
                      onClick={() => setSelectedTag(s.tag)}
                      className="hover:bg-purple-50/20 cursor-pointer transition-colors group"
                    >
                      {/* Tag Name */}
                      <td className="px-5 py-3.5 text-xs font-black text-slate-800 pl-6 uppercase tracking-tight flex items-center gap-2">
                        <div className="bg-purple-50 text-purple-700 border border-purple-100 rounded-md p-1.5 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 transition-colors">
                          <TagIcon className="h-3.5 w-3.5" />
                        </div>
                        <span className="group-hover:text-purple-600 transition-colors">{s.tag}</span>
                      </td>

                      {/* Transaction Count */}
                      <td className="px-5 py-3.5 text-center text-xs">
                        <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200">
                          {s.transactionCount} {s.transactionCount === 1 ? 'Entry' : 'Entries'}
                        </Badge>
                      </td>

                      {/* Turnover */}
                      <td className="px-5 py-3.5 text-right text-xs font-bold text-slate-700 tabular-nums">
                        {formatCurrency(turnover)}
                      </td>

                      {/* Opening Balance */}
                      <td className="px-5 py-3.5 text-right text-xs tabular-nums">
                        {parsed.amount > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-extrabold text-slate-900">{formatCurrency(parsed.amount)}</span>
                            <Badge 
                              className={cn(
                                "text-[8px] font-black uppercase px-1.5 py-0.5 rounded leading-none border shadow-sm",
                                isDr 
                                  ? "bg-rose-50 border-rose-200 text-rose-700" 
                                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
                              )}
                            >
                              {parsed.type}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>

                      {/* Net Balance */}
                      <td className="px-5 py-3.5 text-right pr-6 tabular-nums text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={cn("font-black", displayBal >= 0 ? "text-emerald-600" : "text-rose-600")}>
                            {formatCurrency(Math.abs(displayBal))}
                          </span>
                          <Badge 
                            className={cn(
                              "text-[8px] font-black uppercase px-1.5 py-0.5 rounded leading-none border shadow-sm",
                              displayBal >= 0 
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                : "bg-rose-50 border-rose-200 text-rose-700"
                            )}
                          >
                            {displayBal >= 0 ? 'Cr' : 'Dr'}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredSummaries.length === 0 && (
        <div className="text-center py-20 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <TagIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Tags Found</h3>
          <p className="text-sm text-slate-500 font-medium mt-1 text-center max-w-sm mx-auto">
            Add tags to your transaction remarks using #tag (e.g. "Lunch #personal") to see them appear here.
          </p>
        </div>
      )}
    </div>
  );
};
