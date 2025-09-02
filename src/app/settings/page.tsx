
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getCompanySettings, saveCompanySettings } from '@/lib/firestore';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from 'lucide-react';

export default function SettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState({ name: '', email: '', appPassword: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            const savedSettings = await getCompanySettings();
            if (savedSettings) {
                setSettings(savedSettings);
            }
            setLoading(false);
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveCompanySettings(settings);
            toast({
                title: "Settings Saved",
                description: "Your company details have been updated successfully.",
                variant: "success",
            });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({
                title: "Error",
                description: "Failed to save settings. Please try again.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="container mx-auto py-8">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Company & Email Settings</CardTitle>
                    <CardDescription>
                        Configure the company details and email credentials for sending reports.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                            id="companyName"
                            value={settings.name}
                            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                            placeholder="e.g., Jagdambe Rice Mill"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Sender Gmail Address</Label>
                        <Input
                            id="email"
                            type="email"
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                            placeholder="e.g., yourcompany@gmail.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="appPassword">Gmail App Password</Label>
                        <Input
                            id="appPassword"
                            type="password"
                            value={settings.appPassword}
                            onChange={(e) => setSettings({ ...settings, appPassword: e.target.value })}
                            placeholder="Enter 16-character app password"
                        />
                    </div>
                     <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>How to get a Gmail App Password</AlertTitle>
                        <AlertDescription className="text-xs space-y-1">
                            <p>1. Go to your Google Account &gt; Security.</p>
                            <p>2. Ensure 2-Step Verification is ON.</p>
                            <p>3. Click on 'App passwords'.</p>
                            <p>4. Select 'Mail' for the app and 'Other (Custom name)' for the device.</p>
                            <p>5. Enter a name (e.g., "BizSuite App") and click 'Generate'.</p>
                            <p>6. Copy the 16-character password and paste it here.</p>
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Settings'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
