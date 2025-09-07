
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
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';


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
}

export default function RtgsReportClient() {
    const [reportRows, setReportRows] = useState<RtgsReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings | null>(null);
    const { toast } = useToast();
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
    const [isTablePrintPreviewOpen, setIsTablePrintPreviewOpen] = useState(false);
    const [isBankMailFormatOpen, setIsBankMailFormatOpen] = useState(false);
    const tablePrintRef = useRef<HTMLDivElement>(null);


    // State for search filters
    const [searchSrNo, setSearchSrNo] = useState('');
    const [searchCheckNo, setSearchCheckNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
    const [endDate, setEndDate] = useState<string>(''); // YYYY-MM-DD

    useEffect(() => {
        setLoading(true);
        let currentSettings: RtgsSettings | null = null;

        const fetchSettings = async () => {
            const savedSettings = await getRtgsSettings();
            if (savedSettings) {
                currentSettings = savedSettings;
                setSettings(savedSettings);
            }
        };
        
        fetchSettings().then(() => {
            const unsubscribe = getPaymentsRealtime((payments) => {
                const rtgsPayments = payments.filter(p => p.receiptType === 'RTGS');
                const newReportRows: RtgsReportRow[] = rtgsPayments.map(p => {
                    const srNo = p.rtgsSrNo || p.paymentId || '';
                    return {
                        paymentId: p.paymentId,
                        date: p.date,
                        checkNo: p.checkNo || '',
                        type: p.type || (currentSettings?.type || 'SB'),
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
                        parchiNo: p.parchiNo || (p.paidFor?.map(pf => pf.srNo).join(', ') || ''),
                    };
                });

                newReportRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setReportRows(newReportRows);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching RTGS reports: ", error);
                setLoading(false);
            });

            return () => unsubscribe();
        });

    }, []);

    const filteredReportRows = useMemo(() => {
        let filtered = reportRows;

        if (searchSrNo) {
            filtered = filtered.filter(row => row.srNo.toLowerCase().includes(searchSrNo.toLowerCase()));
        }
        if (searchCheckNo) {
            filtered = filtered.filter(row => row.checkNo.toLowerCase().includes(searchCheckNo.toLowerCase()));
        }
        if (searchName) {
            filtered = filtered.filter(row => row.supplierName.toLowerCase().includes(searchName.toLowerCase()));
        }
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(row => {
                const rowDate = new Date(row.date);
                return rowDate >= start && rowDate <= end;
            });
        } else if (startDate) {
            const start = new Date(startDate);
            filtered = filtered.filter(row => new Date(row.date) >= start);
        } else if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(row => new Date(row.date) <= end);
        }
        return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reportRows, searchSrNo, searchCheckNo, searchName, startDate, endDate]);
    
    const handleDownloadPdf = () => {
        const node = tablePrintRef.current;
        if (!node || !settings) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find the table content to print.' });
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
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create print content.' });
            document.body.removeChild(iframe);
            return;
        }

        const title = 'RTGS Payment Report';
        
        iframeDoc.open();
        iframeDoc.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <link rel="stylesheet" href="${window.location.origin}/globals.css">
                    <style>
                        @media print {
                            @page { 
                                size: landscape; 
                                margin: 10mm; 
                            }
                            body { 
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                                color: #000 !important;
                                background-color: #fff !important;
                            }
                            table {
                                font-size: 8px !important;
                                border-collapse: collapse !important;
                                width: 100% !important;
                            }
                            th, td {
                                padding: 2px 4px !important;
                                border: 1px solid #ccc !important;
                                white-space: nowrap !important;
                            }
                            thead {
                                background-color: #f2f2f2 !important;
                            }
                            .print-header, .print-footer {
                                display: block !important;
                                margin-bottom: 1rem;
                            }
                             .no-print {
                                display: none !important;
                            }
                        }
                    </style>
                </head>
                <body class="bg-white text-black p-4">
                    <div class="print-header">
                      <h2 class="text-xl font-bold">${toTitleCase(settings.companyName)} - ${title}</h2>
                      <p class="text-sm">Date: ${format(new Date(), 'dd-MMM-yyyy')}</p>
                    </div>
                    ${node.outerHTML}
                </body>
            </html>
        `);
        iframeDoc.close();

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 1000);
    };

    const handlePrint = () => handleDownloadPdf();

    if (loading || !settings) {
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
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="endDate">End Date</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
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
                     {filteredReportRows.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Button onClick={() => setIsBankMailFormatOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                                <Mail className="mr-2 h-4 w-4" /> Bank Mail Format
                            </Button>
                            <Button onClick={() => setIsPrintPreviewOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                                <Printer className="mr-2 h-4 w-4" /> Print RTGS Format
                            </Button>
                            <Button onClick={() => setIsTablePrintPreviewOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                                <Printer className="mr-2 h-4 w-4" /> Print Table
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto h-[60vh] border rounded-md">
                        <div ref={tablePrintRef}>
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
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center">
                                                No RTGS reports found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

             <Dialog open={isPrintPreviewOpen} onOpenChange={setIsPrintPreviewOpen}>
                <DialogContent className="max-w-4xl p-0 border-0">
                    <ConsolidatedRtgsPrintFormat payments={filteredReportRows} settings={settings} />
                </DialogContent>
            </Dialog>

             <Dialog open={isTablePrintPreviewOpen} onOpenChange={setIsTablePrintPreviewOpen}>
                <DialogContent className="max-w-screen-xl w-full h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-4 border-b sr-only">
                        <DialogTitle>Table Print Preview</DialogTitle>
                        <DialogDescription>A preview of the RTGS report table.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="p-2 border-b flex justify-end gap-2">
                        <Button variant="outline" onClick={handleDownloadPdf}>
                            <Download className="mr-2 h-4 w-4" /> Download in pdf
                        </Button>
                        <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
                    </DialogFooter>
                    <div className="p-4 overflow-auto flex-grow">
                        <div dangerouslySetInnerHTML={{ __html: tablePrintRef.current?.outerHTML || "" }} />
                    </div>
                </DialogContent>
            </Dialog>

            <BankMailFormatDialog 
                isOpen={isBankMailFormatOpen}
                onOpenChange={setIsBankMailFormatOpen}
                payments={filteredReportRows}
                settings={settings}
            />

        </div>
    );
}
