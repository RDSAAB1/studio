
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Payment, RtgsSettings } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Loader2, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getRtgsSettings, getPaymentsRealtime } from '@/lib/firestore';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';


interface SixRReportRow {
    sixRNo: string;
    sixRDate: string;
    supplierName: string;
    fatherName: string;
    supplierAddress: string;
    supplierContact: string;
    amount: number;
    checkNo: string;
    parchiNo: string;
    bankName: string;
    bankAcNo: string;
    ifscCode: string;
}

export default function SixRReportPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings | null>(null);
    const { toast } = useToast();
    const printRef = useRef<HTMLDivElement>(null);

    const [search6RNo, setSearch6RNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    useEffect(() => {
        getRtgsSettings().then(setSettings);
        const unsubscribe = getPaymentsRealtime(data => {
            setPayments(data);
            setLoading(false);
        }, console.error);
        return () => unsubscribe();
    }, []);

    const reportRows = useMemo((): SixRReportRow[] => {
        if (!payments) return [];
        return payments
            .filter(p => p.sixRNo) // Only include payments with a 6R number
            .map(p => ({
                sixRNo: p.sixRNo!,
                sixRDate: p.sixRDate ? format(new Date(p.sixRDate), 'dd-MMM-yy') : 'N/A',
                supplierName: toTitleCase(p.supplierName || ''),
                fatherName: toTitleCase(p.supplierFatherName || ''),
                supplierAddress: toTitleCase(p.supplierAddress || ''),
                supplierContact: p.supplierContact || '',
                amount: p.rtgsAmount || p.amount || 0,
                checkNo: p.checkNo || 'N/A',
                parchiNo: p.parchiNo || (p.paidFor?.map((pf: any) => pf.srNo).join(', ') || ''),
                bankName: p.bankName || '',
                bankAcNo: p.bankAcNo || '',
                ifscCode: p.bankIfsc || '',
            }));
    }, [payments]);

    const filteredReportRows = useMemo(() => {
        let filtered = reportRows;

        if (search6RNo) {
            filtered = filtered.filter(row => row.sixRNo.toLowerCase().includes(search6RNo.toLowerCase()));
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
                const rowDate = new Date(row.sixRDate);
                return rowDate >= start && rowDate <= end;
            });
        }
        return filtered.sort((a, b) => new Date(b.sixRDate).getTime() - new Date(a.sixRDate).getTime());
    }, [reportRows, search6RNo, searchName, startDate, endDate]);

    const handlePrint = () => {
        const node = printRef.current;
        if (!node || !settings) return;
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;
        
        iframeDoc.open();
        iframeDoc.write(`
            <html><head><title>6R Report</title>
                <style>
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: sans-serif; }
                        .print-header { text-align: center; margin-bottom: 1rem; }
                        table { width: 100%; border-collapse: collapse; font-size: 10px; }
                        th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
                        thead { background-color: #f2f2f2 !important; }
                    }
                </style>
            </head><body>
                <div class="print-header">
                    <h2>${toTitleCase(settings.companyName)} - 6R Report</h2>
                    <p>Date: ${format(new Date(), 'dd-MMM-yyyy')}</p>
                </div>
            </body></html>
        `);
        iframeDoc.body.appendChild(node.cloneNode(true));
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
            '6R No.': p.sixRNo,
            '6R Date': p.sixRDate,
            'Payee': `${p.supplierName}, S/O: ${p.fatherName}`,
            'Address': p.supplierAddress,
            'Contact': p.supplierContact,
            'Bank Name': p.bankName,
            'Account No.': p.bankAcNo,
            'IFSC': p.ifscCode,
            'Amount': p.amount,
            'Check No.': p.checkNo,
            'Parchi No.': p.parchiNo,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "6R Report");
        XLSX.writeFile(workbook, `6R_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> Loading 6R Reports...</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Filter 6R Reports</CardTitle>
                    <CardDescription>Search payments by 6R number, name, or date range.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="search6RNo">Search 6R No.</Label>
                            <Input id="search6RNo" value={search6RNo} onChange={(e) => setSearch6RNo(e.target.value)} placeholder="Enter 6R No." />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="searchName">Search by Name</Label>
                            <Input id="searchName" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Enter supplier name" />
                        </div>
                        <div className="space-y-1">
                            <Label>Start Date</Label>
                            <Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(startDate, "PPP") : <span>Start Date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} /></PopoverContent></Popover>
                        </div>
                        <div className="space-y-1">
                            <Label>End Date</Label>
                            <Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{endDate ? format(endDate, "PPP") : <span>End Date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} /></PopoverContent></Popover>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <CardTitle>6R Report</CardTitle>
                        <CardDescription>A detailed report of all payments with a 6R number.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleDownloadExcel} variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Download Excel</Button>
                        <Button onClick={handlePrint} size="sm"><Printer className="mr-2 h-4 w-4" />Print Report</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto h-[60vh] border rounded-md" ref={printRef}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>6R No.</TableHead>
                                    <TableHead>6R Date</TableHead>
                                    <TableHead>Payee</TableHead>
                                    <TableHead>Bank Name</TableHead>
                                    <TableHead>A/C No.</TableHead>
                                    <TableHead>IFSC Code</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Check No.</TableHead>
                                    <TableHead>Parchi No.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReportRows.length > 0 ? (
                                    filteredReportRows.map((row, index) => (
                                        <TableRow key={`${row.sixRNo}-${index}`}>
                                            <TableCell className="font-bold">{row.sixRNo}</TableCell>
                                            <TableCell>{row.sixRDate}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{row.supplierName}</div>
                                                <div className="text-xs text-muted-foreground">S/O: {row.fatherName}</div>
                                                <div className="text-xs text-muted-foreground">{row.supplierAddress}</div>
                                                <div className="text-xs text-muted-foreground">Contact: {row.supplierContact}</div>
                                            </TableCell>
                                            <TableCell>{row.bankName}</TableCell>
                                            <TableCell className="font-mono">{row.bankAcNo}</TableCell>
                                            <TableCell className="font-mono">{row.ifscCode}</TableCell>
                                            <TableCell className="font-bold">{formatCurrency(row.amount)}</TableCell>
                                            <TableCell>{row.checkNo}</TableCell>
                                            <TableCell className="max-w-24 truncate" title={row.parchiNo}>{row.parchiNo}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">No 6R reports found for the selected criteria.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
