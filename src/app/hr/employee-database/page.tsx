
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { Employee } from '@/lib/definitions';
import { toTitleCase } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function EmployeeDatabasePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    name: '',
    employeeId: '',
    position: '',
    contact: '',
    baseSalary: 0,
    monthlyLeaveAllowance: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const q = query(collection(db, "employees"), orderBy("employeeId"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const employeesData: Employee[] = [];
      snapshot.forEach((doc) => {
        employeesData.push({ id: doc.id, ...doc.data() as Omit<Employee, 'id'> });
      });
      setEmployees(employeesData);
    }, (error) => {
      console.error("Error fetching employees: ", error);
      toast({
        title: "Failed to load employee data",
        variant: "destructive",
      });
    });

    return () => unsubscribe();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const isTextField = name === 'name' || name === 'position';
    setFormData(prev => ({ 
        ...prev, 
        [name]: isTextField 
            ? toTitleCase(value) 
            : (name === 'baseSalary' || name === 'monthlyLeaveAllowance' ? Number(value) : value) 
    }));
  };

  const generateNewEmployeeId = () => {
    if (employees.length === 0) {
      return 'EMP001';
    }
    const lastId = employees[employees.length - 1].employeeId;
    const lastNumber = parseInt(lastId.replace('EMP', ''), 10);
    const newNumber = lastNumber + 1;
    return `EMP${String(newNumber).padStart(3, '0')}`;
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.employeeId) {
        toast({ title: "Name and Employee ID are required", variant: "destructive" });
        return;
    }

    try {
        const dataToSave = { ...formData, name: toTitleCase(formData.name) };

        if (currentEmployee) {
            const employeeRef = doc(db, "employees", currentEmployee.id);
            await setDoc(employeeRef, dataToSave, { merge: true });
            toast({ title: "Employee updated successfully", variant: "success" });
        } else {
            const newEmployeeId = formData.employeeId;
            const employeeRef = doc(db, "employees", newEmployeeId);
            await setDoc(employeeRef, dataToSave);
            toast({ title: "Employee added successfully", variant: "success" });
        }
        closeDialog();
    } catch (error) {
        console.error("Error saving employee: ", error);
        toast({ title: `Failed to ${currentEmployee ? 'update' : 'add'} employee`, variant: "destructive" });
    }
  };
  
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            const form = e.currentTarget.querySelector('form');
            if (!form) return;

            const formElements = Array.from(form.elements).filter(el => (el as HTMLElement).offsetParent !== null) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];
            const currentElementIndex = formElements.findIndex(el => el === document.activeElement);

            if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {
                e.preventDefault();
                formElements[currentElementIndex + 1].focus();
            } else if (currentElementIndex === formElements.length - 1) {
                 e.preventDefault();
                 handleSubmit();
            }
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
    const newEmployeeId = generateNewEmployeeId();
    setFormData({ name: '', employeeId: newEmployeeId, position: '', contact: '', baseSalary: 0, monthlyLeaveAllowance: 0 });
    setIsDialogOpen(true);
  };

  const openDialogForEdit = (employee: Employee) => {
    setCurrentEmployee(employee);
    setFormData({ 
        name: employee.name, 
        employeeId: employee.employeeId, 
        position: employee.position, 
        contact: employee.contact,
        baseSalary: employee.baseSalary || 0,
        monthlyLeaveAllowance: employee.monthlyLeaveAllowance || 0
    });
    setIsDialogOpen(true);
  };
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    setCurrentEmployee(null);
    setFormData({ name: '', employeeId: '', position: '', contact: '', baseSalary: 0, monthlyLeaveAllowance: 0 });
  }
  
  if (!isClient) return null;

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-xl font-semibold">Employee Database</CardTitle>
                <CardDescription>Manage your team's information here.</CardDescription>
            </div>
            <Button onClick={openDialogForAdd}><PlusCircle className="mr-2 h-4 w-4"/>Add New Employee</Button>
        </CardHeader>
        <CardContent>
            {employees.length === 0 && !isClient ? (
                 <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Employee ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Base Salary</TableHead>
                            <TableHead>Allowed Leaves</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {employees.map((employee) => (
                            <TableRow key={employee.id}>
                            <TableCell>{employee.employeeId}</TableCell>
                            <TableCell>{employee.name}</TableCell>
                            <TableCell>{employee.position}</TableCell>
                            <TableCell>{employee.contact}</TableCell>
                            <TableCell>{employee.baseSalary?.toFixed(2) || 'N/A'}</TableCell>
                            <TableCell>{employee.monthlyLeaveAllowance || 0}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7 mr-2" onClick={() => openDialogForEdit(employee)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => employee.id && handleDeleteEmployee(employee.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
       </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onKeyDown={handleKeyDown}>
          <DialogHeader>
            <DialogTitle>{currentEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
          </DialogHeader>
          <form>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employeeId" className="text-right">Employee ID</Label>
              <Input id="employeeId" name="employeeId" value={formData.employeeId} readOnly disabled className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="position" className="text-right">Position</Label>
              <Input id="position" name="position" value={formData.position} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact" className="text-right">Contact</Label>
              <Input id="contact" name="contact" value={formData.contact} onChange={handleInputChange} className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="baseSalary" className="text-right">Base Salary</Label>
              <Input id="baseSalary" name="baseSalary" type="number" value={formData.baseSalary} onChange={handleInputChange} className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="monthlyLeaveAllowance" className="text-right">Monthly Leaves</Label>
              <Input id="monthlyLeaveAllowance" name="monthlyLeaveAllowance" type="number" value={formData.monthlyLeaveAllowance} onChange={handleInputChange} className="col-span-3" />
            </div>
          </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {currentEmployee ? 'Save Changes' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
