"use client";

import type { PageProps } from '@/app/types';
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming you have initialized Firestore in firebase.ts
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toTitleCase } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AreaChart, Briefcase, CheckCircle, Clock, ListChecks, Users } from 'lucide-react';

interface Task {
  id: string;
  name: string;
  status: 'Open' | 'InProgress' | 'Completed';
  dueDate: string;
  assignedTo: string;
  projectId: string; // Assuming tasks are linked to projects
}

interface Project {
  id: string;
  name: string;
  status: 'Open' | 'InProgress' | 'Completed' | 'OnHold';
  startDate: string;
  endDate: string;
  manager: string;
  team: string[];
}

interface DashboardData {
  totalProjects: number;
  openProjects: number;
  completedProjects: number;
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  latestTasks: Task[];
  projectProgress: { name: string; progress: number }[];
}

const initialDashboardData: DashboardData = {
  totalProjects: 0,
  openProjects: 0,
  completedProjects: 0,
  totalTasks: 0,
  openTasks: 0,
  inProgressTasks: 0,
  completedTasks: 0,
  latestTasks: [],
  projectProgress: [],
};


export default function ProjectDashboardPage({ params, searchParams }: PageProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData>(initialDashboardData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const projectsQuery = query(collection(db, 'projects'));
    const tasksQuery = query(collection(db, 'tasks'));

    const unsubscribeProjects = onSnapshot(projectsQuery, (projectSnapshot) => {
      const projects = projectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      const totalProjects = projects.length;
      const openProjects = projects.filter(p => p.status === 'Open').length;
      const completedProjects = projects.filter(p => p.status === 'Completed').length;

      // Dummy progress calculation for now, assuming progress is based on completed tasks
      const projectProgress = projects.map(project => {
        const projectTasks = tasksSnapshot ? tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)).filter(task => task.projectId === project.id) : [];
        const completedProjectTasks = projectTasks.filter(task => task.status === 'Completed').length;
        const progress = projectTasks.length > 0 ? (completedProjectTasks / projectTasks.length) * 100 : 0;
        return { name: project.name, progress: Math.round(progress) };
      });

      setDashboardData(prev => ({
        ...prev,
        totalProjects,
        openProjects,
        completedProjects,
        projectProgress,
      }));
      setLoading(false);
    });

    let tasksSnapshot: any = null;
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
        tasksSnapshot = snapshot;
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setDashboardData(prev => ({
        ...prev,
        totalTasks: tasks.length,
        openTasks: tasks.filter(t => t.status === 'Open').length,
        inProgressTasks: tasks.filter(t => t.status === 'InProgress').length,
        completedTasks: tasks.filter(t => t.status === 'Completed').length,
        latestTasks: tasks.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).slice(0, 5), // Get latest 5 tasks
      }));
      setLoading(false);
    });

    return () => {
      unsubscribeProjects();
      unsubscribeTasks();
    };
  }, []);

  if (loading) {
    return <div>Loading Dashboard...</div>; // Basic loading indicator
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Project Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalProjects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Projects</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.openProjects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.completedTasks}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Progress</CardTitle>
            <CardDescription>Overview of progress for each project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.projectProgress.map((project, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{project.name}</span>
                  <span className="text-sm text-muted-foreground">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>
            ))}
             {dashboardData.projectProgress.length === 0 && <div className="text-center text-muted-foreground">No project progress data available.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Tasks</CardTitle>
            <CardDescription>Recently added or updated tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.latestTasks.map(task => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.name}</TableCell>
                       <TableCell>{task.assignedTo || '-'}</TableCell>
                      <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</TableCell>
                      <TableCell><Badge>{toTitleCase(task.status)}</Badge></TableCell>
                    </TableRow>
                  ))}
                   {dashboardData.latestTasks.length === 0 && (
                     <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No latest tasks found.</TableCell>
                     </TableRow>
                   )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

       {/* Placeholder for another chart/section */}
       <Card>
         <CardHeader>
           <CardTitle>Another Overview</CardTitle>
           <CardDescription>Space for another chart or summary.</CardDescription>
         </CardHeader>
         <CardContent className="h-80 flex items-center justify-center text-muted-foreground">
            <AreaChart className="h-24 w-24" />
            <p>More project insights can be displayed here.</p>
         </CardContent>
       </Card>
    </div>
  );
}
