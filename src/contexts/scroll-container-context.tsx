"use client";

import React, { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react";

/** Element that scrolls the main page content. When this element scrolls, we trigger window scroll so Floating UI updates dropdown position and it stays with the trigger. */
type ScrollContainerContextValue = {
  /** The scrollable container element (main content area). Use for Portal container so dropdowns stay in same scroll context. */
  container: HTMLElement | null;
  /** Call from layout: pass the scroll container div ref so we can listen to scroll and provide container for portals. */
  setScrollContainer: (el: HTMLDivElement | null) => void;
};

const ScrollContainerContext = createContext<ScrollContainerContextValue | null>(null);

export function useScrollContainer(): ScrollContainerContextValue | null {
  return useContext(ScrollContainerContext);
}

/** Wrap the app (e.g. in root layout). Layout should call setScrollContainer(ref) with the main scroll div. */
export function ScrollContainerProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const setScrollContainer = useCallback((el: HTMLDivElement | null) => {
    setContainer(el);
  }, []);

  useLayoutEffect(() => {
    if (!container) return;
    const onScroll = () => {
      window.dispatchEvent(new Event("scroll", { bubbles: true }));
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [container]);

  const value: ScrollContainerContextValue = {
    container,
    setScrollContainer,
  };

  return (
    <ScrollContainerContext.Provider value={value}>
      {children}
    </ScrollContainerContext.Provider>
  );
}
