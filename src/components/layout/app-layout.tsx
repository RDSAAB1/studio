
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
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
import DailySupplierReportPage from "@/app/sales/daily-supplier-report/page";
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
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import TabBar from './tab-bar';
import { ScrollArea } from "../ui/scroll-area";

const pageComponents: { [key: string]: React.FC<any> } = {
    "/dashboard-overview": DashboardOverviewPage,
    "/supplier-entry": SupplierEntryPage,
    "/supplier-payments": SupplierPaymentsPage,
    "/supplier-profile": SupplierProfilePage,
    "/customer-entry": CustomerEntryPage,
    "/customer-payments": CustomerPaymentsPage,
    "/customer-profile": CustomerProfilePage,
    "/cash-bank": CashBankPage,
    "/income-expense": ExpenseTrackerPage,
    "/rtgs-report": RtgsReportPage,
    "/daily-supplier-report": DailySupplierReportPage,
    "/employee-db": EmployeeDatabasePage,
    "/payroll": PayrollManagementPage,
    "/attendance": AttendanceTrackingPage,
    "/inventory-mgmt": InventoryManagementPage,
    "/purchase-orders": PurchaseOrdersPage,
    "/project-dashboard": ProjectDashboardPage,
    "/project-management": ProjectManagementPage,
    "/tasks": TasksPage,
    "/collaboration": CollaborationPage,
    "/data-capture": DataCapturePage,
    "/printer-settings": PrinterSettingsPage,
    "/settings": SettingsPage,
};


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
        let isComponentMounted = true;
        setAuthLoading(true);

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (isComponentMounted) {
                setUser(currentUser);
                 // We will set loading to false after checking bypass as well.
            }
        });
        
        if (typeof window !== 'undefined') {
            const bypass = sessionStorage.getItem('bypass') === 'true';
            if (isComponentMounted) {
                setIsBypassed(bypass);
            }
        }
        
        // This will run after the initial auth state check and bypass check
        setAuthLoading(false);

        return () => {
            unsubscribe();
            isComponentMounted = false;
        };
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
    const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('dashboard-overview');
    const [isSidebarActive, setIsSidebarActive] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
      const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
      if (dashboardTab) {
          setOpenTabs([dashboardTab]);
      }
    }, []);

    useEffect(() => {
        const currentPathId = location.pathname.substring(1);
        if (currentPathId && currentPathId !== activeTabId) {
            setActiveTabId(currentPathId);
        }
    }, [location.pathname, activeTabId]);

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
                    event.preventDefault();
                    const form = (activeElement as HTMLElement).closest('form');
                    const focusable = form 
                        ? Array.from(form.querySelectorAll('input, select, button, textarea'))
                        : Array.from(document.querySelectorAll('input, select, button, textarea'));

                    const index = focusable.indexOf(activeElement);
                    
                    const nextElement = focusable[index + 1] as HTMLElement;
                    if (nextElement) {
                        nextElement.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, []);
    
    const handleTabSelect = (tabId: string) => {
        setActiveTabId(tabId);
        navigate(`/${tabId}`);
    };

    const handleTabClose = (tabIdToClose: string) => {
        if (tabIdToClose === 'dashboard-overview') return;

        const tabIndex = openTabs.findIndex(tab => tab.id === tabIdToClose);
        const newTabs = openTabs.filter(tab => tab.id !== tabIdToClose);
        
        setOpenTabs(newTabs);

        if (activeTabId === tabIdToClose) {
            const newActiveTab = newTabs[tabIndex - 1] || newTabs[0];
            if (newActiveTab) {
                setActiveTabId(newActiveTab.id);
                navigate(`/${newActiveTab.id}`);
            }
        }
    };
    
    const handleOpenTab = (menuItem: MenuItem) => {
        const isAlreadyOpen = openTabs.some(tab => tab.id === menuItem.id);
        if (!isAlreadyOpen) {
            setOpenTabs(prev => [...prev, menuItem]);
        }
        setActiveTabId(menuItem.id);
        navigate(`/${menuItem.id}`);
    };

    const toggleSidebar = () => {
        setIsSidebarActive(prev => !prev);
    };

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
       <CustomSidebar onSignOut={logout} onTabSelect={handleOpenTab} isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar}>
          <div className="flex flex-col flex-grow min-h-0">
              <div className="sticky top-0 z-30 flex-shrink-0">
                <TabBar openTabs={openTabs} activeTabId={activeTabId} setActiveTabId={handleTabSelect} closeTab={handleTabClose} />
                <Header onSignOut={logout} toggleSidebar={toggleSidebar} />
              </div>
              <ScrollArea className="flex-grow">
                <main className="p-4 sm:p-6">
                    {openTabs.map(tab => {
                        const PageComponent = pageComponents[`/${tab.id}`];
                        return (
                            <div key={tab.id} style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
                                {PageComponent && <PageComponent />}
                            </div>
                        )
                    })}
                </main>
              </ScrollArea>
          </div>
       </CustomSidebar>
    );
};


const router = createMemoryRouter([
    { path: "*", Component: AppContent }
]);

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <RouterProvider router={router}/>
        </AuthProvider>
    );
}
