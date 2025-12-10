
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

    const [govQuantity, setGovQuantity] = useState(0);
    const [govRate, setGovRate] = useState(0);
    const [govAmount, setGovAmount] = useState(0);
    const [govRequiredAmount, setGovRequiredAmount] = useState(0);
    const [extraAmount, setExtraAmount] = useState(0);

    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [isBeingEdited, setIsBeingEdited] = useState(false); // New state to track edit mode
    
    // Auto-enable payee editing when in edit mode
    useEffect(() => {
        if (editingPayment && !isPayeeEditing) {
            setIsPayeeEditing(true);
        }
    }, [editingPayment, isPayeeEditing]);
    
    const [calcTargetAmount, setCalcTargetAmount] = useState(0);
    
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
    
    const handleSetPaymentMethod = (method: 'Cash' | 'Online' | 'RTGS' | 'Gov.') => {
        // Always allow switching to the selected method
        setPaymentMethod(method);
        
        if (method === 'Cash') {
            handleSetSelectedAccountId('CashInHand');
            return;
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


    const getNextPaymentId = useCallback((method: 'Cash' | 'Online' | 'RTGS' | 'Gov.') => {
        if (!paymentHistory || !expenses) return '';
    
        if (method === 'RTGS') {
            const rtgsPayments = paymentHistory.filter(p => p.rtgsSrNo);
            const lastNum = rtgsPayments.reduce((max, p) => {
                // Match both RT##### and R##### formats (for backward compatibility)
                const rtMatch = p.rtgsSrNo?.match(/^RT(\d+)$/);
                const rMatch = p.rtgsSrNo?.match(/^R(\d+)$/);
                const num = rtMatch ? parseInt(rtMatch[1], 10) : (rMatch ? parseInt(rMatch[1], 10) : 0);
                return num > max ? num : max;
            }, 0);
            // Always generate RT##### format (not R#####)
            return generateReadableId('RT', lastNum, 5);
        }
    
        if (method === 'Gov.') {
            const govPayments = paymentHistory.filter(p => p.receiptType === 'Gov.' && p.paymentId.startsWith('GV'));
            const lastGovNum = govPayments.reduce((max, p) => {
                const numMatch = p.paymentId.match(/^GV(\d+)$/);
                if (numMatch && numMatch[1]) {
                    const num = parseInt(numMatch[1], 10);
                    return Math.max(max, num);
                }
                return max;
            }, 0);
            return generateReadableId('GV', lastGovNum, 5);
        }
    
        if (method === 'Online') {
            const onlinePayments = paymentHistory.filter(p => p.receiptType === 'Online' && p.paymentId.startsWith('P'));
            const lastNum = onlinePayments.reduce((max, p) => {
                const numMatch = p.paymentId.match(/^P(\d+)$/);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            return generateReadableId('P', lastNum, 5);
        }
    
        // For Cash payment
        const cashPrefix = paymentCategory === 'customer' ? 'IX' : 'EX';
        const cashPayments = paymentHistory.filter(p => p.receiptType === 'Cash' && (p.paymentId.startsWith('EX') || p.paymentId.startsWith('IX')));
        const lastCashNum = cashPayments.reduce((max, p) => {
            const exMatch = p.paymentId.match(/^EX(\d+)$/);
            const ixMatch = p.paymentId.match(/^IX(\d+)$/);
            const num = exMatch ? parseInt(exMatch[1], 10) : (ixMatch ? parseInt(ixMatch[1], 10) : 0);
            return num > max ? num : max;
        }, 0);
        
        const lastExpenseNum = expenses.reduce((max, e) => {
            const numMatch = e.transactionId?.match(/^EX(\d+)$/);
            const num = numMatch ? parseInt(numMatch[1], 10) : 0;
            return num > max ? num : max;
        }, 0);
    
        const lastNum = Math.max(lastCashNum, lastExpenseNum);
        return generateReadableId(cashPrefix, lastNum, 5);

    }, [paymentHistory, expenses]);
    
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

    const handlePaymentIdBlur = (e: React.FocusEvent<HTMLInputElement>, onEditCallback: (payment: Payment) => void) => {
        const value = e.target.value.trim().toUpperCase();
        if (!value) return;

        const prefix = paymentMethod === 'Cash' ? (paymentCategory === 'customer' ? 'IX' : 'EX') : 'P';
        let formattedId = value;

        // Auto-format if it's just a number
        if (/^\d+$/.test(value)) {
            const num = parseInt(value, 10);
            formattedId = generateReadableId(prefix, num - 1, 5); // generateReadableId adds 1
            setPaymentId(formattedId);
        }

        const existingPayment = paymentHistory.find(p => p.paymentId === formattedId);
        const existingExpense = expenses.find(ex => ex.transactionId === formattedId);

        if (existingPayment) {
            onEditCallback(existingPayment);
        } else if (existingExpense) {
            onConflict(`This ID is used for an expense: ${existingExpense.description}`);
        }
    };

    useEffect(() => {
        if (!editingPayment) {
             setRtgsSrNo(getNextPaymentId('RTGS'));
             if (paymentMethod === 'Online') {
                 setPaymentId(getNextPaymentId('Online'));
             } else if (paymentMethod === 'Gov.') {
                 setPaymentId(getNextPaymentId('Gov.'));
             } else {
                 setPaymentId(getNextPaymentId('Cash'));
             }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentHistory, expenses, editingPayment, paymentMethod]);
    

    const resetPaymentForm = useCallback(() => {
        setSelectedEntryIds(new Set());
        setPaymentAmount(0);
        setEditingPayment(null);
        setIsBeingEdited(false); // Reset edit state
        setIsPayeeEditing(false); // Reset payee editing state
        setUtrNo(''); setCheckNo(''); setSixRNo(''); setParchiNo('');
        setRtgsQuantity(0); setRtgsRate(0); setRtgsAmount(0);
        setGovQuantity(0); setGovRate(0); setGovAmount(0);
        setGovRequiredAmount(0);
        setExtraAmount(0);
        setRtgsSrNo(getNextPaymentId('RTGS'));
        setPaymentId(paymentMethod === 'Online' ? getNextPaymentId('Online') : paymentMethod === 'Gov.' ? getNextPaymentId('Gov.') : getNextPaymentId('Cash'));
    }, [getNextPaymentId, paymentMethod]);
    
    const handleFullReset = useCallback(() => {
        setSelectedCustomerKey(null);
        resetPaymentForm();
    }, [resetPaymentForm]);

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
        govQuantity, setGovQuantity,
        govRate, setGovRate,
        govAmount, setGovAmount,
        govRequiredAmount, setGovRequiredAmount,
        extraAmount, setExtraAmount,
        editingPayment, setEditingPayment,
        isBeingEdited, setIsBeingEdited,
        calcTargetAmount, setCalcTargetAmount,
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
