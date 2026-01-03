
"use client";

import PlaceholderPage from "@/components/placeholder-page";
import { useEffect, useState } from "react";
import { collection, query, onSnapshot, orderBy, Timestamp } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase"; // Assuming db is exported from your firebase.ts
import { Customer } from "@/lib/definitions"; // Assuming Customer type includes relevant fields for reports
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";


export default function SalesReportsPage() {
  const [salesData, setSalesData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSalesAmount, setTotalSalesAmount] = useState(0);
  const [averageSaleAmount, setAverageSaleAmount] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useEffect(() => {
    // ✅ Use incremental sync - only read changed documents
    const getLastSyncTime = (): number | undefined => {
      if (typeof window === 'undefined') return undefined;
      const stored = localStorage.getItem('lastSync:customers');
      return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    const salesCollectionRef = collection(firestoreDB, "customers");
    let q;
    
    if (lastSyncTime) {
      // ✅ Only get documents modified after last sync
      const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
      q = query(
        salesCollectionRef,
        where('updatedAt', '>', lastSyncTimestamp),
        orderBy('updatedAt')
      );
    } else {
      // First sync - get all (only once)
      q = query(salesCollectionRef, orderBy("date", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Customer[] = [];
      let totalAmount = 0;
      snapshot.forEach((doc) => {
        const docData = doc.data();
        const customer: Customer = {
          id: doc.id,
          srNo: docData.srNo,
          date: (docData.date instanceof Timestamp) ? docData.date.toDate().toISOString().split('T')[0] : docData.date,
          term: docData.term,
          dueDate: (docData.dueDate instanceof Timestamp) ? docData.dueDate.toDate().toISOString().split('T')[0] : docData.dueDate,
          name: docData.name,
          so: docData.so,
          address: docData.address,
          contact: docData.contact,
          vehicleNo: docData.vehicleNo,
          variety: docData.variety,
          grossWeight: docData.grossWeight,
          teirWeight: docData.teirWeight,
          weight: docData.weight,
          kartaPercentage: docData.kartaPercentage,
          kartaWeight: docData.kartaWeight,
          kartaAmount: docData.kartaAmount,
          netWeight: docData.netWeight,
          rate: docData.rate,
          labouryRate: docData.labouryRate,
          labouryAmount: docData.labouryAmount,
          kanta: docData.kanta,
          amount: docData.amount,
          netAmount: docData.netAmount,
          originalNetAmount: docData.originalNetAmount,
          barcode: docData.barcode,
          receiptType: docData.receiptType,
          paymentType: docData.paymentType,
          customerId: docData.customerId,
          payments: docData.payments || [], // Assuming payments might be stored here
        };
        data.push(customer);
        totalAmount += customer.netAmount || 0;
      });
      setSalesData(data);
      setTotalSalesAmount(totalAmount);
      setTotalTransactions(data.length);
      setAverageSaleAmount(data.length > 0 ? totalAmount / data.length : 0);
      setLoading(false);
      
      // ✅ Save last sync time
      if (snapshot.size > 0 && typeof window !== 'undefined') {
        localStorage.setItem('lastSync:customers', String(Date.now()));
      }
    }, (error) => {

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> Loading Reports...</div>;
  }

  if (salesData.length === 0) {
    return <PlaceholderPage title="Sales Reports" description="No sales data available to generate reports." />;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Sales Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Total Sales Amount</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalSalesAmount)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Average Sale Amount</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(averageSaleAmount)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Total Transactions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalTransactions}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Sales Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-2 text-xs">Date</TableHead>
                  <TableHead className="px-3 py-2 text-xs">SR No.</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Name</TableHead>
                  <TableHead className="px-3 py-2 text-xs">Variety</TableHead>
                  <TableHead className="text-right px-3 py-2 text-xs">Net Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="px-3 py-2 text-sm">{format(new Date(sale.date), "dd-MMM-yy")}</TableCell>
                    <TableCell className="font-mono px-3 py-2 text-sm">{sale.srNo}</TableCell>
                    <TableCell className="px-3 py-2 text-sm">{sale.name}</TableCell>
                    <TableCell className="px-3 py-2 text-sm">{sale.variety}</TableCell>
                    <TableCell className="text-right font-semibold px-3 py-2 text-sm">{formatCurrency(Number(sale.netAmount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
