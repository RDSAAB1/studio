
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
    "relative flex items-center justify-between cursor-pointer group text-sm px-4 h-[28px] flex-1 transition-all duration-300 ease-in-out",
    {
      'bg-primary text-primary-foreground font-semibold z-10 rounded-full shadow-md scale-105': isActive,
      'text-muted-foreground hover:text-foreground': !isActive,
    }
  );

  return (
    <div 
      className="relative flex-1"
      onClick={onClick}
    >
      <div className={tabClasses}>
          <div className="flex items-center gap-2 z-10 overflow-hidden min-w-0 flex-1">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="whitespace-nowrap truncate">{title}</span>
          </div>
          {isClosable && (
              <Button
              variant="ghost"
              size="icon"
              className={cn(
                  "h-5 w-5 ml-2 rounded-md shrink-0 z-20 transition-colors duration-200 opacity-0 group-hover:opacity-100",
                  isActive ? "hover:bg-foreground/20 text-foreground" : "hover:bg-primary-foreground/20 text-primary-foreground"
              )}
              onClick={onClose}
              >
              <X className="h-3.5 w-3.5" />
              </Button>
          )}
      </div>
    </div>
  );
};
