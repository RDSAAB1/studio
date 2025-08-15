
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { allMenuItems, type MenuItem as MenuItemType } from '@/hooks/use-tabs';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomSidebarProps {
  toggleSidebar: () => void;
}

const CustomSidebar: React.FC<CustomSidebarProps> = ({ toggleSidebar }) => {
  const pathname = usePathname();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  useEffect(() => {
    // Find the parent menu of the active item and open it
    for (const item of allMenuItems) {
      if (item.subMenus) {
        if (item.subMenus.some(subItem => subItem.href === pathname)) {
          setOpenSubMenu(item.id);
          break;
        }
      }
    }
  }, [pathname]);

  const handleSubMenuToggle = (id: string) => {
    setOpenSubMenu(openSubMenu === id ? null : id);
  };

  return (
    <aside className="side_bar">
      <div className="side_bar_top">
        <div className="logo_wrap">
          <a href="#">
            <span className="text">BizSuite</span>
          </a>
        </div>
        <div className="side_bar_menu" onClick={toggleSidebar}>
           <ArrowRight className="menu-icon" />
        </div>
      </div>
      <div className="side_bar_bottom scrollbar-hide">
        <ul>
          {allMenuItems.map(item => (
            <React.Fragment key={item.id}>
              <li className={cn((!item.subMenus && pathname === item.href) && "active")}>
                {(!item.subMenus && pathname === item.href) && <span className="top_curve"></span>}
                <a 
                  href={item.href || '#'} 
                  onClick={item.subMenus ? (e) => { e.preventDefault(); handleSubMenuToggle(item.id); } : undefined}
                  style={{ cursor: item.subMenus ? 'pointer' : 'default' }}
                >
                  <span className="icon">
                    {React.createElement(item.icon)}
                  </span>
                  <span className="item">{item.name}</span>
                </a>
                {(!item.subMenus && pathname === item.href) && <span className="bottom_curve"></span>}
              </li>
              {item.subMenus && (
                <ul className={cn("submenu", openSubMenu === item.id && "open")}>
                  {item.subMenus.map(subItem => (
                    <li key={subItem.id} className={cn(pathname === subItem.href && "active")}>
                      <Link href={subItem.href}>
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
