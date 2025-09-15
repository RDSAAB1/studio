
"use client";

import { useState, useEffect } from 'react';
import { getFirebaseAuth, getGoogleProvider } from '@/lib/firebase';
import { signInWithRedirect, getRedirectResult, type User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, Sparkles } from 'lucide-react';

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const processRedirect = async () => {
            try {
                setLoading(true);
                const auth = getFirebaseAuth();
                const result = await getRedirectResult(auth);
                if (result?.user) {
                    // User is signed in via redirect.
                    // The onAuthStateChanged listener in AppLayout will handle the routing.
                    toast({ title: "Signed in successfully!", variant: 'success' });
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
                setLoading(false);
            }
        };

        processRedirect();
    }, [toast, router]);


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
