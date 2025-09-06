
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Assuming firebase.ts exports 'db'
import type { Employee, PayrollEntry } from "@/lib/definitions"; // Adjust based on your definitions
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Loader2, Pencil, Trash2, PlusCircle, Banknote } from "lucide-react";

export default function PayrollManagementPage() {
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<Partial<PayrollEntry>>({});
  
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
  }, [loading]);

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
    setCurrentEntry({});
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
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentEntry.id ? 'Edit' : 'Add'} Payroll Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employeeId" className="text-right">Employee</Label>
              <select id="employeeId" value={currentEntry.employeeId || ""} onChange={(e) => setCurrentEntry({ ...currentEntry, employeeId: e.target.value })} className="col-span-3 p-2 border rounded-md">
                <option value="">Select Employee</option>
                {employees.map(e => <option key={e.id} value={e.employeeId}>{e.name} ({e.employeeId})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payPeriod" className="text-right">Pay Period</Label>
              <Input id="payPeriod" value={currentEntry.payPeriod || ""} onChange={(e) => setCurrentEntry({ ...currentEntry, payPeriod: e.target.value })} className="col-span-3" placeholder="e.g., July 2024" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Amount</Label>
              <Input id="amount" type="number" value={currentEntry.amount || ""} onChange={(e) => setCurrentEntry({ ...currentEntry, amount: parseFloat(e.target.value) })} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEntry}>Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
