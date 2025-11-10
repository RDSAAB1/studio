"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Payment, RtgsSettings } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Loader2, Printer, Download, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getRtgsSettings, getPaymentsRealtime } from '@/lib/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';
import { db } from '@/lib/database';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface SixRReportRow {
    paymentId: string; // Payment ID for updating
    sixRNo: string;
    sixRDate: string;
    transactionDate: string;
    rtgsSrNo?: string;
    supplierName: string;
    fatherName: string;
    supplierAddress: string;
    supplierContact: string;
    amount: number;
    rate?: number;
    quantity?: number;
    checkNo: string;
    parchiNo: string;
    bankName: string;
    bankAcNo: string;
    ifscCode: string;
    bankBranch: string;
    utrNo: string;
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
    const [sortOrder, setSortOrder] = useState<'default' | 'low-to-high' | 'high-to-low'>('default');
    
    // State for inline editing 6R No.
    const [editing6RNo, setEditing6RNo] = useState<string | null>(null);
    const [edited6RNo, setEdited6RNo] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);

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
            .filter(p => p.receiptType === 'RTGS') // Include all RTGS payments (with or without 6R number)
            .map(p => ({
                paymentId: p.id || p.paymentId || '',
                sixRNo: p.sixRNo || 'N/A',
                sixRDate: p.sixRDate ? format(new Date(p.sixRDate), 'dd-MMM-yy') : 'N/A',
                transactionDate: p.date ? format(new Date(p.date), 'dd-MMM-yy') : 'N/A',
                rtgsSrNo: (p as any).rtgsSrNo || '',
                supplierName: toTitleCase(p.supplierName || ''),
                fatherName: toTitleCase(p.supplierFatherName || ''),
                supplierAddress: toTitleCase(p.supplierAddress || ''),
                supplierContact: p.supplierContact || '',
                amount: p.rtgsAmount || p.amount || 0,
                rate: p.rate || 0,
                quantity: p.quantity || 0,
                checkNo: p.checkNo || 'N/A',
                parchiNo: p.parchiNo || (p.paidFor?.map((pf: any) => pf.srNo).join(', ') || ''),
                bankName: p.bankName || '',
                bankAcNo: p.bankAcNo || '',
                ifscCode: p.bankIfsc || '',
                bankBranch: p.bankBranch || '',
                utrNo: p.utrNo || '',
            }));
    }, [payments]);

    // Helper function to extract numeric value from 6R number for sorting
    const extractNumericValue = (sixRNo: string): number => {
        if (!sixRNo || sixRNo === 'N/A') return 0;
        // Extract numbers from the string (e.g., "6R-001" -> 1, "6R-123" -> 123)
        const match = sixRNo.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };

    const filteredReportRows = useMemo(() => {
        let filtered = reportRows;

        if (search6RNo) {
            filtered = filtered.filter(row => (row.sixRNo || '').toLowerCase().includes(search6RNo.toLowerCase()));
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
                // Use transaction date for filtering, fallback to 6R date if transaction date is N/A
                const rowDateStr = row.transactionDate !== 'N/A' ? row.transactionDate : row.sixRDate;
                if (rowDateStr === 'N/A') return true; // Include entries with no date in filter range
                const rowDate = new Date(rowDateStr);
                return rowDate >= start && rowDate <= end;
            });
        }
        
        // Apply sorting based on sortOrder
        return filtered.sort((a, b) => {
            if (sortOrder === 'low-to-high') {
                // Sort by 6R number (low to high)
                const aNum = extractNumericValue(a.sixRNo);
                const bNum = extractNumericValue(b.sixRNo);
                if (aNum !== bNum) {
                    return aNum - bNum;
                }
                // If numbers are equal, sort alphabetically
                return (a.sixRNo || '').localeCompare(b.sixRNo || '');
            } else if (sortOrder === 'high-to-low') {
                // Sort by 6R number (high to low)
                const aNum = extractNumericValue(a.sixRNo);
                const bNum = extractNumericValue(b.sixRNo);
                if (aNum !== bNum) {
                    return bNum - aNum;
                }
                // If numbers are equal, sort alphabetically (reverse)
                return (b.sixRNo || '').localeCompare(a.sixRNo || '');
            } else {
                // Default: Sort by transaction date if available, else by 6R date
                const aDate = a.transactionDate !== 'N/A' ? new Date(a.transactionDate).getTime() : (a.sixRDate !== 'N/A' ? new Date(a.sixRDate).getTime() : 0);
                const bDate = b.transactionDate !== 'N/A' ? new Date(b.transactionDate).getTime() : (b.sixRDate !== 'N/A' ? new Date(b.sixRDate).getTime() : 0);
                return bDate - aDate;
            }
        });
    }, [reportRows, search6RNo, searchName, startDate, endDate, sortOrder]);

    const handlePrint = () => {
        if (!settings) return;
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;
        
        // Create custom print table with combined columns
        const printTableHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">6R No. / 6R Date</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">Transaction</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">Chk-No / UTR-No</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">Payee</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">A/C No. / Mobile</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">Bank / IFSC / Branch</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">Amount / Rate / Quantity</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: right;">Mandi Charge</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: right;">Cess Charge</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: right;">Total Charges</th>
                        <th style="border: 1px solid #ccc; padding: 4px; text-align: left;">Parchi No.</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredReportRows.map(row => {
                        const bankDetails = `${row.bankName || 'N/A'}<br/>${row.ifscCode || 'N/A'}<br/>${row.bankBranch || 'N/A'}`;
                        const accountMobileDetails = `${row.bankAcNo || 'N/A'}<br/>${row.supplierContact || 'N/A'}`;
                        const payeeDetails = `${row.supplierName}<br/>S/O: ${row.fatherName}<br/>${row.supplierAddress}`;
                        const sixRDetails = `${row.sixRNo || 'N/A'}<br/>${row.sixRDate || 'N/A'}`;
                        const checkUtrDetails = `${row.checkNo || 'N/A'}<br/>${row.utrNo || 'N/A'}`;
                        
                        // Calculate charges
                        const mandiCharge = row.amount * 0.01; // 1%
                        const cessCharge = row.amount * 0.005; // 0.5%
                        const totalCharges = mandiCharge + cessCharge;
                        
                        const formatNumber = (num: number) => Number(num.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        
                        // Format parchi numbers into multiple lines (max 4 per line)
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
                            return lines.join('<br/>');
                        })();

                        return `
                            <tr>
                                <td style="border: 1px solid #ccc; padding: 4px; white-space: nowrap;">${sixRDetails}</td>
                                <td style="border: 1px solid #ccc; padding: 4px; white-space: nowrap;">${row.transactionDate || 'N/A'}${row.rtgsSrNo ? `<br/>${row.rtgsSrNo}` : ''}</td>
                                <td style="border: 1px solid #ccc; padding: 4px;">${checkUtrDetails}</td>
                                <td style="border: 1px solid #ccc; padding: 4px;">${payeeDetails}</td>
                                <td style="border: 1px solid #ccc; padding: 4px;">${accountMobileDetails}</td>
                                <td style="border: 1px solid #ccc; padding: 4px;">${bankDetails}</td>
                                <td style="border: 1px solid #ccc; padding: 4px;">${formatNumber(row.amount)}<br/>${row.rate ? formatNumber(row.rate) : 'N/A'}<br/>${row.quantity || 'N/A'}</td>
                                <td style="border: 1px solid #ccc; padding: 4px; text-align: right;">${formatNumber(mandiCharge)}</td>
                                <td style="border: 1px solid #ccc; padding: 4px; text-align: right;">${formatNumber(cessCharge)}</td>
                                <td style="border: 1px solid #ccc; padding: 4px; text-align: right;">${formatNumber(totalCharges)}</td>
                                <td style="border: 1px solid #ccc; padding: 4px;">${parchiLines}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        iframeDoc.open();
        iframeDoc.write(`
            <html><head><title>6R Report</title>
                <style>
                    @media print {
                        @page { size: portrait; margin: 10mm; }
                        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: sans-serif; }
                        .print-header { text-align: center; margin-bottom: 1rem; }
                        table { width: 100%; border-collapse: collapse; font-size: 10px; }
                        th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
                        thead { background-color: #f2f2f2 !important; }
                        th { background-color: #f2f2f2 !important; }
                        td { vertical-align: top; }
                    }
                </style>
            </head><body>
                <div class="print-header">
                    <h2>${toTitleCase(settings.companyName)} - 6R Report</h2>
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

        const dataToExport = filteredReportRows.map(p => {
            // Calculate charges
            const mandiCharge = p.amount * 0.01; // 1%
            const cessCharge = p.amount * 0.005; // 0.5%
            const totalCharges = mandiCharge + cessCharge;
            
            const formatNumber = (num: number) => Number(num.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            
            return {
                '6R No.': p.sixRNo,
                '6R Date': p.sixRDate,
                'Transaction Date': p.transactionDate,
                'Payee': `${p.supplierName}, S/O: ${p.fatherName}, ${p.supplierAddress}`,
                'A/C No. / Mobile': `${p.bankAcNo || 'N/A'}\n${p.supplierContact || 'N/A'}`,
                'Bank / IFSC / Branch': `${p.bankName || 'N/A'}\n${p.ifscCode || 'N/A'}\n${p.bankBranch || 'N/A'}`,
                'Amount': formatNumber(p.amount),
                'Rate': p.rate ? formatNumber(p.rate) : 'N/A',
                'Quantity': p.quantity || 'N/A',
                'Mandi Charge': formatNumber(mandiCharge),
                'Cess Charge': formatNumber(cessCharge),
                'Total Charges': formatNumber(totalCharges),
                'Check No.': p.checkNo,
                'Parchi No.': p.parchiNo,
                'UTR No.': p.utrNo,
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "6R Report");
        XLSX.writeFile(workbook, `6R_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const handleEdit6RNo = (paymentId: string, current6RNo: string) => {
        setEditing6RNo(paymentId);
        setEdited6RNo(current6RNo === 'N/A' ? '' : current6RNo);
    };

    const handleCancelEdit = () => {
        setEditing6RNo(null);
        setEdited6RNo('');
    };

    const handleSave6RNo = async (paymentId: string) => {
        if (!paymentId) {
            toast({ title: "Error", description: "Payment ID not found", variant: "destructive" });
            return;
        }

        const trimmed6RNo = edited6RNo.trim();
        setIsUpdating(true);

        try {
            const paymentRef = doc(firestoreDB, 'payments', paymentId);
            const updateData: Partial<Payment> = {
                sixRNo: trimmed6RNo || undefined, // Remove field if empty
            };
            
            await updateDoc(paymentRef, updateData);
            
            // Also update local IndexedDB if available
            if (typeof window !== 'undefined' && db) {
                try {
                    const existing = await db.payments.get(paymentId);
                    if (existing) {
                        await db.payments.put({ ...existing, sixRNo: trimmed6RNo || undefined });
                    }
                } catch (localError) {
                    console.warn('Failed to update local IndexedDB:', localError);
                }
            }

            toast({ 
                title: "Success", 
                description: `6R No. ${trimmed6RNo ? 'updated' : 'removed'} successfully`, 
                variant: "default" 
            });
            
            setEditing6RNo(null);
            setEdited6RNo('');
        } catch (error: any) {
            console.error('Error updating 6R No:', error);
            toast({ 
                title: "Error", 
                description: error?.message || "Failed to update 6R No.", 
                variant: "destructive" 
            });
        } finally {
            setIsUpdating(false);
        }
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="search6RNo">Search 6R No.</Label>
                            <Input id="search6RNo" value={search6RNo} onChange={(e) => setSearch6RNo(e.target.value)} placeholder="Enter 6R No." />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="searchName">Search by Name</Label>
                            <Input id="searchName" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Enter supplier name" />
                        </div>
                        <div className="space-y-1">
                            <Label>Sort by Serial No.</Label>
                            <Select value={sortOrder} onValueChange={(value: 'default' | 'low-to-high' | 'high-to-low') => setSortOrder(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select sort order" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default (Date)</SelectItem>
                                    <SelectItem value="low-to-high">Low to High</SelectItem>
                                    <SelectItem value="high-to-low">High to Low</SelectItem>
                                </SelectContent>
                            </Select>
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
                    <ScrollArea className="h-[60vh] border rounded-md">
                        <div ref={printRef} className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="py-1 px-2">6R No. / 6R Date</TableHead>
                                        <TableHead className="py-1 px-2">Transaction</TableHead>
                                        <TableHead className="py-1 px-2">Chk-No / UTR-No</TableHead>
                                        <TableHead className="py-1 px-2">Payee</TableHead>
                                        <TableHead className="py-1 px-2">A/C No. / Mobile</TableHead>
                                        <TableHead className="py-1 px-2">Bank / IFSC / Branch</TableHead>
                                        <TableHead className="py-1 px-2">Amount / Rate / Quantity</TableHead>
                                        <TableHead className="py-1 px-2">Parchi No.</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredReportRows.length > 0 ? (
                                        filteredReportRows.map((row, index) => (
                                            <TableRow key={`${row.paymentId}-${index}`}>
                                                <TableCell className="py-1 px-2">
                                                    <div className="font-medium whitespace-nowrap">{row.sixRNo}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">{row.sixRDate}</div>
                                                </TableCell>
                                                <TableCell className="py-1 px-2">
                                                    <div className="font-medium whitespace-nowrap">{row.transactionDate}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">{row.rtgsSrNo || ''}</div>
                                                </TableCell>
                                                <TableCell className="py-1 px-2">
                                                    <div className="font-medium whitespace-nowrap">{row.checkNo}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">{row.utrNo || '-'}</div>
                                                </TableCell>
                                                <TableCell className="py-1 px-2">
                                                    <div className="font-medium">{row.supplierName}</div>
                                                    <div className="text-xs text-muted-foreground">S/O: {row.fatherName}</div>
                                                    <div className="text-xs text-muted-foreground">{row.supplierAddress}</div>
                                                </TableCell>
                                                <TableCell className="py-1 px-2">
                                                    <div className="font-mono whitespace-nowrap">{row.bankAcNo}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">{row.supplierContact}</div>
                                                </TableCell>
                                                <TableCell className="py-1 px-2">
                                                    <div className="whitespace-nowrap">{row.bankName}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">{row.ifscCode}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">{row.bankBranch || ''}</div>
                                                </TableCell>
                                                <TableCell className="py-1 px-2">
                                                    <div className="font-medium whitespace-nowrap">{Number(row.amount.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">{row.rate ? `Rate: ${Number(row.rate.toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rate: N/A'}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">Qty: {row.quantity || 'N/A'}</div>
                                                </TableCell>
                                                <TableCell className="py-1 px-2 max-w-40 whitespace-pre-line" title={row.parchiNo}>{(() => {
                                                    const items = (row.parchiNo || '').split(',').map(s => s.trim()).filter(Boolean);
                                                    if (items.length === 0) return '-';
                                                    const chunkSize = 4;
                                                    const lines: string[] = [];
                                                    for (let i = 0; i < items.length; i += chunkSize) {
                                                        lines.push(items.slice(i, i + chunkSize).join(', '));
                                                    }
                                                    return lines.join('\n');
                                                })()}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center">No 6R reports found for the selected criteria.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
