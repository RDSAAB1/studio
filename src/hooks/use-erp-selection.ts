
"use client";

import { useState, useEffect } from 'react';
import { getErpSelection } from '@/lib/tenancy';

export function useErpSelection() {
    const [selection, setSelection] = useState(() => getErpSelection());

    useEffect(() => {
        const handleChanged = (e: any) => {
            setSelection(e.detail);
        };

        window.addEventListener('erp:selection-changed', handleChanged);
        return () => window.removeEventListener('erp:selection-changed', handleChanged);
    }, []);

    return selection;
}
