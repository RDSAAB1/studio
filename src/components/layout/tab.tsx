
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
    "relative flex items-center justify-between cursor-pointer group text-sm h-[40px] px-4 min-w-[120px] max-w-[240px] flex-1",
    {
      'bg-muted/30 text-foreground z-10': isActive,
      'bg-primary text-primary-foreground hover:bg-primary/90': !isActive,
    }
  );

  const cornerStyle = {
    '--corner-bg': 'hsl(var(--primary))',
    '--content-bg': 'hsl(var(--muted)/0.3)',
  };

  return (
    <div 
      className="relative flex-grow-0 flex-shrink-0" 
      onClick={onClick}
      style={cornerStyle as React.CSSProperties}
    >
      <div className={tabClasses}>
         {/* The main tab content */}
        <div className="flex items-center z-10 overflow-hidden">
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
      </div>

      {/* Styled corners for active tab */}
      {isActive && (
        <>
          <div 
            className="absolute -bottom-px left-[-16px] w-4 h-4 z-20" 
            style={{ 
              background: 'radial-gradient(circle at 0 0, transparent 0, transparent 16px, var(--corner-bg) 16px)',
            }}
          />
          <div 
            className="absolute -bottom-px right-[-16px] w-4 h-4 z-20" 
            style={{ 
              background: 'radial-gradient(circle at 100% 0, transparent 0, transparent 16px, var(--corner-bg) 16px)',
            }}
          />
        </>
      )}

       {/* Separator for inactive tabs */}
       {!isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-px bg-primary-foreground/20" />}
    </div>
  );
};
