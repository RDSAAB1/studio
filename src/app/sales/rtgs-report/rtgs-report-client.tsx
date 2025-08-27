
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Payment, RtgsSettings } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Loader2, Edit, Save, X, Building, Landmark, Printer } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getRtgsSettings, updateRtgsSettings } from '@/lib/firestore';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';


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

const RtgsPrintFormat = ({ payment, settings }: { payment: RtgsReportRow, settings: RtgsSettings }) => (
    <div className="p-4 bg-white text-black font-sans text-xs page-break-after">
         <style>
            {`
              @media print {
                @page {
                  size: A4;
                  margin: 10mm;
                }
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-bg-orange {
                    background-color: #fed7aa !important;
                }
                .page-break-after {
                    page-break-after: always;
                }
              }
            `}
        </style>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
            <div className="w-1/4">
                    <div className="w-24 h-12 bg-gray-200 flex items-center justify-center text-gray-500 text-xs">Bank Logo</div>
            </div>
            <div className="w-1/2 text-center">
                <h1 className="font-bold text-lg">{settings.companyName}</h1>
                <p>{settings.companyAddress1}</p>
                <p>{settings.companyAddress2}</p>
            </div>
            <div className="w-1/4 text-right">
                <div className="w-24 h-12 bg-gray-200 flex items-center justify-center text-gray-500 text-xs ml-auto">Bank Logo</div>
            </div>
        </div>

        {/* Bank Details & Date */}
        <div className="flex justify-between items-start mb-4">
            <div>
                <table className="text-left">
                    <tbody>
                        <tr><td className="font-bold pr-4">BANK NAME</td><td>: {settings.bankName}</td></tr>
                        <tr><td className="font-bold pr-4">IFSC CODE</td><td>: {settings.ifscCode}</td></tr>
                        <tr><td className="font-bold pr-4">BRANCH NAME</td><td>: {settings.branchName}</td></tr>
                        <tr><td className="font-bold pr-4">A/C NO.</td><td>: {settings.accountNo}</td></tr>
                        <tr><td className="font-bold pr-4">CONTACT NO.</td><td>: {settings.contactNo}</td></tr>
                        <tr><td className="font-bold pr-4">GMAIL</td><td>: {settings.gmail}</td></tr>
                    </tbody>
                </table>
            </div>
            <div className="text-right">
                <table>
                    <tbody>
                        <tr><td className="font-bold pr-4">DATE</td><td>: {format(new Date(payment.date), "dd MMMM yyyy")}</td></tr>
                        <tr><td className="font-bold pr-4">CHECK NO.</td><td>: {payment.checkNo}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        {/* Information Table */}
        <div className="mb-4">
            <h2 className="text-center font-bold mb-1">INFORMATION</h2>
            <table className="w-full border-collapse border border-black">
                <thead>
                    <tr className="bg-orange-200 print-bg-orange">
                        <th className="border border-black p-1">SR.NO.</th>
                        <th className="border border-black p-1">NAME</th>
                        <th className="border border-black p-1">A/C NO.</th>
                        <th className="border border-black p-1">IFSC CODE</th>
                        <th className="border border-black p-1">AMOUNT</th>
                        <th className="border border-black p-1">BRANCH</th>
                        <th className="border border-black p-1">BANK</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-black p-1 text-center">1</td>
                        <td className="border border-black p-1">{toTitleCase(payment.supplierName || '')}</td>
                        <td className="border border-black p-1">{payment.acNo}</td>
                        <td className="border border-black p-1">{payment.ifscCode}</td>
                        <td className="border border-black p-1 text-right">{formatCurrency(payment.amount)}</td>
                        <td className="border border-black p-1">{toTitleCase(payment.branch || '')}</td>
                        <td className="border border-black p-1">{payment.bank}</td>
                    </tr>
                    {/* Fill empty rows */}
                    {Array.from({ length: 14 }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                            <td className="border border-black p-2 h-7">-</td>
                            <td className="border border-black">-</td>
                            <td className="border border-black">-</td>
                            <td className="border border-black">-</td>
                            <td className="border border-black">-</td>
                            <td className="border border-black">-</td>
                            <td className="border border-black">-</td>
                        </tr>
                    ))}
                </tbody>
                    <tfoot>
                    <tr>
                        <td colSpan={4} className="text-right font-bold pr-2">TOTAL</td>
                        <td className="border border-black p-1 text-right font-bold">{formatCurrency(payment.amount)}</td>
                        <td colSpan={2}></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-end mt-16">
            <div className="text-center">
                <p className="border-t border-black pt-1">(Sign. Of Clerk/Cashier/Teller)</p>
            </div>
            <div className="text-center">
                    <p className="border-t border-black pt-1">(Firm signature)</p>
            </div>
        </div>
    </div>
);


export default function RtgsReportClient() {
    const [reportRows, setReportRows] = useState<RtgsReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings>(initialSettings);
    const [isEditing, setIsEditing] = useState(false);
    const [tempSettings, setTempSettings] = useState<RtgsSettings>(initialSettings);
    const { toast } = useToast();
    const tableRef = useRef<HTMLTableElement>(null);
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

    // State for search filters
    const [searchSrNo, setSearchSrNo] = useState('');
    const [searchCheckNo, setSearchCheckNo] = useState('');
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

        const q = query(
            collection(db, "payments"),
            where("receiptType", "==", "RTGS")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
            
             const newReportRows: RtgsReportRow[] = payments.map(p => {
                return {
                    paymentId: p.paymentId,
                    date: p.date,
                    checkNo: p.checkNo || p.utrNo || '',
                    type: p.type,
                    srNo: p.paymentId || '',
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
            toast({ title: "Success", description: "Details saved successfully." });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ title: "Error", description: "Failed to save details.", variant: "destructive" });
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
    }, [reportRows, searchSrNo, searchCheckNo, startDate, endDate]);
    
    const handlePrint = (contentId: string) => {
        const node = document.getElementById(contentId);
        if (!node) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not open print window. Please disable pop-up blockers.' });
            return;
        }

        const title = contentId === 'table-print-content' ? 'RTGS Report' : 'RTGS Receipts';
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @media print {
                            @page { 
                                size: ${contentId === 'table-print-content' ? 'landscape' : 'A4'}; 
                                margin: 20px; 
                            }
                            body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            table { width: 100%; border-collapse: collapse; font-size: 10px; }
                            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
                            th { background-color: #f2f2f2 !important; }
                            h2 { text-align: center; }
                            .page-break-after { page-break-after: always; }
                            .print-bg-orange { background-color: #fed7aa !important; }
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
        
        printWindow.document.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 250);
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                            <Label htmlFor="searchCheckNo">Search Check/UTR No.</Label>
                            <Input
                                id="searchCheckNo"
                                value={searchCheckNo}
                                onChange={(e) => setSearchCheckNo(e.target.value)}
                                placeholder="Enter Check/UTR No."
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
                            <div id="table-print-content" className="hidden">
                                <Table ref={tableRef}>
                                     <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>SR No.</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Father's Name</TableHead>
                                            <TableHead>Mobile No.</TableHead>
                                            <TableHead>A/C No.</TableHead>
                                            <TableHead>IFSC Code</TableHead>
                                            <TableHead>Bank</TableHead>
                                            <TableHead>Branch</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Check/UTR No.</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Rate</TableHead>
                                            <TableHead>Weight</TableHead>
                                            <TableHead>6R No.</TableHead>
                                            <TableHead>6R Date</TableHead>
                                            <TableHead>Parchi No.</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredReportRows.map((row, index) => (
                                            <TableRow key={`${row.paymentId}-${row.srNo}-${index}`}>
                                                <TableCell>{format(new Date(row.date), 'dd-MMM-yy')}</TableCell>
                                                <TableCell>{row.srNo}</TableCell>
                                                <TableCell>{row.supplierName}</TableCell>
                                                <TableCell>{row.fatherName}</TableCell>
                                                <TableCell>{row.contact}</TableCell>
                                                <TableCell>{row.acNo}</TableCell>
                                                <TableCell>{row.ifscCode}</TableCell>
                                                <TableCell>{row.bank}</TableCell>
                                                <TableCell>{row.branch}</TableCell>
                                                <TableCell>{formatCurrency(row.amount)}</TableCell>
                                                <TableCell>{row.checkNo}</TableCell>
                                                <TableCell>{row.type}</TableCell>
                                                <TableCell>{row.rate.toFixed(2)}</TableCell>
                                                <TableCell>{row.weight.toFixed(2)}</TableCell>
                                                <TableCell>{row.sixRNo}</TableCell>
                                                <TableCell>{row.sixRDate ? format(new Date(row.sixRDate), 'dd-MMM-yy') : ''}</TableCell>
                                                <TableCell>{row.parchiNo}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <Button onClick={() => handlePrint('table-print-content')} size="sm" variant="outline">
                                <Printer className="mr-2 h-4 w-4" /> Print Table
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
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
                                    <TableHead className="w-[150px]">Check/UTR No.</TableHead>
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
                <DialogContent className="max-w-4xl p-0">
                    <DialogHeader className="p-4 pb-2">
                        <DialogTitle>RTGS Print Preview</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh]">
                        <div id="rtgs-print-content">
                            {filteredReportRows.map((row, index) => (
                                <RtgsPrintFormat key={index} payment={row} settings={settings} />
                            ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-4 pt-2">
                        <Button variant="outline" onClick={() => setIsPrintPreviewOpen(false)}>Close</Button>
                        <Button onClick={() => handlePrint('rtgs-print-content')}><Printer className="mr-2 h-4 w-4"/>Print</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
