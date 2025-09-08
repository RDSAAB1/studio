
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
  isNextTabActive: boolean;
  isClosable: boolean;
}

export const Tab: React.FC<TabProps> = ({ icon, title, path, isActive, onClick, onClose, isNextTabActive, isClosable }) => {
  const router = useRouter();

  const cornerStyle = {
    '--corner-bg': 'hsl(var(--background))',
    '--tab-bar-bg': 'hsl(var(--card))',
  };
  
  const tabClasses = cn(
    "relative flex items-center justify-between cursor-pointer group text-sm h-[40px] px-3 max-w-[200px] min-w-[100px] flex-1 transition-all duration-200",
    {
      'bg-background text-foreground z-10 rounded-t-lg': isActive,
      'bg-card text-card-foreground hover:bg-accent/50': !isActive,
    }
  );

  const showSeparator = !isActive && !isNextTabActive;

  return (
    <div 
      className="relative flex-shrink min-w-0" 
      onClick={(e) => {
        e.preventDefault(); // Prevent default link behavior
        onClick();
        router.push(path, { scroll: false }); // Use router for navigation without full page reload
      }}
      style={cornerStyle as React.CSSProperties}
    >
      <div className={tabClasses}>
        <div className="flex items-center z-10 overflow-hidden min-w-0">
          {icon}
          <span className="whitespace-nowrap ml-2 truncate">{title}</span>
        </div>
        {isClosable && (
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
        )}
      </div>

      {isActive && (
        <>
          <div 
            className="absolute bottom-0 left-[-16px] w-4 h-4 z-20" 
            style={{ 
              background: 'radial-gradient(circle at 0 0, transparent 0, transparent 15px, var(--corner-bg) 15.5px)',
            }}
          />
          <div 
            className="absolute bottom-0 right-[-16px] w-4 h-4 z-20" 
            style={{ 
              background: 'radial-gradient(circle at 100% 0, transparent 0, transparent 15px, var(--corner-bg) 15.5px)',
            }}
          />
        </>
      )}
      
       {showSeparator && <div className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-px bg-primary-foreground/20 z-10" />}
    </div>
  );
};
