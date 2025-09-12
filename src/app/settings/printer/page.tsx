
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PrinterSettingsPage() {
    const [selectedPrinter, setSelectedPrinter] = useState<string | undefined>();
    const { toast } = useToast();

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
                        <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                            <SelectTrigger id="printer-select">
                                <SelectValue placeholder="Select a printer" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 50 }, (_, i) => (
                                    <SelectItem key={`printer-${i + 1}`} value={`Printer ${i + 1}`}>
                                        Printer {i + 1}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button onClick={handleSave}>Save Settings</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
