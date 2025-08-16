
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Payment } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export default function RtgsReportClient() {
    const [reportRows, setReportRows] = useState<RtgsReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);

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
                            checkNo: p.utrNo || p.checkNo || '',
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

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> Loading RTGS Reports...</div>;
    }
    
    return (
        <div className="space-y-6">
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
                                    <TableCell>{row.grDate}</TableCell>
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
