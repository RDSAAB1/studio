
"use client";

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tab } from './tab';
import { MenuItem } from '@/hooks/use-tabs';

interface TabBarProps {
  openTabs: MenuItem[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onCloseTab: (id:string, e: React.MouseEvent) => void;
}

const TabBar: React.FC<TabBarProps> = ({ openTabs, activeTabId, onTabClick, onCloseTab }) => {
  const router = useRouter();

  const handleTabClick = (tab: MenuItem) => {
    onTabClick(tab.id);
    if(tab.href) {
        router.push(tab.href);
    }
  };
  
  return (
    <div className="tab-bar-container">
      {openTabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isNextTabActive = (index + 1 < openTabs.length) && openTabs[index + 1].id === activeTabId;
          const iconElement = tab.icon ? React.createElement(tab.icon, { className: "h-4 w-4" }) : null;

          return (
            <Tab
              key={tab.id}
              icon={iconElement}
              title={tab.name}
              path={tab.href || '#'}
              isActive={isActive}
              isNextTabActive={isNextTabActive}
              onClick={() => handleTabClick(tab)}
              onClose={(e) => onCloseTab(tab.id, e)}
              isClosable={tab.id !== 'dashboard'} // Dashboard is not closable
            />
          )
      })}
    </div>
  );
};

export default TabBar;
