
"use client";

import React, { useState, useEffect, type ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { cn } from '@/lib/utils';
import { Sparkles, Menu, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';

interface CustomSidebarProps {
  children: ReactNode;
  onSignOut: () => void;
  onTabSelect: (menuItem: MenuItemType) => void;
  isSidebarActive: boolean;
  toggleSidebar: () => void;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ children, onSignOut, onTabSelect, isSidebarActive, toggleSidebar }) => {
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const location = useLocation();
  const activePath = location.pathname;

  useEffect(() => {
    for (const item of allMenuItems) {
      if (item.subMenus && item.subMenus.some(subItem => `/${subItem.id}` === activePath)) {
        setOpenSubMenu(item.id);
        return;
      }
    }
  }, [activePath]);
  
  const handleSubMenuToggle = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenSubMenu(prev => (prev === id ? null : id));
  };
  
  const handleLinkClick = (menuItem: MenuItemType) => {
    onTabSelect(menuItem);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      toggleSidebar();
    }
  };

  const renderMenuItem = (item: MenuItemType) => {
    const isSubMenuActive = item.subMenus?.some(sub => `/${sub.id}` === activePath) ?? false;
    const isActive = !item.subMenus && `/${item.id}` === activePath;

    if (item.subMenus) {
      return (
        <li className={cn(isSubMenuActive && "active")}>
          {isSubMenuActive && <span className="top_curve"></span>}
           <button onClick={(e) => handleSubMenuToggle(e, item.id)} className="w-full">
                <span className="icon">{React.createElement(item.icon)}</span>
                <span className="item">{item.name}</span>
            </button>
          {isSubMenuActive && <span className="bottom_curve"></span>}
        </li>
      );
    }

    return (
      <li className={cn(isActive && "active")}>
        {isActive && <span className="top_curve"></span>}
        <button onClick={() => handleLinkClick(item)} className="w-full">
          <span className="icon">{React.createElement(item.icon)}</span>
          <span className="item">{item.name}</span>
        </button>
        {isActive && <span className="bottom_curve"></span>}
      </li>
    );
  };

  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <aside className="side_bar">
        <div className="side_bar_top">
            <div className="logo_wrap">
             <button onClick={() => onTabSelect(allMenuItems.find(i => i.id === 'dashboard-overview')!)} className='flex items-center gap-2'>
                    <span className="icon"><Sparkles/></span>
                    <span className="text">BizSuite</span>
            </button>
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
                        <li key={subItem.id} className={cn(`/${subItem.id}` === activePath && "active")}>
                        <button onClick={() => handleLinkClick(subItem)} className="w-full text-left">
                            {subItem.name}
                        </button>
                        </li>
                    ))}
                    </ul>
                )}
                </React.Fragment>
            ))}
            </ul>
        </div>
        </aside>
        <div className="main_container">
            {children}
        </div>
        {isSidebarActive && typeof window !== 'undefined' && window.innerWidth < 1024 && (
            <div className="shadow" onClick={toggleSidebar}></div>
        )}
    </div>
  );
};

export default CustomSidebar;
