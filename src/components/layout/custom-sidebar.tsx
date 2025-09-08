
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomSidebarProps {
  isSidebarActive: boolean;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ isSidebarActive }) => {
  const pathname = usePathname();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  useEffect(() => {
    // Automatically find and open the submenu of the current active page
    for (const item of allMenuItems) {
      if (item.subMenus) {
        if (item.subMenus.some(subItem => subItem.href === pathname)) {
          setOpenSubMenu(item.id);
          break;
        }
      }
    }
  }, [pathname]);

  useEffect(() => {
    // Close submenus when the sidebar collapses
    if (!isSidebarActive) {
      setOpenSubMenu(null);
    }
  }, [isSidebarActive]);

  const handleSubMenuToggle = (id: string) => {
    setOpenSubMenu(openSubMenu === id ? null : id);
  };

  const renderMenuItem = (item: MenuItemType) => {
    const isSubMenuActive = item.subMenus?.some(sub => sub.href === pathname) ?? false;
    const isActive = (!item.subMenus && pathname === item.href);

    return (
      <li className={cn((isActive || isSubMenuActive) && "active")}>
        {(isActive || isSubMenuActive) && <span className="top_curve"></span>}
        <Link
          href={item.href || '#'}
          onClick={(e) => { 
            if (item.subMenus) {
              e.preventDefault(); 
              handleSubMenuToggle(item.id);
            }
          }}
        >
            <span className="icon">{React.createElement(item.icon)}</span>
            <span className="item">{item.name}</span>
        </Link>
        {(isActive || isSubMenuActive) && <span className="bottom_curve"></span>}
      </li>
    );
  }

  return (
    <aside className="side_bar">
      <div className="side_bar_top">
      </div>
      <div className="side_bar_bottom scrollbar-hide">
        <ul>
          {allMenuItems.map(item => (
            <React.Fragment key={item.id}>
              {renderMenuItem(item)}
              {item.subMenus && (
                <ul className={cn("submenu", openSubMenu === item.id && "open")}>
                  {item.subMenus.map(subItem => (
                    <li key={subItem.id} className={cn(pathname === subItem.href && "active")}>
                      <Link href={subItem.href || '#'}>
                         {subItem.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </React.Fragment>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default CustomSidebar;
