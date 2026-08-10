
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
  const [, forceUpdate] = React.useState({});
  React.useEffect(() => {
    const handler = () => forceUpdate({});
    window.addEventListener('jrmd-theme-updated', handler);
    return () => window.removeEventListener('jrmd-theme-updated', handler);
  }, []);

  return (
    <div 
      className="relative flex-1 h-full flex items-stretch border-r border-solid last:border-r-0"
      style={{ borderColor: "var(--settings-subnav-border, rgba(203, 213, 225, 0.6))" }}
      onClick={onClick}
    >
      <div 
        style={{
          backgroundColor: isActive 
            ? "var(--settings-subnav-active-bg, #F5A623)" 
            : undefined,
          color: isActive 
            ? "var(--settings-subnav-active-text, #020617)" 
            : "var(--settings-subnav-text, #334155)",
        }}
        className={cn(
          "w-full flex items-center justify-center cursor-pointer group px-2 h-full transition-colors select-none",
          isActive 
            ? "font-black shadow-xs z-10" 
            : "hover:bg-[var(--settings-subnav-hover-bg,#e2d1e4)]"
        )}
      >
        <div className="flex items-center gap-1.5 z-10 overflow-hidden min-w-0 flex-1 justify-center">
          {icon && (
            <span 
              className="shrink-0 transition-colors"
              style={{
                color: isActive 
                  ? "var(--settings-subnav-active-text, #020617)" 
                  : "var(--settings-subnav-text, #334155)"
              }}
            >
              {icon}
            </span>
          )}
          <span className="whitespace-normal break-words text-center leading-none text-[10.5px] sm:text-[11.5px]">
            {title}
          </span>
        </div>
      </div>
    </div>
  );
};
