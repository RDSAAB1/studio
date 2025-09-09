
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { cn } from '@/lib/utils';
import { Sparkles, Menu, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';

interface CustomSidebarProps {
  isSidebarActive: boolean;
  toggleSidebar: () => void;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ isSidebarActive, toggleSidebar }) => {
  const pathname = usePathname();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  useEffect(() => {
    // Find the active menu item and expand its parent submenu
    for (const item of allMenuItems) {
      if (item.subMenus && item.subMenus.some(subItem => subItem.href === pathname)) {
        setOpenSubMenu(item.id);
        return;
      }
    }
  }, [pathname]);

  const handleSubMenuToggle = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setOpenSubMenu(prev => (prev === id ? null : id));
  };
  
  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      toggleSidebar();
    }
  };

  const renderMenuItem = (item: MenuItemType) => {
    const isSubMenuActive = item.subMenus?.some(sub => sub.href === pathname) ?? false;
    const isActive = !item.subMenus && pathname === item.href;

    if (item.subMenus) {
      return (
        <li className={cn(isSubMenuActive && "active")}>
          {isSubMenuActive && <span className="top_curve"></span>}
          <a
            href="#"
            onClick={(e) => handleSubMenuToggle(e, item.id)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center">
              <span className="icon">{React.createElement(item.icon)}</span>
              <span className="item">{item.name}</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 mr-5 transition-transform item", openSubMenu === item.id && "rotate-180")} />
          </a>
          {isSubMenuActive && <span className="bottom_curve"></span>}
        </li>
      );
    }

    return (
      <li className={cn(isActive && "active")}>
        {isActive && <span className="top_curve"></span>}
        <Link
          href={item.href || '#'}
          onClick={handleLinkClick}
        >
          <span className="icon">{React.createElement(item.icon)}</span>
          <span className="item">{item.name}</span>
        </Link>
        {isActive && <span className="bottom_curve"></span>}
      </li>
    );
  };

  return (
    <aside className="side_bar">
      <div className="side_bar_top">
        <div className="logo_wrap">
           <Link href="/" className='flex items-center gap-2'>
                <span className="icon"><Sparkles/></span>
                <span className="text">BizSuite</span>
           </Link>
        </div>
         <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden lg:flex side_bar_menu">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Pin/Unpin Menu</span>
        </Button>
      </div>
      <div className="side_bar_bottom scrollbar-hide">
        <ul>
          {allMenuItems.map(item => (
            <React.Fragment key={item.id}>
              {renderMenuItem(item)}
              {item.subMenus && (
                <ul className={cn("submenu", (openSubMenu === item.id) && "open")}>
                  {item.subMenus.map(subItem => (
                    <li key={subItem.id} className={cn(pathname === subItem.href && "active")}>
                      <Link href={subItem.href || '#'} onClick={handleLinkClick}>
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
