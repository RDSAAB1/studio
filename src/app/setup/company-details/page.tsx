
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getRtgsSettings, updateRtgsSettings } from '@/lib/firestore';
import type { RtgsSettings } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth, onAuthStateChanged } from '@/lib/firebase';
import type { User } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Check } from 'lucide-react';

const companySchema = z.object({
  companyName: z.string().min(1, "Company name is required."),
  companyAddress1: z.string().min(1, "Address line 1 is required."),
  companyAddress2: z.string().optional(),
  contactNo: z.string().min(1, "Contact number is required."),
  gmail: z.string().email("Invalid email address."),
  bankName: z.string().min(1, "Bank name is required."),
  ifscCode: z.string().min(1, "IFSC code is required."),
  branchName: z.string().min(1, "Branch name is required."),
  accountNo: z.string().min(1, "Account number is required."),
  type: z.string().min(1, "Account type is required."),
});

type FormValues = z.infer<typeof companySchema>;

export default function CompanyDetailsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(companySchema),
    });

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const settings = await getRtgsSettings();
                if (settings) {
                    form.reset(settings);
                } else {
                    form.setValue('gmail', currentUser.email || '');
                }
            } else {
                router.replace('/login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router, form]);

    const onSubmit = async (data: FormValues) => {
        setSaving(true);
        try {
            await updateRtgsSettings(data);
            toast({ title: "Company details saved!", description: "You're all set up." });
            router.push('/dashboard-overview');
        } catch (error) {
            console.error("Error saving company details:", error);
            toast({ title: "Error", description: "Failed to save details. Please try again.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
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
             <Card className="w-full max-w-2xl">
                <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                         <Sparkles className="h-8 w-8 text-primary" />
                         <h1 className="text-3xl font-bold">BizSuite DataFlow</h1>
                    </div>
                    <CardTitle>Step 2: Set Up Company Details</CardTitle>
                    <CardDescription>
                        This information will be used on all your reports and invoices.
                    </CardDescription>
                </CardHeader>
                 <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <section className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Company Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Company Name</Label>
                                    <Input {...form.register("companyName")} />
                                    {form.formState.errors.companyName && <p className="text-xs text-destructive">{form.formState.errors.companyName.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Contact Number</Label>
                                    <Input {...form.register("contactNo")} />
                                     {form.formState.errors.contactNo && <p className="text-xs text-destructive">{form.formState.errors.contactNo.message}</p>}
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <Label>Email</Label>
                                    <Input {...form.register("gmail")} />
                                     {form.formState.errors.gmail && <p className="text-xs text-destructive">{form.formState.errors.gmail.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Address Line 1</Label>
                                    <Input {...form.register("companyAddress1")} />
                                     {form.formState.errors.companyAddress1 && <p className="text-xs text-destructive">{form.formState.errors.companyAddress1.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Address Line 2</Label>
                                    <Input {...form.register("companyAddress2")} />
                                </div>
                            </div>
                        </section>
                        
                        <section className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">Bank Details (for RTGS)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Bank Name</Label>
                                    <Input {...form.register("bankName")} />
                                    {form.formState.errors.bankName && <p className="text-xs text-destructive">{form.formState.errors.bankName.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Branch Name</Label>
                                    <Input {...form.register("branchName")} />
                                     {form.formState.errors.branchName && <p className="text-xs text-destructive">{form.formState.errors.branchName.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Account Number</Label>
                                    <Input {...form.register("accountNo")} />
                                     {form.formState.errors.accountNo && <p className="text-xs text-destructive">{form.formState.errors.accountNo.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>IFSC Code</Label>
                                    <Input {...form.register("ifscCode")} />
                                     {form.formState.errors.ifscCode && <p className="text-xs text-destructive">{form.formState.errors.ifscCode.message}</p>}
                                </div>
                                 <div className="space-y-1 md:col-span-2">
                                    <Label>Account Type</Label>
                                    <Input {...form.register("type")} placeholder="e.g. SB or CA" />
                                     {form.formState.errors.type && <p className="text-xs text-destructive">{form.formState.errors.type.message}</p>}
                                </div>
                            </div>
                        </section>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                         <Button type="submit" disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4"/>}
                            Finish Setup
                        </Button>
                    </CardFooter>
                 </form>
             </Card>
        </div>
    );
}
