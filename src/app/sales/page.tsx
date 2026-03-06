"use client";

import React, { Suspense, use } from "react";
import { useSearchParams } from 'next/navigation';
import UnifiedSalesPage from "./unified-sales-page";

function SalesPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'supplier-entry';
  const menu = searchParams.get('menu') || 'entry';
  
  // Map old tab names to new ones for backward compatibility
  const tabMap: Record<string, string> = {
    'supplier': 'supplier-entry',
    'customer': 'customer-entry',
  };
  
  const mappedTab = tabMap[tab] || tab;
  
  return <UnifiedSalesPage defaultTab={mappedTab as any} defaultMenu={menu as any} />;
}

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export default function SalesPage(props: PageProps) {
  if (props.searchParams) use(props.searchParams);
  return (
    <Suspense fallback={null}>
      <SalesPageContent />
    </Suspense>
  );
}

