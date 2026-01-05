import CashBankClient from "./cash-bank-client";
import type { PageProps } from '@/app/types';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export default function CashBankPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 w-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading Cash & Bank...</p>
        </div>
      </div>
    }>
      <CashBankClient />
    </Suspense>
  );
}
