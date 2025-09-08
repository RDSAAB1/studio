
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
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

  return (
    <div className="tab-bar-container flex-1 min-w-0">
      <div className="flex items-end">
        {openTabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const isNextTabActive = (index + 1 < openTabs.length) && openTabs[index + 1].id === activeTabId;
            const iconElement = tab.icon ? React.createElement(tab.icon, { className: "h-4 w-4" }) : null;

            return (
              <Tab
                key={tab.id}
                icon={iconElement}
                title={tab.name}
                isActive={isActive}
                onClick={() => onTabClick(tab.id)}
                onClose={(e) => onCloseTab(tab.id, e)}
                isClosable={tab.id !== 'dashboard'} // Dashboard is not closable
              />
            )
        })}
      </div>
    </div>
  );
};

export default TabBar;
