// src/app/sales/supplier-profile/supplier-profile-client.tsx

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { Badge } from "@/components/ui/badge"; // <-- THE MISSING IMPORT IS NOW ADDED
import { DetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";

// Icons
import { Users, Calendar as CalendarIcon, Download, Printer, Info, Scale, FileText, Banknote } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MILL_OVERVIEW_KEY = 'mill-overview';
const PIE_CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
type ChartType = 'financial' | 'variety';


// --- Sub-component 1: The Statement Preview ---
const StatementPreview = ({ data }: { data: CustomerSummary | null }) => {
    const { toast } = useToast();
    const statementRef = React.useRef<HTMLDivElement>(null);

    if (!data) return null;

    const transactions = useMemo(() => {
        const allTransactions = data.allTransactions || [];
        const allPayments = data.allPayments || [];
        
        const mappedTransactions = allTransactions.map(t => ({
            date: t.date,
            particulars: `Purchase (SR# ${t.srNo})`,
            debit: parseFloat(String(t.originalNetAmount)) || 0,
            credit: 0,
        }));
        
        const mappedPayments = allPayments.map(p => ({
            date: p.date,
            particulars: `Payment (ID# ${p.paymentId})`,
            debit: 0,
            credit: (p.amount || 0) + (p.cdAmount || 0),
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
        if (!node) {
            toast({ title: 'Error', description: 'Could not find printable content.', variant: 'destructive'});
            return;
        }

        const newWindow = window.open('', '', 'height=800,width=1200');
        if (newWindow) {
            const document = newWindow.document;
            document.write(`
                <html>
                    <head>
                        <title>Print Statement for ${data.name}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            .no-print { display: none; }
                             @media print {
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                .summary-grid-container { display: flex !important; flex-wrap: nowrap !important; gap: 1rem; }
                                .summary-grid-container > div { flex: 1; }
                             }
                        </style>
                    </head>
                    <body>
                    </body>
                </html>
            `);

            document.body.innerHTML = node.innerHTML;
            
            setTimeout(() => {
                newWindow.focus();
                newWindow.print();
                newWindow.close();
            }, 500);
        } else {
            toast({ title: 'Print Error', description: 'Please allow pop-ups for this site to print.', variant: 'destructive'});
        }
    };
    
    return (
    <>
        <DialogHeader className="p-4 sm:p-6 pb-0 no-print">
             <DialogTitle>Account Statement for {data.name}</DialogTitle>
             <DialogDescription className="sr-only">A detailed summary and transaction history for {data.name}.</DialogDescription>
        </DialogHeader>
        <div ref={statementRef} className="printable-area bg-white p-4 sm:p-6 font-sans text-black">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b border-gray-300 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-black">BizSuite DataFlow</h2>
                    <p className="text-xs text-gray-600">{toTitleCase(data.name)}</p>
                    <p className="text-xs text-gray-600">{toTitleCase(data.address || '')}</p>
                    <p className="text-xs text-gray-600">{data.contact}</p>
                </div>
                <div className="text-right">
                        <h1 className="text-2xl font-bold text-black">Statement of Account</h1>
                        <div className="mt-2 text-sm">
                        <div className="flex justify-between"><span className="font-semibold text-black">Statement Date:</span> <span>{format(new Date(), 'dd-MMM-yyyy')}</span></div>
                        <div className="flex justify-between"><span className="font-semibold text-black">Closing Balance:</span> <span className="font-bold">{formatCurrency(data.totalOutstanding)}</span></div>
                        </div>
                </div>
            </div>

            {/* Transaction Table */}
            <div>
                <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2 text-black">TRANSACTIONS</h2>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <Table className="print-table min-w-full">
                        <TableHeader>
                            <TableRow className="bg-gray-100">
                                <TableHead className="py-2 px-3 text-black">Date</TableHead>
                                <TableHead className="py-2 px-3 text-black">Particulars</TableHead>
                                <TableHead className="text-right py-2 px-3 text-black">Debit</TableHead>
                                <TableHead className="text-right py-2 px-3 text-black">Credit</TableHead>
                                <TableHead className="text-right py-2 px-3 text-black">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={4} className="font-semibold py-2 px-3 text-black">Opening Balance</TableCell>
                                <TableCell className="text-right font-semibold font-mono py-2 px-3 text-black">{formatCurrency(0)}</TableCell>
                            </TableRow>
                            {transactions.map((item, index) => (
                                <TableRow key={index} className="[&_td]:py-2 [&_td]:px-3">
                                    <TableCell className="text-black">{format(new Date(item.date), "dd-MMM-yy")}</TableCell>
                                    <TableCell className="text-black">{item.particulars}</TableCell>
                                    <TableCell className="text-right font-mono text-black">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono text-black">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                    <TableCell className="text-right font-mono text-black">{formatCurrency(item.balance)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={2} className="py-2 px-3 text-black">Closing Balance</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-black">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-black">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell className="text-right font-mono py-2 px-3 text-black">{formatCurrency(closingBalance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>
        </div>
        <DialogFooter className="p-4 border-t no-print">
            <Button variant="outline" asChild><DialogDescription asChild><Button variant="outline">Close</Button></DialogDescription></Button>
            <div className="flex-grow" />
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/> Print</Button>
            <Button onClick={handlePrint}><Download className="mr-2 h-4 w-4"/> Download PDF</Button>
        </DialogFooter>
    </>
    );
};


// --- Sub-component 2: The Profile View ---
const SupplierProfileView = ({
    selectedSupplierData,
    isMillSelected,
    onShowDetails,
    onShowPaymentDetails,
    onGenerateStatement
}: {
    selectedSupplierData: CustomerSummary | null;
    isMillSelected: boolean;
    onShowDetails: (supplier: Supplier) => void;
    onShowPaymentDetails: (payment: Payment | CustomerPayment) => void;
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

    const currentPaymentHistory = useMemo<(Payment | CustomerPayment)[]>(() => {
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
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2"><Scale size={16}/> Operational Summary</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Gross Wt</span><span className="font-semibold">{`${(parseFloat(String(selectedSupplierData.totalGrossWeight)) || 0).toFixed(2)} kg`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Teir Wt</span><span className="font-semibold">{`${(parseFloat(String(selectedSupplierData.totalTeirWeight)) || 0).toFixed(2)} kg`}</span></div>
                            <div className="flex justify-between font-bold"><span>Final Wt</span><span className="font-semibold">{`${(parseFloat(String(selectedSupplierData.totalFinalWeight)) || 0).toFixed(2)} kg`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Karta Wt <span className="text-xs">{`(@${(parseFloat(String(selectedSupplierData.averageKartaPercentage)) || 0).toFixed(2)}%)`}</span></span><span className="font-semibold">{`${(parseFloat(String(selectedSupplierData.totalKartaWeight)) || 0).toFixed(2)} kg`}</span></div>
                            <div className="flex justify-between font-bold text-primary"><span>Net Wt</span><span>{`${(parseFloat(String(selectedSupplierData.totalNetWeight)) || 0).toFixed(2)} kg`}</span></div>
                            <Separator className="my-2"/>
                            <div className="flex justify-between"><span className="text-muted-foreground">Average Rate</span><span className="font-semibold">{formatCurrency(selectedSupplierData.averageRate || 0)}</span></div>
                            <Separator className="my-2"/>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Transactions</span><span className="font-semibold">{`${selectedSupplierData.totalTransactions} Entries`}</span></div>
                            <div className="flex justify-between font-bold text-destructive"><span>Outstanding Entries</span><span>{`${selectedSupplierData.totalOutstandingTransactions} Entries`}</span></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText size={16}/> Deduction Summary</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Amount <span className="text-xs">{`(@${formatCurrency(selectedSupplierData.averageRate || 0)}/kg)`}</span></span><span className="font-semibold">{`${formatCurrency(selectedSupplierData.totalAmount || 0)}`}</span></div>
                            <Separator className="my-2"/>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Karta <span className="text-xs">{`(@${(parseFloat(String(selectedSupplierData.averageKartaPercentage)) || 0).toFixed(2)}%)`}</span></span><span className="font-semibold">{`- ${formatCurrency(selectedSupplierData.totalKartaAmount || 0)}`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Laboury <span className="text-xs">{`(@${(parseFloat(String(selectedSupplierData.averageLabouryRate)) || 0).toFixed(2)})`}</span></span><span className="font-semibold">{`- ${formatCurrency(selectedSupplierData.totalLabouryAmount || 0)}`}</span></div>
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
                        <CardHeader className="p-4 pb-2"><CardTitle className="text-base flex items-center gap-2"><Banknote size={16}/> Financial Summary</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Total Net Payable <span className="text-xs">{`(Avg: ${formatCurrency(selectedSupplierData.averageOriginalPrice || 0)}/kg)`}</span></span><span className="font-semibold">{formatCurrency(selectedSupplierData.totalOriginalAmount || 0)}</span></div>
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
                            <CustomDropdown
                                value={selectedChart}
                                onChange={(val) => setSelectedChart(val as ChartType)}
                                options={[
                                    { value: 'financial', label: 'Financial Overview' },
                                    { value: 'variety', label: 'Transactions by Variety' }
                                ]}
                                placeholder="Select chart"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', fontSize: '12px', borderRadius: 'var(--radius)' }} formatter={(value: number) => typeof value === 'number' ? formatCurrency(value) : value} />
                            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8">
                                {chartData.map((_entry, index) => ( <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} /> ))}
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
                                                <TableCell className="font-semibold">{formatCurrency(parseFloat(String(entry.originalNetAmount)))}</TableCell>
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
                            </ScrollArea>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[14rem]">
                               <Table>
                                   <TableHeader>
                                       <TableRow>
                                           <TableHead>ID</TableHead>
                                           <TableHead>Date</TableHead>
                                           <TableHead>Paid For</TableHead>
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
                            </ScrollArea>
                        </CardContent>
                    </Card>
                 </div>
            </div>
        </div>
    );
};

// --- Main Component: The Page Controller ---
export const SupplierProfileClient = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [selectedSupplierKey, setSelectedSupplierKey] = useState<string>(MILL_OVERVIEW_KEY);
    
    const [detailsCustomer, setDetailsCustomer] = useState<Supplier | null>(null);
    const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | CustomerPayment | null>(null);
    const [isStatementOpen, setIsStatementOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    useEffect(() => {
        setLoading(true);
        const unsubscribeSuppliers = onSnapshot(collection(db, "suppliers"), 
            (snapshot) => {
                const fetchedSuppliers: Supplier[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
                setSuppliers(fetchedSuppliers);
                setLoading(false);
            }, 
            (error) => { console.error("Firestore Error (Suppliers):", error); setLoading(false); }
        );

        const unsubscribePayments = onSnapshot(collection(db, "payments"), 
            (snapshot) => {
                const fetchedPayments: Payment[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
                setPaymentHistory(fetchedPayments);
            },
            (error) => { console.error("Firestore Error (Payments):", error); }
        );

        return () => { unsubscribeSuppliers(); unsubscribePayments(); };
    }, []);

    const filteredData = useMemo(() => {
        const start = startDate ? new Date(startDate.setHours(0, 0, 0, 0)) : null;
        const end = endDate ? new Date(endDate.setHours(23, 59, 59, 999)) : null;
    
        const filterByDate = (date: Date) => {
            if (start && end) return date >= start && date <= end;
            if (start) return date >= start;
            if (end) return date <= end;
            return true;
        };
    
        const filteredSuppliers = suppliers.filter(s => filterByDate(new Date(s.date)));
        const filteredPayments = paymentHistory.filter(p => filterByDate(new Date(p.date)));
    
        return { filteredSuppliers, filteredPayments };
    }, [suppliers, paymentHistory, startDate, endDate]);

    const supplierSummaryMap = useMemo(() => {
        const { filteredSuppliers, filteredPayments } = filteredData;
        const summary = new Map<string, CustomerSummary>();

        // Initialize map with all unique suppliers
        filteredSuppliers.forEach(s => {
            if (s.customerId && !summary.has(s.customerId)) {
                summary.set(s.customerId, {
                    name: s.name, contact: s.contact, so: s.so, address: s.address,
                    acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                    totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
                    paymentHistory: [], allTransactions: [], allPayments: [], transactionsByVariety: {},
                    totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0,
                    totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0,
                    totalOtherCharges: 0, totalCdAmount: 0, averageRate: 0, averageOriginalPrice: 0,
                    totalTransactions: 0, totalOutstandingTransactions: 0, averageKartaPercentage: 0,
                    averageLabouryRate: 0, totalDeductions: 0,
                });
            }
        });

        // Process transactions
        filteredSuppliers.forEach(s => {
            if (!s.customerId) return;
            const data = summary.get(s.customerId)!;
            data.totalAmount += s.amount || 0;
            data.totalOriginalAmount += s.originalNetAmount || 0;
            data.totalGrossWeight! += s.grossWeight;
            data.totalTeirWeight! += s.teirWeight;
            data.totalFinalWeight! += s.weight;
            data.totalKartaWeight! += s.kartaWeight;
            data.totalNetWeight! += s.netWeight;
            data.totalKartaAmount! += s.kartaAmount;
            data.totalLabouryAmount! += s.labouryAmount;
            data.totalKanta! += s.kanta;
            data.totalOtherCharges! += s.otherCharges || 0;
            data.totalTransactions! += 1;
            data.allTransactions!.push(s);
            const variety = toTitleCase(s.variety) || 'Unknown';
            data.transactionsByVariety![variety] = (data.transactionsByVariety![variety] || 0) + 1;
        });

        // Process payments
        filteredPayments.forEach(p => {
            if (p.customerId && summary.has(p.customerId)) {
                const data = summary.get(p.customerId)!;
                data.totalPaid += p.amount;
                data.totalCdAmount! += (p.cdAmount || 0);
                data.paymentHistory.push(p);
                data.allPayments!.push(p);
            }
        });

        // Final calculations for each supplier
        summary.forEach(data => {
            data.totalOutstanding = data.totalOriginalAmount - data.totalPaid - data.totalCdAmount!;
            data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => parseFloat(String(t.netAmount)) >= 1).length;
            data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
            data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
            const rateData = (data.allTransactions || []).reduce((acc, t) => {
                if (t.rate > 0) {
                    acc.karta += t.kartaPercentage;
                    acc.laboury += t.labouryRate;
                    acc.count++;
                }
                return acc;
            }, { karta: 0, laboury: 0, count: 0 });
            if (rateData.count > 0) {
                data.averageKartaPercentage = rateData.karta / rateData.count;
                data.averageLabouryRate = rateData.laboury / rateData.count;
            }
        });

        const millSummary: CustomerSummary = Array.from(summary.values()).reduce((acc, s) => {
             acc.totalAmount += s.totalAmount;
             acc.totalOriginalAmount += s.totalOriginalAmount;
             acc.totalPaid += s.totalPaid;
             acc.totalGrossWeight! += s.totalGrossWeight!;
             acc.totalTeirWeight! += s.totalTeirWeight!;
             acc.totalFinalWeight! += s.totalFinalWeight!;
             acc.totalKartaWeight! += s.totalKartaWeight!;
             acc.totalNetWeight! += s.totalNetWeight!;
             acc.totalKartaAmount! += s.totalKartaAmount!;
             acc.totalLabouryAmount! += s.totalLabouryAmount!;
             acc.totalKanta! += s.totalKanta!;
             acc.totalOtherCharges! += s.totalOtherCharges!;
             acc.totalCdAmount! += s.totalCdAmount!;
             return acc;
         }, {
             name: 'Mill (Total Overview)', contact: '', totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
             paymentHistory: [], allTransactions: filteredSuppliers, allPayments: filteredPayments, transactionsByVariety: {},
             totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
             totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0,
             averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, 
             averageKartaPercentage: 0, averageLabouryRate: 0, totalDeductions: 0
         });
         
        millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid - millSummary.totalCdAmount!;
        millSummary.totalTransactions = filteredSuppliers.length;
        millSummary.totalOutstandingTransactions = filteredSuppliers.filter(c => parseFloat(String(c.netAmount)) >= 1).length;
        millSummary.averageRate = millSummary.totalFinalWeight! > 0 ? millSummary.totalAmount / millSummary.totalFinalWeight! : 0;
        millSummary.averageOriginalPrice = millSummary.totalNetWeight! > 0 ? millSummary.totalOriginalAmount / millSummary.totalNetWeight! : 0;
        const totalRateData = filteredSuppliers.reduce((acc, s) => {
             if(s.rate > 0) { acc.karta += s.kartaPercentage; acc.laboury += s.labouryRate; acc.count++; }
             return acc;
         }, { karta: 0, laboury: 0, count: 0 });
        if(totalRateData.count > 0) {
             millSummary.averageKartaPercentage = totalRateData.karta / totalRateData.count;
             millSummary.averageLabouryRate = totalRateData.laboury / totalRateData.count;
        }
        millSummary.transactionsByVariety = filteredSuppliers.reduce((acc, s) => {
             const variety = toTitleCase(s.variety) || 'Unknown';
             acc[variety] = (acc[variety] || 0) + 1;
             return acc;
         }, {} as {[key: string]: number});
         
        const finalSummaryMap = new Map<string, CustomerSummary>();
        finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);
        summary.forEach((value, key) => finalSummaryMap.set(key, value));

        return finalSummaryMap;
    }, [filteredData]);

    const selectedSupplierData = supplierSummaryMap.get(selectedSupplierKey);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><p>Loading Profiles...</p></div>;
    }

    return (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold">Select Profile</h3>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <Popover>
                        <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal h-9", !startDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(startDate, "PPP") : <span>Start Date</span>}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal h-9", !endDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{endDate ? format(endDate, "PPP") : <span>End Date</span>}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus /></PopoverContent>
                    </Popover>
                    <div className="w-full sm:w-[300px]">
                        <CustomDropdown
                            options={Array.from(supplierSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} ${data.contact ? `(${data.contact})` : ''}`.trim() }))}
                            value={selectedSupplierKey}
                            onChange={(value) => setSelectedSupplierKey(value as string)}
                            placeholder="Search and select profile..."
                        />
                    </div>
                </div>
            </CardContent>
          </Card>

          <SupplierProfileView 
            selectedSupplierData={selectedSupplierData || null}
            isMillSelected={selectedSupplierKey === MILL_OVERVIEW_KEY}
            onShowDetails={setDetailsCustomer}
            onShowPaymentDetails={setSelectedPaymentForDetails}
            onGenerateStatement={() => setIsStatementOpen(true)}
          />

          <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
            <DialogContent className="max-w-5xl p-0">
                <ScrollArea className="max-h-[90vh]">
                    <StatementPreview data={selectedSupplierData || null} />
                </ScrollArea>
            </DialogContent>
          </Dialog>
          
          <DetailsDialog 
              isOpen={!!detailsCustomer}
              onOpenChange={(open) => !open && setDetailsCustomer(null)}
              customer={detailsCustomer}
              paymentHistory={paymentHistory}
          />
          
          <PaymentDetailsDialog
              payment={selectedPaymentForDetails}
              suppliers={suppliers}
              onOpenChange={() => setSelectedPaymentForDetails(null)}
              onShowEntryDetails={setDetailsCustomer}
          />
        </div>
    );
}