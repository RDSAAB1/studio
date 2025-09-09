
"use client";

import React, { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { cn } from '@/lib/utils';
import { Sparkles, Menu, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Header } from './header';

interface CustomSidebarProps {
  children: ReactNode;
  onSignOut: () => void;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ children, onSignOut }) => {
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const [isSidebarActive, setIsSidebarActive] = useState(false);
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
  
  const toggleSidebar = () => {
    setIsSidebarActive(prev => !prev);
  };

  const handleSubMenuToggle = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenSubMenu(prev => (prev === id ? null : id));
  };
  
  const handleLinkClick = (id: string) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarActive(false);
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
                <span className="item flex justify-between w-full">
                    {item.name}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", openSubMenu === item.id && "rotate-180")} />
                </span>
            </button>
          {isSubMenuActive && <span className="bottom_curve"></span>}
        </li>
      );
    }

    return (
      <li className={cn(isActive && "active")}>
        {isActive && <span className="top_curve"></span>}
        <Link to={`/${item.id}`} className="w-full block" onClick={() => handleLinkClick(item.id)}>
          <span className="icon">{React.createElement(item.icon)}</span>
          <span className="item">{item.name}</span>
        </Link>
        {isActive && <span className="bottom_curve"></span>}
      </li>
    );
  };

  return (
    <div className={cn("wrapper", isSidebarActive && "active")}>
        <aside className="side_bar">
        <div className="side_bar_top">
            <div className="logo_wrap">
            <Link to="/dashboard-overview" className='flex items-center gap-2'>
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
                        <li key={subItem.id} className={cn(`/${subItem.id}` === activePath && "active")}>
                        <Link to={`/${subItem.id}`} className="w-full text-left" onClick={() => handleLinkClick(subItem.id)}>
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
        <div className="main_container">
            <Header toggleSidebar={toggleSidebar} onSignOut={onSignOut} />
            <div className="content">
                {children}
            </div>
        </div>
        {isSidebarActive && typeof window !== 'undefined' && window.innerWidth < 1024 && (
            <div className="shadow" onClick={toggleSidebar}></div>
        )}
    </div>
  );
};

export default CustomSidebar;
