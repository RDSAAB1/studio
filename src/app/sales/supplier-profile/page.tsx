
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
import { Home, Phone, User, Banknote, Landmark, Hash, UserCircle, Briefcase, Building, Info, Settings, X, Rows3, LayoutList, LayoutGrid, StepForward, UserSquare, Calendar as CalendarIcon, Truck, Wheat, Receipt, Wallet, Scale, Calculator, Percent, Server, Milestone, ArrowRight, FileText } from "lucide-react";
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

type TotalOverview = {
    totalOutstanding: number;
    totalPayments: number;
    totalTransactions: number;
}

const MILL_OVERVIEW_KEY = 'mill-overview';


export default function SupplierProfilePage() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSummary, setCustomerSummary] = useState<Map<string, CustomerSummary>>(new Map());
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);

  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');
  const [totalOverview, setTotalOverview] = useState<TotalOverview>({ totalOutstanding: 0, totalPayments: 0, totalTransactions: 0 });


  const updateCustomerSummary = useCallback(() => {
    const newSummary = new Map<string, CustomerSummary>();
    const tempPaymentHistory = new Map<string, Payment[]>();

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
                 cdAmount: 0,
                 type: 'Partial',
                 receiptType: 'Online',
                 notes: `Simulated partial payment for SR ${c.srNo}`
             })
        }
    })

    let overviewOutstanding = 0;
    let overviewPayments = 0;

    customers.forEach(entry => {
      if(!entry.customerId) return;
      const key = entry.customerId;
      if (!newSummary.has(key)) {
        newSummary.set(key, {
          name: entry.name,
          so: entry.so,
          contact: entry.contact,
          address: entry.address,
          acNo: entry.acNo,
          ifscCode: entry.ifscCode,
          bank: entry.bank,
          branch: entry.branch,
          totalOutstanding: 0,
          totalAmount: 0,
          totalPaid: 0,
          paymentHistory: tempPaymentHistory.get(key) || [], 
          outstandingEntryIds: [],
        });
      }
      const data = newSummary.get(key)!;
      const totalAmount = parseFloat(String(entry.amount));
      const netAmount = parseFloat(String(entry.netAmount));
      
      data.totalAmount += totalAmount;
      if (netAmount > 0) {
        data.totalOutstanding += netAmount;
        data.outstandingEntryIds.push(entry.id);
      }
       data.totalPaid = data.paymentHistory.reduce((acc, p) => acc + p.amount, 0);
       data.totalOutstanding = data.totalAmount - data.totalPaid;
    });

    newSummary.forEach(summary => {
        overviewOutstanding += summary.totalOutstanding;
        overviewPayments += summary.totalPaid;
    });

    setTotalOverview({
        totalOutstanding: overviewOutstanding,
        totalPayments: overviewPayments,
        totalTransactions: customers.length
    });
    
    const finalSummary = new Map<string, CustomerSummary>();
    finalSummary.set(MILL_OVERVIEW_KEY, { name: 'Mill (Total Overview)', contact: '', totalOutstanding: 0, paymentHistory: [], outstandingEntryIds: [], totalAmount: 0, totalPaid: 0 });
    newSummary.forEach((value, key) => {
      finalSummary.set(key, value);
    });

    setCustomerSummary(finalSummary);
    if (!selectedCustomerKey && finalSummary.size > 0) {
      setSelectedCustomerKey(Array.from(finalSummary.keys())[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]); 

  useEffect(() => {
    updateCustomerSummary();
  }, [updateCustomerSummary]);
  
  const handleShowDetails = (customer: Customer) => {
    setDetailsCustomer(customer);
  }

  const selectedCustomerData = selectedCustomerKey ? customerSummary.get(selectedCustomerKey) : null;

  const pieChartData = useMemo(() => {
    if (!selectedCustomerData) return [];
    return [
      { name: 'Total Paid', value: selectedCustomerData.totalPaid },
      { name: 'Total Outstanding', value: selectedCustomerData.totalOutstanding },
    ];
  }, [selectedCustomerData]);

  const PIE_CHART_COLORS = [
    'hsl(var(--chart-2))',
    'hsl(var(--destructive))',
  ];

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
  )

  const isMillSelected = selectedCustomerKey === MILL_OVERVIEW_KEY;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <UserCircle className="h-5 w-5 text-primary" />
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {isMillSelected ? (
             <div className="lg:col-span-12 space-y-6">
                <Card>
                    <CardHeader><CardTitle>Total Overview (All Suppliers)</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <StatCard title="Total Outstanding" value={`₹${totalOverview.totalOutstanding.toFixed(2)}`} icon={<Banknote />} colorClass="text-destructive" />
                        <StatCard title="Total Payments" value={`₹${totalOverview.totalPayments.toFixed(2)}`} icon={<Banknote />} colorClass="text-green-500" />
                        <StatCard title="Total Transactions" value={totalOverview.totalTransactions.toString()} icon={<Briefcase />} />
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
                        <CardDescription>List of all transactions for this supplier.</CardDescription>
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
                                        <TableHead className="text-center">Details</TableHead>
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
                                        <TableCell className="text-center">
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
      </div>

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
                {/* Layout 1: Classic ID Card */}
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
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Scale size={12} />Gross Weight</TableCell><TableCell className="text-right font-semibold p-1">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Scale size={12} />Teir Weight (Less)</TableCell><TableCell className="text-right font-semibold p-1">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
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
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Calculator size={12} />Rate</TableCell><TableCell className="text-right font-semibold p-1">@ ₹{detailsCustomer.rate.toFixed(2)}</TableCell></TableRow>
                                        <TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Banknote size={12} />Total Amount</TableCell><TableCell className="text-right font-bold p-2">₹ {detailsCustomer.amount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Percent size={12} />Karta ({detailsCustomer.kartaPercentage}%)</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- ₹ {detailsCustomer.kartaAmount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Server size={12} />Laboury Rate</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">@ {detailsCustomer.labouryRate.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Milestone size={12} />Laboury Amount</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- ₹ {detailsCustomer.labouryAmount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Landmark size={12} />Kanta</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- ₹ {detailsCustomer.kanta.toFixed(2)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                             </CardContent>
                        </Card>
                    </div>

                    <Card className="border-primary/50 bg-primary/5 text-center">
                         <CardContent className="p-3">
                            <p className="text-sm text-primary/80 font-medium">Net Payable Amount</p>
                            <p className="text-3xl font-bold text-primary font-mono">
                                ₹{Number(detailsCustomer.netAmount).toFixed(2)}
                            </p>
                         </CardContent>
                    </Card>
                  </div>
                )}
                 {/* Layout 2: Compact List */}
                 {activeLayout === 'compact' && (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Supplier</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                <DetailItem icon={<Hash size={14} />} label="SR No." value={detailsCustomer.srNo} />
                                <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                                <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(detailsCustomer.so)} />
                                <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsCustomer.contact} />
                                <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsCustomer.address)} />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Transaction</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                <DetailItem icon={<CalendarIcon size={14} />} label="Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                                <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                                <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsCustomer.vehicleNo.toUpperCase()} />
                                <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />
                                <DetailItem icon={<Receipt size={14} />} label="Receipt Type" value={detailsCustomer.receiptType} />
                                <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsCustomer.paymentType} />
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Financials</CardTitle></CardHeader>
                             <CardContent className="p-4 pt-2">
                                <Table className="text-sm">
                                    <TableBody>
                                        <TableRow><TableCell className="p-2">Gross Weight</TableCell><TableCell className="text-right p-2 font-semibold">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2">Teir Weight</TableCell><TableCell className="text-right p-2 font-semibold">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow className="border-t border-dashed"><TableCell className="p-2 font-bold">Final Weight</TableCell><TableCell className="text-right p-2 font-bold">{detailsCustomer.weight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2">Net Weight</TableCell><TableCell className="text-right p-2 font-semibold">{detailsCustomer.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2">Rate</TableCell><TableCell className="text-right p-2 font-semibold">@ ₹{detailsCustomer.rate.toFixed(2)}</TableCell></TableRow>
                                        <TableRow className="border-t border-dashed"><TableCell className="p-2 font-bold">Total Amount</TableCell><TableCell className="text-right p-2 font-bold">₹ {detailsCustomer.amount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2 text-destructive">Karta ({detailsCustomer.kartaPercentage}%)</TableCell><TableCell className="text-right p-2 font-semibold text-destructive">- ₹ {detailsCustomer.kartaAmount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2 text-destructive">Laboury (@{detailsCustomer.labouryRate.toFixed(2)})</TableCell><TableCell className="text-right p-2 font-semibold text-destructive">- ₹ {detailsCustomer.labouryAmount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2 text-destructive">Kanta</TableCell><TableCell className="text-right p-2 font-semibold text-destructive">- ₹ {detailsCustomer.kanta.toFixed(2)}</TableCell></TableRow>
                                        <TableRow className="bg-primary/5"><TableCell className="p-2 font-extrabold text-primary">Net Payable Amount</TableCell><TableCell className="text-right p-2 text-xl font-extrabold text-primary">₹{Number(detailsCustomer.netAmount).toFixed(2)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                             </CardContent>
                        </Card>
                    </div>
                )}
                {/* Layout 3: Grid */}
                {activeLayout === 'grid' && (
                     <div className="space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                            <DetailItem icon={<Hash size={14} />} label="SR No." value={detailsCustomer.srNo} />
                            <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                            <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(detailsCustomer.so)} />
                             <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsCustomer.contact} />
                            <DetailItem icon={<CalendarIcon size={14} />} label="Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                            <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                            <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsCustomer.vehicleNo.toUpperCase()} />
                            <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />
                            <DetailItem icon={<Receipt size={14} />} label="Receipt Type" value={detailsCustomer.receiptType} />
                            <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsCustomer.paymentType} />
                            <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsCustomer.address)} className="md:col-span-3" />
                         </div>
                         <Separator />
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                             <Table className="text-sm">
                                <TableBody>
                                    <TableRow><TableCell className="p-2">Gross Weight</TableCell><TableCell className="text-right p-2 font-semibold">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow><TableCell className="p-2">Teir Weight</TableCell><TableCell className="text-right p-2 font-semibold">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow className="border-t border-dashed bg-muted/30"><TableCell className="p-2 font-bold">Final Weight</TableCell><TableCell className="text-right p-2 font-bold">{detailsCustomer.weight.toFixed(2)} kg</TableCell></TableRow>
                                </TableBody>
                            </Table>
                             <Table className="text-sm">
                                <TableBody>
                                    <TableRow><TableCell className="p-2">Net Weight</TableCell><TableCell className="text-right p-2 font-semibold">{detailsCustomer.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow><TableCell className="p-2">Rate</TableCell><TableCell className="text-right p-2 font-semibold">@ ₹{detailsCustomer.rate.toFixed(2)}</TableCell></TableRow>
                                    <TableRow className="border-t border-dashed bg-muted/30"><TableCell className="p-2 font-bold">Total Amount</TableCell><TableCell className="text-right p-2 font-bold">₹ {detailsCustomer.amount.toFixed(2)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                         </div>
                         <Separator />
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
                             <DetailItem icon={<Percent size={14} />} label={`Karta (${detailsCustomer.kartaPercentage}%)`} value={`- ₹ ${detailsCustomer.kartaAmount.toFixed(2)}`} className="text-destructive" />
                             <DetailItem icon={<Milestone size={14} />} label={`Laboury (@${detailsCustomer.labouryRate.toFixed(2)})`} value={`- ₹ ${detailsCustomer.labouryAmount.toFixed(2)}`} className="text-destructive" />
                             <DetailItem icon={<Landmark size={14} />} label="Kanta" value={`- ₹ ${detailsCustomer.kanta.toFixed(2)}`} className="text-destructive" />
                         </div>
                        <Card className="border-primary/50 bg-primary/5 text-center mt-4">
                            <CardContent className="p-3">
                                <p className="text-sm text-primary/80 font-medium">Net Payable Amount</p>
                                <p className="text-3xl font-bold text-primary font-mono">
                                    ₹{Number(detailsCustomer.netAmount).toFixed(2)}
                                </p>
                            </CardContent>
                        </Card>
                     </div>
                )}
                {/* Layout 4: Step-by-Step */}
                {activeLayout === 'step-by-step' && (
                  <div className="flex flex-col md:flex-row items-start justify-center gap-4">
                      <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
                        <div className="flex-1 space-y-4">
                            <Card>
                                <CardHeader className="p-4"><CardTitle className="text-base flex items-center gap-2"><User size={16}/>Supplier Details</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0 space-y-2">
                                    <DetailItem icon={<Hash size={14} />} label="SR No." value={detailsCustomer.srNo} />
                                    <DetailItem icon={<UserSquare size={14} />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                                    <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsCustomer.contact} />
                                    <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsCustomer.address)} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="p-4"><CardTitle className="text-base flex items-center gap-2"><FileText size={16}/>Transaction Details</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0 space-y-2">
                                    <DetailItem icon={<CalendarIcon size={14} />} label="Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                                    <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                                    <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsCustomer.vehicleNo.toUpperCase()} />
                                    <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />
                                    <DetailItem icon={<Receipt size={14} />} label="Receipt Type" value={detailsCustomer.receiptType} />
                                    <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsCustomer.paymentType} />
                                </CardContent>
                            </Card>
                        </div>
                      </div>
                      <div className="self-center p-2 hidden md:block">
                          <ArrowRight className="text-muted-foreground"/>
                      </div>
                       <div className="flex-1 w-full">
                          <Card>
                              <CardHeader className="p-4"><CardTitle className="text-base flex items-center gap-2"><Scale size={16}/>Weight Calculation</CardTitle></CardHeader>
                              <CardContent className="p-4 pt-0">
                                  <Table className="text-xs">
                                      <TableBody>
                                          <TableRow><TableCell className="p-1">Gross Weight</TableCell><TableCell className="text-right p-1 font-semibold">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1">Teir Weight</TableCell><TableCell className="text-right p-1 font-semibold">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                          <TableRow className="bg-muted/50"><TableCell className="p-2 font-bold">Final Weight</TableCell><TableCell className="text-right p-2 font-bold">{detailsCustomer.weight.toFixed(2)} kg</TableCell></TableRow>
                                      </TableBody>
                                  </Table>
                              </CardContent>
                          </Card>
                      </div>
                      <div className="self-center p-2 hidden md:block">
                          <ArrowRight className="text-muted-foreground"/>
                      </div>
                       <div className="flex-1 w-full">
                          <Card>
                               <CardHeader className="p-4"><CardTitle className="text-base flex items-center gap-2"><Banknote size={16}/>Financial Breakdown</CardTitle></CardHeader>
                               <CardContent className="p-4 pt-0">
                                  <Table className="text-xs">
                                      <TableBody>
                                          <TableRow><TableCell className="p-1">Net Weight</TableCell><TableCell className="text-right p-1 font-semibold">{detailsCustomer.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1">Rate</TableCell><TableCell className="text-right p-1 font-semibold">@ ₹{detailsCustomer.rate.toFixed(2)}</TableCell></TableRow>
                                          <TableRow className="border-t border-dashed"><TableCell className="p-1 font-bold">Total</TableCell><TableCell className="text-right p-1 font-bold">₹ {detailsCustomer.amount.toFixed(2)}</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1 text-destructive">Karta ({detailsCustomer.kartaPercentage}%)</TableCell><TableCell className="text-right p-1 font-semibold text-destructive">- ₹ {detailsCustomer.kartaAmount.toFixed(2)}</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1 text-destructive">Laboury (@{detailsCustomer.labouryRate.toFixed(2)})</TableCell><TableCell className="text-right p-1 font-semibold text-destructive">- ₹ {detailsCustomer.labouryAmount.toFixed(2)}</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1 text-destructive">Kanta</TableCell><TableCell className="text-right p-1 font-semibold text-destructive">- ₹ {detailsCustomer.kanta.toFixed(2)}</TableCell></TableRow>
                                          <TableRow className="bg-primary/5"><TableCell className="p-2 font-extrabold text-primary">Net Payable</TableCell><TableCell className="text-right p-2 text-xl font-extrabold text-primary">₹{Number(detailsCustomer.netAmount).toFixed(2)}</TableCell></TableRow>
                                      </TableBody>
                                  </Table>
                               </CardContent>
                          </Card>
                      </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
