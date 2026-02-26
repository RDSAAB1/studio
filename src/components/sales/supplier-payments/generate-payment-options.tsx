"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PaymentCombinationGenerator } from '@/components/sales/supplier-payments/payment-combination-generator';
import type { PaymentOption } from '@/hooks/use-payment-combination';

interface GeneratePaymentOptionsProps {
  rtgsQuantity: number;
  setRtgsQuantity: (value: number) => void;
  rtgsRate: number;
  setRtgsRate: (value: number) => void;
  rtgsAmount: number;
  setRtgsAmount: (value: number) => void;
  minRate: number;
  setMinRate: (value: number) => void;
  maxRate: number;
  setMaxRate: (value: number) => void;
  selectPaymentAmount: (option: any) => void;
  combination: {
    paymentOptions: PaymentOption[];
    sortedPaymentOptions: PaymentOption[];
    roundFigureToggle: boolean;
    setRoundFigureToggle: (value: boolean) => void;
    allowPaiseAmount: boolean;
    setAllowPaiseAmount: (value: boolean) => void;
    bagSize?: number;
    setBagSize: (value: number | undefined) => void;
    rateStep: 1 | 5;
    setRateStep: (value: 1 | 5) => void;
    handleGeneratePaymentOptions: () => void;
    requestSort: (key: keyof PaymentOption) => void;
  };
  paymentMethod: 'Cash' | 'Online' | 'RTGS' | 'Gov.';
}

export function GeneratePaymentOptions({
  rtgsQuantity,
  setRtgsQuantity,
  rtgsRate,
  setRtgsRate,
  rtgsAmount,
  setRtgsAmount,
  minRate,
  setMinRate,
  maxRate,
  setMaxRate,
  selectPaymentAmount,
  combination,
  paymentMethod,
}: GeneratePaymentOptionsProps) {
  return (
    <Card className="text-[10px] border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card/95 to-card/90">
      <CardHeader className="pb-2 px-2.5 pt-2.5 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b-2 border-primary/20">
        <CardTitle className="text-[11px] font-extrabold text-foreground">Generate Payment Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-2.5">
        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="rtgsQuantity" className="text-[10px] font-bold">Quantity</Label>
            <Input
              id="rtgsQuantity"
              name="rtgsQuantity"
              type="number"
              value={rtgsQuantity}
              onChange={(e) => setRtgsQuantity(Number(e.target.value) || 0)}
              className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rtgsRate" className="text-[10px] font-bold">Rate</Label>
            <Input
              id="rtgsRate"
              name="rtgsRate"
              type="number"
              value={rtgsRate}
              onChange={(e) => setRtgsRate(Number(e.target.value) || 0)}
              className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rtgsAmount" className="text-[10px] font-bold">Amount</Label>
            <Input
              id="rtgsAmount"
              name="rtgsAmount"
              type="number"
              value={rtgsAmount}
              onChange={(e) => setRtgsAmount(Number(e.target.value) || 0)}
              className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
              placeholder="Auto-filled from To Be Paid"
            />
          </div>
        </div>
        {/* Row 2 */}
        <PaymentCombinationGenerator
          minRate={minRate}
          setMinRate={setMinRate}
          maxRate={maxRate}
          setMaxRate={setMaxRate}
          selectPaymentAmount={selectPaymentAmount}
          combination={combination}
          showResults={false}
          paymentMethod={paymentMethod}
        />
      </CardContent>
    </Card>
  );
}



