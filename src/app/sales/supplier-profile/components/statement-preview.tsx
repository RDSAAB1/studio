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
            const quantity = t.finalWeight || t.netWeight || t.weight || 0;
            const formattedQuantity = typeof quantity === 'number' ? quantity.toFixed(2) : quantity;
            
            return {
                date: t.date,
                particulars: `PRCH: SR#${t.srNo} | Qty:${formattedQuantity} | Rate:₹${t.rate || 0} | Lab:₹${t.labouryAmount || 0} | Karta:₹${t.kartaAmount || 0} | Net:₹${t.originalNetAmount || 0}`,
                debit: t.originalNetAmount || 0,
                credit: 0,
            };
        });

        const mappedPayments = deduplicatedPayments.map(p => {
            // Group all purchases this payment was made for into one entry
            const paidForDetails = p.paidFor?.map(pf => {
                const purchase = allTransactions.find(t => t.srNo === pf.srNo);
                const originalAmount = purchase?.originalNetAmount || 0;
                const paidAmount = pf.amount;
                const outstanding = originalAmount - paidAmount;
                return `SR#${pf.srNo}(Orig:₹${originalAmount}, Paid:₹${paidAmount}, Bal:₹${outstanding})`;
            }).join(', ') || 'Unknown Purchase';
            
            return {
                date: p.date,
                particulars: `PAY: ${p.receiptType || p.type} | Against: ${paidForDetails}`,
                debit: 0,
                creditPaid: p.amount - (p.cdAmount || 0), // Actual payment amount (excluding CD)
                creditCd: p.cdAmount || 0, // CD amount
                credit: p.amount - (p.cdAmount || 0), // Total credit (excluding CD for balance calculation)
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
                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                th { background-color: #f2f2f2; }
                                .header { text-align: center; margin-bottom: 20px; }
                                .summary { margin-top: 20px; }
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
                                    <td className="border border-gray-300 px-2 py-1 text-xs">
                                        {new Date(transaction.date).toLocaleDateString()}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-xs">
                                        <div className="max-w-xs truncate" title={transaction.particulars}>
                                            {transaction.particulars}
                                        </div>
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">
                                        {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">
                                        {(transaction as any).creditPaid > 0 ? formatCurrency((transaction as any).creditPaid) : '-'}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right text-xs">
                                        {(transaction as any).creditCd > 0 ? formatCurrency((transaction as any).creditCd) : '-'}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right text-xs font-medium">
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
