"use client";

import { useState, useMemo, useEffect } from "react";

export type ExtraAmountBase = 'outstanding' | 'netQty' | 'finalQty';

export interface ReceiptGovCalculation {
  receipt: any;
  normalAmount: number;
  govAmount: number;
  extraAmount: number;
  quantity: number;
  baseQuantity: number;
  rate: number;
  srNo: string;
}

export interface Combination {
  receipts: any[];
  details: ReceiptGovCalculation[];
  totalGov: number;
  totalNormal: number;
  totalExtra: number;
  totalQuantity: number;
  difference: number;
  type: 'single' | 'pair' | 'triplet' | 'multiple';
}

interface UseGovReceiptLogicProps {
  availableReceipts: any[];
  initialGovRate: number;
  initialExtraAmountPerQuintal: number;
  selectedReceiptIds: Set<string>;
  calcTargetAmountProp?: number;
  setCalcTargetAmountProp?: (value: number) => void;
  onExtraAmountChange?: (extraAmount: number) => void;
  onSuggestionsChange?: (suggestions: Combination[]) => void;
  combinationProps?: {
    bagSize?: number;
    setBagSize: (value: number | undefined) => void;
    handleGeneratePaymentOptions: (overrideValues?: any) => void;
  };
}

export function useGovReceiptLogic({
  availableReceipts,
  initialGovRate,
  initialExtraAmountPerQuintal,
  selectedReceiptIds,
  calcTargetAmountProp,
  setCalcTargetAmountProp,
  onExtraAmountChange,
  onSuggestionsChange,
  combinationProps
}: UseGovReceiptLogicProps) {
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

  const selectedReceiptCalculations = useMemo(() => {
    if (selectedReceiptIds.size > 0) {
      return receiptCalculations.filter(calc => {
        const receiptId = calc.receipt.id || calc.receipt.srNo;
        return selectedReceiptIds.has(receiptId);
      });
    }
    return receiptCalculations;
  }, [receiptCalculations, selectedReceiptIds]);

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
      const targetAmt = targetGovAmount > 0 ? targetGovAmount : (typeof calcTargetAmountProp === 'number' ? calcTargetAmountProp : 0);
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
  }, [extraAmountBaseType, targetGovAmount, calcTargetAmountProp, govRate, extraAmountPerQuintal, targetIncludesExtra, totalSelectedNormal, useFinalWeight, baseAmountForExtra, extraAmountBase]);

  const govRequiredAmount = calculatedBaseAmount + calculatedExtraAmount;

  useEffect(() => {
    if (onExtraAmountChange) {
      const roundedExtra = Math.round(calculatedExtraAmount);
      onExtraAmountChange(roundedExtra > 0 ? roundedExtra : 0);
    }
  }, [calculatedExtraAmount, onExtraAmountChange]);

  const handleGenerateWithExtraBase = () => {
    if (combinationProps?.handleGeneratePaymentOptions) {
      const requiredGovForGeneration = govRequiredAmount > 0 ? govRequiredAmount : totalAvailableGov;
      combinationProps.handleGeneratePaymentOptions({
        selectedReceipts,
        targetAmount: requiredGovForGeneration,
        bagSize: bagWeight > 0 ? bagWeight : combinationProps?.bagSize ? combinationProps.bagSize : undefined,
        minRate: govRate || 0,
        maxRate: govRate || 0,
        rsValue: 0,
      });
    }
  };

  const handleCalculateCombinations = () => {
    const currentTarget = targetGovAmount || calcTargetAmountProp || 0;
    if (currentTarget <= 0 || receiptCalculations.length === 0) return;

    const MAX_COMBINATIONS_TO_GENERATE = 200;
    const MAX_COMBINATIONS_TO_RETURN = 100;
    const allCombinations: Combination[] = [];

    const generateCombinations = (n: number, startIndex: number = 0, current: ReceiptGovCalculation[] = []): boolean => {
      if (allCombinations.length >= MAX_COMBINATIONS_TO_GENERATE) return false;

      if (current.length === n) {
        const totalGov = current.reduce((sum, calc) => sum + calc.govAmount, 0);
        if (totalGov >= currentTarget && totalGov > 0) {
          const type = n === 1 ? 'single' : n === 2 ? 'pair' : n === 3 ? 'triplet' : 'multiple';
          allCombinations.push({
            receipts: current.map(c => c.receipt),
            details: [...current],
            totalGov,
            totalNormal: current.reduce((sum, calc) => sum + calc.normalAmount, 0),
            totalExtra: current.reduce((sum, calc) => sum + calc.extraAmount, 0),
            totalQuantity: current.reduce((sum, calc) => sum + calc.quantity, 0),
            difference: totalGov - currentTarget,
            type,
          });
        }
        return true;
      }

      for (let i = startIndex; i < receiptCalculations.length; i++) {
        if (allCombinations.length >= MAX_COMBINATIONS_TO_GENERATE) return false;

        const currentTotal = current.reduce((sum, calc) => sum + calc.govAmount, 0);
        const newTotal = currentTotal + receiptCalculations[i].govAmount;
        
        if (newTotal < currentTarget && n > 1) {
          const remainingItems = receiptCalculations.length - 1 - i;
          if (current.length + remainingItems < n) continue;
          const itemsNeeded = n - current.length - 1;
          if (itemsNeeded > 0 && i + itemsNeeded < receiptCalculations.length) {
            const maxPossibleFromRemaining = receiptCalculations
              .slice(i + 1, i + 1 + itemsNeeded)
              .reduce((sum, calc) => sum + calc.govAmount, 0);
            if (newTotal + maxPossibleFromRemaining < currentTarget) continue;
          }
        }

        current.push(receiptCalculations[i]);
        const shouldContinue = generateCombinations(n, i + 1, current);
        current.pop();
        if (!shouldContinue) return false;
      }
      return true;
    };

    for (let n = 1; n <= Math.min(8, receiptCalculations.length); n++) {
      const shouldContinue = generateCombinations(n);
      if (!shouldContinue || allCombinations.length >= MAX_COMBINATIONS_TO_GENERATE) break;
    }

    allCombinations.sort((a, b) => {
      const diffA = Math.abs(a.difference);
      const diffB = Math.abs(b.difference);
      if (diffA !== diffB) return diffA - diffB;
      return a.receipts.length - b.receipts.length;
    });

    onSuggestionsChange?.(allCombinations.slice(0, MAX_COMBINATIONS_TO_RETURN));
  };

  return {
    targetGovAmount,
    setTargetGovAmount: (val: number) => {
        setTargetGovAmount(val);
        setCalcTargetAmountProp?.(val);
    },
    manualGovRate,
    setManualGovRate: (val: number) => {
        setManualGovRate(val);
        setHasManualInputRate(true);
    },
    manualRsPerQtl,
    setManualRsPerQtl: (val: number) => {
        setManualRsPerQtl(val);
        setHasManualInputRs(true);
    },
    extraAmountBase,
    setExtraAmountBase,
    extraAmountBaseType,
    setExtraAmountBaseType,
    targetIncludesExtra,
    setTargetIncludesExtra,
    useFinalWeight,
    setUseFinalWeight,
    bagWeight,
    setBagWeight: (val: number | undefined) => {
        setBagWeight(val || 0);
        combinationProps?.setBagSize(val);
    },
    govRate,
    extraAmountPerQuintal,
    displayReceiptCalculations,
    selectedReceiptCalculations,
    govRequiredAmount,
    calculatedBaseAmount,
    calculatedExtraAmount,
    handleGenerateWithExtraBase,
    handleCalculateCombinations,
    totalAvailableGov
  };
}
