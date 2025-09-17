
"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, onSnapshot, doc, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Employee, AttendanceEntry } from "@/lib/definitions";
import { getAttendanceForDateRealtime, setAttendance } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon, CheckCircle, XCircle, FileText, UserCheck, UserX, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const StatCard = ({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) => (
    <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default function AttendanceTrackingPage() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<Map<string, AttendanceEntry>>(new Map());
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const q = query(collection(db, "employees"));
        const unsubscribeEmployees = onSnapshot(q, (snapshot) => {
            const employeesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setEmployees(employeesData);
        }, (error) => {
            console.error("Error fetching employees: ", error);
            toast({ title: "Failed to load employees", variant: "destructive" });
        });

        return () => unsubscribeEmployees();
    }, [toast]);

    useEffect(() => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const unsubscribeAttendance = getAttendanceForDateRealtime(dateStr, (records) => {
            const recordsMap = new Map(records.map(r => [r.employeeId, r]));
            setAttendanceRecords(recordsMap);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching attendance: ", error);
            toast({ title: "Failed to load attendance records", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribeAttendance();
    }, [selectedDate, toast]);
    
    const handleStatusChange = async (employeeId: string, status: 'Present' | 'Absent' | 'Leave' | 'Half-day') => {
        try {
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            const entry: AttendanceEntry = {
                id: `${dateStr}-${employeeId}`,
                date: dateStr,
                employeeId,
                status,
            };
            await setAttendance(entry);
        } catch (error) {
            console.error("Failed to update attendance:", error);
            toast({ title: "Update failed", variant: "destructive" });
        }
    };

    const summary = {
        present: Array.from(attendanceRecords.values()).filter(r => r.status === 'Present').length,
        absent: Array.from(attendanceRecords.values()).filter(r => r.status === 'Absent').length,
        leave: Array.from(attendanceRecords.values()).filter(r => r.status === 'Leave' || r.status === 'Half-day').length,
        total: employees.length
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-semibold">Attendance Tracking</CardTitle>
                    <CardDescription>Select a date to view and manage employee attendance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Employees" value={summary.total} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="Present" value={summary.present} icon={<UserCheck className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="Absent" value={summary.absent} icon={<UserX className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="On Leave" value={summary.leave} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees.length === 0 ? (
                                    <TableRow><TableCell colSpan={2} className="h-24 text-center">Loading employees...</TableCell></TableRow>
                                ) : (
                                    employees.map((employee) => {
                                        const currentStatus = attendanceRecords.get(employee.employeeId)?.status;
                                        return (
                                            <TableRow key={employee.id}>
                                                <TableCell>
                                                    <div className="font-medium">{employee.name}</div>
                                                    <div className="text-sm text-muted-foreground">{employee.position}</div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <Button size="sm" variant={currentStatus === 'Present' ? 'default' : 'outline'} onClick={() => handleStatusChange(employee.employeeId, 'Present')}>Present</Button>
                                                        <Button size="sm" variant={currentStatus === 'Absent' ? 'destructive' : 'outline'} onClick={() => handleStatusChange(employee.employeeId, 'Absent')}>Absent</Button>
                                                        <Button size="sm" variant={currentStatus === 'Leave' ? 'secondary' : 'outline'} onClick={() => handleStatusChange(employee.employeeId, 'Leave')}>Leave</Button>
                                                        <Button size="sm" variant={currentStatus === 'Half-day' ? 'secondary' : 'outline'} onClick={() => handleStatusChange(employee.employeeId, 'Half-day')}>Half-day</Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
