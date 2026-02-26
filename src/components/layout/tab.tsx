
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
    "relative flex items-center justify-center cursor-pointer group text-[13px] px-3 h-[36px] flex-1 transition-colors rounded-[10px] border",
    {
      "bg-violet-950 border-violet-950 text-white font-semibold shadow-[0_12px_30px_rgba(2,6,23,0.22)]": isActive,
      "bg-violet-100/70 border-violet-200/35 text-violet-950/80 hover:bg-violet-100/90": !isActive,
    }
  );

  return (
    <div 
      className="relative flex-1"
      onClick={onClick}
    >
      <div className={tabClasses}>
        <div className="flex items-center gap-2 z-10 overflow-hidden min-w-0 flex-1 justify-center">
          {icon && <span className={cn("shrink-0", isActive ? "text-white/85" : "text-violet-950/70")}>{icon}</span>}
          <span className="whitespace-nowrap truncate">{title}</span>
        </div>
      </div>
    </div>
  );
};
