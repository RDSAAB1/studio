
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Loader2 } from 'lucide-react';
import CustomSidebar from './custom-sidebar';
import { Header } from "./header";
import LoginPage from "@/app/login/page";
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

const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isBypassed, setIsBypassed] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });

        if (typeof window !== 'undefined') {
            const bypass = sessionStorage.getItem('bypass') === 'true';
            setIsBypassed(bypass);
        }

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        const auth = getFirebaseAuth();
        await signOut(auth);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('bypass');
        }
        router.push('/login');
    };

    const isAuthenticated = !!user || isBypassed;
    
    return (
        <AuthContext.Provider value={{ user, authLoading, isAuthenticated, isBypassed, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

const TabContent = ({ activeTabId }: { activeTabId: string }) => {
    const PageComponent = pageComponents[activeTabId];
    return PageComponent ? <PageComponent /> : <div>Page not found</div>;
};

function LayoutController({ children }: { children: ReactNode }) {
    const { isAuthenticated, authLoading, logout } = useAuth();
    const [activeTabId, setActiveTabId] = useState<string>('dashboard');
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // This effect can be used to sync the tab state with the URL if needed in the future
        // For now, it respects the SPA behavior by not relying on the URL path
    }, [pathname]);

    if (authLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!isAuthenticated) {
        // If not authenticated, and not on the login page, redirect.
        // This check is a safeguard. The main logic is now handled here instead of page-level.
        if (pathname !== '/login') {
           // router.replace('/login'); // This might be too aggressive in a pure SPA model
           return <LoginPage />;
        }
        return <LoginPage />;
    }
    
    // If authenticated, but somehow on the login page, redirect to dashboard.
    if (isAuthenticated && pathname === '/login') {
       // router.replace('/dashboard-overview'); // In SPA model, just change the state
       if (activeTabId !== 'dashboard') {
          setActiveTabId('dashboard');
       }
    }
    
    return (
        <div className="flex min-h-screen">
           <CustomSidebar onSignOut={logout} activeTabId={activeTabId} onTabSelect={setActiveTabId}>
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <TabContent activeTabId={activeTabId} />
                </main>
           </CustomSidebar>
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
