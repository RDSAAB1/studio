import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Info, Settings } from "lucide-react";

interface ImportConfigDialogProps {
  isOpen: boolean;
  importedItems: any[];
  onConfirm: (config: {
    defaultKanta: number;
    defaultKarta: number;
    defaultLabouryRate: number;
    exceptions: Record<string, { kanta: number; karta: number; labouryRate: number }>;
  }) => void;
  onCancel: () => void;
}

export function ImportConfigDialog({
  isOpen,
  importedItems,
  onConfirm,
  onCancel,
}: ImportConfigDialogProps) {
  const [defaultKanta, setDefaultKanta] = useState<number>(10);
  const [defaultKarta, setDefaultKarta] = useState<number>(1);
  const [defaultLabouryRate, setDefaultLabouryRate] = useState<number>(2);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Map of unique index/id to custom values
  // We'll identify items by their unique index in the importedItems array
  const [exceptionStates, setExceptionStates] = useState<Record<number, boolean>>({});
  const [customKanta, setCustomKanta] = useState<Record<number, number>>({});
  const [customKarta, setCustomKarta] = useState<Record<number, number>>({});
  const [customLaboury, setCustomLaboury] = useState<Record<number, number>>({});

  // Clean items for list representation
  const items = useMemo(() => {
    return importedItems.map((item, idx) => {
      // Flex keys extraction matching import processor
      const keys = Object.keys(item);
      const nameKey = keys.find(k => {
        const norm = k.toUpperCase().trim();
        return norm.includes('CUSTOMER') || norm === 'NAME' || norm.includes('SUPPLIER');
      });
      const wtKey = keys.find(k => {
        const norm = k.toUpperCase().trim();
        return norm.includes('GROSS') || norm.includes('NET') || norm === 'WT';
      });
      const rstKey = keys.find(k => {
        const norm = k.toUpperCase().trim();
        return norm === 'RST' || norm.includes('SERIAL') || norm.includes('S.NO');
      });
      const labourKey = keys.find(k => {
        const norm = k.toUpperCase().trim();
        return norm.includes('LABOU') || norm.includes('LABOUR');
      });
      const rawVal = labourKey ? String(item[labourKey]).trim().toUpperCase() : '';
      const cleaned = rawVal.replace(/[^0-9.]/g, '');
      const hasLaboury = rawVal === 'YES' || rawVal === 'Y' || (cleaned !== '' && !isNaN(Number(cleaned)) && Number(cleaned) > 0);

      return {
        index: idx,
        name: nameKey && item[nameKey] ? String(item[nameKey]).trim() : 'Unknown',
        weight: wtKey && item[wtKey] ? String(item[wtKey]).trim() : '0',
        rst: rstKey && item[rstKey] ? String(item[rstKey]).trim() : `Row ${idx + 1}`,
        hasLaboury: !!hasLaboury,
      };
    });
  }, [importedItems]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const s = searchTerm.toLowerCase();
    return items.filter(
      item => item.name.toLowerCase().includes(s) || item.rst.toLowerCase().includes(s)
    );
  }, [items, searchTerm]);

  const handleToggleException = (idx: number) => {
    setExceptionStates(prev => {
      const active = !prev[idx];
      if (active) {
        // Init exception inputs with default values
        setCustomKanta(k => ({ ...k, [idx]: defaultKanta }));
        setCustomKarta(k => ({ ...k, [idx]: defaultKarta }));
        setCustomLaboury(k => ({ ...k, [idx]: defaultLabouryRate }));
      }
      return { ...prev, [idx]: active };
    });
  };

  const handleConfirm = () => {
    const exceptions: Record<string, { kanta: number; karta: number; labouryRate: number }> = {};
    
    Object.keys(exceptionStates).forEach((keyStr) => {
      const idx = Number(keyStr);
      if (exceptionStates[idx]) {
        exceptions[idx] = {
          kanta: customKanta[idx] !== undefined ? customKanta[idx] : defaultKanta,
          karta: customKarta[idx] !== undefined ? customKarta[idx] : defaultKarta,
          labouryRate: customLaboury[idx] !== undefined ? customLaboury[idx] : defaultLabouryRate,
        };
      }
    });

    onConfirm({
      defaultKanta,
      defaultKarta,
      defaultLabouryRate,
      exceptions,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto border border-primary/20 shadow-xl">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-md text-primary">
            <Settings className="h-5 w-5 text-primary" />
            Import Configurations (Kanta, Karta & Laboury)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure the default calculations for this import, and specify any exceptions for individual receipts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          {/* Default Values Selection */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Default Kanta Amount</Label>
              <Input
                type="number"
                value={defaultKanta}
                onChange={(e) => setDefaultKanta(Number(e.target.value) || 0)}
                className="h-8 text-xs bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Default Karta %</Label>
              <Input
                type="number"
                step="0.1"
                value={defaultKarta}
                onChange={(e) => setDefaultKarta(Number(e.target.value) || 0)}
                className="h-8 text-xs bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Default Laboury Rate</Label>
              <Input
                type="number"
                step="0.5"
                value={defaultLabouryRate}
                onChange={(e) => setDefaultLabouryRate(Number(e.target.value) || 0)}
                className="h-8 text-xs bg-white"
              />
            </div>
          </div>

          {/* Exceptions Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Individual Exceptions (Ticked items will use custom values)</span>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search list..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-7 pl-8 text-[11px]"
                />
              </div>
            </div>

            <ScrollArea className="h-48 rounded-md border bg-white p-2">
              <div className="space-y-1.5">
                {filteredItems.map((item) => {
                  const isException = !!exceptionStates[item.index];
                  return (
                    <div
                      key={item.index}
                      className={`flex items-center justify-between p-2 rounded-md border transition-all text-xs ${
                        isException ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50/20 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isException}
                          onChange={() => handleToggleException(item.index)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-800 truncate">
                            {item.rst} - {item.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex gap-2">
                            <span>Weight: {item.weight}</span>
                            {item.hasLaboury && <span className="text-emerald-600 font-semibold">(Has Laboury)</span>}
                          </span>
                        </div>
                      </div>

                      {isException && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground">Kanta:</span>
                            <Input
                              type="number"
                              value={customKanta[item.index] !== undefined ? customKanta[item.index] : defaultKanta}
                              onChange={(e) =>
                                setCustomKanta(k => ({ ...k, [item.index]: Number(e.target.value) || 0 }))
                              }
                              className="h-6 w-12 text-[10px] p-1 text-center bg-white"
                            />
                          </div>
                          <div className="flex items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground">Karta%:</span>
                            <Input
                              type="number"
                              step="0.1"
                              value={customKarta[item.index] !== undefined ? customKarta[item.index] : defaultKarta}
                              onChange={(e) =>
                                setCustomKarta(k => ({ ...k, [item.index]: Number(e.target.value) || 0 }))
                              }
                              className="h-6 w-12 text-[10px] p-1 text-center bg-white"
                            />
                          </div>
                          <div className="flex items-center gap-0.5">
                            <span className="text-[9px] text-amber-700">Lab:</span>
                            <Input
                              type="number"
                              step="0.5"
                              value={customLaboury[item.index] !== undefined ? customLaboury[item.index] : defaultLabouryRate}
                              onChange={(e) =>
                                setCustomLaboury(k => ({ ...k, [item.index]: Number(e.target.value) || 0 }))
                              }
                              className="h-6 w-12 text-[10px] p-1 text-center bg-white border-amber-300 focus-visible:ring-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredItems.length === 0 && (
                  <div className="text-center text-muted-foreground py-8 text-xs">
                    No entries found matching search terms.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-blue-50/50 p-2.5 border border-blue-100 rounded-md">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <span>Exceptions overwrite the default calculations. All standard calculations will update accordingly.</span>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">
            Cancel Import
          </Button>
          <Button size="sm" onClick={handleConfirm} className="text-xs bg-primary hover:bg-primary/90">
            Confirm Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
