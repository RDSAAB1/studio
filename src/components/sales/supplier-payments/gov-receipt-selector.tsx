"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, cn } from "@/lib/utils";
import type { PaymentOption } from "@/hooks/use-payment-combination";
import { Calculator, Receipt, Target, Package, Sparkles, TrendingUp, Wallet, Coins, DollarSign, Percent } from "lucide-react";

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
    const [targetGovAmount, setTargetGovAmount] = useState<number>(0);
    const [manualGovRate, setManualGovRate] = useState<number>(initialGovRate);
    const [manualRsPerQtl, setManualRsPerQtl] = useState<number>(initialExtraAmountPerQuintal);
    const [bagWeight, setBagWeight] = useState<number>(0);
    const [hasManualInputRate, setHasManualInputRate] = useState(false);
    const [hasManualInputRs, setHasManualInputRs] = useState(false);
    const [extraAmountBase, setExtraAmountBase] = useState<ExtraAmountBase>('outstanding');
    const [extraAmountBaseType, setExtraAmountBaseType] = useState<'receipt' | 'target'>('receipt');
    const [targetIncludesExtra, setTargetIncludesExtra] = useState(false);
    const [useFinalWeight, setUseFinalWeight] = useState(false);

    const govRate = hasManualInputRate ? manualGovRate : initialGovRate;
    const extraAmountPerQuintal = hasManualInputRs ? manualRsPerQtl : initialExtraAmountPerQuintal;

    // Get selected receipts for extra amount base calculation
    const selectedReceipts = useMemo(() => {
        return availableReceipts.filter(receipt => {
            const receiptId = receipt.id || receipt.srNo;
            return selectedReceiptIds.has(receiptId);
        });
    }, [availableReceipts, selectedReceiptIds]);

    const receiptCalculations = useMemo((): ReceiptGovCalculation[] => {
        return availableReceipts
            .filter(receipt => {
                const outstanding = (receipt as any).outstandingForEntry !== undefined
                    ? Number((receipt as any).outstandingForEntry)
                    : (receipt.netAmount !== undefined ? Number(receipt.netAmount) : 0);
                return outstanding > 0.01;
            })
            .map(receipt => {
                const normalAmount = (receipt as any).outstandingForEntry !== undefined
                    ? Number((receipt as any).outstandingForEntry)
                    : (receipt.netAmount !== undefined ? Number(receipt.netAmount) : 0);
                const actualQuantity = Number(receipt.netWeight) || 0;
                const finalQuantity = Number((receipt as any).weight) || 0;
                const baseQuantity = govRate > 0 ? normalAmount / govRate : 0;

                let baseForExtraAmount = 0;
                if (extraAmountBase === 'netQty') {
                    baseForExtraAmount = actualQuantity;
                } else if (extraAmountBase === 'finalQty') {
                    baseForExtraAmount = finalQuantity;
                } else {
                    baseForExtraAmount = govRate > 0 ? normalAmount / govRate : 0;
                }
                const extraAmount = baseForExtraAmount * extraAmountPerQuintal;
                const govAmount = normalAmount + extraAmount;

                return {
                    receipt,
                    normalAmount,
                    govAmount,
                    extraAmount,
                    quantity: actualQuantity,
                    baseQuantity,
                    rate: Number(receipt.rate) || govRate,
                    srNo: receipt.srNo || '',
                };
            })
            .sort((a, b) => a.govAmount - b.govAmount);
    }, [availableReceipts, govRate, extraAmountPerQuintal, extraAmountBase]);

    // Wrapper: pass Required GOV (Normal + Extra) as target for generation
    const handleGenerateWithExtraBase = () => {
        if (combination?.handleGeneratePaymentOptions) {
            const requiredGovForGeneration = govRequiredAmount > 0 ? govRequiredAmount : totalAvailableGov;
            combination.handleGeneratePaymentOptions({
                selectedReceipts,
                targetAmount: requiredGovForGeneration,
                bagSize: bagWeight > 0 ? bagWeight : combination?.bagSize ? combination.bagSize : undefined,
                minRate: govRate || 0,
                maxRate: govRate || 0,
                rsValue: 0,
            });
        }
    };

    // Filter receiptCalculations based on selected receipts (if any selected, show only selected; otherwise show all)
    const displayReceiptCalculations = useMemo(() => {
        if (selectedReceiptIds.size > 0) {
            return receiptCalculations.filter(calc => {
                const receiptId = calc.receipt.id || calc.receipt.srNo;
                return selectedReceiptIds.has(receiptId);
            });
        }
        return receiptCalculations;
    }, [receiptCalculations, selectedReceiptIds]);

    const totalAvailableGov = displayReceiptCalculations.reduce((sum, calc) => sum + calc.govAmount, 0);
    const totalAvailableNormal = displayReceiptCalculations.reduce((sum, calc) => sum + calc.normalAmount, 0);
    
    // Calculate totals for SELECTED receipts only (for receipt-based calculations)
    const selectedReceiptCalculations = useMemo(() => {
        if (selectedReceiptIds.size > 0) {
            return receiptCalculations.filter(calc => {
                const receiptId = calc.receipt.id || calc.receipt.srNo;
                return selectedReceiptIds.has(receiptId);
            });
        }
        return receiptCalculations;
    }, [receiptCalculations, selectedReceiptIds]);
    
    const totalSelectedGov = selectedReceiptCalculations.reduce((sum, calc) => sum + calc.govAmount, 0);
    const totalSelectedNormal = selectedReceiptCalculations.reduce((sum, calc) => sum + calc.normalAmount, 0);

    const baseAmountForExtra = useMemo(() => {
        if (selectedReceiptCalculations.length === 0) return 0;
        if (extraAmountBase === 'netQty') {
            return selectedReceiptCalculations.reduce((sum, calc) => sum + (Number(calc.receipt.netWeight) || 0), 0);
        }
        if (extraAmountBase === 'finalQty') {
            return selectedReceiptCalculations.reduce((sum, calc) => sum + (Number(calc.receipt.weight) || 0), 0);
        }
        return totalSelectedNormal;
    }, [selectedReceiptCalculations, extraAmountBase, totalSelectedNormal]);

    const { calculatedBaseAmount, calculatedExtraAmount } = useMemo(() => {
        const normalAmount = totalSelectedNormal;
        if (extraAmountBaseType === 'target') {
            const targetAmt = targetGovAmount > 0 ? targetGovAmount : (typeof calcTargetAmount === 'number' ? calcTargetAmount : 0);
            const currentGovRate = govRate || 0;
            const currentExtraRate = extraAmountPerQuintal || 0;
            if (currentGovRate > 0 && targetAmt > 0 && currentExtraRate > 0) {
                if (targetIncludesExtra) {
                    const baseAmount = targetAmt / (1 + currentExtraRate / currentGovRate);
                    const extraAmount = targetAmt - baseAmount;
                    return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: extraAmount };
                }
                const extraAmount = (targetAmt / currentGovRate) * currentExtraRate;
                return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: extraAmount };
            }
            return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: 0 };
        }
        const currentGovRate = govRate || 0;
        const currentExtraRate = extraAmountPerQuintal || 0;
        if (extraAmountBase === 'netQty' || extraAmountBase === 'finalQty') {
            const baseAmountForExtraCalc = baseAmountForExtra;
            if (useFinalWeight && currentExtraRate > 0 && baseAmountForExtraCalc > 0) {
                const baseAmountInRs = baseAmountForExtraCalc * currentGovRate;
                const initialExtra = baseAmountForExtraCalc * currentExtraRate;
                const finalExtra = (initialExtra + baseAmountInRs) / currentGovRate * currentExtraRate;
                return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: finalExtra };
            }
            const extraAmount = baseAmountForExtraCalc * currentExtraRate;
            return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: extraAmount };
        }
        if (useFinalWeight && currentGovRate > 0 && currentExtraRate > 0 && baseAmountForExtra > 0) {
            const initialExtra = (baseAmountForExtra / currentGovRate) * currentExtraRate;
            const finalExtra = (initialExtra + baseAmountForExtra) / currentGovRate * currentExtraRate;
            return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: finalExtra };
        }
        const extraAmount = currentGovRate > 0 && currentExtraRate > 0 && baseAmountForExtra > 0
            ? (baseAmountForExtra / currentGovRate) * currentExtraRate
            : 0;
        return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: extraAmount };
    }, [extraAmountBaseType, targetGovAmount, calcTargetAmount, govRate, extraAmountPerQuintal, targetIncludesExtra, totalSelectedNormal, useFinalWeight, baseAmountForExtra, extraAmountBase]);

    const govRequiredAmount = calculatedBaseAmount + calculatedExtraAmount;

    // Keep GovForm 'Extra' field in sync with the calculated Extra amount block
    useEffect(() => {
        if (onExtraAmountChange) {
            const roundedExtra = Math.round(calculatedExtraAmount);
            onExtraAmountChange(roundedExtra > 0 ? roundedExtra : 0);
        }
    }, [calculatedExtraAmount, onExtraAmountChange]);

    const handleCalculateCombinations = () => {
        if (targetGovAmount <= 0 || receiptCalculations.length === 0) return;

        const MAX_COMBINATIONS_TO_GENERATE = 200; // Generate more than needed, then filter to best 100
        const MAX_COMBINATIONS_TO_RETURN = 100;
        const allCombinations: Combination[] = [];

        const generateCombinations = (n: number, startIndex: number = 0, current: ReceiptGovCalculation[] = []): boolean => {
            // Early termination if we have enough combinations
            if (allCombinations.length >= MAX_COMBINATIONS_TO_GENERATE) {
                return false;
            }

            if (current.length === n) {
                const totalGov = current.reduce((sum, calc) => sum + calc.govAmount, 0);
                if (totalGov >= targetGovAmount && totalGov > 0) {
                    const type = n === 1 ? 'single' : n === 2 ? 'pair' : n === 3 ? 'triplet' : 'multiple';
                    allCombinations.push({
                        receipts: current.map(c => c.receipt),
                        details: [...current],
                        totalGov,
                        totalNormal: current.reduce((sum, calc) => sum + calc.normalAmount, 0),
                        totalExtra: current.reduce((sum, calc) => sum + calc.extraAmount, 0),
                        totalQuantity: current.reduce((sum, calc) => sum + calc.quantity, 0),
                        difference: totalGov - targetGovAmount,
                        type,
                    });
                }
                return true;
            }

            for (let i = startIndex; i < receiptCalculations.length; i++) {
                // Early termination check
                if (allCombinations.length >= MAX_COMBINATIONS_TO_GENERATE) {
                    return false;
                }

                const currentTotal = current.reduce((sum, calc) => sum + calc.govAmount, 0);
                const newTotal = currentTotal + receiptCalculations[i].govAmount;
                
                // Optimized pruning: Skip if adding remaining items still won't reach target
                if (newTotal < targetGovAmount && n > 1) {
                    const remainingItems = receiptCalculations.length - 1 - i;
                    if (current.length + remainingItems < n) {
                        continue;
                    }
                    // Additional pruning: if current total + max possible from remaining < target, skip
                    const itemsNeeded = n - current.length - 1;
                    if (itemsNeeded > 0 && i + itemsNeeded < receiptCalculations.length) {
                        const maxPossibleFromRemaining = receiptCalculations
                            .slice(i + 1, i + 1 + itemsNeeded)
                            .reduce((sum, calc) => sum + calc.govAmount, 0);
                        if (newTotal + maxPossibleFromRemaining < targetGovAmount) {
                            continue;
                        }
                    }
                }

                current.push(receiptCalculations[i]);
                const shouldContinue = generateCombinations(n, i + 1, current);
                current.pop();
                
                if (!shouldContinue) {
                    return false; // Stop generating
                }
            }
            
            return true;
        };

        // Generate combinations incrementally, prioritizing smaller combinations
        // Stop early if we have enough combinations
        for (let n = 1; n <= Math.min(8, receiptCalculations.length); n++) {
            const shouldContinue = generateCombinations(n);
            if (!shouldContinue || allCombinations.length >= MAX_COMBINATIONS_TO_GENERATE) {
                break;
            }
        }

        // Sort by absolute difference (nearest to target first), then by number of receipts
        allCombinations.sort((a, b) => {
            const diffA = Math.abs(a.difference);
            const diffB = Math.abs(b.difference);
            if (diffA !== diffB) {
                return diffA - diffB;
            }
            return a.receipts.length - b.receipts.length;
        });

        // Return only the best 100 combinations (nearest to target)
        const bestCombinations = allCombinations.slice(0, MAX_COMBINATIONS_TO_RETURN);
        onSuggestionsChange?.(bestCombinations);
    };

    const handleSelectCombination = (combination: Combination) => {
        const receiptIds = combination.receipts.map(r => r.id || r.srNo);
        onSelectReceipts(receiptIds);
    };

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
                {/* 4 Summary cards - AVAILABLE, TOTAL GOV, NORMAL, EXTRA + Entry-wise breakdown for balance */}
                <div className="grid grid-cols-4 gap-1.5">
                    <div className="flex flex-col rounded-[10px] border border-border/70 bg-muted/30 px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
                        <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-0.5">
                            <DollarSign className="h-2.5 w-2.5" /> Available
                        </span>
                        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-foreground">{displayReceiptCalculations.length}</span>
                    </div>
                    <div className="flex flex-col rounded-[10px] border border-border/70 bg-muted/30 px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
                        <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-0.5">
                            <TrendingUp className="h-2.5 w-2.5" /> {extraAmountBaseType === 'target' ? 'Required GOV' : 'Total GOV'}
                        </span>
                        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-primary">{formatCurrency(govRequiredAmount)}</span>
                    </div>
                    <div className="flex flex-col rounded-[10px] border border-border/70 bg-muted/30 px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
                        <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-0.5">
                            <Wallet className="h-2.5 w-2.5" /> Normal
                        </span>
                        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-foreground">{formatCurrency(calculatedBaseAmount)}</span>
                    </div>
                    <div className="flex flex-col rounded-[10px] border border-border/70 bg-muted/30 px-2 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
                        <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-0.5">
                            <Coins className="h-2.5 w-2.5" /> Gov Extra
                        </span>
                        <span className="mt-0.5 text-[11px] font-bold tabular-nums text-primary">{formatCurrency(calculatedExtraAmount)}</span>
                    </div>
                </div>
                {selectedReceiptCalculations.length > 0 && (
                    <div className="text-[9px] text-muted-foreground border border-dashed border-border/60 rounded-md px-2 py-1 bg-muted/20">
                        <span className="font-semibold">Entries: </span>
                        {selectedReceiptCalculations.map((calc, i) => (
                            <span key={calc.srNo || i}>
                                {i > 0 && ", "}
                                <span className="font-mono">{calc.srNo}</span>
                                <span className="text-muted-foreground/80"> (Norm: {formatCurrency(calc.normalAmount)}, Extra: {formatCurrency(calc.extraAmount)})</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Input fields - 3 per row, 2 rows */}
                <div className="grid grid-cols-3 gap-1.5">
                    {allowManualGovRate && (
                        <div className="space-y-0.5">
                            <Label className="text-[9px] font-medium text-foreground flex items-center gap-1">
                                <TrendingUp className="h-2.5 w-2.5" /> GOV Rate
                            </Label>
                            <Input
                                type="number"
                                value={manualGovRate || ''}
                                onChange={(e) => {
                                    setManualGovRate(Number(e.target.value) || 0);
                                    setHasManualInputRate(true);
                                }}
                                className="h-7 text-[9px] rounded-md border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background"
                                placeholder="e.g., 1800"
                            />
                        </div>
                    )}
                    <div className="space-y-0.5">
                        <Label className="text-[9px] font-medium text-foreground flex items-center gap-1">
                            <Target className="h-2.5 w-2.5" /> Target Amount
                        </Label>
                        <Input
                            type="number"
                            value={targetGovAmount || calcTargetAmount || ''}
                            onChange={(e) => {
                                const value = Number(e.target.value) || 0;
                                setTargetGovAmount(value);
                                setCalcTargetAmount?.(value);
                            }}
                            className="h-7 text-[9px] rounded-md border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background"
                            placeholder="e.g., 80000"
                        />
                    </div>
                    <div className="space-y-0.5">
                        <Label className="text-[9px] font-medium text-foreground flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" /> Extra Base
                        </Label>
                        <Select value={extraAmountBase} onValueChange={(v) => setExtraAmountBase(v as ExtraAmountBase)}>
                            <SelectTrigger className="h-7 text-[9px] rounded-md border border-border/80 bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="netQty">Net Qty</SelectItem>
                                <SelectItem value="finalQty">Final Qty</SelectItem>
                                <SelectItem value="outstanding">Outstanding</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {allowManualRsPerQtl && (
                        <div className="space-y-0.5">
                            <Label className="text-[9px] font-medium text-foreground flex items-center gap-1">
                                <Percent className="h-2.5 w-2.5" /> Extra Rs/Qtl
                            </Label>
                            <Input
                                type="number"
                                value={manualRsPerQtl ?? ''}
                                onChange={(e) => {
                                    setManualRsPerQtl(Number(e.target.value) || 0);
                                    setHasManualInputRs(true);
                                }}
                                className="h-7 text-[9px] rounded-md border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background"
                                placeholder="e.g., 100"
                            />
                        </div>
                    )}
                    {combination?.setBagSize != null && (
                        <div className="space-y-0.5">
                            <Label className="text-[9px] font-medium text-foreground flex items-center gap-1">
                                <Package className="h-2.5 w-2.5" /> Bag Weight
                            </Label>
                            <Input
                                type="number"
                                value={(combination.bagSize ?? bagWeight) || ''}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    if (!e.target.value || isNaN(v) || v <= 0) {
                                        combination.setBagSize(undefined);
                                        setBagWeight(0);
                                    } else {
                                        combination.setBagSize(v);
                                        setBagWeight(v);
                                    }
                                }}
                                className="h-7 text-[9px] rounded-md border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background"
                                placeholder="e.g., 50"
                            />
                        </div>
                    )}
                    <div className="space-y-0.5">
                        <Label className="text-[9px] font-medium text-foreground flex items-center gap-1">
                            <Coins className="h-2.5 w-2.5" /> Extra Calc
                        </Label>
                        <Select value={extraAmountBaseType} onValueChange={(v) => setExtraAmountBaseType(v as 'receipt' | 'target')}>
                            <SelectTrigger className="h-7 text-[9px] rounded-md border border-border/80 bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="receipt">Receipt Based</SelectItem>
                                <SelectItem value="target">Target Based</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* All toggles in one row: Extra Include / Final WT + Round Fig + Amount + Step */}
                <div className="grid grid-cols-4 gap-2 items-end">
                    {extraAmountBaseType === 'target' ? (
                        <div className="space-y-0.5 min-w-0">
                            <Label className="text-[9px] font-medium text-foreground">Extra Include</Label>
                            <button
                                type="button"
                                onClick={() => setTargetIncludesExtra(!targetIncludesExtra)}
                                className={cn(
                                    "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                )}
                            >
                                <span className={cn("absolute left-2 text-[9px] font-semibold z-0", targetIncludesExtra ? "text-muted-foreground/70" : "text-foreground")}>Base only</span>
                                <span className={cn("absolute right-2 text-[9px] font-semibold z-0", !targetIncludesExtra ? "text-muted-foreground/70" : "text-foreground")}>Includes extra</span>
                                <div className={cn(
                                    "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                    targetIncludesExtra ? "left-[calc(50%+2px)]" : "left-[2px]"
                                )}>
                                    <span className="text-[9px] font-bold text-primary-foreground">{targetIncludesExtra ? 'Extra' : 'Base'}</span>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-0.5 min-w-0">
                            <Label htmlFor={`finalWtToggle-${instanceId}`} className="text-[9px] font-medium text-foreground">Final WT</Label>
                            <button
                                id={`finalWtToggle-${instanceId}`}
                                type="button"
                                onClick={() => setUseFinalWeight(!useFinalWeight)}
                                className={cn(
                                    "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                )}
                            >
                                <span className={cn("absolute left-2 text-[9px] font-semibold z-0", useFinalWeight ? "text-muted-foreground/70" : "text-foreground")}>FW</span>
                                <span className={cn("absolute right-2 text-[9px] font-semibold z-0", !useFinalWeight ? "text-muted-foreground/70" : "text-foreground")}>On</span>
                                <div className={cn(
                                    "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                    useFinalWeight ? "left-[calc(50%+2px)]" : "left-[2px]"
                                )}>
                                    <span className="text-[9px] font-bold text-primary-foreground">{useFinalWeight ? 'On' : 'FW'}</span>
                                </div>
                            </button>
                        </div>
                    )}
                    {combination && (
                        <>
                            {/* Round Fig toggle - RF pill, same as RTGS Generate Payment Options */}
                            <div className="space-y-0.5 min-w-0">
                                <Label
                                    htmlFor={`roundFigToggle-${instanceId}`}
                                    className="text-[9px] font-medium text-foreground"
                                >
                                    Round Fig
                                </Label>
                                <button
                                    id={`roundFigToggle-${instanceId}`}
                                    type="button"
                                    onClick={() =>
                                        combination.setRoundFigureToggle(!combination.roundFigureToggle)
                                    }
                                    className={cn(
                                        "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "absolute left-2 text-[9px] font-semibold transition-colors z-0",
                                            !combination.roundFigureToggle
                                                ? "text-muted-foreground/70"
                                                : "text-foreground"
                                        )}
                                    >
                                        Off
                                    </span>
                                    <span
                                        className={cn(
                                            "absolute right-2 text-[9px] font-semibold transition-colors z-0",
                                            combination.roundFigureToggle
                                                ? "text-muted-foreground/70"
                                                : "text-foreground"
                                        )}
                                    >
                                        On
                                    </span>
                                    <div
                                        className={cn(
                                            "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                            combination.roundFigureToggle
                                                ? "left-[calc(50%+2px)]"
                                                : "left-[2px]"
                                        )}
                                    >
                                        <span className="text-[9px] font-bold text-primary-foreground">
                                            RF
                                        </span>
                                    </div>
                                </button>
                            </div>

                            {/* Amount toggle - ₹ Only vs ₹ + Paise */}
                            <div className="space-y-0.5 min-w-0">
                                <Label
                                    htmlFor={`amountToggle-${instanceId}`}
                                    className="text-[9px] font-medium text-foreground"
                                >
                                    Amount
                                </Label>
                                <button
                                    id={`amountToggle-${instanceId}`}
                                    type="button"
                                    onClick={() =>
                                        combination.setAllowPaiseAmount(!combination.allowPaiseAmount)
                                    }
                                    className={cn(
                                        "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "absolute left-2 text-[9px] font-semibold transition-colors z-0",
                                            !combination.allowPaiseAmount
                                                ? "text-muted-foreground/70"
                                                : "text-foreground"
                                        )}
                                    >
                                        ₹
                                    </span>
                                    <span
                                        className={cn(
                                            "absolute right-2 text-[9px] font-semibold transition-colors z-0",
                                            combination.allowPaiseAmount
                                                ? "text-muted-foreground/70"
                                                : "text-foreground"
                                        )}
                                    >
                                        ₹+Ps
                                    </span>
                                    <div
                                        className={cn(
                                            "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                            combination.allowPaiseAmount
                                                ? "left-[calc(50%+2px)]"
                                                : "left-[2px]"
                                        )}
                                    >
                                        <span className="text-[9px] font-bold text-primary-foreground">
                                            {combination.allowPaiseAmount ? "₹+Ps" : "₹"}
                                        </span>
                                    </div>
                                </button>
                            </div>

                            {/* Step toggle - ÷1 vs ÷5 */}
                            <div className="space-y-0.5 min-w-0">
                                <Label
                                    htmlFor={`stepToggle-${instanceId}`}
                                    className="text-[9px] font-medium text-foreground"
                                >
                                    Step
                                </Label>
                                <button
                                    id={`stepToggle-${instanceId}`}
                                    type="button"
                                    onClick={() =>
                                        combination.setRateStep(
                                            combination.rateStep === 1 ? 5 : 1
                                        )
                                    }
                                    className={cn(
                                        "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "absolute left-2 text-[9px] font-semibold transition-colors z-0",
                                            combination.rateStep === 1
                                                ? "text-muted-foreground/70"
                                                : "text-foreground"
                                        )}
                                    >
                                        +1
                                    </span>
                                    <span
                                        className={cn(
                                            "absolute right-2 text-[9px] font-semibold transition-colors z-0",
                                            combination.rateStep === 5
                                                ? "text-muted-foreground/70"
                                                : "text-foreground"
                                        )}
                                    >
                                        +5
                                    </span>
                                    <div
                                        className={cn(
                                            "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                            combination.rateStep === 5
                                                ? "left-[calc(50%+2px)]"
                                                : "left-[2px]"
                                        )}
                                    >
                                        <span className="text-[9px] font-bold text-primary-foreground">
                                            +{combination.rateStep}
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </>
                    )}
                </div>


                {/* Action Buttons - Compact */}
                <div className="grid grid-cols-2 gap-2">
                    {combination && (
                        <Button
                            onClick={handleGenerateWithExtraBase}
                            size="sm"
                            className="h-7 text-[9px] rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/80"
                        >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Generate
                        </Button>
                    )}
                    <Button
                        onClick={handleCalculateCombinations}
                        size="sm"
                        className="h-7 text-[9px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/80 disabled:opacity-50 disabled:pointer-events-none"
                        disabled={targetGovAmount <= 0 || receiptCalculations.length === 0}
                    >
                        <Calculator className="h-3 w-3 mr-1" />
                        Calculate
                    </Button>
                </div>
            </CardContent>
        </Card>

    </div>
    );
};
