
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Payment, RtgsSettings } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, toTitleCase, formatSrNo } from '@/lib/utils';
import { Loader2, Edit, Save, X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getRtgsSettings, updateRtgsSettings, getPaymentsRealtime } from '@/lib/firestore';
import { ConsolidatedRtgsPrintFormat } from '@/components/sales/consolidated-rtgs-print';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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

const initialSettings: RtgsSettings = {
    companyName: "JAGDAMBE RICE MILL",
    companyAddress1: "DEVKALI, BANDA",
    companyAddress2: "SHAHJAHANPUR, (242042)",
    bankName: "BANK OF BARODA",
    ifscCode: "BARB0BANDAX",
    branchName: "BANDA",
    accountNo: "08290500004938",
    contactNo: "9794092767",
    gmail: "jrmdofficial@gmail.com",
};

export default function RtgsReportClient() {
    const [reportRows, setReportRows] = useState<RtgsReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings>(initialSettings);
    const [isEditing, setIsEditing] = useState(false);
    const [tempSettings, setTempSettings] = useState<RtgsSettings>(initialSettings);
    const { toast } = useToast();
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
    const tablePrintRef = useRef<HTMLDivElement>(null);


    // State for search filters
    const [searchSrNo, setSearchSrNo] = useState('');
    const [searchCheckNo, setSearchCheckNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
    const [endDate, setEndDate] = useState<string>(''); // YYYY-MM-DD

    useEffect(() => {
        setLoading(true);

        const fetchSettings = async () => {
            const savedSettings = await getRtgsSettings();
            if (savedSettings) {
                setSettings(savedSettings);
                setTempSettings(savedSettings);
            }
        };
        fetchSettings();

        const unsubscribe = getPaymentsRealtime((payments) => {
            const rtgsPayments = payments.filter(p => p.receiptType === 'RTGS');
            const newReportRows: RtgsReportRow[] = rtgsPayments.map(p => {
                // Use rtgsSrNo if it exists, otherwise fallback to paymentId for older records
                const srNo = p.rtgsSrNo || p.paymentId || '';
                return {
                    paymentId: p.paymentId,
                    date: p.date,
                    checkNo: p.checkNo || '',
                    type: p.type,
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
    }, []);

    const handleEditToggle = () => {
        if (isEditing) {
            setTempSettings(settings);
        }
        setIsEditing(!isEditing);
    };

    const handleSave = async () => {
        try {
            await updateRtgsSettings(tempSettings);
            setSettings(tempSettings);
            setIsEditing(false);
            toast({ title: "Details saved successfully", variant: "success" });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ title: "Failed to save details", variant: "destructive" });
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setTempSettings(prev => ({ ...prev, [name]: value }));
    };

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
    
    const handlePrint = (contentRef: React.RefObject<HTMLDivElement>) => {
        const node = contentRef.current;
        if (!node) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            toast({ variant: 'destructive', title: 'Could not create print content.' });
            return;
        }

        const title = 'RTGS Report';
        
        iframeDoc.open();
        iframeDoc.write(`
            <html>
                <head>
                    <title>${title}</title>
        `);
        
        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const style = iframeDoc.createElement('style');
                style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                iframeDoc.head.appendChild(style);
            } catch(e) {
                console.warn('Could not copy stylesheet:', e);
            }
        });

        iframeDoc.write(`
                    <style>
                        @media print {
                            @page { 
                                size: landscape; 
                                margin: 15px; 
                            }
                            body { 
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                                color: #000 !important;
                                font-size: 7px;
                             }
                             table {
                                font-size: 7px;
                                border-collapse: collapse;
                                width: 100%;
                             }
                             th, td {
                                 padding: 2px !important;
                                 border: 1px solid #ccc !important;
                             }
                        }
                    </style>
                </head>
                <body>
                    <h2>${toTitleCase(settings.companyName)} - ${title}</h2>
                    <p>Date: ${format(new Date(), 'dd-MMM-yyyy')}</p>
                    ${node.innerHTML}
                </body>
            </html>
        `);
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> Loading RTGS Reports...</div>;
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    {isEditing ? (
                        <div className="flex-1 mr-4">
                            <CardTitle>Edit Details</CardTitle>
                            <CardDescription>Update your company and bank information here.</CardDescription>
                        </div>
                    ) : (
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold">{settings.companyName}</h2>
                            <p className="text-sm text-muted-foreground">{`${settings.companyAddress1}, ${settings.companyAddress2}`}</p>
                            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                <p>{settings.contactNo}</p>
                                <p>{settings.gmail}</p>
                                <p>{settings.bankName}</p>
                                <p>A/C: {settings.accountNo}</p>
                                <p>IFSC: {settings.ifscCode} | Branch: {settings.branchName}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <Button onClick={handleSave} size="sm"><Save className="mr-2 h-4 w-4"/>Save</Button>
                                <Button onClick={handleEditToggle} size="sm" variant="outline"><X className="mr-2 h-4 w-4"/>Cancel</Button>
                            </>
                        ) : (
                            <Button onClick={handleEditToggle} size="sm"><Edit className="mr-2 h-4 w-4"/>Edit Details</Button>
                        )}
                    </div>
                </CardHeader>
                {isEditing && (
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                            <div className="space-y-1"><Label>Company Name</Label><Input name="companyName" value={tempSettings.companyName} onChange={handleInputChange} /></div>
                            <div className="space-y-1"><Label>Address Line 1</Label><Input name="companyAddress1" value={tempSettings.companyAddress1} onChange={handleInputChange} /></div>
                            <div className="space-y-1"><Label>Address Line 2</Label><Input name="companyAddress2" value={tempSettings.companyAddress2} onChange={handleInputChange} /></div>
                            <div className="space-y-1"><Label>Bank Name</Label><Input name="bankName" value={tempSettings.bankName} onChange={handleInputChange} /></div>
                            <div className="space-y-1"><Label>IFSC Code</Label><Input name="ifscCode" value={tempSettings.ifscCode} onChange={handleInputChange} /></div>
                            <div className="space-y-1"><Label>Branch Name</Label><Input name="branchName" value={tempSettings.branchName} onChange={handleInputChange} /></div>
                            <div className="space-y-1"><Label>Account No.</Label><Input name="accountNo" value={tempSettings.accountNo} onChange={handleInputChange} /></div>
                            <div className="space-y-1"><Label>Contact No.</Label><Input name="contactNo" value={tempSettings.contactNo} onChange={handleInputChange} /></div>
                            <div className="space-y-1"><Label>Email</Label><Input name="gmail" type="email" value={tempSettings.gmail} onChange={handleInputChange} /></div>
                        </div>
                    </CardContent>
                )}
            </Card>

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
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>RTGS Payment Report</CardTitle>
                        <CardDescription>A detailed report of all payments made via RTGS.</CardDescription>
                    </div>
                     {filteredReportRows.length > 0 && (
                        <div className="flex gap-2">
                            <Button onClick={() => setIsPrintPreviewOpen(true)} size="sm" variant="outline">
                                <Printer className="mr-2 h-4 w-4" /> Print RTGS Format
                            </Button>
                            <Button onClick={() => handlePrint(tablePrintRef)} size="sm" variant="outline">
                                <Printer className="mr-2 h-4 w-4" /> Print Table
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto" ref={tablePrintRef}>
                        <Table className="min-w-[1200px]">
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead className="w-[80px]">SR No.</TableHead>
                                    <TableHead className="w-[150px]">Name</TableHead>
                                    <TableHead className="w-[150px]">Father's Name</TableHead>
                                    <TableHead className="w-[120px]">Mobile No.</TableHead>
                                    <TableHead className="w-[150px]">A/C No.</TableHead>
                                    <TableHead className="w-[120px]">IFSC Code</TableHead>
                                    <TableHead className="w-[150px]">Bank</TableHead>
                                    <TableHead className="w-[150px]">Branch</TableHead>
                                    <TableHead className="w-[120px]">Amount</TableHead>
                                    <TableHead className="w-[150px]">Check No.</TableHead>
                                    <TableHead className="w-[100px]">Type</TableHead>
                                    <TableHead className="w-[80px]">Rate</TableHead>
                                    <TableHead className="w-[80px]">Weight</TableHead>
                                    <TableHead className="w-[100px]">6R No.</TableHead>
                                    <TableHead className="w-[120px]">6R Date</TableHead>
                                    <TableHead className="w-[100px]">Parchi No.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReportRows.length > 0 ? (
                                    filteredReportRows.map((row, index) => (
                                        <TableRow key={`${row.paymentId}-${row.srNo}-${index}`}>
                                            <TableCell className="whitespace-nowrap">{format(new Date(row.date), 'dd-MMM-yy')}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.srNo}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.supplierName}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.fatherName}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.contact}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.acNo}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.ifscCode}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.bank}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.branch}</TableCell>
                                            <TableCell className="whitespace-nowrap">{formatCurrency(row.amount)}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.checkNo}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.type}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.rate.toFixed(2)}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.weight.toFixed(2)}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.sixRNo}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.sixRDate ? format(new Date(row.sixRDate), 'dd-MMM-yy') : ''}</TableCell>
                                            <TableCell className="whitespace-nowrap">{row.parchiNo}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={17} className="h-24 text-center">
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
                    <ConsolidatedRtgsPrintFormat payments={filteredReportRows} settings={settings} />
                </DialogContent>
            </Dialog>

        </div>
    );
}
