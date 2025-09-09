
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Loader2 } from 'lucide-react';
import CustomSidebar from './custom-sidebar';
import { Header } from "./header";
import { DynamicIslandToaster } from "@/components/ui/dynamic-island-toaster";
import LoginPage from "@/app/login/page";
import { allMenuItems } from "@/hooks/use-tabs";

import DashboardOverviewPage from "@/app/dashboard-overview/page";
import SupplierEntryPage from "@/app/sales/supplier-entry/page";
import SupplierPaymentsPage from "@/app/sales/supplier-payments/page";
import SupplierProfilePage from "@/app/sales/supplier-profile/page";
import CustomerEntryPage from "@/app/sales/customer-entry/page";
import CustomerPaymentsPage from "@/app/sales/customer-payments/page";
import CustomerProfilePage from "@/app/sales/customer-profile/page";
import CashBankPage from "@/app/cash-bank/page";
import ExpenseTrackerPage from "@/app/expense-tracker/page";
import RtgsReportPage from "@/app/sales/rtgs-report/page";
import EmployeeDatabasePage from "@/app/hr/employee-database/page";
import PayrollManagementPage from "@/app/hr/payroll-management/page";
import AttendanceTrackingPage from "@/app/hr/attendance-tracking/page";
import InventoryManagementPage from "@/app/inventory/inventory-management/page";
import PurchaseOrdersPage from "@/app/inventory/purchase-orders/page";
import ProjectDashboardPage from "@/app/projects/dashboard/page";
import ProjectManagementPage from "@/app/projects/management/page";
import TasksPage from "@/app/projects/tasks/page";
import CollaborationPage from "@/app/projects/collaboration/page";
import DataCapturePage from "@/app/data-capture/page";
import PrinterSettingsPage from "@/app/settings/printer/page";
import SettingsPage from "@/app/settings/page";


const pageComponents: { [key: string]: React.FC<any> } = {
    "dashboard": DashboardOverviewPage,
    "supplier-entry": SupplierEntryPage,
    "supplier-payments": SupplierPaymentsPage,
    "supplier-profile": SupplierProfilePage,
    "customer-entry": CustomerEntryPage,
    "customer-payments": CustomerPaymentsPage,
    "customer-profile": CustomerProfilePage,
    "cash-bank": CashBankPage,
    "income-expense": ExpenseTrackerPage,
    "rtgs-report": RtgsReportPage,
    "employee-db": EmployeeDatabasePage,
    "payroll": PayrollManagementPage,
    "attendance": AttendanceTrackingPage,
    "inventory-mgmt": InventoryManagementPage,
    "purchase-orders": PurchaseOrdersPage,
    "project-dashboard": ProjectDashboardPage,
    "project-management": ProjectManagementPage,
    "tasks": TasksPage,
    "collaboration": CollaborationPage,
    "data-capture": DataCapturePage,
    "printer-settings": PrinterSettingsPage,
    "settings": SettingsPage,
};


// --- Auth Context and Provider ---
interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  isBypassed: boolean;
  logout: () => Promise<void>;
}
const AuthContext = React.createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

const TabContent = ({ activeTabId }: { activeTabId: string }) => {
    const PageComponent = pageComponents[activeTabId];
    return PageComponent ? <PageComponent /> : <div>Page not found</div>;
};

function LayoutController({ children }: { children: ReactNode }) {
    const { isAuthenticated, authLoading, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [activeTabId, setActiveTabId] = useState<string>('dashboard');

    useEffect(() => {
        if (!authLoading) {
            const isSetupPage = pathname.startsWith('/setup');
            if (!isAuthenticated && !isSetupPage && pathname !== '/login') {
                router.replace('/login');
            }
        }
    }, [isAuthenticated, authLoading, pathname, router]);

    if (authLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!isAuthenticated) {
        if (pathname.startsWith('/setup')) {
            return <>{children}</>;
        }
        return <LoginPage />;
    }

    if (pathname === '/login') {
        router.replace('/dashboard-overview'); // Still good to have a default redirect
        return ( 
             <div className="flex h-screen w-screen items-center justify-center bg-background">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
        );
    }

    return (
        <div className="flex min-h-screen">
           <CustomSidebar onSignOut={logout} activeTabId={activeTabId} onTabSelect={setActiveTabId}>
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <TabContent activeTabId={activeTabId} />
                </main>
           </CustomSidebar>
           <DynamicIslandToaster />
        </div>
    )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LayoutController>
                {children}
            </LayoutController>
        </AuthProvider>
    );
}
