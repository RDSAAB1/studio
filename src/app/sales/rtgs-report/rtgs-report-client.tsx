
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Payment, RtgsSettings } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, toTitleCase, formatSrNo } from '@/lib/utils';
import { Loader2, Edit, Save, X, Printer, Mail, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getRtgsSettings, updateRtgsSettings, getPaymentsRealtime } from '@/lib/firestore';
import { ConsolidatedRtgsPrintFormat } from '@/components/sales/consolidated-rtgs-print';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { BankMailFormatDialog } from '@/components/sales/rtgs-report/bank-mail-format-dialog';
import { BankMailFormatDialog2 } from '@/components/sales/rtgs-report/bank-mail-format-2';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';


interface RtgsReportRow {
    paymentId: string;
    date: string;
    checkNo: string;
    type: string;
    srNo: string; 
    supplierName: string;
    fatherName: string;
    contact: string;
    acNo: string;
    ifscCode: string;
    branch: string;
    bank: string;
    amount: number;
    rate: number;
    weight: number;
    sixRNo: string;
    sixRDate: string;
    parchiNo: string;
    utrNo: string;
    supplierAddress?: string;
}

export default function RtgsReportClient() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings | null>(null);
    const { toast } = useToast();
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
    const [isTablePrintPreviewOpen, setIsTablePrintPreviewOpen] = useState(false);
    const [isBankMailFormatOpen, setIsBankMailFormatOpen] = useState(false);
    const [isBankMailFormat2Open, setIsBankMailFormat2Open] = useState(false);
    const tablePrintRef = useRef<HTMLDivElement>(null);


    // State for search filters
    const [searchSrNo, setSearchSrNo] = useState('');
    const [searchCheckNo, setSearchCheckNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const savedSettings = await getRtgsSettings();
                setSettings(savedSettings);
            } catch (error) {
                console.error("Error fetching initial settings: ", error);
            }
        };
        fetchSettings();
        
        const unsubscribe = getPaymentsRealtime(setPayments, console.error);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (settings !== null && payments !== undefined) {
            setLoading(false);
        }
    }, [settings, payments]);

    const reportRows = useMemo(() => {
        if (!settings || !payments) return [];
        const rtgsPayments = payments.filter(p => p.receiptType === 'RTGS');
        const newReportRows: RtgsReportRow[] = rtgsPayments.map(p => {
            const srNo = p.rtgsSrNo || p.paymentId || '';
            return {
                paymentId: p.paymentId,
                date: p.date,
                checkNo: p.checkNo || '',
                type: p.type || (settings?.type || 'SB'),
                srNo: srNo,
                supplierName: toTitleCase(p.supplierName || ''),
                fatherName: toTitleCase(p.supplierFatherName || ''),
                contact: p.paidFor?.[0]?.supplierContact || p.supplierName || '',
                acNo: p.bankAcNo || '',
                ifscCode: p.bankIfsc || '',
                branch: toTitleCase(p.bankBranch || ''),
                bank: p.bankName || '',
                amount: p.rtgsAmount || p.amount || 0,
                rate: p.rate || 0,
                weight: p.quantity || 0,
                sixRNo: p.sixRNo || '',
                sixRDate: p.sixRDate || '',
                parchiNo: p.parchiNo || (p.paidFor?.map((pf: any) => pf.srNo).join(', ') || ''),
                utrNo: p.utrNo || '',
                supplierAddress: p.supplierAddress || ''
            };
        });
        return newReportRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [payments, settings]);


    const filteredReportRows = useMemo(() => {
        let filtered = reportRows;

        if (searchSrNo) {
            filtered = filtered.filter(row => row.srNo.toLowerCase().includes(searchSrNo.toLowerCase()));
        }
        if (searchCheckNo) {
            filtered = filtered.filter(row => row.checkNo.toLowerCase().includes(searchCheckNo.toLowerCase()));
        }
        if (searchName) {
            filtered = filtered.filter(row => row.supplierName.toLowerCase().startsWith(searchName.toLowerCase()));
        }
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(row => {
                const rowDate = new Date(row.date);
                return rowDate >= start && rowDate <= end;
            });
        } else if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(row => new Date(row.date) >= start);
        } else if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(row => new Date(row.date) <= end);
        }
        return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reportRows, searchSrNo, searchCheckNo, searchName, startDate, endDate]);
    
    const handlePrint = (_printRef: React.RefObject<HTMLDivElement>) => {
        if (!settings) {
            toast({ variant: 'destructive', title: 'Error', description: 'Missing settings for print.' });
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create print window.' });
            document.body.removeChild(iframe);
            return;
        }

        const printTableHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; background-color: #ffffff;">
                <thead>
                    <tr style="background-color: #f2f2f2 !important;">
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: left; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">6R No. / 6R Date</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: left; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Transaction</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: left; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Chk-No / UTR-No</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: left; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Payee</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: left; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">A/C No. / Mobile</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: left; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Bank / IFSC / Branch</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: left; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Amount / Rate / Quantity</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: right; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Mandi Charge</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: right; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Cess Charge</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: right; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Total Charges</th>
                        <th style="border: 1px solid #000000 !important; padding: 6px; text-align: left; background-color: #f2f2f2 !important; color: #000000 !important; font-weight: bold;">Parchi No.</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredReportRows.map(row => {
                        const bankDetails = `${row.bank || 'N/A'}<br/>${row.ifscCode || 'N/A'}<br/>${row.branch || 'N/A'}`;
                        const accountMobileDetails = `${row.acNo || 'N/A'}<br/>${row.contact || 'N/A'}`;
                        const payeeDetails = `${row.supplierName}<br/>S/O: ${row.fatherName}<br/>${row.supplierAddress || ''}`;
                        const sixRDetails = `${row.sixRNo || 'N/A'}<br/>${row.sixRDate ? format(new Date(row.sixRDate), 'dd-MMM-yy') : 'N/A'}`;
                        const checkUtrDetails = `${row.checkNo || 'N/A'}<br/>${row.utrNo || 'N/A'}`;
                        const mandiCharge = row.amount * 0.01;
                        const cessCharge = row.amount * 0.005;
                        const totalCharges = mandiCharge + cessCharge;
                        const formatNumber = (num: number) => Number(num.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const parchiLines = (() => {
                            const items = (row.parchiNo || '')
                                .split(',')
                                .map(s => s.trim())
                                .filter(Boolean);
                            if (items.length === 0) return '-';
                            const chunkSize = 4;
                            const lines: string[] = [];
                            for (let i = 0; i < items.length; i += chunkSize) {
                                lines.push(items.slice(i, i + chunkSize).join(', '));
                            }
                            return lines.join('<br/>' );
                        })();
                        return `
                            <tr style="background-color: #ffffff !important;">
                                <td style="border: 1px solid #000000 !important; padding: 6px; white-space: nowrap; background-color: #ffffff !important; color: #000000 !important;">${sixRDetails}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; white-space: nowrap; background-color: #ffffff !important; color: #000000 !important;">${format(new Date(row.date), 'dd-MMM-yy')}<br/>${row.srNo}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; background-color: #ffffff !important; color: #000000 !important;">${checkUtrDetails}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; background-color: #ffffff !important; color: #000000 !important;">${payeeDetails}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; background-color: #ffffff !important; color: #000000 !important;">${accountMobileDetails}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; background-color: #ffffff !important; color: #000000 !important;">${bankDetails}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; background-color: #ffffff !important; color: #000000 !important;">${formatNumber(row.amount)}<br/>${row.rate ? formatNumber(row.rate) : 'N/A'}<br/>${row.weight || 'N/A'}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; text-align: right; background-color: #ffffff !important; color: #000000 !important;">${formatNumber(mandiCharge)}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; text-align: right; background-color: #ffffff !important; color: #000000 !important;">${formatNumber(cessCharge)}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; text-align: right; background-color: #ffffff !important; color: #000000 !important;">${formatNumber(totalCharges)}</td>
                                <td style="border: 1px solid #000000 !important; padding: 6px; background-color: #ffffff !important; color: #000000 !important;">${parchiLines}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        iframeDoc.open();
        iframeDoc.write(`
            <html><head><title>RTGS Payment Report</title>
                <style>
                    @page { size: portrait; margin: 10mm; }
                    * { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        color-adjust: exact !important;
                    }
                    body { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        font-family: sans-serif; 
                        background-color: #ffffff !important;
                        color: #000000 !important;
                    }
                    .print-header { 
                        text-align: center; 
                        margin-bottom: 1rem; 
                        color: #000000 !important;
                    }
                    h2, p { 
                        color: #000000 !important; 
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        font-size: 10px; 
                        background-color: #ffffff !important;
                    }
                    th, td { 
                        border: 1px solid #000000 !important; 
                        padding: 6px !important; 
                        text-align: left; 
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    thead { 
                        background-color: #f2f2f2 !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    thead tr {
                        background-color: #f2f2f2 !important;
                    }
                    th { 
                        background-color: #f2f2f2 !important; 
                        color: #000000 !important;
                        font-weight: bold !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    td { 
                        vertical-align: top; 
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    tbody tr { 
                        background-color: #ffffff !important;
                    }
                    tbody td {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                    }
                </style>
            </head><body>
                <div class="print-header">
                    <h2>${toTitleCase(settings.companyName)} - RTGS Payment Report</h2>
                    <p>Date: ${format(new Date(), 'dd-MMM-yyyy')}</p>
                </div>
                ${printTableHTML}
            </body></html>
        `);
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
    };
    
    const handleDownloadExcel = () => {
        if (filteredReportRows.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        const dataToExport = filteredReportRows.map(p => ({
            'Date': format(new Date(p.date), 'dd-MMM-yy'),
            'SR No.': p.srNo,
            'Name': p.supplierName,
            'Father Name': p.fatherName,
            'Contact': p.contact,
            'A/C No.': p.acNo,
            'IFSC': p.ifscCode,
            'Bank': p.bank,
            'Branch': p.branch,
            'Amount': p.amount,
            'Check No.': p.checkNo,
            'Type': p.type,
            'Rate': p.rate,
            'Weight': p.weight,
            '6R No.': p.sixRNo,
            '6R Date': p.sixRDate ? format(new Date(p.sixRDate), 'dd-MMM-yy') : '',
            'Parchi No.': p.parchiNo,
            'UTR No.': p.utrNo,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "RTGS Report");
        XLSX.writeFile(workbook, `RTGS_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> Loading RTGS Reports...</div>;
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Filter RTGS Reports</CardTitle>
                    <CardDescription>Use the fields below to search and filter payments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="searchSrNo">Search SR No.</Label>
                            <Input
                                id="searchSrNo"
                                value={searchSrNo}
                                onChange={(e) => setSearchSrNo(e.target.value)}
                                placeholder="Enter SR No."
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="searchCheckNo">Search Check No.</Label>
                            <Input
                                id="searchCheckNo"
                                value={searchCheckNo}
                                onChange={(e) => setSearchCheckNo(e.target.value)}
                                placeholder="Enter Check No."
                            />
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="searchName">Search by Name</Label>
                            <Input
                                id="searchName"
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                placeholder="Enter supplier name"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, "PPP") : <span>Start Date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1">
                            <Label>End Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, "PPP") : <span>End Date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>RTGS Payment Report</CardTitle>
                        <CardDescription>A detailed report of all payments made via RTGS.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        {filteredReportRows.length > 0 && settings && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Button onClick={() => setIsBankMailFormatOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                                <Mail className="mr-2 h-4 w-4" /> Bank Mail Format
                            </Button>
                             <Button onClick={() => setIsBankMailFormat2Open(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                                <Mail className="mr-2 h-4 w-4" /> Bank Mail Format 2
                            </Button>
                            <Button onClick={() => setIsPrintPreviewOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                                <Printer className="mr-2 h-4 w-4" /> Print RTGS Format
                            </Button>
                            <Button onClick={() => setIsTablePrintPreviewOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                                <Printer className="mr-2 h-4 w-4" /> Print Table
                            </Button>
                        </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto h-[60vh] border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date / SR No.</TableHead>
                                    <TableHead>Payee / Father's Name</TableHead>
                                    <TableHead>Bank / Branch / IFSC</TableHead>
                                    <TableHead>A/C No. / Mobile</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Check / Parchi No.</TableHead>
                                    <TableHead>6R No. / Date</TableHead>
                                    <TableHead>UTR No.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReportRows.length > 0 ? (
                                    filteredReportRows.map((row, index) => (
                                        <TableRow key={`${row.paymentId}-${row.srNo}-${index}`}>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap">{format(new Date(row.date), 'dd-MMM-yy')}</div>
                                                <div className="text-xs text-muted-foreground">{row.srNo}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap">{row.supplierName}</div>
                                                <div className="text-xs text-muted-foreground whitespace-nowrap">{row.fatherName}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap">{row.bank}</div>
                                                <div className="text-xs text-muted-foreground whitespace-nowrap">{row.branch}</div>
                                                <div className="text-xs text-muted-foreground whitespace-nowrap">{row.ifscCode}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap">{row.acNo}</div>
                                                <div className="text-xs text-muted-foreground whitespace-nowrap">{row.contact}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold whitespace-nowrap">{formatCurrency(row.amount)}</div>
                                                <div className="text-xs text-muted-foreground whitespace-nowrap">{row.rate > 0 ? `${row.rate.toFixed(2)} @ ${row.weight.toFixed(2)} Qtl` : ''}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap">{row.checkNo}</div>
                                                <div className="text-xs text-muted-foreground max-w-24 truncate" title={row.parchiNo}>{row.parchiNo}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap">{row.sixRNo}</div>
                                                <div className="text-xs text-muted-foreground whitespace-nowrap">{row.sixRDate ? format(new Date(row.sixRDate), 'dd-MMM-yy') : ''}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap">{row.utrNo || '-'}</div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            No RTGS reports found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

             <Dialog open={isPrintPreviewOpen} onOpenChange={setIsPrintPreviewOpen}>
                <DialogContent className="max-w-4xl p-0 border-0">
                    {settings && <ConsolidatedRtgsPrintFormat payments={filteredReportRows} settings={settings} />}
                </DialogContent>
            </Dialog>

             <Dialog open={isTablePrintPreviewOpen} onOpenChange={setIsTablePrintPreviewOpen}>
                <DialogContent className="max-w-screen-xl w-full h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-4 border-b sr-only">
                        <DialogTitle>Table Print Preview</DialogTitle>
                        <DialogDescription>A preview of the RTGS report table.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="p-2 border-b flex justify-end gap-2">
                         <Button variant="outline" onClick={handleDownloadExcel}>
                            <Download className="mr-2 h-4 w-4" /> Download Excel
                        </Button>
                        <Button onClick={() => handlePrint(tablePrintRef)}><Printer className="mr-2 h-4 w-4"/>Print</Button>
                    </DialogFooter>
                    <div className="p-4 overflow-auto flex-grow">
                         <div ref={tablePrintRef}>
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="font-semibold text-gray-900">Date / SR No.</TableHead>
                                    <TableHead className="font-semibold text-gray-900">Payee / Father's Name</TableHead>
                                    <TableHead className="font-semibold text-gray-900">Bank / Branch / IFSC</TableHead>
                                    <TableHead className="font-semibold text-gray-900">A/C No. / Mobile</TableHead>
                                    <TableHead className="font-semibold text-gray-900">Amount</TableHead>
                                    <TableHead className="font-semibold text-gray-900">Check / Parchi No.</TableHead>
                                    <TableHead className="font-semibold text-gray-900">6R No. / Date</TableHead>
                                    <TableHead className="font-semibold text-gray-900">UTR No.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReportRows.length > 0 ? (
                                    filteredReportRows.map((row, index) => (
                                        <TableRow key={`${row.paymentId}-${row.srNo}-${index}`}>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap text-gray-900">{format(new Date(row.date), 'dd-MMM-yy')}</div>
                                                <div className="text-xs text-gray-700 font-medium">{row.srNo}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap text-gray-900">{row.supplierName}</div>
                                                <div className="text-xs text-gray-700 whitespace-nowrap font-medium">{row.fatherName}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap text-gray-900">{row.bank}</div>
                                                <div className="text-xs text-gray-700 whitespace-nowrap font-medium">{row.branch}</div>
                                                <div className="text-xs text-gray-700 whitespace-nowrap font-medium">{row.ifscCode}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap text-gray-900">{row.acNo}</div>
                                                <div className="text-xs text-gray-700 whitespace-nowrap font-medium">{row.contact}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold whitespace-nowrap text-gray-900">{formatCurrency(row.amount)}</div>
                                                <div className="text-xs text-gray-700 whitespace-nowrap font-medium">{row.rate > 0 ? `${row.rate.toFixed(2)} @ ${row.weight.toFixed(2)} Qtl` : ''}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap text-gray-900">{row.checkNo}</div>
                                                <div className="text-xs text-gray-700 max-w-24 truncate font-medium" title={row.parchiNo}>{row.parchiNo}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap text-gray-900">{row.sixRNo}</div>
                                                <div className="text-xs text-gray-700 whitespace-nowrap font-medium">{row.sixRDate ? format(new Date(row.sixRDate), 'dd-MMM-yy') : ''}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium whitespace-nowrap text-gray-900">{row.utrNo || '-'}</div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-gray-900">
                                            No RTGS reports found for the selected filter.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            </Table>
                         </div>
                    </div>
                </DialogContent>
            </Dialog>

            <BankMailFormatDialog 
                isOpen={isBankMailFormatOpen}
                onOpenChange={setIsBankMailFormatOpen}
                payments={filteredReportRows}
                settings={settings}
            />

            <BankMailFormatDialog2 
                isOpen={isBankMailFormat2Open}
                onOpenChange={setIsBankMailFormat2Open}
                payments={filteredReportRows}
                settings={settings}
            />

        </div>
    );
}







    
