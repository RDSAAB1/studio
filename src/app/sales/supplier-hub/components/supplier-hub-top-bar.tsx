"use client";

import { useMemo, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Input } from "@/components/ui/input";
import { Search, Upload, Download, Trash2, Printer } from "lucide-react";
import type { Customer } from "@/lib/definitions";

const formatSupplierKey = (supplier: Customer) => {
  // Match the key format used in use-supplier-summary.ts buildProfileKey
  const name = (supplier.name || "").toLowerCase().replace(/\s+/g, "_");
  const fatherName = ((supplier.fatherName || supplier.so || "")).toLowerCase().replace(/\s+/g, "_");
  const address = (supplier.address || "").toLowerCase().replace(/\s+/g, "_");
  const base = [name, fatherName, address].join("__").replace(/^_+|_+$/g, "");
  return base || `profile_${supplier.id || Date.now()}`;
};

const normalizeSerial = (value: string) => {
  const raw = value.trim().toUpperCase();
  if (!raw) return "";

  const numeric = raw.replace(/[^0-9]/g, "");
  if (!numeric) {
    return raw.startsWith("S") ? raw : `S${raw}`;
  }

  return `S${numeric.padStart(5, "0")}`;
};

type SupplierOption = {
  value: string;
  label: string;
  data: any;
};

interface SupplierHubTopBarProps {
  options: SupplierOption[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  millOverviewKey?: string;
  suppliers: Customer[];
  onFinalize?: () => void;
  onClear?: () => void;
  onResetCommands?: () => void;
  paymentActiveTab?: string;
  onPaymentTabChange?: (tab: string) => void;
  activeSection?: string;
  onImport?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport?: () => void;
  onDelete?: () => void;
  onPrint?: () => void;
  onSerialSelect?: (serialNo: string) => void;
  selectedEntryIds?: Set<string>;
  isProcessing?: boolean;
}

export const SUPPLIER_HUB_TOP_BAR_HEIGHT = 68;
export const SUPPLIER_HUB_APP_OFFSET = 68;

export function SupplierHubTopBar({
  options,
  selectedKey,
  onSelect,
  millOverviewKey,
  suppliers,
  onFinalize,
  onClear,
  onResetCommands,
  paymentActiveTab,
  onPaymentTabChange,
  activeSection,
  onImport,
  onExport,
  onDelete,
  onPrint,
  onSerialSelect,
  selectedEntryIds,
  isProcessing,
}: SupplierHubTopBarProps) {
  const { toast } = useToast();
  const [serialInput, setSerialInput] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const hasMillOverview =
    typeof millOverviewKey === "string" &&
    options.some((option) => option.value === millOverviewKey);

  const dropdownValue = useMemo(() => {
    if (!selectedKey) return null;
    return options.some((option) => option.value === selectedKey)
      ? selectedKey
      : null;
  }, [options, selectedKey]);

  const handleDropdownChange = (value: string | null) => {
    if (value === null) {
      if (hasMillOverview && millOverviewKey) {
        onSelect(millOverviewKey);
      } else {
        onSelect(null);
      }
      return;
    }
    onSelect(value);
  };

  const handleSerialSearch = () => {
    if (!serialInput.trim()) return;

    const formatted = normalizeSerial(serialInput);
    setSerialInput(formatted);

    const matchingSupplier = suppliers.find((supplier) => {
      const sr = (supplier.srNo || "").toUpperCase();
      return sr === formatted;
    });

    if (!matchingSupplier) {
      toast({
        title: "No match found",
        description: `Serial ${formatted} is not linked to any supplier entry.`,
        variant: "destructive",
      });
      return;
    }

    const supplierKey = formatSupplierKey(matchingSupplier);
    
    // Try to find exact match first
    let option = options.find((item) => item.value === supplierKey);
    
    // If not found, try to find by matching supplier data in options
    if (!option) {
      option = options.find((item) => {
        const data = item.data;
        if (!data) return false;
        const dataName = (data.name || "").toLowerCase().trim();
        const dataFather = ((data.fatherName || data.so || "")).toLowerCase().trim();
        const dataAddress = (data.address || "").toLowerCase().trim();
        const supplierName = (matchingSupplier.name || "").toLowerCase().trim();
        const supplierFather = ((matchingSupplier.fatherName || matchingSupplier.so || "")).toLowerCase().trim();
        const supplierAddress = (matchingSupplier.address || "").toLowerCase().trim();
        
        return dataName === supplierName && 
               dataFather === supplierFather && 
               dataAddress === supplierAddress;
      });
    }
    
    // Check for mill overview
    if (!option && millOverviewKey && supplierKey === millOverviewKey) {
      option = { value: millOverviewKey };
    }

    if (option) {
      onSelect(option.value);
      // Update parchiNo in payment form if callback is provided
      if (onSerialSelect) {
        onSerialSelect(formatted);
      }
      toast({
        title: "Supplier selected",
        description: `${matchingSupplier.name || "Supplier"} linked with ${formatted}`,
      });
    } else {
      // Still show error but with more helpful message
      toast({
        title: "Profile missing",
        description: `Supplier ${matchingSupplier.name} (SR# ${formatted}) exists but no combined profile was found. The profile will be created automatically.`,
        variant: "destructive",
      });
      // Try to select anyway - the profile might be created on the fly
      onSelect(supplierKey);
      // Update parchiNo in payment form if callback is provided
      if (onSerialSelect) {
        onSerialSelect(formatted);
      }
    }
  };

  const resetSelection = () => {
    if (hasMillOverview && millOverviewKey) {
      onSelect(millOverviewKey);
    } else {
      onSelect(null);
    }
  };

  return (
    <div
      className="fixed right-0 left-0 z-50 border-b border-border bg-card shadow-sm lg:left-[60px]"
      style={{
        height: SUPPLIER_HUB_TOP_BAR_HEIGHT,
        top: SUPPLIER_HUB_APP_OFFSET,
        marginTop: '-1px',
      }}
    >
      <div className="flex h-full flex-col justify-center gap-1 px-4 py-1.5 text-[11px]">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex w-[450px]">
              <CustomDropdown
                options={options}
                value={dropdownValue}
                onChange={handleDropdownChange}
                placeholder="Select supplier..."
                searchPlaceholder="Type to search suppliers…"
                noItemsPlaceholder="No supplier matches."
                inputClassName="h-7 rounded-full bg-background/70 pl-7 text-[11px]"
                showClearButton={false}
                showArrow={false}
                showGoButton={true}
                onGoClick={() => {
                  if (dropdownValue) {
                    handleDropdownChange(dropdownValue);
                  }
                }}
              />
            </div>
          </div>

        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="relative w-[170px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    handleSerialSearch();
                  }
                }}
                placeholder="Serial number"
                className="h-7 rounded-full bg-background/70 pl-7 pr-14 text-[11px]"
              />
              <div className="absolute inset-y-0 right-1 flex items-center">
                <Button
                  size="sm"
                  className="h-5 rounded-full px-2.5 text-[10px]"
                  onClick={handleSerialSearch}
                >
                  Go
                </Button>
              </div>
            </div>
          </div>

          {paymentActiveTab && onPaymentTabChange && (
            <div className="flex items-center gap-1">
              <Button
                variant={paymentActiveTab === "process" ? "default" : "outline"}
                size="sm"
                className="h-6 rounded-full px-2.5 text-[10px]"
                onClick={() => onPaymentTabChange("process")}
              >
                Payment Process
              </Button>
              <Button
                variant={paymentActiveTab === "cash" ? "default" : "outline"}
                size="sm"
                className="h-6 rounded-full px-2.5 text-[10px]"
                onClick={() => onPaymentTabChange("cash")}
              >
                Cash History
              </Button>
              <Button
                variant={paymentActiveTab === "rtgs" ? "default" : "outline"}
                size="sm"
                className="h-6 rounded-full px-2.5 text-[10px]"
                onClick={() => onPaymentTabChange("rtgs")}
              >
                RTGS History
              </Button>
            </div>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Import, Export, Delete, Print buttons */}
            <div className="flex items-center gap-1 border-r border-border pr-1.5 mr-1">
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={onImport}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 rounded-full px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => importInputRef.current?.click()}
                disabled={!onImport}
                title="Import"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 rounded-full px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={onExport}
                disabled={!onExport}
                title="Export"
              >
                <Upload className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 rounded-full px-2 text-[10px] text-muted-foreground hover:text-foreground hover:text-destructive"
                onClick={onDelete}
                disabled={!onDelete}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 rounded-full px-2 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={onPrint}
                disabled={!onPrint}
                title="Print"
              >
                <Printer className="h-3 w-3" />
              </Button>
          </div>

            <Button
              size="sm"
              className="h-6 rounded-full px-2.5 text-[10px]"
              onClick={() => onFinalize?.()}
              disabled={!onFinalize || isProcessing || (activeSection === "payments" && (!selectedEntryIds || selectedEntryIds.size === 0))}
            >
              {isProcessing ? "Processing..." : "Finalize"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 rounded-full px-2.5 text-[10px]"
              onClick={() => onClear?.()}
              disabled={!onClear}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 rounded-full px-2.5 text-[10px] text-muted-foreground"
              onClick={() =>
                onResetCommands ? onResetCommands() : resetSelection()
              }
            >
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

