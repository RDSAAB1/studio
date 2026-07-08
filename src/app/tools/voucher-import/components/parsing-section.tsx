"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Clipboard, RefreshCw, FileSpreadsheet, Workflow, Download } from "lucide-react";

interface ParsingSectionProps {
  voucherInput: string;
  setVoucherInput: (val: string) => void;
  paymentInput: string;
  setPaymentInput: (val: string) => void;
  onPaste: (field: "voucher" | "payment") => void;
  onParse: () => void;
  onClear: () => void;
  errors: string[];
  isExtensionInstalled?: boolean;
  triggerExtensionSync?: () => void;
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
  isExtensionInstalled = false,
  triggerExtensionSync,
}) => {
  const handleDownloadExtension = (type: "emandi" | "gst") => {
    window.open(`/api/download-extension?type=${type}`, "_blank");
  };

  return (
    <Card className="border-0 shadow-lg bg-card/85 backdrop-blur-sm overflow-hidden">
      <CardHeader className="border-b border-border/50 pb-6">
        <CardTitle className="text-lg font-black tracking-tight flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Extraction Workspace
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadExtension("emandi")}
              className="text-[10px] font-black uppercase tracking-widest px-3 h-8 border-primary/30 text-primary hover:bg-primary/5 shadow-sm"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              eMandi Scraper
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadExtension("gst")}
              className="text-[10px] font-black uppercase tracking-widest px-3 h-8 border-emerald-600/30 text-emerald-600 hover:bg-emerald-600/5 shadow-sm"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              GST / PAN Helper
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="text-xs">
          Paste mandi data in Field 1 and payment data in Field 2, or click the buttons below to import from browser extension.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Field 1: Mandi Voucher
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaste("voucher")}
              className="text-[10px] font-black uppercase tracking-widest h-7 gap-1 px-3 border-border/60 hover:bg-muted/50 transition-colors"
            >
              <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
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
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Field 2: Payment Details
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPaste("payment")}
              className="text-[10px] font-black uppercase tracking-widest h-7 gap-1 px-3 border-border/60 hover:bg-muted/50 transition-colors"
            >
              <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
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
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              onClick={triggerExtensionSync ?? (() => window.dispatchEvent(new CustomEvent("eMandiRequestSync")))}
              className="text-xs font-black uppercase tracking-widest px-5 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2"
            >
              <Workflow className="h-4 w-4" />
              Import from Scraper
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownloadExtension("emandi")}
              className="text-xs font-black uppercase tracking-widest px-4 h-9 border-border/60 hover:bg-muted/50 flex items-center gap-2"
            >
              <Download className="h-4 w-4 text-primary" />
              Download Scraper
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownloadExtension("gst")}
              className="text-xs font-black uppercase tracking-widest px-4 h-9 border-border/60 hover:bg-muted/50 flex items-center gap-2"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              Download GST/PAN Helper
            </Button>
          </div>
          <div className="flex gap-3">
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
        </div>
      </CardFooter>
    </Card>
  );
};
