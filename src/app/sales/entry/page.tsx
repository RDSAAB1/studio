"use client";

import { useSearchParams } from 'next/navigation';
import UnifiedEntryPage from "./unified-entry-page";

export default function EntryPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'supplier';
  
  return <UnifiedEntryPage defaultTab={tab as 'supplier' | 'customer'} />;
}

