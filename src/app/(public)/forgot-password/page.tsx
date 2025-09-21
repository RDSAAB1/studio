
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { getFirebaseAuth, sendPasswordResetEmail } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Sparkles } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from 'next/navigation';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormValues>({
        resolver: zodResolver(forgotPasswordSchema),
    });

    const onSubmit = async (data: ForgotPasswordFormValues) => {
        setLoading(true);
        const auth = getFirebaseAuth();
        try {
            await sendPasswordResetEmail(auth, data.email);
            toast({ title: "Password Reset Email Sent", description: "Please check your inbox to reset your password.", variant: "success" });
            router.push('/login');
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
    
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                         <Sparkles className="h-8 w-8 text-primary" />
                         <h1 className="text-3xl font-bold">BizSuite DataFlow</h1>
                    </div>
                    <CardTitle>Forgot Password</CardTitle>
                    <CardDescription>
                         Enter your email to receive a password reset link.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
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
                        <Button variant="link" size="sm" asChild>
                           <Link href="/login">Back to Login</Link>
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
