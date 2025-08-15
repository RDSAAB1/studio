
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
  
  const tabContainerClasses = "relative h-[40px] px-2 flex-grow";
  const tabBaseClasses = "flex items-center justify-center cursor-pointer group text-sm h-full px-4 transition-colors duration-200 ease-in-out w-full";
  const activeClasses = "bg-background text-foreground";
  const inactiveClasses = "bg-primary text-primary-foreground hover:bg-primary/90";

  const maskStyle: React.CSSProperties = {
    maskImage: 'url(\'data:image/svg+xml;utf8,<svg width="100" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 40H10C15.5228 40 20 35.5228 20 30V10C20 4.47715 24.4772 0 30 0H70C75.5228 0 80 4.47715 80 10V30C80 35.5228 84.4772 40 90 40H100" stroke="black" stroke-width="1"/></svg>\')',
    maskSize: '100% 100%',
    maskRepeat: 'no-repeat',
  };

  return (
    <div className={tabContainerClasses} onClick={onClick}>
      <div
        style={maskStyle}
        className={cn(tabBaseClasses, isActive ? activeClasses : inactiveClasses)}
      >
        <div className="flex items-center justify-center z-10 w-full">
          {icon}
          <span className="whitespace-nowrap ml-2">{title}</span>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-5 w-5 ml-2 rounded-full",
              isActive ? "hover:bg-foreground/20" : "hover:bg-primary-foreground/20 text-primary-foreground"
            )}
            onClick={onClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
       { !isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-px bg-primary-foreground/20" />}
    </div>
  );
};
