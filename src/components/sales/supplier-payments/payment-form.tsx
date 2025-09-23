
"use client";

import React from 'react';
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Settings, RefreshCw, Bot, ArrowUpDown, Pen, HandCoins, User, Building, Home, Landmark, Hash, Wallet, CircleDollarSign, Weight, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from '@/components/ui/switch';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { bankNames } from '@/lib/data';
import { Separator } from '@/components/ui/separator';


const cdOptions = [
    { value: 'partial_on_paid', label: 'Partial CD on Paid Amount' },
    { value: 'on_previously_paid', label: 'CD on Previously Paid Amount' },
    { value: 'on_unpaid_amount', label: 'CD on Unpaid Amount' },
    { value: 'on_full_amount', label: 'Full CD (Paid + Unpaid)' },
];

const SectionTitle = ({ title, onEdit, isEditing }: { title: string, onEdit?: () => void, isEditing?: boolean }) => (
    <div className="flex items-center justify-between mt-3 mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
            {title === 'Supplier/Payee Details' && <User size={14}/>}
            {title === 'Bank Details' && <Landmark size={14}/>}
            {title === 'RTGS Details' && <Wallet size={14}/>}
            {title}
        </h3>
        {onEdit && !isEditing && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pen className="h-4 w-4"/></Button>}
    </div>
);

export const PaymentForm = ({
    paymentMethod, rtgsFor, supplierDetails, setSupplierDetails,
    isPayeeEditing, setIsPayeeEditing,
    bankDetails, setBankDetails, banks, bankBranches, paymentId, setPaymentId, handlePaymentIdBlur,
    rtgsSrNo, setRtgsSrNo, paymentType, setPaymentType, paymentAmount, setPaymentAmount, cdEnabled, setCdEnabled,
    cdPercent, setCdPercent, cdAt, setCdAt, calculatedCdAmount, sixRNo, setSixRNo, sixRDate,
    setSixRDate, utrNo, setUtrNo, 
    parchiNo, setParchiNo, checkNo, setCheckNo,
    rtgsQuantity, setRtgsQuantity,
    rtgsRate, setRtgsRate, rtgsAmount, setRtgsAmount, processPayment, isProcessing, resetPaymentForm,
    editingPayment, setIsBankSettingsOpen,
    // Combination Generator Props
    calcTargetAmount, setCalcTargetAmount, calcMinRate, setCalcMinRate, calcMaxRate, setCalcMaxRate,
    handleGeneratePaymentOptions, paymentOptions, selectPaymentAmount, requestSort, sortedPaymentOptions,
    roundFigureToggle, setRoundFigureToggle,
    // Bank Account Props
    bankAccounts, selectedAccountId, setSelectedAccountId, financialState
}: any) => {

    const availableBranches = React.useMemo(() => {
        if (!bankDetails.bank || !Array.isArray(bankBranches)) return [];
        
        const uniqueBranches = new Map<string, { value: string; label: string }>();
        bankBranches
            .filter((branch: any) => branch.bankName.toLowerCase() === bankDetails.bank.toLowerCase())
            .forEach((branch: any) => {
                // Use IFSC as the unique value, as branch names can be duplicated.
                if (!uniqueBranches.has(branch.ifscCode)) {
                    uniqueBranches.set(branch.ifscCode, { value: branch.ifscCode, label: branch.branchName });
                }
            });
        return Array.from(uniqueBranches.values());
    }, [bankDetails.bank, bankBranches]);

    const handleBranchSelect = (ifscCode: string | null) => {
        const selectedBranch = bankBranches.find((b: any) => b.ifscCode === ifscCode);
        if(selectedBranch) {
          setBankDetails((prev: any) => ({...prev, branch: selectedBranch.branchName, ifscCode: selectedBranch.ifscCode}));
        } else {
            setBankDetails((prev: any) => ({...prev, branch: '', ifscCode: '' }));
        }
    };
    
    const allBankOptions = React.useMemo(() => {
        const combinedNames = [...bankNames, ...banks.map((b: any) => b.name)];
        const uniqueNames = Array.from(new Set(combinedNames));
        return uniqueNames.sort().map(name => ({ value: name, label: name }));
    }, [banks]);

    return (
        <div className="space-y-3">
        <Card>
            <CardContent className="p-3 space-y-3">
                <SectionTitle title="Supplier/Payee Details" onEdit={() => setIsPayeeEditing(true)} isEditing={isPayeeEditing} />
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
                
                <Separator/>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-2 items-end">
                    {rtgsFor === 'Supplier' && (
                    <>
                        <div className="space-y-1"><Label className="text-xs">Payment ID</Label><Input id="payment-id" value={paymentId} onChange={e => setPaymentId(e.target.value)} onBlur={handlePaymentIdBlur} className="h-8 text-xs font-mono" /></div>
                        {paymentMethod !== 'RTGS' && (
                        <div className="space-y-1"><Label className="text-xs">Payment Type</Label><Select value={paymentType} onValueChange={setPaymentType}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Full">Full</SelectItem><SelectItem value="Partial">Partial</SelectItem></SelectContent></Select></div>
                        )}
                        <div className="space-y-1"><Label htmlFor="payment-amount" className="text-xs">Pay Amount</Label><Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full'} className="h-8 text-xs" /></div>
                    </>
                    )}
                    
                    {paymentMethod !== 'Cash' && (
                        <div className="space-y-1">
                            <Label className="text-xs">Payment From</Label>
                            <CustomDropdown
                                options={[{ value: 'CashInHand', label: `Cash In Hand (${formatCurrency(financialState.balances.get('CashInHand') || 0)})` }, ...bankAccounts.map((acc: any) => ({ value: acc.id, label: `${acc.accountHolderName} (...${acc.accountNumber.slice(-4)}) (${formatCurrency(financialState.balances.get(acc.id) || 0)})` }))]}
                                value={selectedAccountId}
                                onChange={setSelectedAccountId}
                                placeholder="Select Account"
                            />
                        </div>
                    )}
                </div>
                
                {rtgsFor === 'Supplier' && (
                <>
                <div className="flex items-center justify-between mt-4 mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><CircleDollarSign size={14}/>Cash Discount (CD)</h3>
                    <div className="flex items-center space-x-2">
                        <button type="button" onClick={() => setCdEnabled(!cdEnabled)} className={cn( "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", cdEnabled ? 'bg-primary/20' : 'bg-secondary/20' )} >
                            <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", cdEnabled ? 'text-primary' : 'text-muted-foreground')}>On</span>
                            <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", !cdEnabled ? 'text-primary' : 'text-muted-foreground')}>Off</span>
                            <div className={cn( "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform", cdEnabled ? 'translate-x-[calc(100%-28px)]' : 'translate-x-[-4px]' )}>
                                <div className={cn( "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300", cdEnabled ? 'bg-primary' : 'bg-secondary' )}>
                                    <span className="text-xs font-bold text-primary-foreground">CD</span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
                {cdEnabled && (
                    <div className="p-2 border rounded-lg bg-background grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="space-y-1"><Label htmlFor="cd-percent" className="text-xs">CD %</Label><Input id="cd-percent" type="number" value={cdPercent} onChange={e => setCdPercent(parseFloat(e.target.value) || 0)} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-xs">CD At</Label><Select value={cdAt} onValueChange={setCdAt}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{cdOptions.map(opt => (<SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>))}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-xs">CD Amount</Label><Input value={formatCurrency(calculatedCdAmount)} readOnly className="h-8 text-xs font-bold text-primary" /></div>
                    </div>
                )}
                </>
                )}
                
                {paymentMethod === 'RTGS' && (
                    <>
                         <Separator className="my-3"/>
                        <Card>
                            <CardHeader className="p-2 pb-1 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm">Payment Combination Generator</CardTitle>
                                <div className="flex items-center gap-2">
                                        <Label htmlFor="round-figure-toggle" className="text-xs">Round Figure</Label>
                                        <Switch id="round-figure-toggle" checked={roundFigureToggle} onCheckedChange={setRoundFigureToggle} />
                                </div>
                            </CardHeader>
                            <CardContent className="p-2 space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Target Amount</Label>
                                        <Input type="number" value={calcTargetAmount} onChange={(e) => setCalcTargetAmount(Number(e.target.value))} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Min Amount</Label>
                                        <Input type="number" value={calcMinRate} onChange={(e) => setCalcMinRate(Number(e.target.value))} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Max Amount</Label>
                                        <Input type="number" value={calcMaxRate} onChange={(e) => setCalcMaxRate(Number(e.target.value))} className="h-8 text-xs" />
                                    </div>
                                </div>
                                <Button onClick={handleGeneratePaymentOptions} size="sm" className="h-8 text-xs"><Bot className="mr-2 h-4 w-4" />Generate Combinations</Button>
                                <div className="p-2 border rounded-lg bg-background min-h-[100px] max-h-60 overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="h-8 p-1"><Button variant="ghost" size="sm" onClick={() => requestSort('quantity')} className="text-xs p-1">Qty <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                                <TableHead className="h-8 p-1"><Button variant="ghost" size="sm" onClick={() => requestSort('rate')} className="text-xs p-1">Rate <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                                <TableHead className="h-8 p-1"><Button variant="ghost" size="sm" onClick={() => requestSort('calculatedAmount')} className="text-xs p-1">Amount <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                                <TableHead className="h-8 p-1"><Button variant="ghost" size="sm" onClick={() => requestSort('amountRemaining')} className="text-xs p-1">Remain <ArrowUpDown className="inline h-3 w-3" /></Button></TableHead>
                                                <TableHead className="h-8 p-1">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortedPaymentOptions.length > 0 ? sortedPaymentOptions.map((option: any, index: number) => (
                                                <TableRow key={index}>
                                                    <TableCell className="p-1 text-xs">{option.quantity.toFixed(2)}</TableCell>
                                                    <TableCell className="p-1 text-xs">{option.rate}</TableCell>
                                                    <TableCell className="p-1 text-xs">{formatCurrency(option.calculatedAmount)}</TableCell>
                                                    <TableCell className="p-1 text-xs">{formatCurrency(option.amountRemaining)}</TableCell>
                                                    <TableCell className="p-1 text-xs"><Button variant="outline" size="sm" className="h-6 p-1 text-xs" onClick={() => selectPaymentAmount(option)}>Select</Button></TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs h-24">Generated payment combinations will appear here.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                        <Separator className="my-3"/>
                        <SectionTitle title="Bank Details" onEdit={() => setIsBankSettingsOpen(true)} />
                        <div className="p-2 border rounded-lg bg-background grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                            <div className="space-y-1"><Label className="text-xs">Bank</Label>
                            <CustomDropdown 
                                options={allBankOptions}
                                value={bankDetails.bank} 
                                onChange={(val) => setBankDetails({ ...bankDetails, bank: val || '', branch: '', ifscCode: '' })} 
                                placeholder="Select bank" 
                             />
                            </div>
                            <div className="space-y-1"><Label className="text-xs">Branch</Label><CustomDropdown options={availableBranches} value={bankDetails.ifscCode} onChange={handleBranchSelect} placeholder="Select branch" /></div>
                            <div className="space-y-1"><Label className="text-xs">A/C No.</Label><Input value={bankDetails.acNo} onChange={e => setBankDetails({...bankDetails, acNo: e.target.value})} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">IFSC</Label><Input value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value.toUpperCase()})} className="h-8 text-xs uppercase"/></div>
                        </div>

                        <Separator className="my-3"/>
                        <SectionTitle title="RTGS Details" />
                        <div className="p-2 border rounded-lg bg-background grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 items-end">
                            <div className="space-y-1"><Label className="text-xs">RTGS SR No.</Label><Input value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} className="h-8 text-xs font-mono"/></div>
                            <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" value={rtgsQuantity} onChange={e => setRtgsQuantity(Number(e.target.value))} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">Rate</Label><Input type="number" value={rtgsRate} onChange={e => setRtgsRate(Number(e.target.value))} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" value={rtgsAmount} onChange={e => setRtgsAmount(Number(e.target.value))} className="h-8 text-xs" /></div>
                            <div className="space-y-1"><Label className="text-xs">Check No.</Label><Input value={checkNo} onChange={e => setCheckNo(e.target.value)} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">9R No.</Label><Input value={sixRNo} onChange={e => setSixRNo(e.target.value)} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">6R Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">{sixRDate ? format(sixRDate, "PPP") : "Select date"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50"/></Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={sixRDate} onSelect={setSixRDate} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1 col-span-full"><Label className="text-xs">Parchi No. (SR#)</Label><Input value={parchiNo} onChange={(e) => setParchiNo(e.target.value)} className="h-8 text-xs"/></div>
                        </div>
                    </>
                )}

                 <CardFooter className="p-0 pt-3">
                    <Card className="bg-muted/30 w-full p-2">
                        <CardContent className="p-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">To Pay:</span><span className="text-sm font-semibold">{formatCurrency(rtgsAmount || paymentAmount)}</span></div>
                            {cdEnabled && (<div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">CD:</span><span className="text-sm font-semibold">{formatCurrency(calculatedCdAmount)}</span></div>)}
                            <div className="flex items-center gap-2 border-l pl-2 ml-2"><span className="text-sm font-medium text-muted-foreground">Total Reduction:</span><span className="text-base font-bold text-primary">{formatCurrency((rtgsAmount || paymentAmount) + calculatedCdAmount)}</span></div>
                            <div className="flex-grow"></div>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => resetPaymentForm(rtgsFor === 'Outsider')}><RefreshCw className="mr-2 h-3 w-3" />Clear Form</Button>
                            <Button onClick={processPayment} size="sm" className="h-8 text-xs" disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Finalize Payment
                            </Button>
                        </CardContent>
                    </Card>
                </CardFooter>
            </CardContent>
        </Card>

        </div>
    );
};
