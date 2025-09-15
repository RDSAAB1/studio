
"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, UserCircle, Search, Menu, X, LogOut, Bell, Calculator, GripVertical } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { getLoansRealtime } from "@/lib/firestore";
import type { Loan } from "@/lib/definitions";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { DynamicIslandToaster } from "../ui/dynamic-island-toaster";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "../ui/dialog";
import { AdvancedCalculator } from "../calculator/advanced-calculator";


interface HeaderProps {
  toggleSidebar: () => void;
}

const NotificationBell = () => {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [pendingNotifications, setPendingNotifications] = useState<Loan[]>([]);
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

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

    const handleNotificationClick = (e: React.MouseEvent, loan: Loan) => {
        e.preventDefault();
        setOpen(false); 
        const params = new URLSearchParams({
            loanId: loan.id,
            amount: String(loan.emiAmount || 0),
            payee: loan.lenderName || loan.productName || 'Loan Payment',
            description: `EMI for ${loan.loanName}`
        }).toString();
        navigate(`/income-expense?${params}`);
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
                             <a
                                key={loan.id} 
                                href="#"
                                onClick={(e) => handleNotificationClick(e, loan)}
                                className="block p-2 rounded-md hover:bg-accent active:bg-primary/20 cursor-pointer"
                             >
                                <div>
                                    <p className="text-sm font-semibold">{loan.loanName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        EMI of {formatCurrency(loan.emiAmount || 0)} was due on {format(new Date(loan.nextEmiDueDate!), "dd-MMM-yy")}
                                    </p>
                                </div>
                             </a>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground p-2 text-center">No new notifications.</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

const DraggableCalculator = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const dialogRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && dialogRef.current) {
            const newX = e.clientX - dragStartRef.current.x;
            const newY = e.clientY - dragStartRef.current.y;
            setPosition({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);
    
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Calculator className="h-5 w-5" />
                    <span className="sr-only">Calculator</span>
                </Button>
            </DialogTrigger>
            <DialogContent 
                ref={dialogRef}
                className="p-0 border-0 max-w-sm" 
                style={{
                    transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                }}
                onInteractOutside={(e) => {
                    if (isDragging) {
                        e.preventDefault();
                    }
                }}
            >
                <div 
                    onMouseDown={handleMouseDown} 
                    className="cursor-grab active:cursor-grabbing w-full h-8 flex items-center justify-center bg-muted/50 rounded-t-lg"
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                 <AdvancedCalculator />
            </DialogContent>
        </Dialog>
    );
};

export function Header({ toggleSidebar }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-10 items-center gap-4 border-b bg-card px-4 sm:px-6 flex-shrink-0">
        {/* Left Aligned Items */}
        <div className="flex flex-1 items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Sidebar</span>
            </Button>
        </div>

        {/* Center Aligned Dynamic Island */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
             <DynamicIslandToaster />
        </div>

        {/* Right Aligned Icons */}
        <div className={cn("flex flex-shrink-0 items-center justify-end gap-2")}>
          <NotificationBell />
          <DraggableCalculator />
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
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
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => alert('Sign out functionality needs to be reconnected.')}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
  );
}
