
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming you have an initialized Firestore instance exported as 'db'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from 'lucide-react';

interface Employee {
  id?: string;
  name: string;
  employeeId: string;
  position: string;
  contact: string;
  // Add other employee fields as needed
}

export default function EmployeeDatabasePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    name: '',
    employeeId: '',
    position: '',
    contact: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, "employees"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const employeesData: Employee[] = [];
      snapshot.forEach((doc) => {
        employeesData.push({ id: doc.id, ...doc.data() as Omit<Employee, 'id'> });
      });
      setEmployees(employeesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching employees: ", error);
      toast({
        title: "Failed to load employee data",
        variant: "destructive",
      });
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup the listener on component unmount
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddEmployee = async () => {
    try {
      await addDoc(collection(db, "employees"), formData);
      toast({
        title: "Employee added successfully",
        variant: "success",
      });
      setIsDialogOpen(false);
      setFormData({ name: '', employeeId: '', position: '', contact: '' });
    } catch (error) {
      console.error("Error adding employee: ", error);
      toast({
        title: "Failed to add employee",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEmployee = async () => {
    if (!currentEmployee?.id) return;
    try {
      const employeeRef = doc(db, "employees", currentEmployee.id);
      await updateDoc(employeeRef, formData);
      toast({
        title: "Employee updated successfully",
        variant: "success",
      });
      setIsDialogOpen(false);
      setCurrentEmployee(null);
      setFormData({ name: '', employeeId: '', position: '', contact: '' });
    } catch (error) {
      console.error("Error updating employee: ", error);
      toast({
        title: "Failed to update employee",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await deleteDoc(doc(db, "employees", id));
      toast({
        title: "Employee deleted successfully",
        variant: "success",
      });
    } catch (error) {
      console.error("Error deleting employee: ", error);
      toast({
        title: "Failed to delete employee",
        variant: "destructive",
      });
    }
  };

  const openDialogForAdd = () => {
    setCurrentEmployee(null);
    setFormData({ name: '', employeeId: '', position: '', contact: '' });
    setIsDialogOpen(true);
  };

  const openDialogForEdit = (employee: Employee) => {
    setCurrentEmployee(employee);
    setFormData({ name: employee.name, employeeId: employee.employeeId, position: employee.position, contact: employee.contact });
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Employee Database</h2>
        <Button onClick={openDialogForAdd}>Add New Employee</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell>{employee.employeeId}</TableCell>
              <TableCell>{employee.name}</TableCell>
              <TableCell>{employee.position}</TableCell>
              <TableCell>{employee.contact}</TableCell>
              <TableCell>
                <Button variant="outline" size="sm" className="mr-2" onClick={() => openDialogForEdit(employee)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => employee.id && handleDeleteEmployee(employee.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employeeId" className="text-right">Employee ID</Label>
              <Input id="employeeId" name="employeeId" value={formData.employeeId} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="position" className="text-right">Position</Label>
              <Input id="position" name="position" value={formData.position} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact" className="text-right">Contact</Label>
              <Input id="contact" name="contact" value={formData.contact} onChange={handleInputChange} className="col-span-3" />
            </div>
            {/* Add other fields here */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={currentEmployee ? handleUpdateEmployee : handleAddEmployee}>
              {currentEmployee ? 'Save Changes' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
