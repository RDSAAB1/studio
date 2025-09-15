
"use client";

import { useState, useEffect } from 'react';
import { getFirebaseAuth, getGoogleProvider, getRedirectResult, onAuthStateChanged } from '@/lib/firebase';
import { signInWithRedirect, type User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, Sparkles } from 'lucide-react';
import { getCompanySettings } from '@/lib/firestore';

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(true); // Start with loading true

    // This effect handles both the initial auth state and the redirect result.
    useEffect(() => {
        const auth = getFirebaseAuth();
        
        const processRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result?.user) {
                    toast({ title: "Signed in successfully!", variant: 'success' });
                    // No need to navigate here, onAuthStateChanged will handle it.
                }
            } catch (error: any) {
                 console.error("Google Sign-In Redirect Error:", error);
                if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                    toast({
                        title: "Login Failed",
                        description: "Could not sign in with Google. Please try again.",
                        variant: "destructive",
                    });
                }
            } finally {
                // Only set loading to false after redirect processing is attempted.
                setLoading(false);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in. Check if setup is complete.
                const settings = await getCompanySettings(user.uid);
                if (!settings?.appPassword) {
                    router.push('/setup/connect-gmail');
                } else {
                    router.push('/dashboard-overview');
                }
            } else {
                // No user is signed in. Process any pending redirect.
                processRedirect();
            }
        });

        return () => unsubscribe();
    }, [router, toast]);


    const handleGoogleSignIn = async () => {
        const auth = getFirebaseAuth();
        const provider = getGoogleProvider();
        setLoading(true);
        // We use signInWithRedirect which is more robust in different environments
        await signInWithRedirect(auth, provider);
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
