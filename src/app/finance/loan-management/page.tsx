
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is deprecated and will redirect to the Cash & Bank page.
export default function LoanManagementRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/cash-bank');
    }, [router]);

    return (
        <div>
            <p>Redirecting to Cash & Bank...</p>
        </div>
    );
}
