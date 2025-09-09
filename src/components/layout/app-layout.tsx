
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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

const pageRoutes = [
    { path: "/", element: <DashboardOverviewPage /> },
    { path: "/dashboard", element: <DashboardOverviewPage /> },
    { path: "/dashboard-overview", element: <DashboardOverviewPage /> },
    { path: "/supplier-entry", element: <SupplierEntryPage /> },
    { path: "/supplier-payments", element: <SupplierPaymentsPage /> },
    { path: "/supplier-profile", element: <SupplierProfilePage /> },
    { path: "/customer-entry", element: <CustomerEntryPage /> },
    { path: "/customer-payments", element: <CustomerPaymentsPage /> },
    { path: "/customer-profile", element: <CustomerProfilePage /> },
    { path: "/cash-bank", element: <CashBankPage /> },
    { path: "/income-expense", element: <ExpenseTrackerPage /> },
    { path: "/rtgs-report", element: <RtgsReportPage /> },
    { path: "/employee-db", element: <EmployeeDatabasePage /> },
    { path: "/payroll", element: <PayrollManagementPage /> },
    { path: "/attendance", element: <AttendanceTrackingPage /> },
    { path: "/inventory-mgmt", element: <InventoryManagementPage /> },
    { path: "/purchase-orders", element: <PurchaseOrdersPage /> },
    { path: "/project-dashboard", element: <ProjectDashboardPage /> },
    { path: "/project-management", element: <ProjectManagementPage /> },
    { path: "/tasks", element: <TasksPage /> },
    { path: "/collaboration", element: <CollaborationPage /> },
    { path: "/data-capture", element: <DataCapturePage /> },
    { path: "/printer-settings", element: <PrinterSettingsPage /> },
    { path: "/settings", element: <SettingsPage /> },
    { path: "*", element: <DashboardOverviewPage /> }
];

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
    
    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });

        if (typeof window !== 'undefined') {
            const bypass = sessionStorage.getItem('bypass') === 'true';
            setIsBypassed(bypass);
            if (bypass) {
                setAuthLoading(false);
            }
        }

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        const auth = getFirebaseAuth();
        await signOut(auth);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('bypass');
        }
    };

    const isAuthenticated = !!user || isBypassed;
    
    return (
        <AuthContext.Provider value={{ user, authLoading, isAuthenticated, isBypassed, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

const AppContent = () => {
    const { isAuthenticated, authLoading, logout } = useAuth();

    if (authLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!isAuthenticated) {
       return <LoginPage />;
    }
    
    return (
       <CustomSidebar onSignOut={logout}>
          <Routes>
              {pageRoutes.map((route) => (
                  <Route key={route.path} path={route.path} element={route.element} />
              ))}
          </Routes>
       </CustomSidebar>
    );
};


export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <MemoryRouter>
              <AppContent />
            </MemoryRouter>
        </AuthProvider>
    );
}
