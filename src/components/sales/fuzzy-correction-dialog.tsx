import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowRight, Check } from "lucide-react";
import type { FuzzyCluster } from "@/lib/string-similarity";

interface FuzzyCorrectionDialogProps {
  isOpen: boolean;
  clusters: FuzzyCluster[];
  onResolve: (resolutions: Record<string, string>) => void;
  onCancel: () => void;
}

export function FuzzyCorrectionDialog({
  isOpen,
  clusters,
  onResolve,
  onCancel,
}: FuzzyCorrectionDialogProps) {
  // Map of cluster ID to resolved spelling
  const [selections, setSelections] = useState<Record<string, string>>({});
  // Map of cluster ID to custom input string
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && clusters.length > 0) {
      const initialSelections: Record<string, string> = {};
      const initialCustoms: Record<string, string> = {};
      
      clusters.forEach(cluster => {
        initialSelections[cluster.id] = cluster.suggestedSpelling;
        initialCustoms[cluster.id] = '';
      });
      
      setSelections(initialSelections);
      setCustomValues(initialCustoms);
    }
  }, [isOpen, clusters]);

  const handleSelectOption = (clusterId: string, value: string) => {
    setSelections(prev => ({
      ...prev,
      [clusterId]: value
    }));
  };

  const handleCustomValueChange = (clusterId: string, value: string) => {
    setCustomValues(prev => ({
      ...prev,
      [clusterId]: value
    }));
    // Auto-select custom option when typing
    setSelections(prev => ({
      ...prev,
      [clusterId]: 'CUSTOM_VALUE_HOLDER'
    }));
  };

  const handleSubmit = () => {
    const finalResolutions: Record<string, string> = {};
    
    clusters.forEach(cluster => {
      const selected = selections[cluster.id];
      let resolvedValue = selected;
      
      if (selected === 'CUSTOM_VALUE_HOLDER') {
        resolvedValue = customValues[cluster.id].trim();
        // Fallback to suggestion if custom is empty
        if (!resolvedValue) {
          resolvedValue = cluster.suggestedSpelling;
        }
      }
      
      // Map all variants in this cluster to the resolved spelling
      cluster.variants.forEach(variant => {
        finalResolutions[variant.toLowerCase().trim()] = resolvedValue;
      });
    });
    
    onResolve(finalResolutions);
  };

  if (clusters.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border border-primary/20 shadow-xl">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg text-primary">
            <AlertCircle className="h-5 w-5 text-amber-500 animate-pulse" />
            Standardize Spellings
          </DialogTitle>
          <DialogDescription className="text-xs">
            We found some similar spelling variations in the file. Select the correct spelling to clean the data before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {clusters.map((cluster, idx) => {
            const isAddress = cluster.field === 'address';
            const selected = selections[cluster.id];
            
            return (
              <Card key={cluster.id} className="border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <div className="bg-slate-50 px-3 py-2 border-b flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Group #{idx + 1}: {isAddress ? 'Address' : 'Variety'}
                  </span>
                  {cluster.dbMatches.length > 0 && (
                    <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200">
                      Matches Database Spelling
                    </span>
                  )}
                </div>
                <CardContent className="p-3 space-y-3">
                  <div className="text-xs space-y-1">
                    <span className="text-muted-foreground block font-medium">Spelling variations found in file:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.variants.map((variant) => (
                        <div key={variant} className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-mono text-[11px]">
                          {variant}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-medium text-slate-700 block">Choose spelling to use:</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {/* Keep Original Option */}
                      <button
                        type="button"
                        onClick={() => handleSelectOption(cluster.id, 'KEEP_ORIGINAL')}
                        className={`flex items-center justify-between p-2 rounded-md border text-left transition-all duration-200 ${
                          selected === 'KEEP_ORIGINAL'
                            ? 'bg-amber-100/50 border-amber-500 text-amber-900 font-medium'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="font-semibold italic">Keep Original (No modification)</span>
                        {selected === 'KEEP_ORIGINAL' && <Check className="h-4 w-4 text-amber-600 shrink-0" />}
                      </button>

                      {/* Suggestion / Variant Options */}
                      {cluster.variants.map((option) => {
                        const isSuggested = option === cluster.suggestedSpelling;
                        const isCurrentSelection = selected === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleSelectOption(cluster.id, option)}
                            className={`flex items-center justify-between p-2 rounded-md border text-left transition-all duration-200 ${
                              isCurrentSelection 
                                ? 'bg-primary/10 border-primary text-primary font-medium' 
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{option}</span>
                            {isSuggested && !isCurrentSelection && (
                              <span className="text-[10px] text-muted-foreground italic">(Recommended)</span>
                            )}
                            {isCurrentSelection && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}

                      {/* DB Matches not in variations */}
                      {cluster.dbMatches.map((dbOpt) => {
                        if (cluster.variants.includes(dbOpt)) return null;
                        const isCurrentSelection = selected === dbOpt;
                        return (
                          <button
                            key={`db-${dbOpt}`}
                            type="button"
                            onClick={() => handleSelectOption(cluster.id, dbOpt)}
                            className={`flex items-center justify-between p-2 rounded-md border text-left transition-all duration-200 ${
                              isCurrentSelection 
                                ? 'bg-primary/10 border-primary text-primary font-medium' 
                                : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{dbOpt}</span>
                            <span className="text-[9px] text-emerald-600 font-semibold shrink-0">(DB)</span>
                            {isCurrentSelection && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Option input */}
                  <div className="pt-2 border-t flex flex-col md:flex-row md:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectOption(cluster.id, 'CUSTOM_VALUE_HOLDER')}
                      className={`flex items-center gap-2 p-2 rounded-md border text-left text-xs whitespace-nowrap transition-all duration-200 shrink-0 ${
                        selected === 'CUSTOM_VALUE_HOLDER'
                          ? 'bg-primary/10 border-primary text-primary font-medium'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>Custom Spelling:</span>
                      {selected === 'CUSTOM_VALUE_HOLDER' && <Check className="h-4 w-4 text-primary" />}
                    </button>
                    <Input
                      type="text"
                      placeholder="Type custom spelling..."
                      value={customValues[cluster.id] || ''}
                      onChange={(e) => handleCustomValueChange(cluster.id, e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="border-t pt-3 gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="text-xs">
            Skip Standardizing
          </Button>
          <Button size="sm" onClick={handleSubmit} className="text-xs bg-primary hover:bg-primary/90">
            Apply & Continue <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
