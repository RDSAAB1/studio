
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
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
const PIE_CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];


export default function SupplierProfilePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [customerSummary, setCustomerSummary] = useState<Map<string, CustomerSummary>>(new Map());
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);

  const [detailsCustomer, setDetailsCustomer] = useState<Supplier | null>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');
  const [selectedChart, setSelectedChart] = useState<ChartType>('financial');
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

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

  const updateCustomerSummary = useCallback(() => {
    const newSummary = new Map<string, CustomerSummary>();
    
    // Create summaries for each customer based on their entries
    suppliers.forEach(entry => {
      if(!entry.customerId) return;
      const key = entry.customerId;
      if (!newSummary.has(key)) {
        newSummary.set(key, {
          name: entry.name, so: entry.so, contact: entry.contact, address: entry.address,
          acNo: entry.acNo, ifscCode: entry.ifscCode, bank: entry.bank, branch: entry.branch,
          totalOutstanding: 0, totalAmount: 0, totalPaid: 0, 
          paymentHistory: [], outstandingEntryIds: [],
          totalGrossWeight: 0, totalTeirWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
          totalLabouryAmount: 0, totalCdAmount: 0, averageRate: 0, totalTransactions: 0,
          totalOutstandingTransactions: 0, allTransactions: [], allPayments: [],
          transactionsByVariety: {}
        });
      }
      const data = newSummary.get(key)!;
      data.totalAmount += parseFloat(String(entry.originalNetAmount || entry.amount));
      data.totalOutstanding += parseFloat(String(entry.netAmount));
      data.allTransactions!.push(entry);
    });

    // Add payment history to each summary
    paymentHistory.forEach(payment => {
        if(payment.customerId && newSummary.has(payment.customerId)) {
            const data = newSummary.get(payment.customerId)!;
            data.paymentHistory.push(payment);
            data.totalPaid += payment.amount;
        }
    });

    // Create the Mill overview summary
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
        millSummary.totalAmount! += (c.originalNetAmount || c.amount);
        millSummary.totalOutstanding! += Number(c.netAmount);

        if(c.rate > 0) {
            totalRate += c.rate;
            rateCount++;
        }
        const variety = toTitleCase(c.variety) || 'Unknown';
        if(millSummary.transactionsByVariety) {
            millSummary.transactionsByVariety[variety] = (millSummary.transactionsByVariety[variety] || 0) + 1;
        }
    });

    millSummary.totalPaid = paymentHistory.reduce((acc, p) => acc + p.amount, 0);
    millSummary.totalCdAmount = paymentHistory.reduce((acc, p) => acc + p.cdAmount, 0);
    millSummary.totalTransactions = suppliers.length;
    millSummary.totalOutstandingTransactions = suppliers.filter(c => parseFloat(String(c.netAmount)) > 0).length;
    millSummary.averageRate = rateCount > 0 ? totalRate / rateCount : 0;


    const finalSummary = new Map<string, CustomerSummary>();
    finalSummary.set(MILL_OVERVIEW_KEY, millSummary);
    newSummary.forEach((value, key) => {
      finalSummary.set(key, value);
    });

    setCustomerSummary(finalSummary);
    if (!selectedCustomerKey) {
      setSelectedCustomerKey(MILL_OVERVIEW_KEY);
    }
  }, [suppliers, paymentHistory, selectedCustomerKey]); 

  useEffect(() => {
    if(!loading) { // Only update summary after data is loaded
      updateCustomerSummary();
    }
  }, [loading, updateCustomerSummary]);

  const selectedCustomerData = selectedCustomerKey ? customerSummary.get(selectedCustomerKey) : null;
  const isMillSelected = selectedCustomerKey === MILL_OVERVIEW_KEY;
  
  const handleShowDetails = (customer: Supplier) => {
    setDetailsCustomer(customer);
  }
  
  const paymentsForDetailsEntry = useMemo(() => {
    if (!detailsCustomer) return [];
    return paymentHistory.filter(p => 
      p.paidFor?.some(pf => pf.srNo === detailsCustomer.srNo)
    );
  }, [detailsCustomer, paymentHistory]);

  const financialPieChartData = useMemo(() => {
    if (!selectedCustomerData) return [];
    return [
      { name: 'Total Paid', value: selectedCustomerData.totalPaid },
      { name: 'Total Outstanding', value: selectedCustomerData.totalOutstanding },
    ];
  }, [selectedCustomerData]);

  const varietyPieChartData = useMemo(() => {
    if (!selectedCustomerData?.transactionsByVariety) return [];
    return Object.entries(selectedCustomerData.transactionsByVariety).map(([name, value]) => ({ name, value }));
  }, [selectedCustomerData]);

  const chartData = useMemo(() => {
    return selectedChart === 'financial' ? financialPieChartData : varietyPieChartData;
  }, [selectedChart, financialPieChartData, varietyPieChartData]);

  if (!isClient) {
    return null; // Or a loading skeleton
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Select Supplier</h3>
            </div>
            <div className="w-full sm:w-auto sm:min-w-64">
                <Select onValueChange={setSelectedCustomerKey} value={selectedCustomerKey || ""}>
                    <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select a supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(customerSummary.entries()).map(([key, data]) => (
                        <SelectItem key={key} value={key} className="text-sm">
                          {toTitleCase(data.name)} {data.contact && `(${data.contact})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {selectedCustomerData && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {isMillSelected ? (
             <div className="lg:col-span-12 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Mill Overview (All Suppliers)</CardTitle>
                        <CardDescription>A complete financial and transactional overview of the entire business.</CardDescription>
                    </CardHeader>
                     <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Gross Weight" value={`${(selectedCustomerData.totalGrossWeight || 0).toFixed(2)} kg`} icon={<Box />} />
                        <StatCard title="Total Net Weight" value={`${(selectedCustomerData.totalNetWeight || 0).toFixed(2)} kg`} icon={<Weight />} />
                        <StatCard title="Average Rate" value={formatCurrency(selectedCustomerData.averageRate || 0)} icon={<Calculator />} />
                        <StatCard title="Total Transactions" value={`${selectedCustomerData.totalTransactions}`} icon={<Briefcase />} />
                        <StatCard title="Total Outstanding" value={formatCurrency(selectedCustomerData.totalOutstanding || 0)} icon={<Banknote />} colorClass="text-destructive" />
                        <StatCard title="Total Paid" value={formatCurrency(selectedCustomerData.totalPaid || 0)} icon={<Banknote />} colorClass="text-green-500" />
                        <StatCard title="Total Karta" value={formatCurrency(selectedCustomerData.totalKartaAmount || 0)} icon={<Percent />} colorClass="text-destructive" />
                        <StatCard title="Total Laboury" value={formatCurrency(selectedCustomerData.totalLabouryAmount || 0)} icon={<Users />} colorClass="text-destructive" />
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
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', fontSize: '12px', borderRadius: 'var(--radius)' }} formatter={(value: number, name: string) => selectedChart === 'financial' ? formatCurrency(value) : value} />
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
                            <AreaChart className="h-24 w-24" />
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
                                        {selectedCustomerData.allTransactions!.map(entry => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="font-mono">{entry.srNo}</TableCell>
                                                <TableCell>{toTitleCase(entry.name)}</TableCell>
                                                <TableCell className="font-semibold">{formatCurrency(parseFloat(String(entry.originalNetAmount || entry.amount)))}</TableCell>
                                                <TableCell>
                                                    <Badge variant={parseFloat(String(entry.netAmount)) < 0.01 ? "secondary" : "destructive"}>
                                                        {parseFloat(String(entry.netAmount)) < 0.01 ? "Paid" : "Outstanding"}
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
                                        {selectedCustomerData.allPayments!.map(payment => (
                                            <TableRow key={payment.paymentId}>
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
                            {toTitleCase(selectedCustomerData.name)}
                        </CardTitle>
                        <CardDescription>S/O: {toTitleCase(selectedCustomerData.so || '')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DetailItem icon={<Phone size={14} />} label="Contact" value={selectedCustomerData.contact} />
                        <DetailItem icon={<Home size={14} />} label="Address" value={selectedCustomerData.address} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <DetailItem icon={<Landmark size={14} />} label="Bank Name" value={selectedCustomerData.bank} />
                        <DetailItem icon={<Hash size={14} />} label="Account No." value={selectedCustomerData.acNo} />
                        <DetailItem icon={<Building size={14} />} label="IFSC Code" value={selectedCustomerData.ifscCode} />
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-8 space-y-6">
                 <Card>
                    <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <div className="grid gap-4">
                            <StatCard title="Total Outstanding" value={formatCurrency(selectedCustomerData.totalOutstanding)} icon={<Banknote />} colorClass="text-destructive" />
                            <StatCard title="Total Transactions" value={formatCurrency(selectedCustomerData.totalAmount)} icon={<Briefcase />} description={`${suppliers.filter(c => c.customerId === selectedCustomerKey).length} entries`}/>
                            <StatCard title="Total Paid" value={formatCurrency(selectedCustomerData.totalPaid)} icon={<Banknote />} colorClass="text-green-500" />
                            <StatCard title="Outstanding Entries" value={`${selectedCustomerData.allTransactions?.filter(t => Number(t.netAmount) > 0).length}`} icon={<Hash />} />
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
                                    formatter={(value: number) => formatCurrency(value)}
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
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>SR No</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Total Amount</TableHead>
                                        <TableHead>Outstanding</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                {suppliers.filter(c => c.customerId === selectedCustomerKey).map(entry => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono">{entry.srNo}</TableCell>
                                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-semibold">{formatCurrency(parseFloat(String(entry.originalNetAmount || entry.amount)))}</TableCell>
                                        <TableCell className="font-semibold text-destructive">{formatCurrency(parseFloat(String(entry.netAmount)))}</TableCell>
                                        <TableCell>
                                            <Badge variant={parseFloat(String(entry.netAmount)) < 0.01 ? "secondary" : "destructive"}>
                                            {parseFloat(String(entry.netAmount)) < 0.01 ? "Paid" : "Outstanding"}
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
                        </div>
                    </CardContent>
                </Card>
            </div>
            </>
        )}
      </div>}
        <Dialog open={!!detailsCustomer} onOpenChange={(open) => !open && setDetailsCustomer(null)}>
        <DialogContent className="max-w-4xl p-0">
          {detailsCustomer && (
            <>
            <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 flex flex-row justify-between items-center">
                <div>
                    <DialogTitle className="text-base font-semibold">Details for SR No: {detailsCustomer.srNo}</DialogTitle>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuRadioGroup value={activeLayout} onValueChange={(v) => setActiveLayout(v as LayoutOption)}>
                                <DropdownMenuRadioItem value="classic"><Rows3 className="mr-2 h-4 w-4" />Classic</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="compact"><LayoutList className="mr-2 h-4 w-4" />Compact</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="grid"><LayoutGrid className="mr-2 h-4 w-4" />Grid</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="step-by-step"><StepForward className="mr-2 h-4 w-4" />Step-by-Step</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DialogClose asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4"/></Button>
                    </DialogClose>
                </div>
            </DialogHeader>
            <ScrollArea className="max-h-[85vh]">
              <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-6">
                {activeLayout === 'classic' && (
                  <div className="space-y-4">
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
                                  <DetailItem icon={<Receipt size={14} />} label="Receipt Type" value={detailsCustomer.receiptType} />
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
                            <p className="text-sm text-primary/80 font-medium">Net Payable Amount</p>
                            <p className="text-3xl font-bold text-primary font-mono">
                                {formatCurrency(Number(detailsCustomer.netAmount))}
                            </p>
                         </CardContent>
                    </Card>
                  </div>
                )}
                 <Card className="mt-4">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Payment Details</CardTitle>
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
