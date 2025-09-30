

"use client";

import { useState } from "react";
import type { ReceiptSettings, ReceiptFieldSettings } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { updateReceiptSettings } from "@/lib/firestore";
import { toTitleCase } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface ReceiptSettingsDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    settings: ReceiptSettings | null;
    setSettings: (settings: ReceiptSettings) => void;
}

export const ReceiptSettingsDialog = ({ isOpen, setIsOpen, settings, setSettings }: ReceiptSettingsDialogProps) => {
    const { toast } = useToast();
    const [tempSettings, setTempSettings] = useState<ReceiptSettings | null>(null);

    const handleOpen = () => {
        setTempSettings(settings);
        setIsOpen(true);
    };

    const handleSave = async () => {
        if (tempSettings) {
            try {
                await updateReceiptSettings(tempSettings);
                setSettings(tempSettings);
                setIsOpen(false);
                toast({ title: "Success", description: "Receipt details saved successfully." });
            } catch (error) {
                console.error("Error saving receipt settings:", error);
                toast({ title: "Error", description: "Failed to save details.", variant: "destructive" });
            }
        }
    };
    
    const handleFieldVisibilityChange = (field: keyof ReceiptFieldSettings, checked: boolean) => {
        if (tempSettings) {
            setTempSettings({
            ...tempSettings,
            fields: {
                ...tempSettings.fields,
                [field]: checked,
            },
            });
        }
    };

    // This is a placeholder for a button to open the dialog.
    // In a real app, you would place a <Button onClick={handleOpen}>Settings</Button> where needed.
    // For now, this component doesn't render anything itself, it just provides the dialog logic.

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Receipt Details</DialogTitle>
                    <DialogDescription>Update the company details and visible fields on the printed receipt.</DialogDescription>
                </DialogHeader>
                {tempSettings && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 py-4">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Company Information</h3>
                            <div className="space-y-1"><Label>Company Name</Label><Input value={tempSettings.companyName} onChange={(e) => setTempSettings({...tempSettings, companyName: e.target.value})} /></div>
                            <div className="space-y-1"><Label>Address 1</Label><Input value={tempSettings.companyAddress1} onChange={(e) => setTempSettings({...tempSettings, companyAddress1: e.target.value})} /></div>
                            <div className="space-y-1"><Label>Address 2</Label><Input value={tempSettings.companyAddress2} onChange={(e) => setTempSettings({...tempSettings, companyAddress2: e.target.value})} /></div>
                            <div className="space-y-1"><Label>Contact No.</Label><Input value={tempSettings.contactNo} onChange={(e) => setTempSettings({...tempSettings, contactNo: e.target.value})} /></div>
                            <div className="space-y-1"><Label>Email</Label><Input type="email" value={tempSettings.gmail} onChange={(e) => setTempSettings({...tempSettings, gmail: e.target.value})} /></div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Visible Fields</h3>
                            <ScrollArea className="h-64 pr-4">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    {Object.keys(tempSettings.fields).map((key) => (
                                        <div key={key} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`field-${key}`}
                                                checked={tempSettings.fields[key as keyof ReceiptFieldSettings]}
                                                onCheckedChange={(checked) => handleFieldVisibilityChange(key as keyof ReceiptFieldSettings, !!checked)}
                                            />
                                            <Label htmlFor={`field-${key}`} className="font-normal text-sm">{toTitleCase(key.replace(/([A-Z])/g, ' $1'))}</Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
