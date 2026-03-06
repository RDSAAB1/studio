"use client";
import { Scale, FileText, Banknote, TrendingUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
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
  totalOriginalAmount: number;
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
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0">
      <div
        className="min-w-0 truncate text-[10px] font-medium text-slate-600 leading-tight"
        title={label}
      >
        {displayLabel}
      </div>
      <div
        className={cn(
          "text-right text-[10px] font-semibold tabular-nums leading-tight whitespace-nowrap min-w-[88px]",
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

export function SupplierSummaryCards({ summary, action }: SupplierSummaryCardsProps) {
  const totalDeductions =
    (summary.totalKartaAmount || 0) +
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
  const paidShareDenom = totalPaid > 0 ? totalPaid : 1;
  const cashPct = Math.max(0, Math.min(100, (cashPaid / paidShareDenom) * 100));
  const rtgsPct = Math.max(0, Math.min(100, (rtgsPaid / paidShareDenom) * 100));
  const govPct = Math.max(0, Math.min(100, (govPaid / paidShareDenom) * 100));

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
                      <StatementMetric label="Paid" value={`${paidEntriesCount}`} valueClassName="text-emerald-700" />
                      <StatementMetric label="Pending" value={`${outstandingEntriesCount}`} valueClassName="text-rose-700" />
                    </div>
                  </StatementPanel>
                </StatementTile>
              </div>

              <div className="col-span-12 md:col-span-4">
                <StatementTile
                  title="Overall Summary"
                  value={formatCurrency(summary.totalAmount || 0)}
                  valueClassName="text-slate-900"
                  icon={<FileText size={13} className="text-slate-700" />}
                  iconWrapClassName="bg-card border-border/60"
                  className=""
                >
                  <StatementPanel className="p-0">
                    <div className="grid grid-cols-1 gap-y-0.5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-0.5">
                      <StatementMetric label="Paid" value={formatCurrency(summary.totalPaid || 0)} valueClassName="text-emerald-700" />
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
                  title="Total Paid"
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
                      <StatementMetric label="Spread" value={formatRateLocal(rateSpread)} valueClassName="text-slate-900" />
                      <StatementMetric label="Avg Rate" value={formatRateLocal(summary.averageRate)} valueClassName="text-slate-900" />
                      <StatementMetric
                        label="Laboury Rate"
                        value={formatDecimalLocal(summary.averageLabouryRate)}
                        valueClassName="text-slate-900"
                      />
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
                  value={formatCurrency(summary.totalAmount || 0)}
                  valueClassName="text-slate-900"
                  icon={<FileText size={14} className="text-slate-700" />}
                  iconWrapClassName="bg-card border-border/60"
                  className=""
                >
                  <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2 md:gap-x-8 md:gap-y-0">
                    <StatementPanel
                      title="Originals"
                      className="p-0"
                    >
                      <div className="grid grid-cols-1 gap-y-0.5">
                        <StatementMetric label="Base" value={formatCurrency(baseOriginalAmount)} valueClassName="text-emerald-900" />
                        <StatementMetric
                          label="Gov Extra"
                          value={formatCurrency(govExtraAmount)}
                          valueClassName="text-emerald-900"
                        />
                        <StatementMetric
                          label="Adjusted"
                          value={formatCurrency(summary.totalOriginalAmount || 0)}
                          valueClassName="text-emerald-900"
                        />
                        <StatementMetric
                          label="Credit"
                          value={formatCurrency(summary.ledgerCreditAmount || 0)}
                          valueClassName="text-sky-900"
                        />
                        <StatementMetric
                          label="Debit"
                          value={formatCurrency(summary.ledgerDebitAmount || 0)}
                          valueClassName="text-rose-900"
                        />
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
                        <StatementMetric
                          label="Laboury"
                          value={`- ${formatCurrency(summary.totalLabouryAmount || 0)}`}
                          valueClassName="text-rose-900"
                        />
                        <StatementMetric
                          label="Kanta"
                          value={`- ${formatCurrency(summary.totalKanta || 0)}`}
                          valueClassName="text-rose-900"
                        />
                        <StatementMetric
                          label="Other"
                          value={`- ${formatCurrency(summary.totalBrokerage || 0)}`}
                          valueClassName="text-rose-900"
                        />
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

