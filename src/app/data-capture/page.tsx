
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, Clipboard, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DataCapturePage() {
    const [capturedData, setCapturedData] = useState("");
    const { toast } = useToast();

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setCapturedData(text);
            toast({
                title: "Data Pasted",
                description: "Data from clipboard has been pasted successfully.",
                variant: "success",
            });
        } catch (error) {
            console.error('Failed to read clipboard contents: ', error);
            toast({
                title: "Paste Failed",
                description: "Could not read data from the clipboard.",
                variant: "destructive",
            });
        }
    };

    const handleClear = () => {
        setCapturedData("");
        toast({
            title: "Data Cleared",
            description: "The text area has been cleared.",
        });
    };
    
    return (
        <div className="container mx-auto py-8">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-6 w-6" />
                        Data Capture Terminal
                    </CardTitle>
                    <CardDescription>
                        This page is designed to receive and display data from external sources, such as a print command routed to a web endpoint. For now, you can manually paste data below to see how it would be processed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder="Waiting for data... or you can paste it here."
                        value={capturedData}
                        onChange={(e) => setCapturedData(e.target.value)}
                        className="min-h-[300px] font-mono text-sm"
                    />
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handlePaste}>
                        <Clipboard className="mr-2 h-4 w-4" />
                        Paste from Clipboard
                    </Button>
                    <Button variant="destructive" onClick={handleClear} disabled={!capturedData}>
                         <Trash2 className="mr-2 h-4 w-4" />
                        Clear Data
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
