
"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn, roundToTwoDecimalPlaces } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown, Search, Upload, Download, Trash2, Loader2, RefreshCw, X, Wheat, FileText, Banknote } from "lucide-react";
import { Separator } from "../ui/separator";
import { Input } from "../ui/input";
import { SegmentedSwitch } from "../ui/segmented-switch";
import { Label } from "../ui/label";
import { formatDate } from "@/lib/date-utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SmartDatePicker } from "../ui/smart-date-picker";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface CalculatedSummaryProps {
    customer: Customer;
    tableCustomers?: Customer[];
    onSave: () => void;
    onSaveAndPrint?: (docType: 'tax-invoice' | 'bill-of-supply' | 'challan' | 'receipt') => void;
    isEditing: boolean;
    onSearch?: (term: string) => void;
    onPrint?: () => void;
    selectedIdsCount?: number;
    isCustomerForm?: boolean;
    isBrokerageIncluded?: boolean;
    onBrokerageToggle?: (checked: boolean) => void;
    onImport?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onExport?: () => void;
    onUpdateSelected?: () => void;
    onDeleteSelected?: () => void;
    onDeleteAll?: () => void;
    isDeleting?: boolean;
    onClear?: () => void;
    varietyOptions?: { value: string; label: string }[];
    selectedVariety?: string;
    onVarietyChange?: (value: string) => void;
}

const SummaryItem = ({ label, value, isHighlighted, className }: { label: string; value: string; isHighlighted?: boolean, className?: string; }) => (
    <div className={cn("flex items-center justify-between", className)}>
        <span className="text-slate-500 text-[12px]">{label}:</span>
        <span className={cn("font-semibold text-[12px] text-slate-700", isHighlighted && "font-bold text-blue-600 text-[12.5px]")}>
            {value}
        </span>
    </div>
);

export const CalculatedSummary = ({ 
    customer, 
    tableCustomers = [],
    isEditing, 
    isDeleting = false,
    isBrokerageIncluded = false
}: CalculatedSummaryProps & { 
    totals?: { bags: number; grossWt: number; netWt: number; baseAmt: number; finalAmt: number; totalRec: number };
}) => {
    const isLoading = isDeleting;
    const formRate = Number(customer?.rate) || 0;
    const isShowingTableData = formRate === 0;

    // Table Aggregated Data calculation for Sales Customer entries
    const tableTotals = useMemo(() => {
        if (!tableCustomers || tableCustomers.length === 0) {
            return {
                grossWt: 0, teirWt: 0, finalWt: 0, kartaWt: 0, netWt: 0,
                bags: 0, avgBagWt: 0, totalBagWt: 0,
                amount: 0, cd: 0, brokerage: 0, kanta: 0,
                kartaAmount: 0, bagWeightDeductionAmount: 0, finalAmount: 0,
                bagAmount: 0, transportAmount: 0, advanceFreight: 0,
                totalReceivable: 0, rateAvg: 0, minRate: 0, maxRate: 0, count: 0
            };
        }
        const initial = {
            grossWt: 0, teirWt: 0, finalWt: 0, kartaWt: 0, netWt: 0,
            bags: 0, totalBagWt: 0,
            amount: 0, cd: 0, brokerage: 0, kanta: 0,
            kartaAmount: 0, bagWeightDeductionAmount: 0, finalAmount: 0,
            bagAmount: 0, transportAmount: 0, advanceFreight: 0,
            totalReceivable: 0, count: tableCustomers.length
        };

        const res = tableCustomers.reduce((acc, c) => {
            const finalWt = Number(c.weight) || 0;
            const kartaWt = Number(c.kartaWeight) || 0;
            const netWt = Number(c.netWeight) || 0;
            const bags = Number(c.bags) || 0;
            const bagWtKg = Number(c.bagWeightKg) || 0;
            const totalBagWt = bags * bagWtKg;

            const baseAmt = Number(c.amount) || 0;
            const kartaAmt = Number(c.kartaAmount) || 0;
            const bagDedAmt = Number(c.bagWeightDeductionAmount) || 0;
            const finalAmt = Number(c.finalAmount) || (baseAmt - kartaAmt - bagDedAmt);
            const cd = Number(c.cd) || 0;
            const brk = Number(c.brokerage) || 0;
            const kanta = Number(c.kanta) || 0;
            const bagAmt = Number(c.bagAmount) || 0;
            const transAmt = Number(c.transportAmount) || 0;
            const advFreight = Number(c.advanceFreight) || 0;
            const totalRec = (Number(c.originalNetAmount) || 0) + advFreight;

            acc.grossWt += (Number(c.grossWeight) || 0);
            acc.teirWt += (Number(c.teirWeight) || 0);
            acc.finalWt += finalWt;
            acc.kartaWt += kartaWt;
            acc.netWt += netWt;
            acc.bags += bags;
            acc.totalBagWt += totalBagWt;

            acc.amount += baseAmt;
            acc.kartaAmount += kartaAmt;
            acc.bagWeightDeductionAmount += bagDedAmt;
            acc.finalAmount += finalAmt;
            acc.cd += cd;
            acc.brokerage += brk;
            acc.kanta += kanta;
            acc.bagAmount += bagAmt;
            acc.transportAmount += transAmt;
            acc.advanceFreight += advFreight;
            acc.totalReceivable += totalRec;
            return acc;
        }, initial);

        const validRates = tableCustomers.map(c => Number(c.rate) || 0).filter(r => r > 0);
        const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
        const maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;
        const rateAvg = res.finalWt > 0 ? (res.amount / res.finalWt) : 0;
        const avgBagWt = res.bags > 0 ? ((res.finalWt * 100) / res.bags) : 0;

        return { ...res, rateAvg, minRate, maxRate, avgBagWt };
    }, [tableCustomers]);

    // Form calculation values
    const formFinalWt = Number(customer?.weight) || 0;
    const formKartaWt = roundToTwoDecimalPlaces(Number(customer?.kartaWeight) || 0);
    const formNetWt = Number(customer?.netWeight) || 0;
    const formBags = Number(customer?.bags) || 0;
    const formAvgBagWt = (formFinalWt && formBags) ? ((formFinalWt / formBags) * 100) : 0;
    const formTotalBagWt = (formBags * (Number(customer?.bagWeightKg) || 0)) / 100;
    const formKartaAmt = Number(customer?.kartaAmount) || 0;
    const formBagDedAmt = Number(customer?.bagWeightDeductionAmount) || 0;
    const formFinalAmt = Number(customer?.finalAmount) || 0;

    const formAmt = Number(customer?.amount) || 0;
    const formCd = Number(customer?.cd) || 0;
    const formBrk = Number(customer?.brokerage) || 0;
    const formKanta = Number(customer?.kanta) || 0;
    const formBagAmt = Number(customer?.bagAmount) || 0;
    const formTransAmt = Number(customer?.transportAmount) || 0;
    const formAdvFreight = Number(customer?.advanceFreight) || 0;
    const formTotalRec = (Number(customer?.originalNetAmount) || 0) + formAdvFreight;

    // Assigned variables depending on mode
    const grossWt = isShowingTableData ? tableTotals.grossWt : (Number(customer?.grossWeight) || 0);
    const teirWt = isShowingTableData ? tableTotals.teirWt : (Number(customer?.teirWeight) || 0);
    const finalWt = isShowingTableData ? tableTotals.finalWt : formFinalWt;
    const kartaWt = isShowingTableData ? tableTotals.kartaWt : formKartaWt;
    const netWt = isShowingTableData ? tableTotals.netWt : formNetWt;
    const avgBagWt = isShowingTableData ? tableTotals.avgBagWt : formAvgBagWt;
    const totalBagWt = isShowingTableData ? (tableTotals.totalBagWt / 100) : formTotalBagWt;
    const kartaAmount = isShowingTableData ? tableTotals.kartaAmount : formKartaAmt;
    const bagWeightDeductionAmount = isShowingTableData ? tableTotals.bagWeightDeductionAmount : formBagDedAmt;
    const finalAmount = isShowingTableData ? tableTotals.finalAmount : formFinalAmt;

    const amount = isShowingTableData ? tableTotals.amount : formAmt;
    const cd = isShowingTableData ? tableTotals.cd : formCd;
    const brokerage = isShowingTableData ? tableTotals.brokerage : formBrk;
    const kanta = isShowingTableData ? tableTotals.kanta : formKanta;
    const bagAmount = isShowingTableData ? tableTotals.bagAmount : formBagAmt;
    const transportAmount = isShowingTableData ? tableTotals.transportAmount : formTransAmt;
    const advanceFreight = isShowingTableData ? tableTotals.advanceFreight : formAdvFreight;
    const totalReceivable = isShowingTableData ? tableTotals.totalReceivable : formTotalRec;
    const rate = isShowingTableData ? tableTotals.rateAvg : formRate;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Deduction Summary Card - Operational + Deduction fields */}
            <Card className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-none">
                <div className="pb-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText size={15} className="text-slate-500"/>
                        Deduction Summary
                    </span>
                </div>
                <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Final Wt:</span>
                        <span className="font-semibold text-slate-700">{finalWt.toFixed(2)} Qtl</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Karta Wt:</span>
                        <span className="font-medium text-rose-500">-{kartaWt.toFixed(2)} Qtl</span>
                    </div>
                    <div className="flex justify-between items-center font-semibold text-blue-600">
                        <span>Net Wt:</span>
                        <span className="font-bold">{netWt.toFixed(2)} Qtl</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Avg Bag Wt:</span>
                        <span className="font-normal text-slate-600">{avgBagWt.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Total Bag Wt:</span>
                        <span className="font-normal text-slate-600">{totalBagWt.toFixed(2)} Qtl</span>
                    </div>
                    <div className="pt-1 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-slate-500">Karta Amount:</span>
                        <span className="font-medium text-rose-500">-{formatCurrency(kartaAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Bag Wt Deduction:</span>
                        <span className="font-medium text-rose-500">-{formatCurrency(bagWeightDeductionAmount)}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-100 flex justify-between items-center font-semibold text-amber-700">
                        <span>Final Amount:</span>
                        <span className="font-bold">{formatCurrency(finalAmount)}</span>
                    </div>
                </div>
            </Card>

            {/* 2. Financial Summary Card */}
            <Card className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-none flex flex-col justify-between">
                <div className="space-y-2.5">
                    <div className="pb-1.5 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[12.5px] font-bold text-slate-700 flex items-center gap-1.5">
                            <Banknote size={15} className="text-slate-500"/>
                            Financial Summary
                        </span>
                    </div>
                    <div className="space-y-1.5 text-[12px]">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Base Amount:</span>
                            <span className="font-semibold text-slate-700">{formatCurrency(amount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">CD Amt:</span>
                            <span className="font-medium text-amber-600">-{formatCurrency(cd)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Brokerage:</span>
                            <span className="font-medium text-rose-500">-{formatCurrency(brokerage)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Kanta:</span>
                            <span className="font-medium text-rose-500">-{formatCurrency(kanta)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Total Bag Amt:</span>
                            <span className="font-normal text-slate-700">{formatCurrency(bagAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Transport Amount:</span>
                            <span className="font-normal text-slate-700">{formatCurrency(transportAmount)}</span>
                        </div>
                        {advanceFreight > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Advance Freight:</span>
                                <span className="font-medium text-emerald-600">{formatCurrency(advanceFreight)}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                            <span className="font-semibold text-slate-700">Total Receivable:</span>
                            <span className="font-bold text-emerald-600 text-[14.5px] tracking-tight">{formatCurrency(totalReceivable)}</span>
                        </div>
                    </div>
                </div>

                {isShowingTableData ? (
                    <div className="pt-1.5 border-t border-slate-100 text-[11.5px] flex justify-between items-center">
                        <span className="text-slate-500">Rate Range:</span>
                        <span className="font-semibold text-slate-700">
                            ₹{Math.round(tableTotals.minRate).toLocaleString('en-IN')} ~ ₹{Math.round(tableTotals.maxRate).toLocaleString('en-IN')}
                        </span>
                    </div>
                ) : (
                    <div className="pt-1.5 border-t border-slate-100 text-[11.5px] flex justify-between items-center">
                        <span className="text-slate-500">Rate Avg:</span>
                        <span className="font-semibold text-slate-700">
                            ₹{rate.toFixed(2)}/Qtl
                        </span>
                    </div>
                )}
            </Card>
        </div>
    );
};
