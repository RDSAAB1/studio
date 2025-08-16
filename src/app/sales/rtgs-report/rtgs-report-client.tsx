
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
    grNo: string;
    grDate: string;
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
            
            const newReportRows: RtgsReportRow[] = [];

            payments.forEach(p => {
                if (p.paidFor && p.paidFor.length > 0) {
                    p.paidFor.forEach(pf => {
                        newReportRows.push({
                            paymentId: p.paymentId,
                            date: p.date,
                            checkNo: p.checkNo || p.utrNo || '',
                            type: p.type,
                            srNo: pf.srNo,
                            supplierName: toTitleCase(pf.supplierName || ''),
                            fatherName: toTitleCase(p.supplierFatherName || pf.supplierSo || ''),
                            contact: pf.supplierContact || '',
                            acNo: pf.bankAcNo || '',
                            ifscCode: pf.bankIfsc || '',
                            branch: toTitleCase(pf.bankBranch || ''),
                            bank: pf.bankName || '',
                            amount: pf.amount,
                            rate: p.rate || 0,
                            weight: p.quantity || 0,
                            grNo: p.grNo || '',
                            grDate: p.grDate || '',
                            parchiNo: p.parchiNo || '',
                        });
                    });
                }
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
                    <CardTitle>RTGS Payment Report</CardTitle>
                    <CardDescription>A detailed report of all payments made via RTGS.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <Table className="min-w-[1200px]"> {/* Added min-width for horizontal scrolling */}
                            <TableHeader className="sticky top-0 z-10 bg-background"> {/* Made header sticky */}
                                <TableRow>
                                    <TableHead className="w-[100px]">Date</TableHead> {/* Added width hints */}
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
                                    <TableHead className="w-[100px]">GR No.</TableHead>
                                    <TableHead className="w-[120px]">GR Date</TableHead>
                                    <TableHead className="w-[100px]">Parchi No.</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportRows.map((row, index) => (
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
                                        <TableCell className="whitespace-nowrap">{row.grNo}</TableCell>
                                        <TableCell className="whitespace-nowrap">{row.grDate ? format(new Date(row.grDate), 'dd-MMM-yy') : ''}</TableCell>
                                        <TableCell className="whitespace-nowrap">{row.parchiNo}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    
