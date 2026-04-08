import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { getAllPayments, getAllIncomes, getAllExpenses } from "@/lib/firestore";
import { parseAmount, formatStatementDate, formatCurrency } from "../utils";
import { printHtmlContent } from "@/lib/electron-print";
import type { StatementRow } from "../constants";
import { REPORT_BASE_CSS } from "@/lib/styles/report-styles";
import type { Payment } from "@/lib/definitions";

export function useStatementLogic(activeAccount: any, displayEntries: any[], totals: any) {
  const { toast } = useToast();
  const [statementStart, setStatementStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statementEnd, setStatementEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementData, setStatementData] = useState<StatementRow[]>([]);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [statementGeneratedAt, setStatementGeneratedAt] = useState<string>("");

  const handleGenerateStatement = useCallback(async () => {
    if (!statementStart || !statementEnd) {
      toast({ title: "Select date range", description: "Please choose both start and end dates.", variant: "destructive" });
      return;
    }

    if (statementStart > statementEnd) {
      toast({ title: "Invalid range", description: "Start date cannot be after end date.", variant: "destructive" });
      return;
    }

    setStatementLoading(true);
    setStatementError(null);
    try {
      const [payments, incomes, expenses] = await Promise.all([
        getAllPayments(),
        getAllIncomes(),
        getAllExpenses(),
      ]);

      const startDate = new Date(`${statementStart}T00:00:00`);
      const endDate = new Date(`${statementEnd}T23:59:59`);

      const normalizeDateKey = (raw: string | undefined | null) => {
        if (!raw) return null;
        const candidate = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
        if (Number.isNaN(candidate.getTime())) return null;
        if (candidate < startDate || candidate > endDate) return null;
        return format(candidate, "yyyy-MM-dd");
      };

      const map = new Map<string, { supplierCash: number; supplierRtgs: number; govDistribution: number; supplierPayments: number; incomes: number; expenses: number }>();
      const ensureRecord = (key: string) => {
        if (!map.has(key)) {
          map.set(key, { supplierCash: 0, supplierRtgs: 0, govDistribution: 0, supplierPayments: 0, incomes: 0, expenses: 0 });
        }
        return map.get(key)!;
      };

      payments.forEach((payment) => {
        const key = normalizeDateKey(payment.date);
        if (!key) return;
        const record = ensureRecord(key);

        const totalAmount = parseAmount(payment.amount);
        const rtgsAmount = parseAmount((payment as any).rtgsAmount);
        const receiptType = (payment.receiptType || (payment as any).type || "").toLowerCase();
        const channelHints = (payment as any).paymentMethod?.toLowerCase?.() || "";

        const isGovPayment = receiptType === 'gov.' || receiptType === 'gov' || receiptType.startsWith('gov');
        const isLedgerPayment = receiptType === 'ledger';
        const drCrLower = String((payment as any).drCr || "").trim().toLowerCase();
        const isLedgerCredit = isLedgerPayment && (drCrLower === "credit" || totalAmount < 0);
        const isLedgerDebit = isLedgerPayment && !isLedgerCredit;

        if (isGovPayment) {
          record.govDistribution += totalAmount;
          record.supplierPayments += totalAmount;
          return;
        }

        if (isLedgerPayment) {
          if (isLedgerDebit) {
            record.supplierPayments += totalAmount;
            record.expenses += totalAmount;
          } else if (isLedgerCredit) {
            record.incomes += totalAmount;
          }
          return;
        }

        const addCash = (amount: number) => { if (amount > 0) record.supplierCash += amount; };
        const addRtgs = (amount: number) => { if (amount > 0) record.supplierRtgs += amount; };
        const registerMixed = (rtgsPortion: number) => {
          const sanitizedRtgs = Math.min(rtgsPortion, totalAmount);
          addRtgs(sanitizedRtgs);
          const cashPortion = Math.max(totalAmount - sanitizedRtgs, 0);
          addCash(cashPortion);
        };

        const channelString = `${receiptType} ${channelHints}`.trim();
        if (channelString.includes("cash")) {
          addCash(totalAmount);
        } else if (
          channelString.includes("rtgs") || channelString.includes("neft") ||
          channelString.includes("imps") || channelString.includes("online") ||
          channelString.includes("bank") || channelString.includes("upi")
        ) {
          if (rtgsAmount > 0) registerMixed(rtgsAmount); else addRtgs(totalAmount);
        } else if (rtgsAmount > 0) {
          registerMixed(rtgsAmount);
        } else {
          addCash(totalAmount);
        }
        record.supplierPayments += totalAmount;
      });

      incomes.forEach((income) => {
        if (income.isInternal) return;
        const key = normalizeDateKey(income.date);
        if (!key) return;
        const record = ensureRecord(key);
        record.incomes += Number(income.amount) || 0;
      });

      expenses.forEach((expense) => {
        if (expense.isInternal) return;
        const key = normalizeDateKey(expense.date);
        if (!key) return;
        const record = ensureRecord(key);
        record.expenses += Number(expense.amount) || 0;
      });

      const rows: StatementRow[] = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, values]) => ({
          date,
          supplierCash: Math.round(values.supplierCash * 100) / 100,
          supplierRtgs: Math.round(values.supplierRtgs * 100) / 100,
          govDistribution: Math.round(values.govDistribution * 100) / 100,
          supplierPayments: Math.round(values.supplierPayments * 100) / 100,
          incomes: Math.round(values.incomes * 100) / 100,
          expenses: Math.round(values.expenses * 100) / 100,
          seCash: Math.round((values.supplierCash + values.expenses) * 100) / 100,
          netTotal: Math.round((values.supplierPayments + values.expenses - values.incomes) * 100) / 100,
        }));

      setStatementData(rows);
      setStatementGeneratedAt(new Date().toISOString());
    } catch (error: any) {
      const message = error?.message || "Unable to generate statement right now.";
      setStatementError(message);
      toast({ title: "Statement generation failed", description: message, variant: "destructive" });
    } finally {
      setStatementLoading(false);
    }
  }, [statementStart, statementEnd, toast]);

  const statementTotals = useMemo(() => {
    return statementData.reduce(
      (acc, row) => {
        acc.supplierCash += row.supplierCash;
        acc.supplierRtgs += row.supplierRtgs;
        acc.govDistribution += row.govDistribution;
        acc.supplierPayments += row.supplierPayments;
        acc.expenses += row.expenses;
        acc.incomes += row.incomes;
        acc.seCash += row.seCash;
        acc.netTotal += row.netTotal;
        return acc;
      },
      { supplierCash: 0, supplierRtgs: 0, govDistribution: 0, supplierPayments: 0, expenses: 0, incomes: 0, seCash: 0, netTotal: 0 }
    );
  }, [statementData]);

  const handleExportStatement = useCallback(() => {
    if (!statementData.length) {
      toast({ title: "Nothing to export", description: "Generate the daily statement before exporting to Excel." });
      return;
    }
    const header = ["Date", "Supplier Cash (₹)", "Supplier RTGS (₹)", "Gov Distribution (₹)", "Supplier Payments (₹)", "Expenses (₹)", "Income (₹)", "S/E Cash (₹)", "Net Total (₹)"];
    const rows = statementData.map((row) => [
      formatStatementDate(row.date),
      Number(row.supplierCash.toFixed(2)),
      Number(row.supplierRtgs.toFixed(2)),
      Number(row.govDistribution.toFixed(2)),
      Number(row.supplierPayments.toFixed(2)),
      Number(row.expenses.toFixed(2)),
      Number(row.incomes.toFixed(2)),
      Number(row.seCash.toFixed(2)),
      Number(row.netTotal.toFixed(2)),
    ]);
    const totalsRow = ["Totals", Number(statementTotals.supplierCash.toFixed(2)), Number(statementTotals.supplierRtgs.toFixed(2)), Number(statementTotals.govDistribution.toFixed(2)), Number(statementTotals.supplierPayments.toFixed(2)), Number(statementTotals.expenses.toFixed(2)), Number(statementTotals.incomes.toFixed(2)), Number(statementTotals.seCash.toFixed(2)), Number(statementTotals.netTotal.toFixed(2))];
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows, totalsRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Statement");
    const fileName = `daily-statement-${statementStart}-to-${statementEnd}.xlsx`.replace(/[^a-zA-Z0-9-_\\.]/g, "_");
    XLSX.writeFile(workbook, fileName);
  }, [statementData, statementTotals, statementStart, statementEnd, toast]);

  const handlePrintLedger = useCallback(() => {
      if (!activeAccount) return;
      const rowsHtml = displayEntries.map((entry, index) => {
          const formattedDate = entry.date ? new Date(entry.date).toLocaleDateString("en-IN") : "-";
          return `
            <tr>
              <td style="text-align: center;">${index + 1}</td>
              <td style="text-align: center; white-space: nowrap;">${formattedDate}</td>
              <td style="font-weight: 600;">${entry.particulars || "-"}</td>
              <td class="numeric font-bold" style="color: #dc2626;">${entry.debit ? formatCurrency(entry.debit) : ""}</td>
              <td class="numeric font-bold" style="color: #059669;">${entry.credit ? formatCurrency(entry.credit) : ""}</td>
              <td class="numeric font-bold balance" style="background: #f8fafc;">${formatCurrency((entry as any).runningBalance ?? entry.balance)}</td>
            </tr>
          `;
        }).join("");

      const documentContent = `
        <html>
          <head>
            <title>Ledger Statement - ${activeAccount.name}</title>
            <style>${REPORT_BASE_CSS}</style>
          </head>
          <body>
            <header class="report-header">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h1 class="firm-name">LEDGER STATEMENT</h1>
                  <div class="firm-sub">${activeAccount.name}</div>
                  <div class="firm-sub">${activeAccount.address || ""} | ${activeAccount.contact || ""}</div>
                </div>
                <div style="text-align: right;">
                   <div class="chip" style="background: #0f172a; color: white;">PRINTED: ${new Date().toLocaleDateString("en-IN")}</div>
                </div>
              </div>
              <div class="header-chips">
                 <div class="chip">ACCOUNT: ${activeAccount.name}</div>
                 <div class="chip">RECORDS: ${displayEntries.length}</div>
                 <div class="chip">TOTAL DEBIT: ${formatCurrency(totals?.debit || 0)}</div>
                 <div class="chip">TOTAL CREDIT: ${formatCurrency(totals?.credit || 0)}</div>
              </div>
            </header>
            <main>
              <table>
                <thead>
                  <tr>
                    <th style="width: 50px;">SR</th>
                    <th style="width: 100px;">DATE</th>
                    <th>PARTICULARS</th>
                    <th style="text-align: right; width: 120px;">DEBIT</th>
                    <th style="text-align: right; width: 120px;">CREDIT</th>
                    <th style="text-align: right; width: 140px;">BALANCE</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </main>
          </body>
        </html>
      `;
      printHtmlContent(documentContent);
  }, [activeAccount, displayEntries, totals]);

  return {
    statementStart,
    setStatementStart,
    statementEnd,
    setStatementEnd,
    statementLoading,
    statementData,
    statementError,
    statementGeneratedAt,
    handleGenerateStatement,
    handleExportStatement,
    handlePrintLedger,
    statementTotals,
  };
}
