
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

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 cursor-pointer border-t-2 border-transparent text-sm",
        "border-b border-r border-border",
        isActive
          ? "bg-muted/30 border-t-primary border-b-transparent text-primary-foreground"
          : "text-muted-foreground hover:bg-muted/50"
      )}
      style={{
          borderTopLeftRadius: '0.5rem',
          borderTopRightRadius: '0.5rem',
          boxShadow: isActive ? 'none' : 'inset 0px -1px 0px 0px hsl(var(--border))'
      }}
    >
      {icon}
      <span className="whitespace-nowrap">{title}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 ml-2 rounded-full"
        onClick={onClose}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};
