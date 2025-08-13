
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Customer as Supplier, CustomerSummary, Payment, Customer } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, AreaChart as RechartsAreaChart } from 'recharts';
import { Home, Phone, User, Banknote, Landmark, Hash, UserCircle, Briefcase, Building, Info, Settings, X, Rows3, LayoutList, LayoutGrid, StepForward, UserSquare, Calendar as CalendarIcon, Truck, Wheat, Receipt, Wallet, Scale, Calculator, Percent, Server, Milestone, ArrowRight, FileText, Weight, Box, Users, AreaChart, CircleDollarSign, Download, Printer } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';
type ChartType = 'financial' | 'variety';


const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: string | number | null | undefined, className?: string }) => (
    <div className={cn("flex items-start gap-3", className)}>
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm break-words">{String(value) || '-'}</p>
        </div>
    </div>
);

const SummaryDetailItem = ({ label, value, subValue, colorClass }: { label: string, value: string | number, subValue?: string, colorClass?: string }) => (
    <div className="flex justify-between items-center text-sm py-1.5">
        <p className="text-muted-foreground">{label} {subValue && <span className="text-xs">({subValue})</span>}</p>
        <p className={cn("font-semibold", colorClass)}>{value}</p>
    </div>
);


const MILL_OVERVIEW_KEY = 'mill-overview';
const PIE_CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const StatementPreview = ({ data }: { data: CustomerSummary | null }) => {
    const statementItems = useMemo(() => {
        if (!data) return { items: [], openingBalance: 0, closingBalance: 0, totalDebit: 0, totalCredit: 0 };

        const transactions = (data.allTransactions || [])
            .map(t => ({
                date: new Date(t.date),
                particulars: `Purchase - SR#${t.srNo}`,
                debit: t.originalNetAmount,
                credit: 0,
            }));
        
        const payments = (data.allPayments || data.paymentHistory || [])
            .map(p => ({
                date: new Date(p.date),
                particulars: `Payment - ID#${p.paymentId}`,
                debit: 0,
                credit: p.amount + (p.cdAmount || 0),
            }));

        const combined = [...transactions, ...payments].sort((a, b) => a.date.getTime() - b.date.getTime());

        let balance = 0;
        const itemsWithBalance = combined.map(item => {
            balance = balance + item.debit - item.credit;
            return { ...item, balance };
        });

        const openingBalance = 0; // Assuming statement starts from zero balance. This could be more complex.
        const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
        const totalCredit = payments.reduce((sum, p) => sum + p.credit, 0);

        return {
            items: itemsWithBalance,
            openingBalance,
            closingBalance: balance,
            totalDebit,
            totalCredit,
        };
    }, [data]);

    if (!data) return null;
    const { items, openingBalance, closingBalance, totalDebit, totalCredit } = statementItems;
    const startDate = items.length > 0 ? format(items[0].date, "PPP") : 'N/A';
    const endDate = items.length > 0 ? format(items[items.length - 1].date, "PPP") : 'N/A';


    return (
        <div className="bg-background p-6 rounded-lg font-sans">
            <header className="mb-6 border-b pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-primary">Account Statement</h2>
                        <p className="text-muted-foreground">BizSuite DataFlow</p>
                    </div>
                    <div className="text-right">
                        <h3 className="text-lg font-semibold">{toTitleCase(data.name)}</h3>
                        {data.address && <p className="text-sm text-muted-foreground">{toTitleCase(data.address)}</p>}
                        {data.contact && <p className="text-sm text-muted-foreground">Contact: {data.contact}</p>}
                    </div>
                </div>
                 <p className="text-sm text-muted-foreground mt-2">For the period from {startDate} to {endDate}</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-muted/50 p-3 rounded-md text-center">
                    <p className="text-xs text-muted-foreground">Opening Balance</p>
                    <p className="font-bold text-lg font-mono">{formatCurrency(openingBalance)}</p>
                </div>
                <div className="bg-red-500/10 p-3 rounded-md text-center">
                    <p className="text-xs text-red-600">Total Debits</p>
                    <p className="font-bold text-lg text-red-700 font-mono">{formatCurrency(totalDebit)}</p>
                </div>
                 <div className="bg-green-500/10 p-3 rounded-md text-center">
                    <p className="text-xs text-green-600">Total Credits</p>
                    <p className="font-bold text-lg text-green-700 font-mono">{formatCurrency(totalCredit)}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-md text-center">
                    <p className="text-xs text-muted-foreground">Closing Balance</p>
                    <p className="font-bold text-lg font-mono">{formatCurrency(closingBalance)}</p>
                </div>
            </div>

            <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Date</TableHead>
                            <TableHead>Particulars</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right w-[120px]">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index} className="[&_td]:py-2">
                                <TableCell className="text-xs">{format(item.date, "dd-MMM-yy")}</TableCell>
                                <TableCell>{item.particulars}</TableCell>
                                <TableCell className="text-right font-mono text-red-600">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                <TableCell className="text-right font-mono text-green-600">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">{formatCurrency(item.balance)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-muted font-bold">
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(totalDebit)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(totalCredit)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(closingBalance)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </ScrollArea>
        </div>
    );
};


export default function SupplierProfilePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(MILL_OVERVIEW_KEY);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  const [detailsCustomer, setDetailsCustomer] = useState<Supplier | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [selectedChart, setSelectedChart] = useState<ChartType>('financial');

  // Fetch data from Firestore on mount
  useEffect(() => {
    setIsClient(true);
    setLoading(true);

    const unsubscribeSuppliers = onSnapshot(collection(db, "suppliers"), (snapshot) => {
        const fetchedSuppliers: Supplier[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
        setSuppliers(fetchedSuppliers);
        setLoading(false);
    }, (error) => {
        console.error("Failed to load suppliers from Firestore", error);
        setSuppliers([]);
        setLoading(false);
    });

    const unsubscribePayments = onSnapshot(collection(db, "payments"), (snapshot) => {
        const fetchedPayments: Payment[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        setPaymentHistory(fetchedPayments);
    }, (error) => {
        console.error("Failed to load payments from Firestore", error);
        setPaymentHistory([]);
    });

    return () => { 
        unsubscribeSuppliers(); 
        unsubscribePayments(); 
    };
  }, []);

  const supplierSummaryMap = useMemo(() => {
    const summary = new Map<string, CustomerSummary>();

    // Step 1: Initialize summary for each unique supplier
    suppliers.forEach(s => {
        if (s.customerId && !summary.has(s.customerId)) {
            summary.set(s.customerId, {
                name: s.name, contact: s.contact, so: s.so, address: s.address,
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
                paymentHistory: [], outstandingEntryIds: [], allTransactions: [],
                transactionsByVariety: {},
                totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
                totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0,
                averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0, totalDeductions: 0,
            });
        }
    });

    // Step 2: Aggregate transaction data for each supplier
    let supplierRateSum: { [key: string]: { rate: number, karta: number, laboury: number, count: number } } = {};

    suppliers.forEach(s => {
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
        
        if (!supplierRateSum[s.customerId]) {
            supplierRateSum[s.customerId] = { rate: 0, karta: 0, laboury: 0, count: 0 };
        }
        if (s.rate > 0) {
            supplierRateSum[s.customerId].rate += s.rate;
            supplierRateSum[s.customerId].karta += s.kartaPercentage;
            supplierRateSum[s.customerId].laboury += s.labouryRate;
            supplierRateSum[s.customerId].count++;
        }

        data.allTransactions!.push(s);
        const variety = toTitleCase(s.variety) || 'Unknown';
        data.transactionsByVariety![variety] = (data.transactionsByVariety![variety] || 0) + 1;
    });

    // Step 3: Aggregate payment data for each supplier
    paymentHistory.forEach(p => {
        if (p.customerId && summary.has(p.customerId)) {
            const data = summary.get(p.customerId)!;
            data.totalPaid += p.amount;
            data.totalCdAmount! += (p.cdAmount || 0);
            data.paymentHistory.push(p);
        }
    });

    // Step 4: Calculate final outstanding, averages and total deductions for each supplier
    summary.forEach((data, key) => {
        data.totalDeductions = data.totalKartaAmount! + data.totalLabouryAmount! + data.totalKanta! + data.totalOtherCharges!;
        data.totalOutstanding = data.totalOriginalAmount - data.totalPaid - data.totalCdAmount!;
        data.outstandingEntryIds = (data.allTransactions || [])
            .filter(t => parseFloat(String(t.netAmount)) >= 1)
            .map(t => t.id);
        data.totalOutstandingTransactions = data.outstandingEntryIds.length;
        
        if (data.totalFinalWeight! > 0) {
            data.averageRate = data.totalAmount / data.totalFinalWeight!;
        } else {
            data.averageRate = 0;
        }

        if (data.totalNetWeight! > 0) {
          data.averageOriginalPrice = data.totalOriginalAmount / data.totalNetWeight!;
        } else {
          data.averageOriginalPrice = 0;
        }

        const rates = supplierRateSum[key];
        if (rates && rates.count > 0) {
            data.averageKartaPercentage = rates.karta / rates.count;
            data.averageLabouryRate = rates.laboury / rates.count;
        }
    });

    // Step 5: Create Mill Overview
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
        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, totalDeductions: 0,
        averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: suppliers, 
        allPayments: paymentHistory, transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0
    });
    
    millSummary.totalDeductions = millSummary.totalKartaAmount! + millSummary.totalLabouryAmount! + millSummary.totalKanta! + millSummary.totalOtherCharges!;
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid - millSummary.totalCdAmount!;
    millSummary.totalTransactions = suppliers.length;
    millSummary.totalOutstandingTransactions = suppliers.filter(c => parseFloat(String(c.netAmount)) >= 1).length;
    
    if (millSummary.totalFinalWeight! > 0) {
        millSummary.averageRate = millSummary.totalAmount / millSummary.totalFinalWeight!;
    } else {
        millSummary.averageRate = 0;
    }

     if (millSummary.totalNetWeight! > 0) {
        millSummary.averageOriginalPrice = millSummary.totalOriginalAmount / millSummary.totalNetWeight!;
    } else {
        millSummary.averageOriginalPrice = 0;
    }

    const totalRateData = suppliers.reduce((acc, s) => {
        if(s.rate > 0) {
            acc.karta += s.kartaPercentage;
            acc.laboury += s.labouryRate;
            acc.count++;
        }
        return acc;
    }, { karta: 0, laboury: 0, count: 0 });

    if(totalRateData.count > 0) {
        millSummary.averageKartaPercentage = totalRateData.karta / totalRateData.count;
        millSummary.averageLabouryRate = totalRateData.laboury / totalRateData.count;
    }
    
    millSummary.transactionsByVariety = suppliers.reduce((acc, s) => {
        const variety = toTitleCase(s.variety) || 'Unknown';
        acc[variety] = (acc[variety] || 0) + 1;
        return acc;
    }, {} as {[key: string]: number});
    
    const finalSummaryMap = new Map<string, CustomerSummary>();
    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);
    summary.forEach((value, key) => finalSummaryMap.set(key, value));

    return finalSummaryMap;
  }, [suppliers, paymentHistory]);

  const selectedSupplierData = selectedSupplierKey ? supplierSummaryMap.get(selectedSupplierKey) : null;
  const isMillSelected = selectedSupplierKey === MILL_OVERVIEW_KEY;

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

  const handleShowDetails = (customer: Supplier) => {
    setDetailsCustomer(customer);
  }
  
  const paymentsForDetailsEntry = useMemo(() => {
    if (!detailsCustomer) return [];
    return paymentHistory.filter(p => 
      p.paidFor?.some(pf => pf.srNo === detailsCustomer.srNo)
    );
  }, [detailsCustomer, paymentHistory]);

  const currentPaymentHistory = useMemo(() => {
      if (!selectedSupplierData) return [];
      if (isMillSelected) {
          return selectedSupplierData.allPayments || [];
      }
      return selectedSupplierData.paymentHistory || [];
  }, [selectedSupplierData, isMillSelected]);


  if (!isClient || loading) {
    return (
        <div className="flex items-center justify-center h-64">
            <p>Loading Profiles...</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Select Profile</h3>
            </div>
            <div className="w-full sm:w-auto sm:min-w-64">
                <Select onValueChange={setSelectedSupplierKey} value={selectedSupplierKey || ""}>
                    <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select a profile to view..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(supplierSummaryMap.entries()).map(([key, data]) => (
                        <SelectItem key={key} value={key} className="text-sm">
                          {toTitleCase(data.name)} {data.contact && `(${data.contact})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {selectedSupplierData && (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{toTitleCase(selectedSupplierData.name)}</CardTitle>
                            <CardDescription>
                                {isMillSelected ? "A complete financial and transactional overview of the entire business." : `S/O: ${toTitleCase(selectedSupplierData.so || '')} | Contact: ${selectedSupplierData.contact}`}
                            </CardDescription>
                        </div>
                        <Button variant="outline" onClick={() => setIsStatementOpen(true)}>
                            <FileText className="mr-2 h-4 w-4"/>
                            Generate Statement
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Operational Summary Card */}
                    <Card className="bg-card/50">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Scale size={16}/> Operational Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1">
                            <SummaryDetailItem label="Gross Wt" value={`${(selectedSupplierData.totalGrossWeight || 0).toFixed(2)} kg`} />
                            <SummaryDetailItem label="Teir Wt" value={`${(selectedSupplierData.totalTeirWeight || 0).toFixed(2)} kg`} />
                            <SummaryDetailItem label="Total Wt" value={`${(selectedSupplierData.totalFinalWeight || 0).toFixed(2)} kg`} />
                            <SummaryDetailItem label="Karta Wt" subValue={`@${(selectedSupplierData.averageKartaPercentage || 0).toFixed(2)}%`} value={`${(selectedSupplierData.totalKartaWeight || 0).toFixed(2)} kg`} />
                            <SummaryDetailItem label="Net Wt" value={`${(selectedSupplierData.totalNetWeight || 0).toFixed(2)} kg`} colorClass="text-primary font-bold"/>
                            <Separator className="my-2"/>
                            <SummaryDetailItem label="Average Rate" value={formatCurrency(selectedSupplierData.averageRate || 0)} />
                            <Separator className="my-2"/>
                            <SummaryDetailItem label="Total Transactions" value={`${selectedSupplierData.totalTransactions} Entries`} />
                            <SummaryDetailItem label="Outstanding Entries" value={`${selectedSupplierData.totalOutstandingTransactions} Entries`} colorClass="text-destructive font-bold"/>
                        </CardContent>
                    </Card>

                    {/* Deduction Summary Card */}
                     <Card className="bg-card/50">
                        <CardHeader className="p-4 pb-2">
                             <CardTitle className="text-base flex items-center gap-2"><FileText size={16}/> Deduction Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1">
                            <SummaryDetailItem label="Total Amount" subValue={`@${formatCurrency(selectedSupplierData.averageRate || 0)}/kg`} value={`${formatCurrency(selectedSupplierData.totalAmount || 0)}`} />
                            <Separator className="my-2"/>
                            <SummaryDetailItem label="Total Karta" subValue={`@${(selectedSupplierData.averageKartaPercentage || 0).toFixed(2)}%`} value={`- ${formatCurrency(selectedSupplierData.totalKartaAmount || 0)}`} />
                            <SummaryDetailItem label="Total Laboury" subValue={`@${(selectedSupplierData.averageLabouryRate || 0).toFixed(2)}`} value={`- ${formatCurrency(selectedSupplierData.totalLabouryAmount || 0)}`} />
                            <SummaryDetailItem label="Total Kanta" value={`- ${formatCurrency(selectedSupplierData.totalKanta || 0)}`} />
                            <SummaryDetailItem label="Total Other" value={`- ${formatCurrency(selectedSupplierData.totalOtherCharges || 0)}`} />
                             <Separator className="my-2"/>
                            <div className="flex justify-between items-center text-base pt-1">
                                <p className="font-semibold text-muted-foreground">Total Original Amount</p>
                                <p className="font-bold text-lg text-primary">{`${formatCurrency(selectedSupplierData.totalOriginalAmount || 0)}`}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Financial Summary Card */}
                     <Card className="bg-card/50">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Banknote size={16}/> Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-1">
                            <SummaryDetailItem label="Total Original Amount" value={formatCurrency(selectedSupplierData.totalOriginalAmount || 0)} subValue={`Avg: ${formatCurrency(selectedSupplierData.averageOriginalPrice || 0)}/kg`} />
                             <Separator className="my-2"/>
                            <SummaryDetailItem label="Total Paid" value={`${formatCurrency(selectedSupplierData.totalPaid || 0)}`} colorClass="text-green-500" />
                            <SummaryDetailItem label="Total CD Granted" value={`${formatCurrency(selectedSupplierData.totalCdAmount || 0)}`} />
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
                                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleShowDetails(entry)}>
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
                                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedPaymentForDetails(payment)}>
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
      )}

      <Dialog open={!!detailsCustomer} onOpenChange={(open) => !open && setDetailsCustomer(null)}>
        <DialogContent className="max-w-4xl p-0">
          {detailsCustomer && (
            <>
            <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 flex flex-row justify-between items-center">
                <div>
                    <DialogTitle className="text-base font-semibold">Details for SR No: {detailsCustomer.srNo}</DialogTitle>
                </div>
                <div className="flex items-center gap-2">
                    <DialogClose asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4"/></Button>
                    </DialogClose>
                </div>
            </DialogHeader>
            <ScrollArea className="max-h-[85vh]">
              <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                <Card>
                    <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                        <div className="flex flex-col items-center justify-center space-y-2 p-4 bg-muted rounded-lg h-full">
                            <p className="text-xs text-muted-foreground">SR No.</p>
                            <p className="text-2xl font-bold font-mono text-primary">{detailsCustomer.srNo}</p>
                        </div>
                        <Separator orientation="vertical" className="h-auto mx-4 hidden md:block" />
                        <Separator orientation="horizontal" className="w-full md:hidden" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 flex-1 text-sm">
                            <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                            <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsCustomer.contact} />
                            <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(detailsCustomer.so)} />
                            <DetailItem icon={<CalendarIcon size={14} />} label="Transaction Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                            <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                            <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsCustomer.address)} className="col-span-1 sm:col-span-2" />
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="p-4"><CardTitle className="text-base">Transaction &amp; Weight</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-0 space-y-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsCustomer.vehicleNo.toUpperCase()} />
                                <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />
                                <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsCustomer.paymentType} />
                            </div>
                            <Separator />
                            <Table className="text-xs">
                                <TableBody>
                                    <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Weight size={12} />Gross Weight</TableCell><TableCell className="text-right font-semibold p-1">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Weight size={12} />Teir Weight (Less)</TableCell><TableCell className="text-right font-semibold p-1">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Scale size={12} />Final Weight</TableCell><TableCell className="text-right font-bold p-2">{detailsCustomer.weight.toFixed(2)} kg</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <Card>
                            <CardHeader className="p-4"><CardTitle className="text-base">Financial Calculation</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0">
                            <Table className="text-xs">
                                <TableBody>
                                    <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Scale size={12} />Net Weight</TableCell><TableCell className="text-right font-semibold p-1">{detailsCustomer.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Calculator size={12} />Rate</TableCell><TableCell className="text-right font-semibold p-1">@ {formatCurrency(detailsCustomer.rate)}</TableCell></TableRow>
                                    <TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Banknote size={12} />Total Amount</TableCell><TableCell className="text-right font-bold p-2">{formatCurrency(detailsCustomer.amount)}</TableCell></TableRow>
                                    <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Percent size={12} />Karta ({detailsCustomer.kartaPercentage}%)</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsCustomer.kartaAmount)}</TableCell></TableRow>
                                    <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Server size={12} />Laboury Rate</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">@ {detailsCustomer.labouryRate.toFixed(2)}</TableCell></TableRow>
                                    <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Milestone size={12} />Laboury Amount</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsCustomer.labouryAmount)}</TableCell></TableRow>
                                    <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Landmark size={12} />Kanta</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsCustomer.kanta)}</TableCell></TableRow>
                                    <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><CircleDollarSign size={12} />Other Charges</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsCustomer.otherCharges || 0)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                            </CardContent>
                    </Card>
                </div>

                <Card className="border-primary/50 bg-primary/5 text-center">
                        <CardContent className="p-3">
                        <p className="text-sm text-primary/80 font-medium">Original Total</p>
                        <p className="text-2xl font-bold text-primary/90 font-mono">
                            {formatCurrency(Number(detailsCustomer.originalNetAmount))}
                        </p>
                        <Separator className="my-2"/>
                        <p className="text-sm text-destructive font-medium">Final Outstanding Amount</p>
                        <p className="text-3xl font-bold text-destructive font-mono">
                            {formatCurrency(Number(detailsCustomer.netAmount))}
                        </p>
                        </CardContent>
                </Card>

                <Card className="mt-4">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Payment History</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        {paymentsForDetailsEntry.length > 0 ? (
                            <Table className="text-sm">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="p-2 text-xs">Payment ID</TableHead>
                                        <TableHead className="p-2 text-xs">Date</TableHead>
                                        <TableHead className="p-2 text-xs text-right">Amount Paid</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paymentsForDetailsEntry.map(p => {
                                        const paidForThis = p.paidFor?.find(pf => pf.srNo === detailsCustomer?.srNo);
                                        return (
                                            <TableRow key={p.id}>
                                                <TableCell className="p-2">{p.paymentId}</TableCell>
                                                <TableCell className="p-2">{format(new Date(p.date), "dd-MMM-yy")}</TableCell>
                                                <TableCell className="text-right p-2 font-semibold">{formatCurrency(paidForThis?.amount || 0)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-center text-muted-foreground text-sm py-4">No payments have been applied to this entry yet.</p>
                        )}
                    </CardContent>
                </Card>     
              </div>
            </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!selectedPaymentForDetails} onOpenChange={(open) => !open && setSelectedPaymentForDetails(null)}>
        <DialogContent className="max-w-2xl">
          {selectedPaymentForDetails && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Details: {selectedPaymentForDetails.paymentId}</DialogTitle>
                <DialogDescription>
                  Details of the payment made on {format(new Date(selectedPaymentForDetails.date), "PPP")}.
                </DialogDescription>
              </DialogHeader>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <DetailItem icon={<Banknote size={14} />} label="Amount Paid" value={formatCurrency(selectedPaymentForDetails.amount)} />
                <DetailItem icon={<Percent size={14} />} label="CD Amount" value={formatCurrency(selectedPaymentForDetails.cdAmount)} />
                <DetailItem icon={<CalendarIcon size={14} />} label="Payment Type" value={selectedPaymentForDetails.type} />
                <DetailItem icon={<Receipt size={14} />} label="Payment Method" value={selectedPaymentForDetails.receiptType} />
                <DetailItem icon={<Hash size={14} />} label="CD Applied" value={selectedPaymentForDetails.cdApplied ? "Yes" : "No"} />
              </div>
              <h4 className="font-semibold text-sm">Entries Paid in this Transaction</h4>
              <div className="max-h-64 overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>SR No</TableHead>
                            <TableHead>Supplier Name</TableHead>
                            <TableHead className="text-right">Amount Paid</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedPaymentForDetails.paidFor?.map((pf, index) => {
                            const supplier = suppliers.find(s => s.srNo === pf.srNo);
                            return (
                                <TableRow key={index}>
                                    <TableCell>{pf.srNo}</TableCell>
                                    <TableCell>{supplier ? toTitleCase(supplier.name) : 'N/A'}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(pf.amount)}</TableCell>
                                    <TableCell className="text-center">
                                       {supplier && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                           setDetailsCustomer(supplier);
                                           setSelectedPaymentForDetails(null);
                                       }}>
                                            <Info className="h-4 w-4" />
                                        </Button>}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedPaymentForDetails(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
          <DialogContent className="max-w-4xl p-0">
            <DialogHeader className="p-4 sr-only">
                <DialogTitle>Account Statement for {selectedSupplierData?.name}</DialogTitle>
                <DialogDescription>A detailed account statement of all transactions and payments.</DialogDescription>
            </DialogHeader>
              <StatementPreview data={selectedSupplierData} />
              <DialogFooter className="p-4 border-t">
                    <Button variant="outline" onClick={() => setIsStatementOpen(false)}>Close</Button>
                    <div className="flex-grow" />
                    <Button variant="outline"><Printer className="mr-2 h-4 w-4"/> Print</Button>
                    <Button><Download className="mr-2 h-4 w-4"/> Download PDF</Button>
                </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

    
