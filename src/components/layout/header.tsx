
"use client";

import { useState, useEffect } from "react";
import { Settings, UserCircle, Search, Menu, X, LogOut, Bell } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import TabBar from './tab-bar';
import { MenuItem } from "@/hooks/use-tabs";
import { cn } from "@/lib/utils";
import { DynamicIslandToaster } from "../ui/dynamic-island-toaster";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { getLoansRealtime } from "@/lib/firestore";
import type { Loan } from "@/lib/definitions";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import Link from 'next/link';

interface HeaderProps {
  openTabs: MenuItem[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  toggleSidebar: () => void;
  user: User | null;
  onSignOut: () => void;
}

const NotificationBell = () => {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [pendingNotifications, setPendingNotifications] = useState<Loan[]>([]);
    const [open, setOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = getLoansRealtime(setLoans, console.error);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const pending = loans.filter(loan => 
            loan.nextEmiDueDate && new Date(loan.nextEmiDueDate) <= today
        );
        setPendingNotifications(pending);
    }, [loans]);

    const handleNotificationClick = (loan: Loan) => {
        setOpen(false); // Close the popover on click
        const params = new URLSearchParams({
            loanId: loan.id,
            amount: String(loan.emiAmount || 0),
            payee: loan.lenderName || loan.productName || 'Loan Payment',
            description: `EMI for ${loan.loanName}`
        });
        // Corrected the path to ensure it always goes to expense-tracker
        router.push(`/expense-tracker?${params.toString()}`);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {pendingNotifications.length > 0 && (
                        <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-destructive" />
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="p-2">
                    <h4 className="font-medium text-sm">Notifications</h4>
                    <p className="text-xs text-muted-foreground">You have {pendingNotifications.length} pending EMI payments.</p>
                </div>
                <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
                    {pendingNotifications.length > 0 ? (
                        pendingNotifications.map(loan => (
                             <div key={loan.id} className="p-2 rounded-md hover:bg-accent active:bg-primary/20 cursor-pointer" onClick={() => handleNotificationClick(loan)}>
                                <p className="text-sm font-semibold">{loan.loanName}</p>
                                <p className="text-xs text-muted-foreground">
                                    EMI of {formatCurrency(loan.emiAmount || 0)} was due on {format(new Date(loan.nextEmiDueDate!), "dd-MMM-yy")}
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground p-2 text-center">No new notifications.</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export function Header({ openTabs, activeTabId, onTabClick, onCloseTab, toggleSidebar, user, onSignOut }: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { toasts } = useToast();
  const hasToasts = toasts.length > 0;
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex flex-col bg-card">
      {/* Top bar for tabs */}
      <div className="flex h-10 items-center px-4 sm:px-6 border-b border-border">
        <TabBar 
          openTabs={openTabs}
          activeTabId={activeTabId}
          onTabClick={onTabClick}
          onCloseTab={onCloseTab}
        />
      </div>

      {/* Bottom bar for actions and search */}
      <div className="flex h-10 items-center justify-between gap-4 bg-background px-4 sm:px-6">
        <div className="flex items-center gap-2">
            <div className="flex-shrink-0 md:hidden">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
            </Button>
            </div>
            {isSearchOpen && (
                 <div className="relative md:hidden w-full">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search..."
                        className="h-8 w-full rounded-full bg-muted pl-8"
                        autoFocus
                    />
                     <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setIsSearchOpen(false)}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close search</span>
                    </Button>
                </div>
            )}
        </div>

        <div className="absolute left-1/2 top-[calc(2.5rem+0.25rem)] -translate-x-1/2">
             <DynamicIslandToaster />
        </div>
        
        <div className={cn("flex flex-1 items-center justify-end gap-2", isSearchOpen && "hidden")}>
            <div className={cn(
              "relative hidden flex-1 md:flex md:grow-0 max-w-xs transition-opacity",
              hasToasts && "opacity-0 pointer-events-none"
            )}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search..."
                    className="h-8 w-full rounded-full bg-muted pl-8 md:w-[180px] lg:w-[250px]"
                />
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSearchOpen(true)}>
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </Button>
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <UserCircle className="h-5 w-5" />
                        <span className="sr-only">Profile</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user?.displayName || 'My Account'}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
