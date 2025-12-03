"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') || 'supplier';
  
  // Redirect to new direct paths
  useEffect(() => {
    const validTab = (tabParam === 'supplier' || tabParam === 'customer' || tabParam === 'outsider') 
      ? tabParam 
      : 'supplier';
    
    router.replace(`/sales/payments-${validTab}`);
  }, [tabParam, router]);
  
  return null;
}

