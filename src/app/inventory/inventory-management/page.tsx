
"use client";

import { useState, useEffect } from 'react';
import {
  getInventoryItems,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '@/lib/firestore'; // Assuming these functions exist in firestore.ts
import { InventoryItem } from '@/lib/definitions'; // Assuming InventoryItem type is defined

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

import { PlusCircle, Edit, Trash2, Loader2 } from "lucide-react";
import { ScrollArea } from '@/components/ui/scroll-area';
import { toTitleCase } from '@/lib/utils';

export default function InventoryManagementPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentInventoryItem, setCurrentInventoryItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id' | 'createdAt'>>({
    name: '',
    sku: '',
    stock: 0,
    unit: '',
    purchasePrice: 0,
    sellingPrice: 0,
  });

  useEffect(() => {
    setIsClient(true);
    const unsubscribe = getInventoryItems(
      (items) => {
        setInventoryItems(items);
      },
      (error) => {
        console.error("Error fetching inventory items:", error);
        toast({
          title: "Failed to load inventory",
          variant: "destructive",
        });
      }
    );

    return () => unsubscribe();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'name' || name === 'unit') {
      setFormData({ ...formData, [name]: toTitleCase(value) });
    } else {
      setFormData({ ...formData, [name]: name === 'stock' || name === 'purchasePrice' || name === 'sellingPrice' ? Number(value) : value });
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
             if (currentInventoryItem) {
                handleUpdateInventoryItem();
            } else {
                handleAddInventoryItem();
            }
        }
    }
  };

  const handleAddInventoryItem = async () => {
    try {
      await addInventoryItem({ ...formData, createdAt: new Date().toISOString() });
      toast({
        title: "Inventory item added",
        variant: "success",
      });
      setIsModalOpen(false);
      setFormData({ name: '', sku: '', stock: 0, unit: '', purchasePrice: 0, sellingPrice: 0 });
    } catch (error) {
      console.error("Error adding inventory item:", error);
      toast({
        title: "Failed to add inventory item",
        variant: "destructive",
      });
    }
  };

  const handleUpdateInventoryItem = async () => {
    if (!currentInventoryItem?.id) return;
    try {
      await updateInventoryItem(currentInventoryItem.id, formData);
      toast({
        title: "Inventory item updated",
        variant: "success",
      });
      setIsModalOpen(false);
      setCurrentInventoryItem(null);
      setFormData({ name: '', sku: '', stock: 0, unit: '', purchasePrice: 0, sellingPrice: 0 });
    } catch (error) {
      console.error("Error updating inventory item:", error);
      toast({
        title: "Failed to update item",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteInventoryItem(id);
        toast({
          title: "Inventory item deleted",
          variant: "success",
        });
      } catch (error) {
        console.error("Error deleting inventory item:", error);
        toast({
          title: "Failed to delete item",
          variant: "destructive",
        });
      }
    }
  };

  const openAddModal = () => {
    setCurrentInventoryItem(null);
    setFormData({ name: '', sku: '', stock: 0, unit: '', purchasePrice: 0, sellingPrice: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setCurrentInventoryItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      stock: item.stock,
      unit: item.unit,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
    });
    setIsModalOpen(true);
  };
  
  if (!isClient) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">Inventory Management</CardTitle>
          <Button onClick={openAddModal}><PlusCircle className="mr-2 h-4 w-4" /> Add New Item</Button>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Purchase Price</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{`${item.stock} ${item.unit}`}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>₹{item.purchasePrice.toFixed(2)}</TableCell>
                      <TableCell>₹{item.sellingPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="mr-2 h-7 w-7" onClick={() => openEditModal(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteInventoryItem(item.id!)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inventoryItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-center h-24">No items in inventory.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent onKeyDown={handleKeyDown}>
          <DialogHeader>
            <DialogTitle>{currentInventoryItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</DialogTitle>
          </DialogHeader>
          <form>
          <ScrollArea className="max-h-[70vh] pr-6 -mr-6">
            <div className="grid gap-4 py-4 pr-1">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sku" className="text-right">SKU</Label>
                <Input id="sku" name="sku" value={formData.sku} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stock" className="text-right">Stock</Label>
                <Input id="stock" name="stock" type="number" value={formData.stock} onChange={handleInputChange} className="col-span-3" />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit" className="text-right">Unit</Label>
                <Input id="unit" name="unit" value={formData.unit} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="purchasePrice" className="text-right">Purchase Price</Label>
                <Input id="purchasePrice" name="purchasePrice" type="number" value={formData.purchasePrice} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sellingPrice" className="text-right">Selling Price</Label>
                <Input id="sellingPrice" name="sellingPrice" type="number" value={formData.sellingPrice} onChange={handleInputChange} className="col-span-3" />
              </div>
            </div>
          </ScrollArea>
          </form>
          <DialogFooter>
            <Button onClick={() => setIsModalOpen(false)} variant="outline">Cancel</Button>
            <Button onClick={currentInventoryItem ? handleUpdateInventoryItem : handleAddInventoryItem}>
              {currentInventoryItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
