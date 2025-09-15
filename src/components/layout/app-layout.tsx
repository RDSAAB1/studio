
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider, useLocation, useNavigate, MemoryRouter } from 'react-router-dom';
import { getFirebaseAuth, onAuthStateChanged } from '@/lib/firebase';
import type { User } from "firebase/auth";
import { Loader2 } from 'lucide-react';
import CustomSidebar from './custom-sidebar';
import { Header } from "./header";
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
import BankManagementPage from "@/app/settings/bank-management/page";
import PrinterSettingsPage from "@/app/settings/printer/page";
import SettingsPage from "@/app/settings/page";
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import TabBar from './tab-bar';
import { ScrollArea } from "../ui/scroll-area";
import LoginPage from "@/app/login/page";
import { getCompanySettings } from "@/lib/firestore";
import ConnectGmailPage from "@/app/setup/connect-gmail/page";
import CompanyDetailsPage from "@/app/setup/company-details/page";

const pageComponents: { [key: string]: React.FC<any> } = {
    "/login": LoginPage,
    "/setup/connect-gmail": ConnectGmailPage,
    "/setup/company-details": CompanyDetailsPage,
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
    "/settings/bank-management": BankManagementPage,
    "/settings/printer": PrinterSettingsPage,
    "/settings": SettingsPage,
};


const AppContent = () => {
    const [openTabs, setOpenTabs] = useState<MenuItem[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('dashboard-overview');
    const [isSidebarActive, setIsSidebarActive] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
        if (dashboardTab && openTabs.length === 0) {
            setOpenTabs([dashboardTab]);
             if(location.pathname === '/login' || location.pathname === '/'){
               navigate('/dashboard-overview');
             }
        }
    }, [navigate, location.pathname, openTabs]);

    useEffect(() => {
        const currentPathId = location.pathname.substring(1);
        if (currentPathId && currentPathId !== activeTabId) {
            const menuItem = allMenuItems.flatMap(i => i.subMenus ? i.subMenus : i).find(item => item.id === currentPathId);
            if(menuItem) {
                 if (!openTabs.some(tab => tab.id === currentPathId)) {
                     setOpenTabs(prev => [...prev, menuItem]);
                 }
                 setActiveTabId(currentPathId);
            }
        }
    }, [location.pathname, openTabs, activeTabId]);
    
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
            } else {
                const dashboardTab = allMenuItems.find(item => item.id === 'dashboard-overview');
                if (dashboardTab) {
                    setOpenTabs([dashboardTab]);
                    setActiveTabId(dashboardTab.id);
                    navigate(`/${dashboardTab.id}`);
                }
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
    
    const PageComponent = pageComponents[location.pathname];

    return (
       <CustomSidebar onTabSelect={handleOpenTab} isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar}>
          <div className="flex flex-col flex-grow min-h-0">
              <div className="sticky top-0 z-30 flex-shrink-0">
                <TabBar openTabs={openTabs} activeTabId={activeTabId} setActiveTabId={handleTabSelect} closeTab={handleTabClose} />
                <Header toggleSidebar={toggleSidebar} />
              </div>
              <ScrollArea className="flex-grow">
                <main className="p-4 sm:p-6">
                    {PageComponent ? <PageComponent /> : <div>Page not found</div>}
                </main>
              </ScrollArea>
          </div>
       </CustomSidebar>
    );
};

const AuthChecker = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                getCompanySettings(currentUser.uid)
                    .then(settings => {
                        setSetupComplete(!!(settings && settings.appPassword));
                        setLoading(false);
                    })
                    .catch(() => {
                        setSetupComplete(false);
                        setLoading(false);
                    });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (loading) return;

        const isAuthPage = location.pathname === '/login';
        const isSetupPage = location.pathname.startsWith('/setup');

        if (user) {
            if (setupComplete) {
                if (isAuthPage || isSetupPage) {
                    navigate('/dashboard-overview');
                }
            } else {
                if (!isSetupPage) {
                    navigate('/setup/connect-gmail');
                }
            }
        } else {
            if (!isAuthPage) {
                navigate('/login');
            }
        }
    }, [user, loading, setupComplete, location.pathname, navigate]);

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    // Determine which component to render based on auth and setup state
    if (user) {
        if (setupComplete) {
            return <AppContent />;
        }
        // If setup is not complete, the useEffect above will navigate to the setup page.
        // We can render a loader while that navigation happens.
         const SetupComponent = pageComponents[location.pathname];
         if (SetupComponent) {
             return <SetupComponent />;
         }
        return (
             <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If no user, render the login page
    return <LoginPage />;
};


const router = createMemoryRouter([
    { path: '*', Component: AuthChecker }
], { initialEntries: ['/'] });

const AppLayout = () => {
  return <RouterProvider router={router} />;
}

export default function AppLayoutWrapper() {
    return <AppLayout />;
}
