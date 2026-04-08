"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save as SaveIcon } from "lucide-react";
import type { MandiHeaderSettings } from "@/lib/definitions";

interface MandiHeaderEditorProps {
  settings: MandiHeaderSettings;
  onInputChange: <K extends keyof MandiHeaderSettings>(key: K, value: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

export const MandiHeaderEditor: React.FC<MandiHeaderEditorProps> = ({
  settings,
  onInputChange,
  onSave,
  isSaving,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary/80">
          <SaveIcon className="h-5 w-5" />
          Mandi Report Header
        </CardTitle>
        <CardDescription>
          दर्ज की गई विवरण प्रिंट एवं पीडीएफ शीर्षक में उपयोग होंगे।
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">Firm / Company Name</Label>
          <Input
            value={settings.firmName}
            onChange={(e) => onInputChange("firmName", e.target.value)}
            placeholder="M/S Jagdambe Rice Mill"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">Firm Address</Label>
          <Input
            value={settings.firmAddress}
            onChange={(e) => onInputChange("firmAddress", e.target.value)}
            placeholder="Address line..."
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">Mandi Name</Label>
          <Input
            value={settings.mandiName}
            onChange={(e) => onInputChange("mandiName", e.target.value)}
            placeholder="Shahjahanpur Mandi..."
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">Mandi Type</Label>
          <Input
            value={settings.mandiType}
            onChange={(e) => onInputChange("mandiType", e.target.value)}
            placeholder="NON AMPC"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">License No 1</Label>
          <Input
            value={settings.licenseNo}
            onChange={(e) => onInputChange("licenseNo", e.target.value)}
            placeholder="License..."
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">License No 2</Label>
          <Input
            value={settings.licenseNo2}
            onChange={(e) => onInputChange("licenseNo2", e.target.value)}
            placeholder="License..."
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">Register No</Label>
          <Input
            value={settings.registerNo}
            onChange={(e) => onInputChange("registerNo", e.target.value)}
            placeholder="90/91"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">Commodity</Label>
          <Input
            value={settings.commodity}
            onChange={(e) => onInputChange("commodity", e.target.value)}
            placeholder="Wheat/Rice..."
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground uppercase">FY</Label>
          <Input
            value={settings.financialYear}
            onChange={(e) => onInputChange("financialYear", e.target.value)}
            placeholder="2024-25"
            className="h-8 text-xs"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end pt-0 pb-4">
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="h-8 px-6 font-bold"
        >
          {isSaving ? "Saving..." : "Update Header Details"}
        </Button>
      </CardFooter>
    </Card>
  );
};
