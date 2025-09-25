
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { getFirebaseAuth, getGoogleProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogIn, UserPlus, Sparkles } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

const signupSchema = z.object({
    email: z.string().email({ message: "Invalid email address." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

export default function AuthPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const loginForm = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const signupForm = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
    });

    const handleGoogleSignIn = async () => {
        const auth = getFirebaseAuth();
        const provider = getGoogleProvider();
        setLoading(true);
        try {
            await signInWithRedirect(auth, provider);
        } catch (error) {
           console.error("Login with redirect failed", error);
           setLoading(false);
           toast({ title: "Login Failed", description: "Could not start the login process.", variant: "destructive" });
        }
    };
    
    const onLoginSubmit = async (data: LoginFormValues) => {
        setLoading(true);
        const auth = getFirebaseAuth();
        try {
            await signInWithEmailAndPassword(auth, data.email, data.password);
            toast({ title: "Login Successful", variant: "success" });
        } catch (error: any) {
            console.error("Login error:", error);
            const errorCode = error.code || '';
            let errorMessage = "An unexpected error occurred.";
            if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
                errorMessage = "Invalid email or password.";
            }
            toast({ title: "Login Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const onSignupSubmit = async (data: SignupFormValues) => {
        setLoading(true);
        const auth = getFirebaseAuth();
        try {
            await createUserWithEmailAndPassword(auth, data.email, data.password);
            toast({ title: "Signup Successful", description: "You will be redirected to setup your company.", variant: "success" });
        } catch (error: any) {
            console.error("Signup error:", error);
            const errorCode = error.code || '';
            let errorMessage = "An unexpected error occurred.";
            if (errorCode === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please log in.";
            }
            toast({ title: "Signup Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background md:bg-muted/40 md:p-4">
            <Card className="w-full max-w-md border-0 md:border md:shadow-lg">
                 <CardHeader className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                         <Sparkles className="h-8 w-8 text-primary" />
                         <h1 className="text-3xl font-bold">BizSuite DataFlow</h1>
                    </div>
                </CardHeader>
                <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Login</TabsTrigger>
                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                    <TabsContent value="login">
                        <CardHeader className="text-center pt-4">
                            <CardTitle>Login</CardTitle>
                            <CardDescription>Access your business dashboard.</CardDescription>
                        </CardHeader>
                        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <Label htmlFor="login-email">Email</Label>
                                    <Input id="login-email" placeholder="m@example.com" {...loginForm.register("email")} />
                                    {loginForm.formState.errors.email && <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="login-password">Password</Label>
                                    <Input id="login-password" type="password" {...loginForm.register("password")} />
                                    {loginForm.formState.errors.password && <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                                </div>
                                <div className="text-right">
                                     <Button type="button" variant="link" size="sm" className="h-auto p-0" asChild>
                                        <Link href="/forgot-password">Forgot Password?</Link>
                                     </Button>
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col gap-4">
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                                    Login
                                </Button>
                                <div className="relative w-full">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                                </div>
                                <Button variant="outline" onClick={handleGoogleSignIn} className="w-full" disabled={loading}>
                                    <LogIn className="mr-2 h-4 w-4" /> Login with Google
                                </Button>
                            </CardFooter>
                        </form>
                    </TabsContent>
                    <TabsContent value="signup">
                         <CardHeader className="text-center pt-4">
                            <CardTitle>Create an Account</CardTitle>
                            <CardDescription>Get started by creating a new account.</CardDescription>
                        </CardHeader>
                         <form onSubmit={signupForm.handleSubmit(onSignupSubmit)}>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <Label htmlFor="signup-email">Email</Label>
                                    <Input id="signup-email" placeholder="m@example.com" {...signupForm.register("email")} />
                                    {signupForm.formState.errors.email && <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="signup-password">Password</Label>
                                    <Input id="signup-password" type="password" {...signupForm.register("password")} />
                                    {signupForm.formState.errors.password && <p className="text-xs text-destructive">{signupForm.formState.errors.password.message}</p>}
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col gap-4">
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                    Sign Up
                                </Button>
                                 <div className="relative w-full">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                                </div>
                                <Button variant="outline" onClick={handleGoogleSignIn} className="w-full" disabled={loading}>
                                    <LogIn className="mr-2 h-4 w-4" /> Sign Up with Google
                                </Button>
                            </CardFooter>
                        </form>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
}
