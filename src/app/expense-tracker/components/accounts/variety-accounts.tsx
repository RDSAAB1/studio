import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  History, 
  Package, 
  ChevronRight, 
  Calendar
} from 'lucide-react';
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { format } from "date-fns";
import { getVarietyOpeningStocks, saveVarietyOpeningStock } from "@/lib/firestore/settings";
import type { DisplayTransaction } from "../../expense-tracker-client";

interface VarietySummary {
  name: string;
  totalQtyIn: number;
  totalQtyOut: number;
  currentStock: number;
  totalAmountIn: number;
  totalAmountOut: number;
  transactionCount: number;
  lastTransactionDate: Date | null;
  transactions: DisplayTransaction[];
}

interface VarietyAccountsProps {
  transactions: DisplayTransaction[];
  dbVarieties?: { id: string; name: string }[];
}

export const VarietyAccounts: React.FC<VarietyAccountsProps> = ({ transactions, dbVarieties }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null);

  const [openingStocks, setOpeningStocks] = useState<Record<string, { rate: number; quantity: number; amount: number }>>({});
  const [openingQtyInput, setOpeningQtyInput] = useState("");
  const [openingRateInput, setOpeningRateInput] = useState("");
  const [openingAmtInput, setOpeningAmtInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load cloud opening stocks
  const loadStocks = async () => {
    try {
      const data = await getVarietyOpeningStocks();
      setOpeningStocks(data || {});
    } catch (e) {
      console.error("Error loading variety opening stocks from cloud:", e);
    }
  };

  useEffect(() => {
    loadStocks();
  }, []);

  // Sync inputs when selected variety changes
  useEffect(() => {
    if (selectedVariety) {
      const stock = openingStocks[selectedVariety.toUpperCase().trim()] || { rate: 0, quantity: 0, amount: 0 };
      setOpeningQtyInput(stock.quantity > 0 ? stock.quantity.toString() : "");
      setOpeningRateInput(stock.rate > 0 ? stock.rate.toString() : "");
      setOpeningAmtInput(stock.amount > 0 ? stock.amount.toString() : "");
    }
  }, [selectedVariety, openingStocks]);

  const handleQtyChange = (val: string) => {
    setOpeningQtyInput(val);
    const qty = Number(val) || 0;
    const rate = Number(openingRateInput) || 0;
    setOpeningAmtInput(qty > 0 && rate > 0 ? (qty * rate).toString() : "");
  };

  const handleRateChange = (val: string) => {
    setOpeningRateInput(val);
    const rate = Number(val) || 0;
    const qty = Number(openingQtyInput) || 0;
    setOpeningAmtInput(qty > 0 && rate > 0 ? (qty * rate).toString() : "");
  };

  const handleSaveOpeningStock = async () => {
    if (!selectedVariety) return;
    setIsSaving(true);
    try {
      const qty = Number(openingQtyInput) || 0;
      const rate = Number(openingRateInput) || 0;
      const amount = Number(openingAmtInput) || (qty * rate);
      await saveVarietyOpeningStock(selectedVariety, { rate, quantity: qty, amount });
      await loadStocks();
    } catch (err) {
      console.error("Error saving variety opening stock:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const varietySummaries = useMemo(() => {
    const summaries: Record<string, VarietySummary> = {};

    // 1. Pre-initialize summaries with all database-registered varieties
    (dbVarieties || []).forEach(v => {
      if (v.name) {
        const name = toTitleCase(v.name.trim());
        summaries[name] = {
          name,
          totalQtyIn: 0,
          totalQtyOut: 0,
          currentStock: 0,
          totalAmountIn: 0,
          totalAmountOut: 0,
          transactionCount: 0,
          lastTransactionDate: null,
          transactions: []
        };
      }
    });

    // 2. Pre-initialize summaries with any varieties that already have opening stock configured
    Object.keys(openingStocks || {}).forEach(k => {
      const name = toTitleCase(k.trim());
      if (!summaries[name]) {
        summaries[name] = {
          name,
          totalQtyIn: 0,
          totalQtyOut: 0,
          currentStock: 0,
          totalAmountIn: 0,
          totalAmountOut: 0,
          transactionCount: 0,
          lastTransactionDate: null,
          transactions: []
        };
      }
    });

    const linkedIds = new Set<string>();
    transactions.forEach(t => {
      if (t.id.startsWith('INV-')) {
        const anyT = t as any;
        if (anyT.expenseTransactionId) linkedIds.add(anyT.expenseTransactionId);
        if (anyT.incomeTransactionId) linkedIds.add(anyT.incomeTransactionId);
      }
    });

    transactions.forEach(t => {
      if (!t.variety) return;
      
      // Skip manual tracker entries that are already linked to an inventory record to avoid double counting
      if (!t.id.startsWith('INV-') && linkedIds.has(t.id)) return;

      const variety = toTitleCase(t.variety.trim());
      
      if (!summaries[variety]) {
        summaries[variety] = {
          name: variety,
          totalQtyIn: 0,
          totalQtyOut: 0,
          currentStock: 0,
          totalAmountIn: 0,
          totalAmountOut: 0,
          transactionCount: 0,
          lastTransactionDate: null,
          transactions: []
        };
      }

      const s = summaries[variety];
      s.transactionCount++;
      s.transactions.push(t);

      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      if (!s.lastTransactionDate || tDate > s.lastTransactionDate) {
        s.lastTransactionDate = tDate;
      }

      const qty = Number(t.quantity) || 0;
      const amount = Number(t.amount) || 0;

      // Group by Entry Type logic
      const entryType = t.entryType || t.transactionType;
      
      // EXPENSE (Debit) = Buy = In (+)
      // INCOME (Credit) = Sale = Out (-)
      const isIn = ['Buy', 'Expense', 'Extra Receive', 'Lend Return', 'Borrow'].includes(entryType);
      const isOut = ['Sale', 'Income', 'Loss', 'Use', 'Lend', 'Borrow Return'].includes(entryType);

      if (isIn) {
        s.totalQtyIn += qty;
        s.totalAmountIn += amount;
      } else if (isOut) {
        s.totalQtyOut += qty;
        s.totalAmountOut += amount;
      }
      
      s.currentStock = s.totalQtyIn - s.totalQtyOut;
    });

    return Object.values(summaries).sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  const filteredSummaries = useMemo(() => {
    const list = varietySummaries.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return list.sort((a, b) => {
      const opA = openingStocks[a.name.toUpperCase().trim()] || { rate: 0, quantity: 0, amount: 0 };
      const valA = Math.abs(a.totalAmountOut - (a.totalAmountIn + opA.amount));

      const opB = openingStocks[b.name.toUpperCase().trim()] || { rate: 0, quantity: 0, amount: 0 };
      const valB = Math.abs(b.totalAmountOut - (b.totalAmountIn + opB.amount));

      return valB - valA;
    });
  }, [varietySummaries, searchTerm, openingStocks]);

  const selectedSummary = useMemo(() => {
    return varietySummaries.find(s => s.name === selectedVariety);
  }, [varietySummaries, selectedVariety]);

  if (selectedVariety && selectedSummary) {
    const opStock = openingStocks[selectedVariety.toUpperCase().trim()] || { rate: 0, quantity: 0, amount: 0 };
    
    // Adjusted dynamic metrics including opening stock
    const adjustedTotalQtyIn = selectedSummary.totalQtyIn + opStock.quantity;
    const adjustedCurrentStock = adjustedTotalQtyIn - selectedSummary.totalQtyOut;
    const adjustedTotalAmountIn = selectedSummary.totalAmountIn + opStock.amount;

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-2">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedVariety(null)}
              className="h-8 px-2 hover:bg-slate-100 font-bold uppercase tracking-wider text-[10px]"
            >
              <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
              Back to List
            </Button>
            <div className="h-4 w-[1px] bg-slate-300" />
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {selectedVariety} Account
            </h2>
          </div>

          {/* Opening Stock Panel */}
          <div className="flex flex-wrap items-center gap-2 bg-purple-50/50 border border-purple-200 px-3 py-1.5 rounded-lg w-full md:w-auto shadow-sm">
            <div className="flex flex-col mr-1">
              <span className="text-[8px] font-black uppercase text-purple-800 tracking-wider">📦 Set Cloud Opening Stock</span>
              <span className="text-[7px] font-medium text-purple-500 uppercase tracking-tight">Starting Inventory</span>
            </div>
            
            <div className="flex gap-2">
              <div className="relative w-20">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-purple-400">Qty</span>
                <Input 
                  type="number"
                  placeholder="Quantity" 
                  value={openingQtyInput}
                  disabled={isSaving}
                  onChange={(e) => handleQtyChange(e.target.value)}
                  className="pl-6 pr-1 h-7 border-purple-200 bg-white font-black text-[10px] text-purple-950 focus:border-purple-400 focus:ring-0 disabled:opacity-50"
                />
              </div>
              <div className="relative w-20">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-purple-400">Rate</span>
                <Input 
                  type="number"
                  placeholder="Rate" 
                  value={openingRateInput}
                  disabled={isSaving}
                  onChange={(e) => handleRateChange(e.target.value)}
                  className="pl-6 pr-1 h-7 border-purple-200 bg-white font-black text-[10px] text-purple-950 focus:border-purple-400 focus:ring-0 disabled:opacity-50"
                />
              </div>
              <div className="relative w-24">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-purple-400">Amt</span>
                <Input 
                  type="number"
                  placeholder="Amount" 
                  value={openingAmtInput}
                  disabled={isSaving}
                  onChange={(e) => setOpeningAmtInput(e.target.value)}
                  className="pl-6 pr-1 h-7 border-purple-200 bg-white font-black text-[10px] text-purple-950 focus:border-purple-400 focus:ring-0 disabled:opacity-50"
                />
              </div>
            </div>

            <Button 
              size="sm"
              onClick={handleSaveOpeningStock}
              disabled={isSaving}
              className="h-7 px-3.5 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[8px] tracking-wider rounded disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Receipts (In)</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{adjustedTotalQtyIn.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Issues (Out)</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{selectedSummary.totalQtyOut.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closing Stock</p>
              <p className={cn("text-2xl font-black mt-1", adjustedCurrentStock >= 0 ? "text-blue-700" : "text-amber-700")}>
                {adjustedCurrentStock.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Value</p>
              <p className={cn(
                  "text-2xl font-black mt-1",
                  adjustedTotalAmountIn >= selectedSummary.totalAmountOut ? "text-rose-700" : "text-emerald-700"
              )}>
                {formatCurrency(Math.abs(adjustedTotalAmountIn - selectedSummary.totalAmountOut))}
                <span className="text-xs ml-2 opacity-70 font-bold">{adjustedTotalAmountIn >= selectedSummary.totalAmountOut ? '(DEBIT)' : '(CREDIT)'}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-slate-200 shadow-sm overflow-hidden rounded-xl bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-slate-400" />
                Stock Ledger: {selectedVariety}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[9px] font-bold uppercase">{selectedSummary.transactionCount + (opStock.quantity > 0 ? 1 : 0)} Entries</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Particulars</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">In (Rec)</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Out (Issue)</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Bal (Qty)</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Rate</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Value (Amt)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    let runningQty = opStock.quantity;
                    const list = selectedSummary.transactions
                      .sort((a, b) => {
                         const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                         if (dateCompare !== 0) return dateCompare;
                         return (a.transactionId || '').localeCompare(b.transactionId || '');
                      })
                      .map((t) => {
                        const qty = Number(t.quantity) || 0;
                        const rawType = (t.entryType || t.transactionType || "").toUpperCase();
                        const isIn = ['BUY', 'INCOME', 'EXTRA RECEIVE', 'LEND RETURN', 'BORROW'].includes(rawType);
                        
                        if (isIn) runningQty += qty;
                        else runningQty -= qty;

                        return { ...t, isIn, runningQty };
                      })
                      .sort((a, b) => {
                         const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
                         if (dateCompare !== 0) return dateCompare;
                         return (b.transactionId || '').localeCompare(b.transactionId || '');
                      });

                    return (
                      <>
                        {list.map((t, idx) => (
                          <tr key={t.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-xs font-bold text-slate-600">
                              {format(new Date(t.date), "dd-MM-yyyy")}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{toTitleCase(t.payee)}</span>
                                <span className="text-[9px] font-black text-primary uppercase tracking-tighter bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{t.transactionId}</span>
                                <span className="text-[9px] text-slate-400 font-medium">{(t as any).remarks || t.description || ''}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[11px] font-black text-right text-emerald-600 tabular-nums">
                              {t.isIn ? t.quantity.toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-[11px] font-black text-right text-rose-600 tabular-nums">
                              {!t.isIn ? t.quantity.toLocaleString() : '-'}
                            </td>
                            <td className={cn("px-4 py-3 text-[11px] font-black text-right tabular-nums", t.runningQty >= 0 ? "text-blue-700" : "text-amber-700")}>
                              {t.runningQty.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-[10px] font-bold text-right text-slate-500 tabular-nums">
                              {formatCurrency(t.rate || 0)}
                            </td>
                            <td className={cn(
                                "px-4 py-3 text-[11px] font-black text-right tabular-nums",
                                t.isIn ? "text-rose-700" : "text-emerald-700"
                              )}
                            >
                              {formatCurrency(t.amount)} <span className="text-[9px] opacity-70 ml-1">{t.isIn ? 'Dr' : 'Cr'}</span>
                            </td>
                          </tr>
                        ))}

                        {/* Chronological First: Opening Stock */}
                        {opStock.quantity > 0 && (
                          <tr className="bg-purple-50/20 font-medium">
                            <td className="px-4 py-3 text-xs text-slate-400 font-semibold">—</td>
                            <td className="px-4 py-3 text-xs font-black text-purple-800 italic uppercase">Opening Stock</td>
                            <td className="px-4 py-3 text-[11px] font-black text-right text-emerald-600 tabular-nums">{opStock.quantity.toLocaleString()}</td>
                            <td className="px-4 py-3 text-[11px] font-black text-right text-slate-300">—</td>
                            <td className="px-4 py-3 text-[11px] font-black text-right text-blue-700 tabular-nums">{opStock.quantity.toLocaleString()}</td>
                            <td className="px-4 py-3 text-[10px] font-bold text-right text-slate-500 tabular-nums">{formatCurrency(opStock.rate)}</td>
                            <td className="px-4 py-3 text-[11px] font-black text-right text-rose-700 tabular-nums">{formatCurrency(opStock.amount)} <span className="text-[9px] opacity-70 ml-1">Dr</span></td>
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
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Variety Accounts
          </h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Manage inventory and financials by variety</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search variety..." 
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
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 w-[25%] pl-6">Variety Name</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-center w-[10%]">Transactions</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-right w-[20%]">Opening Stock</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-right w-[15%]">Receipts / Issues</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-right w-[15%]">Closing Stock</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 text-right w-[15%] pr-6">Net Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.map((s) => {
                  const opStock = openingStocks[s.name.toUpperCase().trim()] || { rate: 0, quantity: 0, amount: 0 };
                  const displayQty = s.currentStock + opStock.quantity;
                  const displayVal = Math.abs(s.totalAmountOut - (s.totalAmountIn + opStock.amount));
                  const isDebitVal = (s.totalAmountIn + opStock.amount) >= s.totalAmountOut;

                  return (
                    <tr 
                      key={s.name} 
                      onClick={() => setSelectedVariety(s.name)}
                      className="hover:bg-purple-50/20 cursor-pointer transition-colors group"
                    >
                      {/* Variety Name */}
                      <td className="px-5 py-3.5 text-xs font-black text-slate-800 pl-6 uppercase tracking-tight flex items-center gap-2">
                        <div className="bg-purple-50 text-purple-700 border border-purple-100 rounded-md p-1.5 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 transition-colors">
                          <Package className="h-3.5 w-3.5" />
                        </div>
                        <span className="group-hover:text-purple-600 transition-colors">{s.name}</span>
                      </td>

                      {/* Transactions */}
                      <td className="px-5 py-3.5 text-center text-xs">
                        <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200">
                          {s.transactionCount} {s.transactionCount === 1 ? 'Entry' : 'Entries'}
                        </Badge>
                      </td>

                      {/* Opening Stock */}
                      <td className="px-5 py-3.5 text-right text-xs tabular-nums">
                        {opStock.quantity > 0 ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-extrabold text-slate-900">{opStock.quantity.toLocaleString()} Qty</span>
                            <span className="text-[9px] text-slate-400 font-bold">@ {formatCurrency(opStock.rate)} ({formatCurrency(opStock.amount)})</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>

                      {/* Receipts / Issues */}
                      <td className="px-5 py-3.5 text-right text-xs tabular-nums font-bold">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-emerald-600">In: {s.totalQtyIn.toLocaleString()}</span>
                          <span className="text-rose-600">Out: {s.totalQtyOut.toLocaleString()}</span>
                        </div>
                      </td>

                      {/* Closing Stock */}
                      <td className="px-5 py-3.5 text-right text-xs tabular-nums font-black">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={cn("text-xs font-black", displayQty >= 0 ? "text-blue-700" : "text-amber-700")}>
                            {displayQty.toLocaleString()}
                          </span>
                          <Badge 
                            className={cn(
                              "text-[8px] font-black uppercase px-1.5 py-0.5 rounded leading-none border shadow-sm",
                              displayQty >= 0 
                                ? "bg-blue-50 border-blue-200 text-blue-700" 
                                : "bg-amber-50 border-amber-200 text-amber-700"
                            )}
                          >
                            Qty
                          </Badge>
                        </div>
                      </td>

                      {/* Net Value */}
                      <td className="px-5 py-3.5 text-right pr-6 tabular-nums text-xs font-black">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={cn(isDebitVal ? "text-rose-700" : "text-emerald-700")}>
                            {formatCurrency(displayVal)}
                          </span>
                          <Badge 
                            className={cn(
                              "text-[8px] font-black uppercase px-1.5 py-0.5 rounded leading-none border shadow-sm",
                              isDebitVal 
                                ? "bg-rose-50 border-rose-200 text-rose-700" 
                                : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            )}
                          >
                            {isDebitVal ? 'Dr' : 'Cr'}
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
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Varieties Found</h3>
          <p className="text-sm text-slate-500 font-medium mt-1">Try a different search term or add new transactions.</p>
        </div>
      )}
    </div>
  );
};
