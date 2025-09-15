
"use client";

import { useState, useEffect } from 'react';
import { getFirebaseAuth, getGoogleProvider, onAuthStateChanged } from '@/lib/firebase';
import { signInWithPopup, type User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, Sparkles } from 'lucide-react';
import { getCompanySettings } from '@/lib/firestore';


export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                // User is signed in, check if they need to go to setup or dashboard
                getCompanySettings(currentUser.uid).then(settings => {
                    if (settings?.appPassword) {
                         router.replace('/dashboard-overview');
                    } else {
                        // If there are no app password settings, maybe go to a setup page
                        router.replace('/setup/connect-gmail');
                    }
                }).catch(() => {
                     router.replace('/dashboard-overview'); // fallback to dashboard
                });
            } else {
                setUser(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleGoogleSignIn = async () => {
        const auth = getFirebaseAuth();
        const provider = getGoogleProvider();
        setLoading(true);
        try {
            await signInWithPopup(auth, provider);
            // onAuthStateChanged will handle the redirect
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            toast({
                title: "Login Failed",
                description: "Could not sign in with Google. Please try again.",
                variant: "destructive",
            });
            setLoading(false);
        }
    };
    
    if (loading || user) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                         <Sparkles className="h-8 w-8 text-primary" />
                         <h1 className="text-3xl font-bold">BizSuite DataFlow</h1>
                    </div>
                    <CardTitle>Welcome Back</CardTitle>
                    <CardDescription>Sign in to access your business dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleGoogleSignIn} className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                        Sign in with Google
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

