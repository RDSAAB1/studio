
"use client";

import { useState, useEffect } from 'react';
import { getFirebaseAuth, getGoogleProvider, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, Sparkles, Mail, KeyRound, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'login' | 'signup' | 'forgotPassword'>('login');
    const router = useRouter();

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const handleGoogleSignIn = async () => {
        const auth = getFirebaseAuth();
        const provider = getGoogleProvider();
        setLoading(true);
        try {
          // signInWithRedirect is better for handling complex login flows
          // and avoids issues with pop-up blockers.
          await getRedirectResult(auth); // Check if we are coming from a redirect
        } catch (error) {
           console.error("Sign-in with redirect result failed", error);
           setLoading(false);
           toast({ title: "Sign-in Failed", description: "Could not complete the sign-in process.", variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: LoginFormValues) => {
        setLoading(true);
        const auth = getFirebaseAuth();
        try {
            if (mode === 'login') {
                await signInWithEmailAndPassword(auth, data.email, data.password);
                toast({ title: "Login Successful", variant: "success" });
                // The onAuthStateChanged listener in AppLayout will handle the redirect
            } else if (mode === 'signup') {
                await createUserWithEmailAndPassword(auth, data.email, data.password);
                toast({ title: "Signup Successful", description: "You are now logged in.", variant: "success" });
            }
        } catch (error: any) {
            console.error(`${mode} error:`, error);
            const errorCode = error.code || '';
            let errorMessage = "An unexpected error occurred.";
            if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
                errorMessage = "Invalid email or password. Please check your credentials or sign up.";
            } else if (errorCode === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please log in.";
            }
            toast({ title: `${toTitleCase(mode)} Failed`, description: errorMessage, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    
    const handlePasswordReset = async (data: { email: string }) => {
        setLoading(true);
        const auth = getFirebaseAuth();
        try {
            await sendPasswordResetEmail(auth, data.email);
            toast({ title: "Password Reset Email Sent", description: "Please check your inbox to reset your password.", variant: "success" });
            setMode('login');
        } catch (error: any) {
            console.error("Password reset error:", error);
            let errorMessage = "Failed to send reset email. Please try again.";
            if (error.code === 'auth/user-not-found') {
                errorMessage = "No account found with this email address.";
            }
            toast({ title: "Request Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    
    const toTitleCase = (str: string) => str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

    const renderContent = () => {
        if (mode === 'forgotPassword') {
            return (
                <form onSubmit={handleSubmit(handlePasswordReset)}>
                     <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" placeholder="Enter your email" {...register("email")} />
                             {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            Send Reset Link
                        </Button>
                        <Button variant="link" size="sm" onClick={() => setMode('login')}>Back to Login</Button>
                    </CardFooter>
                </form>
            );
        }

        return (
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" placeholder="m@example.com" {...register("email")} />
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" {...register("password")} />
                        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                    </div>
                    {mode === 'login' && (
                        <div className="text-right">
                             <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setMode('forgotPassword')}>
                                Forgot Password?
                            </Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (mode === 'login' ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                        {mode === 'login' ? 'Sign In' : 'Sign Up'}
                    </Button>
                     <div className="relative w-full">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleGoogleSignIn} className="w-full" disabled={loading}>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign in with Google
                    </Button>
                     <Button type="button" variant="link" size="sm" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                        {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </Button>
                </CardFooter>
            </form>
        );
    };
    
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                         <Sparkles className="h-8 w-8 text-primary" />
                         <h1 className="text-3xl font-bold">BizSuite DataFlow</h1>
                    </div>
                    <CardTitle>{toTitleCase(mode)}</CardTitle>
                    <CardDescription>
                         {mode === 'login' && 'Sign in to access your business dashboard.'}
                         {mode === 'signup' && 'Create an account to get started.'}
                         {mode === 'forgotPassword' && 'Enter your email to receive a password reset link.'}
                    </CardDescription>
                </CardHeader>
                {renderContent()}
            </Card>
        </div>
    );
}
