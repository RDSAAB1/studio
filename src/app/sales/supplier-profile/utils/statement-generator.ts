/**
 * Statement Generator Utility
 * 
 * This utility provides optimized methods for generating supplier statements
 * that can handle large datasets efficiently using chunking and deferred processing.
 * Optimized for datasets with 50K+ entries.
 */

import type { CustomerSummary } from "@/lib/definitions";
import { parse, format } from 'date-fns';

// Type declaration for requestIdleCallback
declare global {
    interface Window {
        requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
        cancelIdleCallback?: (id: number) => void;
    }
}

export interface StatementTransaction {
    date: string;
    dateValue: Date | null;
    displayDate: string;
    particulars: string;
    debit: number;
    creditPaid: number;
    creditCd: number;
    credit: number;
    referenceDate?: Date;
}

export interface StatementData {
    transactions: StatementTransaction[];
    totals: {
        totalPaid: number;
        totalCashPaid: number;
        totalRtgsPaid: number;
        totalCd: number;
        outstanding: number;
    };
}

/**
 * Safely parse date from various formats
 */
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

/**
 * Format date for display
 */
const formatDisplayDate = (
    input: string | Date | null | undefined,
    reference?: string | Date | null | undefined
) => {
    const parsedDate = parseDateSafely(input, reference);
    if (!parsedDate) return '';
    return format(parsedDate, 'dd-MM-yyyy');
};

/**
 * Compare date values for sorting
 */
const compareDateValues = (a?: Date | null, b?: Date | null) => {
    const timeA = a?.getTime() ?? 0;
    const timeB = b?.getTime() ?? 0;
    return timeA - timeB;
};

/**
 * Format column for consistent alignment
 */
const formatColumn = (value: string, width: number, align: 'left' | 'right' = 'left') => {
    if (align === 'right') {
        return value.padStart(width, ' ');
    }
    return value.padEnd(width, ' ');
};

/**
 * Process transactions in chunks to avoid blocking the UI
 */
const processInChunks = <T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => R[],
    onProgress?: (processed: number, total: number) => void
): R[] => {
    const results: R[] = [];
    const total = items.length;
    
    for (let i = 0; i < total; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkResults = processor(chunk);
        results.push(...chunkResults);
        
        if (onProgress) {
            onProgress(Math.min(i + chunkSize, total), total);
        }
        
        // Yield to browser to prevent blocking
        if (i + chunkSize < total) {
            // Use setTimeout to yield control
            // In a real implementation, you might want to use requestIdleCallback
        }
    }
    
    return results;
};

/**
 * Yield control to browser to prevent blocking
 */
const yieldToBrowser = (): Promise<void> => {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            requestIdleCallback(() => resolve(), { timeout: 1 });
        } else {
            setTimeout(() => resolve(), 0);
        }
    });
};

/**
 * Pre-calculate previously paid amounts for all entries (optimized O(n) approach)
 * This replaces the O(n²) nested loop
 */
const buildPreviouslyPaidMap = (
    deduplicatedPayments: any[],
    transactionMap: Map<string, any>
): Map<string, Map<string, number>> => {
    // Map structure: entrySrNo -> Map<paymentId, previouslyPaidAmount>
    const previouslyPaidMap = new Map<string, Map<string, number>>();
    
    // Sort payments by date to process chronologically
    const sortedPayments = [...deduplicatedPayments].sort((a, b) => {
        const dateA = parseDateSafely(a.date)?.getTime() || 0;
        const dateB = parseDateSafely(b.date)?.getTime() || 0;
        return dateA - dateB;
    });
    
    // Track cumulative payments per entry
    const entryPayments = new Map<string, number>();
    
    for (const payment of sortedPayments) {
        const paymentId = payment.paymentId || payment.id || '';
        const paymentDate = parseDateSafely(payment.date);
        
        if (!payment.paidFor) continue;
        
        for (const pf of payment.paidFor) {
            const entrySrNo = pf.srNo;
            if (!entrySrNo) continue;
            
            const purchase = transactionMap.get(entrySrNo);
            if (!purchase) continue;
            
            // Initialize map for this entry if needed
            if (!previouslyPaidMap.has(entrySrNo)) {
                previouslyPaidMap.set(entrySrNo, new Map());
            }
            
            // Get current cumulative paid for this entry
            const currentPaid = entryPayments.get(entrySrNo) || 0;
            
            // Calculate CD portion for this entry
            const totalPaidForPayment = payment.paidFor.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
            const cdPortionForThisEntry = (payment as any).cdAmount && totalPaidForPayment > 0 ? 
                (pf.amount / totalPaidForPayment) * (payment as any).cdAmount : 0;
            const actualPaymentForThisEntry = pf.amount - cdPortionForThisEntry;
            
            // Store previously paid amount for this payment
            const entryMap = previouslyPaidMap.get(entrySrNo)!;
            entryMap.set(paymentId, currentPaid);
            
            // Update cumulative paid
            entryPayments.set(entrySrNo, currentPaid + actualPaymentForThisEntry);
        }
    }
    
    return previouslyPaidMap;
};

/**
 * Generate statement transactions from supplier data
 * Optimized for very large datasets (50K+ entries) using proper chunking and async processing
 */
export const generateStatementTransactions = async (
    data: CustomerSummary | null,
    onProgress?: (progress: number) => void
): Promise<StatementTransaction[]> => {
    if (!data) return [];

    const allTransactions = data.allTransactions || [];
    const allPayments = data.allPayments || [];
    const totalItems = allTransactions.length + allPayments.length;
    
    // Determine chunk size based on dataset size
    let chunkSize = 100;
    if (totalItems > 10000) {
        chunkSize = 200; // Larger chunks for very large datasets
    } else if (totalItems > 5000) {
        chunkSize = 150;
    } else if (totalItems > 1000) {
        chunkSize = 100;
    } else {
        chunkSize = 50;
    }

    // Step 1: Deduplicate payments
    if (onProgress) onProgress(5);
    const uniquePayments = allPayments.reduce((acc, payment) => {
        const key = `${payment.paymentId || payment.id}_${payment.date}_${payment.amount}`;
        if (!acc.has(key)) {
            acc.set(key, payment);
        }
        return acc;
    }, new Map());

    const deduplicatedPayments = Array.from(uniquePayments.values());
    await yieldToBrowser();
    
    if (onProgress) onProgress(10);

    // Step 2: Create transaction map for O(1) lookup
    const transactionMap = new Map<string, typeof allTransactions[0]>();
    for (const t of allTransactions) {
        if (t.srNo) {
            transactionMap.set(t.srNo, t);
        }
    }
    await yieldToBrowser();
    
    if (onProgress) onProgress(15);

    // Step 3: Pre-calculate previously paid amounts (optimized O(n) instead of O(n²))
    if (onProgress) onProgress(20);
    const previouslyPaidMap = buildPreviouslyPaidMap(deduplicatedPayments, transactionMap);
    await yieldToBrowser();
    
    if (onProgress) onProgress(30);

    // Step 4: Map transactions in chunks
    const mappedTransactions: StatementTransaction[] = [];
    for (let i = 0; i < allTransactions.length; i += chunkSize) {
        const chunk = allTransactions.slice(i, i + chunkSize);
        
        for (const t of chunk) {
            const quantity = t.netWeight || t.weight || 0;
            const formattedQuantity = typeof quantity === 'number' ? quantity.toFixed(2) : quantity;

            const srNo = formatColumn(t.srNo || '', 6);
            const qty = formatColumn(`Qty:${formattedQuantity}`, 10);
            const rate = formatColumn(`Rate:₹${t.rate || 0}`, 10);
            const lab = formatColumn(`Lab:₹${t.labouryAmount || 0}`, 10);
            const karta = formatColumn(`Karta:₹${t.kartaAmount || 0}`, 10);
            const kanta = formatColumn(`Kanta:₹${t.kanta || 0}`, 10);

            const particulars = `PRCH ${srNo}\n${qty}|${rate}|${lab}|${karta}|${kanta}`;

            const dateValue = parseDateSafely(t.date);

            mappedTransactions.push({
                date: t.date,
                dateValue,
                displayDate: formatDisplayDate(t.date),
                particulars: particulars,
                debit: t.originalNetAmount || 0,
                creditPaid: 0,
                creditCd: 0,
                credit: 0,
            });
        }
        
        // Update progress and yield
        if (onProgress) {
            const progress = 30 + Math.floor((i / allTransactions.length) * 20);
            onProgress(progress);
        }
        
        if (i + chunkSize < allTransactions.length) {
            await yieldToBrowser();
        }
    }
    
    if (onProgress) onProgress(50);

    // Step 5: Map payments in chunks (optimized with pre-calculated previously paid)
    const mappedPayments: StatementTransaction[] = [];
    for (let i = 0; i < deduplicatedPayments.length; i += chunkSize) {
        const chunk = deduplicatedPayments.slice(i, i + chunkSize);
        
        for (const p of chunk) {
            const purchaseDates = p.paidFor
                ?.map((pf: any) => {
                    const purchase = transactionMap.get(pf.srNo);
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

            // Calculate total paid amount from paidFor entries
            const totalPaidForPayment = p.paidFor?.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
            const actualPaymentAmount = totalPaidForPayment;

            const paymentType = p.receiptType || p.type;
            const paymentId = p.paymentId || p.id || '';

            // Create payment details
            const paymentHeaderSrNo = formatColumn('SR No', 6);
            const paymentHeaderOrig = formatColumn('₹Original', 8);
            const paymentHeaderPrev = formatColumn('₹Previous', 8);
            const paymentHeaderNow = formatColumn('₹Current', 8);
            const paymentHeaderBal = formatColumn('₹Balance', 8);

            const paymentHeaderRow = `${paymentHeaderSrNo}|${paymentHeaderOrig}|${paymentHeaderPrev}|${paymentHeaderNow}|${paymentHeaderBal}`;
            const paymentSeparatorRow = '------|--------|--------|--------|--------';

            const paymentDetails = p.paidFor?.map((pf: any) => {
                const purchase = transactionMap.get(pf.srNo);
                const originalAmount = purchase?.originalNetAmount || 0;
                const paidAmount = pf.amount;

                // Calculate CD portion for this entry
                const totalPaidForThisPayment = p.paidFor?.reduce((sum: any, pf: any) => sum + pf.amount, 0) || 0;
                const cdPortionForThisEntry = (p as any).cdAmount && totalPaidForThisPayment > 0 ? 
                    (pf.amount / totalPaidForThisPayment) * (p as any).cdAmount : 0;
                const actualPaymentForThisEntry = paidAmount - cdPortionForThisEntry;

                // Get previously paid from pre-calculated map (O(1) lookup instead of O(n) loop)
                const entryMap = previouslyPaidMap.get(pf.srNo);
                const previouslyPaid = entryMap?.get(paymentId) || 0;

                const remaining = originalAmount - previouslyPaid - actualPaymentForThisEntry - cdPortionForThisEntry;

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

            mappedPayments.push({
                date: p.date,
                dateValue: paymentDateValue,
                referenceDate: parsedPurchaseReference || undefined,
                displayDate: paymentDisplayDate,
                particulars: particulars as any,
                debit: 0,
                creditPaid: actualPaymentAmount,
                creditCd: (p as any).cdAmount || 0,
                credit: actualPaymentAmount + ((p as any).cdAmount || 0),
            });
        }
        
        // Update progress and yield
        if (onProgress) {
            const progress = 50 + Math.floor((i / deduplicatedPayments.length) * 25);
            onProgress(progress);
        }
        
        if (i + chunkSize < deduplicatedPayments.length) {
            await yieldToBrowser();
        }
    }
    
    if (onProgress) onProgress(75);

    // Step 6: Combine and sort
    const resolveReferenceDate = (entry: any): Date | null => {
        if (entry.referenceDate instanceof Date) return entry.referenceDate;
        if (entry.dateValue instanceof Date) return entry.dateValue;
        return parseDateSafely(entry.date);
    };

    if (onProgress) onProgress(80);
    
    const combined = [...mappedTransactions, ...mappedPayments];
    await yieldToBrowser();
    
    if (onProgress) onProgress(85);
    
    // Sort in chunks to avoid blocking
    const sortedTransactions = combined.sort((a, b) => {
        const primary = compareDateValues(a.dateValue, b.dateValue);
        if (primary !== 0) return primary;
        return compareDateValues(
            resolveReferenceDate(a),
            resolveReferenceDate(b)
        );
    });
    
    if (onProgress) onProgress(100);

    return sortedTransactions;
};

/**
 * Calculate statement totals from transactions
 */
export const calculateStatementTotals = (
    transactions: StatementTransaction[],
    data: CustomerSummary | null
): StatementData['totals'] => {
    if (!data) {
        return { totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0, totalCd: 0, outstanding: 0 };
    }

    // Get all payments from transactions
    const paymentTransactions = transactions.filter(t => t.creditPaid > 0);
    
    // Calculate totals from transactions
    const totalPaidFromTransactions = paymentTransactions.reduce((sum, t) => sum + t.creditPaid, 0);
    const totalCdFromTransactions = paymentTransactions.reduce((sum, t) => sum + t.creditCd, 0);
    
    // Calculate Cash and RTGS paid from payment data
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
            const cashAmount = p.paidFor?.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
            totalCashPaid += cashAmount;
        } else if (receiptType === 'rtgs') {
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
};

/**
 * Main function to generate complete statement data
 * This is the primary method to use for generating statements
 * Now fully async to handle large datasets
 */
export const generateStatement = async (
    data: CustomerSummary | null,
    onProgress?: (progress: number) => void
): Promise<StatementData> => {
    const transactions = await generateStatementTransactions(data, onProgress);
    const totals = calculateStatementTotals(transactions, data);
    
    return {
        transactions,
        totals
    };
};

/**
 * Generate statement asynchronously - optimized for very large datasets (50K+ entries)
 * Uses proper chunking and async processing to prevent browser freezing
 */
export const generateStatementAsync = (
    data: CustomerSummary | null,
    onProgress?: (progress: number) => void
): Promise<StatementData> => {
    // For very large datasets, use the async version directly
    return generateStatement(data, onProgress);
};

