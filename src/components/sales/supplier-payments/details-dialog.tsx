
"use client";

import { useState } from 'react';
import { format } from 'date-fns';
import { cn, toTitleCase, formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, X, Rows3, LayoutList, LayoutGrid, StepForward, User, Phone, Home, Truck, Wheat, Banknote, Landmark, UserSquare, Wallet, Calendar as CalendarIcon, Scale, Calculator, Percent, Server, Milestone, CircleDollarSign, Weight } from "lucide-react";

type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';

const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: any, className?: string }) => (
    <div className={cn("flex items-start gap-3", className)}>
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm">{String(value)}</p>
        </div>
    </div>
);

export const DetailsDialog = ({ entry, payments, onOpenChange }: any) => {
    const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');

    if (!entry) return null;

    return (
        <Dialog open={!!entry} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0">
                <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 flex flex-row justify-between items-center">
                    <div><DialogTitle className="text-base font-semibold">Details for SR No: {entry.srNo}</DialogTitle></div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent><DropdownMenuRadioGroup value={activeLayout} onValueChange={(v) => setActiveLayout(v as LayoutOption)}><DropdownMenuRadioItem value="classic"><Rows3 className="mr-2 h-4 w-4" />Classic</DropdownMenuRadioItem><DropdownMenuRadioItem value="compact"><LayoutList className="mr-2 h-4 w-4" />Compact</DropdownMenuRadioItem><DropdownMenuRadioItem value="grid"><LayoutGrid className="mr-2 h-4 w-4" />Grid</DropdownMenuRadioItem><DropdownMenuRadioItem value="step-by-step"><StepForward className="mr-2 h-4 w-4" />Step-by-Step</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent>
                        </DropdownMenu>
                        <DialogClose asChild><Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4"/></Button></DialogClose>
                    </div>
                </DialogHeader>
                <ScrollArea className="max-h-[85vh]">
                    <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                        {activeLayout === 'classic' && (
                        <div className="space-y-4">
                            <Card>
                                <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                                    <div className="flex flex-col items-center justify-center space-y-2 p-4 bg-muted rounded-lg h-full"><p className="text-xs text-muted-foreground">SR No.</p><p className="text-2xl font-bold font-mono text-primary">{entry.srNo}</p></div>
                                    <Separator orientation="vertical" className="h-auto mx-4 hidden md:block" /><Separator orientation="horizontal" className="w-full md:hidden" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 flex-1 text-sm">
                                        <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(entry.name)} />
                                        <DetailItem icon={<Phone size={14} />} label="Contact" value={entry.contact} />
                                        <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(entry.so)} />
                                        <DetailItem icon={<CalendarIcon size={14} />} label="Transaction Date" value={format(new Date(entry.date), "PPP")} />
                                        <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(entry.dueDate), "PPP")} />
                                        <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(entry.address)} className="col-span-1 sm:col-span-2" />
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="p-4"><CardTitle className="text-base">Transaction & Weight</CardTitle></CardHeader>
                                    <CardContent className="p-4 pt-0 space-y-3">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2"><DetailItem icon={<Truck size={14} />} label="Vehicle No." value={entry.vehicleNo.toUpperCase()} /><DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(entry.variety)} /><DetailItem icon={<Wallet size={14} />} label="Payment Type" value={entry.paymentType} /></div>
                                        <Separator />
                                        <Table className="text-xs"><TableBody><TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Weight size={12} />Gross Weight</TableCell><TableCell className="text-right font-semibold p-1">{entry.grossWeight.toFixed(2)} kg</TableCell></TableRow><TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Weight size={12} />Teir Weight (Less)</TableCell><TableCell className="text-right font-semibold p-1">- {entry.teirWeight.toFixed(2)} kg</TableCell></TableRow><TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Scale size={12} />Final Weight</TableCell><TableCell className="text-right font-bold p-2">{entry.weight.toFixed(2)} kg</TableCell></TableRow></TableBody></Table>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="p-4"><CardTitle className="text-base">Financial Calculation</CardTitle></CardHeader>
                                    <CardContent className="p-4 pt-0">
                                    <Table className="text-xs"><TableBody><TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Scale size={12} />Net Weight</TableCell><TableCell className="text-right font-semibold p-1">{entry.netWeight.toFixed(2)} kg</TableCell></TableRow><TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Calculator size={12} />Rate</TableCell><TableCell className="text-right font-semibold p-1">@ {formatCurrency(entry.rate)}</TableCell></TableRow><TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Banknote size={12} />Total Amount</TableCell><TableCell className="text-right font-bold p-2">{formatCurrency(entry.amount)}</TableCell></TableRow><TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Percent size={12} />Karta ({entry.kartaPercentage}%)</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(entry.kartaAmount)}</TableCell></TableRow><TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Server size={12} />Laboury Rate</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">@ {entry.labouryRate.toFixed(2)}</TableCell></TableRow><TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Milestone size={12} />Laboury Amount</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(entry.labouryAmount)}</TableCell></TableRow><TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Landmark size={12} />Kanta</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(entry.kanta)}</TableCell></TableRow><TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><CircleDollarSign size={12} />CD Amount</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(entry.cd || 0)}</TableCell></TableRow></TableBody></Table>
                                    </CardContent>
                                </Card>
                            </div>
                            <Card className="border-primary/50 bg-primary/5 text-center">
                                <CardContent className="p-3"><p className="text-sm text-primary/80 font-medium">Original Total</p><p className="text-2xl font-bold text-primary/90 font-mono">{formatCurrency(Number(entry.originalNetAmount))}</p><Separator className="my-2"/><p className="text-sm text-destructive font-medium">Final Outstanding Amount</p><p className="text-3xl font-bold text-destructive font-mono">{formatCurrency(Number(entry.netAmount))}</p></CardContent>
                            </Card>
                            <Card className="mt-4">
                                <CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Payment Details</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0">
                                    {payments.length > 0 ? (<Table className="text-sm"><TableHeader><TableRow><TableHead className="p-2 text-xs">Payment ID</TableHead><TableHead className="p-2 text-xs">Date</TableHead><TableHead className="p-2 text-xs">Type</TableHead><TableHead className="p-2 text-xs">CD Applied</TableHead><TableHead className="p-2 text-xs text-right">CD Amount</TableHead><TableHead className="p-2 text-xs text-right">Amount Paid</TableHead></TableRow></TableHeader><TableBody>
                                        {payments.map((payment: any, index: number) => {
                                             const paidForThis = payment.paidFor?.find((pf: any) => pf.srNo === entry?.srNo);
                                             return (<TableRow key={payment.id || index}><TableCell className="p-2">{payment.paymentId || 'N/A'}</TableCell><TableCell className="p-2">{payment.date ? format(new Date(payment.date), "dd-MMM-yy") : 'N/A'}</TableCell><TableCell className="p-2">{payment.type}</TableCell><TableCell className="p-2">{payment.cdApplied ? 'Yes' : 'No'}</TableCell><TableCell className="p-2 text-right">{formatCurrency(payment.cdAmount || 0)}</TableCell><TableCell className="p-2 text-right font-semibold">{formatCurrency(paidForThis?.amount || 0)}</TableCell></TableRow>);
                                        })}
                                    </TableBody></Table>) : (<p className="text-center text-muted-foreground text-sm py-4">No payments have been applied to this entry yet.</p>)}
                                </CardContent>
                            </Card>  
                        </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
