
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
    <div className="tab-bar-container h-[42px] bg-card border-b border-border flex items-center -mb-px w-full px-2" style={{ borderRadius: 0 }}>
      <div 
        className="flex items-center w-full gap-1"
      >
        {uniqueTabs.map((tab: any) => {
            const isActive = tab.id === activeTabId;
            let iconElement = null;
            
            try {
                if (tab.icon) {
                    // Check if it's already a rendered element
                    if (React.isValidElement(tab.icon)) {
                        iconElement = tab.icon;
                    } 
                    // Check if it's a React component (function, forward ref, etc.)
                    // Forward refs are functions but may appear as objects in some contexts
                    else if (typeof tab.icon === 'function') {
                        // Standard function component or forward ref (which is also a function)
                        iconElement = React.createElement(tab.icon, { className: "h-4 w-4" });
                    }
                    // Check if it's a forward ref represented as an object (has render property)
                    else if (typeof tab.icon === 'object' && tab.icon !== null && typeof tab.icon.render === 'function') {
                        // Forward ref component - use it directly as a component
                        iconElement = React.createElement(tab.icon, { className: "h-4 w-4" });
                    }
                    // Check if it's an element-like object with a type
                    else if (typeof tab.icon === 'object' && tab.icon !== null && tab.icon.type) {
                        iconElement = React.createElement(tab.icon.type, { className: "h-4 w-4" });
                    }
                    // Unknown type - skip silently (icon is optional)
                }
            } catch (error) {
                // Silently fail - icon is optional
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
                isClosable={false} // Remove close button from all tabs
              />
            )
        })}
      </div>
    </div>
  );
};

export default TabBar;
