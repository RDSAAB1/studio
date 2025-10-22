"use client";

import React, { useMemo } from 'react';
import type { CustomerSummary } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';

export const StatementPreview = ({ data }: { data: CustomerSummary | null }) => {
    const { toast } = useToast();
    const statementRef = React.useRef<HTMLDivElement>(null);

    if (!data) return null;

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
            
            return {
                date: t.date,
                particulars: `PRCH\n${t.srNo}\nQty:${formattedQuantity} | Rate:₹${t.rate || 0} | Net:₹${t.originalNetAmount || 0}`,
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
                
                return `${pf.srNo}(Orig:₹${originalAmount}, Prev:₹${Math.round(previouslyPaid)}, Now:₹${Math.round(actualPaymentForThisEntry)}, Bal:₹${Math.round(remaining)})`;
            }).join('\n') || 'Unknown Purchase';
            
            // Use rtgsAmount for RTGS payments, otherwise use amount - cdAmount
            const actualPaymentAmount = p.receiptType?.toLowerCase() === 'rtgs' && (p as any).rtgsAmount 
                ? (p as any).rtgsAmount 
                : p.amount - ((p as any).cdAmount || 0);
            
            // Format particulars with proper line breaks
            const paymentType = p.receiptType || p.type;
            const particulars = `PAY: ${paymentType}\nAgainst:\n${paidForDetails}`;
            
            return {
                date: p.date,
                particulars: particulars,
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
                                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                                th { background-color: #f2f2f2; }
                                .header { text-align: center; margin-bottom: 20px; }
                                .summary { margin-top: 20px; }
                                .particulars-column { width: 50%; font-size: 10px; line-height: 1.2; white-space: pre-line; }
                                .amount-columns { width: 12.5%; font-size: 11px; text-align: right; }
                                .date-column { width: 10%; font-size: 11px; }
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
                <h2 className="text-xl font-bold">Statement Preview</h2>
                <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Print Statement
                </button>
            </div>
            
            <div ref={statementRef} className="statement-content">
                <div className="header mb-6">
                    <h1 className="text-2xl font-bold">Account Statement</h1>
                    <p className="text-lg">Customer: {data.name}</p>
                    <p>Contact: {data.contact || 'N/A'}</p>
                    <p>Address: {data.address || 'N/A'}</p>
                </div>

                <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1 text-left">Date</th>
                            <th className="border border-gray-300 px-2 py-1 text-left">Particulars</th>
                            <th className="border border-gray-300 px-2 py-1 text-right">Debit</th>
                            <th className="border border-gray-300 px-2 py-1 text-right">Paid</th>
                            <th className="border border-gray-300 px-2 py-1 text-right">CD</th>
                            <th className="border border-gray-300 px-2 py-1 text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((transaction, index) => {
                            const balance = transactions.slice(0, index + 1).reduce((sum, t) => sum + t.debit - t.credit, 0);
                            return (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-2 py-1 text-xs date-column">
                                        {new Date(transaction.date).toLocaleDateString()}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-xs particulars-column">
                                        <div className="whitespace-pre-line text-xs leading-tight" title={transaction.particulars}>
                                            {transaction.particulars}
                                        </div>
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right text-xs amount-columns">
                                        {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right text-xs amount-columns">
                                        {(transaction as any).creditPaid > 0 ? formatCurrency((transaction as any).creditPaid) : '-'}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right text-xs amount-columns">
                                        {(transaction as any).creditCd > 0 ? formatCurrency((transaction as any).creditCd) : '-'}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right text-xs font-medium amount-columns">
                                        {formatCurrency(balance)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-bold">
                            <td className="border border-gray-300 px-2 py-1 text-xs" colSpan={3}>
                                TOTALS
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right text-xs">
                                {formatCurrency(transactions.reduce((sum, t) => sum + ((t as any).creditPaid || 0), 0))}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right text-xs">
                                {formatCurrency(transactions.reduce((sum, t) => sum + ((t as any).creditCd || 0), 0))}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right text-xs">
                                {formatCurrency(transactions.reduce((sum, t) => sum + t.debit - t.credit, 0))}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div className="summary mt-6 p-4 bg-gray-50 rounded">
                    <h3 className="text-lg font-semibold mb-2">Summary</h3>
                    <p><strong>Total Transactions:</strong> {data.totalTransactions}</p>
                    <p><strong>Total Amount:</strong> {formatCurrency(data.totalAmount)}</p>
                    <p><strong>Total Paid:</strong> {formatCurrency(data.totalPaid)}</p>
                    <p><strong>Outstanding:</strong> {formatCurrency(data.totalOutstanding)}</p>
                </div>
            </div>
        </div>
    );
};
