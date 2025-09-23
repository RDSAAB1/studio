
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { getFirebaseAuth, getGoogleProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, UserPlus, Sparkles } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [isLogin, setIsLogin] = useState(true);

    const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
    });

    const handleGoogleSignIn = async () => {
        const auth = getFirebaseAuth();
        const provider = getGoogleProvider();
        setLoading(true);
        try {
            await signInWithRedirect(auth, provider);
        } catch (error) {
           console.error("Sign-in with redirect failed", error);
           setLoading(false);
           toast({ title: "Sign-in Failed", description: "Could not start the sign-in process.", variant: "destructive" });
        }
    };
    
    const onSubmit = async (data: FormValues) => {
        setLoading(true);
        const auth = getFirebaseAuth();
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, data.email, data.password);
                toast({ title: "Login Successful", variant: "success" });
            } else {
                await createUserWithEmailAndPassword(auth, data.email, data.password);
                toast({ title: "Signup Successful", description: "You are now logged in.", variant: "success" });
            }
        } catch (error: any) {
            console.error(`${isLogin ? 'Login' : 'Signup'} error:`, error);
            const errorCode = error.code || '';
            let errorMessage = "An unexpected error occurred.";
            if (isLogin) {
                if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
                    errorMessage = "Invalid email or password.";
                }
            } else {
                if (errorCode === 'auth/email-already-in-use') {
                    errorMessage = "This email is already registered. Please log in.";
                }
            }
            toast({ title: `${isLogin ? 'Login' : 'Signup'} Failed`, description: errorMessage, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const toggleForm = () => {
        setIsLogin(!isLogin);
        reset();
    }
    
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                         <Sparkles className="h-8 w-8 text-primary" />
                         <h1 className="text-3xl font-bold">BizSuite DataFlow</h1>
                    </div>
                    <CardTitle>{isLogin ? 'Sign In' : 'Create an Account'}</CardTitle>
                    <CardDescription>
                         {isLogin ? 'Sign in to access your business dashboard.' : 'Get started by creating a new account.'}
                    </CardDescription>
                </CardHeader>
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
                        {isLogin && (
                            <div className="text-right">
                                 <Button type="button" variant="link" size="sm" className="h-auto p-0" asChild>
                                    <Link href="/forgot-password">Forgot Password?</Link>
                                 </Button>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isLogin ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                            {isLogin ? 'Sign In' : 'Sign Up'}
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
                            {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
                        </Button>
                         <Button type="button" variant="link" size="sm" onClick={toggleForm}>
                            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
