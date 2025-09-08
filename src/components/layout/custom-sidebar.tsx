
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { useTabs } from '@/app/layout'; // Changed import
import { cn } from '@/lib/utils';

interface CustomSidebarProps {
  isSidebarActive: boolean;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ isSidebarActive }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { openTab, setActiveTabId } = useTabs();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  useEffect(() => {
    for (const item of allMenuItems) {
      if (item.subMenus && item.subMenus.some(subItem => subItem.href === pathname)) {
        setOpenSubMenu(item.id);
        break;
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (!isSidebarActive) {
      setOpenSubMenu(null);
    }
  }, [isSidebarActive]);

  const handleSubMenuToggle = (id: string) => {
    setOpenSubMenu(openSubMenu === id ? null : id);
  };
  
  const handleMenuItemClick = (item: MenuItemType) => {
    if (item.href) {
        openTab(item);
        setActiveTabId(item.id);
        router.push(item.href); // Still need to navigate
    } else if (item.subMenus) {
        handleSubMenuToggle(item.id);
    }
  };

  const renderMenuItem = (item: MenuItemType) => {
    const isSubMenuActive = item.subMenus?.some(sub => sub.href === pathname) ?? false;
    const isActive = (!item.subMenus && pathname === item.href);

    return (
      <li className={cn((isActive || isSubMenuActive) && "active")}>
        {(isActive || isSubMenuActive) && <span className="top_curve"></span>}
        <a
          href={item.href || '#'}
          onClick={(e) => {
            e.preventDefault(); 
            handleMenuItemClick(item);
          }}
        >
            <span className="icon">{React.createElement(item.icon)}</span>
            <span className="item">{item.name}</span>
        </a>
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
                      <a 
                        href={subItem.href || '#'}
                        onClick={(e) => {
                           e.preventDefault();
                           handleMenuItemClick(subItem);
                        }}
                      >
                         {subItem.name}
                      </a>
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
