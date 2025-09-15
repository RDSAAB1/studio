
"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { MemoryRouter, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getFirebaseAuth, onAuthStateChanged, getRedirectResult, type User } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import CustomSidebar from './custom-sidebar';
import { Header } from "./header";
import { allMenuItems, type MenuItem } from "@/hooks/use-tabs";
import TabBar from './tab-bar';
import { ScrollArea } from "../ui/scroll-area";
import LoginPage from "@/app/login/page";
import ConnectGmailPage from "@/app/setup/connect-gmail/page";
import CompanyDetailsPage from "@/app/setup/company-details/page";
import { getCompanySettings, getRtgsSettings } from "@/lib/firestore";

// Dynamically import pages to avoid server-side rendering issues
const DashboardOverviewPage = React.lazy(() => import('@/app/dashboard-overview/page'));
const SupplierEntryPage = React.lazy(() => import('@/app/sales/supplier-entry/page'));
const SupplierPaymentsPage = React.lazy(() => import('@/app/sales/supplier-payments/page'));
const SupplierProfilePage = React.lazy(() => import('@/app/sales/supplier-profile/page'));
const CustomerEntryPage = React.lazy(() => import('@/app/sales/customer-entry/page'));
const CustomerPaymentsPage = React.lazy(() => import('@/app/sales/customer-payments/page'));
const CustomerProfilePage = React.lazy(() => import('@/app/sales/customer-profile/page'));
const CashBankPage = React.lazy(() => import('@/app/cash-bank/page'));
const ExpenseTrackerPage = React.lazy(() => import('@/app/expense-tracker/page'));
const RtgsReportPage = React.lazy(() => import('@/app/sales/rtgs-report/page'));
const DailySupplierReportPage = React.lazy(() => import('@/app/sales/daily-supplier-report/page'));
const EmployeeDatabasePage = React.lazy(() => import('@/app/hr/employee-database/page'));
const PayrollManagementPage = React.lazy(() => import('@/app/hr/payroll-management/page'));
const AttendanceTrackingPage = React.lazy(() => import('@/app/hr/attendance-tracking/page'));
const InventoryManagementPage = React.lazy(() => import('@/app/inventory/inventory-management/page'));
const PurchaseOrdersPage = React.lazy(() => import('@/app/inventory/purchase-orders/page'));
const ProjectDashboardPage = React.lazy(() => import('@/app/projects/dashboard/page'));
const ProjectManagementPage = React.lazy(() => import('@/app/projects/management/page'));
const TasksPage = React.lazy(() => import('@/app/projects/tasks/page'));
const CollaborationPage = React.lazy(() => import('@/app/projects/collaboration/page'));
const DataCapturePage = React.lazy(() => import('@/app/data-capture/page'));
const SettingsPage = React.lazy(() => import('@/app/settings/page'));

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
    "/settings": SettingsPage,
    "/settings/bank-management": SettingsPage,
    "/settings/printer": SettingsPage,
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
             if(location.pathname === '/'){
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

    return (
       <CustomSidebar onTabSelect={handleOpenTab} isSidebarActive={isSidebarActive} toggleSidebar={toggleSidebar}>
          <div className="flex flex-col flex-grow min-h-0">
              <div className="sticky top-0 z-30 flex-shrink-0">
                <TabBar openTabs={openTabs} activeTabId={activeTabId} setActiveTabId={handleTabSelect} closeTab={handleTabClose} />
                <Header toggleSidebar={toggleSidebar} />
              </div>
              <ScrollArea className="flex-grow">
                <main className="p-4 sm:p-6">
                    <React.Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
                        <Outlet/>
                    </React.Suspense>
                </main>
              </ScrollArea>
          </div>
       </CustomSidebar>
    );
};

const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null | undefined>(undefined);
    const [setupState, setSetupState] = useState<'loading' | 'gmail' | 'company' | 'complete'>('loading');
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const auth = getFirebaseAuth();

        getRedirectResult(auth).catch(error => {
            console.error("Error processing redirect result:", error);
        });

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const gmailSettings = await getCompanySettings(currentUser.uid);
                if (!gmailSettings?.appPassword) {
                    setSetupState('gmail');
                } else {
                    const companySettings = await getRtgsSettings();
                    if (!companySettings?.companyName || !companySettings.bankName) {
                        setSetupState('company');
                    } else {
                        setSetupState('complete');
                    }
                }
            } else {
                setSetupState('loading'); // Reset state on logout
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user === undefined) return; // Still waiting for initial auth state

        const isLoginPage = location.pathname === '/login';
        const isSetupPage = location.pathname.startsWith('/setup');

        if (!user) {
            if (!isLoginPage) {
                navigate('/login');
            }
        } else {
            if (setupState === 'gmail') {
                if (location.pathname !== '/setup/connect-gmail') {
                    navigate('/setup/connect-gmail');
                }
            } else if (setupState === 'company') {
                 if (location.pathname !== '/setup/company-details') {
                    navigate('/setup/company-details');
                }
            } else if (setupState === 'complete') {
                if (isLoginPage || isSetupPage || location.pathname === '/') {
                    navigate('/dashboard-overview');
                }
            }
        }
    }, [user, setupState, location.pathname, navigate]);

    if (user === undefined || (user && setupState === 'loading')) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return <>{children}</>;
};

const AppRoutes = () => {
    return (
        <AuthWrapper>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/setup/connect-gmail" element={<ConnectGmailPage />} />
                <Route path="/setup/company-details" element={<CompanyDetailsPage />} />
                <Route path="/" element={<AppContent />}>
                    {Object.keys(pageComponents).map(path => {
                        const Component = pageComponents[path];
                        if (!Component) return null;
                        return <Route key={path} path={path} element={<Component />} />
                    })}
                    <Route path="/" element={<DashboardOverviewPage />} />
                </Route>
            </Routes>
        </AuthWrapper>
    );
};

const AppLayout = () => {
    return (
        <MemoryRouter>
            <AppRoutes />
        </MemoryRouter>
    );
};

export default function AppLayoutWrapper() {
    return <AppLayout />;
}

    