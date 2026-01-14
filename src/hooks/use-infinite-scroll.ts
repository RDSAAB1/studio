/**
 * Infinite Scroll Pagination Hook
 * 
 * Automatically loads more data when user scrolls near the bottom of a table.
 * Initially shows 50 entries, then loads 50 more when scrolling near the last 5 entries.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
    totalItems: number;
    initialLoad?: number;
    loadMore?: number;
    threshold?: number; // Number of items from bottom to trigger load
    enabled?: boolean;
}

interface UseInfiniteScrollReturn {
    visibleItems: number;
    hasMore: boolean;
    isLoading: boolean;
    loadMore: () => void;
    reset: () => void;
    scrollRef: React.RefObject<HTMLDivElement>;
}

export function useInfiniteScroll<T>(
    items: T[],
    options: UseInfiniteScrollOptions
): UseInfiniteScrollReturn {
    const {
        totalItems,
        initialLoad = 50,
        loadMore: loadMoreCount = 50,
        threshold = 5,
        enabled = true,
    } = options;

    const [visibleItems, setVisibleItems] = useState(initialLoad);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const prevTotalItemsRef = useRef(totalItems);

    const hasMore = visibleItems < totalItems;

    const loadMore = useCallback(() => {
        if (!hasMore || isLoading || !enabled) return;

        setIsLoading(true);
        
        // Simulate slight delay for smooth UX
        setTimeout(() => {
            setVisibleItems((prev) => Math.min(prev + loadMoreCount, totalItems));
            setIsLoading(false);
        }, 100);
    }, [hasMore, isLoading, enabled, loadMoreCount, totalItems]);

    const reset = useCallback(() => {
        setVisibleItems(initialLoad);
        setIsLoading(false);
    }, [initialLoad]);

    useEffect(() => {
        // Reset when totalItems changes (not on every render)
        // Only reset if the total actually changed to avoid infinite loops
        if (prevTotalItemsRef.current !== totalItems) {
            prevTotalItemsRef.current = totalItems;
            reset();
        }
    }, [totalItems, reset]);

    useEffect(() => {
        if (!enabled || !hasMore) return;

        const scrollContainer = scrollRef.current;
        if (!scrollContainer) return;

        // Find the ScrollArea's viewport element
        const viewport = scrollContainer.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!viewport) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = viewport;
            const scrollBottom = scrollHeight - scrollTop - clientHeight;
            
            // Trigger load when within 200px from bottom (approximately 4-5 rows)
            if (scrollBottom <= 200 && hasMore && !isLoading) {
                loadMore();
            }
        };

        viewport.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
            viewport.removeEventListener('scroll', handleScroll);
        };
    }, [enabled, hasMore, isLoading, loadMore]);

    // Also use Intersection Observer as a fallback for better detection
    useEffect(() => {
        if (!enabled || !hasMore || isLoading) return;

        const scrollContainer = scrollRef.current;
        if (!scrollContainer) return;

        // Find the last few rows to observe
        const tableBody = scrollContainer.querySelector('tbody');
        if (!tableBody) return;

        const rows = Array.from(tableBody.querySelectorAll('tr')).filter(
            row => !row.querySelector('[colspan]') // Exclude loading/empty message rows
        );
        
        if (rows.length === 0) return;

        // Observe the row that is threshold items from the end
        const observeIndex = Math.max(0, rows.length - threshold);
        const targetRow = rows[observeIndex];

        if (!targetRow) return;

        // Clean up previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        const viewport = scrollContainer.querySelector('[data-radix-scroll-area-viewport]');
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && hasMore && !isLoading) {
                        loadMore();
                    }
                });
            },
            {
                root: viewport,
                rootMargin: '200px',
                threshold: 0.1,
            }
        );

        observerRef.current.observe(targetRow);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [enabled, hasMore, isLoading, threshold, loadMore]);

    return {
        visibleItems,
        hasMore,
        isLoading,
        loadMore,
        reset,
        scrollRef,
    };
}

/**
 * Simple pagination hook for non-scrollable tables
 */
export function usePagination<T>(
    items: T[],
    options: UseInfiniteScrollOptions
): UseInfiniteScrollReturn {
    const {
        totalItems,
        initialLoad = 50,
        loadMore: loadMoreCount = 50,
        enabled = true,
    } = options;

    const [visibleItems, setVisibleItems] = useState(initialLoad);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const hasMore = visibleItems < totalItems;

    const loadMore = useCallback(() => {
        if (!hasMore || isLoading || !enabled) return;

        setIsLoading(true);
        setTimeout(() => {
            setVisibleItems((prev) => Math.min(prev + loadMoreCount, totalItems));
            setIsLoading(false);
        }, 100);
    }, [hasMore, isLoading, enabled, loadMoreCount, totalItems]);

    const reset = useCallback(() => {
        setVisibleItems(initialLoad);
        setIsLoading(false);
    }, [initialLoad]);

    useEffect(() => {
        reset();
    }, [items.length, reset]);

    return {
        visibleItems,
        hasMore,
        isLoading,
        loadMore,
        reset,
        scrollRef,
    };
}

