"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Target, Package, Sparkles, TrendingUp, Coins, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtraAmountBase } from "./hooks/use-gov-receipt-logic";

interface GovControlPanelProps {
  instanceId: string;
  allowManualGovRate: boolean;
  manualGovRate: number;
  setManualGovRate: (val: number) => void;
  targetGovAmount: number;
  calcTargetAmountProp: number;
  setTargetGovAmount: (val: number) => void;
  extraAmountBase: ExtraAmountBase;
  setExtraAmountBase: (val: ExtraAmountBase) => void;
  allowManualRsPerQtl: boolean;
  manualRsPerQtl: number;
  setManualRsPerQtl: (val: number) => void;
  bagWeight: number;
  setBagWeight: (val: number | undefined) => void;
  combinationBagSize?: number;
  extraAmountBaseType: 'receipt' | 'target';
  setExtraAmountBaseType: (val: 'receipt' | 'target') => void;
  targetIncludesExtra: boolean;
  setTargetIncludesExtra: (val: boolean) => void;
  useFinalWeight: boolean;
  setUseFinalWeight: (val: boolean) => void;
  combination: any;
  handleGenerateWithExtraBase: () => void;
  handleCalculateCombinations: () => void;
  canCalculate: boolean;
}

export const GovControlPanel = React.memo(({
  instanceId,
  allowManualGovRate,
  manualGovRate,
  setManualGovRate,
  targetGovAmount,
  calcTargetAmountProp,
  setTargetGovAmount,
  extraAmountBase,
  setExtraAmountBase,
  allowManualRsPerQtl,
  manualRsPerQtl,
  setManualRsPerQtl,
  bagWeight,
  setBagWeight,
  combinationBagSize,
  extraAmountBaseType,
  setExtraAmountBaseType,
  targetIncludesExtra,
  setTargetIncludesExtra,
  useFinalWeight,
  setUseFinalWeight,
  combination,
  handleGenerateWithExtraBase,
  handleCalculateCombinations,
  canCalculate
}: GovControlPanelProps) => {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {allowManualGovRate && (
          <div className="space-y-0.5">
            <Label className="text-[9px] font-medium text-foreground flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5" /> GOV Rate
            </Label>
            <Input
              type="number"
              value={manualGovRate || ''}
              onChange={(e) => setManualGovRate(Number(e.target.value) || 0)}
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
            value={targetGovAmount || calcTargetAmountProp || ''}
            onChange={(e) => setTargetGovAmount(Number(e.target.value) || 0)}
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
              onChange={(e) => setManualRsPerQtl(Number(e.target.value) || 0)}
              className="h-7 text-[9px] rounded-md border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background"
              placeholder="e.g., 100"
            />
          </div>
        )}
        {combination && (
          <div className="space-y-0.5">
            <Label className="text-[9px] font-medium text-foreground flex items-center gap-1">
              <Package className="h-2.5 w-2.5" /> Bag Weight
            </Label>
            <Input
              type="number"
              value={(combinationBagSize ?? bagWeight) || ''}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBagWeight(!e.target.value || isNaN(v) || v <= 0 ? undefined : v);
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
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor={`roundFigToggle-${instanceId}`} className="text-[9px] font-medium text-foreground">Round Fig</Label>
              <button
                id={`roundFigToggle-${instanceId}`}
                type="button"
                onClick={() => combination.setRoundFigureToggle(!combination.roundFigureToggle)}
                className={cn(
                  "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                )}
              >
                <span className={cn("absolute left-2 text-[9px] font-semibold transition-colors z-0", !combination.roundFigureToggle ? "text-muted-foreground/70" : "text-foreground")}>Off</span>
                <span className={cn("absolute right-2 text-[9px] font-semibold transition-colors z-0", combination.roundFigureToggle ? "text-muted-foreground/70" : "text-foreground")}>On</span>
                <div className={cn(
                  "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                  combination.roundFigureToggle ? "left-[calc(50%+2px)]" : "left-[2px]"
                )}>
                  <span className="text-[9px] font-bold text-primary-foreground">RF</span>
                </div>
              </button>
            </div>
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor={`amountToggle-${instanceId}`} className="text-[9px] font-medium text-foreground">Amount</Label>
              <button
                id={`amountToggle-${instanceId}`}
                type="button"
                onClick={() => combination.setAllowPaiseAmount(!combination.allowPaiseAmount)}
                className={cn(
                  "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                )}
              >
                <span className={cn("absolute left-2 text-[9px] font-semibold transition-colors z-0", !combination.allowPaiseAmount ? "text-muted-foreground/70" : "text-foreground")}>₹</span>
                <span className={cn("absolute right-2 text-[9px] font-semibold transition-colors z-0", combination.allowPaiseAmount ? "text-muted-foreground/70" : "text-foreground")}>₹+Ps</span>
                <div className={cn(
                  "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                  combination.allowPaiseAmount ? "left-[calc(50%+2px)]" : "left-[2px]"
                )}>
                  <span className="text-[9px] font-bold text-primary-foreground">{combination.allowPaiseAmount ? "₹+Ps" : "₹"}</span>
                </div>
              </button>
            </div>
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor={`stepToggle-${instanceId}`} className="text-[9px] font-medium text-foreground">Step</Label>
              <button
                id={`stepToggle-${instanceId}`}
                type="button"
                onClick={() => combination.setRateStep(combination.rateStep === 1 ? 5 : 1)}
                className={cn(
                  "relative w-full min-w-0 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/60 border border-border overflow-hidden"
                )}
              >
                <span className={cn("absolute left-2 text-[9px] font-semibold transition-colors z-0", combination.rateStep === 1 ? "text-muted-foreground/70" : "text-foreground")}>+1</span>
                <span className={cn("absolute right-2 text-[9px] font-semibold transition-colors z-0", combination.rateStep === 5 ? "text-muted-foreground/70" : "text-foreground")}>+5</span>
                <div className={cn(
                  "absolute w-[calc(50%-2px)] h-[calc(100%-2px)] top-[1px] rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                  combination.rateStep === 5 ? "left-[calc(50%+2px)]" : "left-[2px]"
                )}>
                  <span className="text-[9px] font-bold text-primary-foreground">+{combination.rateStep}</span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

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
          disabled={!canCalculate}
        >
          <Calculator className="h-3 w-3 mr-1" />
          Calculate
        </Button>
      </div>
    </div>
  );
});

GovControlPanel.displayName = "GovControlPanel";
