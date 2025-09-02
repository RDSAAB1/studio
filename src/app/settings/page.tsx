
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase';
import { getCompanySettings, saveCompanySettings, deleteCompanySettings } from '@/lib/firestore';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, ExternalLink, Link, Unlink, CheckCircle, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SettingsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [email, setEmail] = useState('');
    const [appPassword, setAppPassword] = useState('');
    const [currentEmail, setCurrentEmail] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    
    const [isTwoFactorConfirmed, setIsTwoFactorConfirmed] = useState(false);
    const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setLoading(true);
                const settings = await getCompanySettings(currentUser.uid);
                if (settings && settings.appPassword) {
                    setCurrentEmail(settings.email);
                    setEmail(settings.email);
                } else {
                    setCurrentEmail(null);
                    setEmail(currentUser.email || ''); // Default to logged-in user's email if not set
                }
                setLoading(false);
            } else {
                router.replace('/login');
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleSave = async () => {
        if (!user || !email || !appPassword) {
            toast({
                title: "Error",
                description: "Please fill in both email and the 16-character App Password.",
                variant: "destructive",
            });
            return;
        }

        if (appPassword.replace(/\s/g, '').length !== 16) {
             toast({
                title: "Invalid Password",
                description: "The App Password must be 16 characters long.",
                variant: "destructive",
            });
            return;
        }

        setSaving(true);
        try {
            await saveCompanySettings(user.uid, {
                email: email,
                appPassword: appPassword.replace(/\s/g, ''),
            });
            setCurrentEmail(email);
            setAppPassword(''); // Clear password field after save
            toast({
                title: "Success!",
                description: "Your email settings have been connected successfully.",
                variant: "success",
            });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({
                title: "Failed to Save",
                description: "Could not save your settings. Please try again.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!user) return;
        setDisconnecting(true);
        try {
            await deleteCompanySettings(user.uid);
            setCurrentEmail(null);
            setAppPassword('');
            setEmail(user.email || '');
            toast({
                title: "Disconnected",
                description: "Your email account has been disconnected.",
            });
        } catch (error) {
            console.error("Error disconnecting email:", error);
            toast({
                title: "Error",
                description: "Could not disconnect your email. Please try again.",
                variant: "destructive",
            });
        } finally {
            setDisconnecting(false);
        }
    };
    
    const cardContent = () => {
        if (loading) {
            return (
                <CardContent className="flex h-48 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            );
        }

        if (currentEmail) {
            return (
                <>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                            <div className="flex-shrink-0 rounded-full bg-green-500/20 p-2 text-green-600">
                                <Link className="h-5 w-5"/>
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Connected as {currentEmail}</p>
                                <p className="text-xs text-muted-foreground">The application will send emails using this account.</p>
                            </div>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={disconnecting}>
                                    {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Unlink className="mr-2 h-4 w-4"/>}
                                    Disconnect
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will disconnect your email account. You won't be able to send reports until you connect a new one.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDisconnect}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                </>
            );
        }

        return (
            <>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Your Gmail Account</Label>
                        <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="appPassword">Google App Password</Label>
                         <div className="flex items-center gap-2">
                            <Input
                                id="appPassword"
                                type="password"
                                value={appPassword}
                                onChange={(e) => setAppPassword(e.target.value)}
                                placeholder="xxxx xxxx xxxx xxxx"
                                disabled={!isTwoFactorConfirmed}
                            />
                            <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">How to get this?</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>How to Get an App Password</DialogTitle>
                                        <DialogDescription>
                                            An App Password lets our app send emails on your behalf without needing your main password.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 text-sm">
                                        <Card>
                                          <CardHeader className="p-4">
                                            <CardTitle className="text-base">Step 1: Enable 2-Step Verification</CardTitle>
                                            <CardDescription className="text-xs">First, ensure 2-Step Verification is on. It's required by Google.</CardDescription>
                                          </CardHeader>
                                          <CardFooter className="p-4 pt-0 flex flex-col items-start gap-3">
                                             <a href={`https://myaccount.google.com/signinoptions/two-step-verification?authuser=${email}`} target="_blank" rel="noopener noreferrer" className="w-full">
                                                <Button size="sm" className="w-full">Go to 2-Step Verification <ExternalLink className="ml-2 h-3 w-3"/></Button>
                                            </a>
                                            <Button size="sm" variant="secondary" className="w-full" onClick={() => setIsTwoFactorConfirmed(true)}>
                                                <ShieldCheck className="mr-2 h-4 w-4" /> I have enabled 2-Step Verification
                                            </Button>
                                          </CardFooter>
                                        </Card>
                                        
                                        {isTwoFactorConfirmed && (
                                            <div className="animate-in fade-in-50 duration-500 space-y-4">
                                                <Card className="border-primary/50 bg-primary/10">
                                                    <CardHeader className="p-4">
                                                        <CardTitle className="text-base">Step 2: Most Important!</CardTitle>
                                                        <CardDescription className="text-xs">
                                                        In the next step, Google will show you a 16-character password. Copy it and paste it into the App Password field on our settings page.
                                                        </CardDescription>
                                                    </CardHeader>
                                                </Card>
                                                <Card>
                                                    <CardHeader className="p-4">
                                                        <CardTitle className="text-base">Step 3: Create App Password</CardTitle>
                                                        <CardDescription className="text-xs">
                                                        <ul className="list-disc pl-4 space-y-1 mt-2">
                                                            <li>Go to the App Passwords page using the button below.</li>
                                                            <li>For the app name, enter "BizSuite DataFlow" and click "Create".</li>
                                                        </ul>
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardFooter className="p-4 pt-0 flex-col items-start gap-3">
                                                        <a href={`https://myaccount.google.com/apppasswords?authuser=${email}`} target="_blank" rel="noopener noreferrer" className="w-full">
                                                            <Button size="sm" className="w-full">Go to App Passwords <ExternalLink className="ml-2 h-3 w-3"/></Button>
                                                        </a>
                                                        <div className="flex gap-2 p-2 border-l-4 border-primary/80 bg-primary/10 w-full">
                                                            <AlertCircle className="h-4 w-4 text-primary/80 flex-shrink-0 mt-0.5"/>
                                                            <p className="text-xs text-primary/90">
                                                                If you see an error like "You are not eligible...", it means 2-Step Verification is not active. Please complete Step 1 first.
                                                            </p>
                                                        </div>
                                                    </CardFooter>
                                                </Card>
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsHelpDialogOpen(false)}>Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} disabled={saving} className="w-full">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                        Save & Connect
                    </Button>
                </CardFooter>
            </>
        );
    };

    return (
        <div className="flex items-center justify-center p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>Email Settings</CardTitle>
                    <CardDescription>
                       To send reports, connect your Gmail account by creating a secure App Password.
                    </CardDescription>
                </CardHeader>
                {cardContent()}
            </Card>
        </div>
    );
}
