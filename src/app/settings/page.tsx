
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getRtgsSettings, updateRtgsSettings, getCompanySettings, saveCompanySettings, deleteCompanySettings, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings } from '@/lib/firestore';
import type { RtgsSettings, OptionItem, ReceiptSettings, ReceiptFieldSettings } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseAuth, getGoogleProvider } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { toTitleCase } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Building, Mail, Phone, Banknote, ShieldCheck, KeyRound, ExternalLink, AlertCircle, LogOut, Trash2, Settings, List, Plus, Pen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Schemas
const companyDetailsSchema = z.object({
  companyName: z.string().min(1, "Company name is required."),
  companyAddress1: z.string().min(1, "Address line 1 is required."),
  companyAddress2: z.string().optional(),
  contactNo: z.string().min(1, "Contact number is required."),
  gmail: z.string().email("Invalid email address."),
});
type CompanyFormValues = z.infer<typeof companyDetailsSchema>;

const bankDetailsSchema = z.object({
  bankName: z.string().min(1, "Bank name is required."),
  ifscCode: z.string().min(1, "IFSC code is required."),
  branchName: z.string().min(1, "Branch name is required."),
  accountNo: z.string().min(1, "Account number is required."),
  type: z.string().min(1, "Account type is required."),
});
type BankFormValues = z.infer<typeof bankDetailsSchema>;

const emailSchema = z.object({
    email: z.string().email("Please enter a valid email address."),
    appPassword: z.string().min(1, "App Password is required."),
});
type EmailFormValues = z.infer<typeof emailSchema>;

const SettingsCard = ({ title, description, children, footer }: { title: string; description: string; children: React.ReactNode; footer: React.ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter>{footer}</CardFooter>
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
                                        <AlertDialogHeader><AlertDialogTitle>Delete {toTitleCase(option.name)}?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(collectionName, option.id)}>Delete</AlertDialogAction></AlertDialogFooter>
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
    
    // States for settings
    const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
    const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
    const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);

    // Form Hooks
    const companyForm = useForm<CompanyFormValues>();
    const bankForm = useForm<BankFormValues>();
    const emailForm = useForm<EmailFormValues>();
    
    const [isTwoFactorConfirmed, setIsTwoFactorConfirmed] = useState(false);
    const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setLoading(true);

                const companySettings = await getRtgsSettings();
                if(companySettings) {
                    companyForm.reset(companySettings);
                    bankForm.reset(companySettings);
                }
                
                const emailSettings = await getCompanySettings(currentUser.uid);
                if(emailSettings) {
                    emailForm.reset({ email: emailSettings.email || currentUser.email || '', appPassword: emailSettings.appPassword || '' });
                } else {
                    emailForm.reset({ email: currentUser.email || '', appPassword: '' });
                }
                
                const rcpSettings = await getReceiptSettings();
                setReceiptSettings(rcpSettings);

                const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, console.error);
                const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, console.error);
                
                setLoading(false);
                return () => { unsubVarieties(); unsubPaymentTypes(); };
            } else {
                setUser(null);
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const onCompanySubmit = async (data: CompanyFormValues) => {
        setSaving(true);
        try {
            await updateRtgsSettings({ ...bankForm.getValues(), ...data });
            toast({ title: "Company details updated successfully", variant: "success" });
        } catch (e) { toast({ title: "Failed to update details", variant: "destructive" }); } 
        finally { setSaving(false); }
    };
    
    const onBankSubmit = async (data: BankFormValues) => {
        setSaving(true);
        try {
            await updateRtgsSettings({ ...companyForm.getValues(), ...data });
            toast({ title: "Bank details updated successfully", variant: "success" });
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

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <Tabs defaultValue="company">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="company">Company Details</TabsTrigger>
                    <TabsTrigger value="email">Bank & Email</TabsTrigger>
                    <TabsTrigger value="receipts">Receipts</TabsTrigger>
                    <TabsTrigger value="data">Application Data</TabsTrigger>
                </TabsList>
                <TabsContent value="company" className="mt-6">
                    <form onSubmit={companyForm.handleSubmit(onCompanySubmit)}>
                        <SettingsCard title="Company Information" description="This information will be used across the application, including on reports and invoices." footer={<Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Company Details</Button>}>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="space-y-1"><Label>Company Name</Label><Input {...companyForm.register("companyName")} /></div>
                               <div className="space-y-1"><Label>Contact Number</Label><Input {...companyForm.register("contactNo")} /></div>
                               <div className="space-y-1"><Label>Email</Label><Input {...companyForm.register("gmail")} /></div>
                               <div className="space-y-1"><Label>Address Line 1</Label><Input {...companyForm.register("companyAddress1")} /></div>
                               <div className="space-y-1 md:col-span-2"><Label>Address Line 2</Label><Input {...companyForm.register("companyAddress2")} /></div>
                           </div>
                        </SettingsCard>
                    </form>
                </TabsContent>
                 <TabsContent value="email" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)}>
                             <SettingsCard title="Email Configuration" description="Connect your Gmail account to send reports directly from the app." footer={<Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Email Settings</Button>}>
                                <div className="space-y-4">
                                     <div className="space-y-1"><Label>Your Gmail Account</Label><Input value={emailForm.watch('email')} readOnly disabled /></div>
                                     <div className="space-y-1"><Label>Google App Password</Label>
                                        <div className="flex items-center gap-2">
                                            <Input type="password" {...emailForm.register('appPassword')} placeholder="xxxx xxxx xxxx xxxx"/>
                                            <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}><DialogTrigger asChild><Button type="button" variant="outline" size="sm">How?</Button></DialogTrigger>
                                                <DialogContent className="sm:max-w-lg">
                                                     <DialogHeader><DialogTitle>How to Get an App Password</DialogTitle><DialogDescription>An App Password lets our app send emails on your behalf without needing your main password.</DialogDescription></DialogHeader>
                                                      <div className="space-y-4 text-sm">
                                                        <Card><CardHeader className="p-4"><CardTitle className="text-base">Step 1: Enable 2-Step Verification</CardTitle><CardDescription className="text-xs">First, ensure 2-Step Verification is on for your Google Account. It's required by Google to create an App Password.</CardDescription></CardHeader>
                                                          <CardFooter className="p-4 pt-0 flex flex-col items-start gap-3">
                                                             <a href={`https://myaccount.google.com/signinoptions/two-step-verification?authuser=${emailForm.watch('email')}`} target="_blank" rel="noopener noreferrer" className="w-full"><Button size="sm" className="w-full">Go to 2-Step Verification <ExternalLink className="ml-2 h-3 w-3"/></Button></a>
                                                          </CardFooter>
                                                        </Card>
                                                        <Card className="border-primary/50 bg-primary/10">
                                                            <CardHeader className="p-4"><CardTitle className="text-base">Step 2: Most Important!</CardTitle><CardDescription className="text-xs">In the next step, Google will show you a 16-character password. Copy it and paste it into the App Password field on our settings page.</CardDescription></CardHeader>
                                                        </Card>
                                                        <Card>
                                                            <CardHeader className="p-4"><CardTitle className="text-base">Step 3: Create App Password</CardTitle>
                                                                <CardDescription className="text-xs">
                                                                <ul className="list-disc pl-4 space-y-1 mt-2">
                                                                    <li>Go to the App Passwords page using the button below.</li>
                                                                    <li>For the app name, enter "BizSuite DataFlow" and click "Create".</li>
                                                                </ul>
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardFooter className="p-4 pt-0 flex-col items-start gap-3">
                                                                <a href={`https://myaccount.google.com/apppasswords?authuser=${emailForm.watch('email')}`} target="_blank" rel="noopener noreferrer" className="w-full"><Button size="sm" className="w-full">Go to App Passwords <ExternalLink className="ml-2 h-3 w-3"/></Button></a>
                                                                <div className="flex gap-2 p-2 border-l-4 border-primary/80 bg-primary/10 w-full">
                                                                    <AlertCircle className="h-4 w-4 text-primary/80 flex-shrink-0 mt-0.5"/>
                                                                    <p className="text-xs text-primary/90">If you see an error like "The setting you are looking for is not available for your account.", it means 2-Step Verification is not active. Please complete Step 1 first.</p>
                                                                </div>
                                                            </CardFooter>
                                                        </Card>
                                                    </div>
                                                    <DialogFooter className="sm:justify-start">
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
                         <form onSubmit={bankForm.handleSubmit(onBankSubmit)}>
                            <SettingsCard title="Bank Details" description="This information is used for RTGS reports." footer={<Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Bank Details</Button>}>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="space-y-1"><Label>Bank Name</Label><Input {...bankForm.register("bankName")} /></div>
                                   <div className="space-y-1"><Label>Branch Name</Label><Input {...bankForm.register("branchName")} /></div>
                                   <div className="space-y-1"><Label>Account Number</Label><Input {...bankForm.register("accountNo")} /></div>
                                   <div className="space-y-1"><Label>IFSC Code</Label><Input {...bankForm.register("ifscCode")} /></div>
                                   <div className="space-y-1"><Label>Account Type</Label><Input {...bankForm.register("type")} placeholder="e.g. SB or CA" /></div>
                               </div>
                            </SettingsCard>
                         </form>
                    </div>
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
                 <TabsContent value="data" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <OptionsManager type="variety" options={varietyOptions} onAdd={addOption} onUpdate={updateOption} onDelete={deleteOption} />
                        <OptionsManager type="paymentType" options={paymentTypeOptions} onAdd={addOption} onUpdate={updateOption} onDelete={deleteOption} />
                    </div>
                 </TabsContent>
            </Tabs>
        </div>
    );
}
