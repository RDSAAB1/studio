
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { Customer } from '@/lib/definitions';
import { format, isSameDay } from 'date-fns';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CalendarClock, CircleDollarSign, Users, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const StatCard = ({ title, value, icon, colorClass }: { title: string, value: string | number, icon: React.ReactNode, colorClass?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
        </CardContent>
    </Card>
);

export default function DailyPaymentsPage() {
    const router = useRouter();
    const suppliers = useLiveQuery(() => db.mainDataStore.where('collection').equals('suppliers').toArray(), []) || [];
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const dueTodaySuppliers = useMemo(() => {
        if (!suppliers) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return suppliers.filter(s => {
            const netAmount = parseFloat(String(s.netAmount));
            if (isNaN(netAmount) || netAmount < 1) {
                return false;
            }
            const dueDate = new Date(s.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate <= today;
        }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [suppliers]);

    const summary = useMemo(() => {
        const totalPayable = dueTodaySuppliers.reduce((sum, s) => sum + (parseFloat(String(s.netAmount)) || 0), 0);
        return {
            totalPayable: formatCurrency(totalPayable),
            totalSuppliers: dueTodaySuppliers.length,
        };
    }, [dueTodaySuppliers]);

    const handleGoToPayments = (supplier: Customer) => {
        const customerId = supplier.customerId;
        router.push(`/sales/supplier-payments?customerId=${encodeURIComponent(customerId)}`);
    }

    if (!isClient) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <CalendarClock className="h-6 w-6 text-primary" />
                        <div>
                            <CardTitle>Today's Supplier Payments</CardTitle>
                            <CardDescription>Suppliers with payments due today or earlier.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <StatCard title="Total Payable Amount" value={summary.totalPayable} icon={<CircleDollarSign className="text-muted-foreground" />} colorClass="text-destructive" />
                <StatCard title="Suppliers to Pay" value={summary.totalSuppliers} icon={<Users className="text-muted-foreground" />} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Due Payments List</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Due Date</TableHead>
                                    <TableHead>Supplier Name</TableHead>
                                    <TableHead>SR No.</TableHead>
                                    <TableHead>Variety</TableHead>
                                    <TableHead className="text-right">Outstanding Amount</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dueTodaySuppliers.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No payments due today.</TableCell></TableRow>
                                ) : (
                                    dueTodaySuppliers.map(supplier => (
                                        <TableRow key={supplier.id}>
                                            <TableCell className="font-medium">{format(new Date(supplier.dueDate), 'dd-MMM-yyyy')}</TableCell>
                                            <TableCell>{toTitleCase(supplier.name)}</TableCell>
                                            <TableCell className="font-mono text-xs">{supplier.srNo}</TableCell>
                                            <TableCell>{toTitleCase(supplier.variety)}</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(parseFloat(String(supplier.netAmount)))}</TableCell>
                                            <TableCell className="text-center">
                                                <Button size="sm" onClick={() => handleGoToPayments(supplier)}>
                                                    Go to Payments
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
