"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

interface CdFormProps {
  cdEnabled: boolean;
  cdAt: string;
  setCdAt: (value: string) => void;
  cdPercent: number;
  setCdPercent: (value: number) => void;
  calculatedCdAmount: number;
  setCdAmount: (value: number) => void;
}

export function CdForm({
  cdEnabled,
  cdAt,
  setCdAt,
  cdPercent,
  setCdPercent,
  calculatedCdAmount,
  setCdAmount,
}: CdFormProps) {
  if (!cdEnabled) return null;

  return (
    <Card className="text-[10px] mt-2 border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card/95 to-card/90">
      <CardContent className="p-2.5">
        <div className="flex items-end gap-2.5">
          <div className="space-y-1 flex-1">
            <Label htmlFor="cdAt" className="text-[10px] font-bold">CD At</Label>
            <Select value={cdAt} onValueChange={setCdAt}>
              <SelectTrigger id="cdAt" className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partial_on_paid">Partial CD on Paid Amount</SelectItem>
                <SelectItem value="on_unpaid_amount">CD on Unpaid Amount</SelectItem>
                <SelectItem value="on_full_amount">Full CD on Full Amount</SelectItem>
                <SelectItem value="proportional_cd">Proportional CD (Exact Distribution)</SelectItem>
                <SelectItem value="on_previously_paid_no_cd">On Paid Amount (No CD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1">
            <Label htmlFor="cd-percent" className="text-[10px] font-bold">CD%</Label>
            <Input 
              id="cd-percent" 
              type="number" 
              value={cdPercent} 
              onChange={e => setCdPercent(parseFloat(e.target.value) || 0)} 
              className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary" 
            />
          </div>
          <div className="space-y-1 flex-1">
            <Label htmlFor="cdAmount" className="text-[10px] font-bold">CD Amt</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="cdAmount"
                name="cdAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={Number.isFinite(calculatedCdAmount) ? calculatedCdAmount : 0}
                onChange={e => setCdAmount(parseFloat(e.target.value) || 0)}
                className="h-8 text-[10px] font-extrabold text-primary border-2 border-primary/30 bg-primary/10 focus:border-primary"
              />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap font-bold px-2 py-1 rounded-md bg-background/60 border border-border/30">
                {formatCurrency(calculatedCdAmount)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



