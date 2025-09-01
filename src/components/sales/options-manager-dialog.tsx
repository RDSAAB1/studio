
"use client";

import { useState } from "react";
import { toTitleCase } from "@/lib/utils";
import type { OptionItem } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pen, Save, Trash } from "lucide-react";

interface OptionsManagerDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    type: 'variety' | 'paymentType' | null;
    options: OptionItem[];
    onAdd: (collectionName: string, name: string) => void;
    onUpdate: (collectionName: string, id: string, name: string) => void;
    onDelete: (collectionName: string, id: string) => void;
}

export const OptionsManagerDialog = ({ isOpen, setIsOpen, type, options, onAdd, onUpdate, onDelete }: OptionsManagerDialogProps) => {
    const [editingOption, setEditingOption] = useState<{ id: string; name: string } | null>(null);
    const [newOptionName, setNewOptionName] = useState("");
    const { toast } = useToast();

    if (!type) return null;

    const title = type === 'variety' ? "Manage Varieties" : "Manage Payment Types";
    const collectionName = type === 'variety' ? 'varieties' : 'paymentTypes';

    const handleSave = () => {
        if (editingOption) {
            onUpdate(collectionName, editingOption.id, editingOption.name);
            toast({ title: "Option updated successfully.", variant: "success" });
            setEditingOption(null);
        }
    };
    
    const handleAdd = () => {
        if (newOptionName.trim()) {
            onAdd(collectionName, newOptionName);
            setNewOptionName("");
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>Add, edit, or remove options from the list.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Add new..."
                            value={newOptionName}
                            onChange={(e) => setNewOptionName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <Button onClick={handleAdd} size="sm">Add</Button>
                    </div>
                    <Separator />
                    <ScrollArea className="max-h-60 pr-4">
                        <div className="space-y-2">
                            {options.map((option: OptionItem) => (
                                <div key={option.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                                    {editingOption?.id === option.id ? (
                                        <Input
                                            value={editingOption.name}
                                            onChange={(e) => setEditingOption({ ...editingOption, name: e.target.value })}
                                            autoFocus
                                            onBlur={handleSave}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                        />
                                    ) : (
                                        <span className="flex-grow">{toTitleCase(option.name)}</span>
                                    )}
                                    <div className="flex gap-1">
                                        {editingOption?.id === option.id ? (
                                            <Button size="icon" variant="ghost" onClick={handleSave}><Save className="h-4 w-4 text-green-500" /></Button>
                                        ) : (
                                            <Button size="icon" variant="ghost" onClick={() => setEditingOption({ id: option.id, name: option.name })}><Pen className="h-4 w-4" /></Button>
                                        )}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash className="h-4 w-4 text-red-500" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the option "{toTitleCase(option.name)}".</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(collectionName, option.id)}>Continue</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
