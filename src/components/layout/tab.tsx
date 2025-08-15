
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

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center cursor-pointer group relative text-sm h-[40px] px-4",
        isActive
          ? "bg-muted/30 text-foreground z-10" // Active tab matches page background
          : "bg-primary text-primary-foreground hover:bg-primary/90" // Inactive tabs are dark
      )}
      style={{
        clipPath: 'path("M 0 40 L 0 10 A 10 10 0 0 1 10 0 L calc(100% - 10px) 0 A 10 10 0 0 1 100% 10 L 100% 40 Z")'
      }}
    >
      {/* Separator for inactive tabs */}
       {!isActive && (
        <div className="absolute top-1/2 right-0 h-1/2 w-[1px] -translate-y-1/2 bg-primary-foreground/20 group-hover:bg-transparent"></div>
      )}


      {/* Left Curve */}
      <div className={cn(
        "absolute -left-[9px] bottom-0 w-[10px] h-[10px] pointer-events-none",
        isActive ? "bg-muted/30" : "bg-primary group-hover:bg-primary/90"
      )}>
        <div className="w-full h-full rounded-br-[10px] bg-background"></div>
      </div>
      
      <div className={cn("w-full h-full absolute top-0 left-0",
        isActive ? "" : "hidden"
      )}>
        <div className="absolute -left-[9px] bottom-0 w-[10px] h-[10px] bg-background">
          <div className="w-full h-full rounded-br-[10px] bg-muted/30"></div>
        </div>
      </div>


      {icon}
      <span className="whitespace-nowrap ml-2">{title}</span>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-5 w-5 ml-2 rounded-full", 
          isActive ? "hover:bg-foreground/20" : "hover:bg-primary-foreground/20 text-primary-foreground"
        )}
        onClick={onClose}
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Right Curve */}
      <div className={cn(
        "absolute -right-[9px] bottom-0 w-[10px] h-[10px] pointer-events-none",
        isActive ? "bg-muted/30" : "bg-primary group-hover:bg-primary/90"
      )}>
        <div className="w-full h-full rounded-bl-[10px] bg-background"></div>
      </div>

       <div className={cn("w-full h-full absolute top-0 left-0",
        isActive ? "" : "hidden"
      )}>
        <div className="absolute -right-[9px] bottom-0 w-[10px] h-[10px] bg-background">
          <div className="w-full h-full rounded-bl-[10px] bg-muted/30"></div>
        </div>
      </div>

    </div>
  );
};
