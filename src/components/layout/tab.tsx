
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

  const tabClasses = cn(
    "relative flex items-center justify-center cursor-pointer group text-sm h-[40px] px-4 transition-colors duration-200 ease-in-out flex-grow min-w-0",
    {
      'bg-muted/30 text-foreground z-10': isActive,
      'bg-primary text-primary-foreground hover:bg-primary/90': !isActive,
    }
  );

  const cornerClasses = "absolute bottom-0 w-[20px] h-[20px] pointer-events-none";

  return (
    <div className="relative flex-grow min-w-0" onClick={onClick}>
      <div className={tabClasses}>
        {/* Left Corner */}
        {isActive && (
           <div className={cn(cornerClasses, "left-[-20px]")}>
             <div className="w-full h-full bg-primary" style={{
                maskImage: 'radial-gradient(circle at 0 0, transparent 0, transparent 20px, black 20.5px)',
             }}></div>
          </div>
        )}
        
        {/* Content */}
        <div className="flex items-center justify-center z-10 overflow-hidden">
          {icon}
          <span className="whitespace-nowrap ml-2 truncate">{title}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-5 w-5 ml-2 rounded-full shrink-0 z-20",
            isActive ? "hover:bg-foreground/20 text-foreground" : "hover:bg-primary-foreground/20 text-primary-foreground"
          )}
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
        
        {/* Right Corner */}
         {isActive && (
           <div className={cn(cornerClasses, "right-[-20px]")}>
             <div className="w-full h-full bg-primary" style={{
                maskImage: 'radial-gradient(circle at 100% 0, transparent 0, transparent 20px, black 20.5px)',
             }}></div>
          </div>
        )}
      </div>
      {/* Separator for inactive tabs */}
      {!isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-px bg-primary-foreground/20" />}
    </div>
  );
};
