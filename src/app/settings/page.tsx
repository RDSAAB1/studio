
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getCompanySettings, saveCompanySettings } from '@/lib/firestore';
import { Loader2, Info, CheckCircle, ExternalLink, Link as LinkIcon, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function SettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<{ name: string; email: string; appPassword: string }>({ name: '', email: '', appPassword: '' });
    const [isConfigured, setIsConfigured] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            const savedSettings = await getCompanySettings();
            if (savedSettings && savedSettings.email && savedSettings.appPassword) {
                setSettings(savedSettings);
                setIsConfigured(true);
            }
            setLoading(false);
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        if (!settings.email || !settings.appPassword) {
            toast({
                title: "Incomplete Details",
                description: "Please provide both Gmail address and App Password.",
                variant: "destructive",
            });
            return;
        }
        setSaving(true);
        try {
            await saveCompanySettings(settings);
            toast({
                title: "Settings Saved",
                description: "Your company details have been updated successfully.",
                variant: "success",
            });
            setIsConfigured(true);
            setIsDialogOpen(false);
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
    
    const handleEdit = () => {
        setIsDialogOpen(true);
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
                <CardContent>
                    {isConfigured ? (
                        <div className="space-y-4">
                             <Alert variant="default" className="border-green-500/50 bg-green-500/10">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <AlertTitle className="text-green-600">Email Configured</AlertTitle>
                                <AlertDescription>
                                    Your app is ready to send emails from <strong>{settings.email}</strong>.
                                </AlertDescription>
                            </Alert>
                             <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input value={settings.name || 'Not Set'} readOnly disabled />
                            </div>
                             <div className="space-y-2">
                                <Label>Sender Email</Label>
                                <Input value={settings.email} readOnly disabled />
                            </div>
                        </div>
                    ) : (
                         <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
                            <LinkIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-2 text-lg font-medium">Connect your Gmail Account</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                To send reports, you need to connect a Gmail account using an App Password.
                            </p>
                            <div className="mt-6">
                                <Button onClick={() => setIsDialogOpen(true)}>
                                    Connect Gmail Account
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
                 {isConfigured && (
                    <CardFooter>
                         <Button variant="outline" onClick={handleEdit}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Settings
                        </Button>
                    </CardFooter>
                )}
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Configure Email Sender</DialogTitle>
                        <DialogDescription>
                             Follow these steps to securely connect your Gmail account for sending reports.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                         <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle className="font-semibold">What is an App Password?</AlertTitle>
                            <AlertDescription className="text-xs">
                                An App Password is a 16-digit code that gives a less secure app or device permission to access your Google Account. It can only be used with accounts that have 2-Step Verification turned on.
                            </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Step 1: Your Company Name</Label>
                            <Input
                                id="companyName"
                                placeholder="e.g., Jagdambe Rice Mill"
                                value={settings.name}
                                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Step 2: Your Gmail Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="e.g., yourcompany@gmail.com"
                                value={settings.email}
                                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label>Step 3: Generate & Copy App Password</Label>
                             <Link href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" className="w-full">
                                    Go to Google App Passwords <ExternalLink className="ml-2 h-4 w-4"/>
                                </Button>
                            </Link>
                             <ul className="list-decimal list-inside text-xs text-muted-foreground pl-2 space-y-1 mt-2">
                                <li>If prompted, sign in to your Google Account.</li>
                                <li>Under 'Select app', choose 'Mail'.</li>
                                <li>Under 'Select device', choose 'Other (Custom name)'.</li>
                                <li>Enter a name (e.g., "BizSuite App") and click 'Generate'.</li>
                                <li>Copy the 16-character password shown.</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="appPassword">Step 4: Paste App Password Here</Label>
                            <Input
                                id="appPassword"
                                type="password"
                                placeholder="Enter 16-character app password"
                                value={settings.appPassword}
                                onChange={(e) => setSettings({ ...settings, appPassword: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save & Connect'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
