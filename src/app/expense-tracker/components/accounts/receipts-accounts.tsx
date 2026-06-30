"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Receipt, ArrowUpCircle, ArrowDownCircle, Info, Edit, Trash } from "lucide-react";
import { formatCurrency, cn, toTitleCase } from "@/lib/utils";
import { format } from "date-fns";
import type { DisplayTransaction } from "../../expense-tracker-client";

interface ReceiptsAccountsProps {
  transactions: DisplayTransaction[];
  onEdit: (t: DisplayTransaction) => void;
  onDelete: (t: DisplayTransaction) => void;
}

type ReceiptFilterType = "All" | "Buy" | "Sale" | "Use" | "Loss" | "Extra Receive";

const FILTER_TABS: { key: ReceiptFilterType; label: string }[] = [
  { key: "All", label: "ALL RECEIPTS" },
  { key: "Buy", label: "PURCHASE" },
  { key: "Sale", label: "SALE" },
  { key: "Use", label: "USE" },
  { key: "Loss", label: "LOSS" },
  { key: "Extra Receive", label: "EXTRA" },
];

export const ReceiptsAccounts: React.FC<ReceiptsAccountsProps> = ({
  transactions,
  onEdit,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ReceiptFilterType>("All");

  const stockTypes = ["Buy", "Sale", "Loss", "Use", "Extra Receive"];

  // Filter transactions to only those containing stock/receipt details (Case-insensitive)
  const stockTransactions = useMemo(() => {
    const uppercaseStockTypes = ["BUY", "SALE", "LOSS", "USE", "EXTRA RECEIVE"];
    return transactions.filter((t) => {
      const type = (t.entryType || t.transactionType || "").toUpperCase().trim();
      const isStock = uppercaseStockTypes.includes(type) || (t as any).variety;
      return isStock && !t.isDeleted;
    });
  }, [transactions]);

  // Apply search term and tab filter
  const filteredReceipts = useMemo(() => {
    return stockTransactions.filter((t) => {
      const type = (t.entryType || t.transactionType || "").toUpperCase().trim();
      const matchesTab = activeFilter === "All" || type === activeFilter.toUpperCase().trim();
      const cleanSearch = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !cleanSearch ||
        (t.payee || "").toLowerCase().includes(cleanSearch) ||
        (t.variety || "").toLowerCase().includes(cleanSearch) ||
        (t.transactionId || "").toLowerCase().includes(cleanSearch) ||
        (t.description || "").toLowerCase().includes(cleanSearch);

      return matchesTab && matchesSearch;
    });
  }, [stockTransactions, activeFilter, searchTerm]);

  // Dynamic Summary Metrics
  const metrics = useMemo(() => {
    let totalPurchasesQty = 0;
    let totalSalesQty = 0;
    let totalStockInQty = 0;
    let totalStockOutQty = 0;
    let totalValue = 0;

    filteredReceipts.forEach((t) => {
      const type = (t.entryType || t.transactionType || "").toUpperCase().trim();
      const qty = Number(t.quantity) || 0;
      const amount = Number(t.amount) || 0;

      // Group totals
      if (type === "BUY") {
        totalPurchasesQty += qty;
      } else if (type === "SALE") {
        totalSalesQty += qty;
      }

      // Stock In vs Stock Out
      const isIn = ["BUY", "EXTRA RECEIVE"].includes(type);
      const isOut = ["SALE", "LOSS", "USE"].includes(type);

      if (isIn) {
        totalStockInQty += qty;
      } else if (isOut) {
        totalStockOutQty += qty;
      }

      totalValue += amount;
    });

    return {
      totalPurchasesQty,
      totalSalesQty,
      totalStockInQty,
      totalStockOutQty,
      totalValue,
      count: filteredReceipts.length,
    };
  }, [filteredReceipts]);

  const getTagStyle = (entryType: string) => {
    const rawType = (entryType || "").toUpperCase().trim();
    const styles: Record<string, string> = {
      BUY: "bg-rose-50 text-rose-600 border-rose-100",
      SALE: "bg-emerald-50 text-emerald-600 border-emerald-100",
      LOSS: "bg-red-50 text-red-600 border-red-100",
      USE: "bg-amber-50 text-amber-600 border-amber-100",
      "EXTRA RECEIVE": "bg-blue-50 text-blue-600 border-blue-100",
    };
    return styles[rawType] || "bg-slate-50 text-slate-600 border-slate-100";
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header with Search and Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Stock Receipts History
          </h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
            Detailed ledger of all stock purchases, sales, losses, uses, and extra receives
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search payee, variety, id..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 border-slate-200 bg-white/70 backdrop-blur-sm font-bold uppercase text-xs"
          />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Purchase Qty</p>
            <p className="text-base font-black text-rose-600 mt-1">{metrics.totalPurchasesQty.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Sale Qty</p>
            <p className="text-base font-black text-emerald-600 mt-1">{metrics.totalSalesQty.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Stock In</p>
            <p className="text-base font-black text-blue-600 mt-1">{metrics.totalStockInQty.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Stock Out</p>
            <p className="text-base font-black text-amber-600 mt-1">{metrics.totalStockOutQty.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardContent className="p-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Value</p>
            <p className="text-base font-black text-purple-950 mt-1">{formatCurrency(metrics.totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const active = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                "px-3.5 py-1.5 text-[9px] sm:text-xs font-black rounded-md tracking-wider transition-all shadow-sm uppercase border",
                active
                  ? "bg-purple-950 text-white border-purple-950"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Receipts Table */}
      <Card className="border border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-2 border-b border-slate-100">
          <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">
            STOCK ENTRIES LIST ({metrics.count})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-4">SR NO</th>
                  <th className="py-2.5 px-4">DATE</th>
                  <th className="py-2.5 px-4">PARTY</th>
                  <th className="py-2.5 px-4">VARIETY</th>
                  <th className="py-2.5 px-4 text-right">RATE</th>
                  <th className="py-2.5 px-4 text-right text-emerald-700">QTY (CR)</th>
                  <th className="py-2.5 px-4 text-right text-rose-700">QTY (DR)</th>
                  <th className="py-2.5 px-4">UNIT</th>
                  <th className="py-2.5 px-4 text-right text-emerald-700">CREDIT (REC)</th>
                  <th className="py-2.5 px-4 text-right text-rose-700">DEBIT (PAID)</th>
                  <th className="py-2.5 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      No stock entries recorded
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((record) => {
                    const rawType = (record.entryType || record.transactionType || "").toUpperCase();
                    const isCredit = ['BUY', 'INCOME', 'EXTRA RECEIVE'].includes(rawType);
                    const qty = record.quantity || 0;

                    return (
                      <tr
                        key={record.id}
                        className="border-b border-slate-100 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-black text-purple-700 font-mono">
                          {record.transactionId}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-600">
                          {record.date}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {toTitleCase(record.payee || "")}
                        </td>
                        <td className="py-2.5 px-4">
                          {record.variety || "-"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {record.rate || "-"}
                        </td>
                        {/* QTY columns */}
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                          {isCredit && qty > 0 ? qty.toLocaleString() : "-"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                          {!isCredit && qty > 0 ? qty.toLocaleString() : "-"}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {(record as any).unit || (record.id.startsWith("SUP-") ? "Qtl" : "Bag")}
                        </td>
                        {/* Amount columns */}
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700 font-mono">
                          {isCredit ? formatCurrency(record.amount || 0) : "-"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-rose-600 font-mono">
                          {!isCredit ? formatCurrency(record.amount || 0) : "-"}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEdit(record)}
                              className="h-7 px-2 text-purple-700 hover:text-purple-900 hover:bg-purple-50"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(record)}
                              className="h-7 px-2 text-rose-600 hover:text-rose-900 hover:bg-rose-50"
                            >
                              <Trash className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
