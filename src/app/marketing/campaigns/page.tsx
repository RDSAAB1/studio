
"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase"; // Assuming db is your Firestore instance
import { Campaign } from "@/lib/definitions"; // Adjust the import based on your definition file
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Edit, Trash2, PlusCircle } from "lucide-react";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', startDate: '', endDate: '' });

  useEffect(() => {
    const q = query(collection(firestoreDB, "campaigns"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const campaignsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Campaign,
        startDate: doc.data().startDate ? format(new Date(doc.data().startDate), 'yyyy-MM-dd') : '', // Format date for input
        endDate: doc.data().endDate ? format(new Date(doc.data().endDate), 'yyyy-MM-dd') : '', // Format date for input
      }));
      setCampaigns(campaignsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching campaigns: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleAddCampaign = () => {
    setCurrentCampaign(null);
    setFormData({ name: '', description: '', startDate: '', endDate: '' });
    setIsFormOpen(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setCurrentCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description,
      startDate: campaign.startDate, // Should already be in 'yyyy-MM-dd' format
      endDate: campaign.endDate,     // Should already be in 'yyyy-MM-dd' format
    });
    setIsFormOpen(true);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (confirm("Are you sure you want to delete this campaign?")) {
      try {
        await deleteDoc(doc(firestoreDB, "campaigns", id));
      } catch (error) {
        console.error("Error deleting campaign: ", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const campaignDataToSave = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : '', // Store as ISO string
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : '',     // Store as ISO string
      };
      if (currentCampaign) {
        // Update existing campaign
        await updateDoc(doc(firestoreDB, "campaigns", currentCampaign.id), campaignDataToSave);
      } else {
        // Add new campaign
        await addDoc(collection(firestoreDB, "campaigns"), campaignDataToSave);
      }
      setIsFormOpen(false);
      setFormData({ name: '', description: '', startDate: '', endDate: '' });
      setCurrentCampaign(null);
    } catch (error) {
      console.error("Error saving campaign: ", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading campaigns...</div>; // Replace with a proper loading skeleton
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Marketing Campaigns</h2>
        <Button onClick={handleAddCampaign}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Campaign
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>{campaign.description}</TableCell>
              <TableCell>{campaign.startDate ? format(new Date(campaign.startDate), "PPP") : '-'}</TableCell>
              <TableCell>{campaign.endDate ? format(new Date(campaign.endDate), "PPP") : '-'}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => handleEditCampaign(campaign)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteCampaign(campaign.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentCampaign ? 'Edit Campaign' : 'Add New Campaign'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right">
                Start Date
              </Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endDate" className="text-right">
                End Date
              </Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>{currentCampaign ? 'Save Changes' : 'Add Campaign'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
