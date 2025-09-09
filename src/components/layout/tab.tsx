
"use client";

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TabProps {
  icon: React.ReactNode;
  title: string;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  isClosable: boolean;
}

export const Tab: React.FC<TabProps> = ({ icon, title, isActive, onClick, onClose, isClosable }) => {
  
  const tabClasses = cn(
    "relative flex items-center justify-between cursor-pointer group text-sm h-[36px] px-3 max-w-[200px] min-w-[100px] flex-1 transition-all duration-200",
    {
      'bg-background text-primary-foreground font-medium z-10 rounded-t-md border-x border-t border-border': isActive,
      'bg-card text-muted-foreground hover:bg-accent/80 rounded-t-md': !isActive,
    }
  );

  return (
    <div 
      className="relative flex-shrink-0"
      onClick={onClick}
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
        <div 
            className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-background z-20"
        />
       )}
    </div>
  );
};
