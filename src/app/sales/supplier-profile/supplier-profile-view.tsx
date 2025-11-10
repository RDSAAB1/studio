
"use client";

import React, { useState, useMemo, useRef } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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

const TransactionTable = ({ transactions, onShowDetails }: { transactions: Supplier[], onShowDetails: (supplier: Supplier) => void }) => (
    <ScrollArea className="h-[14rem]">
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
                    {transactions.map(entry => (
                        <TableRow key={entry.id}>
                            <TableCell className="font-mono text-xs w-[60px]">{entry.srNo}</TableCell>
                            <TableCell className="text-xs w-[100px]">{formatCurrency(parseFloat(String(entry.originalNetAmount)))}</TableCell>
                            <TableCell className="text-xs text-green-600 w-[80px]">{formatCurrency(entry.totalPaid || 0)}</TableCell>
                            <TableCell className="text-xs text-blue-600 w-[60px]">{formatCurrency(entry.totalCd || 0)}</TableCell>
                            <TableCell className="text-xs font-semibold text-red-600 w-[100px]">{formatCurrency(parseFloat(String(entry.netAmount)))}</TableCell>
                            <TableCell className="text-right w-[60px]">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onShowDetails(entry)}>
                                    <Info className="h-3 w-3" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
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
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                        <div>
                            <CardTitle>{toTitleCase(selectedSupplierData.name)}</CardTitle>
                            <CardDescription>
                                {isMillSelected ? "A complete financial and transactional overview of the entire business." : `S/O: ${toTitleCase(selectedSupplierData.so || '')} | Contact: ${selectedSupplierData.contact}`}
                            </CardDescription>
                        </div>
                        <Button onClick={onGenerateStatement} size="sm">Generate Statement</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Scale size={16}/>
                            <h4 className="text-sm font-semibold uppercase tracking-wide">Operational Snapshot</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <SummaryTile label="Gross Weight" value={formatWeight(selectedSupplierData.totalGrossWeight)} hint="Aggregate arrival weight"/>
                            <SummaryTile label="Teir Weight" value={formatWeight(selectedSupplierData.totalTeirWeight)} hint="Packaging / tare deduction"/>
                            <SummaryTile label="Net Weight" value={formatWeight(selectedSupplierData.totalNetWeight)} hint="Payable weight after adjustments" tone="text-primary"/>
                            <SummaryTile label="Final Weight" value={formatWeight(selectedSupplierData.totalFinalWeight)} hint="Recorded closing weight"/>
                            <SummaryTile label="Karta Weight" value={formatWeight(selectedSupplierData.totalKartaWeight)} hint={`Applied at ${formatPercentage(selectedSupplierData.averageKartaPercentage)}`}/>
                            <SummaryTile label="Average Rate" value={formatRate(selectedSupplierData.averageRate)} hint={`Range ${formatCurrency(selectedSupplierData.minRate || 0)} - ${formatCurrency(selectedSupplierData.maxRate || 0)}`}/>
                            <SummaryTile label="Total Transactions" value={`${selectedSupplierData.totalTransactions}`} hint="Entries captured for this supplier"/>
                            <SummaryTile label="Outstanding Entries" value={`${selectedSupplierData.totalOutstandingTransactions}`} hint="Pending against this profile" tone="text-destructive"/>
                        </div>
                    </section>
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText size={16}/>
                            <h4 className="text-sm font-semibold uppercase tracking-wide">Deduction Overview</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <SummaryTile label="Gross Amount" value={formatCurrency(selectedSupplierData.totalAmount || 0)} hint={`Computed @ ${formatRate(selectedSupplierData.averageRate)} per kg`}/>
                            <SummaryTile label="Karta Charges" value={`- ${formatCurrency(selectedSupplierData.totalKartaAmount || 0)}`} hint={`Applied at ${formatPercentage(selectedSupplierData.averageKartaPercentage)}`}/>
                            <SummaryTile label="Laboury Charges" value={`- ${formatCurrency(selectedSupplierData.totalLabouryAmount || 0)}`} hint={`Average ${formatDecimal(selectedSupplierData.averageLabouryRate)} per kg`}/>
                            <SummaryTile label="Kanta & Others" value={`- ${formatCurrency((selectedSupplierData.totalKanta || 0) + (selectedSupplierData.totalBrokerage || 0))}`} hint="Includes weighing & brokerage adjustments"/>
                        </div>
                    </section>
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Banknote size={16}/>
                            <h4 className="text-sm font-semibold uppercase tracking-wide">Financial Highlights</h4>
                            </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <SummaryTile label="Net Payable" value={formatCurrency(selectedSupplierData.totalOriginalAmount || 0)} hint="After all deductions" tone="text-primary"/>
                            <SummaryTile label="Cash Settled" value={formatCurrency(selectedSupplierData.totalCashPaid || 0)} hint="Direct cash disbursements"/>
                            <SummaryTile label="RTGS Settled" value={formatCurrency(selectedSupplierData.totalRtgsPaid || 0)} hint="Bank transfers completed"/>
                            <SummaryTile label="Cash Discount Granted" value={formatCurrency(selectedSupplierData.totalCdAmount || 0)} hint="Approved CD for this profile"/>
                            <SummaryTile label="Outstanding Balance" value={formatCurrency(selectedSupplierData.totalOutstanding)} hint="Yet to be cleared" tone="text-destructive"/>
                            </div>
                    </section>
                </CardContent>
            </Card>

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
                     
                   <Card>
                      <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
                      <CardContent>
                          <ScrollArea className="h-[14rem]">
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
                                      {currentPaymentHistory.map((payment, index) => (
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
                                       {currentPaymentHistory.length === 0 && (
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
                </div>
            </div>
        </div>
    );
};
