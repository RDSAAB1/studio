
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TabProps {
  icon: React.ReactNode;
  title: string;
  path: string;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}

export const Tab: React.FC<TabProps> = ({ icon, title, path, isActive, onClick, onClose }) => {
  const router = useRouter();
  
  // Define base classes for the tab
  const tabBaseClasses = "relative flex items-center justify-center cursor-pointer group text-sm h-[40px] px-4 transition-colors duration-200 ease-in-out";
  
  // Define classes for the active and inactive states
  const activeClasses = "bg-muted/30 text-foreground z-20";
  const inactiveClasses = "bg-primary text-primary-foreground hover:bg-primary/90";

  // Before and after pseudo-elements for the curves
  const beforePseudoClasses = `
    before:content-[''] before:absolute before:bottom-0 before:-left-2.5 before:w-2.5 before:h-2.5 before:pointer-events-none
    before:bg-transparent before:shadow-[5px_5px_0_5px_hsl(var(--muted)_/_0.3)] before:rounded-br-[10px]
  `;
   const afterPseudoClasses = `
    after:content-[''] after:absolute after:bottom-0 after:-right-2.5 after:w-2.5 after:h-2.5 after:pointer-events-none
    after:bg-transparent after:shadow-[-5px_5px_0_5px_hsl(var(--muted)_/_0.3)] after:rounded-bl-[10px]
  `;
  
  // Separator for inactive tabs
  const inactiveSeparator = "after:content-[''] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-px after:h-5 after:bg-primary-foreground/20";
  
  return (
    <div
      onClick={onClick}
      className={cn(
        tabBaseClasses,
        isActive ? activeClasses : inactiveClasses,
        isActive && `${beforePseudoClasses} ${afterPseudoClasses}`,
        !isActive && `first:rounded-tl-lg last:rounded-tr-lg ${inactiveSeparator} last:after:hidden`
      )}
    >
      <div className="flex items-center justify-center z-10">
        {icon}
        <span className="whitespace-nowrap ml-2">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-5 w-5 ml-2 rounded-full", 
            isActive ? "hover:bg-foreground/20" : "hover:bg-primary-foreground/20 text-primary-foreground"
          )}
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
