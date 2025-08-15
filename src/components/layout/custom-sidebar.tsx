
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { allMenuItems } from '@/hooks/use-tabs';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomSidebarProps {
  toggleSidebar: () => void;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ toggleSidebar }) => {
  const pathname = usePathname();

  return (
    <aside className="side_bar">
      <div className="side_bar_top">
        <div className="side_bar_menu" onClick={toggleSidebar}>
           <ArrowRight className="menu-icon" />
        </div>
      </div>
      <div className="side_bar_bottom scrollbar-hide">
        <ul>
          {allMenuItems.map(item => (
            <li key={item.id} className={cn(pathname === item.href && "active")}>
              {pathname === item.href && <span className="top_curve"></span>}
              <Link href={item.href}>
                <span className="icon">
                  {React.createElement(item.icon)}
                </span>
                <span className="item">{item.name}</span>
              </Link>
              {pathname === item.href && <span className="bottom_curve"></span>}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default CustomSidebar;
