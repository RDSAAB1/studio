
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CustomDropdown } from '@/components/ui/custom-dropdown';

const allItems = Array.from({ length: 50 }, (_, i) => ({
    value: `Printer ${i + 1}`,
    label: `Printer ${i + 1}`,
}));

export default function PrinterSettingsPage() {
    const { toast } = useToast();
    const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);

    const handleSave = () => {
        if (selectedPrinter) {
            toast({
                title: "Settings Saved",
                description: `Default printer set to: ${selectedPrinter}`,
                variant: "success",
            });
        } else {
            toast({
                title: "No Printer Selected",
                description: "Please select a printer before saving.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="space-y-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        Printer Settings
                    </CardTitle>
                    <CardDescription>
                        Select your default printer for all printing tasks within the application.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="printer-select">Default Printer</Label>
                        <CustomDropdown
                            options={allItems}
                            value={selectedPrinter}
                            onChange={setSelectedPrinter}
                            placeholder="Select a printer..."
                            searchPlaceholder="Search printers..."
                            noItemsPlaceholder="No printer found."
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button onClick={handleSave}>Save Settings</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
