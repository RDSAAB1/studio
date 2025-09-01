
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Calendar as CalendarIcon, Settings, RefreshCw, Bot, ArrowUpDown } from "lucide-react";
import { format } from 'date-fns';
import { appOptionsData, bankNames, bankBranches as staticBankBranches } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from '@/components/ui/switch';

const cdOptions = [
    { value: 'paid_amount', label: 'CD on Paid Amount' },
    { value: 'unpaid_amount', label: 'CD on Unpaid Amount (Selected)' },
    { value: 'full_amount', label: 'CD on Full Amount' },
];

export const PaymentForm = ({
    paymentMethod, rtgsFor, supplierDetails, setSupplierDetails, bankDetails,
    setBankDetails, banks, bankBranches, paymentId, setPaymentId, handlePaymentIdBlur,
    rtgsSrNo, setRtgsSrNo, paymentType, setPaymentType, paymentAmount, setPaymentAmount, cdEnabled, setCdEnabled,
    cdPercent, setCdPercent, cdAt, setCdAt, calculatedCdAmount, sixRNo, setSixRNo, sixRDate,
    setSixRDate, parchiNo, setParchiNo, utrNo, setUtrNo, checkNo, setCheckNo,
    rtgsQuantity, setRtgsQuantity,
    rtgsRate, setRtgsRate, rtgsAmount, setRtgsAmount, processPayment, resetPaymentForm,
    editingPayment, setIsBankSettingsOpen,
    // Combination Generator Props
    calcTargetAmount, setCalcTargetAmount, calcMinRate, setCalcMinRate, calcMaxRate, setCalcMaxRate,
    handleGeneratePaymentOptions, paymentOptions, selectPaymentAmount, requestSort, sortedPaymentOptions,
    roundFigureToggle, setRoundFigureToggle
}: any) => {

    const availableBranches = React.useMemo(() => {
        if (!bankDetails.bank) return [];
        const combined = [...staticBankBranches, ...bankBranches];
        const uniqueBranches = Array.from(new Map(combined.map(item => [item.ifscCode + item.branchName, item])).values());
        return uniqueBranches.filter(branch => branch.bankName.toLowerCase() === bankDetails.bank.toLowerCase());
    }, [bankDetails.bank, bankBranches]);

    const handleBranchSelect = (branchValue: string) => {
        const selectedBranch = availableBranches.find(b => b.branchName === branchValue);
        if(selectedBranch) {
          setBankDetails((prev: any) => ({...prev, branch: selectedBranch.branchName, ifscCode: selectedBranch.ifscCode}));
        }
    };
    
    return (
        <div className="mt-3 space-y-3">
            <Card className="p-2">
                <CardHeader className="p-1 pb-2"><CardTitle className="text-sm">Supplier/Payee Details</CardTitle></CardHeader>
                <CardContent className="p-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={supplierDetails.name} onChange={e => setSupplierDetails({...supplierDetails, name: e.target.value})} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-xs">{rtgsFor === 'Outsider' ? 'Company Name' : "Father's Name"}</Label><Input value={supplierDetails.fatherName} onChange={e => setSupplierDetails({...supplierDetails, fatherName: e.target.value})} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={supplierDetails.address} onChange={e => setSupplierDetails({...supplierDetails, address: e.target.value})} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-xs">Contact</Label><Input value={supplierDetails.contact} onChange={e => setSupplierDetails({...supplierDetails, contact: e.target.value})} className="h-8 text-xs" disabled={rtgsFor === 'Supplier'}/></div>
                </CardContent>
            </Card>

            <Card className="bg-muted/30 p-2">
                <CardContent className="p-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-x-2 gap-y-2 items-end">
                {rtgsFor === 'Supplier' && (
                <>
                    <div className="space-y-1"><Label className="text-xs">Payment ID</Label><Input id="payment-id" value={paymentId} onChange={e => setPaymentId(e.target.value)} onBlur={handlePaymentIdBlur} className="h-8 text-xs font-mono" /></div>
                    <div className="space-y-1"><Label className="text-xs">Payment Type</Label><Select value={paymentType} onValueChange={setPaymentType}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Full">Full</SelectItem><SelectItem value="Partial">Partial</SelectItem></SelectContent></Select></div>
                    {paymentType === 'Partial' && (<div className="space-y-1"><Label htmlFor="payment-amount" className="text-xs">Pay Amount</Label><Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full'} className="h-8 text-xs" /></div>)}
                    <div className="flex items-center space-x-2 pb-1">
                         <button
                            type="button"
                            onClick={() => setCdEnabled(!cdEnabled)}
                            className={cn( "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", cdEnabled ? 'bg-primary/20' : 'bg-secondary/20' )} >
                            <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", cdEnabled ? 'text-primary' : 'text-muted-foreground')}>On</span>
                            <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", !cdEnabled ? 'text-primary' : 'text-muted-foreground')}>Off</span>
                            <div className={cn( "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform", cdEnabled ? 'translate-x-[calc(100%-28px)]' : 'translate-x-[-4px]' )}>
                                <div className={cn( "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300", cdEnabled ? 'bg-primary' : 'bg-secondary' )}>
                                    <span className="text-xs font-bold text-primary-foreground">CD</span>
                                </div>
                            </div>
                        </button>
                    </div>
                    {cdEnabled && <>
                        <div className="space-y-1"><Label htmlFor="cd-percent" className="text-xs">CD %</Label><Input id="cd-percent" type="number" value={cdPercent} onChange={e => setCdPercent(parseFloat(e.target.value) || 0)} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-xs">CD At</Label><Select value={cdAt} onValueChange={setCdAt} disabled={paymentType === 'Partial'}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{cdOptions.map(opt => (<SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>))}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-xs">CD Amount</Label><Input value={formatCurrency(calculatedCdAmount)} readOnly className="h-8 text-xs font-bold text-primary" /></div>
                    </>}
                </>
                )}
                </CardContent>
            </Card>

            {paymentMethod === 'RTGS' && (
                <div className="space-y-3">
                     <Card className="p-2">
                        <CardHeader className="p-1 pb-2"><CardTitle className="text-sm">Bank Details</CardTitle></CardHeader>
                        <CardContent className="p-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                                <div className="space-y-1"><Label className="text-xs">Bank</Label>
                                    <Popover><PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-xs">{bankDetails.bank || "Select bank"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search bank..." /><CommandEmpty>No bank found.</CommandEmpty><CommandList>{[...bankNames, ...banks.map((b:any) => b.name)].sort().map((bank) => (<CommandItem key={bank} value={bank} onSelect={(currentValue) => setBankDetails({ ...bankDetails, bank: currentValue === bankDetails.bank ? "" : currentValue, branch: '', ifscCode: '' })}><Check className={cn("mr-2 h-4 w-4", bankDetails.bank === bank ? "opacity-100" : "opacity-0")} />{bank}</CommandItem>))}</CommandList></Command></PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1"><Label className="text-xs">Branch</Label>
                                    <Popover><PopoverTrigger asChild disabled={!bankDetails.bank}><Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-xs">{bankDetails.branch || "Select branch"}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search branch..." /><CommandEmpty>No branch found.</CommandEmpty><CommandList>{availableBranches.map((branch:any) => (<CommandItem key={branch.ifscCode} value={branch.branchName} onSelect={(currentValue) => handleBranchSelect(currentValue)}><Check className={cn("mr-2 h-4 w-4", bankDetails.branch === branch.branchName ? "opacity-100" : "opacity-0")} />{branch.branchName}</CommandItem>))}</CommandList></Command></PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1"><Label className="text-xs">A/C No.</Label><Input value={bankDetails.acNo} onChange={e => setBankDetails({...bankDetails, acNo: e.target.value})} className="h-8 text-xs"/></div>
                                <div className="space-y-1"><Label className="text-xs">IFSC</Label><Input value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value})} className="h-8 text-xs"/></div>
                        </CardContent>
                    </Card>
                    <Card className="p-2">
                        <CardHeader className="p-1 pb-2"><CardTitle className="text-sm">RTGS Details</CardTitle></CardHeader>
                        <CardContent className="p-1 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                            <div className="space-y-1"><Label className="text-xs">RTGS SR No.</Label><Input value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} className="h-8 text-xs font-mono"/></div>
                            <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" value={rtgsQuantity} onChange={e => setRtgsQuantity(Number(e.target.value))} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">Rate</Label><Input type="number" value={rtgsRate} onChange={e => setRtgsRate(Number(e.target.value))} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">Amount</Label><Input type="number" value={rtgsAmount} onChange={e => setRtgsAmount(Number(e.target.value))} className="h-8 text-xs" /></div>
                            <div className="space-y-1"><Label className="text-xs">Check No.</Label><Input value={checkNo} onChange={e => setCheckNo(e.target.value)} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">UTR No.</Label><Input value={utrNo} onChange={e => setUtrNo(e.target.value)} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">6R No.</Label><Input value={sixRNo} onChange={e => setSixRNo(e.target.value)} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-xs">6R Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal h-8 text-xs">{sixRDate ? format(sixRDate, "PPP") : "Select date"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50"/></Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={sixRDate} onSelect={setSixRDate} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1 col-span-2 md:col-span-4"><Label className="text-xs">Parchi No. (SR#)</Label><Input value={parchiNo} onChange={(e) => setParchiNo(e.target.value)} className="h-8 text-xs"/></div>
                        </CardContent>
                    </Card>
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
                </div>
            )}
             <CardFooter className="p-0 pt-2">
                <Card className="bg-muted/30 w-full p-2">
                    <CardContent className="p-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">To Pay:</span><span className="text-sm font-semibold">{formatCurrency(rtgsAmount || paymentAmount)}</span></div>
                    {cdEnabled && (<div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">CD:</span><span className="text-sm font-semibold">{formatCurrency(calculatedCdAmount)}</span></div>)}
                    <div className="flex items-center gap-2 border-l pl-2 ml-2"><span className="text-sm font-medium text-muted-foreground">Total Reduction:</span><span className="text-base font-bold text-primary">{formatCurrency((rtgsAmount || paymentAmount) + calculatedCdAmount)}</span></div>
                    <div className="flex-grow"></div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => resetPaymentForm(rtgsFor === 'Outsider')}><RefreshCw className="mr-2 h-3 w-3" />Clear Form</Button>
                    <Button onClick={processPayment} size="sm" className="h-8 text-xs">{editingPayment ? 'Update Payment' : 'Finalize Payment'}</Button>
                </CardContent>
                </Card>
            </CardFooter>
        </div>
    );
};
