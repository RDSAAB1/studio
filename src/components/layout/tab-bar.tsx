
"use client";

import React from 'react';
import { Tab } from './tab';

const TabBar: React.FC<any> = ({ openTabs, activeTabId, setActiveTabId, closeTab }) => {

  if (!openTabs) return null;

  // Remove duplicates based on tab.id as an extra safety measure
  const uniqueTabs = openTabs.filter((tab: any, index: number, self: any[]) => 
    index === self.findIndex((t: any) => t.id === tab.id)
  );

  return (
    <div className="tab-bar-container h-9 bg-card border-b border-border flex items-end">
      <div className="flex items-end pl-2 overflow-x-auto scrollbar-hide">
        {uniqueTabs.map((tab: any) => {
            const isActive = tab.id === activeTabId;
            let iconElement = null;
            
            try {
                if (tab.icon) {
                    if (typeof tab.icon === 'function') {
                        iconElement = React.createElement(tab.icon, { className: "h-4 w-4" });
                    } else if (React.isValidElement(tab.icon)) {
                        iconElement = tab.icon;
                    } else if (typeof tab.icon === 'object' && tab.icon.type) {
                        iconElement = React.createElement(tab.icon.type, { className: "h-4 w-4" });
                    } else {
                        // Fallback: try to render as is
                        console.warn('Unknown icon type for tab:', tab.id, tab.icon);
                    }
                }
            } catch (error) {
                console.error('Error rendering icon for tab:', tab.id, error);
                iconElement = null;
            }

            return (
              <Tab
                key={tab.id}
                icon={iconElement}
                title={tab.name}
                isActive={isActive}
                onClick={() => {
                   setActiveTabId(tab.id);
                }}
                onClose={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  closeTab(tab.id);
                }}
                isClosable={tab.id !== 'dashboard-overview'} // Dashboard is not closable
              />
            )
        })}
      </div>
    </div>
  );
};

export default TabBar;
