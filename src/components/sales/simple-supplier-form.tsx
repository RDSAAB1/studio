"use client";

import React from "react";
import { Controller } from "react-hook-form";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, User, Phone, Home, Truck, Hash, Banknote, Weight } from "lucide-react";

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

interface SimpleSupplierFormProps {
    form: any;
    handleSrNoBlur: (value: string) => void;
}

const SimpleSupplierForm = ({ form, handleSrNoBlur }: SimpleSupplierFormProps) => {
    return (
        <div className="space-y-4">
            {/* Basic Information Card */}
            <Card>
                <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="srNo">Serial Number</Label>
                            <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="srNo" 
                                    {...form.register('srNo')} 
                                    onBlur={(e) => handleSrNoBlur(e.target.value)} 
                                    className="pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="name" 
                                    {...form.register('name')} 
                                    className={cn("pl-10", form.formState.errors.name && "border-destructive")} 
                                />
                            </InputWithIcon>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="contact">Contact</Label>
                            <InputWithIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="contact" 
                                    type="tel" 
                                    maxLength={10}
                                    {...form.register('contact')} 
                                    className={cn("pl-10", form.formState.errors.contact && "border-destructive")} 
                                />
                            </InputWithIcon>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="so">S/O</Label>
                            <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="so" 
                                    {...form.register('so')} 
                                    className="pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="address" 
                                    {...form.register('address')} 
                                    className="pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="vehicleNo">Vehicle Number</Label>
                            <InputWithIcon icon={<Truck className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="vehicleNo" 
                                    {...form.register('vehicleNo')} 
                                    className="pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transaction Details Card */}
            <Card>
                <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Transaction Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Controller 
                                name="date" 
                                control={form.control} 
                                render={({ field }) => (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <CalendarComponent 
                                                mode="single" 
                                                selected={field.value} 
                                                onSelect={(date) => field.onChange(date || new Date())} 
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="variety">Variety</Label>
                            <Input 
                                id="variety" 
                                {...form.register('variety')} 
                                className={cn(form.formState.errors.variety && "border-destructive")} 
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="simple-supplier-gross-weight">Gross Weight</Label>
                            <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="simple-supplier-gross-weight" 
                                    type="number" 
                                    {...form.register('grossWeight')} 
                                    className="pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="simple-supplier-rate">Rate</Label>
                            <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="simple-supplier-rate" 
                                    type="number" 
                                    {...form.register('rate')} 
                                    className="pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SimpleSupplierForm;
