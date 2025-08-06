
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { initialCustomers } from "@/lib/data";
import type { Customer, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase, cn } from "@/lib/utils";

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
import { Home, Phone, User, Banknote, Landmark, Hash, UserCircle, Briefcase, Building, Info, Settings, X, Rows3, LayoutList, LayoutGrid, StepForward, UserSquare, Calendar as CalendarIcon, Truck, Wheat, Receipt, Wallet, Scale, Calculator, Percent, Server, Milestone, ArrowRight, FileText, Weight, Box, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';

const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: any, className?: string }) => (
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

export default function CustomerProfilePage() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSummary, setCustomerSummary] = useState<Map<string, CustomerSummary>>(new Map());
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');

  const updateCustomerSummary = useCallback(() => {
    const newSummary = new Map<string, CustomerSummary>();
    const tempPaymentHistory = new Map<string, Payment[]>();

     // Simulate some payment history for demonstration
     customers.forEach((c, index) => {
        if(!c.customerId) return;
        if(!tempPaymentHistory.has(c.customerId)) {
            tempPaymentHistory.set(c.customerId, []);
        }
        if(index % 2 === 0 && parseFloat(String(c.netAmount)) > 5000) {
             tempPaymentHistory.get(c.customerId)?.push({
                 paymentId: `P0000${index + 1}`,
                 date: '2025-07-28',
                 amount: parseFloat(String(c.netAmount)) / 2,
                 cdAmount: 50, // Simulated CD
                 type: 'Partial',
                 receiptType: 'Online',
                 notes: `Simulated partial payment for SR ${c.srNo}`
             })
        }
    });
    
    // Create summaries for each customer
    customers.forEach(entry => {
      if(!entry.customerId) return;
      const key = entry.customerId;
      if (!newSummary.has(key)) {
        newSummary.set(key, {
          name: entry.name, so: entry.so, contact: entry.contact, address: entry.address,
          acNo: entry.acNo, ifscCode: entry.ifscCode, bank: entry.bank, branch: entry.branch,
          totalOutstanding: 0, totalAmount: 0, totalPaid: 0, 
          paymentHistory: tempPaymentHistory.get(key) || [], 
          outstandingEntryIds: [],
          totalGrossWeight: 0, totalTeirWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
          totalLabouryAmount: 0, totalCdAmount: 0, averageRate: 0, totalTransactions: 0,
          totalOutstandingTransactions: 0, allTransactions: [], allPayments: []
        });
      }
      const data = newSummary.get(key)!;
      const totalAmount = parseFloat(String(entry.amount));
      const netAmount = parseFloat(String(entry.netAmount));
      
      data.totalAmount += totalAmount;
      if (netAmount > 0) {
        data.outstandingEntryIds.push(entry.id);
      }
    });

    // Calculate totals for each customer
    newSummary.forEach((summary) => {
        const customerTransactions = customers.filter(c => c.customerId === summary.customerId);
        summary.totalPaid = summary.paymentHistory.reduce((acc, p) => acc + p.amount, 0);
        summary.totalOutstanding = summary.totalAmount - summary.totalPaid;
    });

    // Create the Mill overview summary
    const millSummary: CustomerSummary = {
        name: 'Mill (Total Overview)', contact: '', totalOutstanding: 0, totalAmount: 0, totalPaid: 0,
        paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalCdAmount: 0, averageRate: 0, totalTransactions: 0,
        totalOutstandingTransactions: 0, allTransactions: customers, allPayments: []
    };
    
    let totalRate = 0;
    let rateCount = 0;

    customers.forEach(c => {
        millSummary.totalGrossWeight += c.grossWeight;
        millSummary.totalTeirWeight += c.teirWeight;
        millSummary.totalNetWeight += c.netWeight;
        millSummary.totalKartaAmount += c.kartaAmount;
        millSummary.totalLabouryAmount += c.labouryAmount;
        if(c.rate > 0) {
            totalRate += c.rate;
            rateCount++;
        }
    });

    newSummary.forEach(summary => {
        millSummary.totalOutstanding += summary.totalOutstanding;
        millSummary.totalPaid += summary.totalPaid;
        summary.paymentHistory.forEach(p => millSummary.allPayments.push(p));
    });
    
    millSummary.totalCdAmount = millSummary.allPayments.reduce((acc, p) => acc + p.cdAmount, 0);
    millSummary.totalTransactions = customers.length;
    millSummary.totalOutstandingTransactions = customers.filter(c => parseFloat(String(c.netAmount)) > 0).length;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]); 

  useEffect(() => {
    updateCustomerSummary();
  }, [updateCustomerSummary]);

  const selectedCustomerData = selectedCustomerKey ? customerSummary.get(selectedCustomerKey) : null;
  const isMillSelected = selectedCustomerKey === MILL_OVERVIEW_KEY;
  
  const pieChartData = useMemo(() => {
    if (!selectedCustomerData || isMillSelected) return [];
    return [
      { name: 'Total Paid', value: selectedCustomerData.totalPaid },
      { name: 'Total Outstanding', value: selectedCustomerData.totalOutstanding },
    ];
  }, [selectedCustomerData, isMillSelected]);

  const PIE_CHART_COLORS = ['hsl(var(--chart-2))', 'hsl(var(--destructive))'];

  return (
    <div className="space-y-6">
        <Card>
            <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold">Select Customer</h3>
                </div>
                <div className="w-full sm:w-auto sm:min-w-64">
                    <Select onValueChange={setSelectedCustomerKey} value={selectedCustomerKey || ""}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select a customer..." />
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {isMillSelected && selectedCustomerData ? (
            <div className="lg:col-span-12 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Mill Overview (All Customers)</CardTitle>
                        <CardDescription>A complete financial and transactional overview of the entire business.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Gross Weight" value={`${selectedCustomerData.totalGrossWeight.toFixed(2)} kg`} icon={<Box />} />
                        <StatCard title="Total Teir Weight" value={`${selectedCustomerData.totalTeirWeight.toFixed(2)} kg`} icon={<Box />} />
                        <StatCard title="Total Net Weight" value={`${selectedCustomerData.totalNetWeight.toFixed(2)} kg`} icon={<Weight />} />
                        <StatCard title="Average Rate" value={`₹${selectedCustomerData.averageRate.toFixed(2)}`} icon={<Calculator />} />
                        <StatCard title="Total Karta" value={`₹${selectedCustomerData.totalKartaAmount.toFixed(2)}`} icon={<Percent />} colorClass="text-destructive" />
                        <StatCard title="Total Laboury" value={`₹${selectedCustomerData.totalLabouryAmount.toFixed(2)}`} icon={<Users />} colorClass="text-destructive" />
                        <StatCard title="Total CD" value={`₹${selectedCustomerData.totalCdAmount.toFixed(2)}`} icon={<Percent />} colorClass="text-destructive" />
                        <StatCard title="Total Transactions" value={`${selectedCustomerData.totalTransactions}`} icon={<Briefcase />} />
                        <StatCard title="Total Outstanding" value={`₹${selectedCustomerData.totalOutstanding.toFixed(2)}`} icon={<Banknote />} colorClass="text-destructive" />
                        <StatCard title="Total Paid" value={`₹${selectedCustomerData.totalPaid.toFixed(2)}`} icon={<Banknote />} colorClass="text-green-500" />
                        <StatCard title="Total Outstanding Entries" value={`${selectedCustomerData.totalOutstandingTransactions}`} icon={<FileText />} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
                    <CardContent>
                        <ScrollArea className="h-96">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>SR No</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedCustomerData.allTransactions.map(entry => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="font-mono">{entry.srNo}</TableCell>
                                            <TableCell>{toTitleCase(entry.name)}</TableCell>
                                            <TableCell className="text-right font-semibold">₹{parseFloat(String(entry.amount)).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge variant={parseFloat(String(entry.netAmount)) === 0 ? "secondary" : "destructive"}>
                                                    {parseFloat(String(entry.netAmount)) === 0 ? "Paid" : "Outstanding"}
                                                </Badge>
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
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedCustomerData.allPayments.map(payment => (
                                        <TableRow key={payment.paymentId}>
                                            <TableCell className="font-mono">{payment.paymentId}</TableCell>
                                            <TableCell>{format(new Date(payment.date), "PPP")}</TableCell>
                                            <TableCell className="text-right font-semibold">₹{payment.amount.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        ) : selectedCustomerData && (
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
                            <StatCard title="Total Outstanding" value={`₹${selectedCustomerData.totalOutstanding.toFixed(2)}`} icon={<Banknote />} colorClass="text-destructive" />
                            <StatCard title="Total Transactions" value={`₹${selectedCustomerData.totalAmount.toFixed(2)}`} icon={<Briefcase />} description={`${customers.filter(c => c.customerId === selectedCustomerKey).length} entries`}/>
                            <StatCard title="Total Paid" value={`₹${selectedCustomerData.totalPaid.toFixed(2)}`} icon={<Banknote />} colorClass="text-green-500" />
                            <StatCard title="Outstanding Entries" value={selectedCustomerData.outstandingEntryIds.length.toString()} icon={<Hash />} />
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
                                    formatter={(value: number) => `₹${value.toFixed(2)}`}
                                />
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieChartData.map((entry, index) => (
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
                        <CardDescription>List of all transactions for this customer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>SR No</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Total Amount</TableHead>
                                        <TableHead className="text-right">Outstanding</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                {customers.filter(c => c.customerId === selectedCustomerKey).map(entry => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono">{entry.srNo}</TableCell>
                                        <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right font-semibold">₹{parseFloat(String(entry.amount)).toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-semibold text-destructive">₹{parseFloat(String(entry.netAmount)).toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Badge variant={parseFloat(String(entry.netAmount)) === 0 ? "secondary" : "destructive"}>
                                            {parseFloat(String(entry.netAmount)) === 0 ? "Paid" : "Outstanding"}
                                            </Badge>
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
      </div>
    </div>
  );
}

    