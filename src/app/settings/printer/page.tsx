
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Printer, ChevronDown, ChevronUp, X, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const allItems = Array.from({ length: 50 }, (_, i) => `Printer ${i + 1}`);

export default function PrinterSettingsPage() {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredItems = useMemo(() => {
        if (!searchTerm) {
            return allItems;
        }
        return allItems.filter(item =>
            item.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = (item: string) => {
        setSelectedPrinter(item);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedPrinter(null);
        setSearchTerm('');
    };
    
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
                         <div
                            className="relative w-full max-w-sm"
                            ref={dropdownRef}
                        >
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="w-full flex justify-between items-center p-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <span className="text-foreground">
                                    {selectedPrinter || 'Select a printer...'}
                                </span>
                                <div className="flex items-center space-x-2">
                                    {selectedPrinter && (
                                    <X
                                        className="w-4 h-4 text-muted-foreground hover:text-destructive"
                                        onClick={handleClear}
                                    />
                                    )}
                                    {isOpen ? (
                                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </div>
                            </button>

                            {isOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    <div className="relative p-2">
                                    <input
                                        type="text"
                                        placeholder="Search printers..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-2 py-2 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    </div>

                                    <ul className="py-1 max-h-40 overflow-y-auto">
                                    {filteredItems.length > 0 ? (
                                        filteredItems.map((item, index) => (
                                        <li
                                            key={index}
                                            onClick={() => handleSelect(item)}
                                            className={`cursor-pointer px-4 py-2 text-sm hover:bg-accent ${
                                            selectedPrinter === item ? 'bg-accent font-medium' : ''
                                            }`}
                                        >
                                            {item}
                                        </li>
                                        ))
                                    ) : (
                                        <li className="px-4 py-2 text-sm text-muted-foreground text-center">
                                            No printer found.
                                        </li>
                                    )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button onClick={handleSave}>Save Settings</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
