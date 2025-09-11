
"use client";

import { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Assuming db is exported from firebase.ts
import type { Customer } from "@/lib/definitions"; // Assuming Customer type is relevant
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ShoppingBag } from 'lucide-react'; // Example icons

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  // Add more state variables for other data needed for analytics, e.g., orders, campaigns

  useEffect(() => {
    const q = query(collection(db, "customers")); // Example: fetch customer data

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Customer
      }));
      setCustomers(customersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customers: ", error);
      setLoading(false);
      // Handle error appropriately
    });

    // Implement similar fetching for other relevant collections (e.g., 'orders', 'campaigns')

    return () => unsubscribe(); // Clean up listener on component unmount
  }, []);

  // Example: Simple transformation for a chart (e.g., customers by date)
  const customersByDate = customers.reduce((acc, customer) => {
    const date = new Date(customer.date).toLocaleDateString(); // Assuming customer has a date field
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const chartData = Object.entries(customersByDate).map(([date, count]) => ({ date, count }));

  if (loading) {
    return <div>Loading Analytics...</div>; // Or a loading spinner
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Sales Trends Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Add more cards or sections for different analytics views */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{customers.length}</div></CardContent>
        </Card>
        {/* Add more summary cards */}
      </div>
    </div>
  );
}
