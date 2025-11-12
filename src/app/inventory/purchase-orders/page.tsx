
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase'; // Assuming firebase.ts exports db as firestoreDB
import { PurchaseOrder } from '@/lib/definitions'; // Assuming PurchaseOrder type exists

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { Loader2, Edit, Trash2, PlusCircle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { SmartDatePicker } from "@/components/ui/smart-date-picker";

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isClient, setIsClient] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newOrder, setNewOrder] = useState<Partial<PurchaseOrder>>({
    supplierId: '',
    orderDate: format(new Date(), 'yyyy-MM-dd'),
    deliveryDate: '',
    status: 'Pending',
    items: [],
    totalAmount: 0,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const q = query(collection(firestoreDB, 'purchaseOrders'), orderBy('orderDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PurchaseOrder[];
      setPurchaseOrders(ordersData);
    }, (error) => {
      console.error("Error fetching purchase orders: ", error);
      toast({
        title: "Failed to load purchase orders",
        variant: "destructive",
      });
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [isClient, toast]);

  const handleAddOrder = async () => {
    if (!newOrder.supplierId || !newOrder.orderDate || !newOrder.items || newOrder.items.length === 0) {
      toast({
        title: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    try {
      await addDoc(collection(firestoreDB, 'purchaseOrders'), newOrder);
      toast({
        title: "Purchase order added successfully",
        variant: "success",
      });
      setIsAdding(false);
      setNewOrder({
        supplierId: '',
        orderDate: format(new Date(), 'yyyy-MM-dd'),
        deliveryDate: '',
        status: 'Pending',
        items: [],
        totalAmount: 0,
      }); // Reset form
    } catch (error) {
      console.error("Error adding purchase order: ", error);
      toast({
        title: "Failed to add purchase order",
        variant: "destructive",
      });
    }
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder || !editingOrder.id) return;
    try {
      const orderRef = doc(firestoreDB, 'purchaseOrders', editingOrder.id);
      await updateDoc(orderRef, editingOrder);
      toast({
        title: "Purchase order updated successfully",
        variant: "success",
      });
      setIsEditing(false);
      setEditingOrder(null);
    } catch (error) {
      console.error("Error updating purchase order: ", error);
      toast({
        title: "Failed to update purchase order",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await deleteDoc(doc(firestoreDB, 'purchaseOrders', id));
      toast({
        title: "Purchase order deleted successfully",
        variant: "success",
      });
    } catch (error) {
      console.error("Error deleting purchase order: ", error);
      toast({
        title: "Failed to delete purchase order",
        variant: "destructive",
      });
    }
  };

  if (!isClient) {
    return null; // Or a loading skeleton
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Purchase Orders</h2>
        <Button onClick={() => setIsAdding(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Purchase Order
        </Button>
      </div>

      {purchaseOrders.length === 0 ? (
        <div className="text-center text-muted-foreground h-40 flex items-center justify-center">
          No purchase orders found.
        </div>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Supplier ID</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.id}</TableCell>
                <TableCell>{order.supplierId}</TableCell>
                <TableCell>{format(new Date(order.orderDate), 'PPP')}</TableCell>
                <TableCell>{order.deliveryDate ? format(new Date(order.deliveryDate), 'PPP') : '-'}</TableCell>
                <TableCell>{order.status}</TableCell>
                <TableCell>₹{order.totalAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingOrder(order); setIsEditing(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteOrder(order.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      {/* Add Purchase Order Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Purchase Order</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] -mr-6 pr-6">
            <div className="grid gap-4 py-4 pr-1">
              {/* Basic form fields for new order */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="supplierId" className="text-right">
                  Supplier ID
                </Label>
                <Input id="supplierId" value={newOrder.supplierId} onChange={(e) => setNewOrder({ ...newOrder, supplierId: e.target.value })} className="col-span-3" />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="orderDate" className="text-right">
                  Order Date
                </Label>
                <SmartDatePicker
                  id="orderDate"
                  name="orderDate"
                  value={newOrder.orderDate || ""}
                  onChange={(next) => setNewOrder({ ...newOrder, orderDate: next })}
                  className="col-span-3"
                  inputClassName="h-9"
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deliveryDate" className="text-right">
                  Delivery Date
                </Label>
                <SmartDatePicker
                  id="deliveryDate"
                  name="deliveryDate"
                  value={newOrder.deliveryDate || ""}
                  onChange={(next) => setNewOrder({ ...newOrder, deliveryDate: next })}
                  className="col-span-3"
                  inputClassName="h-9"
                />
              </div>
               {/* You would typically add fields here to manage 'items' and calculate 'totalAmount' */}
               {/* For simplicity, adding a dummy total amount field */}
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="totalAmount" className="text-right">
                  Total Amount
                </Label>
                <Input id="totalAmount" type="number" value={newOrder.totalAmount} onChange={(e) => setNewOrder({ ...newOrder, totalAmount: parseFloat(e.target.value) || 0 })} className="col-span-3" />
              </div>
               {/* Items management would need more complex UI (e.g., list of items with quantity, price) */}
               <div className="col-span-4 text-center text-sm text-muted-foreground">
                   (Item management UI needs to be implemented)
               </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleAddOrder}>Add Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Edit Purchase Order Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] -mr-6 pr-6">
            {editingOrder && (
               <div className="grid gap-4 py-4 pr-1">
                  {/* Basic form fields for editing order */}
                  <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-supplierId" className="text-right">
                      Supplier ID
                  </Label>
                  <Input id="edit-supplierId" value={editingOrder.supplierId} onChange={(e) => setEditingOrder({ ...editingOrder, supplierId: e.target.value })} className="col-span-3" />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="edit-orderDate" className="text-right">Order Date</Label>
                      <SmartDatePicker
                        id="edit-orderDate"
                        name="edit-orderDate"
                        value={editingOrder.orderDate ? format(new Date(editingOrder.orderDate), 'yyyy-MM-dd') : ''}
                        onChange={(next) => setEditingOrder(prev => prev ? { ...prev, orderDate: next } : prev)}
                        className="col-span-3"
                        inputClassName="h-9"
                      />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="edit-deliveryDate" className="text-right">Delivery Date</Label>
                      <SmartDatePicker
                        id="edit-deliveryDate"
                        name="edit-deliveryDate"
                        value={editingOrder.deliveryDate ? format(new Date(editingOrder.deliveryDate), 'yyyy-MM-dd') : ''}
                        onChange={(next) => setEditingOrder(prev => prev ? { ...prev, deliveryDate: next } : prev)}
                        className="col-span-3"
                        inputClassName="h-9"
                      />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="edit-status" className="text-right">Status</Label>
                       <Input id="edit-status" value={editingOrder.status} onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value })} className="col-span-3" />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="edit-totalAmount" className="text-right">Total Amount</Label>
                       <Input id="edit-totalAmount" type="number" value={editingOrder.totalAmount} onChange={(e) => setEditingOrder({ ...editingOrder, totalAmount: parseFloat(e.target.value) || 0 })} className="col-span-3" />
                  </div>
               </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditing(false); setEditingOrder(null); }}>Cancel</Button>
            <Button onClick={handleUpdateOrder}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
