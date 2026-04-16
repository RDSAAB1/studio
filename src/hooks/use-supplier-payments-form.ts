
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateReadableId } from '@/lib/utils';
import type { Payment, Expense, BankAccount } from '@/lib/definitions';
import { format } from 'date-fns';

export const useSupplierPaymentsForm = (paymentHistory: Payment[], expenses: Expense[], bankAccounts: BankAccount[], onConflict: (message: string) => void, paymentCategory: 'supplier' | 'customer' = 'supplier') => {
    const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
    const [serialNoSearch, setSerialNoSearch] = useState('');
    const [paymentId, setPaymentId] = useState('');
    const [rtgsSrNo, setRtgsSrNo] = useState('');
    const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentType, setPaymentType] = useState('Full');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('CashInHand');
    const [drCr, setDrCr] = useState<'Debit' | 'Credit'>('Debit');
    const [extraAmount, setExtraAmount] = useState(0);
    const [notes, setNotes] = useState('');
    const [from, setFrom] = useState('');

    const [supplierDetails, setSupplierDetails] = useState({ name: '', fatherName: '', address: '', contact: ''});
    const [bankDetails, setBankDetails] = useState({ acNo: '', ifscCode: '', bank: '', branch: '' });
    const [isPayeeEditing, setIsPayeeEditing] = useState(false);

    const [sixRNo, setSixRNo] = useState('');
    const [sixRDate, setSixRDate] = useState<Date | undefined>(new Date());
    const [parchiNo, setParchiNo] = useState('');
    const [utrNo, setUtrNo] = useState('');
    const [checkNo, setCheckNo] = useState('');
    const [centerName, setCenterName] = useState<string>('');

    const [rtgsQuantity, setRtgsQuantity] = useState(0);
    const [rtgsRate, setRtgsRate] = useState(0);
    const [rtgsAmount, setRtgsAmount] = useState(0);

    const [govQuantity, setGovQuantity] = useState(0);
    const [govRate, setGovRate] = useState(0);
    const [govAmount, setGovAmount] = useState(0);
    const [govExtraAmount, setGovExtraAmount] = useState(0);

    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [isBeingEdited, setIsBeingEdited] = useState(false); // New state to track edit mode
    
    // Auto-enable payee editing when in edit mode
    useEffect(() => {
        if (editingPayment && !isPayeeEditing) {
            setIsPayeeEditing(true);
        }
    }, [editingPayment, isPayeeEditing]);
    
    const [minRate, setMinRate] = useState<number>(0);
    const [maxRate, setMaxRate] = useState<number>(0);
    
    const [onEdit, setOnEdit] = useState<((payment: Payment) => void) | null>(null);
    const [cdEnabled, setCdEnabled] = useState(false);


    const safeBankAccounts = Array.isArray(bankAccounts) ? bankAccounts : [];

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedMinRate = localStorage.getItem('paymentMinRate');
            const savedMaxRate = localStorage.getItem('paymentMaxRate');
            setMinRate(savedMinRate ? Number(savedMinRate) : 0);
            setMaxRate(savedMaxRate ? Number(savedMaxRate) : 0);
        }
    }, []);

    const handleSetMinRate = (value: number) => {
        setMinRate(value);
        if (typeof window !== 'undefined') {
            localStorage.setItem('paymentMinRate', String(value));
        }
    };

    const handleSetMaxRate = (value: number) => {
        setMaxRate(value);
        if (typeof window !== 'undefined') {
            localStorage.setItem('paymentMaxRate', String(value));
        }
    };

    const handleSetSelectedAccountId = (accountId: string | null) => {
        if (accountId) {
            setSelectedAccountId(accountId);
            if (accountId !== 'CashInHand') {
                localStorage.setItem('defaultPaymentAccountId', accountId);
            } else {
                localStorage.removeItem('defaultPaymentAccountId');
            }
        }
    };
    
    const handleSetPaymentMethod = (method: 'Cash' | 'Online' | 'Ledger' | 'RTGS' | 'Gov.') => {
        // Always allow switching to the selected method
        setPaymentMethod(method);

        if (method === 'Ledger' || method === 'Gov.') {
            setPaymentType('Partial');
            setCdEnabled(false);
        }
        
        if (method === 'Cash') {
            handleSetSelectedAccountId('CashInHand');
            return;
        }

        if ((method === 'Online' || method === 'Ledger') && parchiNo) {
            setCheckNo(parchiNo);
        }

        // When switching to Online or RTGS, try to select a bank account
        const defaultBankId = localStorage.getItem('defaultPaymentAccountId');
        const accountExists = safeBankAccounts.some(ba => ba.id === defaultBankId);
        const firstBankId = safeBankAccounts.find(ba => ba.id !== 'CashInHand')?.id;

        // Only update account if currently on CashInHand or invalid account
        if (selectedAccountId === 'CashInHand' || !safeBankAccounts.some(ba => ba.id === selectedAccountId && ba.id !== 'CashInHand')) {
            if (defaultBankId && defaultBankId !== 'CashInHand' && accountExists) {
                handleSetSelectedAccountId(defaultBankId);
            } else if (firstBankId) {
                handleSetSelectedAccountId(firstBankId);
            }
            // If no bank accounts available, allow Online/RTGS selection anyway
            // User can add bank accounts later or select one when available
        }
    };

    useEffect(() => {
        if (editingPayment) return;
        if (paymentMethod !== 'Online' && paymentMethod !== 'Ledger') return;
        if (!parchiNo) return;
        setCheckNo(parchiNo);
    }, [paymentMethod, parchiNo, editingPayment]);


    // Next incremental numeric ID from all payments (1588 → 1589). Works with plain numbers or prefixed (SP1588, EX001).
    const getMaxNumericFromPayments = useCallback(() => {
        if (!paymentHistory || paymentHistory.length === 0) return 0;
        let max = 0;
        for (const p of paymentHistory) {
            const raw = String(p.paymentId ?? p.id ?? '').trim();
            if (!raw) continue;
            let num = 0;
            if (/^\d+$/.test(raw)) {
                num = parseInt(raw, 10);
            } else {
                const digits = raw.replace(/\D/g, '');
                if (digits) num = parseInt(digits, 10);
            }
            if (Number.isFinite(num)) max = Math.max(max, num);
        }
        return max;
    }, [paymentHistory]);

    const getNextPaymentId = useCallback((method: 'Cash' | 'Online' | 'Ledger' | 'RTGS' | 'Gov.') => {
        if (!paymentHistory || !expenses) return '';
    
        if (method === 'RTGS') {
            const rtgsPayments = paymentHistory.filter(p => p.rtgsSrNo);
            const isOutsider = selectedCustomerKey === 'OUTSIDER';
            const prefix = isOutsider ? 'RO' : 'R';
            
            const lastNum = rtgsPayments.reduce((max, p) => {
                const roMatch = p.rtgsSrNo?.match(/^RO(\d+)$/);
                const rtMatch = p.rtgsSrNo?.match(/^RT(\d+)$/);
                const rMatch = p.rtgsSrNo?.match(/^R(\d+)$/);
                
                let num = 0;
                if (isOutsider) {
                    num = roMatch ? parseInt(roMatch[1], 10) : 0;
                } else {
                    num = rtMatch ? parseInt(rtMatch[1], 10) : (rMatch ? parseInt(rMatch[1], 10) : 0);
                }
                return num > max ? num : max;
            }, 0);
            return generateReadableId(prefix, lastNum, 5); 
        }
    
        if (method === 'Gov.') {
            const govPayments = paymentHistory.filter(p => p.receiptType === 'Gov.' && (p.paymentId?.startsWith('GV') || p.paymentId?.startsWith('G')));
            const lastGovNum = govPayments.reduce((max, p) => {
                const gvMatch = p.paymentId?.match(/^GV(\d+)$/);
                const gMatch = p.paymentId?.match(/^G(\d+)$/);
                const num = gvMatch ? parseInt(gvMatch[1], 10) : (gMatch ? parseInt(gMatch[1], 10) : 0);
                return Math.max(max, num);
            }, 0);
            return generateReadableId('G', lastGovNum, 5); // Changed from GV to G
        }
    
        if (method === 'Online') {
            const onlinePayments = paymentHistory.filter(p => p.receiptType === 'Online' && p.paymentId?.startsWith('P'));
            const lastNum = onlinePayments.reduce((max, p) => {
                const numMatch = p.paymentId?.match(/^P(\d+)$/);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            return generateReadableId('P', lastNum, 5);
        }

        if (method === 'Ledger') {
            const ledgerPayments = paymentHistory.filter(p => p.receiptType === 'Ledger' && p.paymentId?.startsWith('L'));
            const lastNum = ledgerPayments.reduce((max, p) => {
                const numMatch = p.paymentId?.match(/^L(\d+)$/);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            return generateReadableId('L', lastNum, 5);
        }
    
        // Cash (and unified incremental): use EX/IX prefix with 5-digit padding
        const prefix = paymentCategory === 'customer' ? 'IX' : 'EX';
        const maxNumeric = getMaxNumericFromPayments();
        const lastExpenseNum = (expenses || []).reduce((max, e) => {
            const raw = String(e.transactionId ?? '').trim();
            const num = /^\d+$/.test(raw) ? parseInt(raw, 10) : (parseInt(raw.replace(/\D/g, ''), 10) || 0);
            return Number.isFinite(num) ? Math.max(max, num) : max;
        }, 0);
        const lastNum = Math.max(maxNumeric, lastExpenseNum, 0);
        return generateReadableId(prefix, lastNum, 5);
    }, [paymentHistory, expenses, getMaxNumericFromPayments, paymentCategory]);
    
    const handleRtgsSrNoBlur = (e: React.FocusEvent<HTMLInputElement>, onEditCallback: (payment: Payment) => void) => {
        const value = e.target.value.trim().toUpperCase();
        if (!value) return;

        const numericPartStr = value.replace(/\D/g, '');
        if (!numericPartStr) return;

        const num = parseInt(numericPartStr, 10);
        const isOutsider = selectedCustomerKey === 'OUTSIDER';
        const formattedId = (isOutsider ? 'RO' : 'R') + String(num).padStart(5, '0');
        setRtgsSrNo(formattedId);
        setPaymentId(formattedId); // Keep primary ID in sync for RTGS

        const existingPayment = paymentHistory.find(p => p.rtgsSrNo === formattedId || p.paymentId === formattedId);
        if (existingPayment) {
            onEditCallback(existingPayment);
        }
    };

    const handlePaymentIdBlur = (e: React.FocusEvent<HTMLInputElement>, onEditCallback: (payment: Payment) => void) => {
        const value = e.target.value.trim();
        if (!value) return;

        const prefix =
            paymentMethod === 'Cash'
                ? (paymentCategory === 'customer' ? 'IX' : 'EX')
                : paymentMethod === 'Ledger'
                    ? 'L'
                    : 'P';
        let formattedId = value;

        // Auto-format numeric entries into prefixed ID (e.g., 5 -> EX00005)
        if (/^\d+$/.test(value)) {
            const num = parseInt(value, 10);
            formattedId = generateReadableId(prefix, num - 1, 5);
            setPaymentId(formattedId);
        }

        const existingPayment = paymentHistory.find(
            p => (p.paymentId && (p.paymentId === formattedId || p.paymentId === value)) || (p.id === formattedId || p.id === value)
        );
        const existingExpense = expenses.find(ex => ex.transactionId === formattedId || ex.transactionId === value);

        if (existingPayment) {
            onEditCallback(existingPayment);
        } else if (existingExpense) {
            onConflict(`This ID is used for an expense: ${existingExpense.description}`);
        }
    };

    /** Auto-format check number to 6 digits on blur */
    const handleCheckNoBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        if (value && /^\d+$/.test(value)) {
            setCheckNo(value.padStart(6, '0'));
        }
    };

    useEffect(() => {
        if (!editingPayment) {
            if (paymentMethod === 'RTGS') {
                const nextRtgs = getNextPaymentId('RTGS');
                setRtgsSrNo(nextRtgs);
                setPaymentId(nextRtgs); // Set primary ID to the same as RTGS ID
            } else {
                setRtgsSrNo(''); // Clear RTGS ID for non-RTGS methods
                
                if (paymentMethod === 'Online') {
                    setPaymentId(getNextPaymentId('Online'));
                } else if (paymentMethod === 'Ledger') {
                    setPaymentId(getNextPaymentId('Ledger'));
                } else if (paymentMethod === 'Gov.') {
                    setPaymentId(getNextPaymentId('Gov.'));
                } else {
                    setPaymentId(getNextPaymentId('Cash'));
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentHistory, expenses, editingPayment, paymentMethod]);
    

    const resetPaymentForm = () => {
        const nextRtgsSrNo = getNextPaymentId('RTGS');
        const nextPaymentId =
            paymentMethod === 'Online'
                ? getNextPaymentId('Online')
                : paymentMethod === 'Ledger'
                    ? getNextPaymentId('Ledger')
                : paymentMethod === 'Gov.'
                    ? getNextPaymentId('Gov.')
                : paymentMethod === 'RTGS'
                    ? nextRtgsSrNo
                    : getNextPaymentId('Cash');

        setPaymentId(nextPaymentId);
        setPaymentDate(new Date());
        setPaymentAmount(0);
        setPaymentType('Full');
        // Do NOT reset payment method to Cash - keep user's selection
        // setPaymentMethod('Cash'); 
        setSupplierDetails({ name: '', fatherName: '', address: '', contact: ''});
        setBankDetails({ acNo: '', ifscCode: '', bank: '', branch: '' });
        setSelectedEntryIds(new Set());
        setSerialNoSearch('');
        // Do NOT reset selectedCustomerKey - keep the selected customer
        // setSelectedCustomerKey(null);
        setIsPayeeEditing(false);
        
        // For RTGS, use the same ID as paymentId. For others, clear it.
        setRtgsSrNo(paymentMethod === 'RTGS' ? nextPaymentId : '');
        
        setSixRNo('');
        setSixRDate(new Date());
        setParchiNo('');
        setUtrNo('');
        setCheckNo('');
        setNotes('');
        setFrom('');
        setRtgsQuantity(0);
        setRtgsRate(0);
        setRtgsAmount(0);
        setGovQuantity(0);
        setGovRate(0);
        setGovAmount(0);
        setGovExtraAmount(0);
        setDrCr('Debit');
        setExtraAmount(0);
        setEditingPayment(null);
        setIsBeingEdited(false);
        setOnEdit(null);
        

    };

    const handleFullReset = () => {
        resetPaymentForm();
        setSelectedCustomerKey(null);
        setPaymentMethod('Cash');
    };

    return {
        selectedCustomerKey, setSelectedCustomerKey,
        selectedEntryIds, setSelectedEntryIds,
        serialNoSearch, setSerialNoSearch,
        paymentId, setPaymentId, handlePaymentIdBlur,
        rtgsSrNo, setRtgsSrNo, handleRtgsSrNoBlur,
        paymentDate, setPaymentDate,
        paymentAmount, setPaymentAmount,
        paymentType, setPaymentType,
        paymentMethod, setPaymentMethod: handleSetPaymentMethod,
        selectedAccountId, setSelectedAccountId: handleSetSelectedAccountId,
        drCr, setDrCr,
        extraAmount, setExtraAmount,
        notes, setNotes,
        from, setFrom,
        supplierDetails, setSupplierDetails,
        bankDetails, setBankDetails,
        isPayeeEditing, setIsPayeeEditing,
        sixRNo, setSixRNo,
        sixRDate, setSixRDate,
        parchiNo, setParchiNo,
        utrNo, setUtrNo,
        checkNo, setCheckNo, handleCheckNoBlur,
        centerName, setCenterName,
        rtgsQuantity, setRtgsQuantity,
        rtgsRate, setRtgsRate,
        rtgsAmount, setRtgsAmount,
        govQuantity, setGovQuantity,
        govRate, setGovRate,
        govAmount, setGovAmount,
        govExtraAmount, setGovExtraAmount,
        editingPayment, setEditingPayment,
        isBeingEdited, setIsBeingEdited,
        minRate,
        setMinRate: handleSetMinRate,
        maxRate,
        setMaxRate: handleSetMaxRate,
        resetPaymentForm,
        handleFullReset,
        onEdit, setOnEdit,
        cdEnabled, setCdEnabled,
    };
};
