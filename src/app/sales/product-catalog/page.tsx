"use client";

import PlaceholderPage from "@/components/placeholder-page";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Assuming db is exported from firebase.ts
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ProductCatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData: any[] = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsData);
      setLoading(false);
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
