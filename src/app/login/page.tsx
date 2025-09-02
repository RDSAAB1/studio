
"use client";

import { useState, useEffect } from 'react';
import type { Auth, GoogleAuthProvider, User } from 'firebase/auth';
import { signInWithPopup, signOut, GoogleAuthProvider as AuthProvider } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart3, Database, Users, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth, getGoogleProvider } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [auth, setAuth] = useState<Auth | null>(null);
    const [googleProvider, setGoogleProvider] = useState<GoogleAuthProvider | null>(null);
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        setAuth(getFirebaseAuth());
        setGoogleProvider(getGoogleProvider());
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    const handleSignIn = async () => {
        if (!auth || !googleProvider) {
            toast({
                title: "Authentication not ready",
                description: "Please wait a moment and try again.",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            await signOut(auth); // Ensure previous user is signed out
            const result = await signInWithPopup(auth, googleProvider);
            const credential = AuthProvider.credentialFromResult(result);
            if (credential && auth.currentUser) {
                // Store the OAuth refresh token with the user object for later use
                // This is a non-standard property, so we cast to `any`
                (auth.currentUser as any).refreshToken = credential.refreshToken;
            }
        } catch (error: any) {
            console.error("Error signing in with Google: ", error);
            let errorMessage = "An unknown error occurred.";
            if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = "Login cancelled or popup blocked. Please ensure the current URL is an authorized domain in your Google Cloud Console.";
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = "Network error. Please check your connection.";
            } else if (error.code === 'auth/configuration-not-found') {
                errorMessage = "Authentication is not configured correctly. Please contact support.";
            } else if (error.code === 'auth/operation-not-allowed') {
                 errorMessage = "Sign-in with Google is not enabled for this app. Please contact support.";
            }
            toast({
                title: "Login Failed",
                description: errorMessage,
                variant: "destructive"
            });
            setLoading(false);
        }
    };
    
    const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
        <div className="flex items-start gap-4">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">{icon}</div>
            <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    );
    
    const isCloudWorkspace = origin.includes('cloudworkstations.dev');

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 overflow-hidden shadow-2xl">
                <div className="p-8 flex flex-col justify-center">
                    <CardHeader className="p-0 mb-6">
                        <div className="flex items-center gap-3 mb-2">
                             <Sparkles className="h-8 w-8 text-primary" />
                             <h1 className="text-3xl font-bold">BizSuite DataFlow</h1>
                        </div>
                        <CardDescription>Your all-in-one business management solution. Sign in to continue.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                         <div className="space-y-6 mb-8">
                             <FeatureCard icon={<Users className="h-5 w-5"/>} title="Unified Management" description="Handle suppliers, customers, and finances all in one place." />
                             <FeatureCard icon={<BarChart3 className="h-5 w-5"/>} title="Insightful Reports" description="Generate RTGS, sales, and financial reports with a single click." />
                             <FeatureCard icon={<Database className="h-5 w-5"/>} title="Secure & Reliable" description="Your data is safe and always accessible with our robust backend." />
                         </div>
                        <Button onClick={handleSignIn} className="w-full font-semibold" disabled={loading || !auth}>
                             {loading ? (
                                <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing in...
                                </>
                             ) : (
                                <>
                                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 177.2 56.4l-63.1 61.9C338.4 99.4 300.9 88 248 88c-77.2 0-140.1 63.8-140.1 142.3s62.9 142.3 140.1 142.3c85.3 0 121.7-64.8 125.1-97.9H248v-69.8h239.5c1.4 9.3 2.5 19.1 2.5 29.5z"></path></svg>
                                Sign in with Google
                                </>
                             )}
                        </Button>
                         {isCloudWorkspace && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Configuration Help</AlertTitle>
                                <AlertDescription className="text-xs">
                                    To enable Google Sign-In, add this URL to your Google Cloud Console's "Authorised JavaScript origins":
                                    <strong className="block break-all mt-1">{origin}</strong>
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </div>
                 <div className="hidden md:block bg-muted/40 p-8">
                    <div className="flex flex-col justify-center h-full">
                        <img src="https://picsum.photos/800/600" data-ai-hint="business data" alt="BizSuite Illustration" className="rounded-lg shadow-lg" />
                    </div>
                </div>
            </Card>
        </div>
    );
}
