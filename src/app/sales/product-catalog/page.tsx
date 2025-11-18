
"use client";

import PlaceholderPage from "@/components/placeholder-page";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, Timestamp } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase"; // Assuming db is exported from firebase.ts
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ProductCatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ Use incremental sync - only read changed documents
    const getLastSyncTime = (): number | undefined => {
      if (typeof window === 'undefined') return undefined;
      const stored = localStorage.getItem('lastSync:products');
      return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    
    if (lastSyncTime) {
      // ✅ Only get documents modified after last sync
      const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
      q = query(
        collection(firestoreDB, "products"),
        where('updatedAt', '>', lastSyncTimestamp),
        orderBy('updatedAt')
      );
    } else {
      // First sync - get all (only once)
      q = query(collection(firestoreDB, "products"));
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData: any[] = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsData);
      setLoading(false);
      
      // ✅ Save last sync time
      if (querySnapshot.size > 0 && typeof window !== 'undefined') {
        localStorage.setItem('lastSync:products', String(Date.now()));
      }
    }, (err) => {
      console.error("Error fetching products:", err);
      setError("Failed to load products.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <PlaceholderPage title="Product Catalog" description="Loading products..." />;
  }

  // TODO: Implement proper product catalog display using the 'products' state.
  return <PlaceholderPage title="Product Catalog" description="Product data loaded. Implementation pending." />;
}
