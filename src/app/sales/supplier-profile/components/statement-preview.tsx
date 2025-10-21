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
        
        const mappedTransactions = allTransactions.map(t => ({
            date: t.date,
            particulars: `Purchase (SR# ${t.srNo})`,
            debit: t.originalNetAmount || 0,
            credit: 0,
        }));

        const mappedPayments = allPayments.map(p => ({
            date: p.date,
            particulars: `Payment (${p.type})`,
            debit: 0,
            credit: p.amount,
        }));

        return [...mappedTransactions, ...mappedPayments]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

                <table className="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-4 py-2">Date</th>
                            <th className="border border-gray-300 px-4 py-2">Particulars</th>
                            <th className="border border-gray-300 px-4 py-2">Debit</th>
                            <th className="border border-gray-300 px-4 py-2">Credit</th>
                            <th className="border border-gray-300 px-4 py-2">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((transaction, index) => {
                            const balance = transactions.slice(0, index + 1).reduce((sum, t) => sum + t.debit - t.credit, 0);
                            return (
                                <tr key={index}>
                                    <td className="border border-gray-300 px-4 py-2">
                                        {new Date(transaction.date).toLocaleDateString()}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2">
                                        {transaction.particulars}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-right">
                                        {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-right">
                                        {transaction.credit > 0 ? formatCurrency(transaction.credit) : '-'}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-right">
                                        {formatCurrency(balance)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
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
