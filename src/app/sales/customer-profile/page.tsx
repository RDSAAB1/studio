
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Home, Phone, User, Banknote, Landmark, Hash } from "lucide-react";


export default function CustomerProfilePage() {
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

  const chartData = useMemo(() => {
    if (!selectedCustomerData) return [];
    return [
      {
        name: toTitleCase(selectedCustomerData.name),
        "Total Amount": selectedCustomerData.totalAmount,
        "Total Outstanding": selectedCustomerData.totalOutstanding,
        "Total Paid": selectedCustomerData.totalPaid,
      },
    ];
  }, [selectedCustomerData]);

  const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) => (
    <div>
        <dt className="text-sm text-muted-foreground flex items-center gap-2"><span className="text-primary">{icon}</span>{label}</dt>
        <dd className="font-semibold">{value || '-'}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Customer</CardTitle>
          <CardDescription>Choose a customer to view their detailed information.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedCustomerKey} value={selectedCustomerKey || ""}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Select a customer..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from(customerSummary.entries()).map(([key, data]) => (
                <SelectItem key={key} value={key}>
                  {toTitleCase(data.name)} ({data.contact})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCustomerData && (
        <div className="space-y-6">
            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-xl">{toTitleCase(selectedCustomerData.name)}</CardTitle>
                    <CardDescription>S/O: {toTitleCase(selectedCustomerData.so || '')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Outstanding</p>
                            <p className="text-2xl font-bold text-destructive">₹{selectedCustomerData.totalOutstanding.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Transactions</p>
                            <p className="text-2xl font-bold">₹{selectedCustomerData.totalAmount.toFixed(2)}</p>
                        </div>
                         <div>
                            <p className="text-sm text-muted-foreground">Total Paid</p>
                            <p className="text-2xl font-bold text-green-500">₹{selectedCustomerData.totalPaid.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Outstanding Entries</p>
                            <p className="text-2xl font-bold">{selectedCustomerData.outstandingEntryIds.length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                     <Card>
                        <CardHeader>
                            <CardTitle>Financial Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `₹${value/1000}k`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                        fontSize: '12px',
                                        borderRadius: 'var(--radius)'
                                    }}
                                    formatter={(value: number) => `₹${value.toFixed(2)}`}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Bar dataKey="Total Amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Total Paid" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Total Outstanding" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                            </ResponsiveContainer>
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
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Contact & Address</CardTitle></CardHeader>
                        <CardContent>
                            <dl className="space-y-4">
                                <DetailItem icon={<User size={14} />} label="S/O" value={toTitleCase(selectedCustomerData.so || '')} />
                                <DetailItem icon={<Phone size={14} />} label="Contact" value={selectedCustomerData.contact} />
                                <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(selectedCustomerData.address || '')} />
                            </dl>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
                        <CardContent>
                            <dl className="space-y-4">
                                <DetailItem icon={<Hash size={14} />} label="A/C No." value={selectedCustomerData.acNo} />
                                <DetailItem icon={<Landmark size={14} />} label="IFSC" value={selectedCustomerData.ifscCode} />
                                <DetailItem icon={<Banknote size={14} />} label="Bank" value={toTitleCase(selectedCustomerData.bank || '')} />
                                <DetailItem icon={<Landmark size={14} />} label="Branch" value={toTitleCase(selectedCustomerData.branch || '')} />
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
