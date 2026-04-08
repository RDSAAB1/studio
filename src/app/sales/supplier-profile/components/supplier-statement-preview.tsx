"use client";



import React, { useMemo, useDeferredValue, useState, useEffect } from 'react';

import type { CustomerSummary } from "@/lib/definitions";

import { formatCurrency } from "@/lib/utils";
import { format, parse } from 'date-fns';

import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { generateStatement, generateStatementAsync, type StatementData } from '../utils/statement-generator';
import { SupplierSummaryCards } from '@/components/sales/supplier-payments/supplier-summary-cards';



export const SupplierStatementPreview = ({ data }: { data: CustomerSummary | null }) => {

    const { toast } = useToast();
    const deferredData = useDeferredValue(data);
    const isPending = deferredData !== data;
    
    // Track computing state for large datasets
    const [isComputing, setIsComputing] = useState(false);
    const [statementData, setStatementData] = useState<StatementData | null>(null);
    const [progress, setProgress] = useState(0);

    const statementRef = React.useRef<HTMLDivElement>(null);
    
    // Generate statement using the optimized utility function
    useEffect(() => {
        if (!deferredData) {
            setIsComputing(false);
            setStatementData(null);
            setProgress(0);
            return;
        }

        const allTransactions = deferredData.allTransactions || [];
        const allPayments = deferredData.allPayments || [];
        const totalItems = allTransactions.length + allPayments.length;
        
        // Always use async generation for better performance, even for small datasets
            setIsComputing(true);
        setProgress(0);
        
        generateStatementAsync(deferredData, (prog) => {
            setProgress(prog);
        }).then((result) => {
            setStatementData(result);
            setIsComputing(false);
            setProgress(100);
        }).catch((error) => {

            toast({
                title: 'Error',
                description: `Failed to generate statement${totalItems > 1000 ? '. This is a large dataset, please wait...' : '. Please try again.'}`,
                variant: 'destructive'
            });
            setIsComputing(false);
        });
    }, [deferredData, toast]);
    



    if (!data) return null;

    // Use statement data from the utility function
    const transactions = statementData?.transactions || [];
    const statementTotals = statementData?.totals || { totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0, totalCd: 0, outstanding: 0 };
    const statementOutstanding = statementTotals.outstanding;

    // Format rate for display
    const formatRate = (value: number | null | undefined) => {
        const numericValue = Number(value) || 0;
        return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Format display date helper
    const formatDisplayDate = (date: string | Date | null | undefined, referenceDate?: Date) => {
        if (!date) return '';
        if (date instanceof Date) {
            return format(date, 'dd-MM-yyyy');
        }
        try {
            const parsed = parse(date, 'dd-MM-yyyy', new Date());
            if (!Number.isNaN(parsed.getTime())) {
                return format(parsed, 'dd-MM-yyyy');
            }
        } catch {}
        return String(date);
    };

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
                    <title>Statement - ${deferredData?.name || ''}</title>
                    <style>
                        @page { margin: 10mm 8mm; }
                        body { font-family: Arial, sans-serif; margin: 8px 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        th, td { border: 1px solid #999; padding: 6px; text-align: left; }
                        th { background-color: #e5e5e5 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        thead tr { background-color: #e5e5e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        tfoot tr { background-color: #e5e5e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
                            th, td { border: 1px solid #999 !important; font-size: 14px !important; padding: 3px 5px !important; line-height: 1.25 !important; color: #222222 !important; }
                            table { border: 1px solid #999 !important; }
                            .statement-table th, .statement-table td { font-size: 13px !important; padding: 3px 5px !important; line-height: 1.25 !important; border: 1px solid #999 !important; }
                            .particulars-column { width: 30% !important; font-size: 13px !important; line-height: 1.25 !important; }
                            .hidden-table-container td { font-size: 13px !important; line-height: 1.25 !important; }
                            .amount-columns { width: 17.5% !important; font-size: 13px !important; }
                            .date-column { width: 17.5% !important; font-size: 13px !important; }
                            .grid { display: grid !important; }
                            .grid-cols-3 { grid-template-columns: repeat(3, 1fr) !important; }
                            .gap-4 { gap: 1rem !important; }
                            .mb-6 { margin-bottom: 1.5rem !important; }
                            .p-2 { padding: 0.5rem !important; }
                            .p-4 { padding: 1rem !important; }
                            .text-xs { font-size: 10px !important; }
                            .text-sm { font-size: 12px !important; }
                            .text-base { font-size: 14px !important; }
                            .text-xl { font-size: 14px !important; }
                            .text-lg { font-size: 14px !important; }
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
                            .text-red-400 { color: #f87171 !important; }
                            .text-green-600 { color: #16a34a !important; }
                            .text-blue-600 { color: #2563eb !important; }
                            .text-blue-400 { color: #60a5fa !important; }
                            .text-green-400 { color: #4ade80 !important; }
                            .text-foreground { color: #000 !important; }
                            .bg-muted { background-color: #e5e5e5 !important; }
                            .font-semibold { font-weight: 600 !important; }
                            .font-medium { font-weight: 500 !important; }
                            .font-bold { font-weight: 700 !important; }
                            .mb-1\.5 { margin-bottom: 0.375rem !important; }
                            .mb-3 { margin-bottom: 0.75rem !important; }
                            .space-y-0\.5 > * + * { margin-top: 0.125rem !important; }
                            .space-y-2 > * + * { margin-top: 0.5rem !important; }
                            .flex { display: flex !important; }
                            .justify-between { justify-content: space-between !important; }
                            .my-2 { margin: 0.5rem 0 !important; }
                            hr { border: 1px solid #000 !important; }
                            .text-left { text-align: left !important; }
                            .header { text-align: left !important; }

                            /* Dashboard summary (SupplierSummaryCards - print layout) */
                            /* Flattened, professional summary block for print */
                            .supplier-summary-dashboard-root {
                                background-color: #ffffff !important;
                                border-radius: 0.3rem !important;
                                padding: 4px 4px 2px 4px !important;
                                margin-bottom: 6px !important;
                                border: none !important;
                            }
                            .supplier-summary-dashboard-top,
                            .supplier-summary-dashboard-middle,
                            .supplier-summary-dashboard-bottom {
                                display: grid !important;
                                gap: 0.5rem !important;
                            }
                            .supplier-summary-dashboard-top {
                                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                            }
                            .supplier-summary-dashboard-middle,
                            .supplier-summary-dashboard-bottom {
                                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                            }
                            .supplier-summary-dashboard-card {
                                border-radius: 0.25rem !important;
                                border: none !important;
                                padding: 2px 4px !important;
                                background-color: transparent !important;
                                box-shadow: none !important;
                            }

                            /* Top metric row: add subtle bottom border */
                            .supplier-summary-dashboard-top .supplier-summary-dashboard-card {
                                border-bottom: 1px solid #e5e7eb !important;
                            }

                            /* Compact typography for summary (print-only) */
                            .supplier-summary-dashboard-root .text-base {
                                font-size: 9px !important;
                                line-height: 1.2 !important;
                            }
                            .supplier-summary-dashboard-root .text-[10px] {
                                font-size: 7px !important;
                                line-height: 1.2 !important;
                            }

                            /* Soften summary colours / weights for cleaner look */
                            .supplier-summary-dashboard-root .text-slate-900 {
                                color: #222222 !important;
                                font-weight: 500 !important;
                            }
                            .supplier-summary-dashboard-root .text-slate-800,
                            .supplier-summary-dashboard-root .text-slate-700,
                            .supplier-summary-dashboard-root .text-slate-600 {
                                color: #666666 !important;
                                font-weight: 500 !important;
                            }
                            .supplier-summary-dashboard-root .font-bold {
                                font-weight: 600 !important;
                            }
                            .supplier-summary-dashboard-root .font-semibold {
                                font-weight: 500 !important;
                            }

                            /* Top 4 KPI cards – larger amount text for print */
                            .supplier-summary-dashboard-top .text-base {
                                font-size: 16px !important;
                                font-weight: 700 !important;
                                color: #111111 !important;
                                line-height: 1.25 !important;
                            }
                            .supplier-summary-dashboard-top .text-[10px] {
                                font-size: 10px !important;
                                font-weight: 500 !important;
                            }

                            .header {
                                margin-bottom: 0.5rem !important;
                            }
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



    if (isPending || isComputing || !statementData) {
        const allTransactions = deferredData?.allTransactions || [];
        const allPayments = deferredData?.allPayments || [];
        const totalItems = allTransactions.length + allPayments.length;
        
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">
                        {isPending ? "Loading statement data..." : "Generating statement..."}
                    </p>
                    {!isPending && totalItems > 0 && (
                        <>
                        <p className="text-xs text-muted-foreground">
                            Processing {totalItems} entries, please wait...
                        </p>
                            {progress > 0 && progress < 100 && (
                                <div className="w-64 bg-muted rounded-full h-2">
                                    <div 
                                        className="bg-primary h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}
                        </>
                    )}
                    {!isPending && totalItems === 0 && (
                        <p className="text-xs text-muted-foreground">
                            Preparing statement...
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (

        <div className="p-6 bg-card text-card-foreground">

            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">

                <h2 className="text-xl font-bold">Overall Statement</h2>

                <div className="flex items-center gap-2">

                    <button

                        onClick={handlePreview}

                        className="px-4 py-2 border border-primary text-primary rounded hover:bg-primary/10 transition-colors"

                    >

                        Preview

                    </button>

                    <button

                        onClick={handlePrint}

                        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"

                    >

                        Print Statement

                    </button>

                </div>

            </div>

            

            <div ref={statementRef} className="statement-content">

                <style jsx>{`

                    .statement-content table {

                        border: 2px solid hsl(var(--border)) !important;

                    }

                    .statement-content th,

                    .statement-content td {

                        border: 2px solid hsl(var(--border)) !important;

                    }

                    .statement-content th {

                        background-color: hsl(var(--muted)) !important;

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

                        .statement-content table {

                            border: 1px solid #999 !important;

                        }

                        .statement-content th,

                        .statement-content td {

                            border: 1px solid #999 !important;

                        }

                        .statement-content .hidden-table-container table {

                            border: none !important;

                        }

                        .statement-content .hidden-table-container td {

                            border: none !important;

                            font-size: 9px !important;

                        }

                        /* Summary sections print styles */

                        .statement-content [class*="bg-blue-500"],

                        .statement-content [class*="bg-red-500"],

                        .statement-content [class*="bg-green-500"] {

                            padding: 0.5rem !important;

                        }

                        .statement-content [class*="text-sm"] {

                            font-size: 12px !important;

                        }

                        .statement-content [class*="text-xs"] {

                            font-size: 10px !important;

                        }

                        .statement-content [class*="mb-1"] {

                            margin-bottom: 0.375rem !important;

                        }

                        .statement-content [class*="space-y-0"] > * + * {

                            margin-top: 0.125rem !important;

                        }

                    }

                `}</style>

                <div className="header mb-4 text-left">
                    <h1 className="text-2xl font-bold text-left">Account Statement</h1>
                    <p className="text-lg text-left">Customer: {deferredData?.name || ''}</p>
                    <p className="text-left">Contact: {deferredData?.contact || 'N/A'}</p>
                    <p className="text-left">Address: {deferredData?.address || 'N/A'}</p>
                </div>

                {/* New dashboard-style summary (same as Unified Payments screen) */}
                {deferredData && (
                    <div className="mb-6">
                        <SupplierSummaryCards
                            summary={deferredData as any}
                            variant="dashboard"
                            type="supplier"
                        />
                    </div>
                )}



                <div className="w-full">
                <div className="max-h-[600px] overflow-auto">
                <table className="statement-table min-w-[1100px] border-collapse border-2 border-border text-sm leading-tight text-foreground">

                    <thead>

                        <tr className="bg-muted leading-tight">

                            <th className="border-2 border-border px-1 py-0.5 text-left font-bold text-foreground text-xs leading-tight w-[12%]">Date</th>

                            <th className="border-2 border-border px-1 py-0.5 text-left font-bold text-foreground text-xs leading-tight w-[40%]">Particulars</th>

                            <th className="border-2 border-border px-1 py-0.5 text-right font-bold text-foreground text-xs leading-tight">Debit</th>

                            <th className="border-2 border-border px-1 py-0.5 text-right font-bold text-foreground text-xs leading-tight">Paid</th>

                            <th className="border-2 border-border px-1 py-0.5 text-right font-bold text-foreground text-xs leading-tight">CD</th>

                            <th className="border-2 border-border px-1 py-0.5 text-right font-bold text-foreground text-xs leading-tight">Balance</th>

                        </tr>

                    </thead>

                    <tbody>

                        {transactions.map((transaction, index) => {

                            const balance = transactions.slice(0, index + 1).reduce((sum, t) => sum + t.debit - t.credit, 0);

                            return (

                                <tr key={index} className={`hover:bg-muted/50 ${index % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`}>

                                    <td className="border-2 border-border px-1 py-0.5 text-xs leading-tight date-column text-blue-400 font-semibold">

                                        {transaction.displayDate ?? formatDisplayDate(transaction.date, (transaction as any).referenceDate)}

                                    </td>

                                    <td className="border-2 border-border px-1 py-0.5 text-xs leading-tight particulars-column w-[40%] text-foreground">

                                        <div className="hidden-table-container">

                                            {typeof transaction.particulars === 'string' ? (

                                                <div className="text-foreground" style={{ fontFamily: 'Courier New, monospace', fontSize: '11px', lineHeight: '1.1', whiteSpace: 'pre' }}>

                                            {transaction.particulars}

                                                </div>

                                            ) : (

                                                transaction.particulars

                                            )}

                                        </div>

                                    </td>

                                    <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight amount-columns text-red-400 font-bold">

                                        {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}

                                    </td>

                                    <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight amount-columns text-green-400 font-bold">

                                        {transaction.creditPaid > 0 ? formatCurrency(transaction.creditPaid) : '-'}

                                    </td>

                                    <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight amount-columns text-purple-400 font-bold">

                                        {transaction.creditCd > 0 ? formatCurrency(transaction.creditCd) : '-'}

                                    </td>

                                    <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight font-bold amount-columns text-orange-400">

                                        {formatCurrency(balance)}

                                    </td>

                                </tr>

                            );

                        })}

                    </tbody>

                    <tfoot>

                        <tr className="bg-muted font-bold">

                            <td className="border-2 border-border px-1 py-0.5 text-xs leading-tight text-foreground font-extrabold" colSpan={2}>

                                TOTALS

                            </td>

                            <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight text-foreground font-extrabold text-red-400">

                                {formatCurrency(transactions.reduce((sum, t) => sum + t.debit, 0))}

                            </td>

                            <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight text-foreground font-extrabold">

                                {formatCurrency(transactions.reduce((sum, t) => sum + t.creditPaid, 0))}

                            </td>

                            <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight text-foreground font-extrabold">

                                {formatCurrency(transactions.reduce((sum, t) => sum + t.creditCd, 0))}

                            </td>

                            <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight text-foreground font-extrabold">

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
