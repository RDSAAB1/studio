
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
import { Loader2, KeyRound, ExternalLink, Link, Unlink, CheckCircle, ArrowRight } from 'lucide-react';
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
                            />
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">How to get this?</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>How to Get an App Password</DialogTitle>
                                        <DialogDescription>
                                            An App Password is a 16-digit code that lets our app send emails on your behalf without exposing your main password.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 text-sm">
                                        <Card>
                                          <CardHeader className="p-4">
                                            <CardTitle className="text-base">Step 1: Enable 2-Step Verification</CardTitle>
                                            <CardDescription className="text-xs">First, enable 2-Step Verification if it's not already on. This is required by Google.</CardDescription>
                                          </CardHeader>
                                          <CardFooter className="p-4 pt-0">
                                             <a href={`https://myaccount.google.com/signinoptions/two-step-verification?authuser=${email}`} target="_blank" rel="noopener noreferrer" className="w-full">
                                                <Button size="sm" className="w-full">Go to 2-Step Verification <ExternalLink className="ml-2 h-3 w-3"/></Button>
                                            </a>
                                          </CardFooter>
                                        </Card>
                                        <Card>
                                          <CardHeader className="p-4">
                                            <CardTitle className="text-base">Step 2: Create App Password</CardTitle>
                                            <CardDescription className="text-xs">Once 2-Step Verification is on, go to the App Passwords page. For the app name, use "BizSuite" and click "Create".</CardDescription>
                                          </CardHeader>
                                           <CardFooter className="p-4 pt-0">
                                            <a href={`https://myaccount.google.com/apppasswords?authuser=${email}`} target="_blank" rel="noopener noreferrer" className="w-full">
                                                <Button size="sm" className="w-full">Go to App Passwords <ExternalLink className="ml-2 h-3 w-3"/></Button>
                                            </a>
                                          </CardFooter>
                                        </Card>
                                        <div className="flex gap-4 p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                                            <div className="font-bold text-lg text-green-600 pt-1">
                                                <CheckCircle/>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">Copy & Paste</h4>
                                                <p className="text-xs text-muted-foreground">Google will show you a 16-character password. Copy it (without spaces) and paste it into the input field on our settings page.</p>
                                            </div>
                                        </div>
                                    </div>
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
                        To send reports, connect a Gmail account by creating an App Password.
                    </CardDescription>
                </CardHeader>
                {cardContent()}
            </Card>
        </div>
    );
}
