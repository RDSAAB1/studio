

"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { getEmployeesRealtime, addEmployee, updateEmployee, deleteEmployee } from '@/lib/firestore';

export default function EmployeeDatabasePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>({});
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
    const unsubscribe = getEmployeesRealtime(setEmployees, );
    return () => unsubscribe();
  }, []);

  const nextEmployeeId = useMemo(() => {
    if (employees.length === 0) return 'EMP001';
    const lastId = employees[employees.length - 1]?.employeeId || 'EMP000';
    const lastNumber = parseInt(lastId.replace('EMP', ''), 10);
    const newNumber = lastNumber + 1;
    return `EMP${String(newNumber).padStart(3, '0')}`;
  }, [employees]);


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

  const handleSubmit = async () => {
    if (!formData.name || !formData.employeeId) {
        toast({ title: "Name and Employee ID are required", variant: "destructive" });
        return;
    }

    try {
        const dataToSave: Partial<Employee> = { ...formData, name: toTitleCase(formData.name) };

        if (currentEmployee.id) {
            await updateEmployee(currentEmployee.id, dataToSave);
            toast({ title: "Employee updated successfully", variant: "success" });
        } else {
            await addEmployee(dataToSave as Omit<Employee, 'id'>);
            toast({ title: "Employee added successfully", variant: "success" });
        }
        closeDialog();
    } catch (error) {

        toast({ title: `Failed to ${currentEmployee.id ? 'update' : 'add'} employee`, variant: "destructive" });
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
      await deleteEmployee(id);
      toast({
        title: "Employee deleted successfully",
        variant: "success",
      });
    } catch (error) {

      toast({
        title: "Failed to delete employee",
        variant: "destructive",
      });
    }
  };

  const openDialogForAdd = () => {
    setCurrentEmployee({});
    setFormData({ name: '', employeeId: nextEmployeeId, position: '', contact: '', baseSalary: 0, monthlyLeaveAllowance: 0 });
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
    setCurrentEmployee({});
    setFormData({ name: '', employeeId: '', position: '', contact: '', baseSalary: 0, monthlyLeaveAllowance: 0 });
  }
  
  if (!isClient) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;

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
            {employees === undefined && <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {employees && (
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
            <DialogTitle>{currentEmployee.id ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
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
              {currentEmployee.id ? 'Save Changes' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    