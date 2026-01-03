"use client";

import React, { useState, useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { ExtraAmountBase } from "@/hooks/use-payment-combination";
import { Calculator, Receipt, Target, Package, Sparkles, TrendingUp, Wallet, Coins } from "lucide-react";

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
    extraAmountPerQuintal: number;
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
        handleGeneratePaymentOptions: (overrideValues?: { extraAmountBase?: ExtraAmountBase; selectedReceipts?: any[]; calcTargetAmount?: number; bagSize?: number }) => void;
        requestSort: (key: any) => void;
    };
    selectPaymentAmount?: (option: any) => void;
}

export const GovReceiptSelector: React.FC<GovReceiptSelectorProps> = ({
    availableReceipts,
    govRate: initialGovRate,
    extraAmountPerQuintal: initialExtraAmountPerQuintal,
    onSelectReceipts,
    selectedReceiptIds,
    allowManualRsPerQtl = false,
    allowManualGovRate = false,
    calcTargetAmount = 0,
    setCalcTargetAmount,
    combination,
    selectPaymentAmount,
}) => {
    const [targetGovAmount, setTargetGovAmount] = useState<number>(0);
    const [extraAmountBase, setExtraAmountBase] = useState<ExtraAmountBase>('outstanding');
    const [extraAmountBaseType, setExtraAmountBaseType] = useState<'receipt' | 'target'>('receipt'); // For EXTRA summary calculation
    const [targetIncludesExtra, setTargetIncludesExtra] = useState<boolean>(false); // Whether target amount includes extra
    const [useFinalWeight, setUseFinalWeight] = useState<boolean>(false); // Whether to use final weight calculation for extra amount
    const [manualGovRate, setManualGovRate] = useState<number>(initialGovRate);
    const [manualRsPerQtl, setManualRsPerQtl] = useState<number>(initialExtraAmountPerQuintal);
    const [bagWeight, setBagWeight] = useState<number>(0);
    const [hasManualInputRate, setHasManualInputRate] = useState(false);
    const [hasManualInputRs, setHasManualInputRs] = useState(false);
    const [suggestions, setSuggestions] = useState<Combination[]>([]);

    const govRate = hasManualInputRate ? manualGovRate : initialGovRate;
    const extraAmountPerQuintal = hasManualInputRs ? manualRsPerQtl : initialExtraAmountPerQuintal;

    // Get selected receipts for extra amount base calculation
    const selectedReceipts = useMemo(() => {
        return availableReceipts.filter(receipt => {
            const receiptId = receipt.id || receipt.srNo;
            return selectedReceiptIds.has(receiptId);
        });
    }, [availableReceipts, selectedReceiptIds]);

    // Wrapper function to pass extraAmountBase, selectedReceipts, govRequiredAmount as calcTargetAmount, and bagWeight as bagSize to handleGeneratePaymentOptions
    // IMPORTANT: Generate options based on Required GOV amount (includes extra), no extra calculation in generation
    const handleGenerateWithExtraBase = () => {
        if (combination?.handleGeneratePaymentOptions) {
            // Use govRequiredAmount (Required GOV) as calcTargetAmount for generation
            // This is the final amount that needs to be paid (base + extra already included)
            const requiredGovForGeneration = govRequiredAmount > 0 ? govRequiredAmount : totalAvailableGov;
            
            combination.handleGeneratePaymentOptions({
                extraAmountBase,
                selectedReceipts,
                calcTargetAmount: requiredGovForGeneration, // Use Required GOV (includes extra) instead of base amount
                bagSize: bagWeight > 0 ? bagWeight : undefined, // Pass bagWeight as bagSize
                minRate: govRate || 0, // Pass govRate as minRate for validation
                maxRate: govRate || 0, // Pass govRate as maxRate for validation
                rsValue: 0, // No extra calculation in generation - set to 0
            });
        }
    };

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
                const finalQuantity = Number(receipt.weight) || 0;
                
                let baseForExtraAmount = 0;
                if (extraAmountBase === 'netQty') {
                    baseForExtraAmount = actualQuantity;
                } else if (extraAmountBase === 'finalQty') {
                    baseForExtraAmount = finalQuantity;
                } else { // 'outstanding'
                    baseForExtraAmount = govRate > 0 ? normalAmount / govRate : 0;
                }

                const baseQuantity = govRate > 0 ? normalAmount / govRate : 0;
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
    }, [availableReceipts, govRate, extraAmountPerQuintal, extraAmountBase, manualGovRate, manualRsPerQtl]);

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
    
    // Calculate base amount based on extraAmountBase selection
    const baseAmountForExtra = useMemo(() => {
        if (selectedReceiptCalculations.length === 0) return 0;
        
        if (extraAmountBase === 'netQty') {
            // Sum of net weights from selected receipts
            return selectedReceiptCalculations.reduce((sum, calc) => {
                return sum + (Number(calc.receipt.netWeight) || 0);
            }, 0);
        } else if (extraAmountBase === 'finalQty') {
            // Sum of final weights from selected receipts
            return selectedReceiptCalculations.reduce((sum, calc) => {
                return sum + (Number(calc.receipt.weight) || 0);
            }, 0);
        } else {
            // 'outstanding' - use totalSelectedNormal (outstanding amount)
            return totalSelectedNormal;
        }
    }, [selectedReceiptCalculations, extraAmountBase, totalSelectedNormal]);
    
    // Calculate Base Amount (Normal) and EXTRA amount based on extraAmountBaseType
    // IMPORTANT: Normal = Outstanding (always), Extra = Calculated Extra, Required GOV = Normal + Extra
    const { calculatedBaseAmount, calculatedExtraAmount } = useMemo(() => {
        // Normal (Base) is ALWAYS outstanding amount (totalSelectedNormal)
        const normalAmount = totalSelectedNormal;
        
        if (extraAmountBaseType === 'target') {
            // Target-based calculation
            // IMPORTANT: Normal = Outstanding (always), Extra = Target amount ke hisaab se calculate
            const targetAmt = targetGovAmount > 0 
                ? targetGovAmount 
                : (typeof calcTargetAmount === 'function' ? calcTargetAmount() : (calcTargetAmount || 0));
            const currentGovRate = govRate || 0;
            const currentExtraRate = hasManualInputRs ? (manualRsPerQtl || 0) : (extraAmountPerQuintal || 0);
            
            if (currentGovRate > 0 && targetAmt > 0 && currentExtraRate > 0) {
                if (targetIncludesExtra) {
                    // Target Amount INCLUDES extra: Calculate base and extra from total
                    // Formula: Total = Base + Extra, where Extra = (Base / Gov Rate) * Extra Rate
                    // Total = Base + (Base / Gov Rate) * Extra Rate
                    // Total = Base * (1 + Extra Rate / Gov Rate)
                    // Base = Total / (1 + Extra Rate / Gov Rate)
                    const baseAmount = targetAmt / (1 + (currentExtraRate / currentGovRate));
                    const extraAmount = targetAmt - baseAmount;
                    // Normal is always outstanding, Extra is calculated from target amount
                    return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: extraAmount };
                } else {
                    // Target Amount is BASE only: Calculate extra from target amount
                    // Extra = (Target Amount / Gov Rate) * Extra Rate
                    const extraAmount = (targetAmt / currentGovRate) * currentExtraRate;
                    // Normal is always outstanding, Extra is calculated from target amount
                    return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: extraAmount };
                }
            }
            return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: 0 };
        } else {
            // Receipt-based: Calculate extra based on extraAmountBase and useFinalWeight toggle
            // IMPORTANT: Normal (Base) = totalSelectedNormal (outstanding amount of selected receipts)
            const currentGovRate = govRate || 0;
            const currentExtraRate = hasManualInputRs ? (manualRsPerQtl || 0) : (extraAmountPerQuintal || 0);
            
            // Normal (Base) is always totalSelectedNormal (outstanding amount)
            const normalAmount = totalSelectedNormal;
            
            // Use baseAmountForExtra which is calculated based on extraAmountBase selection for extra calculation
            let baseAmountForExtraCalc = 0;
            if (extraAmountBase === 'netQty' || extraAmountBase === 'finalQty') {
                // For netQty/finalQty: baseAmountForExtraCalc = baseAmountForExtra (quantity)
                baseAmountForExtraCalc = baseAmountForExtra;
                
                if (useFinalWeight && currentExtraRate > 0 && baseAmountForExtraCalc > 0) {
                    // Final WT ON: Extra = (((baseAmountForExtraCalc * Extra Rate) + baseAmountForExtraCalc) / Gov Rate) * Extra Rate
                    const baseAmountInRs = baseAmountForExtraCalc * currentGovRate; // Convert quantity to amount
                    const initialExtra = baseAmountForExtraCalc * currentExtraRate;
                    const totalWithInitialExtra = initialExtra + baseAmountInRs;
                    const finalExtra = (totalWithInitialExtra / currentGovRate) * currentExtraRate;
                    return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: finalExtra };
                } else {
                    // Final WT OFF: Extra = baseAmountForExtraCalc * Extra Rate per Quintal
                    const extraAmount = baseAmountForExtraCalc * currentExtraRate;
                    return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: extraAmount };
                }
            } else {
                // 'outstanding': baseAmountForExtraCalc = baseAmountForExtra (outstanding amount in Rs)
                baseAmountForExtraCalc = baseAmountForExtra;
                
                if (useFinalWeight && currentGovRate > 0 && currentExtraRate > 0 && baseAmountForExtraCalc > 0) {
                    // Final WT ON: Extra = (((baseAmountForExtraCalc / Gov Rate) * Extra Rate + baseAmountForExtraCalc) / Gov Rate) * Extra Rate
                    const initialExtra = (baseAmountForExtraCalc / currentGovRate) * currentExtraRate;
                    const totalWithInitialExtra = initialExtra + baseAmountForExtraCalc;
                    const finalExtra = (totalWithInitialExtra / currentGovRate) * currentExtraRate;
                    return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: finalExtra };
                } else {
                    // Final WT OFF: Extra = (baseAmountForExtraCalc / Gov Rate) * Extra Rate
                    const extraAmount = currentGovRate > 0 && currentExtraRate > 0 && baseAmountForExtraCalc > 0
                        ? (baseAmountForExtraCalc / currentGovRate) * currentExtraRate
                        : 0;
                    return { calculatedBaseAmount: normalAmount, calculatedExtraAmount: extraAmount };
                }
            }
        }
    }, [extraAmountBaseType, targetGovAmount, calcTargetAmount, govRate, hasManualInputRs, manualRsPerQtl, extraAmountPerQuintal, targetIncludesExtra, totalSelectedGov, totalSelectedNormal, useFinalWeight, baseAmountForExtra, extraAmountBase]);
    
    // Calculate Gov Required Amount: ALWAYS = Normal (Base) + Extra
    // IMPORTANT: Required GOV must always equal Normal + Extra
    const govRequiredAmount = useMemo(() => {
        // Required GOV = Normal (Base) + Extra (always)
        return calculatedBaseAmount + calculatedExtraAmount;
    }, [calculatedBaseAmount, calculatedExtraAmount]);

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
        setSuggestions(allCombinations.slice(0, MAX_COMBINATIONS_TO_RETURN));
    };

    const handleSelectCombination = (combination: Combination) => {
        const receiptIds = combination.receipts.map(r => r.id || r.srNo);
        onSelectReceipts(receiptIds);
    };

    // Calculate grid columns for input fields
    const inputFieldCount = (allowManualGovRate ? 1 : 0) + (allowManualRsPerQtl ? 2 : 0) + 1 + (combination && combination.bagSize !== undefined && combination.setBagSize ? 1 : 0);
    const inputGridCols = inputFieldCount === 5 ? 'grid-cols-5' : inputFieldCount === 4 ? 'grid-cols-4' : inputFieldCount === 3 ? 'grid-cols-3' : inputFieldCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

    return (
        <Card className="text-[10px] border-2 border-primary/25 shadow-2xl bg-gradient-to-br from-card via-card/98 to-card/95 backdrop-blur-md">
            <CardHeader className="pb-2 px-3 pt-2.5 bg-gradient-to-r from-primary/18 via-primary/12 to-primary/8 border-b-2 border-primary/25 shadow-sm">
                <CardTitle className="text-[11px] font-extrabold flex items-center gap-2 text-foreground tracking-tight">
                    <div className="p-1 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-md">
                        <Calculator className="h-3.5 w-3.5 text-primary drop-shadow-sm" />
                    </div>
                    <span className="bg-gradient-to-r from-foreground to-foreground/90 bg-clip-text text-transparent">GOV Receipt Selection Helper</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
                {/* Summary - Compact 4 Column Layout */}
                <div className="grid grid-cols-4 gap-1.5 p-2 bg-gradient-to-br from-primary/12 via-muted/85 to-muted/65 rounded-lg border-2 border-primary/20 shadow-xl">
                    <div className="flex flex-col items-center justify-center text-center px-1.5 py-1.5 rounded-md bg-background/50 border-2 border-border/40 hover:bg-primary/15 hover:border-primary/40 hover:shadow-md transition-all duration-300 group cursor-pointer">
                        <div className="p-1 rounded-md bg-muted/80 border-2 border-border/50 mb-1 group-hover:bg-primary/25 group-hover:border-primary/40 group-hover:scale-110 transition-all shadow-sm">
                            <Receipt className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-[9px] text-muted-foreground font-extrabold mb-0.5 uppercase tracking-wide">Available</span>
                        <span className="font-black text-foreground text-[12px] leading-none px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">{displayReceiptCalculations.length}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center px-1.5 py-1.5 rounded-md bg-primary/18 border-2 border-primary/30 hover:bg-primary/25 hover:border-primary/45 hover:shadow-lg transition-all duration-300 group cursor-pointer shadow-md">
                        <div className="p-1 rounded-md bg-primary/30 border-2 border-primary/45 mb-1 group-hover:bg-primary/40 group-hover:scale-110 transition-all shadow-md">
                            <TrendingUp className="h-3.5 w-3.5 text-primary drop-shadow-sm" />
                        </div>
                        <span className="text-[9px] text-muted-foreground font-extrabold mb-0.5 uppercase tracking-wide">
                            {extraAmountBaseType === 'target' ? 'Required GOV' : 'Total GOV'}
                        </span>
                        <span className="font-black text-primary text-[12px] leading-none px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/30">
                            {formatCurrency(govRequiredAmount)}
                        </span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center px-1.5 py-1.5 rounded-md bg-background/50 border-2 border-border/40 hover:bg-primary/15 hover:border-primary/40 hover:shadow-md transition-all duration-300 group cursor-pointer">
                        <div className="p-1 rounded-md bg-muted/80 border-2 border-border/50 mb-1 group-hover:bg-primary/25 group-hover:border-primary/40 group-hover:scale-110 transition-all shadow-sm">
                            <Wallet className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-[9px] text-muted-foreground font-extrabold mb-0.5 uppercase tracking-wide">Normal</span>
                        <span className="font-black text-foreground text-[12px] leading-none px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">{formatCurrency(calculatedBaseAmount)}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center px-1.5 py-1.5 rounded-md bg-primary/18 border-2 border-primary/30 hover:bg-primary/25 hover:border-primary/45 hover:shadow-lg transition-all duration-300 group cursor-pointer shadow-md">
                        <div className="p-1 rounded-md bg-primary/30 border-2 border-primary/45 mb-1 group-hover:bg-primary/40 group-hover:scale-110 transition-all shadow-md">
                            <Coins className="h-3.5 w-3.5 text-primary drop-shadow-sm" />
                        </div>
                        <span className="text-[9px] text-muted-foreground font-extrabold mb-0.5 uppercase tracking-wide">Extra</span>
                        <span className="font-black text-primary text-[12px] leading-none px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/30">
                            {formatCurrency(calculatedExtraAmount)}
                        </span>
                        {extraAmountBaseType === 'target' && calculatedBaseAmount > 0 && (
                            <span className="text-[8px] text-muted-foreground mt-0.5">
                                Base: {formatCurrency(calculatedBaseAmount)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Rate & Amount Configuration - Compact Grid */}
                <div className="grid grid-cols-2 gap-2">
                    {allowManualGovRate && (
                        <div className="space-y-1">
                            <Label className="text-[10px] font-extrabold flex items-center gap-1.5 text-foreground">
                                <div className="p-0.5 rounded bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 shadow-sm">
                                    <TrendingUp className="h-2.5 w-2.5 text-primary" />
                                </div>
                                GOV Rate
                            </Label>
                            <Input
                                type="number"
                                value={manualGovRate || ''}
                                onChange={(e) => {
                                    setManualGovRate(Number(e.target.value) || 0);
                                    setHasManualInputRate(true);
                                }}
                                className="h-8 text-[10px] border-2 border-primary/25 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all bg-background/80 shadow-inner"
                                placeholder="e.g., 1500"
                            />
                        </div>
                    )}
                    {allowManualRsPerQtl && (
                        <div className="space-y-1">
                            <Label className="text-[10px] font-extrabold flex items-center gap-1.5 text-foreground">
                                <div className="p-0.5 rounded bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 shadow-sm">
                                    <Coins className="h-2.5 w-2.5 text-primary" />
                                </div>
                                Extra Rs/Qtl
                            </Label>
                            <Input
                                type="number"
                                value={manualRsPerQtl || ''}
                                onChange={(e) => {
                                    setManualRsPerQtl(Number(e.target.value) || 0);
                                    setHasManualInputRs(true);
                                }}
                                className="h-8 text-[10px] border-2 border-primary/25 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all bg-background/80 shadow-inner"
                                placeholder="e.g., 100"
                            />
                        </div>
                    )}
                    <div className="space-y-1">
                        <Label className="text-[10px] font-extrabold flex items-center gap-1.5 text-foreground">
                            <div className="p-0.5 rounded bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 shadow-sm">
                                <Target className="h-2.5 w-2.5 text-primary" />
                            </div>
                            Target Amount
                        </Label>
                        <Input
                            type="number"
                            value={targetGovAmount || calcTargetAmount || ''}
                            onChange={(e) => {
                                const value = Number(e.target.value) || 0;
                                setTargetGovAmount(value);
                                // Also update calcTargetAmount if setCalcTargetAmount is provided
                                if (setCalcTargetAmount) {
                                    setCalcTargetAmount(value);
                                }
                            }}
                            className="h-8 text-[10px] border-2 border-primary/25 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all bg-background/80 shadow-inner"
                            placeholder="e.g., 80000"
                        />
                    </div>
                    {allowManualRsPerQtl && (
                        <div className="space-y-1">
                            <Label className="text-[10px] font-extrabold flex items-center gap-1.5 text-foreground">
                                <div className="p-0.5 rounded bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 shadow-sm">
                                    <Package className="h-2.5 w-2.5 text-primary" />
                                </div>
                                Bag Weight
                            </Label>
                            <Input
                                type="number"
                                value={bagWeight || ''}
                                onChange={(e) => setBagWeight(Number(e.target.value) || 0)}
                                className="h-8 text-[10px] border-2 border-primary/25 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all bg-background/80 shadow-inner"
                                placeholder="e.g., 50"
                            />
                        </div>
                    )}
                    {combination && combination.bagSize !== undefined && combination.setBagSize && !allowManualRsPerQtl && (
                        <div className="space-y-1">
                            <Label className="text-[10px] font-extrabold flex items-center gap-1.5 text-foreground">
                                <div className="p-0.5 rounded bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 shadow-sm">
                                    <Package className="h-2.5 w-2.5 text-primary" />
                                </div>
                                Bag Qty
                            </Label>
                            <Input
                                type="number"
                                value={combination.bagSize ?? ''}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    if (!e.target.value || isNaN(v) || v <= 0) {
                                        combination.setBagSize(undefined);
                                    } else {
                                        combination.setBagSize(v);
                                    }
                                }}
                                className="h-8 text-[10px] border-2 border-primary/25 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all bg-background/80 shadow-inner"
                                placeholder="Per bag qty"
                            />
                        </div>
                    )}
                </div>

                {/* Settings & Controls - Two Row Layout */}
                <div className="space-y-2">
                    {/* First Row: Extra Base, Extra Calc, Extra Include, Final WT */}
                    <div className={cn("grid gap-2", 
                        extraAmountBaseType === 'target' ? "grid-cols-3" : "grid-cols-3"
                    )}>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-extrabold flex items-center gap-1.5 text-foreground">
                            <div className="p-0.5 rounded bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 shadow-sm">
                                <Sparkles className="h-2.5 w-2.5 text-primary" />
                            </div>
                            Extra Base
                        </Label>
                        <Select value={extraAmountBase} onValueChange={(v) => setExtraAmountBase(v as ExtraAmountBase)}>
                            <SelectTrigger className="h-8 text-[10px] border-2 border-primary/25 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all bg-background/80 shadow-inner">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="netQty">Net Qty</SelectItem>
                                <SelectItem value="finalQty">Final Qty</SelectItem>
                                <SelectItem value="outstanding">Outstanding</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-extrabold flex items-center gap-1.5 text-foreground">
                                <div className="p-0.5 rounded bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 shadow-sm">
                                    <Coins className="h-2.5 w-2.5 text-primary" />
                                </div>
                                Extra Calc
                            </Label>
                            <Select value={extraAmountBaseType} onValueChange={(v) => setExtraAmountBaseType(v as 'receipt' | 'target')}>
                                <SelectTrigger className="h-8 text-[10px] border-2 border-primary/25 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all bg-background/80 shadow-inner">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="receipt">Receipt Based</SelectItem>
                                    <SelectItem value="target">Target Based</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         {extraAmountBaseType === 'target' ? (
                             <div className="space-y-1">
                                 <Label className="text-[10px] font-extrabold flex items-center gap-1.5 text-foreground">
                                     <div className="p-0.5 rounded bg-gradient-to-br from-primary/15 to-primary/8 border border-primary/25 shadow-sm">
                                         <Calculator className="h-2.5 w-2.5 text-primary" />
                                     </div>
                                     Extra Include
                                 </Label>
                                 <button
                                     type="button"
                                     onClick={() => setTargetIncludesExtra(!targetIncludesExtra)}
                                     className="relative w-full min-w-[140px] h-8 flex items-center rounded-md p-1 cursor-pointer border-2 border-border/55 bg-muted/75 overflow-hidden text-[9px] shadow-md hover:shadow-lg hover:border-primary/30"
                                 >
                                     <span className="absolute left-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">Base only</span>
                                     <span className="absolute right-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">Includes extra</span>
                                     <div
                                         className={cn(
                                             "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-md shadow-xl flex items-center justify-center z-10 border",
                                             targetIncludesExtra 
                                                 ? "left-[calc(50%+2px)] border-primary"
                                                 : "left-[2px] border-[hsl(160_40%_20%)]"
                                         )}
                                         style={{
                                             backgroundColor: targetIncludesExtra 
                                                 ? 'hsl(160 40% 45%)' // Light green for ON
                                                 : 'hsl(160 40% 20%)' // Dark green for OFF
                                         }}
                                     >
                                         <span className="text-[9px] font-black text-primary-foreground drop-shadow-sm">
                                             {targetIncludesExtra ? 'Extra' : 'Base'}
                                         </span>
                                     </div>
                                 </button>
                             </div>
                         ) : (
                             <div className="space-y-1">
                                 <Label className="text-[10px] font-extrabold text-foreground">Final WT</Label>
                                 <button
                                     type="button"
                                     onClick={() => setUseFinalWeight(!useFinalWeight)}
                                     className="relative w-full min-w-[140px] h-8 flex items-center rounded-md p-1 cursor-pointer border-2 border-border/55 bg-muted/75 overflow-hidden text-[9px] shadow-md hover:shadow-lg hover:border-primary/30"
                                 >
                                     <span className="absolute left-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">Off</span>
                                     <span className="absolute right-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">On</span>
                                     <div
                                         className={cn(
                                             "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-md shadow-xl flex items-center justify-center z-10 border",
                                             useFinalWeight 
                                                 ? "left-[calc(50%+2px)] border-primary"
                                                 : "left-[2px] border-[hsl(160_40%_20%)]"
                                         )}
                                         style={{
                                             backgroundColor: useFinalWeight 
                                                 ? 'hsl(160 40% 45%)' // Light green for ON
                                                 : 'hsl(160 40% 20%)' // Dark green for OFF
                                         }}
                                     >
                                         <span className="text-[9px] font-black text-primary-foreground drop-shadow-sm">FW</span>
                                     </div>
                                 </button>
                             </div>
                         )}
                    </div>
                    
                    {/* Second Row: Round Fig, Amount, Step (only when combination exists) */}
                    {combination && (
                        <div className="grid gap-2 grid-cols-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-extrabold text-foreground">Round Fig</Label>
                                <button
                                    type="button"
                                    onClick={() => combination.setRoundFigureToggle(!combination.roundFigureToggle)}
                                    className="relative w-full min-w-[120px] h-8 flex items-center rounded-md p-1 cursor-pointer border-2 border-border/55 bg-muted/75 overflow-hidden text-[9px] shadow-md hover:shadow-lg hover:border-primary/30"
                                >
                                    <span className="absolute left-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">Off</span>
                                    <span className="absolute right-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">On</span>
                                    <div
                                        className={cn(
                                            "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-md shadow-xl flex items-center justify-center z-10 border",
                                            combination.roundFigureToggle 
                                                ? "left-[calc(50%+2px)] border-primary"
                                                : "left-[2px] border-[hsl(160_40%_20%)]"
                                        )}
                                        style={{
                                            backgroundColor: combination.roundFigureToggle 
                                                ? 'hsl(160 40% 45%)' // Light green for ON
                                                : 'hsl(160 40% 20%)' // Dark green for OFF
                                        }}
                                    >
                                        <span className="text-[9px] font-black text-primary-foreground drop-shadow-sm">RF</span>
                                    </div>
                                </button>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-extrabold text-foreground">Amount</Label>
                                <button
                                    type="button"
                                    onClick={() => combination.setAllowPaiseAmount(!combination.allowPaiseAmount)}
                                    className="relative w-full min-w-[120px] h-8 flex items-center rounded-md p-1 cursor-pointer border-2 border-border/55 bg-muted/75 overflow-hidden text-[9px] shadow-md hover:shadow-lg hover:border-primary/30"
                                >
                                    <span className="absolute left-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">₹ Only</span>
                                    <span className="absolute right-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">₹+Ps</span>
                                    <div
                                        className={cn(
                                            "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-md shadow-xl flex items-center justify-center z-10 border",
                                            combination.allowPaiseAmount 
                                                ? "left-[calc(50%+2px)] border-primary"
                                                : "left-[2px] border-[hsl(160_40%_20%)]"
                                        )}
                                        style={{
                                            backgroundColor: combination.allowPaiseAmount 
                                                ? 'hsl(160 40% 45%)' // Light green for ON
                                                : 'hsl(160 40% 20%)' // Dark green for OFF
                                        }}
                                    >
                                        <span className="text-[9px] font-black text-primary-foreground drop-shadow-sm">
                                            {combination.allowPaiseAmount ? "₹.ps" : "₹"}
                                        </span>
                                    </div>
                                </button>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-extrabold text-foreground">Step</Label>
                                <button
                                    type="button"
                                    onClick={() => combination.setRateStep(combination.rateStep === 1 ? 5 : 1)}
                                    className="relative w-full min-w-[120px] h-8 flex items-center rounded-md p-1 cursor-pointer border-2 border-border/55 bg-muted/75 overflow-hidden text-[9px] shadow-md hover:shadow-lg hover:border-primary/30"
                                >
                                    <span className="absolute left-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">÷1</span>
                                    <span className="absolute right-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">÷5</span>
                                    <div
                                        className={cn(
                                            "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-md shadow-xl flex items-center justify-center z-10 border",
                                            combination.rateStep === 5 
                                                ? "left-[calc(50%+2px)] border-primary"
                                                : "left-[2px] border-[hsl(160_40%_20%)]"
                                        )}
                                        style={{
                                            backgroundColor: combination.rateStep === 5 
                                                ? 'hsl(160 40% 45%)' // Light green for ON
                                                : 'hsl(160 40% 20%)' // Dark green for OFF
                                        }}
                                    >
                                        <span className="text-[9px] font-black text-primary-foreground drop-shadow-sm">
                                            ÷{combination.rateStep}
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>


                {/* Action Buttons - Compact */}
                <div className="grid grid-cols-2 gap-2">
                    {combination && (
                        <Button
                            onClick={handleGenerateWithExtraBase}
                            size="sm"
                            className="h-8 text-[10px] font-extrabold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary via-primary/95 to-primary/90 hover:from-primary/95 hover:via-primary hover:to-primary/95 border-2 border-primary/35 hover:border-primary/45"
                        >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Generate
                        </Button>
                    )}
                    <Button
                        onClick={handleCalculateCombinations}
                        size="sm"
                        className="h-8 text-[10px] font-extrabold shadow-lg hover:shadow-xl transition-all border-2 border-primary/25 hover:border-primary/35 bg-background/80 hover:bg-background/95"
                        disabled={targetGovAmount <= 0 || receiptCalculations.length === 0}
                    >
                        <Calculator className="h-3 w-3 mr-1" />
                        Calculate
                    </Button>
                </div>

                {/* Suggestions Table - Enhanced */}
                {suggestions.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                        <div className="text-[10px] font-bold mb-2 flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-primary" />
                            Suggested Combinations
                        </div>
                        <div className="max-h-[300px] overflow-y-auto rounded-md border border-border/50">
                            <Table>
                                <TableHeader>
                                    <TableRow className="h-7 bg-muted/50">
                                        <TableHead className="text-[9px] w-[30px] font-bold">Select</TableHead>
                                        <TableHead className="text-[9px] font-bold">Type</TableHead>
                                        <TableHead className="text-[9px] font-bold">Receipts</TableHead>
                                        <TableHead className="text-[9px] font-bold">Total GOV</TableHead>
                                        <TableHead className="text-[9px] font-bold">Excess</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suggestions.map((comb, idx) => (
                                        <TableRow key={idx} className="h-7 hover:bg-muted/30 transition-colors">
                                            <TableCell className="text-[9px]">
                                                <Checkbox
                                                    checked={comb.receipts.every(r => selectedReceiptIds.has(r.id || r.srNo))}
                                                    onCheckedChange={() => handleSelectCombination(comb)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-[9px] font-medium">{comb.type}</TableCell>
                                            <TableCell className="text-[9px]">
                                                {comb.details.map(d => d.srNo).join(', ')}
                                            </TableCell>
                                            <TableCell className="text-[9px] font-bold text-primary">
                                                {formatCurrency(comb.totalGov)}
                                            </TableCell>
                                            <TableCell className={cn(
                                                "text-[9px] font-semibold",
                                                comb.difference > 0 ? "text-primary" : "text-muted-foreground"
                                            )}>
                                                {comb.difference > 0 ? `+${formatCurrency(comb.difference)}` : formatCurrency(comb.difference)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
