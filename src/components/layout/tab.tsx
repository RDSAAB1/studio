
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
    "relative flex items-center justify-center cursor-pointer group text-sm px-4 h-[36px] flex-1 transition-all duration-300 ease-in-out",
    {
      'bg-primary text-primary-foreground font-semibold z-10 shadow-md scale-105': isActive,
      'text-muted-foreground hover:text-foreground hover:bg-accent/30 hover:backdrop-blur-md': !isActive,
    }
  );

  return (
    <div 
      className="relative flex-1"
      onClick={onClick}
      style={{ borderRadius: 0 }}
    >
      <div className={tabClasses} style={{ borderRadius: 0 }}>
          <div className="flex items-center gap-2 z-10 overflow-hidden min-w-0 flex-1 justify-center">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="whitespace-nowrap truncate">{title}</span>
          </div>
      </div>
    </div>
  );
};
