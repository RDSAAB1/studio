
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase';
import { saveCompanySettings } from '@/lib/firestore';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ConnectGmailPage() {
    const [user, setUser] = useState<User | null>(null);
    const [appPassword, setAppPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
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
            toast({
                title: "Error",
                description: "Please enter the 16-character App Password.",
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
                email: user.email!,
                appPassword: appPassword,
            });
            toast({
                title: "Success!",
                description: "Your Gmail account has been connected successfully.",
                variant: "success",
            });
            router.replace('/sales/dashboard-overview');
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

    if (loading || !user) {
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
                    <CardTitle>Connect Your Gmail Account</CardTitle>
                    <CardDescription>
                        To send reports, you need to connect your Gmail account by creating an App Password.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Your Gmail Account</Label>
                        <Input id="email" value={user.email || ''} readOnly disabled />
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
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>How to Get an App Password</DialogTitle>
                                        <DialogDescription>
                                            An App Password is a 16-digit code that gives our app permission to send emails on your behalf without exposing your main password.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-3 text-sm">
                                        <p>1. Click the button below to go to your Google Account's security settings.</p>
                                        <p>2. You may need to sign in. Make sure **2-Step Verification** is turned ON.</p>
                                        <p>3. Find and click on **App passwords**.</p>
                                        <p>4. For the app name, type "BizSuite DataFlow" and click **Create**.</p>
                                        <p>5. Google will show you a 16-character password. Copy it.</p>
                                        <p>6. Come back here and paste the password into the input field.</p>
                                    </div>
                                    <DialogFooter>
                                         <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                                            <Button>
                                                Go to Google Settings <ExternalLink className="ml-2 h-4 w-4"/>
                                            </Button>
                                        </a>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                    
                    <Button onClick={handleSave} disabled={saving} className="w-full">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                        Save & Continue
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
