
"use client";

import React from 'react';
import { Tab } from './tab';
import { useRouter } from 'next/navigation';
import { useTabs } from '@/app/layout';

const TabBar: React.FC = () => {
  const router = useRouter();
  const { openTabs, activeTabId, setActiveTabId, closeTab } = useTabs();

  return (
    <div className="tab-bar-container flex-1 min-w-0">
      <div className="flex items-end">
        {openTabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const iconElement = tab.icon ? React.createElement(tab.icon, { className: "h-4 w-4" }) : null;

            return (
              <Tab
                key={tab.id}
                icon={iconElement}
                title={tab.name}
                isActive={isActive}
                onClick={() => {
                   if(tab.href){
                     setActiveTabId(tab.id);
                     router.push(tab.href);
                   }
                }}
                onClose={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  closeTab(tab.id);
                }}
                isClosable={tab.id !== 'dashboard'} // Dashboard is not closable
              />
            )
        })}
      </div>
    </div>
  );
};

export default TabBar;
