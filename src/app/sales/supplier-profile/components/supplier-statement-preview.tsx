"use client";



import React, { useMemo, useDeferredValue, useState, useEffect } from 'react';

import type { CustomerSummary } from "@/lib/definitions";

import { formatCurrency } from "@/lib/utils";
import { format, parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, MapPin, Phone, Calendar, Hash, FileText } from 'lucide-react';
import { generateStatement, generateStatementAsync, type StatementData } from '../utils/statement-generator';
import { SupplierSummaryCards } from '@/components/sales/supplier-payments/supplier-summary-cards';
import { POPUP_FEATURES } from "@/lib/constants";
import { formatDisplayDate } from "@/lib/utils";



interface SupplierStatementPreviewProps {
    data: CustomerSummary | null;
    type?: 'supplier' | 'customer';
}

export const SupplierStatementPreview = ({ data, type = 'supplier' }: SupplierStatementPreviewProps) => {

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
                            th, td { border: 1px solid #cbd5e1 !important; font-size: 14px !important; padding: 4px 6px !important; line-height: 1.3 !important; }
                            table { border: 1px solid #cbd5e1 !important; color: #475569; }
                            .statement-table th, .statement-table td { font-size: 13px !important; padding: 4px 6px !important; line-height: 1.3 !important; border: 1px solid #cbd5e1 !important; }
                            .receipts-table th, .receipts-table td { font-size: 10px !important; color: #64748b !important; padding: 2px 4px !important; line-height: 1.2 !important; font-weight: 500; }
                            .receipts-table th { font-weight: 600 !important; color: #475569 !important; }
                            .receipts-table tfoot td { font-size: 11px !important; font-weight: 700 !important; color: #475569 !important; }
                            .particulars-column { width: 43% !important; font-size: 12px !important; line-height: 1.3 !important; color: #475569 !important; }
                            .hidden-table-container td { font-size: 12px !important; line-height: 1.3 !important; color: #000 !important; }
                            .amount-columns { width: 12% !important; font-size: 11px !important; }
                            .cd-column { width: 8% !important; font-size: 11px !important; }
                            .balance-column { width: 13% !important; font-size: 12px !important; }
                            .date-column { width: 12% !important; font-size: 11px !important; }
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
                            .text-red-600 { color: #ef4444 !important; }
                            .text-red-400 { color: #ef4444 !important; font-weight: 500 !important; }
                            .text-green-600 { color: #22c55e !important; }
                            .text-blue-600 { color: #3b82f6 !important; }
                            .text-blue-400 { color: #3b82f6 !important; font-weight: 500 !important; }
                            .text-green-400 { color: #22c55e !important; font-weight: 500 !important; }
                            .text-purple-400 { color: #a855f7 !important; font-weight: 500 !important; }
                            .text-orange-400 { color: #f97316 !important; font-weight: 500 !important; }
                            .text-foreground { color: #475569 !important; }
                            .text-slate-600 { color: #475569 !important; }
                            .text-slate-500 { color: #64748b !important; }
                            .bg-muted { background-color: transparent !important; color: #475569 !important; }
                            .font-semibold { font-weight: 500 !important; }
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
        <>
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

                <div className="header mb-4 pb-2 print:mb-2">
                    <div className="flex items-start mb-2 print:mb-2">
                        <div className="text-[9px] font-medium text-slate-400">
                            {format(new Date(), 'dd MMM yyyy HH:mm')}
                        </div>
                    </div>
                </div>

                {/* Professional Boxed Header */}
                <div style={{ border: '1px solid #cbd5e1', padding: '12px', marginBottom: '20px', borderRadius: '4px' }} className="print:mb-4">
                    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Account Holder</div>
                            <div style={{ fontSize: '18px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>{deferredData?.name || ''}</div>
                        </div>
                        <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '20px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Father Name (S/O)</div>
                            <div style={{ fontSize: '18px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>{deferredData?.so || 'N/A'}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Contact Details</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#64748b' }}>{deferredData?.contact || 'N/A'}</div>
                        </div>
                        <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', paddingLeft: '20px' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Registered Address</div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{deferredData?.address || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                {/* Professional 3-Column Summary Block */}
                {deferredData && (
                    <div style={{ border: '1px solid #cbd5e1', padding: '15px', marginBottom: '20px', borderRadius: '4px', background: 'transparent' }} className="print:mb-4">
                        <div style={{ display: 'flex', gap: '30px' }}>
                            {/* Column 1: Bill & Rate Info */}
                            <div style={{ flex: 1.2, borderRight: '1px solid #e2e8f0', paddingRight: '20px' }}>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    1. Purchase Details
                                </div>
                                <div className="space-y-1.5">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span className="text-slate-500">Total Net Weight:</span>
                                        <span className="font-medium text-slate-600">{(deferredData.totalNetWeight || 0).toFixed(2)} kg</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span className="text-slate-500">Average Rate:</span>
                                        <span className="font-medium text-slate-600">{formatCurrency(deferredData.averageRate || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px' }}>
                                        <span className="font-medium text-slate-600">Gross Bill Amount:</span>
                                        <span className="font-semibold text-slate-600">{formatCurrency(deferredData.totalAmount || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Deduction Breakdown */}
                            <div style={{ flex: 1.2, borderRight: '1px solid #e2e8f0', paddingRight: '20px' }}>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    2. Deduction Breakdown
                                </div>
                                <div className="space-y-1.5">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span className="text-slate-500">Karta & Laboury:</span>
                                        <span className="font-medium text-slate-600">{formatCurrency((deferredData.totalKartaAmount || 0) + (deferredData.totalLabouryAmount || 0))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span className="text-slate-500">Kanta & Others:</span>
                                        <span className="font-medium text-slate-600">{formatCurrency((deferredData.totalKanta || 0) + (deferredData.totalOtherCharges || 0))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px' }}>
                                        <span className="font-medium text-slate-600">Total Deductions:</span>
                                        <span className="font-semibold text-red-600">-{formatCurrency(deferredData.totalDeductions || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 3: Final Account Status */}
                            <div style={{ flex: 1.5 }}>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    3. Final Account Status
                                </div>
                                <div className="space-y-1.5">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span className="text-slate-500 font-medium">Net Payable:</span>
                                        <span className="font-semibold text-slate-600">{formatCurrency(deferredData.totalOriginalAmount || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#16a34a' }}>
                                        <span className="font-medium">Total Paid To Date:</span>
                                        <span className="font-semibold">{formatCurrency(deferredData.totalPaid || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '8px', color: '#dc2626' }}>
                                        <span className="font-semibold uppercase tracking-tighter">Outstanding:</span>
                                        <span className="font-semibold">{formatCurrency(statementOutstanding)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detailed Receipts Table */}
                {deferredData && deferredData.allTransactions && deferredData.allTransactions.length > 0 && (
                    <div className="mb-6 page-break-inside-avoid w-full overflow-x-auto">
                        <table className="receipts-table w-full border-collapse border-2 border-border text-[8px] leading-tight text-foreground">
                            <thead>
                                <tr className="bg-slate-50 text-slate-700 leading-tight">
                                    <th className="border-2 border-border px-[2px] py-[1px] text-left font-bold text-slate-600">SR No.</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-left font-bold text-slate-600">Date</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-left font-bold text-slate-600">Variety</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-left font-bold text-slate-600">Vehicle</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-600">Term</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-600">Rate</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-600">Gross Wt.</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-600">Teir Wt.</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-600">Weight</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-600">K.Wt.</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-600">Net Wt.</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-600">Amount</th>
                                    <th className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-900">Net Amt.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deferredData.allTransactions.map((tx, idx) => (
                                    <tr key={idx} className="hover:bg-muted/50 text-slate-700 leading-tight">
                                        <td className="border-2 border-border px-[2px] py-[1px]">{tx.srNo}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] whitespace-nowrap">{format(new Date(tx.date), 'dd-MMM-yy')}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px]">{tx.variety}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px]">{tx.vehicleNo}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right">{tx.term}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right">{tx.rate?.toFixed(2)}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right">{tx.grossWeight?.toFixed(2)}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right">{tx.teirWeight?.toFixed(2)}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right">{tx.weight?.toFixed(2)}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right">{tx.kartaWeight?.toFixed(2)}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right">{tx.netWeight?.toFixed(2)}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right">{formatCurrency(tx.amount)}</td>
                                        <td className="border-2 border-border px-[2px] py-[1px] text-right font-bold text-slate-900">{formatCurrency(tx.originalNetAmount || tx.netAmount || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-100 font-bold text-slate-800 leading-tight">
                                    <td colSpan={6} className="border-2 border-border px-[2px] py-[1px] text-right uppercase tracking-wider font-extrabold text-[9px]">GRAND TOTAL</td>
                                    <td className="border-2 border-border px-[2px] py-[1px] text-right">{deferredData.totalGrossWeight?.toFixed(2)}</td>
                                    <td className="border-2 border-border px-[2px] py-[1px] text-right">{deferredData.totalTeirWeight?.toFixed(2)}</td>
                                    <td className="border-2 border-border px-[2px] py-[1px] text-right">{deferredData.totalFinalWeight?.toFixed(2)}</td>
                                    <td className="border-2 border-border px-[2px] py-[1px] text-right">{deferredData.totalKartaWeight?.toFixed(2)}</td>
                                    <td className="border-2 border-border px-[2px] py-[1px] text-right">{deferredData.totalNetWeight?.toFixed(2)}</td>
                                    <td className="border-2 border-border px-[2px] py-[1px] text-right">{formatCurrency(deferredData.totalAmount)}</td>
                                    <td className="border-2 border-border px-[2px] py-[1px] text-right font-extrabold text-[9px]">{formatCurrency(deferredData.totalOriginalAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
                <div className="w-full">
                <div className="max-h-[600px] overflow-auto">
                <table className="statement-table min-w-[1100px] border-collapse border-2 border-border text-sm leading-tight text-foreground">

                    <thead>

                        <tr className="bg-muted leading-tight">

                            <th className="border-2 border-border px-1 py-0.5 text-left font-bold text-foreground text-xs leading-tight w-[12%]">Date</th>
                            <th className="border-2 border-border px-1 py-0.5 text-left font-bold text-foreground text-xs leading-tight w-[40%]">Particulars</th>
                            <th className="border-2 border-border px-1 py-0.5 text-right font-bold text-red-400 text-xs leading-tight amount-columns">Debit</th>
                            <th className="border-2 border-border px-1 py-0.5 text-right font-bold text-green-400 text-xs leading-tight amount-columns">Paid</th>
                            <th className="border-2 border-border px-1 py-0.5 text-right font-bold text-purple-400 text-xs leading-tight cd-column">CD</th>
                            <th className="border-2 border-border px-1 py-0.5 text-right font-bold text-orange-400 text-xs leading-tight balance-column">Balance</th>
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

                                    <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight cd-column text-purple-400 font-bold">

                                        {transaction.creditCd > 0 ? formatCurrency(transaction.creditCd) : '-'}

                                    </td>

                                    <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight font-bold balance-column text-orange-400">

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
                            <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight font-extrabold text-red-400">
                                {formatCurrency(transactions.reduce((sum, t) => sum + t.debit, 0))}
                            </td>
                            <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight font-extrabold text-green-400">
                                {formatCurrency(transactions.reduce((sum, t) => sum + t.creditPaid, 0))}
                            </td>
                            <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight font-extrabold text-purple-400">
                                {formatCurrency(transactions.reduce((sum, t) => sum + t.creditCd, 0))}
                            </td>
                            <td className="border-2 border-border px-1 py-0.5 text-right text-xs leading-tight font-extrabold text-orange-400">
                                {formatCurrency(statementOutstanding)}
                            </td>
                        </tr>

                    </tfoot>

                </table>
                </div>
                </div>



            </div>

        </div>
        </>
    );

};
