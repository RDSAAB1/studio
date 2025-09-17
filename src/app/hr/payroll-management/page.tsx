
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import type { Employee, PayrollEntry, AttendanceEntry } from "@/lib/definitions"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";
import { Loader2, Pencil, Trash2, PlusCircle, Banknote, Calendar as CalendarIcon, Calculator, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type AttendanceSummary = {
    present: number;
    absent: number;
    leave: number;
    halfDay: number;
    totalDays: number;
    payableDays: number;
};

export default function PayrollManagementPage() {
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<Partial<PayrollEntry>>({});
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  
  useEffect(() => {
    const qPayroll = query(collection(db, "payroll"));
    const unsubscribePayroll = onSnapshot(qPayroll, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PayrollEntry[];
      setPayrollEntries(entries);
      if(loading) setLoading(false);
    }, (err) => {
      console.error("Error fetching payroll data:", err);
      setError("Failed to load payroll data.");
      setLoading(false);
    });

    const qEmployees = query(collection(db, "employees"));
    const unsubscribeEmployees = onSnapshot(qEmployees, (snapshot) => {
      const employeesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
      setEmployees(employeesData);
    }, (err) => {
      console.error("Error fetching employee data:", err);
    });

    return () => {
      unsubscribePayroll();
      unsubscribeEmployees();
    };
  }, []);

  const calculateSalary = async () => {
    if (!currentEntry.employeeId || !currentEntry.payPeriod) {
        setAttendanceSummary(null);
        return;
    }

    const employee = employees.find(e => e.employeeId === currentEntry.employeeId);
    if (!employee || !employee.baseSalary) {
        alert("Employee not found or base salary not set.");
        return;
    }

    const year = parseInt(currentEntry.payPeriod.split('-')[0]);
    const month = parseInt(currentEntry.payPeriod.split('-')[1]) - 1;
    const periodDate = new Date(year, month);
    
    const startDate = format(startOfMonth(periodDate), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(periodDate), 'yyyy-MM-dd');
    const daysInMonth = getDaysInMonth(periodDate);
    const perDaySalary = employee.baseSalary / daysInMonth;

    const qAttendance = query(collection(db, 'attendance'), 
        where('employeeId', '==', employee.employeeId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );
    
    try {
        const attendanceSnapshot = await getDocs(qAttendance);
        const records = attendanceSnapshot.docs.map(doc => doc.data() as AttendanceEntry);
        
        let present = 0;
        let absent = 0;
        let leave = 0;
        let halfDay = 0;

        records.forEach(r => {
            if(r.status === 'Present') present++;
            else if(r.status === 'Absent') absent++;
            else if(r.status === 'Leave') leave++;
            else if(r.status === 'Half-day') halfDay++;
        });

        const allowedLeaves = employee.monthlyLeaveAllowance || 0;
        const unpaidLeaves = Math.max(0, leave - allowedLeaves);
        const payableLeaves = leave - unpaidLeaves;
        
        const payableDays = present + payableLeaves + (halfDay * 0.5);
        const payableSalary = payableDays * perDaySalary;

        setAttendanceSummary({ present, absent, leave, halfDay, totalDays: daysInMonth, payableDays });
        setCurrentEntry(prev => ({...prev, amount: Math.round(payableSalary)}));
    } catch(err) {
        console.error("Error calculating salary:", err);
        setError("Failed to calculate salary due to a database error.");
    }
  };

  const handleSaveEntry = async () => {
    if (!currentEntry.employeeId || !currentEntry.payPeriod || currentEntry.amount === undefined) {
      alert("Please fill required fields.");
      return;
    }

    try {
        const entryData = {
            ...currentEntry,
            amount: Number(currentEntry.amount),
        };
        if(currentEntry.id) {
            const entryRef = doc(db, "payroll", currentEntry.id);
            await updateDoc(entryRef, { ...entryData, updatedAt: new Date() });
        } else {
             await addDoc(collection(db, "payroll"), { ...entryData, createdAt: new Date() });
        }
      
      setIsEditDialogOpen(false);
      setCurrentEntry({});
      setAttendanceSummary(null);
    } catch (e) {
      console.error("Error saving payroll entry: ", e);
      setError("Failed to save payroll entry.");
    }
  };

  const handleEditEntry = (entry: PayrollEntry) => {
    setCurrentEntry(entry);
    setIsEditDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setCurrentEntry({ payPeriod: format(new Date(), 'yyyy-MM') });
    setAttendanceSummary(null);
    setIsEditDialogOpen(true);
  }

  const handleDeleteEntry = async (id: string) => {
    if (confirm("Are you sure you want to delete this payroll entry?")) {
      try {
        await deleteDoc(doc(db, "payroll", id));
      } catch (e) {
        console.error("Error deleting payroll entry: ", e);
        setError("Failed to delete payroll entry.");
      }
    }
  };
  
  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.employeeId === employeeId);
    return employee ? employee.name : 'Unknown';
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
                 <CardTitle className="text-xl font-semibold flex items-center gap-2"><Banknote className="h-5 w-5"/>Payroll Management</CardTitle>
                 <CardDescription>Manage salary and payment records for your employees.</CardDescription>
            </div>
          <Button size="sm" onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Payroll Entry
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Pay Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{getEmployeeName(entry.employeeId)} ({entry.employeeId})</TableCell>
                  <TableCell>{entry.payPeriod}</TableCell>
                  <TableCell>₹{entry.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="mr-2" onClick={() => handleEditEntry(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => entry.id && handleDeleteEntry(entry.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentEntry.id ? 'Edit' : 'Add'} Payroll Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employeeId" className="text-right">Employee</Label>
              <Select value={currentEntry.employeeId || ""} onValueChange={(value) => setCurrentEntry({ ...currentEntry, employeeId: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.employeeId}>{e.name} ({e.employeeId})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="payPeriod" className="text-right">Pay Period</Label>
                <Input 
                    id="payPeriod"
                    type="month"
                    value={currentEntry.payPeriod || ''}
                    onChange={(e) => setCurrentEntry({ ...currentEntry, payPeriod: e.target.value })}
                    className="col-span-3"
                />
            </div>
            {attendanceSummary && (
                <Card className="col-span-4 bg-muted/50">
                    <CardHeader className="p-3">
                        <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Attendance Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 text-xs grid grid-cols-2 gap-2">
                        <p>Total Days: {attendanceSummary.totalDays}</p>
                        <p>Present: {attendanceSummary.present}</p>
                        <p>Absent: {attendanceSummary.absent}</p>
                        <p>Leave: {attendanceSummary.leave}</p>
                        <p>Half-day: {attendanceSummary.halfDay}</p>
                        <p className="font-bold">Payable Days: {attendanceSummary.payableDays.toFixed(2)}</p>
                    </CardContent>
                </Card>
            )}
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Payable Salary</Label>
               <div className="col-span-3 flex items-center gap-2">
                <Input id="amount" type="number" value={currentEntry.amount || ""} onChange={(e) => setCurrentEntry({ ...currentEntry, amount: parseFloat(e.target.value) })} />
                <Button variant="secondary" size="icon" onClick={calculateSalary}><Calculator className="h-4 w-4"/></Button>
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setAttendanceSummary(null); }}>Cancel</Button>
            <Button onClick={handleSaveEntry}>Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
