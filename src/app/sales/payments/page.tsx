"use client";

import React, { Suspense, use } from "react";
import { useSearchParams } from 'next/navigation';
import UnifiedPaymentsPage from "./unified-payments-page";

function PaymentsPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'supplier';
  
  return <UnifiedPaymentsPage defaultTab={tab as 'supplier' | 'customer' | 'outsider'} />;
}

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export default function PaymentsPage(props: PageProps) {
  if (props.searchParams) use(props.searchParams);
  return (
    <Suspense fallback={null}>
      <PaymentsPageContent />
    </Suspense>
  );
}
