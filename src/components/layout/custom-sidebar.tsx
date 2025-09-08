
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { useTabs } from '@/app/layout';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';

interface CustomSidebarProps {
  isSidebarActive: boolean;
  toggleSidebar: () => void; // Add toggle function to props
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ isSidebarActive, toggleSidebar }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { openTab } = useTabs();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  useEffect(() => {
    // Expand submenu if a child route is active
    for (const item of allMenuItems) {
      if (item.subMenus && item.subMenus.some(subItem => subItem.href === pathname)) {
        setOpenSubMenu(item.id);
        break;
      }
    }
  }, [pathname]);

  const handleSubMenuToggle = (id: string) => {
    setOpenSubMenu(openSubMenu === id ? null : id);
  };
  
  const handleMenuItemClick = (item: MenuItemType) => {
    if (item.href) {
        openTab(item);
        router.push(item.href);
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
        <Link
          href={item.href || '#'}
          onClick={(e) => {
            e.preventDefault(); 
            handleMenuItemClick(item);
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
          {/* The menu button is now in the header, but we keep the structure */}
      </div>
      <div className="side_bar_bottom scrollbar-hide">
        <ul>
          {allMenuItems.map(item => (
            <React.Fragment key={item.id}>
              {renderMenuItem(item)}
              {item.subMenus && isSidebarActive && (
                <ul className={cn("submenu", openSubMenu === item.id && "open")}>
                  {item.subMenus.map(subItem => (
                    <li key={subItem.id} className={cn(pathname === subItem.href && "active")}>
                      <Link
                        href={subItem.href || '#'}
                        onClick={(e) => {
                           e.preventDefault();
                           handleMenuItemClick(subItem);
                        }}
                      >
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
