"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Assuming db is exported from firebase.ts
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Trash2, PlusCircle } from "lucide-react";
import LoadingSpinner from "@/components/loading-spinner"; // Assuming a loading spinner component exists
import { toast } from "sonner"; // Assuming sonner for toasts

// Define a type for your email marketing data
interface EmailCampaign {
  id?: string; // Firestore document ID
  name: string;
  subject: string;
  body: string;
  createdAt: Date;
  // Add other relevant fields like subscriber list ID, send date, status, etc.
}

export default function EmailMarketingPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<EmailCampaign | null>(null);
  const [formData, setFormData] = useState({ name: "", subject: "", body: "" });

  useEffect(() => {
    const q = query(collection(db, "emailCampaigns")); // Assuming a collection named 'emailCampaigns'
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const campaignsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<EmailCampaign, 'id'>,
        createdAt: doc.data().createdAt.toDate() // Convert Firestore Timestamp to Date
      }));
      setCampaigns(campaignsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching email campaigns:", err);
      setError("Failed to load email campaigns.");
      setLoading(false);
      toast.error("Failed to load email campaigns.");
    });

    return () => unsubscribe(); // Cleanup the listener on unmount
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveCampaign = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      toast.warning("Please fill out all required fields.");
      return;
    }

    try {
      if (currentCampaign?.id) {
        // Update existing campaign
        const campaignRef = doc(db, "emailCampaigns", currentCampaign.id);
        await updateDoc(campaignRef, {
          name: formData.name,
          subject: formData.subject,
          body: formData.body,
          // Update other fields as needed
        });
        toast.success("Email campaign updated successfully.");
      } else {
        // Add new campaign
        await addDoc(collection(db, "emailCampaigns"), {
          ...formData,
          createdAt: new Date(),
          // Add other initial fields
        });
        toast.success("New email campaign added successfully.");
      }
      setIsModalOpen(false);
      setFormData({ name: "", subject: "", body: "" });
      setCurrentCampaign(null);
    } catch (e) {
      console.error("Error saving campaign:", e);
      toast.error("Failed to save email campaign.");
    }
  };

  const handleEditCampaign = (campaign: EmailCampaign) => {
    setCurrentCampaign(campaign);
    setFormData({ name: campaign.name, subject: campaign.subject, body: campaign.body });
    setIsModalOpen(true);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (confirm("Are you sure you want to delete this campaign?")) {
      try {
        await deleteDoc(doc(db, "emailCampaigns", id));
        toast.success("Email campaign deleted successfully.");
      } catch (e) {
        console.error("Error deleting campaign:", e);
        toast.error("Failed to delete email campaign.");
      }
    }
  };

  const handleAddCampaign = () => {
    setCurrentCampaign(null);
    setFormData({ name: "", subject: "", body: "" });
    setIsModalOpen(true);
  };

  if (loading) {
    return <LoadingSpinner />; // Show a loading spinner while data is fetched
  }

  if (error) {
    return <div className="text-center text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Email Marketing Campaigns</CardTitle>
          <Button onClick={handleAddCampaign} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Campaign</Button>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-center text-muted-foreground">No email campaigns found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{campaign.subject}</TableCell>
                    <TableCell>{campaign.createdAt.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditCampaign(campaign)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => campaign.id && handleDeleteCampaign(campaign.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentCampaign ? "Edit Campaign" : "Add New Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subject" className="text-right">
                Subject
              </Label>
              <Input id="subject" name="subject" value={formData.subject} onChange={handleInputChange} className="col-span-3" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="body" className="text-right">
                Body
              </Label>
              <Textarea id="body" name="body" value={formData.body} onChange={handleInputChange} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCampaign}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
