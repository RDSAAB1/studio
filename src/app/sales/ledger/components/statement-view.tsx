import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Download, Printer, Loader2 } from "lucide-react";
import { formatStatementDate, formatCurrency } from "../utils";
import type { StatementRow } from "../constants";

interface StatementViewProps {
  statementStart: string;
  setStatementStart: (val: string) => void;
  statementEnd: string;
  setStatementEnd: (val: string) => void;
  loading: boolean;
  data: StatementRow[];
  error: string | null;
  onGenerate: () => void;
  onExport: () => void;
  onPrint: () => void;
  totals: any;
}

export const StatementView: React.FC<StatementViewProps> = ({
  statementStart,
  setStatementStart,
  statementEnd,
  setStatementEnd,
  loading,
  data,
  error,
  onGenerate,
  onExport,
  onPrint,
  totals,
}) => {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm overflow-hidden bg-muted/20">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">From Date</span>
              <SmartDatePicker value={statementStart} onChange={setStatementStart} className="h-10 bg-background/50 border-0 shadow-none ring-1 ring-border/50" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">To Date</span>
              <SmartDatePicker value={statementEnd} onChange={setStatementEnd} className="h-10 bg-background/50 border-0 shadow-none ring-1 ring-border/50" />
            </div>
            <Button onClick={onGenerate} disabled={loading} className="h-10 px-8 shadow-md hover:shadow-lg transition-all rounded-full font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Statement
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="p-4 text-center text-rose-600 font-medium">{error}</CardContent>
        </Card>
      )}

      {data.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight text-foreground/80 flex items-center gap-2">
              Daily Summaries
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{data.length} days</span>
            </h3>
            <div className="flex items-center gap-2">
              <Button onClick={onExport} variant="outline" size="sm" className="h-8 gap-2 rounded-full border-border/50 shadow-sm hover:shadow-md transition-all">
                <Download className="h-3.5 w-3.5" /> Export Excel
              </Button>
              <Button onClick={onPrint} variant="outline" size="sm" className="h-8 gap-2 rounded-full border-border/50 shadow-sm hover:shadow-md transition-all">
                <Printer className="h-3.5 w-3.5" /> Print Statement
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/50">
                    <th className="px-3 py-3 text-left font-bold w-[120px]">Date</th>
                    <th className="px-3 py-3 text-right font-bold w-[130px]">Supplier Cash</th>
                    <th className="px-3 py-3 text-right font-bold w-[130px]">Supplier RTGS</th>
                    <th className="px-3 py-3 text-right font-bold w-[130px]">Gov Distrib.</th>
                    <th className="px-3 py-3 text-right font-bold w-[130px]">Sup. Payments</th>
                    <th className="px-3 py-3 text-right font-bold w-[130px]">Expenses</th>
                    <th className="px-3 py-3 text-right font-bold w-[130px]">Income</th>
                    <th className="px-3 py-3 text-right font-bold w-[130px]">S/E Cash</th>
                    <th className="px-3 py-3 text-right font-bold bg-accent/20 w-[150px]">Net Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data.map((row) => (
                    <tr key={row.date} className="hover:bg-accent/5 transition-colors group">
                      <td className="px-3 py-3 font-medium whitespace-nowrap text-muted-foreground">{formatStatementDate(row.date)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-foreground/70">₹{formatCurrency(row.supplierCash)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-foreground/70">₹{formatCurrency(row.supplierRtgs)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-foreground/70">₹{formatCurrency(row.govDistribution)}</td>
                      <td className="px-3 py-3 text-right font-mono font-black text-rose-500/80">₹{formatCurrency(row.supplierPayments)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-foreground/70">₹{formatCurrency(row.expenses)}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-emerald-500/80">₹{formatCurrency(row.incomes)}</td>
                      <td className="px-3 py-3 text-right font-mono font-black text-foreground">₹{formatCurrency(row.seCash)}</td>
                      <td className="px-3 py-3 text-right font-mono font-black text-primary bg-primary/5">₹{formatCurrency(row.netTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-primary/5 border-t-2 border-primary/20">
                  <tr className="font-black text-xs">
                    <td className="px-3 py-4 uppercase tracking-wider text-primary/70">Grand Totals</td>
                    <td className="px-3 py-4 text-right">₹{formatCurrency(totals.supplierCash)}</td>
                    <td className="px-3 py-4 text-right">₹{formatCurrency(totals.supplierRtgs)}</td>
                    <td className="px-3 py-4 text-right">₹{formatCurrency(totals.govDistribution)}</td>
                    <td className="px-3 py-4 text-right text-rose-500">₹{formatCurrency(totals.supplierPayments)}</td>
                    <td className="px-3 py-4 text-right">₹{formatCurrency(totals.expenses)}</td>
                    <td className="px-3 py-4 text-right text-emerald-500">₹{formatCurrency(totals.incomes)}</td>
                    <td className="px-3 py-4 text-right">₹{formatCurrency(totals.seCash)}</td>
                    <td className="px-3 py-4 text-right text-primary text-sm shadow-inner bg-primary/10">₹{formatCurrency(totals.netTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {data.length === 0 && !loading && (
        <Card className="border-dashed h-[400px] flex flex-col items-center justify-center bg-muted/10 opacity-60">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Loader2 className="h-10 w-10 text-muted-foreground/30 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-muted-foreground italic">
              No statement generated for the selected range. Click "Generate" to fetch data.
            </p>
        </Card>
      )}
    </div>
  );
};
