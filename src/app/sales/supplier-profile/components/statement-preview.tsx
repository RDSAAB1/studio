"use client";



import React, { useMemo } from 'react';

import type { CustomerSummary } from "@/lib/definitions";

import { formatCurrency } from "@/lib/utils";
import { parse, format } from 'date-fns';

import { useToast } from '@/hooks/use-toast';



export const StatementPreview = ({ data }: { data: CustomerSummary | null }) => {

    const { toast } = useToast();

    const statementRef = React.useRef<HTMLDivElement>(null);



    if (!data) return null;



    // Standardized formatting function for consistent alignment

    const formatColumn = (value: string, width: number, align: 'left' | 'right' = 'left') => {

        if (align === 'right') {

            return value.padStart(width, ' ');

        }

        return value.padEnd(width, ' ');

    };



    const formatRate = (value: number | null | undefined) => {

        const numericValue = Number(value) || 0;

        return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    };



    const parseDateSafely = (
        input: string | Date | null | undefined,
        reference?: string | Date | null | undefined
    ): Date | null => {

        if (!input) return null;

        if (input instanceof Date && !Number.isNaN(input.getTime())) {

            return input;

        }

        const raw = String(input).trim();

        if (!raw) return null;

        const referenceDate = reference ? parseDateSafely(reference) : undefined;

        const shortMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

        const isWithinFiveDays = (candidate: Date | null) => {

            if (!candidate || !referenceDate) return true;

            const diff = Math.abs(candidate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);

            return diff <= 5;

        };

        if (shortMatch) {

            const part1 = Number(shortMatch[1]);

            const part2 = Number(shortMatch[2]);

            let year = Number(shortMatch[3]);

            if (year < 100) {

                year += year >= 70 ? 1900 : 2000;

            }

            const buildDate = (day: number, month: number) => {

                if (day <= 0 || month <= 0 || month > 12 || day > 31) return null;

                const candidate = new Date(year, month - 1, day);

                if (Number.isNaN(candidate.getTime())) return null;

                if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {

                    return null;

                }

                return candidate;

            };

            if (part1 > 12 && part2 <= 12) {

                const date = buildDate(part1, part2);

                if (date) return date;

            } else if (part2 > 12 && part1 <= 12) {

                const date = buildDate(part2, part1);

                if (date) return date;

            } else {

                const dayFirst = buildDate(part1, part2);

                if (dayFirst && isWithinFiveDays(dayFirst)) {

                    return dayFirst;

                }

                const monthFirst = buildDate(part2, part1);

                if (monthFirst && isWithinFiveDays(monthFirst)) {

                    return monthFirst;

                }

                if (dayFirst) return dayFirst;

                if (monthFirst) return monthFirst;

            }

        }

        const formats = [

            'yyyy-MM-dd',

            'dd-MM-yyyy',

            'dd/MM/yyyy',

            'd/M/yyyy',

            'MM/dd/yyyy',

            'M/d/yyyy',

            'MM-dd-yyyy',

            'M-d-yyyy',

            'dd/MM/yy',

            'd/M/yy',

            'MM/dd/yy',

            'M/d/yy',

            'dd-MMM-yy',

            'dd-MMM-yyyy',

            "yyyy-MM-dd'T'HH:mm:ssXXX",

            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",

            "yyyy-MM-dd'T'HH:mm:ss",

            "yyyy/MM/dd HH:mm:ss",

            "MM/dd/yyyy HH:mm:ss",

            "M/d/yyyy HH:mm:ss",

        ];

        for (const fmt of formats) {

            try {

                const parsedDate = parse(raw, fmt, new Date());

                if (!Number.isNaN(parsedDate.getTime())) {

                    return parsedDate;

                }

            } catch {

                // try next format

            }

        }

        const timestamp = Date.parse(raw);

        if (!Number.isNaN(timestamp)) {

            return new Date(timestamp);

        }

        return null;

    };



    const formatDisplayDate = (
        input: string | Date | null | undefined,
        reference?: string | Date | null | undefined
    ) => {

        const parsedDate = parseDateSafely(input, reference);

        if (!parsedDate) return '';

        return format(parsedDate, 'dd-MM-yyyy');

    };



    const compareDateValues = (a?: Date | null, b?: Date | null) => {

        const timeA = a?.getTime() ?? 0;

        const timeB = b?.getTime() ?? 0;

        return timeA - timeB;

    };



    const transactions = useMemo(() => {

        const allTransactions = data.allTransactions || [];

        const allPayments = data.allPayments || [];

        

        // Debug: Log all payments to see what we have

        console.log('All Payments in Statement:', allPayments.length);

        console.log('Sample Payment:', allPayments[0]);

        

        // Remove duplicate payments based on payment ID and date

        const uniquePayments = allPayments.reduce((acc, payment) => {

            const key = `${payment.paymentId || payment.id}_${payment.date}_${payment.amount}`;

            if (!acc.has(key)) {

                acc.set(key, payment);

            } else {

                console.log('Duplicate payment found:', key, payment);

            }

            return acc;

        }, new Map());

        

        const deduplicatedPayments = Array.from(uniquePayments.values());

        console.log('Deduplicated Payments:', deduplicatedPayments.length);

        

        const mappedTransactions = allTransactions.map(t => {

            const quantity = t.netWeight || t.weight || 0;

            const formattedQuantity = typeof quantity === 'number' ? quantity.toFixed(2) : quantity;

            

            // Standardized column widths for purchase details - more compact

            const srNo = formatColumn(t.srNo, 6);

            const qty = formatColumn(`Qty:${formattedQuantity}`, 10);

            const rate = formatColumn(`Rate:₹${t.rate || 0}`, 10);

            const lab = formatColumn(`Lab:₹${t.labouryAmount || 0}`, 10);

            const karta = formatColumn(`Karta:₹${t.kartaAmount || 0}`, 10);

            const kanta = formatColumn(`Kanta:₹${t.kanta || 0}`, 10);

            

            // Format with PRCH and serial number on first row, details on second row with colors

            const particulars = `PRCH ${srNo}\n${qty}|${rate}|${lab}|${karta}|${kanta}`;

            

            const dateValue = parseDateSafely(t.date);

            return {

                date: t.date,

                dateValue,

                displayDate: formatDisplayDate(t.date),

                particulars: particulars,

                debit: t.originalNetAmount || 0,

                credit: 0,

            };

        });



        const mappedPayments = deduplicatedPayments.map(p => {

            const purchaseDates = p.paidFor
                ?.map((pf: any) => {
                    const purchase = allTransactions.find(t => t.srNo === pf.srNo);
                    return purchase?.date;
                })
                .filter(Boolean) as (string | Date)[];

            const parsedPurchaseReference =
                purchaseDates
                    ?.map(dateValue => parseDateSafely(dateValue))
                    .find((value): value is Date => Boolean(value)) || null;

            const paymentDateValue = parseDateSafely(p.date, parsedPurchaseReference);

            const paymentDisplayDate = paymentDateValue
                ? format(paymentDateValue, 'dd-MM-yyyy')
                : formatDisplayDate(p.date, parsedPurchaseReference || undefined);

            // Debug: Log current payment

            console.log('Processing Payment:', {

                paymentId: p.paymentId || p.id,

                date: p.date,

                amount: p.amount,

                rtgsAmount: (p as any).rtgsAmount,

                cdAmount: (p as any).cdAmount,

                paidFor: p.paidFor?.map((pf: any) => ({ srNo: pf.srNo, amount: pf.amount }))

            });

            

            // Group all purchases this payment was made for into one entry

            const paidForDetails = p.paidFor?.map((pf: any) => {

                const purchase = allTransactions.find(t => t.srNo === pf.srNo);

                const originalAmount = purchase?.originalNetAmount || 0;

                const paidAmount = pf.amount;

                

                // Calculate CD portion for this entry

                const cdPortionForThisEntry = (p as any).cdAmount && p.paidFor ? 

                    (pf.amount / p.paidFor.reduce((sum: any, pf: any) => sum + pf.amount, 0)) * (p as any).cdAmount : 0;

                const actualPaymentForThisEntry = paidAmount - cdPortionForThisEntry;

                

                // Calculate previously paid amount (all payments before this one)

               // Calculate previously paid amount for this specific purchase entry

               let previouslyPaid = 0;

               const previousPaymentsForThisEntry: any[] = [];

               deduplicatedPayments.forEach(prevPayment => {

                const prevDate = parseDateSafely(prevPayment.date, purchase?.date);

                const currentDate = parseDateSafely(p.date, purchase?.date);

                   if (prevDate && currentDate && prevDate < currentDate) {

                       const prevPaidForThisEntry = prevPayment.paidFor?.find((prevPf: any) => prevPf.srNo === pf.srNo);

                       if (prevPaidForThisEntry) {

                           // Calculate the proportion of CD for this specific entry

                           const totalPaidForThisPayment = prevPayment.paidFor?.reduce((sum: any, pf: any) => sum + pf.amount, 0) || 0;

                           const cdPortionForThisEntry = (prevPayment as any).cdAmount && totalPaidForThisPayment > 0 ? 

                               (prevPaidForThisEntry.amount / totalPaidForThisPayment) * (prevPayment as any).cdAmount : 0;

                           

                           const actualPrevPayment = prevPaidForThisEntry.amount - cdPortionForThisEntry;

                           previouslyPaid += actualPrevPayment;

                           

                           previousPaymentsForThisEntry.push({

                               paymentId: prevPayment.paymentId || prevPayment.id,

                               date: prevPayment.date,

                               amount: prevPaidForThisEntry.amount,

                               cdPortion: cdPortionForThisEntry,

                               actualPayment: actualPrevPayment

                           });

                       }

                   }

               });

               

               // Debug: Log previously paid calculation for this entry

               if (previousPaymentsForThisEntry.length > 0) {

                   console.log(`Previously Paid for ${pf.srNo}:`, {

                       totalPreviouslyPaid: previouslyPaid,

                       previousPayments: previousPaymentsForThisEntry as any[]

                   });

               }

                

                const remaining = originalAmount - previouslyPaid - actualPaymentForThisEntry - cdPortionForThisEntry;

                

                // Standardized column widths for payment details

                const srNo = formatColumn(pf.srNo, 8);

                

                // Right-align numbers, then add ₹ symbol

                const origNum = formatColumn(originalAmount.toString(), 12, 'right');

                const prevNum = formatColumn(Math.round(previouslyPaid).toString(), 12, 'right');

                const nowNum = formatColumn(Math.round(actualPaymentForThisEntry).toString(), 12, 'right');

                const balNum = formatColumn(Math.round(remaining).toString(), 12, 'right');

                

                const orig = `₹${origNum}`;

                const prev = `₹${prevNum}`;

                const now = `₹${nowNum}`;

                const bal = `₹${balNum}`;

                

                return `${srNo}|${orig}|${prev}|${now}|${bal}`;

            }).join('\n') || 'Unknown Purchase';

            

            // IMPORTANT: For outstanding calculation, use sum of paidFor.amount, not rtgsAmount
            // rtgsAmount is for display/tracking only, but outstanding should use actual paidFor.amount
            // Calculate total paid amount from paidFor entries
            // paidFor.amount is already the actual paid amount (CD is separate and already accounted for)
            const totalPaidForPayment = p.paidFor?.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
            // For display: Paid amount = totalPaidForPayment (this is the actual paid amount, CD is separate)
            const actualPaymentAmount = totalPaidForPayment;

            

            // Format particulars with proper line breaks and table-like structure

            const paymentType = p.receiptType || p.type;

            

            // Create header row using standardized formatting

            const paymentHeaderSrNo = formatColumn('SR No', 6);

            const paymentHeaderOrig = formatColumn('₹Original', 8);

            const paymentHeaderPrev = formatColumn('₹Previous', 8);

            const paymentHeaderNow = formatColumn('₹Current', 8);

            const paymentHeaderBal = formatColumn('₹Balance', 8);

            

            const paymentHeaderRow = `${paymentHeaderSrNo}|${paymentHeaderOrig}|${paymentHeaderPrev}|${paymentHeaderNow}|${paymentHeaderBal}`;

            const paymentSeparatorRow = '------|--------|--------|--------|--------';

            

            // Create payment details with serial numbers on separate lines

            const paymentDetails = p.paidFor?.map((pf: any, index: number) => {

            const purchase = allTransactions.find(t => t.srNo === pf.srNo);

                const originalAmount = purchase?.originalNetAmount || 0;

                const paidAmount = pf.amount;

                

                // Calculate CD portion for this entry

                const cdPortionForThisEntry = (p as any).cdAmount && p.paidFor ? 

                    (pf.amount / p.paidFor.reduce((sum: any, pf: any) => sum + pf.amount, 0)) * (p as any).cdAmount : 0;

                const actualPaymentForThisEntry = paidAmount - cdPortionForThisEntry;

                

                // Calculate previously paid amount for this specific purchase entry

                let previouslyPaid = 0;

            deduplicatedPayments.forEach(prevPayment => {

                    const prevDate = parseDateSafely(prevPayment.date, purchase?.date);

                    const currentDate = parseDateSafely(p.date, purchase?.date);

                    if (prevDate && currentDate && prevDate < currentDate) {

                        const prevPaidForThisEntry = prevPayment.paidFor?.find((prevPf: any) => prevPf.srNo === pf.srNo);

                        if (prevPaidForThisEntry) {

                            const totalPaidForThisPayment = prevPayment.paidFor?.reduce((sum: any, pf: any) => sum + pf.amount, 0) || 0;

                            const cdPortionForThisEntry = (prevPayment as any).cdAmount && totalPaidForThisPayment > 0 ? 

                                (prevPaidForThisEntry.amount / totalPaidForThisPayment) * (prevPayment as any).cdAmount : 0;

                            

                            const actualPrevPayment = prevPaidForThisEntry.amount - cdPortionForThisEntry;

                            previouslyPaid += actualPrevPayment;

                        }

                    }

                });

                

                const remaining = originalAmount - previouslyPaid - actualPaymentForThisEntry - cdPortionForThisEntry;

                

                // Format as compact single line - reduced column widths

                const srNo = formatColumn(pf.srNo, 6);

                const origNum = formatColumn(originalAmount.toString(), 8, 'right');

                const prevNum = formatColumn(Math.round(previouslyPaid).toString(), 8, 'right');

                const nowNum = formatColumn(Math.round(actualPaymentForThisEntry).toString(), 8, 'right');

                const balNum = formatColumn(Math.round(remaining).toString(), 8, 'right');

                

                const orig = `₹${origNum}`;

                const prev = `₹${prevNum}`;

                const now = `₹${nowNum}`;

                const bal = `₹${balNum}`;

                

                return `${srNo}|${orig}|${prev}|${now}|${bal}`;

            }).join('\n') || '';



            const particulars = `PAY: ${paymentType}\n${paymentHeaderRow}\n${paymentSeparatorRow}\n${paymentDetails}`;

            

            return {

                date: p.date,

                dateValue: paymentDateValue,

                referenceDate: parsedPurchaseReference || undefined,

                displayDate: paymentDisplayDate,

                particulars: particulars as any,

                debit: 0,

                creditPaid: actualPaymentAmount, // Sum of paidFor.amount (actual paid amount)

                creditCd: (p as any).cdAmount || 0, // CD amount

                credit: actualPaymentAmount + ((p as any).cdAmount || 0), // Total credit = Paid + CD (for balance calculation)

            };

        });



        const resolveReferenceDate = (entry: any): Date | null => {

            if (entry.referenceDate instanceof Date) return entry.referenceDate;

            if (entry.dateValue instanceof Date) return entry.dateValue;

            return parseDateSafely(entry.date);

        };

        const finalTransactions = [...mappedTransactions, ...mappedPayments]

            .sort((a, b) => {

                const primary = compareDateValues(a.dateValue, b.dateValue);

                if (primary !== 0) return primary;

                return compareDateValues(
                    resolveReferenceDate(a),
                    resolveReferenceDate(b)
                );

            });

            

        // Debug: Log total amounts

        const totalDebit = mappedTransactions.reduce((sum, t) => sum + t.debit, 0);

        const totalCredit = mappedPayments.reduce((sum, p) => sum + p.credit, 0);

        console.log('Statement Totals:', {

            totalDebit,

            totalCredit,

            totalTransactions: mappedTransactions.length,

            totalPayments: mappedPayments.length,

            outstanding: totalDebit - totalCredit

        });

        

        return finalTransactions;

    }, [data]);

    // Calculate statement totals from transactions to match the table
    // This ensures consistency between summary and detailed table
    const statementTotals = useMemo(() => {
        if (!data) return { totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0, totalCd: 0, outstanding: 0 };
        
        // Get all payments from transactions
        const paymentTransactions = transactions.filter(t => (t as any).creditPaid > 0);
        
        // Calculate totals from transactions
        const totalPaidFromTransactions = paymentTransactions.reduce((sum, t) => sum + ((t as any).creditPaid || 0), 0);
        const totalCdFromTransactions = paymentTransactions.reduce((sum, t) => sum + ((t as any).creditCd || 0), 0);
        
        // Calculate Cash and RTGS paid from payment data (need to map back to payments)
        // Deduplicate payments same as in transactions calculation
        const allPayments = data.allPayments || [];
        const uniquePayments = allPayments.reduce((acc, payment) => {
            const key = `${payment.paymentId || payment.id}_${payment.date}_${payment.amount}`;
            if (!acc.has(key)) {
                acc.set(key, payment);
            }
            return acc;
        }, new Map());
        
        const deduplicatedPayments = Array.from(uniquePayments.values());
        
        let totalCashPaid = 0;
        let totalRtgsPaid = 0;
        
        deduplicatedPayments.forEach(p => {
            const receiptType = (p as any).receiptType?.toLowerCase() || (p as any).type?.toLowerCase();
            if (receiptType === 'cash') {
                // Sum of paidFor.amount for cash payments
                const cashAmount = p.paidFor?.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
                totalCashPaid += cashAmount;
            } else if (receiptType === 'rtgs') {
                // Sum of paidFor.amount for RTGS payments (not rtgsAmount)
                const rtgsAmount = p.paidFor?.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
                totalRtgsPaid += rtgsAmount;
            }
        });
        
        const totalOriginal = data.totalOriginalAmount || 0;
        const outstanding = Math.max(0, Math.round((totalOriginal - totalPaidFromTransactions - totalCdFromTransactions) * 100) / 100);
        
        return {
            totalPaid: totalPaidFromTransactions,
            totalCashPaid: totalCashPaid,
            totalRtgsPaid: totalRtgsPaid,
            totalCd: totalCdFromTransactions,
            outstanding: outstanding
        };
    }, [transactions, data]);
    
    // Use statement totals for consistency
    const statementOutstanding = statementTotals.outstanding;

    const POPUP_FEATURES = 'width=1200,height=800,scrollbars=yes';

    const buildPrintableHtml = (includePreviewControls = false) => {
        if (!statementRef.current) {
            return '';
        }

        const previewToolbar = includePreviewControls
            ? `<div class="preview-toolbar">
                    <button type="button" onclick="window.print()">Print</button>
                    <button type="button" class="secondary" onclick="window.close()">Close</button>
               </div>`
            : '';

        return `
            <html>
                <head>
                    <title>Statement - ${data.name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        th, td { border: 2px solid #000; padding: 6px; text-align: left; }
                        th { background-color: #e5e5e5 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        thead tr { background-color: #dbeafe !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-image: linear-gradient(to right, #dbeafe, #e0e7ff) !important; }
                        tfoot tr { background-color: #fef3c7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-image: linear-gradient(to right, #fef3c7, #fed7aa) !important; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .summary { margin-top: 20px; }
                        .particulars-column { width: 35%; font-size: 17px; line-height: 1.4; white-space: pre; font-family: 'Courier New', monospace !important; }
                        .hidden-table-container table { border: none !important; }
                        .hidden-table-container td { border: none !important; font-size: 17px !important; }
                        .amount-columns { width: 16.25%; font-size: 14px; text-align: right; }
                        .date-column { width: 16.25%; font-size: 14px; }
                        .preview-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
                        .preview-toolbar button { background-color: #2563eb; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 14px; }
                        .preview-toolbar button.secondary { background-color: #e5e7eb; color: #1f2937; }
                        .preview-toolbar button:hover { opacity: 0.9; }
                        .preview-toolbar button.secondary:hover { background-color: #d1d5db; opacity: 1; }
                        @media print {
                            .preview-toolbar { display: none !important; }
                            th, td { border: 2px solid #000 !important; font-size: 12px !important; padding: 1px 2px !important; line-height: 1.15 !important; }
                            table { border: 2px solid #000 !important; }
                            .statement-table th, .statement-table td { font-size: 11px !important; padding: 1px 2px !important; line-height: 1.15 !important; }
                            .particulars-column { width: 30% !important; font-size: 11px !important; line-height: 1.1 !important; }
                            .hidden-table-container td { font-size: 11px !important; line-height: 1.1 !important; }
                            .amount-columns { width: 17.5% !important; font-size: 11px !important; }
                            .date-column { width: 17.5% !important; font-size: 11px !important; }
                            .grid { display: grid !important; }
                            .grid-cols-3 { grid-template-columns: repeat(3, 1fr) !important; }
                            .gap-4 { gap: 1rem !important; }
                            .mb-6 { margin-bottom: 1.5rem !important; }
                            .p-4 { padding: 1rem !important; }
                            .text-base { font-size: 16px !important; }
                            .text-xl { font-size: 18px !important; }
                            .text-lg { font-size: 16px !important; }
                            .text-2xl { font-size: 20px !important; }
                            .rounded-lg { border-radius: 0.5rem !important; }
                            .border { border: 1px solid #000 !important; }
                            .bg-blue-50 { background-color: #f0f9ff !important; }
                            .bg-red-50 { background-color: #fef2f2 !important; }
                            .bg-green-50 { background-color: #f0fdf4 !important; }
                            .border-blue-200 { border-color: #bfdbfe !important; }
                            .border-red-200 { border-color: #fecaca !important; }
                            .border-green-200 { border-color: #bbf7d0 !important; }
                            .text-blue-800 { color: #1e40af !important; }
                            .text-red-800 { color: #991b1b !important; }
                            .text-green-800 { color: #166534 !important; }
                            .text-red-600 { color: #dc2626 !important; }
                            .text-green-600 { color: #16a34a !important; }
                            .text-blue-600 { color: #2563eb !important; }
                            .font-semibold { font-weight: 600 !important; }
                            .font-medium { font-weight: 500 !important; }
                            .font-bold { font-weight: 700 !important; }
                            .mb-3 { margin-bottom: 0.75rem !important; }
                            .space-y-2 > * + * { margin-top: 0.5rem !important; }
                            .flex { display: flex !important; }
                            .justify-between { justify-content: space-between !important; }
                            .my-2 { margin: 0.5rem 0 !important; }
                            hr { border: 1px solid #000 !important; }
                            .text-left { text-align: left !important; }
                            .header { text-align: left !important; }
                        }
                    </style>
                </head>
                <body>
                    ${previewToolbar}
                    ${statementRef.current.innerHTML}
                </body>
            </html>
        `;
    };

    const openPrintWindow = (htmlContent: string, autoPrint = false) => {
        const targetWindow = window.open('', '_blank', POPUP_FEATURES);

        if (!targetWindow) {
            toast({
                title: 'Pop-up blocked',
                description: 'Allow pop-ups to preview or print the statement.',
            });
            return;
        }

        try {
            const targetDocument = targetWindow.document;
            targetDocument.open();
            targetDocument.write(htmlContent);
            targetDocument.close();
            targetWindow.focus();

            if (autoPrint) {
                targetWindow.print();
            }
        } catch (error) {
            console.error('Failed to populate print window:', error);
            targetWindow.close();
            toast({
                title: 'Preview unavailable',
                description: 'Unable to open the statement preview. Check your browser pop-up settings.',
                variant: 'destructive',
            });
        }
    };

    const handlePreview = () => {
        const previewHtml = buildPrintableHtml(true);

        if (!previewHtml) {
            toast({
                title: 'Preview unavailable',
                description: 'Statement content is not ready yet.',
            });
            return;
        }

        openPrintWindow(previewHtml);
    };

    const handlePrint = () => {
        const printableHtml = buildPrintableHtml();

        if (!printableHtml) {
            toast({
                title: 'Print unavailable',
                description: 'Statement content is not ready yet.',
            });
            return;
        }

        openPrintWindow(printableHtml, true);
    };



    return (

        <div className="p-6">

            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">

                <h2 className="text-xl font-bold">Statement Preview</h2>

                <div className="flex items-center gap-2">

                    <button

                        onClick={handlePreview}

                        className="px-4 py-2 border border-blue-500 text-blue-600 rounded hover:bg-blue-50"

                    >

                        Preview

                    </button>

                    <button

                        onClick={handlePrint}

                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"

                    >

                        Print Statement

                    </button>

                </div>

            </div>

            

            <div ref={statementRef} className="statement-content">

                <style jsx>{`

                    .statement-content table {

                        border: 2px solid #000 !important;

                    }

                    .statement-content th,

                    .statement-content td {

                        border: 2px solid #000 !important;

                    }

                    .statement-content th {

                        background-color: #e5e5e5 !important;

                        font-weight: bold !important;

                    }

                    .statement-content .particulars-column {

                        font-family: 'Courier New', monospace !important;

                        font-size: 11px !important;

                        line-height: 1.3 !important;

                        white-space: pre !important;

                    }

                    .statement-content .hidden-table-container {

                        font-family: 'Courier New', monospace !important;

                        font-size: 12px !important;

                        line-height: 1.4 !important;

                        white-space: pre !important;

                    }

                    .statement-content .hidden-table-container table {

                        border: none !important;

                        border-collapse: collapse !important;

                        width: 100% !important;

                    }

                    .statement-content .hidden-table-container td {

                        border: none !important;

                        padding: 0 !important;

                        margin: 0 !important;

                        font-family: 'Courier New', monospace !important;

                        font-size: 10px !important;

                        vertical-align: top !important;

                    }

                    @media print {

                        .statement-content .hidden-table-container table {

                            border: none !important;

                        }

                        .statement-content .hidden-table-container td {

                            border: none !important;

                            font-size: 9px !important;

                        }

                    }

                `}</style>

                <div className="header mb-6 text-left">

                    <h1 className="text-2xl font-bold text-left">Account Statement</h1>

                    <p className="text-lg text-left">Customer: {data.name}</p>

                    <p className="text-left">Contact: {data.contact || 'N/A'}</p>

                    <p className="text-left">Address: {data.address || 'N/A'}</p>

                </div>



                {/* Summary Cards */}

                <div className="grid grid-cols-3 gap-4 mb-6">

                    {/* Operational Summary */}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">

                        <h3 className="text-xl font-semibold text-blue-800 mb-3">Operational Summary</h3>

                        <div className="space-y-2 text-base">

                            <div className="flex justify-between">

                                <span>Gross Wt:</span>

                                <span className="font-medium">{data.totalGrossWeight?.toFixed(2) || '0.00'} kg</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Tier Wt:</span>

                                <span className="font-medium">{data.totalTeirWeight?.toFixed(2) || '0.00'} kg</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Final Wt:</span>

                                <span className="font-medium">{data.totalFinalWeight?.toFixed(2) || '0.00'} kg</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Karta Wt (@1.00%):</span>

                                <span className="font-medium">{data.totalKartaWeight?.toFixed(2) || '0.00'} kg</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Net Wt:</span>

                                <span className="font-medium">{data.totalNetWeight?.toFixed(2) || '0.00'} kg</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Average Rate:</span>

                                <span className="font-medium">{formatRate(data.averageRate)}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Min Rate:</span>

                                <span className="font-medium">₹{data.minRate?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Max Rate:</span>

                                <span className="font-medium">₹{data.maxRate?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Total Transactions:</span>

                                <span className="font-medium">{data.totalTransactions} Entries</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Outstanding Entries:</span>

                                <span className="font-medium">{data.outstandingEntryIds?.length || 0} Entries</span>

                            </div>

                        </div>

                    </div>



                    {/* Deduction Summary */}

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">

                        <h3 className="text-xl font-semibold text-red-800 mb-3">Deduction Summary</h3>

                        <div className="space-y-2 text-base">

                            <div className="flex justify-between">

                                <span>Total Amount (@{formatRate(data.averageRate)}/kg):</span>

                                <span className="font-medium">₹{data.totalAmount?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Total Karta Amt (@{data.averageKartaPercentage?.toFixed(2) || '0.00'}%):</span>

                                <span className="font-medium text-red-600">- ₹{data.totalKartaAmount?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Total Laboury Amt (@{data.averageLabouryRate?.toFixed(2) || '0.00'}):</span>

                                <span className="font-medium text-red-600">- ₹{data.totalLabouryAmount?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Total Kanta:</span>

                                <span className="font-medium text-red-600">- ₹{data.totalKanta?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Total Brokerage Amt:</span>

                                <span className="font-medium text-red-600">- ₹{data.totalBrokerage?.toLocaleString() || '0'}</span>

                            </div>

                            <hr className="my-2" />

                            <div className="flex justify-between font-semibold">

                                <span>Total Original Amount:</span>

                                <span className="font-bold text-lg">₹{data.totalOriginalAmount?.toLocaleString() || '0'}</span>

                            </div>

                        </div>

                    </div>



                    {/* Financial Summary */}

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">

                        <h3 className="text-xl font-semibold text-green-800 mb-3">Financial Summary</h3>

                        <div className="space-y-2 text-base">

                            <div className="flex justify-between">

                                <span>Total Net Payable:</span>

                                <span className="font-medium">₹{data.totalOriginalAmount?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Total Cash Paid:</span>

                                <span className="font-medium text-green-600">₹{statementTotals.totalCashPaid?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Total RTGS Paid:</span>

                                <span className="font-medium text-green-600">₹{statementTotals.totalRtgsPaid?.toLocaleString() || '0'}</span>

                            </div>

                            <div className="flex justify-between">

                                <span>Total CD Granted:</span>

                                <span className="font-medium text-blue-600">₹{statementTotals.totalCd?.toLocaleString() || '0'}</span>

                            </div>

                            <hr className="my-2" />

                            <div className="flex justify-between font-semibold">

                                <span>Outstanding:</span>

                                <span className="font-bold text-lg text-red-600">₹{statementOutstanding.toLocaleString()}</span>

                            </div>

                        </div>

                    </div>

                </div>



                <div className="w-full">
                <div className="max-h-[600px] overflow-auto">
                <table className="statement-table min-w-[1100px] border-collapse border-2 border-gray-800 text-xs leading-tight">

                    <thead>

                        <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 leading-tight">

                            <th className="border-2 border-gray-800 px-1 py-0.5 text-left font-bold text-blue-800 text-[11px] leading-tight w-[12%]">Date</th>

                            <th className="border-2 border-gray-800 px-1 py-0.5 text-left font-bold text-indigo-800 text-[11px] leading-tight w-[40%]">Particulars</th>

                            <th className="border-2 border-gray-800 px-1 py-0.5 text-right font-bold text-red-800 text-xs leading-tight">Debit</th>

                            <th className="border-2 border-gray-800 px-1 py-0.5 text-right font-bold text-green-800 text-xs leading-tight">Paid</th>

                            <th className="border-2 border-gray-800 px-1 py-0.5 text-right font-bold text-purple-800 text-[11px] leading-tight">CD</th>

                            <th className="border-2 border-gray-800 px-1 py-0.5 text-right font-bold text-orange-800 text-[11px] leading-tight">Balance</th>

                        </tr>

                    </thead>

                    <tbody>

                        {transactions.map((transaction, index) => {

                            const balance = transactions.slice(0, index + 1).reduce((sum, t) => sum + t.debit - t.credit, 0);

                            return (

                                <tr key={index} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>

                                    <td className="border-2 border-gray-800 px-1 py-0.5 text-[10px] leading-tight date-column text-blue-800 font-semibold">

                                        {transaction.displayDate ?? formatDisplayDate(transaction.date, (transaction as any).referenceDate)}

                                    </td>

                                    <td className="border-2 border-gray-800 px-1 py-0.5 text-[11px] leading-tight particulars-column w-[40%]">

                                        <div className="hidden-table-container">

                                            {typeof transaction.particulars === 'string' ? (

                                                <div style={{ fontFamily: 'Courier New, monospace', fontSize: '11px', lineHeight: '1.1', whiteSpace: 'pre', color: '#1f2937' }}>

                                            {transaction.particulars}

                                                </div>

                                            ) : (

                                                transaction.particulars

                                            )}

                                        </div>

                                    </td>

                                    <td className="border-2 border-gray-800 px-1 py-0.5 text-right text-[10px] leading-tight amount-columns text-red-600 font-bold">

                                        {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}

                                    </td>

                                    <td className="border-2 border-gray-800 px-1 py-0.5 text-right text-[10px] leading-tight amount-columns text-green-600 font-bold">

                                        {(transaction as any).creditPaid > 0 ? formatCurrency((transaction as any).creditPaid) : '-'}

                                    </td>

                                    <td className="border-2 border-gray-800 px-1 py-0.5 text-right text-[10px] leading-tight amount-columns text-purple-600 font-bold">

                                        {(transaction as any).creditCd > 0 ? formatCurrency((transaction as any).creditCd) : '-'}

                                    </td>

                                    <td className="border-2 border-gray-800 px-1 py-0.5 text-right text-[10px] leading-tight font-bold amount-columns text-orange-600">

                                        {formatCurrency(balance)}

                                    </td>

                                </tr>

                            );

                        })}

                    </tbody>

                    <tfoot>

                        <tr className="bg-gradient-to-r from-yellow-100 to-orange-100 font-bold">

                            <td className="border-2 border-gray-800 px-1 py-0.5 text-[10px] leading-tight text-orange-900 font-extrabold" colSpan={3}>

                                TOTALS

                            </td>

                            <td className="border-2 border-gray-800 px-1 py-0.5 text-right text-[10px] leading-tight text-green-600 font-extrabold">

                                {formatCurrency(transactions.reduce((sum, t) => sum + ((t as any).creditPaid || 0), 0))}

                            </td>

                            <td className="border-2 border-gray-800 px-1 py-0.5 text-right text-[10px] leading-tight text-purple-600 font-extrabold">

                                {formatCurrency(transactions.reduce((sum, t) => sum + ((t as any).creditCd || 0), 0))}

                            </td>

                            <td className="border-2 border-gray-800 px-1 py-0.5 text-right text-[10px] leading-tight text-orange-600 font-extrabold">

                                {formatCurrency(statementOutstanding)}

                            </td>

                        </tr>

                    </tfoot>

                </table>
                </div>
                </div>



            </div>

        </div>

    );

};
