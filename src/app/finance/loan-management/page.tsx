
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { electronNavigate } from '@/lib/electron-navigate';

// This page is deprecated and will redirect to the Cash & Bank page.
export default function LoanManagementRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        electronNavigate('/sales?menu=cash-bank&tab=cash-bank-management', router);
    }, [router]);

    return (
        <div>
            <p>Redirecting to Cash & Bank...</p>
        </div>
    );
}
