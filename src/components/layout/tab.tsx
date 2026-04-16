
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
    "relative flex items-center justify-center cursor-pointer group px-1 sm:px-2 h-[28px] sm:h-[36px] flex-1 transition-colors rounded-[6px] sm:rounded-[10px] border",
    {
      "bg-violet-950 border-violet-950 text-white font-semibold shadow-[0_4px_12px_rgba(2,6,23,0.15)] sm:shadow-[0_12px_30px_rgba(2,6,23,0.22)]": isActive,
      "bg-violet-100/70 border-violet-200/35 text-violet-950/80 hover:bg-violet-100/90": !isActive,
    }
  );

  return (
    <div 
      className="relative flex-1"
      onClick={onClick}
    >
      <div className={tabClasses}>
        <div className="flex items-center gap-1 sm:gap-1.5 z-10 overflow-hidden min-w-0 flex-1 justify-center">
          {icon && <span className={cn("shrink-0", isActive ? "text-white/85" : "text-violet-950/70")}>{icon}</span>}
          <span className="whitespace-normal break-words text-center leading-[1.05] text-[9.5px] sm:text-[11.5px]">{title}</span>
        </div>
      </div>
    </div>
  );
};
