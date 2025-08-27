
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Payment, RtgsSettings } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Loader2, Edit, Save, X, Building, Landmark } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getRtgsSettings, updateRtgsSettings } from '@/lib/firestore';
import { Separator } from '@/components/ui/separator';

interface RtgsReportRow {
    paymentId: string;
    date: string;
    checkNo: string;
    type: string;
    srNo: string; // Now mapping to p.paymentId
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

const DetailItem = ({ label, value }: { label: string; value: string; }) => (
    <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
    </div>
);

export default function RtgsReportClient() {
    const [reportRows, setReportRows] = useState<RtgsReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings>(initialSettings);
    const [isEditing, setIsEditing] = useState(false);
    const [tempSettings, setTempSettings] = useState<RtgsSettings>(initialSettings);
    const { toast } = useToast();

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
                const totalPaidForAmount = p.paidFor?.reduce((sum, pf) => sum + pf.amount, 0) || 0;
                
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
                    amount: p.rtgsAmount || p.amount || totalPaidForAmount,
                    rate: p.rate || 0,
                    weight: p.quantity || 0,
                    sixRNo: p.sixRNo || '',
                    sixRDate: p.sixRDate || '',
                    parchiNo: p.parchiNo || (p.paidFor?.map(pf => pf.srNo).join(', ') || ''),
                };
            });

            // Initial sort before any filtering
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
            // Cancel editing
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

    // Filter report rows based on search criteria
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
            end.setHours(23, 59, 59, 999); // Include whole end day
            filtered = filtered.filter(row => {
                const rowDate = new Date(row.date);
                return rowDate >= start && rowDate <= end;
            });
        } else if (startDate) { // If only start date is provided, filter from that date onwards
            const start = new Date(startDate);
            filtered = filtered.filter(row => {
                const rowDate = new Date(row.date);
                return rowDate >= start;
            });
        } else if (endDate) { // If only end date is provided, filter up to that date
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(row => {
                const rowDate = new Date(row.date);
                return rowDate <= end;
            });
        }

        // Always sort by date (descending) after all filters
        return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reportRows, searchSrNo, searchCheckNo, startDate, endDate]);

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
                    <CardTitle>Filter RTGS Reports</CardTitle> {/* New CardTitle for filter section */}
                    <CardDescription>Use the fields below to search and filter payments.</CardDescription> {/* New CardDescription */}
                </CardHeader>
                <CardContent>
                    {/* Filter Inputs moved here */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"> {/* Removed mb-6 */}
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
            </Card> {/* End of new filter Card */}

            <Card>
                <CardHeader>
                    <CardTitle>RTGS Payment Report</CardTitle>
                    <CardDescription>A detailed report of all payments made via RTGS.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <Table className="min-w-[1200px]">
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead className="w-[80px]">SR No.</TableHead>
                                    <TableHead className className="w-[150px]">Name</TableHead>
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
        </div>
    );
}
