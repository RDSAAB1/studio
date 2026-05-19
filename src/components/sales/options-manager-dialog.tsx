

"use client";

import { useState, useMemo } from "react";
import { toTitleCase } from "@/lib/utils";
import type { OptionItem } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Pen, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface SuggestionInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    suggestions: string[];
    className?: string;
}

const SuggestionInput = ({ value, onChange, placeholder, suggestions, className }: SuggestionInputProps) => {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
            <div className={cn("relative w-full", className)}>
                <PopoverAnchor asChild>
                    <Input
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            if (!open) setOpen(true);
                        }}
                        placeholder={placeholder}
                        className="w-full pr-8 text-xs font-bold"
                        onFocus={() => setOpen(true)}
                        onBlur={() => {
                            // Delay closing to allow clicking suggestions
                            setTimeout(() => setOpen(false), 200);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setOpen(false);
                            }
                        }}
                    />
                </PopoverAnchor>
                <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-30 shrink-0" />
            </div>
            
            <PopoverContent 
                className="w-[200px] p-1 shadow-2xl border-slate-200 z-[500]" 
                align="start" 
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => {
                    if (e.target instanceof HTMLElement && e.target.closest('input')) {
                        e.preventDefault();
                    }
                }}
            >
                <ScrollArea className="max-h-[220px] overflow-auto">
                    <div className="flex flex-col gap-0.5">
                        {suggestions.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={cn(
                                    "flex items-center w-full px-3 py-2 text-left text-[11px] font-black uppercase rounded-md transition-all",
                                    value === s ? "bg-emerald-50 text-emerald-600" : "hover:bg-slate-50 text-slate-600 active:bg-slate-100"
                                )}
                                onClick={() => {
                                    onChange(s);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-3 w-3",
                                        value === s ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {s}
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};

interface OptionsManagerDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    type: 'variety' | 'paymentType' | 'centerName' | null;
    options: OptionItem[];
    onAdd: (collectionName: string, optionData: Partial<OptionItem>) => void;
    onUpdate: (collectionName: string, id: string, optionData: Partial<OptionItem>) => void;
    onDelete: (collectionName: string, id: string, name: string) => void;
}

export const OptionsManagerDialog = ({ isOpen, setIsOpen, type, options, onAdd, onUpdate, onDelete }: OptionsManagerDialogProps) => {
    const [editingOption, setEditingOption] = useState<Partial<OptionItem> | null>(null);
    const [newOption, setNewOption] = useState({ name: "", unit: "Qtl", category: "" });
    const { toast } = useToast();

    const uniqueUnits = useMemo(() => {
        const units = new Set<string>();
        options.forEach(opt => opt.unit && units.add(opt.unit));
        return Array.from(units).sort();
    }, [options]);

    const uniqueCategories = useMemo(() => {
        const cats = new Set<string>();
        options.forEach(opt => opt.category && cats.add(opt.category));
        return Array.from(cats).sort();
    }, [options]);

    if (!type) return null;

    const title = type === 'variety' ? "Manage Varieties" : type === 'paymentType' ? "Manage Payment Types" : "Manage Center Names";
    const collectionName = type === 'variety' ? 'varieties' : type === 'paymentType' ? 'paymentTypes' : 'centerNames';

    const handleSave = () => {
        if (editingOption && editingOption.id) {
            const trimmedName = editingOption.name?.trim();
            if (!trimmedName) {
                toast({ title: "Empty Name", description: "Option name cannot be empty.", variant: "destructive" });
                return;
            }
            
            onUpdate(collectionName, editingOption.id, { 
                name: trimmedName,
                unit: editingOption.unit,
                category: editingOption.category
            });
            setEditingOption(null);
        }
    };
    
    const handleAdd = () => {
        const trimmedName = newOption.name.trim();
        if (!trimmedName) {
            toast({ title: "Empty Name", description: "Please enter a name for the option.", variant: "destructive" });
            return;
        }
        onAdd(collectionName, { 
            name: trimmedName,
            unit: type === 'variety' ? newOption.unit : undefined,
            category: type === 'variety' ? newOption.category : undefined
        });
        setNewOption({ name: "", unit: "Qtl", category: "" });
        toast({ title: "Option Added", variant: "success" });
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pen className="h-4 w-4" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>Add, edit, or remove options from the list.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Variety Name..."
                                value={newOption.name}
                                onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                className="bg-white font-bold uppercase text-xs"
                            />
                            {type !== 'variety' && <Button onClick={handleAdd} size="sm">Add</Button>}
                        </div>
                        
                        {type === 'variety' && (
                            <div className="flex gap-2">
                                <SuggestionInput 
                                    placeholder="Unit (Qtl, Bags)"
                                    value={newOption.unit}
                                    onChange={(v) => setNewOption({ ...newOption, unit: v })}
                                    suggestions={uniqueUnits}
                                    className="bg-white text-xs h-9"
                                />
                                <SuggestionInput 
                                    placeholder="Category (Rice, Paddy)"
                                    value={newOption.category}
                                    onChange={(v) => setNewOption({ ...newOption, category: v })}
                                    suggestions={uniqueCategories}
                                    className="bg-white text-xs h-9"
                                />
                                <Button onClick={handleAdd} size="sm" className="font-bold uppercase text-[10px] h-9">Add</Button>
                            </div>
                        )}
                    </div>

                    <Separator />
                    
                    <div className="rounded-t-lg border border-slate-200 bg-slate-50 p-2 grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <div className="col-span-6 pl-1">Variety / Item Name</div>
                        {type === 'variety' && (
                            <>
                                <div className="col-span-2 text-center">Unit</div>
                                <div className="col-span-3">Category</div>
                            </>
                        )}
                        <div className="col-span-1"></div>
                    </div>
                    
                    <ScrollArea className="h-80 pr-4 border-x border-b border-slate-200 rounded-b-lg">
                        <div className="divide-y divide-slate-100">
                            {options.map((option: OptionItem) => (
                                <div key={option.id} className="group flex flex-col hover:bg-slate-50/50 transition-all p-2">
                                    {editingOption?.id === option.id ? (
                                        <div className="space-y-2 p-1">
                                            <div className="grid grid-cols-12 gap-2">
                                                <div className="col-span-6">
                                                    <Input
                                                        value={editingOption.name}
                                                        onChange={(e) => setEditingOption({ ...editingOption, name: e.target.value })}
                                                        className="h-8 font-bold uppercase text-xs"
                                                        autoFocus
                                                    />
                                                </div>
                                                {type === 'variety' && (
                                                    <div className="col-span-6 flex gap-2">
                                                        <SuggestionInput
                                                            placeholder="Unit"
                                                            value={editingOption.unit || ""}
                                                            onChange={(v) => setEditingOption({ ...editingOption, unit: v })}
                                                            suggestions={uniqueUnits}
                                                            className="h-8"
                                                        />
                                                        <SuggestionInput
                                                            placeholder="Category"
                                                            value={editingOption.category || ""}
                                                            onChange={(v) => setEditingOption({ ...editingOption, category: v })}
                                                            suggestions={uniqueCategories}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold uppercase" onClick={() => setEditingOption(null)}>Cancel</Button>
                                                <Button size="sm" className="h-7 text-[10px] font-bold uppercase" onClick={handleSave}>Update</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-12 gap-2 items-center py-1">
                                            <div className="col-span-6 flex flex-col">
                                                <span className="font-bold text-xs text-slate-800 uppercase tracking-tight truncate pl-1">{String(option.name).toUpperCase()}</span>
                                            </div>
                                            {type === 'variety' ? (
                                                <>
                                                    <div className="col-span-2 flex justify-center">
                                                        {option.unit ? (
                                                            <Badge variant="secondary" className="text-[9px] px-1.5 h-4.5 font-black bg-emerald-50 text-emerald-600 border-emerald-100 uppercase">{option.unit}</Badge>
                                                        ) : <span className="text-[8px] text-slate-300">-</span>}
                                                    </div>
                                                    <div className="col-span-3">
                                                        {option.category ? (
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase truncate block">{option.category}</span>
                                                        ) : <span className="text-[8px] text-slate-300">-</span>}
                                                    </div>
                                                </>
                                            ) : <div className="col-span-5"></div>}
                                            
                                            <div className="col-span-1 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-6 w-6 text-slate-400 hover:text-primary hover:bg-primary/5"
                                                    onClick={() => setEditingOption({ ...option })}
                                                >
                                                    <Pen className="h-3 w-3" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash className="h-3 w-3" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                                                            <AlertDialogDescription>Permanently remove "{String(option.name).toUpperCase()}" from the {type} list?</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => onDelete(collectionName, option.id, option.name)} className="bg-red-600 hover:bg-red-700 text-white font-bold">Delete Variety</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" size="sm" className="font-bold uppercase text-[10px]" onClick={() => setIsOpen(false)}>Close Manager</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
