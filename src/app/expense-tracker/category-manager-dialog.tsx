
"use client";

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    ChevronRight, 
    Plus, 
    Trash2, 
    X, 
    Folder, 
    Layers, 
    Search,
    LayoutGrid,
    MoreVertical,
    AlertCircle,
    Hash,
    ArrowRight,
    Command,
    Terminal,
    List,
    Settings2
} from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import type { IncomeCategory, ExpenseCategory } from '@/lib/definitions';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CategoryManagerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  incomeCategories: IncomeCategory[];
  expenseCategories: ExpenseCategory[];
  onAddCategory: (collection: 'incomeCategories' | 'expenseCategories', category: { name: string, nature?: string }) => Promise<void>;
  onUpdateCategoryName: (collection: 'incomeCategories' | 'expenseCategories', id: string, name: string) => Promise<void>;
  onDeleteCategory: (collection: 'incomeCategories' | 'expenseCategories', id: string) => Promise<void>;
  onAddSubCategory: (collection: 'incomeCategories' | 'expenseCategories', categoryId: string, subCategoryName: string) => Promise<void>;
  onDeleteSubCategory: (collection: 'incomeCategories' | 'expenseCategories', categoryId: string, subCategoryName: string) => Promise<void>;
}

export const CategoryManagerDialog = ({ 
    isOpen, 
    onOpenChange, 
    incomeCategories, 
    expenseCategories, 
    onAddCategory,
    onDeleteCategory,
    onAddSubCategory,
    onDeleteSubCategory
}: CategoryManagerDialogProps) => {
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newSubName, setNewSubName] = useState("");

    const filteredCategories = useMemo(() => {
        return expenseCategories.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [expenseCategories, searchTerm]);

    const selectedCategory = useMemo(() => {
        const found = expenseCategories.find(c => c.id === selectedCategoryId);
        if (!found && filteredCategories.length > 0 && !selectedCategoryId) {
            return filteredCategories[0];
        }
        return found || filteredCategories[0];
    }, [expenseCategories, selectedCategoryId, filteredCategories]);

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        await onAddCategory('expenseCategories', { name: toTitleCase(newCategoryName), nature: 'Seasonal' });
        setNewCategoryName("");
    };

    const handleAddSub = async () => {
        if (!newSubName.trim() || !selectedCategory) return;
        await onAddSubCategory('expenseCategories', selectedCategory.id, toTitleCase(newSubName));
        setNewSubName("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent 
                className="max-w-5xl h-[85vh] p-0 flex flex-col bg-white border-2 border-[#3b0764]/20 shadow-2xl overflow-hidden rounded-2xl"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>Category Manager</DialogTitle>
                    <DialogDescription>Manage categories and sub-categories</DialogDescription>
                </DialogHeader>

                {/* header: Fixed Text Visibility */}
                <div className="px-6 py-4 border-b-2 border-[#3b0764]/10 flex items-center justify-between bg-[#3b0764]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                            <Settings2 className="text-[#3b0764] w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-sm font-black tracking-tight uppercase leading-none text-white">
                                Master Category Manager
                            </DialogTitle>
                            <DialogDescription className="text-[9px] font-bold text-white/70 uppercase tracking-[0.2em] mt-1">
                                Operational Ledger System
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within:text-white transition-colors" />
                            <Input 
                                placeholder="SEARCH GROUPS..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-9 w-64 pl-10 bg-white/20 border-white/20 border rounded-xl text-xs font-bold text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/40 focus:border-white/50 transition-all"
                            />
                        </div>
                        <Button 
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="h-9 px-6 text-xs font-black border-white/40 bg-white/10 hover:bg-white hover:text-[#3b0764] text-white uppercase rounded-xl transition-all"
                        >
                            Close
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Sidebar */}
                    <div className="w-80 border-r-2 border-slate-100 bg-[#f8f7ff] flex flex-col">
                        <div className="p-4 border-b-2 border-[#3b0764]/5 bg-white shadow-sm">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="NEW CATEGORY..." 
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value.toUpperCase())}
                                    className="h-10 text-xs font-black border-[#3b0764]/20 border-2 rounded-xl bg-slate-50 text-[#3b0764] placeholder:text-slate-400"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                                />
                                <Button onClick={handleAddCategory} className="h-10 w-10 bg-[#3b0764] hover:bg-[#2e054f] rounded-xl shrink-0 shadow-lg shadow-purple-900/20">
                                    <Plus className="w-5 h-5 text-white" />
                                </Button>
                            </div>
                        </div>
                        
                        <ScrollArea className="flex-1">
                            <div className="py-2">
                                {filteredCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-6 py-4 transition-all duration-200 relative",
                                            (selectedCategory?.id === cat.id) 
                                                ? "bg-white text-[#3b0764] shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-[#3b0764] before:rounded-r-full" 
                                                : "text-slate-600 hover:bg-[#3b0764]/5 hover:text-[#3b0764]"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <Folder className={cn("w-4 h-4 shrink-0", (selectedCategory?.id === cat.id) ? "text-[#3b0764]" : "text-slate-400")} />
                                            <span className={cn("text-[11px] tracking-tight uppercase truncate", (selectedCategory?.id === cat.id) ? "font-black" : "font-bold")}>{cat.name}</span>
                                        </div>
                                        <div className={cn(
                                            "text-[10px] font-black px-2 py-0.5 rounded-md",
                                            (selectedCategory?.id === cat.id) ? "bg-[#3b0764] text-white" : "bg-slate-200 text-slate-500"
                                        )}>
                                            {cat.subCategories?.length || 0}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right: Content Area */}
                    <div className="flex-1 flex flex-col bg-white">
                        {selectedCategory ? (
                            <>
                                <div className="px-8 py-5 border-b-2 border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-1.5 h-6 bg-[#3b0764] rounded-full"></div>
                                        <h3 className="text-xl font-black text-[#3b0764] tracking-tight uppercase leading-none">{selectedCategory.name}</h3>
                                        <div className="flex items-center gap-1 bg-[#3b0764]/10 px-2 py-1 rounded">
                                            <Layers className="w-3 h-3 text-[#3b0764]" />
                                            <span className="text-[10px] font-black text-[#3b0764] uppercase tracking-widest">
                                                {selectedCategory.subCategories?.length || 0} Units
                                            </span>
                                        </div>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-9 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-xl gap-2 font-black text-[10px] uppercase transition-all">
                                                <Trash2 className="w-4 h-4" /> Delete Group
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-2xl border-none shadow-3xl p-8">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-black uppercase text-slate-900 tracking-tight">Confirm Deletion</AlertDialogTitle>
                                                <AlertDialogDescription className="text-sm text-slate-500 font-bold mt-2">
                                                    You are about to delete <span className="font-black text-[#3b0764]">"{selectedCategory.name}"</span>. This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="mt-6">
                                                <AlertDialogCancel className="h-11 rounded-xl font-black text-xs uppercase tracking-widest border-2">Cancel</AlertDialogCancel>
                                                <AlertDialogAction 
                                                    onClick={() => onDeleteCategory('expenseCategories', selectedCategory.id)}
                                                    className="h-11 bg-red-600 hover:bg-red-700 rounded-xl font-black text-xs uppercase tracking-widest text-white"
                                                >
                                                    Delete Group
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>

                                <div className="flex-1 p-0 flex flex-col overflow-hidden">
                                    {/* Add Unit Row */}
                                    <div className="p-8 border-b border-slate-50 bg-white">
                                        <div className="flex gap-3 max-w-lg">
                                            <div className="relative flex-1 group">
                                                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#3b0764] transition-colors" />
                                                <Input 
                                                    placeholder="ADD NEW SUB-CATEGORY UNIT..." 
                                                    value={newSubName}
                                                    onChange={(e) => setNewSubName(e.target.value.toUpperCase())}
                                                    className="h-12 pl-12 border-slate-300 border-2 rounded-2xl font-black text-sm text-[#3b0764] bg-[#fcfcff] placeholder:text-slate-400 focus:bg-white focus:border-[#3b0764]/30 transition-all shadow-sm"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSub()}
                                                />
                                            </div>
                                            <Button onClick={handleAddSub} className="h-12 px-10 bg-[#3b0764] hover:bg-[#2e054f] text-white font-black rounded-2xl text-xs uppercase shadow-xl active:scale-95 transition-all">
                                                Add Unit
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Sub-categories Vertical List */}
                                    <ScrollArea className="flex-1">
                                        <div className="divide-y divide-slate-50">
                                            {selectedCategory.subCategories?.map((sub, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="group flex items-center justify-between px-10 py-5 hover:bg-[#f8f7ff] transition-all border-l-4 border-transparent hover:border-[#3b0764]"
                                                >
                                                    <div className="flex items-center gap-6">
                                                        <span className="text-[10px] font-black text-slate-400 w-6 tracking-tighter group-hover:text-[#3b0764] transition-colors">{String(idx + 1).padStart(2, '0')}</span>
                                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-[#3b0764] transition-colors">{sub}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onDeleteSubCategory('expenseCategories', selectedCategory.id, sub)}
                                                        className="h-10 w-10 text-slate-200 hover:text-red-600 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {(!selectedCategory.subCategories || selectedCategory.subCategories.length === 0) && (
                                                <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                                                    <AlertCircle className="w-12 h-12 opacity-10 mb-4" />
                                                    <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">No Units Defined</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/20 text-slate-400">
                                <LayoutGrid className="w-20 h-20 opacity-5 mb-6" />
                                <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">Select A Group To Manage</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer: Fixed Text Visibility */}
                <div className="px-8 py-4 bg-[#3b0764] flex items-center justify-between text-[10px] font-black text-white/80 uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                        <span>Cloud Storage Synced</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-white/50 tracking-widest">Enterprise Edition v3.0.4</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
