"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Clipboard, RefreshCw, FileSpreadsheet } from "lucide-react";

interface ParsingSectionProps {
  voucherInput: string;
  setVoucherInput: (val: string) => void;
  paymentInput: string;
  setPaymentInput: (val: string) => void;
  onPaste: (field: "voucher" | "payment") => void;
  onParse: () => void;
  onClear: () => void;
  errors: string[];
}

export const ParsingSection: React.FC<ParsingSectionProps> = ({
  voucherInput,
  setVoucherInput,
  paymentInput,
  setPaymentInput,
  onPaste,
  onParse,
  onClear,
  errors,
}) => {
  return (
    <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-primary">
          <FileSpreadsheet className="h-6 w-6" />
          Extraction Workspace
        </CardTitle>
        <CardDescription>
          Paste mandi data in Field 1 and payment data in Field 2.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">
              Field 1: Mandi Voucher
            </Label>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPaste("voucher")}
              className="h-6 px-2 text-[10px] font-bold uppercase"
            >
              <Clipboard className="mr-1 h-3 w-3" />
              Paste
            </Button>
          </div>
          <Textarea
            value={voucherInput}
            onChange={(e) => setVoucherInput(e.target.value)}
            className="min-h-[220px] font-mono text-xs bg-muted/30 focus:bg-background transition-colors resize-none border-dashed"
            placeholder="Paste raw voucher data block..."
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">
              Field 2: Payment Details
            </Label>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPaste("payment")}
              className="h-6 px-2 text-[10px] font-bold uppercase"
            >
              <Clipboard className="mr-1 h-3 w-3" />
              Paste
            </Button>
          </div>
          <Textarea
            value={paymentInput}
            onChange={(e) => setPaymentInput(e.target.value)}
            className="min-h-[220px] font-mono text-xs bg-muted/30 focus:bg-background transition-colors resize-none border-dashed"
            placeholder="Paste raw payment data block..."
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 border-t border-border/50 pt-6">
        {errors.length > 0 && (
          <div className="w-full space-y-1.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            {errors.map((error, idx) => (
              <p key={idx} className="text-[11px] font-bold text-destructive flex items-start gap-2">
                <span className="mt-0.5">•</span> {error}
              </p>
            ))}
          </div>
        )}
        <div className="w-full flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClear}
            className="text-xs font-bold uppercase tracking-widest h-9"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button
            onClick={onParse}
            className="text-xs font-black uppercase tracking-widest px-8 h-9 shadow-blue-500/20 shadow-lg"
          >
            Sync & Merge
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
