"use client";

import { useState, useEffect, useMemo, startTransition, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getPaymentsRealtime, getBanksRealtime, getSupplierBankAccountsRealtime, getBankBranchesRealtime, getReceiptSettings } from "@/lib/firestore";
import type { Payment, Bank, BankAccount, BankBranch, ReceiptSettings } from "@/lib/definitions";

export const useOutsiderData = () => {
    const { toast } = useToast();
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [bankBranches, setBankBranches] = useState<BankBranch[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);

    // Function to remove a payment from state immediately (for immediate UI feedback)
    const removePaymentFromState = useCallback((paymentId: string) => {
        setPaymentHistory(prev => prev.filter(p => 
            p.id !== paymentId && 
            p.paymentId !== paymentId && 
            (p as any).rtgsSrNo !== paymentId
        ));
    }, []);
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;

        let isSubscribed = true;
        let dataLoadCount = 0;
        const totalListeners = 5; // 4 realtime + 1 receipt settings
        
        const checkAllLoaded = () => {
            dataLoadCount++;
            if (dataLoadCount >= totalListeners && isSubscribed) {
                startTransition(() => {
                    setLoading(false);
                });
            }
        };
        
        // Only load RTGS outsider payments (customerId === 'OUTSIDER')
        const unsubFunctions = [
            getPaymentsRealtime(data => { 
                if (isSubscribed) {
                    // Filter to only RTGS outsider payments
                    const outsiderPayments = (data || []).filter((p: Payment) => 
                        p.customerId === 'OUTSIDER' && (p.receiptType || '').toLowerCase() === 'rtgs'
                    );
                    startTransition(() => setPaymentHistory(outsiderPayments));
                    checkAllLoaded();
                }
            }, error => {

                checkAllLoaded();
            }),
            getBanksRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setBanks(data));
                    checkAllLoaded();
                }
            }, error => {

                checkAllLoaded();
            }),
            getBankBranchesRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setBankBranches(data));
                    checkAllLoaded();
                }
            }, error => {

                checkAllLoaded();
            }),
            getSupplierBankAccountsRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setBankAccounts(data));
                    checkAllLoaded();
                }
            }, error => {

                checkAllLoaded();
            }),
        ];

        getReceiptSettings().then(settings => {
            if (isSubscribed) {
                startTransition(() => setReceiptSettings(settings));
                checkAllLoaded();
            }
        }).catch(error => {

            checkAllLoaded();
        });

        return () => {
            isSubscribed = false;
            unsubFunctions.forEach(unsub => unsub());
        };
    }, [isClient]);

    return {
        paymentHistory,
        banks,
        bankBranches,
        bankAccounts,
        receiptSettings,
        loading,
        isClient,
        suppliers: [], // Empty for outsider
        customerSummaryMap: new Map(), // Empty for outsider
        removePaymentFromState, // Function to immediately remove payment from state
    };
};

