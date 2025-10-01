
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateReadableId } from '@/lib/utils';
import type { Payment, Expense, BankAccount } from '@/lib/definitions';
import { format } from 'date-fns';

export const useSupplierPaymentsForm = (paymentHistory: Payment[], expenses: Expense[], bankAccounts: BankAccount[], onConflict: (message: string) => void) => {
    const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
    const [paymentId, setPaymentId] = useState('');
    const [rtgsSrNo, setRtgsSrNo] = useState('');
    const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentType, setPaymentType] = useState('Full');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('CashInHand');

    const [supplierDetails, setSupplierDetails] = useState({ name: '', fatherName: '', address: '', contact: ''});
    const [bankDetails, setBankDetails] = useState({ acNo: '', ifscCode: '', bank: '', branch: '' });
    const [isPayeeEditing, setIsPayeeEditing] = useState(false);

    const [sixRNo, setSixRNo] = useState('');
    const [sixRDate, setSixRDate] = useState<Date | undefined>(new Date());
    const [parchiNo, setParchiNo] = useState('');
    const [utrNo, setUtrNo] = useState('');
    const [checkNo, setCheckNo] = useState('');

    const [rtgsQuantity, setRtgsQuantity] = useState(0);
    const [rtgsRate, setRtgsRate] = useState(0);
    const [rtgsAmount, setRtgsAmount] = useState(0);
    const [rtgsFor, setRtgsFor] = useState<'Supplier' | 'Outsider'>('Supplier');

    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [calcTargetAmount, setCalcTargetAmount] = useState(0);
    
    // State for payment combination generator
    const [minRate, setMinRate] = useState(0);
    const [maxRate, setMaxRate] = useState(0);
    
    // This is a new function to trigger auto-fill, which will be passed to the blur handler
    const [onEdit, setOnEdit] = useState<((payment: Payment) => void) | null>(null);

    const safeBankAccounts = Array.isArray(bankAccounts) ? bankAccounts : [];

    useEffect(() => {
        const savedMinRate = localStorage.getItem('paymentMinRate');
        const savedMaxRate = localStorage.getItem('paymentMaxRate');
        if (savedMinRate) setMinRate(Number(savedMinRate));
        if (savedMaxRate) setMaxRate(Number(savedMaxRate));

        const savedAccountId = localStorage.getItem('defaultPaymentAccountId');
        if (savedAccountId && savedAccountId !== 'CashInHand') {
            const accountExists = safeBankAccounts.some(ba => ba.id === savedAccountId);
            if (accountExists) {
                setSelectedAccountId(savedAccountId);
                setPaymentMethod('Online');
            } else {
                setSelectedAccountId('CashInHand');
                setPaymentMethod('Cash');
            }
        } else {
             setSelectedAccountId('CashInHand');
             setPaymentMethod('Cash');
        }
    }, [safeBankAccounts]);

    useEffect(() => {
        localStorage.setItem('paymentMinRate', String(minRate));
    }, [minRate]);

    useEffect(() => {
        localStorage.setItem('paymentMaxRate', String(maxRate));
    }, [maxRate]);

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
    
    const handleSetPaymentMethod = (method: 'Cash' | 'Online' | 'RTGS') => {
        setPaymentMethod(method);
        if (method === 'Cash') {
            handleSetSelectedAccountId('CashInHand');
        } else {
            const defaultBankId = localStorage.getItem('defaultPaymentAccountId');
            const accountExists = safeBankAccounts.some(ba => ba.id === defaultBankId);
            const firstBankId = safeBankAccounts.find(ba => ba.id !== 'CashInHand')?.id;
            
            if (selectedAccountId === 'CashInHand' || method !== paymentMethod) { // Change only if switching or coming from cash
                if (defaultBankId && defaultBankId !== 'CashInHand' && accountExists) {
                    handleSetSelectedAccountId(defaultBankId);
                } else if (firstBankId) {
                    handleSetSelectedAccountId(firstBankId);
                } else {
                    handleSetSelectedAccountId('CashInHand');
                    setPaymentMethod('Cash');
                }
            }
        }
    };


    const getNextPaymentId = useCallback((method: 'Cash' | 'Online' | 'RTGS') => {
        if (!paymentHistory || !expenses) return '';
        if (method === 'RTGS') {
            const rtgsPayments = paymentHistory.filter(p => p.rtgsSrNo);
            const lastNum = rtgsPayments.reduce((max, p) => {
                const numMatch = p.rtgsSrNo?.match(/^RT(\d+)$/);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            return generateReadableId('RT', lastNum, 5);
        }
        if (method === 'Online') {
            const onlinePayments = paymentHistory.filter(p => p.receiptType === 'Online');
            const lastNum = onlinePayments.reduce((max, p) => {
                const numMatch = p.paymentId.match(/^P(\d+)$/);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            return generateReadableId('P', lastNum, 6);
        }
        const cashPayments = paymentHistory.filter(p => p.receiptType === 'Cash');
        const lastCashNum = cashPayments.reduce((max, p) => {
            const numMatch = p.paymentId.match(/^EX(\d+)$/);
            const num = numMatch ? parseInt(numMatch[1], 10) : 0;
            return num > max ? num : max;
        }, 0);
        const lastExpenseNum = expenses.reduce((max, e) => {
            const numMatch = e.transactionId?.match(/^EX(\d+)$/);
            const num = numMatch ? parseInt(numMatch[1], 10) : 0;
            return num > max ? num : max;
        }, 0);
        const lastNum = Math.max(lastCashNum, lastExpenseNum);
        return generateReadableId('EX', lastNum, 5);
    }, [paymentHistory, expenses]);

    const handlePaymentIdBlur = (e: React.FocusEvent<HTMLInputElement>, onEditCallback: (payment: Payment) => void) => {
        let value = e.target.value.trim();
        if (!value) return;

        let formattedId = value;
        if (!isNaN(parseInt(value)) && isFinite(Number(value))) {
            const num = parseInt(value, 10);
            let prefix = 'EX';
            let padding = 5;
            if (paymentMethod === 'Online') {
                prefix = 'P'; padding = 6;
            } else if (paymentMethod === 'RTGS') {
                return;
            }
             formattedId = generateReadableId(prefix, num-1, padding);
             setPaymentId(formattedId);
        }
        
        const existingPayment = paymentHistory.find(p => p.paymentId === formattedId);
        if (existingPayment) {
            onEditCallback(existingPayment);
            return;
        }

        if (paymentMethod === 'Cash') {
            const existingExpense = expenses.find(ex => ex.transactionId === formattedId);
            if (existingExpense) {
                if (onConflict) {
                     onConflict(`Payment ID ${formattedId} is already used for an expense: ${existingExpense.description}`);
                }
            }
        }
    };
    
    const handleRtgsSrNoBlur = (e: React.FocusEvent<HTMLInputElement>, onEditCallback: (payment: Payment) => void) => {
        const value = e.target.value.trim().toUpperCase();
        if (!value) return;

        const numericPartStr = value.replace(/\D/g, '');
        if (!numericPartStr) return;

        const num = parseInt(numericPartStr, 10);
        const formattedId = 'RT' + String(num).padStart(5, '0');
        setRtgsSrNo(formattedId);

        const existingPayment = paymentHistory.find(p => p.rtgsSrNo === formattedId);
        if (existingPayment) {
            onEditCallback(existingPayment);
        }
    };
    
    useEffect(() => {
        if (!editingPayment) {
            setPaymentId(getNextPaymentId(paymentMethod as 'Cash'|'Online'|'RTGS'));
            if (paymentMethod === 'RTGS') setRtgsSrNo(getNextPaymentId('RTGS'));
        }
    }, [paymentHistory, expenses, editingPayment, paymentMethod, getNextPaymentId]);

    const resetPaymentForm = useCallback((isOutsider: boolean = false) => {
        if (!isOutsider) setSelectedEntryIds(new Set());
        setPaymentAmount(0);
        setEditingPayment(null);
        setUtrNo(''); setCheckNo(''); setSixRNo(''); setParchiNo('');
        setRtgsQuantity(0); setRtgsRate(0); setRtgsAmount(0);
        setPaymentId(getNextPaymentId(paymentMethod as 'Cash'|'Online'|'RTGS'));
        setRtgsSrNo(getNextPaymentId('RTGS'));
        if (isOutsider) {
            setSupplierDetails({ name: '', fatherName: '', address: '', contact: '' });
            setBankDetails({ acNo: '', ifscCode: '', bank: '', branch: '' });
            setPaymentType('Full');
        }
    }, [getNextPaymentId, paymentMethod]);
    
    const handleFullReset = useCallback(() => {
        setSelectedCustomerKey(null);
        resetPaymentForm();
    }, [resetPaymentForm]);

    return {
        selectedCustomerKey, setSelectedCustomerKey,
        selectedEntryIds, setSelectedEntryIds,
        paymentId, setPaymentId, handlePaymentIdBlur,
        rtgsSrNo, setRtgsSrNo, handleRtgsSrNoBlur,
        paymentDate, setPaymentDate,
        paymentAmount, setPaymentAmount,
        paymentType, setPaymentType,
        paymentMethod, setPaymentMethod: handleSetPaymentMethod,
        selectedAccountId, setSelectedAccountId: handleSetSelectedAccountId,
        supplierDetails, setSupplierDetails,
        bankDetails, setBankDetails,
        isPayeeEditing, setIsPayeeEditing,
        sixRNo, setSixRNo,
        sixRDate, setSixRDate,
        parchiNo, setParchiNo,
        utrNo, setUtrNo,
        checkNo, setCheckNo,
        rtgsQuantity, setRtgsQuantity,
        rtgsRate, setRtgsRate,
        rtgsAmount, setRtgsAmount,
        rtgsFor, setRtgsFor,
        editingPayment, setEditingPayment,
        calcTargetAmount, setCalcTargetAmount,
        minRate, setMinRate,
        maxRate, setMaxRate,
        resetPaymentForm,
        handleFullReset,
        onEdit, setOnEdit, // Pass setter for the callback
    };
};
