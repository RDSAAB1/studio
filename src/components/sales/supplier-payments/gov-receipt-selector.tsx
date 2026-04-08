"use client";

import React from 'react';
import { formatCurrency, cn } from "@/lib/utils";
import { Calculator } from "lucide-react";
import { useGovReceiptLogic } from "./hooks/use-gov-receipt-logic";
import { GovSummaryCards } from "./gov-summary-cards";
import { SelectedEntriesList } from "./selected-entries-list";
import { GovControlPanel } from "./gov-control-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="space-y-2">
            <Card className="text-[10px] rounded-xl border border-border/70 bg-card shadow-[0_4px_14px_rgba(15,23,42,0.10)]">
                <CardHeader className="pb-1.5 px-3 pt-2 bg-muted/70 border-b border-border/80">
                    <CardTitle className="text-[11px] font-semibold flex items-center gap-2 tracking-tight text-primary">
                        <Calculator className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>GOV Receipt Selection Helper</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2.5 pt-2 space-y-2 bg-white">
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
        </div>
    );
};
