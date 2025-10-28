"use client";

import React, { useMemo } from 'react';
import type { CustomerSummary } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
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
            
            return {
                date: t.date,
                particulars: particulars,
                debit: t.originalNetAmount || 0,
                credit: 0,
            };
        });

        const mappedPayments = deduplicatedPayments.map(p => {
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
                   if (new Date(prevPayment.date) < new Date(p.date)) {
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
            
            // Use rtgsAmount for RTGS payments, otherwise use amount - cdAmount
            const actualPaymentAmount = p.receiptType?.toLowerCase() === 'rtgs' && (p as any).rtgsAmount 
                ? (p as any).rtgsAmount 
                : p.amount - ((p as any).cdAmount || 0);
            
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
                    if (new Date(prevPayment.date) < new Date(p.date)) {
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
                particulars: particulars as any,
                debit: 0,
                creditPaid: actualPaymentAmount, // Use rtgsAmount for RTGS, otherwise amount - CD
                creditCd: (p as any).cdAmount || 0, // CD amount
                credit: actualPaymentAmount + ((p as any).cdAmount || 0), // Total credit (including CD for balance calculation)
            };
        });

        const finalTransactions = [...mappedTransactions, ...mappedPayments]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
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

    const handlePrint = () => {
        if (statementRef.current) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>Statement - ${data.name}</title>
                            <style>
                                body { font-family: Arial, sans-serif; margin: 20px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                th, td { border: 2px solid #000; padding: 8px; text-align: left; }
                                th { background-color: #e5e5e5; font-weight: bold; }
                                .header { text-align: center; margin-bottom: 20px; }
                                .summary { margin-top: 20px; }
                                .particulars-column { width: 35%; font-size: 17px; line-height: 1.4; white-space: pre; font-family: 'Courier New', monospace !important; }
                                .hidden-table-container table { border: none !important; }
                                .hidden-table-container td { border: none !important; font-size: 17px !important; }
                                .amount-columns { width: 16.25%; font-size: 14px; text-align: right; }
                                .date-column { width: 16.25%; font-size: 14px; }
                                @media print {
                                    th, td { border: 2px solid #000 !important; font-size: 16px !important; padding: 4px !important; }
                                    table { border: 2px solid #000 !important; }
                                    .particulars-column { width: 30% !important; font-size: 18px !important; line-height: 1.3 !important; }
                                    .hidden-table-container td { font-size: 18px !important; }
                                    .amount-columns { width: 17.5% !important; font-size: 16px !important; }
                                    .date-column { width: 17.5% !important; font-size: 16px !important; }
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
                            ${statementRef.current.innerHTML}
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Print Statement
                </button>
                <h2 className="text-xl font-bold">Statement Preview</h2>
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
                                <span className="font-medium">₹{data.averageRate?.toLocaleString() || '0'}</span>
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
                                <span>Total Amount (@₹{data.averageRate?.toLocaleString() || '0'}/kg):</span>
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
                                <span className="font-medium text-green-600">₹{data.totalCashPaid?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Total RTGS Paid:</span>
                                <span className="font-medium text-green-600">₹{data.totalRtgsPaid?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Total CD Granted:</span>
                                <span className="font-medium text-blue-600">₹{data.totalCdAmount?.toLocaleString() || '0'}</span>
                            </div>
                            <hr className="my-2" />
                            <div className="flex justify-between font-semibold">
                                <span>Outstanding:</span>
                                <span className="font-bold text-lg text-red-600">₹{data.totalOutstanding?.toLocaleString() || '0'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <table className="w-full border-collapse border-2 border-gray-800 text-base">
                    <thead>
                        <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                            <th className="border-2 border-gray-800 px-3 py-2 text-left font-bold text-blue-800">Date</th>
                            <th className="border-2 border-gray-800 px-3 py-2 text-left font-bold text-indigo-800">Particulars</th>
                            <th className="border-2 border-gray-800 px-3 py-2 text-right font-bold text-red-800">Debit</th>
                            <th className="border-2 border-gray-800 px-3 py-2 text-right font-bold text-green-800">Paid</th>
                            <th className="border-2 border-gray-800 px-3 py-2 text-right font-bold text-purple-800">CD</th>
                            <th className="border-2 border-gray-800 px-3 py-2 text-right font-bold text-orange-800">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((transaction, index) => {
                            const balance = transactions.slice(0, index + 1).reduce((sum, t) => sum + t.debit - t.credit, 0);
                            return (
                                <tr key={index} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                    <td className="border-2 border-gray-800 px-3 py-2 text-base date-column text-blue-800 font-semibold">
                                        {new Date(transaction.date).toLocaleDateString('en-GB')}
                                    </td>
                                    <td className="border-2 border-gray-800 px-3 py-2 text-base particulars-column">
                                        <div className="hidden-table-container">
                                            {typeof transaction.particulars === 'string' ? (
                                                <div style={{ fontFamily: 'Courier New, monospace', fontSize: '17px', lineHeight: '1.4', whiteSpace: 'pre', color: '#1f2937' }}>
                                            {transaction.particulars}
                                                </div>
                                            ) : (
                                                transaction.particulars
                                            )}
                                        </div>
                                    </td>
                                    <td className="border-2 border-gray-800 px-3 py-2 text-right text-base amount-columns text-red-600 font-bold">
                                        {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                                    </td>
                                    <td className="border-2 border-gray-800 px-3 py-2 text-right text-base amount-columns text-green-600 font-bold">
                                        {(transaction as any).creditPaid > 0 ? formatCurrency((transaction as any).creditPaid) : '-'}
                                    </td>
                                    <td className="border-2 border-gray-800 px-3 py-2 text-right text-base amount-columns text-purple-600 font-bold">
                                        {(transaction as any).creditCd > 0 ? formatCurrency((transaction as any).creditCd) : '-'}
                                    </td>
                                    <td className="border-2 border-gray-800 px-3 py-2 text-right text-base font-bold amount-columns text-orange-600">
                                        {formatCurrency(balance)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gradient-to-r from-yellow-100 to-orange-100 font-bold">
                            <td className="border-2 border-gray-800 px-3 py-2 text-base text-orange-900 font-extrabold" colSpan={3}>
                                TOTALS
                            </td>
                            <td className="border-2 border-gray-800 px-3 py-2 text-right text-base text-green-600 font-extrabold">
                                {formatCurrency(transactions.reduce((sum, t) => sum + ((t as any).creditPaid || 0), 0))}
                            </td>
                            <td className="border-2 border-gray-800 px-3 py-2 text-right text-base text-purple-600 font-extrabold">
                                {formatCurrency(transactions.reduce((sum, t) => sum + ((t as any).creditCd || 0), 0))}
                            </td>
                            <td className="border-2 border-gray-800 px-3 py-2 text-right text-base text-orange-600 font-extrabold">
                                {formatCurrency(transactions.reduce((sum, t) => sum + t.debit - t.credit, 0))}
                            </td>
                        </tr>
                    </tfoot>
                </table>

            </div>
        </div>
    );
};
