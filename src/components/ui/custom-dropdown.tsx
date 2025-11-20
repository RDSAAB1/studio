
"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import { cn, levenshteinDistance } from '@/lib/utils';
import { Input } from './input';
import { Button } from './button';
import { Loader2 } from 'lucide-react';

export interface CustomDropdownOption {
    value: string;
    label: string;
    displayValue?: string; // Optional display value for input field (if different from label)
    data?: any; // Additional data for enhanced display
}

interface CustomDropdownProps {
    options: CustomDropdownOption[];
    value: string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    noItemsPlaceholder?: string;
    onAdd?: (newItem: string) => void;
    inputClassName?: string;
    showClearButton?: boolean;
    showArrow?: boolean;
    showGoButton?: boolean;
    onGoClick?: () => void;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select an item...',
    searchPlaceholder = 'Search items...',
    noItemsPlaceholder = 'No item found.',
    onAdd,
    inputClassName,
    showClearButton = true,
    showArrow = false,
    showGoButton = false,
    onGoClick,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [scrollTop, setScrollTop] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Debounce search term for better performance
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 150); // 150ms debounce

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [searchTerm]);

    const selectedItem = useMemo(() => options.find(option => option.value === value), [options, value]);

    // Clear search term when dropdown opens to show all options
    useEffect(() => {
        if (isOpen) {
            // When dropdown opens, always clear search term to show all options
            // This ensures users can see all available options when they click
            setSearchTerm('');
            // Debounced search term will be cleared by the debounce effect
        }
    }, [isOpen]);

    useEffect(() => {
        // Only update search term if a valid selection is made and user is not actively typing
        // This prevents overwriting user's typing
        if (selectedItem && !isOpen) {
            // Use displayValue if available, otherwise use label
            setSearchTerm(selectedItem.displayValue || selectedItem.label);
        } else if (!value && !isOpen) {
            setSearchTerm('');
        }
    }, [value, selectedItem, isOpen]);
    
    // Optimized filtering with early exit for large datasets
    const filteredItems = useMemo(() => {
        // If no search term, show all options
        if (!debouncedSearchTerm || debouncedSearchTerm.trim() === '') {
            // Return all options, sorted alphabetically by label
            return [...options].sort((a, b) => {
                // Sort Cash In Hand first, then alphabetically
                if (a.value === 'CashInHand') return -1;
                if (b.value === 'CashInHand') return 1;
                return a.label.localeCompare(b.label);
            });
        }
        
        // If search term matches selected item exactly, show all options
        if (selectedItem && debouncedSearchTerm === selectedItem.label) {
            return [...options].sort((a, b) => {
                if (a.value === 'CashInHand') return -1;
                if (b.value === 'CashInHand') return 1;
                return a.label.localeCompare(b.label);
            });
        }
        
        const lowercasedSearchTerm = debouncedSearchTerm.toLowerCase().trim();
        const maxResults = 200; // Limit results for performance
        
        // Fast path: simple includes check first
        const quickMatches: Array<{ item: CustomDropdownOption; distance: number }> = [];
        const fuzzyMatches: Array<{ item: CustomDropdownOption; distance: number }> = [];
        
        for (let i = 0; i < options.length && (quickMatches.length + fuzzyMatches.length) < maxResults; i++) {
            const item = options[i];
                const lowercasedLabel = item.label.toLowerCase();
                
            // Quick exact/partial match
                if (lowercasedLabel.includes(lowercasedSearchTerm)) {
                quickMatches.push({ item, distance: 0 });
                continue;
                }
                
            // Fuzzy matching only if we haven't found enough quick matches
            if (quickMatches.length < 50) {
                const labelParts = lowercasedLabel.split(/[\s\-\(\)]+/);
                let minDistance = Infinity;
                
                for (const part of labelParts) {
                    if (part.includes(lowercasedSearchTerm)) {
                        minDistance = 0;
                        break;
                    }
                    const distance = levenshteinDistance(lowercasedSearchTerm, part);
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                }
                
                const fullDistance = levenshteinDistance(lowercasedSearchTerm, lowercasedLabel);
                minDistance = Math.min(minDistance, fullDistance);
                
                if (minDistance <= 3) {
                    fuzzyMatches.push({ item, distance: minDistance });
                }
            }
        }
        
        // Combine and sort
        const allMatches = [...quickMatches, ...fuzzyMatches]
            .sort((a, b) => a.distance - b.distance)
            .slice(0, maxResults);
        
        return allMatches.map(m => m.item);
    }, [debouncedSearchTerm, options, selectedItem]);

    // Virtual scrolling: only render visible items
    const ITEM_HEIGHT = 32; // Approximate height of each item (reduced for smaller text)
    const VISIBLE_ITEMS = 20; // Number of items visible at once
    const BUFFER = 5; // Extra items to render for smooth scrolling
    
    const virtualItems = useMemo(() => {
        const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
        const endIndex = Math.min(
            filteredItems.length,
            startIndex + VISIBLE_ITEMS + BUFFER * 2
        );
        
        return {
            startIndex,
            endIndex,
            totalHeight: filteredItems.length * ITEM_HEIGHT,
            visibleItems: filteredItems.slice(startIndex, endIndex),
        };
    }, [scrollTop, filteredItems]);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
            // Only reset search term if we have a valid selection
            if (selectedItem) {
                setSearchTerm(selectedItem.displayValue || selectedItem.label);
            } else if (value) {
                 const matchingOption = options.find(opt => opt.value === value || opt.label === value);
                 if (matchingOption) {
                    setSearchTerm(matchingOption.displayValue || matchingOption.label);
                 } else {
                    setSearchTerm(value);
                 }
            }
            // Don't clear the value automatically - let user decide
        }
    }, [selectedItem, value, options]);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleClickOutside]);


    const handleSelect = (item: CustomDropdownOption) => {
        onChange(item.value);
        // Use displayValue if available, otherwise use label
        setSearchTerm(item.displayValue || item.label);
        setIsOpen(false);
    };
    
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSearchTerm('');
        setIsOpen(true);
        inputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSearchTerm = e.target.value;
        setSearchTerm(newSearchTerm);
        setIsOpen(true);
        setScrollTop(0); // Reset scroll when searching
    };

    const handleScroll = useCallback((e: React.UIEvent<HTMLUListElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);
    
    const handleInputClick = () => {
        if (!isOpen) {
            // Clear search term when opening to show all options
            setSearchTerm('');
            setDebouncedSearchTerm('');
        }
        setIsOpen(true);
    };

    const handleAddNew = () => {
        if (onAdd && searchTerm) {
            const existingOption = options.find(item => item.label.toLowerCase() === searchTerm.toLowerCase());
            if (existingOption) {
                handleSelect(existingOption);
            } else {
                onAdd(searchTerm);
                onChange(searchTerm); 
                setIsOpen(false);
            }
        }
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onClick={handleInputClick}
                    onFocus={handleInputClick}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && showGoButton && onGoClick) {
                            e.preventDefault();
                            onGoClick();
                        }
                    }}
                    className={cn("w-full pl-8 h-8 text-sm", showGoButton ? "pr-14" : "pr-8", inputClassName)}
                />
                {showGoButton && (
                    <div className="absolute inset-y-0 right-1 flex items-center">
                        <Button
                            size="sm"
                            className="h-5 rounded-full px-2.5 text-[10px]"
                            onClick={onGoClick}
                        >
                            Go
                        </Button>
                    </div>
                )}
                {!showGoButton && (showClearButton || showArrow) && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                        {showClearButton && value && (
                        <button type="button" onClick={handleClear} className="p-0.5 focus:outline-none rounded-full hover:bg-muted">
                            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                    )}
                        {showArrow && (
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-0.5 focus:outline-none"
                    >
                        {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                    </button>
                        )}
                </div>
                )}
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
                    {filteredItems.length > 100 && searchTerm && (
                        <div className="px-4 py-2 text-xs text-muted-foreground border-b">
                            Showing {Math.min(virtualItems.endIndex - virtualItems.startIndex, filteredItems.length)} of {filteredItems.length} results
                        </div>
                    )}
                    <ul 
                        ref={listRef}
                        className="py-1 max-h-80 overflow-y-auto scrollbar-hide"
                        onScroll={handleScroll}
                        style={{ position: 'relative', minHeight: filteredItems.length === 0 ? 'auto' : '0' }}
                    >
                        {/* Spacer for items before visible range */}
                        {virtualItems.startIndex > 0 && (
                            <li style={{ height: virtualItems.startIndex * ITEM_HEIGHT }} aria-hidden="true" />
                        )}
                        
                        {filteredItems.length > 0 ? (
                            virtualItems.visibleItems.map((item, relativeIndex) => {
                                const actualIndex = virtualItems.startIndex + relativeIndex;
                                return (
                                <li
                                        key={`${item.value}-${actualIndex}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelect(item);
                                    }}
                                    className={cn(
                                            "cursor-pointer px-3 py-1.5 text-xs hover:bg-accent",
                                        selectedItem?.value === item.value ? 'bg-accent font-medium' : ''
                                    )}
                                        style={{ height: ITEM_HEIGHT }}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs truncate">
                                            {item.label}
                                        </span>
                                    </div>
                                </li>
                                );
                            })
                        ) : (
                            !onAdd && <li className="px-4 py-2 text-xs text-muted-foreground text-center">{noItemsPlaceholder}</li>
                        )}
                        
                        {/* Spacer for items after visible range */}
                        {virtualItems.endIndex < filteredItems.length && (
                            <li style={{ height: (filteredItems.length - virtualItems.endIndex) * ITEM_HEIGHT }} aria-hidden="true" />
                        )}
                        
                         {onAdd && searchTerm && !options.some(item => item.label.toLowerCase() === searchTerm.toLowerCase()) && (
                            <li
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleAddNew();
                                }}
                                className="cursor-pointer px-4 py-2 text-xs hover:bg-accent text-primary font-medium"
                            >
                                Add "{searchTerm}"
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};
