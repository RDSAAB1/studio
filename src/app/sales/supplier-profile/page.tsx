
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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, AreaChart as RechartsAreaChart } from 'recharts';
import { Home, Phone, User, Banknote, Landmark, Hash, UserCircle, Briefcase, Building, Info, Settings, X, Rows3, LayoutList, LayoutGrid, StepForward, UserSquare, Calendar as CalendarIcon, Truck, Wheat, Receipt, Wallet, Scale, Calculator, Percent, Server, Milestone, ArrowRight, FileText, Weight, Box, Users, AreaChart } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from "@/components/ui/dialog";
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

const StatCard = ({ title, value, icon, colorClass, description }: { title: string, value: string, icon: React.ReactNode, colorClass?: string, description?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="text-muted-foreground">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

const MILL_OVERVIEW_KEY = 'mill-overview';
const PIE_CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function SupplierProfilePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [selectedSupplierKey, setSelectedSupplierKey] = useState<string | null>(null);

  const [detailsCustomer, setDetailsCustomer] = useState<Supplier | null>(null);
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
                totalOutstanding: 0, totalAmount: 0, totalPaid: 0, 
                paymentHistory: [], outstandingEntryIds: [], allTransactions: [],
                transactionsByVariety: {}
            });
        }
    });

    // Step 2: Aggregate transaction data for each supplier
    suppliers.forEach(s => {
        if (!s.customerId) return;
        const data = summary.get(s.customerId)!;
        const originalAmount = parseFloat(String(s.originalNetAmount || s.amount || 0));
        
        data.totalAmount += originalAmount;
        data.allTransactions!.push(s);
        const variety = toTitleCase(s.variety) || 'Unknown';
        data.transactionsByVariety![variety] = (data.transactionsByVariety![variety] || 0) + 1;
    });

    // Step 3: Aggregate payment data for each supplier
    paymentHistory.forEach(p => {
        if (p.customerId && summary.has(p.customerId)) {
            const data = summary.get(p.customerId)!;
            data.totalPaid += p.amount;
            data.paymentHistory.push(p);
        }
    });

    // Step 4: Calculate final outstanding for each supplier
    summary.forEach(data => {
        data.totalOutstanding = data.totalAmount - data.totalPaid;
    });

    // Step 5: Create Mill Overview
    const millSummary: CustomerSummary = {
        name: 'Mill (Total Overview)', contact: '', totalOutstanding: 0, totalAmount: 0, totalPaid: 0,
        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalCdAmount: 0, averageRate: 0, totalTransactions: 0,
        totalOutstandingTransactions: 0, allTransactions: suppliers, allPayments: paymentHistory,
        transactionsByVariety: {}
    };

    let totalRate = 0;
    let rateCount = 0;

    suppliers.forEach(c => {
        millSummary.totalGrossWeight! += c.grossWeight;
        millSummary.totalTeirWeight! += c.teirWeight;
        millSummary.totalNetWeight! += c.netWeight;
        millSummary.totalKartaAmount! += c.kartaAmount;
        millSummary.totalLabouryAmount! += c.labouryAmount;
        if(c.rate > 0) {
            totalRate += c.rate;
            rateCount++;
        }
        const variety = toTitleCase(c.variety) || 'Unknown';
        millSummary.transactionsByVariety![variety] = (millSummary.transactionsByVariety![variety] || 0) + 1;
    });

    millSummary.totalAmount = Array.from(summary.values()).reduce((acc, s) => acc + s.totalAmount, 0);
    millSummary.totalPaid = Array.from(summary.values()).reduce((acc, s) => acc + s.totalPaid, 0);
    millSummary.totalOutstanding = millSummary.totalAmount - millSummary.totalPaid;
    
    millSummary.totalCdAmount = paymentHistory.reduce((acc, p) => acc + (p.cdAmount || 0), 0);
    millSummary.totalTransactions = suppliers.length;
    millSummary.totalOutstandingTransactions = suppliers.filter(c => parseFloat(String(c.netAmount)) >= 1).length;
    millSummary.averageRate = rateCount > 0 ? totalRate / rateCount : 0;
    
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
      { name: 'Total Paid', value: selectedSupplierData.totalPaid },
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {isMillSelected ? (
            <div className="lg:col-span-12 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Mill Overview (All Suppliers)</CardTitle>
                        <CardDescription>A complete financial and transactional overview of the entire business.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Gross Weight" value={`${(selectedSupplierData.totalGrossWeight || 0).toFixed(2)} kg`} icon={<Box />} />
                        <StatCard title="Total Net Weight" value={`${(selectedSupplierData.totalNetWeight || 0).toFixed(2)} kg`} icon={<Weight />} />
                        <StatCard title="Average Rate" value={`₹${(selectedSupplierData.averageRate || 0).toFixed(2)}`} icon={<Calculator />} />
                        <StatCard title="Total Transactions" value={`${selectedSupplierData.totalTransactions}`} icon={<Briefcase />} />
                        <StatCard title="Total Outstanding" value={`${formatCurrency(selectedSupplierData.totalOutstanding)}`} icon={<Banknote />} colorClass="text-destructive" />
                        <StatCard title="Total Paid" value={`${formatCurrency(selectedSupplierData.totalPaid || 0)}`} icon={<Banknote />} colorClass="text-green-500" />
                        <StatCard title="Total Karta" value={`${formatCurrency(selectedSupplierData.totalKartaAmount || 0)}`} icon={<Percent />} colorClass="text-destructive" />
                        <StatCard title="Total Laboury" value={`${formatCurrency(selectedSupplierData.totalLabouryAmount || 0)}`} icon={<Users />} colorClass="text-destructive" />
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
                    <Card>
                        <CardHeader><CardTitle>Dummy Chart</CardTitle></CardHeader>
                        <CardContent className="h-80 flex items-center justify-center text-muted-foreground">
                            <RechartsAreaChart className="h-24 w-24" />
                            <p>Another chart can go here.</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                      <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
                      <CardContent>
                          <ScrollArea className="h-96">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>SR No</TableHead>
                                          <TableHead>Supplier</TableHead>
                                          <TableHead>Amount</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Actions</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {selectedSupplierData.allTransactions!.map(entry => (
                                          <TableRow key={entry.id}>
                                              <TableCell className="font-mono">{entry.srNo}</TableCell>
                                              <TableCell>{toTitleCase(entry.name)}</TableCell>
                                              <TableCell className="font-semibold">{formatCurrency(parseFloat(String(entry.originalNetAmount || entry.amount)))}</TableCell>
                                              <TableCell>
                                                  <Badge variant={parseFloat(String(entry.netAmount)) < 1 ? "secondary" : "destructive"}>
                                                      {parseFloat(String(entry.netAmount)) < 1 ? "Paid" : "Outstanding"}
                                                  </Badge>
                                              </TableCell>
                                              <TableCell>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleShowDetails(entry)}>
                                                      <Info className="h-4 w-4" />
                                                  </Button>
                                              </TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </ScrollArea>
                      </CardContent>
                  </Card>
                  <Card>
                      <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
                      <CardContent>
                          <ScrollArea className="h-96">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>Payment ID</TableHead>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Amount</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {selectedSupplierData.allPayments!.map((payment, idx) => (
                                          <TableRow key={payment.id || idx}>
                                              <TableCell className="font-mono">{payment.paymentId}</TableCell>
                                              <TableCell>{format(new Date(payment.date), "PPP")}</TableCell>
                                              <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </ScrollArea>
                      </CardContent>
                  </Card>
                </div>
            </div>
        ) : (
            <>
            <div className="lg:col-span-4 space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <UserCircle size={24} className="text-primary"/>
                            {toTitleCase(selectedSupplierData.name)}
                        </CardTitle>
                        <CardDescription>S/O: {toTitleCase(selectedSupplierData.so || '')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DetailItem icon={<Phone size={14} />} label="Contact" value={selectedSupplierData.contact} />
                        <DetailItem icon={<Home size={14} />} label="Address" value={selectedSupplierData.address} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <DetailItem icon={<Landmark size={14} />} label="Bank Name" value={selectedSupplierData.bank} />
                        <DetailItem icon={<Hash size={14} />} label="Account No." value={selectedSupplierData.acNo} />
                        <DetailItem icon={<Building size={14} />} label="IFSC Code" value={selectedSupplierData.ifscCode} />
                        <DetailItem icon={<Building size={14} />} label="Branch" value={selectedSupplierData.branch} />
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-8 space-y-6">
                 <Card>
                    <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <div className="grid gap-4">
                            <StatCard title="Total Outstanding" value={formatCurrency(selectedSupplierData.totalOutstanding)} icon={<Banknote />} colorClass="text-destructive" />
                            <StatCard title="Total Transactions" value={formatCurrency(selectedSupplierData.totalAmount)} icon={<Briefcase />} description={`${(selectedSupplierData.allTransactions || []).length} entries`}/>
                            <StatCard title="Total Paid" value={formatCurrency(selectedSupplierData.totalPaid)} icon={<Banknote />} colorClass="text-green-500" />
                            <StatCard title="Outstanding Entries" value={(selectedSupplierData.allTransactions || []).filter(t => parseFloat(String(t.netAmount)) >= 1).length.toString()} icon={<Hash />} />
                        </div>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                <Tooltip
                                    contentStyle={{
                                    backgroundColor: 'hsl(var(--background))',
                                    borderColor: 'hsl(var(--border))',
                                    fontSize: '12px',
                                    borderRadius: 'var(--radius)'
                                    }}
                                    formatter={(value: number) => `${formatCurrency(value)}`}
                                />
                                <Pie
                                    data={financialPieChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {financialPieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Transaction History</CardTitle>
                        <CardDescription>List of all transactions for this supplier.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <ScrollArea className="h-96">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>SR No</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {(selectedSupplierData.allTransactions || []).map(entry => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="font-mono">{entry.srNo}</TableCell>
                                            <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-semibold">{formatCurrency(parseFloat(String(entry.originalNetAmount || entry.amount)))}</TableCell>
                                            <TableCell>
                                                <Badge variant={parseFloat(String(entry.netAmount)) < 1 ? "secondary" : "destructive"}>
                                                {parseFloat(String(entry.netAmount)) < 1 ? "Paid" : `Outstanding: ${formatCurrency(Number(entry.netAmount))}`}
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
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">No transactions found for this supplier.</TableCell>
                                        </TableRow>
                                    )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>
            </div>
            </>
        )}
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
                                        <TableHead className="text-right p-2 text-xs">Amount Paid</TableHead>
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
    </div>
  );
}
