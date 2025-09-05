
"use client";

import React, { useState, useMemo } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment } from "@/lib/definitions";
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


export const StatementPreview = ({ data }: { data: CustomerSummary | null }) => {
    const statementRef = React.useRef<HTMLDivElement>(null);
    if (!data) return null;

    const transactions = useMemo(() => {
        const allTransactions = data.allTransactions || [];
        const allPayments = data.allPayments || [];
        
        const mappedTransactions = allTransactions.map(t => ({
            date: t.date,
            particulars: `Purchase (SR# ${t.srNo})`,
            debit: t.originalNetAmount || 0,
            credit: 0,
        }));
        
        const mappedPayments = allPayments.map(p => ({
            date: p.date,
            particulars: `Payment (ID# ${p.paymentId})`,
            debit: 0,
            credit: p.amount + (p.cdAmount || 0),
        }));

        const combined = [...mappedTransactions, ...mappedPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        return combined.map(item => {
            runningBalance += item.debit - item.credit;
            return { ...item, balance: runningBalance };
        });
    }, [data]);

    const totalDebit = transactions.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = transactions.reduce((sum, item) => sum + item.credit, 0);
    const closingBalance = totalDebit - totalCredit;

    const handlePrint = () => {
        const node = statementRef.current;
        if (!node) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;
        
        iframeDoc.open();
        iframeDoc.write(`
            <html>
                <head>
                    <title>Print Statement</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                        body { 
                            font-family: 'Inter', sans-serif;
                            margin: 0;
                        }
                        .summary-grid {
                            display: grid;
                            grid-template-columns: repeat(3, minmax(0, 1fr));
                            gap: 1.5rem;
                        }
                        @media print {
                            body { -webkit-print-color-adjust: economy; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                </body>
            </html>
        `);
        
        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const style = iframeDoc.createElement('style');
                style.textContent = Array.from(styleSheet.cssRules)
                    .map(rule => rule.cssText)
                    .join('');
                iframeDoc.head.appendChild(style);
            } catch (e) {
                console.warn('Could not copy stylesheet:', e);
            }
        });

        const printableContent = node.cloneNode(true) as HTMLElement;
        iframeDoc.body.appendChild(printableContent);
        
        const summaryGrid = iframeDoc.querySelector('.summary-grid-container');
        if(summaryGrid) {
            summaryGrid.className = 'summary-grid';
        }

        iframeDoc.close();

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
    };

    return (
    <>
        <DialogHeader className="p-4 sm:p-6 pb-0 no-print">
             <DialogTitle className="sr-only">Account Statement for {data.name}</DialogTitle>
             <DialogDescription className="sr-only">
             A detailed summary and transaction history for {data.name}.
             </DialogDescription>
        </DialogHeader>
        <div ref={statementRef} className="printable-statement bg-background p-4 sm:p-6 font-sans text-foreground">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start pb-4 border-b mb-4">
                <div className="mb-4 sm:mb-0">
                    <h2 className="text-xl font-bold">BizSuite DataFlow</h2>
                    <p className="text-xs text-muted-foreground">{toTitleCase(data.name)}</p>
                    <p className="text-xs text-muted-foreground">{toTitleCase(data.address || '')}</p>
                    <p className="text-xs text-muted-foreground">{data.contact}</p>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto">
                        <h1 className="text-2xl font-bold text-primary">Statement of Account</h1>
                        <div className="mt-2 text-sm w-full sm:w-80 border-t pt-1">
                        <div className="flex justify-between">
                            <span className="font-semibold">Statement Date:</span>
                            <span>{format(new Date(), 'dd-MMM-yyyy')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-semibold">Closing Balance:</span>
                            <span className="font-bold">{formatCurrency(data.totalOutstanding)}</span>
                        </div>
                        </div>
                </div>
            </div>

            {/* Summary Section */}
             <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="summary-grid-container grid grid-cols-1 md:grid-cols-3 gap-x-6">
                        {/* Operational Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-primary mb-2 text-base border-b pb-1">Operational</h3>
                             <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-muted-foreground">Gross Wt</td><td className="py-0.5 text-right font-semibold">{`${(data.totalGrossWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr><td className="py-0.5 text-muted-foreground">Teir Wt</td><td className="py-0.5 text-right font-semibold">{`${(data.totalTeirWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr className="font-bold border-t"><td className="py-1">Final Wt</td><td className="py-1 text-right font-semibold">{`${(data.totalFinalWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr><td className="py-0.5 text-muted-foreground">Karta Wt</td><td className="py-0.5 text-right font-semibold">{`${(data.totalKartaWeight || 0).toFixed(2)} kg`}</td></tr>
                                <tr className="font-bold text-primary border-t"><td className="py-1">Net Wt</td><td className="py-1 text-right">{`${(data.totalNetWeight || 0).toFixed(2)} kg`}</td></tr>
                            </tbody></table>
                        </div>
                        {/* Deduction Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-primary mb-2 text-base border-b pb-1">Deductions</h3>
                            <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-muted-foreground">Total Amount</td><td className="py-0.5 text-right font-semibold">{`${formatCurrency(data.totalAmount || 0)}`}</td></tr>
                                <tr className="border-t"><td className="py-0.5 text-muted-foreground">Karta</td><td className="py-0.5 text-right font-semibold">{`- ${formatCurrency(data.totalKartaAmount || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-muted-foreground">Laboury</td><td className="py-0.5 text-right font-semibold">{`- ${formatCurrency(data.totalLabouryAmount || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-muted-foreground">Kanta</td><td className="py-0.5 text-right font-semibold">{`- ${formatCurrency(data.totalKanta || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-muted-foreground">Other</td><td className="py-0.5 text-right font-semibold">{`- ${formatCurrency(data.totalOtherCharges || 0)}`}</td></tr>
                                <tr className="font-bold text-primary border-t"><td className="py-1">Original Amount</td><td className="py-1 text-right">{formatCurrency(data.totalOriginalAmount || 0)}</td></tr>
                            </tbody></table>
                        </div>
                        {/* Financial Summary */}
                        <div className="text-sm">
                            <h3 className="font-semibold text-primary mb-2 text-base border-b pb-1">Financial</h3>
                            <table className="w-full"><tbody>
                                <tr><td className="py-0.5 text-muted-foreground">Original Purchases</td><td className="py-0.5 text-right font-semibold">{formatCurrency(data.totalOriginalAmount || 0)}</td></tr>
                                <tr className="border-t"><td className="py-0.5 text-muted-foreground">Total Paid</td><td className="py-0.5 text-right font-semibold text-green-600">{`${formatCurrency(data.totalPaid || 0)}`}</td></tr>
                                <tr><td className="py-0.5 text-muted-foreground">Total CD Granted</td><td className="py-0.5 text-right font-semibold">{`${formatCurrency(data.totalCdAmount || 0)}`}</td></tr>
                                <tr className="font-bold text-destructive border-t"><td className="py-1">Outstanding Balance</td><td className="py-1 text-right">{`${formatCurrency(data.totalOutstanding)}`}</td></tr>
                            </tbody></table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transaction Table */}
            <div>
                <h2 className="text-lg font-semibold border-b pb-1 mb-2">TRANSACTIONS</h2>
                <div className="overflow-x-auto border rounded-lg">
                    <Table className="print-table min-w-full">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="py-2 px-3">Date</TableHead>
                                <TableHead className="py-2 px-3">Particulars</TableHead>
                                <TableHead className="text-right py-2 px-3">Debit</TableHead>
                                <TableHead className="text-right py-2 px-3">Credit</TableHead>
                                <TableHead className="text-right py-2 px-3">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={4} className="font-semibold py-2 px-3">Opening Balance</TableCell>
                                <TableCell className="text-right font-semibold font-mono py-2 px-3">{formatCurrency(0)}</TableCell>
                            </TableRow>
                            {transactions.map((item, index) => (
                                <TableRow key={index} className="[&_td]:py-2 [&_td]:px-3">
                                    <TableCell>{format(new Date(item.date), "dd-MMM-yy")}</TableCell>
                                    <TableCell>{item.particulars}</TableCell>
                                    <TableCell className="text-right font-mono">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(item.balance)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-muted/50 font-bold">
                                <TableCell colSpan={2} className="py-2 px-3">Closing Balance</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3">{formatCurrency(closingBalance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>

             {/* Reminder Section */}
            <div className="mt-6">
                    <h2 className="text-lg font-semibold border-b pb-1 mb-2">REMINDER</h2>
                    <div className="border rounded-lg p-4 min-h-[80px] text-sm text-muted-foreground">
                    Payment is due by the date specified.
                    </div>
            </div>
        </div>
        <DialogFooter className="p-4 border-t no-print">
            <Button variant="outline" onClick={() => (document.querySelector('[data-state="open"] [aria-label="Close"]') as HTMLElement)?.click()}>Close</Button>
            <div className="flex-grow" />
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/> Print</Button>
            <Button onClick={handlePrint}><Download className="mr-2 h-4 w-4"/> Download PDF</Button>
        </DialogFooter>
    </>
    );
};

export const SupplierProfileView = ({
    selectedSupplierData,
    isMillSelected,
    onShowDetails,
    onShowPaymentDetails,
    onGenerateStatement
}: {
    selectedSupplierData: CustomerSummary | null;
    isMillSelected: boolean;
    onShowDetails: (supplier: Supplier) => void;
    onShowPaymentDetails: (payment: Payment) => void;
    onGenerateStatement: () => void;
}) => {
    const [selectedChart, setSelectedChart] = useState<ChartType>('financial');

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

    if (!selectedSupplierData) {
        return (
            <Card className="flex items-center justify-center h-64">
                <CardContent className="text-center text-muted-foreground">
                    <p>Please select a profile to view details.</p>
                </CardContent>
            </Card>
        )
    }

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
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Scale size={16}/> Operational Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Gross Wt</span><span className="font-semibold">{`${(selectedSupplierData.totalGrossWeight || 0).toFixed(2)} kg`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Teir Wt</span><span className="font-semibold">{`${(selectedSupplierData.totalTeirWeight || 0).toFixed(2)} kg`}</span></div>
                            <div className="flex justify-between font-bold"><span>Final Wt</span><span className="font-semibold">{`${(selectedSupplierData.totalFinalWeight || 0).toFixed(2)} kg`}</span></div>
                             <div className="flex justify-between"><span className="text-muted-foreground">Karta Wt <span className="text-xs">{`(@${(selectedSupplierData.averageKartaPercentage || 0).toFixed(2)}%)`}</span></span><span className="font-semibold">{`${(selectedSupplierData.totalKartaWeight || 0).toFixed(2)} kg`}</span></div>
                             <div className="flex justify-between font-bold text-primary"><span>Net Wt</span><span>{`${(selectedSupplierData.totalNetWeight || 0).toFixed(2)} kg`}</span></div>
                            <Separator className="my-2"/>
                            <div className="flex justify-between"><span className="text-muted-foreground">Average Rate</span><span className="font-semibold">{formatCurrency(selectedSupplierData.averageRate || 0)}</span></div>
                            <Separator className="my-2"/>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Transactions</span><span className="font-semibold">{`${selectedSupplierData.totalTransactions} Entries`}</span></div>
                             <div className="flex justify-between font-bold text-destructive"><span>Outstanding Entries</span><span>{`${selectedSupplierData.totalOutstandingTransactions} Entries`}</span></div>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader className="p-4 pb-2">
                             <CardTitle className="text-base flex items-center gap-2"><FileText size={16}/> Deduction Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Amount <span className="text-xs">{`(@${formatCurrency(selectedSupplierData.averageRate || 0)}/kg)`}</span></span><span className="font-semibold">{`${formatCurrency(selectedSupplierData.totalAmount || 0)}`}</span></div>
                             <Separator className="my-2"/>
                             <div className="flex justify-between"><span className="text-muted-foreground">Total Karta <span className="text-xs">{`(@${(selectedSupplierData.averageKartaPercentage || 0).toFixed(2)}%)`}</span></span><span className="font-semibold">{`- ${formatCurrency(selectedSupplierData.totalKartaAmount || 0)}`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Laboury <span className="text-xs">{`(@${(selectedSupplierData.averageLabouryRate || 0).toFixed(2)})`}</span></span><span className="font-semibold">{`- ${formatCurrency(selectedSupplierData.totalLabouryAmount || 0)}`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Kanta</span><span className="font-semibold">{`- ${formatCurrency(selectedSupplierData.totalKanta || 0)}`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Other</span><span className="font-semibold">{`- ${formatCurrency(selectedSupplierData.totalOtherCharges || 0)}`}</span></div>
                             <Separator className="my-2"/>
                            <div className="flex justify-between items-center text-base pt-1">
                                <p className="font-semibold text-muted-foreground">Total Original Amount</p>
                                <p className="font-bold text-lg text-primary">{`${formatCurrency(selectedSupplierData.totalOriginalAmount || 0)}`}</p>
                            </div>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Banknote size={16}/> Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Original Amount <span className="text-xs">{`(Avg: ${formatCurrency(selectedSupplierData.averageOriginalPrice || 0)}/kg)`}</span></span><span className="font-semibold">{formatCurrency(selectedSupplierData.totalOriginalAmount || 0)}</span></div>
                             <Separator className="my-2"/>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Paid</span><span className="font-semibold text-green-600">{`${formatCurrency(selectedSupplierData.totalPaid || 0)}`}</span></div>
                             <div className="flex justify-between"><span className="text-muted-foreground">Total CD Granted</span><span className="font-semibold">{`${formatCurrency(selectedSupplierData.totalCdAmount || 0)}`}</span></div>
                             <Separator className="my-2"/>
                             <div className="flex justify-between items-center text-base pt-1">
                                <p className="font-semibold text-muted-foreground">Outstanding</p>
                                <p className="font-bold text-lg text-destructive">{`${formatCurrency(selectedSupplierData.totalOutstanding)}`}</p>
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
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
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', fontSize: '12px', borderRadius: 'var(--radius)' }} formatter={(value: number, name: string) => selectedChart === 'financial' ? `${formatCurrency(value)}` : value} />
                            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8">
                                {chartData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} /> ))}
                            </Pie>
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <div className="grid grid-cols-1 gap-6">
                  <Card>
                      <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
                      <CardContent>
                          <ScrollArea className="h-[14rem]">
                            <div className="overflow-x-auto">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>SR No</TableHead>
                                          <TableHead>Amount</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead className="text-right">Actions</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {(selectedSupplierData.allTransactions || []).map(entry => (
                                          <TableRow key={entry.id}>
                                              <TableCell className="font-mono">{entry.srNo}</TableCell>
                                              <TableCell className="font-semibold">{formatCurrency(parseFloat(String(entry.originalNetAmount || entry.amount)))}</TableCell>
                                              <TableCell>
                                                  <Badge variant={parseFloat(String(entry.netAmount)) < 1 ? "secondary" : "destructive"}>
                                                  {parseFloat(String(entry.netAmount)) < 1 ? "Paid" : "Outstanding"}
                                                  </Badge>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(entry)}>
                                                      <Info className="h-4 w-4" />
                                                  </Button>
                                              </TableCell>
                                          </TableRow>
                                      ))}
                                      {(selectedSupplierData.allTransactions || []).length === 0 && (
                                          <TableRow>
                                              <TableCell colSpan={4} className="text-center text-muted-foreground">No transactions found.</TableCell>
                                          </TableRow>
                                      )}
                                  </TableBody>
                              </Table>
                            </div>
                          </ScrollArea>
                      </CardContent>
                  </Card>
                   <Card>
                      <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
                      <CardContent>
                          <ScrollArea className="h-[14rem]">
                             <div className="overflow-x-auto">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>ID</TableHead>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Paid For (SR No.)</TableHead>
                                          <TableHead className="text-right">Amount</TableHead>
                                          <TableHead className="text-right">Actions</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {currentPaymentHistory.map(payment => (
                                          <TableRow key={payment.id}>
                                              <TableCell className="font-mono">{payment.paymentId}</TableCell>
                                              <TableCell>{format(new Date(payment.date), "PPP")}</TableCell>
                                              <TableCell className="text-xs">{(payment.paidFor || []).map(p => p.srNo).join(', ')}</TableCell>
                                              <TableCell className="font-semibold text-right">{formatCurrency(payment.amount)}</TableCell>
                                               <TableCell className="text-right">
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
