
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
                 <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Company & Bank Details</CardTitle>
                        <CardDescription>This information will be used for RTGS receipts.</CardDescription>
                    </div>
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
                <CardContent>
                    {isEditing ? (
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
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {/* Company Details */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-base flex items-center gap-2"><Building className="h-5 w-5 text-primary" /> Company Details</h3>
                                <DetailItem label="Company Name" value={settings.companyName} />
                                <DetailItem label="Address" value={`${settings.companyAddress1}, ${settings.companyAddress2}`} />
                                <DetailItem label="Contact No." value={settings.contactNo} />
                                <DetailItem label="Email" value={settings.gmail} />
                            </div>

                            {/* Bank Details */}
                            <div className="space-y-3">
                                 <h3 className="font-semibold text-base flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Bank Details</h3>
                                <DetailItem label="Bank Name" value={settings.bankName} />
                                <DetailItem label="Branch Name" value={settings.branchName} />
                                <DetailItem label="Account No." value={settings.accountNo} />
                                <DetailItem label="IFSC Code" value={settings.ifscCode} />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>RTGS Payment Report</CardTitle>
                    <CardDescription>A detailed report of all payments made via RTGS.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[70vh]">
                    <Table>
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
                                <TableHead>GR No.</TableHead>
                                <TableHead>GR Date</TableHead>
                                <TableHead>Parchi No.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportRows.map((row, index) => (
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
                                    <TableCell>{row.grNo}</TableCell>
                                    <TableCell>{row.grDate ? format(new Date(row.grDate), 'dd-MMM-yy') : ''}</TableCell>
                                    <TableCell>{row.parchiNo}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}

    