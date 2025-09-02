
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getRtgsSettings, updateRtgsSettings } from '@/lib/firestore';
import type { RtgsSettings } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Building, Mail, Phone, Banknote, ShieldCheck } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const companyDetailsSchema = z.object({
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

type FormValues = z.infer<typeof companyDetailsSchema>;

export default function CompanyDetailsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(companyDetailsSchema),
        defaultValues: {
            companyName: "",
            companyAddress1: "",
            companyAddress2: "",
            contactNo: "",
            gmail: "",
            bankName: "",
            ifscCode: "",
            branchName: "",
            accountNo: "",
            type: "SB",
        },
    });

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            const settings = await getRtgsSettings();
            if (settings) {
                form.reset(settings);
            }
            setLoading(false);
        };
        fetchSettings();
    }, [form]);

    const onSubmit = async (data: FormValues) => {
        setSaving(true);
        try {
            await updateRtgsSettings(data);
            toast({
                title: "Success!",
                description: "Your company details have been saved.",
                variant: "success",
            });
            router.push('/sales/dashboard-overview'); // Redirect to dashboard after saving
        } catch (error) {
            console.error("Error saving company details:", error);
            toast({
                title: "Failed to Save",
                description: "Could not save your company details. Please try again.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };
    
    const InputField = ({ name, label, placeholder, icon: Icon }: { name: keyof FormValues, label: string, placeholder?: string, icon?: React.ElementType }) => (
        <div className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            <div className="relative">
                {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                <Input id={name} {...form.register(name)} placeholder={placeholder} className={Icon ? "pl-10" : ""} />
            </div>
            {form.formState.errors[name] && <p className="text-xs text-destructive">{form.formState.errors[name]?.message}</p>}
        </div>
    );

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-3xl">
                 <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle>Step 2: Company & Bank Details</CardTitle>
                        <CardDescription>
                            This information will be used in RTGS reports and other documents. Please fill it out carefully.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4 p-4 border rounded-lg">
                             <h3 className="text-lg font-semibold flex items-center gap-2"><Building className="h-5 w-5 text-primary"/> Company Information</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField name="companyName" label="Company Name" placeholder="e.g., Your Company Name" />
                                <InputField name="contactNo" label="Contact Number" placeholder="e.g., 9876543210" icon={Phone}/>
                                <InputField name="gmail" label="Business Email" placeholder="e.g., contact@yourcompany.com" icon={Mail}/>
                                <InputField name="companyAddress1" label="Address Line 1" placeholder="e.g., 123 Business St" />
                                <InputField name="companyAddress2" label="Address Line 2" placeholder="e.g., City, State, PIN" />
                             </div>
                        </div>
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><Banknote className="h-5 w-5 text-primary"/> Bank Account Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField name="bankName" label="Bank Name" placeholder="e.g., State Bank of India"/>
                                <InputField name="branchName" label="Branch Name" placeholder="e.g., Main Branch" />
                                <InputField name="accountNo" label="Account Number" placeholder="e.g., 12345678901"/>
                                <InputField name="ifscCode" label="IFSC Code" placeholder="e.g., SBIN0001234"/>
                                <InputField name="type" label="Account Type" placeholder="e.g., Savings/Current (SB/CA)"/>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button type="submit" disabled={saving} className="w-full">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save & Proceed to Dashboard
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
