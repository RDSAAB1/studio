"use client";

import React from 'react';
import { formatCurrency, cn } from "@/lib/utils";
import { Calculator } from "lucide-react";
import { useGovReceiptLogic } from "./hooks/use-gov-receipt-logic";
import { GovSummaryCards } from "./gov-summary-cards";
import { SelectedEntriesList } from "./selected-entries-list";
import { GovControlPanel } from "./gov-control-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { PaymentOption } from "@/hooks/use-payment-combination";

/** Extra amount base: Outstanding (amount/govRate as qty), Net Qty (netWeight), or Final Qty (weight) */
export type ExtraAmountBase = 'outstanding' | 'netQty' | 'finalQty';

interface ReceiptGovCalculation {
    receipt: any;
    normalAmount: number;
    govAmount: number;
    extraAmount: number;
    quantity: number;
    baseQuantity: number;
    rate: number;
    srNo: string;
}

interface Combination {
    receipts: any[];
    details: ReceiptGovCalculation[];
    totalGov: number;
    totalNormal: number;
    totalExtra: number;
    totalQuantity: number;
    difference: number;
    type: 'single' | 'pair' | 'triplet' | 'multiple';
}

interface GovReceiptSelectorProps {
    availableReceipts: any[];
    govRate: number;
    extraAmountPerQuintal?: number;
    onSelectReceipts: (receiptIds: string[]) => void;
    selectedReceiptIds: Set<string>;
    allowManualRsPerQtl?: boolean;
    allowManualGovRate?: boolean;
    calcTargetAmount?: number;
    setCalcTargetAmount?: (value: number) => void;
    combination?: {
        paymentOptions: any[];
        sortedPaymentOptions: any[];
        roundFigureToggle: boolean;
        setRoundFigureToggle: (value: boolean) => void;
        allowPaiseAmount: boolean;
        setAllowPaiseAmount: (value: boolean) => void;
        bagSize?: number;
        setBagSize: (value: number | undefined) => void;
        rateStep: 1 | 5;
        setRateStep: (value: 1 | 5) => void;
        handleGeneratePaymentOptions: (overrideValues?: { selectedReceipts?: any[]; targetAmount?: number; bagSize?: number; minRate?: number; maxRate?: number; rsValue?: number }) => void;
        requestSort: (key: keyof PaymentOption) => void;
    };
    selectPaymentAmount?: (option: any) => void;
    onSuggestionsChange?: (suggestions: Combination[]) => void;
    /** When provided, keeps GovForm 'Extra' amount in sync with calculated Extra here */
    onExtraAmountChange?: (extraAmount: number) => void;
    onGenerateClick?: () => void;
}

export const GovReceiptSelector: React.FC<GovReceiptSelectorProps> = ({
    availableReceipts,
    govRate: initialGovRate,
    extraAmountPerQuintal: initialExtraAmountPerQuintal = 0,
    onSelectReceipts,
    selectedReceiptIds,
    allowManualRsPerQtl = false,
    allowManualGovRate = false,
    calcTargetAmount = 0,
    setCalcTargetAmount,
    combination,
    selectPaymentAmount,
    onSuggestionsChange,
    onExtraAmountChange,
    onGenerateClick,
}) => {
    const instanceId = React.useId();
    const {
        targetGovAmount,
        setTargetGovAmount,
        manualGovRate,
        setManualGovRate,
        manualRsPerQtl,
        setManualRsPerQtl,
        extraAmountBase,
        setExtraAmountBase,
        extraAmountBaseType,
        setExtraAmountBaseType,
        targetIncludesExtra,
        setTargetIncludesExtra,
        useFinalWeight,
        setUseFinalWeight,
        bagWeight,
        setBagWeight,
        govRate,
        extraAmountPerQuintal,
        displayReceiptCalculations,
        selectedReceiptCalculations,
        govRequiredAmount,
        calculatedBaseAmount,
        calculatedExtraAmount,
        handleGenerateWithExtraBase,
        handleCalculateCombinations,
    } = useGovReceiptLogic({
        availableReceipts,
        initialGovRate,
        initialExtraAmountPerQuintal,
        selectedReceiptIds,
        calcTargetAmountProp: calcTargetAmount,
        setCalcTargetAmountProp: setCalcTargetAmount,
        onExtraAmountChange,
        onSuggestionsChange,
        combinationProps: combination ? {
            bagSize: combination.bagSize,
            setBagSize: combination.setBagSize,
            handleGeneratePaymentOptions: combination.handleGeneratePaymentOptions
        } : undefined
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] xl:grid-cols-[1fr_330px] gap-2.5 items-stretch">
            {/* Left Card: Helper */}
            <Card className="text-[10px] rounded-xl border border-border/70 bg-card shadow-[0_4px_14px_rgba(15,23,42,0.10)] flex flex-col h-full">
                <CardHeader className="pb-1.5 px-3 pt-2 bg-muted/70 border-b border-border/80 shrink-0">
                    <CardTitle className="text-[11px] font-semibold flex items-center gap-2 tracking-tight text-primary">
                        <Calculator className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>GOV Receipt Selection Helper</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-2 space-y-2 bg-white flex-1 flex flex-col">
                    <GovSummaryCards
                        availableCount={displayReceiptCalculations.length}
                        govRequiredAmount={govRequiredAmount}
                        calculatedBaseAmount={calculatedBaseAmount}
                        calculatedExtraAmount={calculatedExtraAmount}
                        extraAmountBaseType={extraAmountBaseType}
                    />

                    <SelectedEntriesList selectedReceiptCalculations={selectedReceiptCalculations} />

                    <GovControlPanel
                        instanceId={instanceId}
                        allowManualGovRate={allowManualGovRate}
                        manualGovRate={manualGovRate}
                        setManualGovRate={setManualGovRate}
                        targetGovAmount={targetGovAmount}
                        calcTargetAmountProp={calcTargetAmount || 0}
                        setTargetGovAmount={setTargetGovAmount}
                        extraAmountBase={extraAmountBase}
                        setExtraAmountBase={setExtraAmountBase}
                        allowManualRsPerQtl={allowManualRsPerQtl}
                        manualRsPerQtl={manualRsPerQtl}
                        setManualRsPerQtl={setManualRsPerQtl}
                        bagWeight={bagWeight}
                        setBagWeight={setBagWeight}
                        combinationBagSize={combination?.bagSize}
                        extraAmountBaseType={extraAmountBaseType}
                        setExtraAmountBaseType={setExtraAmountBaseType}
                        targetIncludesExtra={targetIncludesExtra}
                        setTargetIncludesExtra={setTargetIncludesExtra}
                        useFinalWeight={useFinalWeight}
                        setUseFinalWeight={setUseFinalWeight}
                        combination={combination}
                        handleGenerateWithExtraBase={handleGenerateWithExtraBase}
                        handleCalculateCombinations={handleCalculateCombinations}
                        canCalculate={targetGovAmount > 0 || (calcTargetAmount || 0) > 0}
                    />
                </CardContent>
            </Card>

            {/* Right Card: Generator & Calculation Controls */}
            <Card className="text-[10px] rounded-xl border border-border/70 bg-card shadow-[0_4px_14px_rgba(15,23,42,0.10)] flex flex-col h-full">
                <CardHeader className="pb-1.5 px-3 pt-2 bg-muted/70 border-b border-border/80 shrink-0">
                    <CardTitle className="text-[11px] font-semibold text-primary">
                        Generator Controls
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-2 space-y-2 bg-white flex-1 flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                        {/* Final WT Toggle (only when receipt based extra calc is active) */}
                        {extraAmountBaseType === 'receipt' && (
                            <div className="space-y-0.5">
                                <Label htmlFor={`finalWtToggle-${instanceId}`} className="text-[9px] font-medium text-foreground">Final WT</Label>
                                <button
                                    id={`finalWtToggle-${instanceId}`}
                                    type="button"
                                    onClick={() => setUseFinalWeight(!useFinalWeight)}
                                    className={cn(
                                        "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                    )}
                                >
                                    <span className={cn("absolute left-1.5 text-[8px] font-semibold z-0", useFinalWeight ? "text-muted-foreground/70" : "text-foreground")}>FW</span>
                                    <span className={cn("absolute right-1.5 text-[8px] font-semibold z-0", !useFinalWeight ? "text-muted-foreground/70" : "text-foreground")}>On</span>
                                    <div className={cn(
                                        "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                        useFinalWeight ? "left-[calc(50%+2px)]" : "left-[2px]"
                                    )}>
                                        <span className="text-[8px] font-bold text-primary-foreground">{useFinalWeight ? 'On' : 'FW'}</span>
                                    </div>
                                </button>
                            </div>
                        )}

                        {combination && (
                            <>
                                {/* Round Fig */}
                                <div className="space-y-0.5">
                                    <Label htmlFor={`roundFigToggle-${instanceId}`} className="text-[9px] font-medium text-foreground">Round Fig</Label>
                                    <button
                                        id={`roundFigToggle-${instanceId}`}
                                        type="button"
                                        onClick={() => combination.setRoundFigureToggle(!combination.roundFigureToggle)}
                                        className={cn(
                                            "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                        )}
                                    >
                                        <span className={cn("absolute left-1.5 text-[8px] font-semibold transition-colors z-0", !combination.roundFigureToggle ? "text-muted-foreground/70" : "text-foreground")}>Off</span>
                                        <span className={cn("absolute right-1.5 text-[8px] font-semibold transition-colors z-0", combination.roundFigureToggle ? "text-muted-foreground/70" : "text-foreground")}>On</span>
                                        <div className={cn(
                                            "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                            combination.roundFigureToggle ? "left-[calc(50%+2px)]" : "left-[2px]"
                                        )}>
                                            <span className="text-[8px] font-bold text-primary-foreground">RF</span>
                                        </div>
                                    </button>
                                </div>

                                {/* Amount Toggle */}
                                <div className="space-y-0.5">
                                    <Label htmlFor={`amountToggle-${instanceId}`} className="text-[9px] font-medium text-foreground">Amount</Label>
                                    <button
                                        id={`amountToggle-${instanceId}`}
                                        type="button"
                                        onClick={() => combination.setAllowPaiseAmount(!combination.allowPaiseAmount)}
                                        className={cn(
                                            "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                        )}
                                    >
                                        <span className={cn("absolute left-1 text-[8px] font-semibold transition-colors z-0", !combination.allowPaiseAmount ? "text-muted-foreground/70" : "text-foreground")}>₹</span>
                                        <span className={cn("absolute right-1 text-[8px] font-semibold transition-colors z-0", combination.allowPaiseAmount ? "text-muted-foreground/70" : "text-foreground")}>₹+Ps</span>
                                        <div className={cn(
                                            "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                            combination.allowPaiseAmount ? "left-[calc(50%+2px)]" : "left-[2px]"
                                        )}>
                                            <span className="text-[8px] font-bold text-primary-foreground">{combination.allowPaiseAmount ? "₹+Ps" : "₹"}</span>
                                        </div>
                                    </button>
                                </div>

                                {/* Step Toggle */}
                                <div className="space-y-0.5">
                                    <Label htmlFor={`stepToggle-${instanceId}`} className="text-[9px] font-medium text-foreground">Step</Label>
                                    <button
                                        id={`stepToggle-${instanceId}`}
                                        type="button"
                                        onClick={() => combination.setRateStep(combination.rateStep === 1 ? 5 : 1)}
                                        className={cn(
                                            "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                        )}
                                    >
                                        <span className={cn("absolute left-1 text-[8px] font-semibold transition-colors z-0", combination.rateStep === 1 ? "text-muted-foreground/70" : "text-foreground")}>+1</span>
                                        <span className={cn("absolute right-1 text-[8px] font-semibold transition-colors z-0", combination.rateStep === 5 ? "text-muted-foreground/70" : "text-foreground")}>+5</span>
                                        <div className={cn(
                                            "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                            combination.rateStep === 5 ? "left-[calc(50%+2px)]" : "left-[2px]"
                                        )}>
                                            <span className="text-[8px] font-bold text-primary-foreground">+{combination.rateStep}</span>
                                        </div>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className={cn("grid gap-1.5 mt-auto pt-2", combination ? "grid-cols-2" : "grid-cols-1")}>
                        {combination && (
                            <Button
                                onClick={() => {
                                    handleGenerateWithExtraBase();
                                    onGenerateClick?.();
                                }}
                                size="sm"
                                className="h-7 w-full text-[9px] rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/80"
                            >
                                Generate
                            </Button>
                        )}
                        <Button
                            onClick={handleCalculateCombinations}
                            size="sm"
                            className="h-7 w-full text-[9px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/80 disabled:opacity-50 disabled:pointer-events-none"
                            disabled={!(targetGovAmount > 0 || (calcTargetAmount || 0) > 0)}
                        >
                            Calculate
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
