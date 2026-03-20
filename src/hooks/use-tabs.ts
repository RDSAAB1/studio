
"use client";

import {
  LayoutDashboard,
  Truck,
  Wallet,
  Users,
  Landmark,
  Users2,
  Database,
  CalendarCheck,
  FilePlus,
  Banknote,
  FileText,
  Settings,
  Lightbulb,
  ClipboardCheck,
  Wrench,
  Search,
  Plus,
  Pen,
  RotateCcw,
  Trash2,
  PieChart,
  History,
  Calculator,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MenuItem = {
    id: string;
    name: string;
    icon: LucideIcon;
    href?: string;
    subMenus?: MenuItem[];
}

export const allMenuItems: MenuItem[] = [
  {
    id: "dashboard-overview",
    name: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "sales-entry",
    name: "Entry",
    icon: FilePlus,
    href: "/sales?menu=entry&tab=supplier-entry",
  },
  {
    id: "sales-payments",
    name: "Payments",
    icon: Wallet,
    href: "/sales?menu=payments&tab=supplier-payments",
  },
  {
    id: "cash-bank",
    name: "Cash & Bank",
    icon: Landmark,
    subMenus: [
      { id: "cash-bank-management", name: "Cash & Bank", icon: Landmark, href: "/sales?menu=cash-bank&tab=cash-bank-management" },
      { id: "settings-bank-accounts", name: "Bank Accounts", icon: Landmark, href: "/sales?menu=cash-bank&tab=settings-bank-accounts" },
      { id: "settings-bank-management", name: "Bank Management", icon: Banknote, href: "/sales?menu=cash-bank&tab=settings-bank-management" },
    ],
  },
  {
    id: "sales-reports",
    name: "Reports",
    icon: PieChart,
    href: "/sales?menu=reports&tab=daily-payments",
  },
  {
    id: "hr",
    name: "HR Management",
    icon: Users,
    subMenus: [
      { id: "hr-employee-database", name: "Employee Database", icon: Database, href: "/sales?menu=hr&tab=hr-employee-database" },
      { id: "hr-payroll-management", name: "Payroll Management", icon: Calculator, href: "/sales?menu=hr&tab=hr-payroll-management" },
      { id: "hr-attendance-tracking", name: "Attendance Tracking", icon: CalendarCheck, href: "/sales?menu=hr&tab=hr-attendance-tracking" },
      { id: "hr-contract-payments", name: "Contract Payments", icon: FileText, href: "/sales?menu=hr&tab=hr-contract-payments" },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    icon: Lightbulb,
    subMenus: [
      { id: "project-dashboard", name: "Project Dashboard", icon: LayoutDashboard, href: "/sales?menu=projects&tab=project-dashboard" },
      { id: "project-tasks", name: "Tasks", icon: ClipboardCheck, href: "/sales?menu=projects&tab=project-tasks" },
      { id: "project-collaboration", name: "Collaboration", icon: Users2, href: "/sales?menu=projects&tab=project-collaboration" },
    ]
  },
  {
    id: "history",
    name: "History",
    icon: History,
    subMenus: [
      { id: "history-new", name: "New Entry", icon: Plus, href: "/sales?menu=history&tab=history-new" },
      { id: "history-edit", name: "Edit History", icon: Pen, href: "/sales?menu=history&tab=history-edit" },
      { id: "history-recycle", name: "Recycle Bin", icon: RotateCcw, href: "/sales?menu=history&tab=history-recycle" },
      { id: "history-delete", name: "Delete History", icon: Trash2, href: "/sales?menu=history&tab=history-delete" },
    ]
  },
  {
    id: "settings", 
    name: "Settings", 
    icon: Settings,
    // Route Settings through unified /sales SPA for single-page feel
    href: "/settings",
  },
  {
    id: "admin",
    name: "Admin Tools",
    icon: Wrench,
    subMenus: [
        // All admin tools now live inside unified /sales SPA (single route)
        { id: "admin/migrations", name: "Database Migrations", icon: Database, href: "/sales?menu=admin&tab=admin-migrations" },
        { id: "admin/diagnostics", name: "ID Diagnostics", icon: Search, href: "/sales?menu=admin&tab=admin-diagnostics" },
        { id: "admin/tasks", name: "Task Progress", icon: ClipboardCheck, href: "/sales?menu=admin&tab=admin-tasks" },
        { id: "settings-data-migration", name: "Data Migration", icon: Database, href: "/sales?menu=admin&tab=settings-data-migration" },
    ]
  },
];
