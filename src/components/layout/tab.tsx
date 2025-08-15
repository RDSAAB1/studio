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

  // Define the base variable for the background color of the tabs container
  const cornerStyle = {
    '--corner-bg': 'hsl(var(--primary))',
    '--content-bg': 'hsl(var(--background))',
  };
  
  const tabClasses = cn(
    "relative flex items-center justify-between cursor-pointer group text-sm h-[40px] px-4 min-w-[120px] max-w-[240px] flex-1 transition-colors duration-200",
    {
      'bg-background text-foreground z-10 rounded-t-lg': isActive,
      'bg-primary text-primary-foreground hover:bg-primary/90': !isActive,
    }
  );


  return (
    <div 
      className="relative flex-grow-0 flex-shrink-0 pt-2" // Added pt-2 to make space for top corners
      onClick={onClick}
      style={cornerStyle as React.CSSProperties}
    >
      <div className={tabClasses}>
        <div className="flex items-center z-10 overflow-hidden">
          {icon}
          <span className="whitespace-nowrap ml-2 truncate">{title}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-5 w-5 ml-2 rounded-full shrink-0 z-20 transition-colors duration-200",
            isActive ? "hover:bg-foreground/20 text-foreground" : "hover:bg-primary-foreground/20 text-primary-foreground"
          )}
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Inverted Scooped corners for active tab */}
      {isActive && (
        <>
          {/* Left Top Corner */}
          <div 
            className="absolute top-0 left-[-16px] w-4 h-4 z-20" 
            style={{ 
              background: 'radial-gradient(circle at 0 100%, transparent 0, transparent 16px, var(--primary) 16px)',
            }}
          />
           <div 
            className="absolute top-0 left-[-16px] w-4 h-4 z-20" 
            style={{ 
              background: 'radial-gradient(circle at 0 100%, transparent 0, transparent 15px, var(--content-bg) 15px)',
            }}
          />
          
          {/* Right Top Corner */}
          <div 
            className="absolute top-0 right-[-16px] w-4 h-4 z-20" 
            style={{ 
              background: 'radial-gradient(circle at 100% 100%, transparent 0, transparent 16px, var(--primary) 16px)',
            }}
          />
           <div 
            className="absolute top-0 right-[-16px] w-4 h-4 z-20" 
            style={{ 
              background: 'radial-gradient(circle at 100% 100%, transparent 0, transparent 15px, var(--content-bg) 15px)',
            }}
          />
        </>
      )}
      
      {/* Separator for inactive tabs */}
       {!isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-px bg-primary-foreground/20" />}
    </div>
  );
};
