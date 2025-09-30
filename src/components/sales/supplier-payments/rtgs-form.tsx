
"use client";

import React from 'react';
import { cn, formatCurrency, toTitleCase } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Settings, Pen, User, Landmark, Banknote, Package, Info, ArrowRight, ClipboardList } from "lucide-react";
import { format } from 'date-fns';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { Separator } from '@/components/ui/separator';
import { PaymentCombinationGenerator } from './payment-combination-generator';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { addBank, addBankBranch } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const SectionTitle = ({ title, onEdit, editingPayment, icon, description }: { title: string, onEdit?: () => void, editingPayment?: boolean, icon?: React.ReactNode, description?: string }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
             {icon}
            <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        </div>
        {onEdit && !editingPayment && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pen className="h-4 w-4"/></Button>}
    </div>
);

export const RtgsForm = (props: any) => {
    const { toast } = useToast();
    const {
        rtgsFor, supplierDetails, setSupplierDetails,
        isPayeeEditing, setIsPayeeEditing,
        bankDetails, setBankDetails,
        rtgsSrNo, setRtgsSrNo, handleRtgsSrNoBlur,
        sixRNo, setSixRNo, sixRDate, setSixRDate,
        utrNo, setUtrNo, parchiNo, setParchiNo, checkNo, setCheckNo,
        rtgsQuantity, setRtgsQuantity, rtgsRate, setRtgsRate, rtgsAmount, setRtgsAmount,
        editingPayment, setIsBankSettingsOpen,
        calcTargetAmount, setCalcTargetAmount,
        selectPaymentAmount,
        handleEditPayment, // Receive the edit handler
    } = props;
    
    const { banks, bankBranches } = useSupplierData();
    
    const bankOptions = React.useMemo(() => {
        if (!Array.isArray(banks)) return [];
        return banks.map((bank: any) => ({
            value: bank.name,
            label: toTitleCase(bank.name)
        }));
    }, [banks]);

    const availableBranchOptions = React.useMemo(() => {
        if (!bankDetails.bank || !Array.isArray(bankBranches)) return [];
        const uniqueBranches = new Map<string, { value: string; label: string }>();
        bankBranches
            .filter((branch: any) => branch.bankName === bankDetails.bank)
            .forEach((branch: any) => {
                if (!uniqueBranches.has(branch.branchName)) {
                    uniqueBranches.set(branch.branchName, { value: branch.branchName, label: toTitleCase(branch.branchName) });
                }
            });
        return Array.from(uniqueBranches.values());
    }, [bankDetails.bank, bankBranches]);

    const handleBankSelect = (bankName: string | null) => {
        setBankDetails({
            ...bankDetails,
            bank: bankName || '',
            branch: '',
            ifscCode: ''
        });
    };

    const handleBranchSelect = (branchName: string | null) => {
        const selectedBranch = bankBranches.find((b: any) => b.bankName === bankDetails.bank && b.branchName === branchName);
        setBankDetails((prev: any) => ({
            ...prev,
            branch: branchName || '',
            ifscCode: selectedBranch ? selectedBranch.ifscCode : prev.ifscCode
        }));
    };
    
    const handleIfscBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const ifsc = e.target.value.toUpperCase();
        setBankDetails((prev: any) => ({...prev, ifscCode: ifsc}));
        const matchingBranch = bankBranches.find((b: any) => b.ifscCode === ifsc);
        if (matchingBranch) {
            setBankDetails((prev: any) => ({
                ...prev,
                bank: matchingBranch.bankName,
                branch: matchingBranch.branchName,
            }));
        }
    };
    
    const handleAddBranch = async (newBranchName: string) => {
        if (!bankDetails.bank) {
            toast({ title: "Please select a bank first.", variant: 'destructive' });
            return;
        }
        handleBranchSelect(newBranchName);
    };

    const formatSixRNo = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        if (value && !isNaN(parseInt(value))) {
            setSixRNo(String(parseInt(value)).padStart(5, '0'));
        }
    };
    
    const formatCheckNo = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        if (value && !isNaN(parseInt(value))) {
            setCheckNo(String(parseInt(value)).padStart(6, '0'));
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><Banknote size={18}/>RTGS Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1"><Label className="text-xs">RTGS SR No.</Label><Input value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} onBlur={(e) => handleRtgsSrNoBlur(e, handleEditPayment)} className="h-8 text-xs font-mono"/></div>
                            <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" value={rtgsQuantity} onChange={e => setRtgsQuantity(Number(e.target.value))} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">Rate</Label><Input type="number" value={rtgsRate} onChange={e => setRtgsRate(Number(e.target.value))} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" value={rtgsAmount} onChange={e => setRtgsAmount(Number(e.target.value))} className="h-8 text-xs" /></div>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <SectionTitle title="Additional Info" icon={<ClipboardList size={18}/>} />
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                         <div className="space-y-1"><Label className="text-xs">Check No.</Label><Input value={checkNo} onChange={e => setCheckNo(e.target.value)} onBlur={formatCheckNo} className="h-8 text-xs"/></div>
                         <div className="space-y-1"><Label className="text-xs">6R No.</Label><Input value={sixRNo} onChange={e => setSixRNo(e.target.value)} onBlur={formatSixRNo} className="h-8 text-xs"/></div>
                         <div className="space-y-1 col-span-2">
                            <Label className="text-xs">6R Date</Label>
                            <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">{sixRDate ? format(sixRDate, "PPP") : "Select date"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50"/></Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={sixRDate} onSelect={setSixRDate} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                         <div className="space-y-1 col-span-2"><Label className="text-xs">Parchi No. (SR#)</Label><Input value={parchiNo} onChange={(e) => setParchiNo(e.target.value)} className="h-8 text-xs"/></div>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                         <SectionTitle title="Bank & Payee Details" icon={<User size={18}/>} onEdit={() => setIsPayeeEditing(true)} editingPayment={editingPayment} />
                    </CardHeader>
                    <CardContent className="space-y-3">
                         {isPayeeEditing ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 border rounded-lg bg-background">
                                <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={supplierDetails.name} onChange={e => setSupplierDetails({...supplierDetails, name: e.target.value})} className="h-8 text-xs" /></div>
                                <div className="space-y-1"><Label className="text-xs">{rtgsFor === 'Outsider' ? 'Company' : "Father's Name"}</Label><Input value={supplierDetails.fatherName} onChange={e => setSupplierDetails({...supplierDetails, fatherName: e.target.value})} className="h-8 text-xs" /></div>
                                <div className="col-span-full space-y-1"><Label className="text-xs">Address</Label><Input value={supplierDetails.address} onChange={e => setSupplierDetails({...supplierDetails, address: e.target.value})} className="h-8 text-xs" /></div>
                                <div className="space-y-1"><Label className="text-xs">Contact</Label><Input value={supplierDetails.contact} onChange={e => setSupplierDetails({...supplierDetails, contact: e.target.value})} className="h-8 text-xs" disabled={rtgsFor === 'Supplier'}/></div>
                                <div className="col-span-full flex justify-end">
                                    <Button size="sm" onClick={() => setIsPayeeEditing(false)} className="h-7 text-xs">Done</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground p-2 rounded-lg bg-background/50">
                                <p><span className="font-semibold">Name:</span> {supplierDetails.name}</p>
                                <p><span className="font-semibold">{rtgsFor === 'Outsider' ? 'Company:' : "Father's Name:"}</span> {supplierDetails.fatherName}</p>
                                <p className="col-span-full"><span className="font-semibold">Address:</span> {supplierDetails.address}</p>
                            </div>
                        )}
                        <div className="p-2 border rounded-lg bg-background grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                             <div className="space-y-1">
                                <Label className="text-xs">Bank</Label>
                                <CustomDropdown options={bankOptions} value={bankDetails.bank} onChange={handleBankSelect} onAdd={(newBank) => { addBank(newBank); handleBankSelect(newBank); }} placeholder="Select or add bank" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Branch</Label>
                                <CustomDropdown options={availableBranchOptions} value={bankDetails.branch} onChange={handleBranchSelect} onAdd={handleAddBranch} placeholder="Select or add branch"/>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">IFSC</Label>
                                <Input value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value.toUpperCase()})} onBlur={handleIfscBlur} className="h-8 text-xs font-mono uppercase"/>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">A/C No.</Label>
                                <Input value={bankDetails.acNo} onChange={e => setBankDetails({...bankDetails, acNo: e.target.value})} className="h-8 text-xs font-mono"/>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
