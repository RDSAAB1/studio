
"use client";

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { saveCompanySettings } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, ExternalLink, Loader2, LogOut, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ConnectGmailPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [appPassword, setAppPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
    const [isTwoFactorConfirmed, setIsTwoFactorConfirmed] = useState(false);

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                router.replace('/login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    const handleSave = async () => {
        if (!user || !appPassword) {
            toast({ title: "App Password is required.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            await saveCompanySettings(user.uid, { email: user.email!, appPassword: appPassword.replace(/\s/g, '') });
            toast({ title: "Success!", description: "Your Gmail account is connected." });
            router.push('/setup/company-details');
        } catch (error) {
            console.error("Error saving settings: ", error);
            toast({ title: "Error", description: "Failed to save settings. Please try again.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };
    
    const handleSignOut = async () => {
        try {
            await signOut(getFirebaseAuth());
            router.push('/login');
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                         <Sparkles className="h-8 w-8 text-primary" />
                         <h1 className="text-3xl font-bold">BizSuite DataFlow</h1>
                    </div>
                    <CardTitle>Step 1: Connect your Gmail</CardTitle>
                    <CardDescription>
                        To send reports and invoices, the app needs an App Password for your Google Account. Your main password is never stored.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label>Your Gmail Account</Label>
                        <Input value={user?.email || ''} readOnly disabled />
                    </div>
                     <div className="space-y-1">
                        <Label>Google App Password</Label>
                        <div className="flex items-center gap-2">
                             <Input 
                                type="password" 
                                value={appPassword}
                                onChange={(e) => setAppPassword(e.target.value)}
                                placeholder="xxxx xxxx xxxx xxxx"
                                disabled={!isTwoFactorConfirmed}
                             />
                             <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button type="button" variant="outline" size="sm">How?</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                     <DialogHeader><DialogTitle>How to Get an App Password</DialogTitle><DialogDescription>An App Password is a 16-digit code that gives an app permission to access your Google Account.</DialogDescription></DialogHeader>
                                     <ScrollArea className="max-h-[60vh] pr-4">
                                        <div className="space-y-4 text-sm">
                                                <div className="flex gap-2 p-2 border-l-4 border-primary/80 bg-primary/10 w-full">
                                                    <AlertCircle className="h-4 w-4 text-primary/80 flex-shrink-0 mt-0.5"/>
                                                    <p className="text-xs text-primary/90">To create an App Password, you first need to enable 2-Step Verification on your Google Account.</p>
                                                </div>
                                                <Card>
                                                    <CardHeader className="p-4"><CardTitle className="text-base">Step 1: Enable 2-Step Verification</CardTitle><CardDescription className="text-xs">This adds an extra layer of security to your account.</CardDescription></CardHeader>
                                                    <CardFooter className="p-4 pt-0 flex flex-col items-start gap-3">
                                                        <a href={`https://myaccount.google.com/signinoptions/two-step-verification?authuser=${user?.email || ''}`} target="_blank" rel="noopener noreferrer" className="w-full"><Button size="sm" className="w-full">Go to 2-Step Verification <ExternalLink className="ml-2 h-3 w-3"/></Button></a>
                                                        <Button onClick={() => {setIsTwoFactorConfirmed(true); toast({title: "Confirmed!", description: "You can now proceed to Step 2."})}} className="w-full" variant="secondary" size="sm">
                                                            I have enabled it
                                                        </Button>
                                                    </CardFooter>
                                                </Card>
                                                
                                                 <Card className="border-primary/50 bg-primary/10">
                                                    <CardHeader className="p-4">
                                                        <CardTitle className="text-base">Most Important!</CardTitle>
                                                        <CardDescription className="text-xs">
                                                            In the next step, Google will show you a 16-character password. <strong>Copy it and paste it</strong> into the App Password field on our settings page.
                                                        </CardDescription>
                                                    </CardHeader>
                                                </Card>

                                                <Card className={!isTwoFactorConfirmed ? 'opacity-50 pointer-events-none' : ''}>
                                                    <CardHeader className="p-4">
                                                        <CardTitle className="text-base">Step 2: Create & Copy App Password</CardTitle>
                                                        <CardDescription className="text-xs">
                                                            <ul className="list-decimal pl-5 space-y-1 mt-2">
                                                                <li>Go to the App Passwords page using the button below.</li>
                                                                <li>For the app name, enter <strong>"BizSuite DataFlow"</strong> and click "CREATE".</li>
                                                                <li>Google will show you the 16-character password. Copy it.</li>
                                                            </ul>
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardFooter className="p-4 pt-0">
                                                        <a href={`https://myaccount.google.com/apppasswords?authuser=${user?.email || ''}`} target="_blank" rel="noopener noreferrer" className="w-full">
                                                            <Button size="sm" className="w-full" disabled={!isTwoFactorConfirmed}>Go to App Passwords <ExternalLink className="ml-2 h-3 w-3"/></Button>
                                                        </a>
                                                    </CardFooter>
                                                </Card>
                                            </div>
                                     </ScrollArea>
                                        <DialogFooter className="sm:justify-start mt-4">
                                          <Button variant="outline" onClick={() => setIsHelpDialogOpen(false)}>Close</Button>
                                        </DialogFooter>
                                </DialogContent>
                             </Dialog>
                        </div>
                     </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                     <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground">
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out & Use Different Account
                     </Button>
                     <Button onClick={handleSave} disabled={saving || !appPassword}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4"/>}
                        Save & Continue
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

    