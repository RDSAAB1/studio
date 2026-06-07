"use client";
import { Scale, FileText, Banknote, TrendingUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { Customer, Payment } from "@/lib/definitions";

interface SupplierSummary {
  totalGrossWeight: number;
  totalTeirWeight: number;
  totalFinalWeight: number;
  totalKartaWeight: number;
  totalNetWeight: number;
  totalAmount: number;
  totalKartaAmount: number;
  totalLabouryAmount: number;
  totalKanta: number;
  totalBrokerage?: number;
  totalBags?: number;
  totalBagWeightKg?: number;
  averageBagWeightKg?: number;
  totalBagAmount?: number;
  totalBagWeightDeductionAmount?: number;
  totalTransportAmount?: number;
  totalEntryCdAmount?: number;
  totalOriginalAmount: number;
  totalFinalAmount?: number;
  totalPaid: number;
  totalCdAmount: number;
  totalCashPaid: number;
  totalRtgsPaid: number;
  totalOutstanding: number;
  ledgerCreditAmount?: number;
  ledgerDebitAmount?: number;
  averageRate: number;
  minRate: number;
  maxRate: number;
  averageKartaPercentage: number;
  averageLabouryRate: number;
  averageOriginalPrice?: number;
  totalBaseOriginalAmount?: number;
  totalGovExtraAmount?: number;
  allTransactions?: Customer[];
  allPayments?: Payment[];
  outstandingEntryIds?: string[];
}

interface SupplierSummaryCardsProps {
  summary: SupplierSummary;
  action?: React.ReactNode;
  /** "dashboard" = pic wala layout (top 4 cards, middle 3 panels, bottom 3 panels); "default" = combined tiles */
  variant?: "default" | "dashboard";
  /** When "customer", labels show Total Receivable (incl. Advance Freight) */
  type?: "supplier" | "customer";
}

// Helper functions for formatting
const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatWeightLocal = (value: number | string | null | undefined) => {
  return `${toNumber(value).toFixed(2)} kg`;
};

const formatPercentageLocal = (value: number | string | null | undefined) => {
  return `${toNumber(value).toFixed(2)}%`;
};

const formatRateLocal = (value: number | string | null | undefined) => {
  const numericValue = toNumber(value);
  return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDecimalLocal = (value: number | string | null | undefined) => {
  return toNumber(value).toFixed(2);
};

function SummaryGroup({
  title,
  children,
  className,
  tone = "neutral",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "info" | "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "info"
      ? "bg-slate-100 text-slate-900 border-slate-200"
      : tone === "success"
        ? "bg-emerald-500/10 text-emerald-950 border-emerald-500/20"
        : tone === "danger"
          ? "bg-rose-500/10 text-rose-950 border-rose-500/20"
          : tone === "warning"
            ? "bg-amber-500/10 text-amber-950 border-amber-500/20"
            : "bg-slate-100 text-slate-950 border-slate-200";
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
            toneClass
          )}
        >
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName,
  labelClassName,
  size = "md",
  indent = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
  labelClassName?: string;
  size?: "sm" | "md";
  indent?: boolean;
}) {
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  return (
    <div className={cn("grid grid-cols-[1fr_auto] items-baseline gap-2", indent && "pl-2")}>
      <div className={cn("!text-black !opacity-100 leading-tight", textSize, labelClassName)}>{label}</div>
      <div
        className={cn(
          "text-black !opacity-100 text-right font-semibold tabular-nums leading-tight min-w-[84px]",
          textSize,
          valueClassName
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryTopMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col items-end leading-none">
      <div className="text-[10px] font-medium text-slate-600">{label}</div>
      <div className={cn("text-[13px] font-semibold tabular-nums text-slate-900", valueClassName)}>{value}</div>
    </div>
  );
}

function StatementMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  const computedValueClassName = valueClassName ?? "text-slate-900";

  const displayLabel =
    label === "Outstanding Entries"
      ? "Entries"
      : label === "Avg Original"
        ? "Avg Orig"
        : label === "Ledger Net"
          ? "Ledg Net"
      : label === "Laboury Rate"
        ? "Laboury Rt"
        : label === "Deduction %"
          ? "Deduct %"
          : label === "Karta %" || label === "Karta @%"
            ? "Karta @%"
            : label === "Kanta + Other"
            ? "Kanta+Oth"
            : label === "Adjusted"
              ? "Adj. Original"
              : label === "Base"
                ? "Base Original"
                : label === "Gov Extra"
                  ? "Gov Extra"
                  : label;
  return (
    <div className="flex items-center justify-between gap-1 supplier-summary-metric-row">
      <div
        className="min-w-0 truncate text-[10px] font-medium text-slate-600 leading-tight"
        title={label}
      >
        {displayLabel}
      </div>
      <div
        className={cn(
          "text-right text-[10px] font-semibold tabular-nums leading-tight whitespace-nowrap",
          computedValueClassName
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* Flat section - no nested card, just content */
function StatementPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 p-1", className)}>
      {title ? (
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[9px] font-bold tracking-wide uppercase text-slate-700">{title}</div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* Flat tile - no card styling, just header + content */
function StatementTile({
  title,
  value,
  icon,
  valueClassName,
  iconWrapClassName,
  className,
  children,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  valueClassName?: string;
  iconWrapClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 overflow-hidden flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2 px-1.5 py-1 border-b border-border/40 flex-shrink-0">
        <div className="flex min-w-0 items-center gap-1.5 shrink-0">
          <div className={cn("grid place-items-center size-4 rounded shrink-0 bg-[hsl(var(--primary)/0.10)]", iconWrapClassName)}>
            {icon}
          </div>
          <div className="min-w-0 truncate text-[10px] font-bold tracking-wide uppercase text-slate-800">
            {title}
          </div>
        </div>
        <div className={cn("text-[11px] font-bold tabular-nums text-slate-900 text-right min-w-0 truncate", valueClassName)}>{value}</div>
      </div>
      {children ? <div className="px-1.5 py-1 flex-1 min-h-0">{children}</div> : null}
    </div>
  );
}

export function SupplierSummaryCards({ summary, action, variant = "default", type: summaryType }: SupplierSummaryCardsProps) {
  const isCustomerSummary = (summaryType as string) === "customer";
  const totalDeductions =
    isCustomerSummary
      ? (summary.totalKartaAmount || 0) +
        (summary.totalBagWeightDeductionAmount || 0) +
        (summary.totalEntryCdAmount || 0) +
        (summary.totalTransportAmount || 0) +
        (summary.totalKanta || 0) +
        (summary.totalBrokerage || 0)
      : (summary.totalKartaAmount || 0) +
        (summary.totalLabouryAmount || 0) +
        (summary.totalKanta || 0) +
        (summary.totalBrokerage || 0);

  const baseOriginalAmount = summary.totalBaseOriginalAmount ?? summary.totalOriginalAmount ?? 0;
  const govExtraAmount = summary.totalGovExtraAmount ?? 0;

  const transactionsCount = summary.allTransactions?.length || 0;
  const outstandingEntriesCount = summary.outstandingEntryIds?.length || 0;
  const paidEntriesCount = Math.max(0, transactionsCount - outstandingEntriesCount);

  const govPaid = (summary.allPayments || [])
    .filter((p: Payment) => {
      const receiptType = ((p as any).receiptType || "").trim();
      return receiptType === "Gov." || receiptType.toLowerCase() === "gov" || receiptType.toLowerCase().startsWith("gov");
    })
    .reduce((sum: number, p: Payment) => {
      const matchingPaidFor =
        p.paidFor?.filter((pf) => (summary.allTransactions || []).some((t: Customer) => t.srNo === pf.srNo)) || [];
      const govPaidForThisPayment = matchingPaidFor.reduce((paymentSum, pf) => paymentSum + (pf.amount || 0), 0);
      return sum + govPaidForThisPayment;
    }, 0);

  const grossWeight = summary.totalGrossWeight || 0;
  const teirWeight = summary.totalTeirWeight || 0;
  const minRate = summary.minRate || 0;
  const maxRate = summary.maxRate || 0;
  const rateSpread = Math.max(0, maxRate - minRate);
  const totalPaid = summary.totalPaid || 0;
  const cashPaid = summary.totalCashPaid || 0;
  const rtgsPaid = summary.totalRtgsPaid || 0;
  const ledgerPaid = isCustomerSummary
    ? (summary.ledgerCreditAmount || 0)
    : (summary.ledgerDebitAmount || 0); // ledger Debit = supplier payment side, ledger Credit = customer payment side
  const paidShareDenom = totalPaid > 0 ? totalPaid : 1;
  const cashPct = Math.max(0, Math.min(100, (cashPaid / paidShareDenom) * 100));
  const rtgsPct = Math.max(0, Math.min(100, (rtgsPaid / paidShareDenom) * 100));
  const govPct = Math.max(0, Math.min(100, (govPaid / paidShareDenom) * 100));

  const netLedgerImpact = (summary.ledgerDebitAmount || 0) - (summary.ledgerCreditAmount || 0);
  const isGoodImpact = isCustomerSummary
    ? netLedgerImpact <= 0
    : netLedgerImpact >= 0;
  const impactColorClass = isGoodImpact ? "text-emerald-700" : "text-rose-700";
  // Net Bill = Base Original + Gov Extra + Ledger Charge (increases outstanding)
  const netBillAmount = isCustomerSummary
    ? baseOriginalAmount + govExtraAmount + (summary.ledgerDebitAmount || 0)
    : baseOriginalAmount + govExtraAmount + (summary.ledgerCreditAmount || 0);
  const totalBagWeightQtl = (summary.totalBagWeightKg || 0) / 100;

  // Compact, modern card style – subtle borders, minimal shadow
  const card3d =
    "rounded-md border border-slate-200 bg-white p-2.5 shadow-sm";

  if (variant === "dashboard") {
    // If it's a customer, we simplify the dashboard summary since most info is in the sticky total row of the transaction table
    if (isCustomerSummary) {
      return (
        <div className="w-full min-w-0 overflow-hidden rounded-md bg-slate-50 border border-slate-200 px-2 py-1 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            {/* Left: Title & Navigation Placeholder */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Scale size={10} className="text-primary" />
                </div>
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight whitespace-nowrap">Customer Overview</span>
              </div>
              
              <Separator orientation="vertical" className="h-4 bg-slate-300" />
              
              {/* Metrics - Inline */}
              <div className="flex items-center gap-x-5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Status:</span>
                  <span className="text-[10px] font-black text-slate-900">{paidEntriesCount}P / {transactionsCount}T</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Ledger:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[10px] font-black", impactColorClass)}>
                      {formatCurrency(netLedgerImpact)}
                    </span>
                    <span className="text-[8px] text-slate-400 font-bold">
                      ({formatCurrency(summary.ledgerCreditAmount || 0)}|{formatCurrency(summary.ledgerDebitAmount || 0)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Breakdown:</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="size-1 rounded-full bg-emerald-500" />
                      <span className="text-[9px] font-bold text-slate-700">C: <span className="text-emerald-700">{formatCurrency(cashPaid)}</span></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="size-1 rounded-full bg-violet-500" />
                      <span className="text-[9px] font-bold text-slate-700">R: <span className="text-violet-700">{formatCurrency(rtgsPaid)}</span></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="size-1 rounded-full bg-indigo-500" />
                      <span className="text-[9px] font-bold text-slate-700">L: <span className="text-indigo-700">{formatCurrency(ledgerPaid)}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right: Actions */}
            {action && <div className="flex-shrink-0">{action}</div>}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-0.5 w-full min-w-0 overflow-hidden rounded-md bg-[#f5f5f7] p-2.5 sm:p-3 supplier-summary-dashboard-root">
        {action ? <div className="flex items-center justify-end pb-2">{action}</div> : null}
        
        {/* Main Stats Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto mb-4">
          <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200 w-[180px]">Summary Category</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200 w-[160px]">Weight Details</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200 w-[180px]">Amount Details</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200 w-[180px]">Deductions</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200 w-[180px]">Payment Status</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200 w-[160px]">Ledger Impact</th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 w-[160px]">Entry Stats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-slate-50/30 transition-colors">
                {/* Category / Overall */}
                <td className="px-3 py-3 align-top border-r border-slate-200 bg-slate-50/40">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Total Receivable</p>
                      <p className="text-xl font-black text-slate-900 leading-tight">{formatCurrency(netBillAmount)}</p>
                    </div>
                    {isCustomerSummary && (
                      <div className="p-2.5 bg-emerald-50 rounded-md border border-emerald-100 shadow-sm">
                        <p className="text-[9px] text-emerald-600 uppercase font-bold mb-0.5">Final Amount</p>
                        <p className="text-lg font-bold text-emerald-700 leading-tight">{formatCurrency(summary.totalFinalAmount || 0)}</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200/60">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Entries (Paid/Total)</p>
                      <p className="text-base font-bold text-slate-800">{paidEntriesCount} / {transactionsCount}</p>
                    </div>
                  </div>
                </td>

                {/* Weight Details */}
                <td className="px-3 py-3 align-top border-r border-slate-200">
                  <div className="space-y-2">
                    <StatementMetric label="Gross" value={`${formatDecimalLocal(grossWeight)} kg`} />
                    <StatementMetric label="Teir" value={`${formatDecimalLocal(teirWeight)} kg`} />
                    <StatementMetric label="Final" value={`${formatDecimalLocal(summary.totalFinalWeight)} kg`} />
                    <div className="pt-1.5 border-t border-slate-100">
                      <StatementMetric label="Net Weight" value={`${formatDecimalLocal(summary.totalNetWeight)} kg`} valueClassName="text-slate-900 font-bold text-[11px]" />
                    </div>
                    {isCustomerSummary && (
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-100 mt-1">
                        <StatementMetric label="Avg Bag Wt" value={`${formatDecimalLocal(summary.averageBagWeightKg || 0)} kg`} />
                        <StatementMetric label="Tot Bag Wt" value={`${formatDecimalLocal(totalBagWeightQtl)} Qtl`} />
                      </div>
                    )}
                  </div>
                </td>

                {/* Amount Details */}
                <td className="px-3 py-3 align-top border-r border-slate-200">
                  <div className="space-y-2">
                    <StatementMetric label="Total Amount" value={formatCurrency(summary.totalAmount || 0)} />
                    <StatementMetric label="Base Original" value={formatCurrency(baseOriginalAmount)} />
                    <div className="pt-1.5 border-t border-slate-100">
                      <StatementMetric label="Avg Rate" value={formatRateLocal(summary.averageRate)} valueClassName="font-bold" />
                      <StatementMetric label="Rate Range" value={`${formatRateLocal(minRate)} – ${formatRateLocal(maxRate)}`} />
                    </div>
                    {(summary.ledgerCreditAmount || 0) > 0 && (
                      <div className="pt-1.5 border-t border-slate-100 mt-1">
                        <StatementMetric label="Ledger Credit" value={formatCurrency(summary.ledgerCreditAmount || 0)} valueClassName="text-violet-700" />
                      </div>
                    )}
                  </div>
                </td>

                {/* Deductions Breakdown */}
                <td className="px-3 py-3 align-top border-r border-slate-200 bg-rose-50/5">
                  <div className="space-y-2">
                    <StatementMetric label="Karta" value={formatCurrency(summary.totalKartaAmount || 0)} />
                    {isCustomerSummary ? (
                      <>
                        <StatementMetric label="Bag Deduction" value={formatCurrency(summary.totalBagWeightDeductionAmount || 0)} />
                        <StatementMetric label="Brokerage" value={formatCurrency(summary.totalBrokerage || 0)} />
                        <StatementMetric label="CD Given" value={formatCurrency(summary.totalEntryCdAmount || 0)} />
                        <StatementMetric label="Transport" value={formatCurrency(summary.totalTransportAmount || 0)} />
                        <StatementMetric label="Kanta" value={formatCurrency(summary.totalKanta || 0)} />
                      </>
                    ) : (
                      <>
                        <StatementMetric label="Laboury" value={formatCurrency(summary.totalLabouryAmount || 0)} />
                        <StatementMetric label="Kanta+Other" value={formatCurrency(summary.totalKanta || 0)} />
                      </>
                    )}
                    <div className="pt-1.5 border-t border-rose-100 mt-2">
                      <StatementMetric label="Total Deductions" value={`- ${formatCurrency(totalDeductions)}`} valueClassName="text-rose-700 font-bold text-[11px]" />
                    </div>
                  </div>
                </td>

                {/* Payment Status */}
                <td className="px-3 py-3 align-top border-r border-slate-200 bg-emerald-50/5">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-emerald-600 uppercase font-bold mb-1">Total Received</p>
                      <p className="text-xl font-black text-emerald-700 leading-tight">{formatCurrency(totalPaid)}</p>
                    </div>
                    <div className="p-2.5 bg-rose-50 rounded-md border border-rose-100 shadow-sm">
                      <p className="text-[9px] text-rose-600 uppercase font-bold mb-0.5">Outstanding</p>
                      <p className="text-lg font-bold text-rose-700 leading-tight">{formatCurrency(summary.totalOutstanding || 0)}</p>
                    </div>
                    <div className="pt-2 border-t border-emerald-100/60">
                      <StatementMetric label="Cash Paid" value={formatCurrency(cashPaid)} valueClassName="text-emerald-700" />
                      <StatementMetric label="CD Granted" value={formatCurrency(summary.totalCdAmount || 0)} valueClassName="text-emerald-600" />
                    </div>
                  </div>
                </td>

                {/* Ledger Impact */}
                <td className="px-3 py-3 align-top border-r border-slate-200 bg-violet-50/10">
                  <div className="space-y-2">
                    <StatementMetric label="Ledger Income" value={formatCurrency(summary.ledgerCreditAmount || 0)} valueClassName="text-emerald-700" />
                    <StatementMetric label="Ledger Expense" value={formatCurrency(summary.ledgerDebitAmount || 0)} valueClassName="text-rose-700" />
                    <div className="pt-1.5 border-t border-violet-200/60 mt-2">
                      <StatementMetric 
                        label="Net Impact" 
                        value={formatCurrency(netLedgerImpact)} 
                        valueClassName={cn("font-bold text-[11px]", impactColorClass)} 
                      />
                    </div>
                  </div>
                </td>

                {/* Entry Statistics */}
                <td className="px-3 py-3 align-top">
                  <div className="space-y-2">
                    <StatementMetric label="Avg Orig Rate" value={formatRateLocal(summary.averageOriginalPrice || 0)} />
                    <StatementMetric label="Entries Pending" value={outstandingEntriesCount.toString()} valueClassName="text-rose-600 font-bold" />
                    <StatementMetric label="Entries Paid" value={paidEntriesCount.toString()} valueClassName="text-emerald-600 font-bold" />
                    <div className="pt-1.5 border-t border-slate-100 mt-2">
                      <StatementMetric label="Total Entries" value={transactionsCount.toString()} valueClassName="font-bold text-slate-900" />
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-0.5 w-full min-w-0 overflow-hidden">
      <div className="ui-card w-full rounded-md p-1.5 bg-card min-w-0 overflow-hidden">
            {action ? <div className="flex items-center justify-end pb-1">{action}</div> : null}
            <div className="grid grid-cols-12 gap-2 items-stretch">
              <div className="col-span-12 md:col-span-5">
                <StatementTile
                  title="Net (kg)"
                  value={formatDecimalLocal(summary.totalNetWeight)}
                  valueClassName="text-slate-900"
                  icon={<Scale size={12} className="text-slate-700" />}
                  iconWrapClassName="bg-card border-border/60"
                  className=""
                >
                  <StatementPanel className="p-0">
                    <div className="grid grid-cols-1 gap-y-0.5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-0.5">
                      <StatementMetric label="Net" value={`${formatDecimalLocal(summary.totalNetWeight)} kg`} valueClassName="text-slate-900" />
                      <StatementMetric label="Final" value={`${formatDecimalLocal(summary.totalFinalWeight)} kg`} valueClassName="text-slate-900" />
                      <StatementMetric label="Gross" value={`${formatDecimalLocal(grossWeight)} kg`} valueClassName="text-slate-900" />
                      <StatementMetric label="Teir" value={`${formatDecimalLocal(teirWeight)} kg`} valueClassName="text-slate-900" />
                      <StatementMetric label="Karta Wt" value={`${formatDecimalLocal(summary.totalKartaWeight)} kg`} valueClassName="text-slate-900" />
                      <StatementMetric label="Tx" value={`${transactionsCount}`} valueClassName="text-slate-900" />
                      <StatementMetric label={summaryType === "customer" ? "Received" : "Paid"} value={`${paidEntriesCount}`} valueClassName="text-emerald-700" />
                      <StatementMetric label="Pending" value={`${outstandingEntriesCount}`} valueClassName="text-rose-700" />
                    </div>
                  </StatementPanel>
                </StatementTile>
              </div>

              <div className="col-span-12 md:col-span-4">
                <StatementTile
                  title="Overall Summary"
                  value={formatCurrency(netBillAmount)}
                  valueClassName="text-slate-900"
                  icon={<FileText size={13} className="text-slate-700" />}
                  iconWrapClassName="bg-card border-border/60"
                  className=""
                >
                  <StatementPanel className="p-0">
                    <div className="grid grid-cols-1 gap-y-0.5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-0.5">
                      <StatementMetric label={summaryType === "customer" ? "Received" : "Paid"} value={formatCurrency(summary.totalPaid || 0)} valueClassName="text-emerald-700" />
                      <StatementMetric label="Outstanding" value={formatCurrency(summary.totalOutstanding || 0)} valueClassName="text-rose-700" />
                      <StatementMetric label="Net (kg)" value={formatDecimalLocal(summary.totalNetWeight)} valueClassName="text-slate-900" />
                      <StatementMetric label="Avg Rate" value={formatRateLocal(summary.averageRate)} valueClassName="text-slate-900" />
                      <StatementMetric label="Tx" value={transactionsCount} valueClassName="text-slate-900" />
                      <StatementMetric label="Pending" value={outstandingEntriesCount} valueClassName="text-rose-700" />
                      <StatementMetric label="CD Granted" value={formatCurrency(summary.totalCdAmount || 0)} valueClassName="text-slate-900" />
                      <StatementMetric label="Total Ded." value={`- ${formatCurrency(totalDeductions)}`} valueClassName="text-rose-700" />
                    </div>
                  </StatementPanel>
                </StatementTile>
              </div>

              <div className="col-span-12 md:col-span-3">
                <StatementTile
                  title={summaryType === "customer" ? "Total Received" : "Total Paid"}
                  value={formatCurrency(totalPaid)}
                  valueClassName="text-slate-900"
                  icon={<Banknote size={12} className="text-slate-700" />}
                  iconWrapClassName="bg-card border-border/60"
                  className=""
                >
                  <StatementPanel className="p-0">
                    <div className="grid grid-cols-1 gap-y-0.5">
                      <StatementMetric
                        label={`Cash (${Math.round(cashPct)}%)`}
                        value={formatCurrency(cashPaid)}
                        valueClassName="text-emerald-950"
                      />
                      {summaryType !== "customer" && (
                        <>
                          <StatementMetric
                            label={`RTGS (${Math.round(rtgsPct)}%)`}
                            value={formatCurrency(rtgsPaid)}
                            valueClassName="text-sky-950"
                          />
                          <StatementMetric
                            label={`Gov (${Math.round(govPct)}%)`}
                            value={formatCurrency(govPaid)}
                            valueClassName="text-amber-950"
                          />
                        </>
                      )}
                      <StatementMetric label="CD Granted" value={formatCurrency(summary.totalCdAmount || 0)} valueClassName="text-slate-900" />
                    </div>
                  </StatementPanel>
                </StatementTile>
              </div>

              <div className="col-span-12 md:col-span-6 lg:col-span-6">
                <StatementTile
                  title="Rates"
                  value={formatRateLocal(summary.averageRate)}
                  valueClassName="text-slate-900"
                  icon={<TrendingUp size={12} className="text-slate-700" />}
                  iconWrapClassName="bg-card border-border/60"
                  className=""
                >
                  <StatementPanel className="p-0">
                    <div className="grid grid-cols-1 gap-y-0.5">
                      <StatementMetric label="Min" value={formatRateLocal(minRate)} valueClassName="text-slate-900" />
                      <StatementMetric label="Max" value={formatRateLocal(maxRate)} valueClassName="text-slate-900" />
                      <StatementMetric label="Avg Rate" value={formatRateLocal(summary.averageRate)} valueClassName="text-slate-900" />
                      {summaryType !== "customer" ? (
                        <>
                          <StatementMetric label="Spread" value={formatRateLocal(rateSpread)} valueClassName="text-slate-900" />
                          <StatementMetric label="Laboury Rate" value={formatDecimalLocal(summary.averageLabouryRate)} valueClassName="text-slate-900" />
                        </>
                      ) : null}
                      <StatementMetric
                        label="Avg Original"
                        value={formatRateLocal(summary.averageOriginalPrice || 0)}
                        valueClassName="text-slate-900"
                      />
                    </div>
                  </StatementPanel>
                </StatementTile>
              </div>

              <div className="col-span-12 md:col-span-6">
                <StatementTile
                  title="Amounts"
                  value={formatCurrency(netBillAmount)}
                  valueClassName="text-slate-900"
                  icon={<FileText size={14} className="text-slate-700" />}
                  iconWrapClassName="bg-card border-border/60"
                  className=""
                >
                  <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2 md:gap-x-8 md:gap-y-0">
                    <StatementPanel
                      title={summaryType === "customer" ? "Receivable" : "Bill Amounts"}
                      className="p-0"
                    >
                      <div className="grid grid-cols-1 gap-y-0.5">
                        <StatementMetric label="Total Amount" value={formatCurrency(summary.totalAmount || 0)} valueClassName="text-emerald-900" />
                        {summaryType === "customer" && (
                          <StatementMetric label="Final Amount" value={formatCurrency(summary.totalFinalAmount || 0)} valueClassName="text-emerald-900 font-bold" />
                        )}
                        <StatementMetric label="Base Original" value={formatCurrency(baseOriginalAmount)} valueClassName="text-emerald-900" />
                        {summaryType !== "customer" && (
                          <StatementMetric
                            label="Gov Extra"
                            value={formatCurrency(govExtraAmount)}
                            valueClassName="text-emerald-900"
                          />
                        )}
                        {(summary.ledgerCreditAmount || 0) > 0 && (
                          <StatementMetric label="Ledger Credit" value={formatCurrency(summary.ledgerCreditAmount || 0)} valueClassName="text-emerald-900" />
                        )}
                        {(Number(summary.ledgerCreditAmount || 0) > 0 || Number(summary.ledgerDebitAmount || 0) > 0) ? (
                          <StatementMetric
                            label="Ledger (Income · Expense → Net)"
                            value={`Income ${formatCurrency(summary.ledgerCreditAmount || 0)} · Expense ${formatCurrency(summary.ledgerDebitAmount || 0)} → ${formatCurrency(netLedgerImpact)}`}
                            valueClassName="text-slate-600 text-[10px]"
                          />
                        ) : null}
                      </div>
                    </StatementPanel>
                    <StatementPanel
                      title="Deductions"
                      className="p-0"
                    >
                      <div className="grid grid-cols-1 gap-y-0.5">
                        <StatementMetric
                          label="Karta"
                          value={`- ${formatCurrency(summary.totalKartaAmount || 0)}`}
                          valueClassName="text-rose-900"
                        />
                        {summaryType === "customer" ? (
                          <>
                            <StatementMetric label="Bag Wt Deduction" value={`- ${formatCurrency(summary.totalBagWeightDeductionAmount || 0)}`} valueClassName="text-rose-900" />
                            <StatementMetric label="Brokerage" value={`- ${formatCurrency(summary.totalBrokerage || 0)}`} valueClassName="text-rose-900" />
                            <StatementMetric label="CD" value={`- ${formatCurrency(summary.totalEntryCdAmount || 0)}`} valueClassName="text-rose-900" />
                            <StatementMetric label="Transport" value={`- ${formatCurrency(summary.totalTransportAmount || 0)}`} valueClassName="text-rose-900" />
                          </>
                        ) : (
                          <StatementMetric label="Laboury" value={`- ${formatCurrency(summary.totalLabouryAmount || 0)}`} valueClassName="text-rose-900" />
                        )}
                        <StatementMetric
                          label="Kanta"
                          value={`- ${formatCurrency(summary.totalKanta || 0)}`}
                          valueClassName="text-rose-900"
                        />
                        {summaryType !== "customer" ? (
                          <StatementMetric label="Other" value={`- ${formatCurrency(summary.totalBrokerage || 0)}`} valueClassName="text-rose-900" />
                        ) : null}
                        <StatementMetric
                          label="Total Ded."
                          value={`- ${formatCurrency(totalDeductions)}`}
                          valueClassName="text-rose-900"
                        />
                      </div>
                    </StatementPanel>
                  </div>
                </StatementTile>
              </div>

            </div>
      </div>
    </div>
  );
}
