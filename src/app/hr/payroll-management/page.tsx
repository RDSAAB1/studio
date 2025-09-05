
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Assuming firebase.ts exports 'db'
import type { Employee, PayrollEntry } from "@/lib/definitions"; // Adjust based on your definitions
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Loader2, Pencil, Trash2, PlusCircle } from "lucide-react";

export default function PayrollManagementPage() {
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]); // Assuming you might need employee data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<PayrollEntry | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEntryData, setNewEntryData] = useState<Partial<PayrollEntry>>({});

  useEffect(() => {
    const q = query(collection(db, "payroll"));
    const unsubscribePayroll = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PayrollEntry[];
      setPayrollEntries(entries);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching payroll data:", err);
      setError("Failed to load payroll data.");
      setLoading(false);
    });

    // Optional: Fetch employees if needed for linking payroll
    // const qEmployees = query(collection(db, "employees"));
    // const unsubscribeEmployees = onSnapshot(qEmployees, (snapshot) => {
    //   const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
    //   setEmployees(employees);
    // }, (err) => {
    //   console.error("Error fetching employee data:", err);
    // });

    return () => {
      unsubscribePayroll();
      // unsubscribeEmployees(); // Cleanup listener if used
    };
  }, []);

  const handleAddEntry = async () => {
    if (!newEntryData.employeeId || !newEntryData.payPeriod || newEntryData.amount === undefined) {
      alert("Please fill required fields.");
      return;
    }
    try {
      await addDoc(collection(db, "payroll"), {
        ...newEntryData,
        amount: Number(newEntryData.amount), // Ensure amount is a number
        createdAt: new Date(), // Optional: add timestamp
      });
      setNewEntryData({});
      setIsAddDialogOpen(false);
    } catch (e) {
      console.error("Error adding payroll entry: ", e);
      setError("Failed to add payroll entry.");
    }
  };

  const handleEditEntry = (entry: PayrollEntry) => {
    setCurrentEntry(entry);
    setIsEditDialogOpen(true);
  };

  const handleUpdateEntry = async () => {
    if (!currentEntry) return;
    try {
      const entryRef = doc(db, "payroll", currentEntry.id);
      await updateDoc(entryRef, {
        ...currentEntry,
        amount: Number(currentEntry.amount), // Ensure amount is a number
        updatedAt: new Date(), // Optional: add timestamp
      });
      setIsEditDialogOpen(false);
      setCurrentEntry(null);
    } catch (e) {
      console.error("Error updating payroll entry: ", e);
      setError("Failed to update payroll entry.");
    }
  };

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
          <CardTitle className="text-2xl font-bold">Payroll Management</CardTitle>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Payroll Entry
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Pay Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.employeeId}</TableCell>
                  <TableCell>{entry.payPeriod}</TableCell>
                  <TableCell>₹{entry.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="mr-2" onClick={() => handleEditEntry(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Payroll Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newEmployeeId" className="text-right">
                Employee ID
              </Label>
              <Input
                id="newEmployeeId"
                value={newEntryData.employeeId || ""}
                onChange={(e) => setNewEntryData({ ...newEntryData, employeeId: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newPayPeriod" className="text-right">
                Pay Period
              </Label>
              <Input
                id="newPayPeriod"
                value={newEntryData.payPeriod || ""}
                onChange={(e) => setNewEntryData({ ...newEntryData, payPeriod: e.target.value })}
                className="col-span-3"
              />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newAmount" className="text-right">
                Amount
              </Label>
              <Input
                id="newAmount"
                type="number"
                value={newEntryData.amount || ""}
                onChange={(e) => setNewEntryData({ ...newEntryData, amount: parseFloat(e.target.value) })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddEntry}>Add Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payroll Entry</DialogTitle>
          </DialogHeader>
          {currentEntry && (
             <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editEmployeeId" className="text-right">
                  Employee ID
                </Label>
                <Input
                  id="editEmployeeId"
                  value={currentEntry.employeeId || ""}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, employeeId: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editPayPeriod" className="text-right">
                  Pay Period
                </Label>
                <Input
                  id="editPayPeriod"
                  value={currentEntry.payPeriod || ""}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, payPeriod: e.target.value })}
                  className="col-span-3"
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editAmount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="editAmount"
                  type="number"
                  value={currentEntry.amount || ""}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, amount: parseFloat(e.target.value) })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateEntry}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
