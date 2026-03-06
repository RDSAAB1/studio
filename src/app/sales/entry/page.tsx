"use client";

import React, { use } from "react";
import { useSearchParams } from 'next/navigation';
import UnifiedEntryPage from "./unified-entry-page";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export default function EntryPage(props: PageProps) {
  if (props.searchParams) use(props.searchParams);
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'supplier';

  return <UnifiedEntryPage defaultTab={tab as 'supplier' | 'customer'} />;
}

