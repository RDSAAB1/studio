
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
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const auth = getFirebaseAuth();
        
        getRedirectResult(auth)
            .then((result) => {
                if (result?.user) {
                    toast({ title: "Signed in successfully!", variant: 'success' });
                    // The AuthChecker component will handle redirection.
                }
            })
            .catch((error: any) => {
                console.error("Google Sign-In Redirect Error:", error);
                if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                    toast({
                        title: "Login Failed",
                        description: "Could not sign in with Google. Please try again.",
                        variant: "destructive",
                    });
                }
                setLoading(false);
            });
    }, [toast]);


    const handleGoogleSignIn = async () => {
        const auth = getFirebaseAuth();
        const provider = getGoogleProvider();
        setLoading(true);
        try {
          await signInWithRedirect(auth, provider);
        } catch (error) {
           console.error("Sign-in initiation failed", error);
           setLoading(false);
           toast({ title: "Sign-in Failed", description: "Could not start the sign-in process.", variant: "destructive" });
        }
    };

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
