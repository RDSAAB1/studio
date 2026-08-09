"use client";

import * as React from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, FileText, Banknote } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/date-utils";
import { useFormContext, useWatch } from "react-hook-form";
import { format } from "date-fns";

interface SimpleCalculatedSummaryProps {
    customer?: Customer;
    tableSuppliers?: Customer[];
    onSave: () => void;
    onClearForm?: () => void;
    onToggleTable?: () => void;
    showTable?: boolean;
    isEditing: boolean;
    isSubmitting?: boolean;
    isStockMode?: boolean;
}

export const SimpleCalculatedSummary = React.memo(({ 
    tableSuppliers = [],
    onSave, 
    onClearForm,
    onToggleTable,
    showTable = false,
    isEditing, 
    isSubmitting = false,
    isStockMode = false
}: Omit<SimpleCalculatedSummaryProps, 'customer'>) => {
    const { control } = useFormContext();
    
    // Watch fields for real-time calculation
    const watchedFields = useWatch({
        control,
        name: [
            "srNo", "grossWeight", "teirWeight", "kartaPercentage", 
            "rate", "labouryRate", "brokerageRate", "brokerageAddSubtract", 
            "kanta", "date", "term", "unit"
        ]
    });

    const [
        srNo, grossWeightRaw, teirWeightRaw, kartaPercentageRaw,
        rateRaw, labouryRateRaw, brokerageRateRaw, brokerageAddSubtract,
        kantaRaw, date, term, unit
    ] = watchedFields;

    const isLoading = !srNo;
    const formRate = Number(rateRaw) || 0;

    // Table aggregated totals when rate === 0
    const tableTotals = React.useMemo(() => {
        if (!tableSuppliers || tableSuppliers.length === 0) {
            return {
                grossWt: 0,
                teirWt: 0,
                finalWt: 0,
                kartaWt: 0,
                netWt: 0,
                rateAvg: 0,
                grossAmt: 0,
                kartaAmt: 0,
                afterKartaAmt: 0,
                cdAmt: 0,
                labouryAmt: 0,
                kantaAmt: 0,
                brokerageAmt: 0,
                totalDeductions: 0,
                netPayable: 0,
                count: 0
            };
        }
        const initial = {
            grossWt: 0,
            teirWt: 0,
            finalWt: 0,
            kartaWt: 0,
            netWt: 0,
            grossAmt: 0,
            kartaAmt: 0,
            afterKartaAmt: 0,
            cdAmt: 0,
            labouryAmt: 0,
            kantaAmt: 0,
            brokerageAmt: 0,
            totalDeductions: 0,
            netPayable: 0,
            count: tableSuppliers.length
        };
        const res = tableSuppliers.reduce((acc, s) => {
            const baseAmt = Number(s.amount) || 0;
            const kartaAmt = Number(s.kartaAmount) || 0;
            const afterKarta = baseAmt - kartaAmt;
            const cd = Math.round(afterKarta * 0.01); // 1% CD default
            const lab = Number(s.labouryAmount) || 0;
            const kanta = Number(s.kanta) || 0;

            acc.grossWt += (Number(s.grossWeight) || 0);
            acc.teirWt += (Number(s.teirWeight) || 0);
            acc.finalWt += (Number(s.weight) || 0);
            acc.kartaWt += (Number(s.kartaWeight) || 0);
            acc.netWt += (Number(s.netWeight) || 0);
            acc.grossAmt += baseAmt;
            acc.kartaAmt += kartaAmt;
            acc.afterKartaAmt += afterKarta;
            acc.cdAmt += cd;
            acc.labouryAmt += lab;
            acc.kantaAmt += kanta;
            acc.brokerageAmt += (Number(s.brokerageAmount) || 0);
            acc.totalDeductions += (kartaAmt + cd + lab + kanta);
            acc.netPayable += (afterKarta - cd - lab - kanta);
            return acc;
        }, initial);

        const validRates = tableSuppliers.map(s => Number(s.rate) || 0).filter(r => r > 0);
        const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
        const maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;
        const rateAvg = res.finalWt > 0 ? (res.grossAmt / res.finalWt) : 0;
        return { ...res, rateAvg, minRate, maxRate };
    }, [tableSuppliers]);
    
    // Switch source: Form data if formRate > 0; Table aggregated data if formRate === 0
    const isShowingTableData = formRate === 0;

    // Derived values depending on mode
    const grossWeight = isShowingTableData ? tableTotals.grossWt : (Number(grossWeightRaw) || 0);
    const teirWeight = isStockMode ? 0 : (isShowingTableData ? tableTotals.teirWt : (Number(teirWeightRaw) || 0));
    const kartaPercentage = isStockMode ? 0 : (isShowingTableData ? 0 : (Number(kartaPercentageRaw) || 0));
    const rate = isShowingTableData ? tableTotals.rateAvg : formRate;
    const labouryRate = isStockMode ? 0 : (isShowingTableData ? 0 : (Number(labouryRateRaw) || 0));
    const brokerageRate = isStockMode ? 0 : (isShowingTableData ? 0 : (Number(brokerageRateRaw) || 0));
    const kanta = isStockMode ? 0 : (isShowingTableData ? tableTotals.kantaAmt : (Number(kantaRaw) || 0));

    const dueDate = (() => {
        if (!date) return "-";
        const d = new Date(date);
        const t = Number(term) || 20;
        d.setDate(d.getDate() + t);
        return format(d, 'yyyy-MM-dd');
    })();
    
    // Form mode calculations
    const formFinalWt = (Number(grossWeightRaw) || 0) - teirWeight;
    const rawKartaWt = formFinalWt * (kartaPercentage / 100);
    const formKartaWt = Math.round(rawKartaWt * 100) / 100;
    const formNetWt = formFinalWt - formKartaWt;
    const formAmount = formFinalWt * rate;
    const formKartaAmt = formKartaWt * rate;
    const formLabAmt = formFinalWt * labouryRate;
    const formBrokerageAmt = brokerageRate * formFinalWt;
    const formAfterKartaAmt = formAmount - formKartaAmt;
    const formCdAmt = Math.round(formAfterKartaAmt * 0.01);
    const formNetPayable = formAfterKartaAmt - formCdAmt - formLabAmt - kanta;

    // Final assigned values for rendering
    const finalWt = isShowingTableData ? tableTotals.finalWt : formFinalWt;
    const kartaWt = isShowingTableData ? tableTotals.kartaWt : formKartaWt;
    const netWt = isShowingTableData ? tableTotals.netWt : formNetWt;
    const grossAmt = isShowingTableData ? tableTotals.grossAmt : formAmount;
    const kartaAmt = isShowingTableData ? tableTotals.kartaAmt : formKartaAmt;
    const afterKartaAmt = isShowingTableData ? tableTotals.afterKartaAmt : formAfterKartaAmt;
    const cdAmt = isShowingTableData ? tableTotals.cdAmt : formCdAmt;
    const labAmt = isShowingTableData ? tableTotals.labouryAmt : formLabAmt;
    const brokerageAmt = isShowingTableData ? tableTotals.brokerageAmt : formBrokerageAmt;
    const totalDeductions = isShowingTableData ? tableTotals.totalDeductions : (formKartaAmt + formCdAmt + formLabAmt + kanta);
    const netPayable = isShowingTableData ? tableTotals.netPayable : formNetPayable;
    
    const formatWeight = (wt: number) => `${wt.toFixed(2)} Qtl`;
    const formatRate = (rt: number) => `₹${rt.toFixed(2)}/Qtl`;
    const formatPercentage = (pct: number) => `${pct.toFixed(2)}%`;

    if (isStockMode) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Operational Summary Card */}
                <Card className="ui-summary-card">
                    <CardHeader className="pb-2 px-3 pt-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Scale size={16} className="text-muted-foreground"/>
                            Operational Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3 pb-3 text-xs">
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Quantity:</span>
                                <span className="font-bold">{grossWeight} {unit || "BAG"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Rate:</span>
                                <span className="font-bold">₹{rate.toFixed(2)} / {unit || "BAG"}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Financial Summary Card */}
                <Card className="ui-summary-card">
                    <CardHeader className="pb-2 px-3 pt-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Banknote size={16} className="text-muted-foreground"/>
                            Financial Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3 pb-3 text-xs">
                        <div className="flex justify-between items-baseline pt-1">
                            <span className="text-muted-foreground">Net Payable:</span>
                            <span className="font-bold text-red-500 dark:text-red-400 text-base">{formatCurrency(netPayable)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* 1. Operational Summary Card */}
            <Card className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-none">
                <div className="pb-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Scale size={15} className="text-slate-500"/>
                        Operational Summary
                    </span>
                </div>
                <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Gross Wt:</span>
                        <span className="font-semibold text-slate-700">{formatWeight(grossWeight)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Teir Wt:</span>
                        <span className="font-normal text-slate-600">{formatWeight(teirWeight)}</span>
                    </div>
                    <div className="flex justify-between items-center font-semibold text-slate-800">
                        <span>Final Wt:</span>
                        <span>{formatWeight(finalWt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Karta Wt {!isShowingTableData && `(@${formatPercentage(kartaPercentage)})`}:</span>
                        <span className="font-medium text-rose-500">-{formatWeight(kartaWt)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                        <span className="font-semibold text-blue-600">Net Wt:</span>
                        <span className="font-bold text-blue-600">{formatWeight(netWt)}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-[11.5px]">
                        <span className="text-slate-500">{isShowingTableData ? "Rate Avg:" : "Rate:"}</span>
                        <span className="font-semibold text-slate-700">{formatRate(rate)}</span>
                    </div>
                </div>
            </Card>

            {/* 2. Deduction Summary Card */}
            <Card className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-none">
                <div className="pb-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText size={15} className="text-slate-500"/>
                        Deduction Summary
                    </span>
                </div>
                <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Gross Amount:</span>
                        <span className="font-semibold text-slate-700">{formatCurrency(grossAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Karta Amt:</span>
                        <span className="font-normal text-rose-500">- {formatCurrency(kartaAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center font-semibold text-blue-600">
                        <span>After Karta:</span>
                        <span>{formatCurrency(afterKartaAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">CD Amt:</span>
                        <span className="font-normal text-amber-600">- {formatCurrency(cdAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Laboury Amt:</span>
                        <span className="font-normal text-rose-500">- {formatCurrency(labAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Kanta:</span>
                        <span className="font-normal text-rose-500">- {formatCurrency(kanta)}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-[11.5px] font-semibold text-amber-700">
                        <span>Total Deductions:</span>
                        <span>{formatCurrency(totalDeductions)}</span>
                    </div>
                </div>
            </Card>

            {/* 3. Financial Summary Card */}
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
                            <span className="text-slate-500">Gross Amount:</span>
                            <span className="font-semibold text-slate-700">{formatCurrency(grossAmt)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Total Deductions:</span>
                            <span className="font-normal text-rose-500">- {formatCurrency(totalDeductions)}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                            <span className="font-semibold text-slate-700">Net Payable:</span>
                            <span className="font-bold text-emerald-600 text-[14.5px] tracking-tight">{formatCurrency(netPayable)}</span>
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
                        <span className="text-slate-500">Due Date:</span>
                        <span className="font-semibold text-slate-700">
                            {isLoading || dueDate === "-" ? "-" : formatDate(dueDate, "dd-MMM-yy")}
                        </span>
                    </div>
                )}
            </Card>
        </div>
    );
});

SimpleCalculatedSummary.displayName = "SimpleCalculatedSummary";
