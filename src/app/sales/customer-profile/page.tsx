
"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function CustomerProfilePage() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSummary, setCustomerSummary] = useState<Map<string, CustomerSummary>>(new Map());
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);

  const updateCustomerSummary = useCallback(() => {
    const newSummary = new Map<string, CustomerSummary>();
    const tempPaymentHistory = new Map<string, Payment[]>();

    // First, let's process payments from somewhere, for now, we'll imagine they are tied to a customerId
    // In a real app, you'd fetch payments. For now, we simulate some.
    initialCustomers.forEach((c, index) => {
        if(!tempPaymentHistory.has(c.customerId)) {
            tempPaymentHistory.set(c.customerId, []);
        }
        if(index % 2 === 0 && c.netAmount > 5000) {
             tempPaymentHistory.get(c.customerId)?.push({
                 paymentId: `P0000${index + 1}`,
                 date: '2025-07-28',
                 amount: c.netAmount / 2,
                 cdAmount: 0,
                 type: 'Partial',
                 receiptType: 'Online',
                 notes: `Simulated partial payment for SR ${c.srNo}`
             })
        }
    })

    initialCustomers.forEach(entry => {
      const key = entry.customerId;
      if (!newSummary.has(key)) {
        newSummary.set(key, {
          name: entry.name,
          contact: entry.contact,
          totalOutstanding: 0,
          paymentHistory: tempPaymentHistory.get(key) || [], 
          outstandingEntryIds: [],
        });
      }
      const data = newSummary.get(key)!;
      if (entry.netAmount > 0) {
        data.totalOutstanding += entry.netAmount;
        data.outstandingEntryIds.push(entry.id);
      }
    });

    setCustomerSummary(newSummary);
    if (!selectedCustomerKey && newSummary.size > 0) {
      setSelectedCustomerKey(Array.from(newSummary.keys())[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove selectedCustomerKey from dependencies to avoid re-running on select

  useEffect(() => {
    updateCustomerSummary();
  }, [updateCustomerSummary]);

  const selectedCustomerData = selectedCustomerKey ? customerSummary.get(selectedCustomerKey) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Customer Profile</h1>
        <p className="text-muted-foreground">View detailed profiles and payment history for each customer.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Customer</CardTitle>
          <CardDescription>Choose a customer to view their detailed information.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedCustomerKey} value={selectedCustomerKey || undefined}>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>{toTitleCase(selectedCustomerData.name)}</CardTitle>
                <CardDescription>{selectedCustomerData.contact}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Outstanding</p>
                  <p className="text-2xl font-bold text-primary">
                    {selectedCustomerData.totalOutstanding.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Entries</p>
                  <p className="text-2xl font-bold">
                    {selectedCustomerData.outstandingEntryIds.length}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCustomerData.paymentHistory.length > 0 ? (
                        selectedCustomerData.paymentHistory.map(p => (
                          <TableRow key={p.paymentId}>
                            <TableCell>{p.paymentId}</TableCell>
                            <TableCell>{p.date}</TableCell>
                            <TableCell>{p.amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">No payment history</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
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
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customers
                        .filter(c => c.customerId === selectedCustomerKey)
                        .map(entry => (
                            <TableRow key={entry.id}>
                            <TableCell>{entry.srNo}</TableCell>
                            <TableCell>{entry.date}</TableCell>
                            <TableCell>{entry.amount.toFixed(2)}</TableCell>
                            <TableCell>
                                <Badge variant={entry.netAmount === 0 ? "secondary" : "destructive"}>
                                {entry.netAmount === 0 ? "Paid" : "Outstanding"}
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
        </div>
      )}
    </div>
  );
}
