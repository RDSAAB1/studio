
"use client";

import * as React from "react";
import { useState, useEffect } from 'react';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getRtgsSettings, updateRtgsSettings, getCompanySettings, saveCompanySettings, deleteCompanySettings, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, getBankAccountsRealtime, addBankAccount, updateBankAccount, deleteBankAccount, getFormatSettings, saveFormatSettings, getBanksRealtime, getBankBranchesRealtime } from '@/lib/firestore';
import type { RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings, BankAccount, FormatSettings, Bank, BankBranch } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseAuth, getGoogleProvider } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut, signInWithRedirect } from 'firebase/auth';
import { toTitleCase, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { statesAndCodes, findStateByName, findStateByCode } from "@/lib/data";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Building, Mail, Phone, Banknote, ShieldCheck, KeyRound, ExternalLink, AlertCircle, LogOut, Trash2, Settings, List, Plus, Pen, UserCircle, Landmark, FileText, LogIn, CheckCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { bankNames } from '@/lib/data';


// Schemas
const companySchema = z.object({
  companyName: z.string().min(1, "Company name is required."),
  companyAddress1: z.string().min(1, "Address line 1 is required."),
  companyAddress2: z.string().optional(),
  contactNo: z.string().min(1, "Contact number is required."),
  gmail: z.string().email("Invalid email address."),
  companyGstin: z.string().length(15, "GSTIN must be 15 characters").optional().or(z.literal('')),
  panNo: z.string().optional(),
  companyStateName: z.string().optional(),
  companyStateCode: z.string().optional(),
});
type CompanyFormValues = z.infer<typeof companySchema>;

const emailSchema = z.object({
    email: z.string().email("Please enter a valid email address."),
    appPassword: z.string().min(1, "App Password is required."),
});
type EmailFormValues = z.infer<typeof emailSchema>;

const serialNumberFormats: { key: keyof FormatSettings; label: string }[] = [
    { key: 'income', label: 'Income' },
    { key: 'expense', label: 'Expense' },
    { key: 'loan', label: 'Loan' },
    { key: 'fundTransaction', label: 'Fund Transaction' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'customer', label: 'Customer' },
    { key: 'supplierPayment', label: 'Supplier Payment' },
    { key: 'customerPayment', label: 'Customer Payment' },
];

const SettingsCard = ({ title, description, children, footer }: { title: string; description: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer && <CardFooter className="flex justify-end">{footer}</CardFooter>}
    </Card>
);

const OptionsManager = ({ type, options, onAdd, onUpdate, onDelete }: { type: 'variety' | 'paymentType', options: OptionItem[], onAdd: Function, onUpdate: Function, onDelete: Function }) => {
    const [newItemName, setNewItemName] = useState("");
    const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);

    const collectionName = type === 'variety' ? 'varieties' : 'paymentTypes';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{toTitleCase(type.replace(/([A-Z])/g, ' $1'))}</CardTitle>
                <CardDescription>Manage the options for {type}.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 mb-4">
                    <Input placeholder={`New ${type}...`} value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                    <Button size="sm" onClick={() => { onAdd(collectionName, { name: newItemName }); setNewItemName(''); }}><Plus className="mr-2 h-4 w-4"/>Add</Button>
                </div>
                <ScrollArea className="h-64 border rounded-md p-2">
                    {options.map(option => (
                        <div key={option.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                            {editingItem?.id === option.id ? (
                                <Input value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} onBlur={() => { onUpdate(collectionName, editingItem.id, editingItem); setEditingItem(null); }} autoFocus className="h-8"/>
                            ) : (
                                <span className="text-sm">{toTitleCase(option.name)}</span>
                            )}
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem({ id: option.id, name: option.name })}><Pen className="h-4 w-4" /></Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Delete "{toTitleCase(option.name)}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(collectionName, option.id, option.name)}>Delete</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))}
                </ScrollArea>
            </CardContent>
        </Card>
    )
};


export default function SettingsPage() {
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();
    
    // States for settings
    const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
    const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
    const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [isBankAccountDialogOpen, setIsBankAccountDialogOpen] = useState(false);
    const [currentBankAccount, setCurrentBankAccount] = useState<Partial<BankAccount>>({});
    const [formatSettings, setFormatSettings] = useState<FormatSettings>({});
    const [banks, setBanks] = useState<Bank[]>([]);
    const [bankBranches, setBankBranches] = useState<BankBranch[]>([]);

    // Form Hooks
    const companyForm = useForm<CompanyFormValues>({
        resolver: zodResolver(companySchema),
    });
    const emailForm = useForm<EmailFormValues>();
    
    const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
    
    const gstinValue = companyForm.watch("companyGstin");

    useEffect(() => {
        if (gstinValue && gstinValue.length === 15) {
            const pan = gstinValue.substring(2, 12);
            companyForm.setValue("panNo", pan);
            const stateCode = gstinValue.substring(0, 2);
            const state = findStateByCode(stateCode);
            if(state) {
                companyForm.setValue("companyStateCode", state.code);
                companyForm.setValue("companyStateName", state.name);
            }
        }
    }, [gstinValue, companyForm]);

    const handleStateNameChange = (value: string | null) => {
        companyForm.setValue('companyStateName', value || '');
        const state = findStateByName(value || '');
        if (state) {
            companyForm.setValue('companyStateCode', state.code);
        }
    };

    const handleStateCodeChange = (value: string | null) => {
        companyForm.setValue('companyStateCode', value || '');
        const state = findStateByCode(value || '');
        if (state) {
            companyForm.setValue('companyStateName', state.name);
        }
    };


    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setLoading(true);

                const companySettings = await getRtgsSettings();
                if(companySettings) {
                    companyForm.reset(companySettings);
                }
                
                const emailSettings = await getCompanySettings(currentUser.uid);
                if(emailSettings) {
                    emailForm.reset({ email: emailSettings.email || currentUser.email || '', appPassword: emailSettings.appPassword || '' });
                } else {
                    emailForm.reset({ email: currentUser.email || '', appPassword: '' });
                }
                
                const rcpSettings = await getReceiptSettings();
                setReceiptSettings(rcpSettings);
                
                const fmtSettings = await getFormatSettings();
                setFormatSettings(fmtSettings);

                const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, console.error);
                const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, console.error);
                const unsubBankAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
                const unsubBanks = getBanksRealtime(setBanks, console.error);
                const unsubBankBranches = getBankBranchesRealtime(setBankBranches, console.error);
                
                setLoading(false);
                return () => { 
                    unsubVarieties(); 
                    unsubPaymentTypes(); 
                    unsubBankAccounts();
                    unsubBanks();
                    unsubBankBranches();
                };
            } else {
                setUser(null);
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, [router, companyForm, emailForm]);
    
    const handleCapitalizeOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, selectionStart, selectionEnd } = e.target;
        const capitalizedValue = toTitleCase(value);
        companyForm.setValue(name as keyof CompanyFormValues, capitalizedValue, { shouldValidate: true });
        
        requestAnimationFrame(() => {
             e.target.setSelectionRange(selectionStart, selectionEnd);
        });
    }

    const onCompanySubmit = async (data: CompanyFormValues) => {
        setSaving(true);
        try {
            await updateRtgsSettings({ ...data });
            toast({ title: "Company details updated successfully", variant: "success" });
        } catch (e) { toast({ title: "Failed to update details", variant: "destructive" }); } 
        finally { setSaving(false); }
    };

    const onEmailSubmit = async (data: EmailFormValues) => {
        if (!user) return;
        setSaving(true);
        try {
            await saveCompanySettings(user.uid, { email: data.email, appPassword: data.appPassword.replace(/\s/g, '') });
            toast({ title: "Email settings connected successfully", variant: "success" });
        } catch(e) { toast({ title: "Failed to connect email", variant: "destructive" }); }
        finally { setSaving(false); }
    };
    
    const handleEmailDisconnect = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await deleteCompanySettings(user.uid);
            emailForm.reset({ email: user.email || '', appPassword: '' });
            toast({ title: "Email disconnected successfully", variant: "success" });
        } catch (e) { toast({ title: "Failed to disconnect email", variant: "destructive" }); }
        finally { setSaving(false); }
    };

    const handleReceiptFieldsSave = async () => {
        if(receiptSettings) {
            setSaving(true);
            try {
                await updateReceiptSettings(receiptSettings);
                toast({ title: "Receipt settings saved", variant: "success" });
            } catch(e) { toast({ title: "Failed to save receipt settings", variant: "destructive" }); }
            finally { setSaving(false); }
        }
    }
    
    const handleFieldVisibilityChange = (field: keyof ReceiptFieldSettings, checked: boolean) => {
        if(receiptSettings) {
            setReceiptSettings({ ...receiptSettings, fields: { ...receiptSettings.fields, [field]: checked }});
        }
    }

    const handleSignOut = async () => {
        try {
            await signOut(getFirebaseAuth());
            setUser(null); // Update local state
            router.push('/login');
        } catch (error) {
            console.error("Error signing out: ", error);
            toast({ title: "Failed to sign out", variant: "destructive" });
        }
    };
    
    const handleSignIn = async () => {
        setLoading(true);
        try {
            const auth = getFirebaseAuth();
            const provider = getGoogleProvider();
            await signInWithRedirect(auth, provider);
        } catch (error) {
            console.error("Sign-in error", error);
            toast({ title: "Sign-in failed", variant: "destructive" });
            setLoading(false);
        }
    };
    
    const handleSetDefaultBankAccount = async (accountId: string) => {
        await updateRtgsSettings({ defaultBankAccountId: accountId });
        setReceiptSettings(prev => prev ? { ...prev, defaultBankAccountId: accountId } : null);
        toast({ title: 'Default bank account updated.', variant: 'success' });
    };

    const handleBankAccountSave = async () => {
        if (!currentBankAccount || !currentBankAccount.bankName || !currentBankAccount.accountNumber || !currentBankAccount.accountHolderName) {
            toast({ title: "Please fill all required bank account fields", variant: "destructive" });
            return;
        }

        try {
            const dataToSave: Partial<BankAccount> = {
                ...currentBankAccount,
                accountHolderName: toTitleCase(currentBankAccount.accountHolderName),
                bankName: currentBankAccount.bankName,
                branchName: currentBankAccount.branchName,
                ifscCode: currentBankAccount.ifscCode?.toUpperCase(),
            };

            if (currentBankAccount.id) {
                await updateBankAccount(currentBankAccount.id, dataToSave);
                toast({ title: "Bank account updated", variant: "success" });
            } else if (currentBankAccount.accountNumber) {
                await addBankAccount(dataToSave);
                toast({ title: "Bank account added", variant: "success" });
            }
            setIsBankAccountDialogOpen(false);
            setCurrentBankAccount({});
        } catch (error) {
            console.error("Error saving bank account:", error);
            toast({ title: "Failed to save bank account", variant: "destructive" });
        }
    };

    const handleBankAccountDelete = async (id: string) => {
        await deleteBankAccount(id);
        toast({ title: "Bank account deleted", variant: "success" });
    }

    const handleFormatChange = (key: string, field: 'prefix' | 'padding', value: string | number) => {
        setFormatSettings(prev => ({
            ...prev,
            [key]: {
                ...(prev[key as keyof FormatSettings] || { prefix: '', padding: 0 }),
                [field]: field === 'padding' ? Number(value) : value
            }
        }));
    };

    const handleSaveFormats = async () => {
        setSaving(true);
        try {
            await saveFormatSettings(formatSettings);
            toast({ title: "Serial number formats saved successfully", variant: "success" });
        } catch (e) {
            toast({ title: "Failed to save formats", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };
    
    const handleBankAccountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'ifscCode') {
            setCurrentBankAccount(prev => ({...prev, [name]: value.toUpperCase()}));
        } else {
            setCurrentBankAccount(prev => ({...prev, [name]: toTitleCase(value)}));
        }
    }
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            const form = e.currentTarget;
            const formElements = Array.from(form.elements).filter(el => (el as HTMLElement).offsetParent !== null) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];
            const currentElementIndex = formElements.findIndex(el => el === document.activeElement);

            if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {
                e.preventDefault();
                formElements[currentElementIndex + 1].focus();
            } else if (currentElementIndex === formElements.length - 1) {
                 e.preventDefault();
                 (form.querySelector('[type=submit]') as HTMLButtonElement)?.click();
            }
        }
    };
    
    const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            const form = e.currentTarget.querySelector('form');
            if (!form) return;

            const formElements = Array.from(form.elements).filter(el => (el as HTMLElement).offsetParent !== null) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];
            const currentElementIndex = formElements.findIndex(el => el === document.activeElement);

            if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {
                e.preventDefault();
                formElements[currentElementIndex + 1].focus();
            } else if (currentElementIndex === formElements.length - 1) {
                 e.preventDefault();
                 handleBankAccountSave();
            }
        }
    };
    
    const allBankOptions = useMemo(() => {
        const combinedNames = [...bankNames, ...banks.map((b) => b.name)];
        const uniqueNames = Array.from(new Set(combinedNames));
        return uniqueNames.sort().map(name => ({ value: name, label: toTitleCase(name) }));
    }, [banks]);

    const availableBranchOptions = useMemo(() => {
        if (!currentBankAccount.bankName) return [];
        return bankBranches
            .filter(branch => branch.bankName === currentBankAccount.bankName)
            .map(branch => ({ value: branch.branchName, label: branch.branchName }));
    }, [currentBankAccount.bankName, bankBranches]);

    const handleBankSelect = (bankName: string | null) => {
        setCurrentBankAccount(prev => ({
            ...prev,
            bankName: bankName || '',
            branchName: '',
            ifscCode: ''
        }));
    };

    const handleBranchSelect = (branchName: string | null) => {
        const selectedBranch = bankBranches.find(b => b.bankName === currentBankAccount.bankName && b.branchName === branchName);
        setCurrentBankAccount(prev => ({
            ...prev,
            branchName: branchName || '',
            ifscCode: selectedBranch?.ifscCode || ''
        }));
    };
    
    const stateNameOptions = statesAndCodes.map(s => ({ value: s.name, label: s.name }));
    const stateCodeOptions = statesAndCodes.map(s => ({ value: s.code, label: s.code }));


    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <Tabs defaultValue="company" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="banks">Bank Accounts</TabsTrigger>
                    <TabsTrigger value="receipts">Receipts</TabsTrigger>
                    <TabsTrigger value="formats">Formats & Data</TabsTrigger>
                    <TabsTrigger value="account">Account</TabsTrigger>
                </TabsList>
                <TabsContent value="company" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} onKeyDown={handleKeyDown}>
                            <SettingsCard title="Company Information" description="This information will be used across the application, including on reports and invoices." footer={<Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Company Details</Button>}>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                   <div className="space-y-1"><Label>Company Name</Label><Input {...companyForm.register("companyName")} onChange={handleCapitalizeOnChange} /></div>
                                   <div className="space-y-1"><Label>Contact Number</Label><Input {...companyForm.register("contactNo")} /></div>
                                   <div className="space-y-1"><Label>Email</Label><Input {...companyForm.register("gmail")} /></div>
                                   <div className="space-y-1"><Label>Address Line 1</Label><Input {...companyForm.register("companyAddress1")} onChange={handleCapitalizeOnChange} /></div>
                                   <div className="space-y-1 sm:col-span-2"><Label>Address Line 2</Label><Input {...companyForm.register("companyAddress2")} onChange={handleCapitalizeOnChange}/></div>
                                   <div className="space-y-1">
                                        <Label htmlFor="companyGstin">GSTIN</Label>
                                        <Input {...companyForm.register("companyGstin")} className="uppercase" />
                                        {companyForm.formState.errors.companyGstin && <p className="text-xs text-destructive">{companyForm.formState.errors.companyGstin.message}</p>}
                                   </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="panNo">PAN</Label>
                                        <Input {...companyForm.register("panNo")} readOnly disabled className="bg-muted"/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>State Name</Label>
                                        <CustomDropdown options={stateNameOptions} value={companyForm.watch('companyStateName')} onChange={handleStateNameChange} placeholder="Select State"/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>State Code</Label>
                                        <CustomDropdown options={stateCodeOptions} value={companyForm.watch('companyStateCode')} onChange={handleStateCodeChange} placeholder="Select Code"/>
                                    </div>
                               </div>
                            </SettingsCard>
                        </form>
                         <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} onKeyDown={handleKeyDown}>
                             <SettingsCard title="Email Configuration" description="Connect your Gmail account to send reports directly from the app. This requires an App Password from Google." footer={<Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Email Settings</Button>}>
                                <div className="space-y-4">
                                     <div className="space-y-1"><Label>Your Gmail Account</Label><Input value={emailForm.watch('email')} readOnly disabled /></div>
                                     <div className="space-y-1"><Label>Google App Password</Label>
                                        <div className="flex items-center gap-2">
                                            <Input type="password" {...emailForm.register('appPassword')} placeholder="xxxx xxxx xxxx xxxx" />
                                            <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}><DialogTrigger asChild><Button type="button" variant="outline" size="sm">How?</Button></DialogTrigger>
                                                <DialogContent className="sm:max-w-lg">
                                                     <DialogHeader><DialogTitle>How to Get an App Password</DialogTitle><DialogDescription>An App Password lets our app send emails on your behalf without needing your main password.</DialogDescription></DialogHeader>
                                                     <ScrollArea className="max-h-[60vh] pr-4">
                                                        <div className="space-y-4 text-sm">
                                                                <div className="flex gap-2 p-2 border-l-4 border-primary/80 bg-primary/10 w-full">
                                                                    <AlertCircle className="h-4 w-4 text-primary/80 flex-shrink-0 mt-0.5"/>
                                                                    <p className="text-xs text-primary/90">To create an App Password, you first need to enable 2-Step Verification on your Google Account.</p>
                                                                </div>
                                                                <Card>
                                                                    <CardHeader className="p-4"><CardTitle className="text-base">Step 1: Enable 2-Step Verification</CardTitle><CardDescription className="text-xs">This adds an extra layer of security to your account.</CardDescription></CardHeader>
                                                                    <CardFooter className="p-4 pt-0 flex flex-col items-start gap-3">
                                                                        <a href={`https://myaccount.google.com/signinoptions/two-step-verification?authuser=${emailForm.watch('email')}`} target="_blank" rel="noopener noreferrer" className="w-full"><Button size="sm" className="w-full">Go to 2-Step Verification <ExternalLink className="ml-2 h-3 w-3"/></Button></a>
                                                                    </CardFooter>
                                                                </Card>
                                                                
                                                                <Card>
                                                                    <CardHeader className="p-4"><CardTitle className="text-base">Step 2: Create & Copy Password</CardTitle></CardHeader>
                                                                    <CardContent className="p-4 pt-0 space-y-2 text-xs">
                                                                        <p className="font-bold">Follow these steps carefully on the Google page:</p>
                                                                        <ul className="list-decimal pl-5 space-y-1">
                                                                            <li>Under "Select app", choose <strong>"Other (Custom name)"</strong>.</li>
                                                                            <li>Enter a name like <strong>"BizSuite DataFlow"</strong> and click "CREATE".</li>
                                                                            <li>Google will show you a 16-character password. <strong>Copy this password.</strong></li>
                                                                        </ul>
                                                                    </CardContent>
                                                                    <CardFooter className="p-4 pt-0">
                                                                        <a href={`https://myaccount.google.com/apppasswords?authuser=${emailForm.watch('email')}`} target="_blank" rel="noopener noreferrer" className="w-full">
                                                                            <Button size="sm" className="w-full">Go to App Passwords <ExternalLink className="ml-2 h-3 w-3"/></Button>
                                                                        </a>
                                                                    </CardFooter>
                                                                </Card>
                                                            </div>
                                                     </ScrollArea>
                                                        <DialogFooter className="sm:justify-start mt-4">
                                                          <Button variant="outline" onClick={() => setIsHelpDialogOpen(false)}>Close</Button>
                                                        </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                     </div>
                                     <AlertDialog>
                                         <AlertDialogTrigger asChild><Button variant="destructive" type="button" disabled={saving || !emailForm.watch('appPassword')}><Trash2 className="mr-2 h-4 w-4"/>Disconnect</Button></AlertDialogTrigger>
                                         <AlertDialogContent>
                                             <AlertDialogHeader><AlertDialogTitle>Disconnect Email?</AlertDialogTitle><AlertDialogDescription>This will remove your saved App Password. You will need to reconnect to send emails.</AlertDialogDescription></AlertDialogHeader>
                                             <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleEmailDisconnect}>Disconnect</AlertDialogAction></AlertDialogFooter>
                                         </AlertDialogContent>
                                     </AlertDialog>
                                </div>
                             </SettingsCard>
                        </form>
                    </div>
                </TabsContent>
                <TabsContent value="banks" className="mt-6">
                     <SettingsCard title="Bank Accounts" description="Manage all your company bank accounts here." footer={
                        <Button size="sm" onClick={() => { setCurrentBankAccount({}); setIsBankAccountDialogOpen(true); }}>
                            <Plus className="mr-2 h-4 w-4"/> Add Bank Account
                        </Button>
                     }>
                        <ScrollArea className="h-80 border rounded-md">
                            {bankAccounts.map(account => {
                                const isDefault = receiptSettings?.defaultBankAccountId === account.id;
                                return (
                                <div key={account.id} className={cn("flex items-center justify-between p-3 border-b", isDefault && "bg-primary/10")}>
                                    <div>
                                        <p className="font-semibold flex items-center gap-2">
                                            {account.accountHolderName}
                                            {isDefault && <span className="text-xs font-normal text-primary/80 flex items-center gap-1">(<CheckCheck className="h-3 w-3"/>Default)</span>}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{account.bankName} - ...{account.accountNumber.slice(-4)}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        {!isDefault && <Button variant="outline" size="sm" className="h-7" onClick={() => handleSetDefaultBankAccount(account.id)}>Set as Default</Button>}
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCurrentBankAccount(account); setIsBankAccountDialogOpen(true); }}><Pen className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Delete "{account.accountHolderName}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleBankAccountDelete(account.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                                )
                            })}
                        </ScrollArea>
                    </SettingsCard>
                </TabsContent>
                <TabsContent value="receipts" className="mt-6">
                     <SettingsCard title="Receipt Fields" description="Choose which fields to display on printed receipts." footer={<Button onClick={handleReceiptFieldsSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Receipt Settings</Button>}>
                        {receiptSettings && (
                           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                               {Object.keys(receiptSettings.fields).map((key) => (
                                   <div key={key} className="flex items-center space-x-2">
                                       <Checkbox
                                           id={`field-${key}`}
                                           checked={receiptSettings.fields[key as keyof ReceiptFieldSettings]}
                                           onCheckedChange={(checked) => handleFieldVisibilityChange(key as keyof ReceiptFieldSettings, !!checked)}
                                       />
                                       <Label htmlFor={`field-${key}`} className="text-sm font-normal">{toTitleCase(key.replace(/([A-Z])/g, ' $1'))}</Label>
                                   </div>
                               ))}
                           </div>
                        )}
                    </SettingsCard>
                </TabsContent>
                 <TabsContent value="formats" className="mt-6">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SettingsCard 
                            title="Serial Number Formats" 
                            description="Define the prefix and padding for readable IDs across the app."
                            footer={<Button onClick={handleSaveFormats} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Formats</Button>}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                {serialNumberFormats.map(({ key, label }) => (
                                    <div key={key} className="p-3 border rounded-lg">
                                        <h4 className="font-medium text-sm mb-2">{label}</h4>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-xs">Prefix</Label>
                                                <Input 
                                                    value={formatSettings[key as keyof FormatSettings]?.prefix || ''}
                                                    onChange={e => handleFormatChange(key, 'prefix', e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="w-24 space-y-1">
                                                <Label className="text-xs">Padding</Label>
                                                <Input 
                                                    type="number"
                                                    value={formatSettings[key as keyof FormatSettings]?.padding || 0}
                                                    onChange={e => handleFormatChange(key, 'padding', e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SettingsCard>
                        <div className="grid grid-cols-1 gap-6">
                            <OptionsManager type="variety" options={varietyOptions} onAdd={addOption} onUpdate={updateOption} onDelete={deleteOption} />
                            <OptionsManager type="paymentType" options={paymentTypeOptions} onAdd={addOption} onUpdate={updateOption} onDelete={deleteOption} />
                        </div>
                     </div>
                 </TabsContent>
                 <TabsContent value="account" className="mt-6">
                    <SettingsCard title="Account Information" description="Manage your account details and sign out.">
                        {user ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                                    <UserCircle className="h-10 w-10 text-muted-foreground" />
                                    <div>
                                        <p className="font-semibold">{user.displayName || "No name provided"}</p>
                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={handleSignOut}>
                                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                                </Button>
                            </div>
                        ) : (
                             <div className="flex flex-col items-start gap-4">
                                <p className="text-muted-foreground">You are not signed in.</p>
                                <Button onClick={handleSignIn} disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                                    Sign in with Google
                                </Button>
                            </div>
                        )}
                    </SettingsCard>
                </TabsContent>
            </Tabs>

            <Dialog open={isBankAccountDialogOpen} onOpenChange={setIsBankAccountDialogOpen}>
                <DialogContent className="sm:max-w-md" onKeyDown={handleDialogKeyDown}>
                    <DialogHeader>
                        <DialogTitle>{currentBankAccount.id ? 'Edit' : 'Add'} Bank Account</DialogTitle>
                    </DialogHeader>
                    <form>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1">
                                <Label htmlFor="accountHolderName">Account Holder Name</Label>
                                <Input id="accountHolderName" name="accountHolderName" value={currentBankAccount.accountHolderName || ''} onChange={handleBankAccountInputChange} />
                            </div>
                            <div className="space-y-1">
                                <Label>Bank</Label>
                                <CustomDropdown options={allBankOptions} value={currentBankAccount.bankName || null} onChange={handleBankSelect} placeholder="Select a bank"/>
                            </div>
                            <div className="space-y-1">
                                <Label>Branch</Label>
                                <CustomDropdown options={availableBranchOptions} value={currentBankAccount.branchName || null} onChange={handleBranchSelect} placeholder="Select a branch" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="ifscCode">IFSC Code</Label>
                                <Input id="ifscCode" name="ifscCode" value={currentBankAccount.ifscCode || ''} onChange={e => setCurrentBankAccount(prev => ({...prev, ifscCode: e.target.value.toUpperCase()}))} className="uppercase" />
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="accountNumber">Account Number</Label>
                                <Input id="accountNumber" name="accountNumber" value={currentBankAccount.accountNumber || ''} onChange={e => setCurrentBankAccount(prev => ({...prev, accountNumber: e.target.value}))}/>
                            </div>
                            <div className="space-y-1">
                                <Label>Account Type</Label>
                                <CustomDropdown
                                    options={[
                                        { value: 'Savings', label: 'Savings' },
                                        { value: 'Current', label: 'Current' },
                                        { value: 'Loan', label: 'Loan Account' },
                                        { value: 'Limit', label: 'Limit Account' },
                                        { value: 'Other', label: 'Other' },
                                    ]}
                                    value={currentBankAccount.accountType || null}
                                    onChange={(value) => setCurrentBankAccount(prev => ({ ...prev, accountType: value as BankAccount['accountType'] }))}
                                    placeholder="Select account type"
                                />
                            </div>
                        </div>
                    </form>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBankAccountDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleBankAccountSave}>Save Account</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
