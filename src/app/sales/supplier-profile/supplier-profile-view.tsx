
"use client";

import React, { useState, useMemo, useRef } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Home, Phone, User, Banknote, Landmark, Hash, UserCircle, Briefcase, Building, Info, Scale, Weight, Calculator, Percent, Server, Milestone, FileText, Users, Download, Printer } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Loader2 } from "lucide-react";


type ChartType = 'financial' | 'variety';

const PIE_CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const StatCard = ({ title, value, description, icon, colorClass }: { title: string; value: string; description?: string; icon: React.ReactNode, colorClass?: string }) => (
    <Card>
        <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
                {title}
                <span className="text-muted-foreground">{icon}</span>
            </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
            <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: string | number | null | undefined, className?: string }) => (
    <div className={cn("flex items-start gap-3", className)}>
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm break-words">{String(value) || '-'}</p>
        </div>
    </div>
);

const SummaryTile = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) => (
    <div className="rounded-md border border-muted-foreground/10 bg-background p-3 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-lg font-bold text-foreground", tone)}>{value}</p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
);

const PaymentHistoryTable = ({ 
    payments, 
    onShowPaymentDetails 
}: { 
    payments: (Payment | CustomerPayment)[]; 
    onShowPaymentDetails: (payment: Payment | CustomerPayment) => void;
}) => {
    const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(payments, {
        totalItems: payments.length,
        initialLoad: 30,
        loadMore: 30,
        threshold: 5,
        enabled: payments.length > 30,
    });

    const visiblePayments = payments.slice(0, visibleItems);

    return (
        <Card>
            <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
            <CardContent>
                <ScrollArea ref={scrollRef} className="h-[14rem]">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">ID</TableHead>
                                    <TableHead className="w-[120px]">Date</TableHead>
                                    <TableHead className="w-[250px]">Paid For (SR No.)</TableHead>
                                    <TableHead className="text-right w-[100px]">Amount</TableHead>
                                    <TableHead className="text-right w-[80px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visiblePayments.map((payment, index) => (
                                    <TableRow key={`${payment.id}-${payment.paymentId}-${index}`}>
                                        <TableCell className="font-mono w-[100px]">{payment.paymentId}</TableCell>
                                        <TableCell className="w-[120px]">{format(new Date(payment.date), "PPP")}</TableCell>
                                        <TableCell className="text-xs w-[250px]">{(payment.paidFor || []).map(p => p.srNo).join(', ')}</TableCell>
                                        <TableCell className="font-semibold text-right w-[100px]">{formatCurrency(payment.amount)}</TableCell>
                                        <TableCell className="text-right w-[80px]">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowPaymentDetails(payment)}>
                                                <Info className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4">
                                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                            <span className="ml-2 text-sm text-muted-foreground">Loading more payments...</span>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!hasMore && payments.length > 30 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-2 text-xs text-muted-foreground">
                                            Showing all {payments.length} payments
                                        </TableCell>
                                    </TableRow>
                                )}
                                {payments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground">No payments found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

const TransactionTable = ({ transactions, onShowDetails }: { transactions: Supplier[], onShowDetails: (supplier: Supplier) => void }) => {
    const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(transactions, {
        totalItems: transactions.length,
        initialLoad: 30,
        loadMore: 30,
        threshold: 5,
        enabled: transactions.length > 30,
    });

    const visibleTransactions = transactions.slice(0, visibleItems);

    return (
        <ScrollArea ref={scrollRef} className="h-[14rem]">
            <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">SR No</TableHead>
                            <TableHead className="w-[100px]">Original Amt</TableHead>
                            <TableHead className="w-[80px]">Paid</TableHead>
                            <TableHead className="w-[60px]">CD</TableHead>
                            <TableHead className="w-[100px]">Outstanding</TableHead>
                            <TableHead className="text-right w-[60px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleTransactions.map(entry => (
                            <TableRow key={entry.id}>
                                <TableCell className="font-mono text-xs w-[60px]">{entry.srNo}</TableCell>
                                <TableCell className="text-xs w-[100px]">
                                    {formatCurrency(
                                        (entry as any).adjustedOriginal !== undefined 
                                            ? (entry as any).adjustedOriginal 
                                            : parseFloat(String(entry.originalNetAmount))
                                    )}
                                </TableCell>
                                <TableCell className="text-xs text-green-600 w-[80px]">{formatCurrency(entry.totalPaid || 0)}</TableCell>
                                <TableCell className="text-xs text-blue-600 w-[60px]">{formatCurrency(entry.totalCd || 0)}</TableCell>
                                <TableCell className="text-xs font-semibold text-red-500 dark:text-red-400 w-[100px]">{formatCurrency(parseFloat(String(entry.netAmount)))}</TableCell>
                                <TableCell className="text-right w-[60px]">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onShowDetails(entry)}>
                                        <Info className="h-3 w-3" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-4">
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                    <span className="ml-2 text-sm text-muted-foreground">Loading more transactions...</span>
                                </TableCell>
                            </TableRow>
                        )}
                        {!hasMore && transactions.length > 30 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-2 text-xs text-muted-foreground">
                                    Showing all {transactions.length} transactions
                                </TableCell>
                            </TableRow>
                        )}
                        {transactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground h-24">No transactions in this category.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </ScrollArea>
    );
};


export const SupplierProfileView = ({
    selectedSupplierData,
    isMillSelected,
    onShowDetails,
    onShowPaymentDetails,
    onGenerateStatement,
    isCustomerView = false
}: {
    selectedSupplierData: CustomerSummary | null;
    isMillSelected: boolean;
    onShowDetails: (supplier: Supplier) => void;
    onShowPaymentDetails: (payment: Payment | CustomerPayment) => void;
    onGenerateStatement: () => void;
    isCustomerView?: boolean;
}) => {
    const [selectedChart, setSelectedChart] = useState<ChartType>('financial');
    const { toast } = useToast();

    const financialPieChartData = useMemo(() => {
        if (!selectedSupplierData) return [];
        return [
          { name: 'Total Paid', value: selectedSupplierData.totalPaid + selectedSupplierData.totalCdAmount! },
          { name: 'Total Outstanding', value: selectedSupplierData.totalOutstanding },
        ];
      }, [selectedSupplierData]);
    
      const varietyPieChartData = useMemo(() => {
        if (!selectedSupplierData?.transactionsByVariety) return [];
        return Object.entries(selectedSupplierData.transactionsByVariety).map(([name, value]) => ({ name, value }));
      }, [selectedSupplierData]);
    
      const chartData = useMemo(() => {
        return selectedChart === 'financial' ? financialPieChartData : varietyPieChartData;
      }, [selectedChart, financialPieChartData, varietyPieChartData]);

    const currentPaymentHistory = useMemo(() => {
        if (!selectedSupplierData) return [];
        if (isMillSelected) {
            return selectedSupplierData.allPayments || [];
        }
        return selectedSupplierData.paymentHistory || [];
    }, [selectedSupplierData, isMillSelected]);
    
    const { outstandingTransactions, runningTransactions, profitableTransactions, paidTransactions } = useMemo(() => {
        const all = selectedSupplierData?.allTransactions || [];
        
        const outstanding = all.filter(t => (t.totalPaid || 0) === 0 && t.originalNetAmount > 0);
        const paid = all.filter(t => Number(t.netAmount) < 1);
        const profitable = all.filter(t => Number(t.netAmount) >= 1 && Number(t.netAmount) < 200);
        const running = all.filter(t => Number(t.netAmount) >= 200 && (t.totalPaid || 0) > 0);

        return { outstandingTransactions: outstanding, runningTransactions: running, profitableTransactions: profitable, paidTransactions: paid };
    }, [selectedSupplierData]);

    if (!selectedSupplierData) {
        return (
            <Card className="flex items-center justify-center h-64">
                <CardContent className="text-center text-muted-foreground">
                    <p>Please select a profile to view details.</p>
                </CardContent>
            </Card>
        )
    }

    const toNumber = (value: number | string | null | undefined) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : 0;
    };

    const formatDecimal = (value: number | string | null | undefined) => {
        return toNumber(value).toFixed(2);
    };

    const formatWeight = (value: number | string | null | undefined) => {
        return `${formatDecimal(value)} kg`;
    };

    const formatPercentage = (value: number | string | null | undefined) => {
        return `${formatDecimal(value)}%`;
    };

    const formatRate = (value: number | string | null | undefined) => {
        const numericValue = toNumber(value);
        return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4">
                        <div>
                    <h2 className="text-xl font-bold">{toTitleCase(selectedSupplierData.name)}</h2>
                    <p className="text-sm text-muted-foreground">
                                {isMillSelected ? "A complete financial and transactional overview of the entire business." : `S/O: ${toTitleCase(selectedSupplierData.so || '')} | Contact: ${selectedSupplierData.contact}`}
                    </p>
                        </div>
                        <Button onClick={onGenerateStatement} size="sm">Generate Statement</Button>
                    </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Operational Summary Card */}
                        <Card className="border border-gray-400/50">
                            <CardHeader className="pb-2 px-3 pt-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Scale size={16} className="text-muted-foreground"/>
                                    Operational Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 px-3 pb-3 text-xs">
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Gross Wt:</span>
                                        <span className="font-medium">{formatWeight(selectedSupplierData.totalGrossWeight)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Teir Wt:</span>
                                        <span className="font-medium">{formatWeight(selectedSupplierData.totalTeirWeight)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Final Wt:</span>
                                        <span className="font-bold">{formatWeight(selectedSupplierData.totalFinalWeight)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Karta Wt (@{formatPercentage(selectedSupplierData.averageKartaPercentage)}):</span>
                                        <span className="font-medium">{formatWeight(selectedSupplierData.totalKartaWeight)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Net Wt:</span>
                                        <span className="font-bold text-primary">{formatWeight(selectedSupplierData.totalNetWeight)}</span>
                                    </div>
                                </div>
                                <Separator className="my-2"/>
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Average Rate:</span>
                                        <span className="font-medium">{formatRate(selectedSupplierData.averageRate)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Min Rate:</span>
                                        <span className="font-medium">{formatRate(selectedSupplierData.minRate || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Max Rate:</span>
                                        <span className="font-medium">{formatRate(selectedSupplierData.maxRate || 0)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Deduction Summary Card */}
                        <Card className="border border-gray-400/50">
                            <CardHeader className="pb-2 px-3 pt-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <FileText size={16} className="text-muted-foreground"/>
                                    Deduction Summary
                                </CardTitle>
                </CardHeader>
                            <CardContent className="space-y-2 px-3 pb-3 text-xs">
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Amount (@{formatRate(selectedSupplierData.averageRate)}/kg):</span>
                                        <span className="font-medium">{formatCurrency(selectedSupplierData.totalAmount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Karta (@{formatPercentage(selectedSupplierData.averageKartaPercentage)}):</span>
                                        <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(selectedSupplierData.totalKartaAmount || 0)}</span>
                        </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Laboury (@{formatDecimal(selectedSupplierData.averageLabouryRate)}):</span>
                                        <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(selectedSupplierData.totalLabouryAmount || 0)}</span>
                        </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Kanta:</span>
                                        <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(selectedSupplierData.totalKanta || 0)}</span>
                        </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Other:</span>
                                        <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(Math.min(Math.abs(selectedSupplierData.totalOtherCharges || 0), 1000000000))}</span>
                        </div>
                            </div>
                                <Separator className="my-2"/>
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Base Original Amount:</span>
                                        <span className="font-semibold text-primary">{formatCurrency(Math.abs(selectedSupplierData.totalOriginalAmount || 0))}</span>
                                    </div>
                                    {(() => {
                                        // Calculate total extra amount from Gov. payments
                                        const totalExtraAmount = (selectedSupplierData.allTransactions || []).reduce((sum, t) => {
                                            const extra = (t as any).extraAmount || 0;
                                            return sum + extra;
                                        }, 0);
                                        
                                        if (totalExtraAmount > 0) {
                                            const adjustedOriginal = (selectedSupplierData.totalOriginalAmount || 0) + totalExtraAmount;
                                            return (
                                                <>
                                                    <div className="flex justify-between pl-2">
                                                        <span className="text-muted-foreground text-[10px]">+ Extra Amount (Gov.):</span>
                                                        <span className="font-semibold text-green-600 text-[10px]">{formatCurrency(totalExtraAmount)}</span>
                                                    </div>
                                                    <div className="flex justify-between pt-1 border-t border-primary/20">
                                                        <span className="text-muted-foreground font-medium">Adjusted Original:</span>
                                                        <span className="font-bold text-primary">{formatCurrency(adjustedOriginal)}</span>
                                                    </div>
                                                </>
                                            );
                                        }
                                        return null;
                                    })()}
                            </div>
                </CardContent>
            </Card>

                        {/* Financial Summary Card */}
                        <Card className="border border-gray-400/50">
                            <CardHeader className="pb-2 px-3 pt-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Banknote size={16} className="text-muted-foreground"/>
                                    Financial Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 px-3 pb-3 text-xs">
                                {/* Original Amount Section */}
                                <div className="space-y-1.5 bg-primary/5 p-2 rounded-md border border-primary/20">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-medium">Base Original Amount:</span>
                                        <span className="font-semibold text-primary">{formatCurrency(selectedSupplierData.totalOriginalAmount || 0)}</span>
                                    </div>
                                    {(() => {
                                        // Calculate total extra amount from Gov. payments
                                        const totalExtraAmount = (selectedSupplierData.allTransactions || []).reduce((sum, t) => {
                                            const extra = (t as any).extraAmount || 0;
                                            return sum + extra;
                                        }, 0);
                                        
                                        if (totalExtraAmount > 0) {
                                            const adjustedOriginal = (selectedSupplierData.totalOriginalAmount || 0) + totalExtraAmount;
                                            return (
                                                <>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground text-[10px]">Extra Amount (Gov. Payment):</span>
                                                        <span className="font-semibold text-green-600">+ {formatCurrency(totalExtraAmount)}</span>
                                                    </div>
                                                    <Separator className="my-1"/>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-muted-foreground font-medium">Adjusted Original Amount:</span>
                                                        <span className="font-bold text-primary text-sm">{formatCurrency(adjustedOriginal)}</span>
                                                    </div>
                                                </>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>

                                {/* Payment Breakdown */}
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Paid:</span>
                                        <span className="font-medium text-green-600">{formatCurrency(selectedSupplierData.totalPaid || 0)}</span>
                                    </div>
                                    <div className="flex justify-between pl-4">
                                        <span className="text-muted-foreground text-[10px]">• Cash Paid:</span>
                                        <span className="font-medium text-green-500 text-[10px]">{formatCurrency(selectedSupplierData.totalCashPaid || 0)}</span>
                                    </div>
                                    <div className="flex justify-between pl-4">
                                        <span className="text-muted-foreground text-[10px]">• RTGS Paid:</span>
                                        <span className="font-medium text-green-500 text-[10px]">{formatCurrency(selectedSupplierData.totalRtgsPaid || 0)}</span>
                                    </div>
                                    {(() => {
                                        const govPaid = (selectedSupplierData.allPayments || [])
                                            .filter(p => (p as any).receiptType === 'Gov.')
                                            .reduce((sum, p) => {
                                                const paidForThis = p.paidFor?.find(pf => 
                                                    (selectedSupplierData.allTransactions || []).some(t => t.srNo === pf.srNo)
                                                );
                                                return sum + (paidForThis?.amount || 0);
                                            }, 0);
                                        if (govPaid > 0) {
                                            return (
                                                <div className="flex justify-between pl-4">
                                                    <span className="text-muted-foreground text-[10px]">• Gov. Paid:</span>
                                                    <span className="font-medium text-green-500 text-[10px]">{formatCurrency(govPaid)}</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total CD Granted:</span>
                                        <span className="font-medium text-blue-600">{formatCurrency(selectedSupplierData.totalCdAmount || 0)}</span>
                                    </div>
                                </div>
                                
                                <Separator className="my-2"/>
                                
                                {/* Transaction Stats */}
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Total Transactions:</span>
                                        <span className="font-medium">{selectedSupplierData.totalTransactions || 0} Entries</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Outstanding Entries:</span>
                                        <span className="font-medium text-red-500 dark:text-red-400">{selectedSupplierData.totalOutstandingTransactions || 0} Entries</span>
                                    </div>
                                </div>
                                
                                <Separator className="my-2"/>
                                
                                {/* Final Outstanding */}
                                <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded-md border border-red-200 dark:border-red-800">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground font-semibold">Final Outstanding:</span>
                                        <span className="font-bold text-red-600 dark:text-red-400 text-base">{formatCurrency(selectedSupplierData.totalOutstanding || 0)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                        <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Visual Overview</CardTitle>
                        <div className="w-48">
                            <Select value={selectedChart} onValueChange={(val: ChartType) => setSelectedChart(val)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select chart" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="financial">Financial Overview</SelectItem>
                                    <SelectItem value="variety">Transactions by Variety</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', fontSize: '12px', borderRadius: 'var(--radius)' }} formatter={(value: number, name: string) => selectedChart === 'financial' ? `${formatCurrency(value)}` : value} />
                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8">
                                    {chartData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} /> ))}
                                </Pie>
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                 <div className="grid grid-cols-1 gap-6 lg:col-span-2">
                    <Tabs defaultValue="outstanding" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-lg">
                            <TabsTrigger value="outstanding" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">Outstanding ({outstandingTransactions.length})</TabsTrigger>
                            <TabsTrigger value="running" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">Running ({runningTransactions.length})</TabsTrigger>
                            <TabsTrigger value="profitable" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">May Be Profitable ({profitableTransactions.length})</TabsTrigger>
                            <TabsTrigger value="paid" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">Paid ({paidTransactions.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="outstanding" className="mt-4 animate-in fade-in-50 duration-200">
                            <Card>
                                <CardContent className="p-0">
                                    <TransactionTable transactions={outstandingTransactions} onShowDetails={onShowDetails} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="running" className="mt-4 animate-in fade-in-50 duration-200">
                            <Card>
                                <CardContent className="p-0">
                                    <TransactionTable transactions={runningTransactions} onShowDetails={onShowDetails} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="profitable" className="mt-4 animate-in fade-in-50 duration-200">
                            <Card>
                                <CardContent className="p-0">
                                    <TransactionTable transactions={profitableTransactions} onShowDetails={onShowDetails} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="paid" className="mt-4 animate-in fade-in-50 duration-200">
                            <Card>
                                <CardContent className="p-0">
                                    <TransactionTable transactions={paidTransactions} onShowDetails={onShowDetails} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                     
                   <PaymentHistoryTable 
                      payments={currentPaymentHistory}
                      onShowPaymentDetails={onShowPaymentDetails}
                   />
                </div>
            </div>
        </div>
    );
};
