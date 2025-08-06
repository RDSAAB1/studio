
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { initialCustomers } from "@/lib/data";
import type { Customer, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";

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
import { Home, Phone, User, Banknote, Landmark, Hash, UserCircle, Briefcase } from "lucide-react";


export default function SupplierProfilePage() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSummary, setCustomerSummary] = useState<Map<string, CustomerSummary>>(new Map());
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);

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
       data.totalPaid = data.totalAmount - data.totalOutstanding;
    });

    setCustomerSummary(newSummary);
    if (!selectedCustomerKey && newSummary.size > 0) {
      setSelectedCustomerKey(Array.from(newSummary.keys())[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]); 

  useEffect(() => {
    updateCustomerSummary();
  }, [updateCustomerSummary]);

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

  const DetailItem = ({ icon, label, value, className }: { icon: React.ReactNode, label: string, value: any, className?: string }) => (
    <div className={className}>
        <dt className="text-sm text-muted-foreground flex items-center gap-2"><span className="text-primary">{icon}</span>{label}</dt>
        <dd className="font-semibold text-lg">{value || '-'}</dd>
    </div>
  );

  const StatCard = ({ title, value, icon, colorClass }: { title: string, value: string, icon: React.ReactNode, colorClass?: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Select Supplier</h3>
            </div>
            <div className="w-full sm:w-auto sm:min-w-64">
                <Select onValueChange={setSelectedCustomerKey} value={selectedCustomerKey || ""}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(customerSummary.entries()).map(([key, data]) => (
                        <SelectItem key={key} value={key}>
                          {toTitleCase(data.name)} ({data.contact})
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {selectedCustomerData && (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{toTitleCase(selectedCustomerData.name)}</h1>
                <p className="text-muted-foreground">S/O: {toTitleCase(selectedCustomerData.so || '')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Outstanding" value={`₹${selectedCustomerData.totalOutstanding.toFixed(2)}`} icon={<Banknote />} colorClass="text-destructive" />
              <StatCard title="Total Transactions" value={`₹${selectedCustomerData.totalAmount.toFixed(2)}`} icon={<Briefcase />} />
              <StatCard title="Total Paid" value={`₹${selectedCustomerData.totalPaid.toFixed(2)}`} icon={<Banknote />} colorClass="text-green-500" />
              <StatCard title="Outstanding Entries" value={selectedCustomerData.outstandingEntryIds.length.toString()} icon={<Hash />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                     <Card>
                        <CardHeader>
                            <CardTitle>Financial Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="h-80">
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
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Contact & Address</CardTitle></CardHeader>
                        <CardContent>
                            <dl className="space-y-6">
                                <DetailItem icon={<Phone size={16} />} label="Contact" value={selectedCustomerData.contact} />
                                <DetailItem icon={<Home size={16} />} label="Address" value={toTitleCase(selectedCustomerData.address || '')} />
                            </dl>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
                        <CardContent>
                            <dl className="space-y-6">
                                <DetailItem icon={<Hash size={16} />} label="A/C No." value={selectedCustomerData.acNo} />
                                <DetailItem icon={<Landmark size={16} />} label="IFSC" value={selectedCustomerData.ifscCode} />
                                <DetailItem icon={<Banknote size={16} />} label="Bank" value={toTitleCase(selectedCustomerData.bank || '')} />
                                <DetailItem icon={<Landmark size={16} />} label="Branch" value={toTitleCase(selectedCustomerData.branch || '')} />
                            </dl>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

    