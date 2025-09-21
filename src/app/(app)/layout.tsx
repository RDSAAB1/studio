
"use client";

import { type ReactNode } from 'react';
import AppLayoutWrapper from '@/components/layout/app-layout';

export default function AppGroupLayout({ children }: { children: ReactNode }) {
    return (
        <AppLayoutWrapper>
            {children}
        </AppLayoutWrapper>
    );
}
