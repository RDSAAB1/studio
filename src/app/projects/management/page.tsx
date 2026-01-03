

"use client";

import { useState, useEffect } from 'react';
import type { Project } from '@/lib/definitions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { format } from "date-fns";
import { addProject, updateProject, deleteProject } from '@/lib/firestore';
import { getProjectsRealtime } from '@/lib/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toTitleCase } from '@/lib/utils';
import { SmartDatePicker } from "@/components/ui/smart-date-picker";


export default function ProjectManagementPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isClient, setIsClient] = useState(false);
    
    // Fetch projects data directly
    useEffect(() => {
        const unsubscribe = getProjectsRealtime(
            (data) => setProjects(data),
            (error) => ('Error fetching projects:', error)
        );
        return () => unsubscribe();
    }, []);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentProject, setCurrentProject] = useState<Partial<Project>>({});
    const { toast } = useToast();

    useEffect(() => {
        setIsClient(true);
        // Use global data store - NO duplicate listeners
    }, []);

    const handleNewProject = () => {
        setCurrentProject({
            name: '',
            description: '',
            status: 'Open',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: '',
            totalCost: 0,
            totalBilled: 0
        });
        setIsDialogOpen(true);
    };

    const handleEditProject = (project: Project) => {
        setCurrentProject(project);
        setIsDialogOpen(true);
    };

    const handleDeleteProject = async (id: string) => {
        try {
            await deleteProject(id);
            toast({ title: "Project deleted successfully", variant: "success" });
        } catch (error) {

            toast({ title: "Failed to delete project", variant: "destructive" });
        }
    };

    const handleSaveProject = async () => {
        if (!currentProject || !currentProject.name) {
            toast({ title: "Project name is required", variant: "destructive" });
            return;
        }

        try {
            const projectData: Partial<Project> = {
                ...currentProject,
                name: toTitleCase(currentProject.name),
                description: currentProject.description ? toTitleCase(currentProject.description) : '',
            };

            if (projectData.id) {
                await updateProject(projectData.id, projectData);
                toast({ title: "Project updated", variant: "success" });
            } else {
                await addProject(projectData as Omit<Project, 'id'>);
                toast({ title: "Project created", variant: "success" });
            }
            setIsDialogOpen(false);
            setCurrentProject({});
        } catch (error) {

            toast({ title: "Failed to save project", variant: "destructive" });
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!currentProject) return;
        const { name, value } = e.target;
        const isNumericField = name === 'totalCost' || name === 'totalBilled';
        setCurrentProject({ ...currentProject, [name]: isNumericField ? Number(value) : value });
    };

    const handleStatusChange = (status: Project['status']) => {
        if (!currentProject) return;
        setCurrentProject({ ...currentProject, status });
    }
    
    if (!isClient) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Project Management</CardTitle>
                        <CardDescription>Create, view, and manage all your projects.</CardDescription>
                    </div>
                    <Button onClick={handleNewProject}><PlusCircle className="mr-2 h-4 w-4" /> Add New Project</Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects === undefined && <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>}
                                {projects && projects.length > 0 ? projects.map((project) => (
                                    <TableRow key={project.id}>
                                        <TableCell className="font-medium">{project.name}</TableCell>
                                        <TableCell>{project.status}</TableCell>
                                        <TableCell>{format(new Date(project.startDate), "PPP")}</TableCell>
                                        <TableCell>{project.endDate ? format(new Date(project.endDate), "PPP") : '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 mr-2" onClick={() => handleEditProject(project)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteProject(project.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    projects && <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No projects found. Start by adding a new one.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{currentProject?.id ? 'Edit Project' : 'Add New Project'}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mr-4 pr-4">
                        {currentProject && (
                            <div className="grid gap-4 py-4 pr-1">
                                <div className="space-y-1">
                                    <Label htmlFor="name">Project Name</Label>
                                    <Input id="name" name="name" value={currentProject.name || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea id="description" name="description" value={currentProject.description || ''} onChange={handleInputChange} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="status">Status</Label>
                                        <Select onValueChange={handleStatusChange} value={currentProject.status}>
                                            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Open">Open</SelectItem>
                                                <SelectItem value="InProgress">In Progress</SelectItem>
                                                <SelectItem value="Completed">Completed</SelectItem>
                                                <SelectItem value="OnHold">On Hold</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="startDate">Start Date</Label>
                                        <SmartDatePicker
                                            id="startDate"
                                            name="startDate"
                                            value={currentProject.startDate || ''}
                                            onChange={(next) => setCurrentProject(prev => ({ ...prev, startDate: next }))}
                                            inputClassName="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="totalCost">Total Cost (Optional)</Label>
                                        <Input id="totalCost" name="totalCost" type="number" value={currentProject.totalCost || 0} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="totalBilled">Total Billed (Optional)</Label>
                                        <Input id="totalBilled" name="totalBilled" type="number" value={currentProject.totalBilled || 0} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="endDate">End Date (Optional)</Label>
                                        <SmartDatePicker
                                            id="endDate"
                                            name="endDate"
                                            value={currentProject.endDate || ''}
                                            onChange={(next) => setCurrentProject(prev => ({ ...prev, endDate: next }))}
                                            inputClassName="h-9"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSaveProject}>{currentProject?.id ? 'Save Changes' : 'Create Project'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

    
