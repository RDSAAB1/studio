
"use client";

import React from 'react';
import { cn, formatCurrency, toTitleCase } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Settings, Pen, User, Landmark } from "lucide-react";
import { format } from 'date-fns';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { Separator } from '@/components/ui/separator';
import { PaymentCombinationGenerator } from './payment-combination-generator';
import { useSupplierData } from '@/hooks/use-supplier-data';


const SectionTitle = ({ title, onEdit, editingPayment }: { title: string, onEdit?: () => void, editingPayment?: boolean }) => (
    <div className="flex items-center justify-between mt-3 mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
            {title === 'Supplier/Payee Details' && <User size={14}/>}
            {title === 'Bank Details' && <Landmark size={14}/>}
            {title}
        </h3>
        {onEdit && !editingPayment && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pen className="h-4 w-4"/></Button>}
    </div>
);

export const RtgsForm = (props: any) => {
    const {
        rtgsFor, supplierDetails, setSupplierDetails,
        isPayeeEditing, setIsPayeeEditing,
        bankDetails, setBankDetails,
        rtgsSrNo, setRtgsSrNo, sixRNo, setSixRNo, sixRDate, setSixRDate,
        utrNo, setUtrNo, parchiNo, setParchiNo, checkNo, setCheckNo,
        rtgsQuantity, setRtgsQuantity, rtgsRate, setRtgsRate, rtgsAmount, setRtgsAmount,
        editingPayment, setIsBankSettingsOpen,
        calcTargetAmount, setCalcTargetAmount,
        selectPaymentAmount,
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
        return bankBranches
            .filter((branch: any) => branch.bankName === bankDetails.bank)
            .map((branch: any) => ({
                value: branch.id,
                label: branch.branchName
            }));
    }, [bankDetails.bank, bankBranches]);

    const handleBankSelect = (bankName: string | null) => {
        setBankDetails({
            ...bankDetails,
            bank: bankName || '',
            branch: '',
            ifscCode: ''
        });
    };

    const handleBranchSelect = (branchId: string | null) => {
        if (!branchId || !Array.isArray(bankBranches)) {
            setBankDetails((prev: any) => ({ ...prev, branch: '', ifscCode: '' }));
            return;
        }
        const selectedBranch = bankBranches.find((b: any) => b.id === branchId);
        if(selectedBranch) {
          setBankDetails((prev: any) => ({
              ...prev, 
              branch: selectedBranch.branchName, 
              ifscCode: selectedBranch.ifscCode
            }));
        }
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
        <div className="space-y-3">
             <SectionTitle title="Supplier/Payee Details" onEdit={() => setIsPayeeEditing(true)} editingPayment={editingPayment} />
                {isPayeeEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 p-2 border rounded-lg bg-background">
                        <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={supplierDetails.name} onChange={e => setSupplierDetails({...supplierDetails, name: e.target.value})} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-xs">{rtgsFor === 'Outsider' ? 'Company Name' : "Father's Name"}</Label><Input value={supplierDetails.fatherName} onChange={e => setSupplierDetails({...supplierDetails, fatherName: e.target.value})} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={supplierDetails.address} onChange={e => setSupplierDetails({...supplierDetails, address: e.target.value})} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-xs">Contact</Label><Input value={supplierDetails.contact} onChange={e => setSupplierDetails({...supplierDetails, contact: e.target.value})} className="h-8 text-xs" disabled={rtgsFor === 'Supplier'}/></div>
                        <div className="col-span-full flex justify-end">
                            <Button size="sm" onClick={() => setIsPayeeEditing(false)} className="h-7 text-xs">Done</Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-2 text-muted-foreground p-2 rounded-lg bg-background/50">
                        <p><span className="font-semibold">Name:</span> {supplierDetails.name}</p>
                        <p><span className="font-semibold">{rtgsFor === 'Outsider' ? 'Company:' : "Father's Name:"}</span> {supplierDetails.fatherName}</p>
                        <p className="col-span-2"><span className="font-semibold">Address:</span> {supplierDetails.address}</p>
                    </div>
                )}
            
            <Separator />

            <PaymentCombinationGenerator 
                calcTargetAmount={calcTargetAmount}
                setCalcTargetAmount={setCalcTargetAmount}
                selectPaymentAmount={selectPaymentAmount}
            />

            <Separator />
            
            <SectionTitle title="Bank Details" onEdit={() => setIsBankSettingsOpen(true)} />
             <div className="p-2 border rounded-lg bg-background grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                <div className="space-y-1 col-span-2 md:col-span-1">
                    <Label className="text-xs">Bank</Label>
                    <CustomDropdown
                        options={bankOptions}
                        value={bankDetails.bank}
                        onChange={handleBankSelect}
                        placeholder="Select a bank"
                    />
                </div>
                <div className="space-y-1 col-span-2 md:col-span-2">
                    <Label className="text-xs">Branch</Label>
                     <CustomDropdown
                        options={availableBranchOptions}
                        value={availableBranchOptions.find((opt: any) => opt.label === bankDetails.branch)?.value || null}
                        onChange={handleBranchSelect}
                        placeholder="Select a branch"
                    />
                </div>
                 <div className="space-y-1">
                    <Label className="text-xs">IFSC</Label>
                    <Input value={bankDetails.ifscCode} readOnly disabled className="h-8 text-xs bg-muted/50 font-mono"/>
                </div>
                <div className="space-y-1 col-span-full">
                    <Label className="text-xs">A/C No.</Label>
                    <Input value={bankDetails.acNo} onChange={e => setBankDetails({...bankDetails, acNo: e.target.value})} className="h-8 text-xs font-mono"/>
                </div>
            </div>

            <Separator />
            
            <SectionTitle title="RTGS Details" />
            <div className="p-2 border rounded-lg bg-background grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 items-end">
                <div className="space-y-1"><Label className="text-xs">RTGS SR No.</Label><Input value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} className="h-8 text-xs font-mono"/></div>
                <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" value={rtgsQuantity} onChange={e => setRtgsQuantity(Number(e.target.value))} className="h-8 text-xs"/></div>
                <div className="space-y-1"><Label className="text-xs">Rate</Label><Input type="number" value={rtgsRate} onChange={e => setRtgsRate(Number(e.target.value))} className="h-8 text-xs"/></div>
                <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" value={rtgsAmount} onChange={e => setRtgsAmount(Number(e.target.value))} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Check No.</Label><Input value={checkNo} onChange={e => setCheckNo(e.target.value)} onBlur={formatCheckNo} className="h-8 text-xs"/></div>
                <div className="space-y-1"><Label className="text-xs">6R No.</Label><Input value={sixRNo} onChange={e => setSixRNo(e.target.value)} onBlur={formatSixRNo} className="h-8 text-xs"/></div>
                <div className="space-y-1"><Label className="text-xs">6R Date</Label>
                    <Popover>
                        <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">{sixRDate ? format(sixRDate, "PPP") : "Select date"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50"/></Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={sixRDate} onSelect={setSixRDate} initialFocus /></PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-1 col-span-full"><Label className="text-xs">Parchi No. (SR#)</Label><Input value={parchiNo} onChange={(e) => setParchiNo(e.target.value)} className="h-8 text-xs"/></div>
            </div>
        </div>
    );
};
