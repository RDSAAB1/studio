
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { getFirebaseAuth, getGoogleProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogIn, UserPlus, Sparkles, Database, BarChart, Settings } from 'lucide-react';
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
        <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
          <div className="hidden bg-muted lg:flex flex-col items-center justify-center p-10 text-center">
            <div className="max-w-md">
                <Sparkles className="h-16 w-16 text-primary mx-auto mb-4"/>
                <h1 className="text-4xl font-bold">BizSuite DataFlow</h1>
                <p className="text-muted-foreground mt-4 text-lg">
                    Streamline Your Business Operations.
                </p>
                 <div className="mt-8 space-y-6 text-left">
                    <div className="flex items-start gap-4">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <Database className="h-6 w-6 text-primary"/>
                        </div>
                        <div>
                            <h3 className="font-semibold">Centralized Data</h3>
                            <p className="text-muted-foreground text-sm">Keep all your business data in one secure, accessible place.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                         <div className="bg-primary/10 p-3 rounded-full">
                            <BarChart className="h-6 w-6 text-primary"/>
                        </div>
                        <div>
                            <h3 className="font-semibold">Smart Insights</h3>
                            <p className="text-muted-foreground text-sm">Gain valuable insights with powerful analytics and reporting tools.</p>
                        </div>
                    </div>
                     <div className="flex items-start gap-4">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <Settings className="h-6 w-6 text-primary"/>
                        </div>
                        <div>
                            <h3 className="font-semibold">Seamless Integration</h3>
                            <p className="text-muted-foreground text-sm">Connect effortlessly with the tools and services you already use.</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
          <div className="flex items-center justify-center py-12 px-4">
            <div className="mx-auto grid w-[400px] gap-6">
                <div className="grid gap-2 text-center">
                    <h1 className="text-3xl font-bold">Welcome</h1>
                    <p className="text-balance text-muted-foreground">
                        Enter your credentials to access your account
                    </p>
                </div>
                <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Login</TabsTrigger>
                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                    <TabsContent value="login">
                        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="login-email">Email</Label>
                                <Input id="login-email" placeholder="m@example.com" {...loginForm.register("email")} />
                                {loginForm.formState.errors.email && <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="login-password">Password</Label>
                                    <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">
                                        Forgot your password?
                                    </Link>
                                </div>
                                <Input id="login-password" type="password" {...loginForm.register("password")} />
                                {loginForm.formState.errors.password && <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                                Login
                            </Button>
                            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                                <LogIn className="mr-2 h-4 w-4" /> Login with Google
                            </Button>
                        </form>
                    </TabsContent>
                    <TabsContent value="signup">
                         <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="signup-email">Email</Label>
                                <Input id="signup-email" placeholder="m@example.com" {...signupForm.register("email")} />
                                {signupForm.formState.errors.email && <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signup-password">Password</Label>
                                <Input id="signup-password" type="password" {...signupForm.register("password")} />
                                {signupForm.formState.errors.password && <p className="text-xs text-destructive">{signupForm.formState.errors.password.message}</p>}
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                Sign Up
                            </Button>
                            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                                <LogIn className="mr-2 h-4 w-4" /> Sign up with Google
                            </Button>
                        </form>
                    </TabsContent>
                </Tabs>
            </div>
          </div>
        </div>
    )
}
