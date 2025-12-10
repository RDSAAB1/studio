
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useGlobalData } from '@/contexts/global-data-context';
import { Customer, Payment } from '@/lib/definitions';
import { format, isSameDay } from 'date-fns';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CalendarClock, CircleDollarSign, Users, Loader2, Calendar as CalendarIcon, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


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
    // Use global data store - NO duplicate listeners
    const globalData = useGlobalData();
    const suppliers = globalData.suppliers;
    const payments = globalData.paymentHistory;
    const [isClient, setIsClient] = useState(false);
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    useEffect(() => {
        setIsClient(true);
        // Use global data store - NO duplicate listeners
    }, []);

    const filteredData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = startDate ? new Date(startDate.setHours(0,0,0,0)) : null;
        const end = endDate ? new Date(endDate.setHours(23,59,59,999)) : null;

        const dueSuppliers = suppliers.filter(s => {
            const netAmount = parseFloat(String(s.netAmount));
            if (isNaN(netAmount) || netAmount < 1) return false;
            
            const dueDate = new Date(s.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            if (start && end) return dueDate >= start && dueDate <= end;
            if (start) return dueDate >= start;
            if (end) return dueDate <= end;
            
            return dueDate <= today; // Default behavior
        }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        const paidInPeriod = payments.filter(p => {
             const paymentDate = new Date(p.date);
             if (start && end) return paymentDate >= start && paymentDate <= end;
             if (start) return paymentDate >= start;
             if (end) return paymentDate <= end;
             return isSameDay(paymentDate, today); // Default to today
        });

        return { dueSuppliers, paidInPeriod };

    }, [suppliers, payments, startDate, endDate]);

    const summary = useMemo(() => {
        const totalPayable = filteredData.dueSuppliers.reduce((sum, s) => sum + (parseFloat(String(s.netAmount)) || 0), 0);
        const totalPaid = filteredData.paidInPeriod.reduce((sum, p) => sum + p.amount, 0);
        return {
            totalPayable: formatCurrency(totalPayable),
            totalDueSuppliers: filteredData.dueSuppliers.length,
            totalPaid: formatCurrency(totalPaid),
            totalPaidTransactions: filteredData.paidInPeriod.length,
        };
    }, [filteredData]);

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
                            <CardTitle>Payment Schedule & History</CardTitle>
                            <CardDescription>Filter payments by date to see what's due and what's been paid.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : <span>Start Date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : <span>End Date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} /></PopoverContent>
                    </Popover>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Payable Amount" value={summary.totalPayable} icon={<CircleDollarSign className="text-muted-foreground" />} colorClass="text-destructive" />
                <StatCard title="Suppliers to Pay" value={summary.totalDueSuppliers} icon={<Users className="text-muted-foreground" />} />
                <StatCard title="Total Amount Paid" value={summary.totalPaid} icon={<CheckCircle className="text-muted-foreground" />} colorClass="text-green-500" />
                <StatCard title="Paid Transactions" value={summary.totalPaidTransactions} icon={<Users className="text-muted-foreground" />} />
            </div>

            <Tabs defaultValue="due">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="due">Due Payments</TabsTrigger>
                    <TabsTrigger value="paid">Paid History</TabsTrigger>
                </TabsList>
                <TabsContent value="due" className="mt-4">
                     <Card>
                        <CardHeader><CardTitle className="text-lg">Due Payments List</CardTitle></CardHeader>
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
                                        {filteredData.dueSuppliers.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="h-24 text-center">No payments due for the selected period.</TableCell></TableRow>
                                        ) : (
                                            filteredData.dueSuppliers.map(supplier => (
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
                </TabsContent>
                <TabsContent value="paid" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Paid Payments History</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Payment Date</TableHead>
                                            <TableHead>Payment ID</TableHead>
                                            <TableHead>Supplier Name</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead className="text-right">Amount Paid</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredData.paidInPeriod.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center">No payments found for the selected period.</TableCell></TableRow>
                                        ) : (
                                            filteredData.paidInPeriod.map(payment => (
                                                <TableRow key={payment.id}>
                                                    <TableCell className="font-medium">{format(new Date(payment.date), 'dd-MMM-yyyy')}</TableCell>
                                                    <TableCell className="font-mono text-xs">{payment.paymentId}</TableCell>
                                                    <TableCell>{toTitleCase(payment.supplierName || 'N/A')}</TableCell>
                                                    <TableCell>{payment.receiptType}</TableCell>
                                                    <TableCell className="text-right font-semibold">{formatCurrency(payment.amount)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
