
"use client";

import { useEffect, useState } from 'react';
import PlaceholderPage from "@/components/placeholder-page";
import { collection, onSnapshot, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase'; // Assuming db is exported from firebase.ts
import { Order } from '@/lib/definitions'; // Assuming you have an Order type defined
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Info, Pen, Trash } from 'lucide-react';

export default function OrderTrackingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ Use incremental sync - only read changed documents
    const getLastSyncTime = (): number | undefined => {
      if (typeof window === 'undefined') return undefined;
      const stored = localStorage.getItem('lastSync:orders');
      return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    const ordersCollection = collection(firestoreDB, 'orders');
    let q;
    
    if (lastSyncTime) {
      // ✅ Only get documents modified after last sync
      const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
      q = query(
        ordersCollection,
        where('updatedAt', '>', lastSyncTimestamp),
        orderBy('updatedAt')
      );
    } else {
      // First sync - get all (only once)
      q = query(ordersCollection, orderBy('orderDate', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<Order, 'id'>
      })) as Order[];
      setOrders(ordersData);
      setLoading(false);
      
      // ✅ Save last sync time
      if (snapshot.size > 0 && typeof window !== 'undefined') {
        localStorage.setItem('lastSync:orders', String(Date.now()));
      }
    }, (err) => {
      console.error("Error fetching orders: ", err);
      setError("Failed to load orders.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <PlaceholderPage title="Order Tracking" message="Loading orders..." />;
  }

  if (error) {
    return <PlaceholderPage title="Order Tracking" message={`Error: ${error}`} />;
  }

  // Basic functions for actions (implement detailed logic as needed)
  const handleView = (orderId: string) => {
    console.log(`View order: ${orderId}`);
    // Implement navigation or modal to view order details
  };

  const handleEdit = (orderId: string) => {
    console.log(`Edit order: ${orderId}`);
    // Implement navigation or modal to edit order
  };

  const handleDelete = (orderId: string) => {
    console.log(`Delete order: ${orderId}`);
    // Implement delete logic using Firestore deleteDoc
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Order Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p>No orders found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.customerName}</TableCell> {/* Assuming a customerName field */}
                    <TableCell>{order.orderDate ? format(new Date(order.orderDate), 'PPP') : 'N/A'}</TableCell> {/* Assuming an orderDate field */}
                    <TableCell className="text-right">{order.totalAmount ? order.totalAmount.toFixed(2) : 'N/A'}</TableCell> {/* Assuming a totalAmount field */}
                    <TableCell className="text-center">
                       <div className="flex justify-center items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleView(order.id)}><Info className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(order.id)}><Pen className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(order.id)}><Trash className="h-4 w-4 text-destructive"/></Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
