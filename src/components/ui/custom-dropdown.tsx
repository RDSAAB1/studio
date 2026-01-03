
"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import { cn, levenshteinDistance } from '@/lib/utils';
import { Input } from './input';
import { Button } from './button';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export interface CustomDropdownOption {
    value: string;
    label: string;
    displayValue?: string; // Optional display value for input field (if different from label)
    data?: any; // Additional data for enhanced display
}

type SearchType = 'name' | 'fatherName' | 'address' | 'contact';

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
    maxRows?: number;
    showScrollbar?: boolean;
    searchType?: SearchType; // Search by specific field: name, fatherName, address, contact, or all
    onSearchTypeChange?: (type: SearchType) => void; // Callback when search type changes
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
    maxRows,
    showScrollbar = false,
    searchType = 'name',
    onSearchTypeChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [scrollTop, setScrollTop] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, openAbove: false });
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [currentSearchType, setCurrentSearchType] = useState<SearchType>(searchType);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    // Mount check for portal
    useEffect(() => {
        setIsMounted(true);
    }, []);
    
    // Update currentSearchType when searchType prop changes
    useEffect(() => {
        setCurrentSearchType(searchType);
    }, [searchType]);

    // Calculate dropdown position when opening and on scroll
    const updateDropdownPosition = useCallback(() => {
        if (isOpen && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            // Simple logic: if enough space below (200px), open below; otherwise open above
            const openAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
            
            let top: number;
            if (openAbove) {
                // Position above the input, right next to it
                top = rect.top + window.scrollY;
            } else {
                // Position below the input, right next to it
                top = rect.bottom + window.scrollY;
            }
            
            setDropdownPosition({
                top,
                left: rect.left + window.scrollX,
                width: rect.width,
                openAbove
            });
        }
    }, [isOpen]);

    useEffect(() => {
        updateDropdownPosition();
    }, [isOpen, updateDropdownPosition]);

    // Update position on scroll and resize
    useEffect(() => {
        if (!isOpen) return;

        const handleScroll = () => {
            updateDropdownPosition();
        };

        const handleResize = () => {
            updateDropdownPosition();
        };

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen, updateDropdownPosition]);

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
            setHighlightedIndex(-1); // Reset highlighted index when opening
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
        
        // Normalize search term: trim and lowercase, normalize whitespace
        const normalizeText = (text: string): string => {
            return text.toLowerCase().trim().replace(/\s+/g, ' ');
        };
        const lowercasedSearchTerm = normalizeText(debouncedSearchTerm);
        const maxResults = 200; // Limit results for performance
        
        // Helper function to get search text based on search type
        const getSearchText = (item: CustomDropdownOption): string => {
            // Extract field from data based on search type
            const data = item.data || {};
            let searchText = '';
            
            switch (currentSearchType) {
                case 'name':
                    // If data.name exists and is not empty, use it; otherwise fall back to label
                    const nameValue = data.name?.trim();
                    searchText = normalizeText(nameValue ? String(nameValue) : (item.label || ''));
                    break;
                case 'fatherName':
                    searchText = normalizeText(String(data.fatherName || data.so || ''));
                    break;
                case 'address':
                    searchText = normalizeText(String(data.address || ''));
                    break;
                case 'contact':
                    // For contact, just trim and lowercase (phone numbers usually don't have spaces)
                    searchText = String(data.contact || '').trim().toLowerCase();
                    break;
                default:
                    searchText = normalizeText(item.label);
            }
            
            return searchText;
        };
        
        // Fast path: simple includes check first
        const quickMatches: Array<{ item: CustomDropdownOption; distance: number }> = [];
        const fuzzyMatches: Array<{ item: CustomDropdownOption; distance: number }> = [];
        
        for (let i = 0; i < options.length && (quickMatches.length + fuzzyMatches.length) < maxResults; i++) {
            const item = options[i];
            const searchText = getSearchText(item);
            
            // Skip if search text is empty (field not available)
            if (!searchText || searchText.trim() === '') {
                continue;
            }
            
            // EXACT MATCH (Highest Priority): Full string exact match (after normalization)
            if (searchText === lowercasedSearchTerm) {
                quickMatches.push({ item, distance: 0 });
                continue;
            }
            
            // EXACT WORD MATCH: Check if search term matches a complete word (word boundary)
            // Split by common delimiters
            const words = searchText.split(/[\s\-\(\)\.\|,;:]+/);
            let exactWordMatch = false;
            for (const word of words) {
                const normalizedWord = normalizeText(word);
                if (normalizedWord === lowercasedSearchTerm && normalizedWord.length > 0) {
                    exactWordMatch = true;
                    break;
                }
            }
            if (exactWordMatch) {
                quickMatches.push({ item, distance: 0 });
                continue;
            }
            
            // EXACT STARTS WITH: Check if field starts with search term (for autocomplete-like behavior)
            if (searchText.startsWith(lowercasedSearchTerm) && lowercasedSearchTerm.length > 0) {
                quickMatches.push({ item, distance: 0 });
                continue;
            }
            
            // PARTIAL EXACT MATCH: Check if search term is contained exactly (substring match)
            if (searchText.includes(lowercasedSearchTerm) && lowercasedSearchTerm.length > 0) {
                quickMatches.push({ item, distance: 0 });
                continue;
                }
                
            // FUZZY MATCHING: Only if no exact match found (for spelling mistakes)
            if (quickMatches.length < 50) {
                const textParts = searchText.split(/[\s\-\(\)\.]+/);
                let minDistance = Infinity;
                
                // Check each word part
                for (const part of textParts) {
                    if (part.length === 0) continue;
                    
                    // If part starts with search term, it's a close match
                    if (part.startsWith(lowercasedSearchTerm) || lowercasedSearchTerm.startsWith(part)) {
                        minDistance = Math.min(minDistance, Math.abs(part.length - lowercasedSearchTerm.length));
                        continue;
                    }
                    
                    // Calculate Levenshtein distance
                    const distance = levenshteinDistance(lowercasedSearchTerm, part);
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                }
                
                // Also check full text distance
                const fullDistance = levenshteinDistance(lowercasedSearchTerm, searchText);
                minDistance = Math.min(minDistance, fullDistance);
                
                // Allow fuzzy matching only for small differences (up to 3 characters for spelling mistakes)
                // Only add if it's a reasonable match (not too different)
                if (minDistance <= 3 && minDistance < Math.max(lowercasedSearchTerm.length * 0.3, 3)) {
                    fuzzyMatches.push({ item, distance: minDistance });
                }
            }
        }
        
            // Combine and sort: Exact matches first (distance 0), then by distance (less mismatch = higher priority)
            // Also prioritize exact matches by length (shorter exact matches first, then longer)
        const allMatches = [...quickMatches, ...fuzzyMatches]
                .sort((a, b) => {
                    // First priority: Exact matches (distance 0) come before fuzzy matches
                    if (a.distance === 0 && b.distance !== 0) return -1;
                    if (a.distance !== 0 && b.distance === 0) return 1;
                    
                    // Second priority: If both are exact (distance 0), prefer shorter matches (more specific)
                    if (a.distance === 0 && b.distance === 0) {
                        const aText = getSearchText(a.item);
                        const bText = getSearchText(b.item);
                        const aMatchLength = aText.length;
                        const bMatchLength = bText.length;
                        // Shorter exact matches first (more specific)
                        return aMatchLength - bMatchLength;
                    }
                    
                    // Third priority: Sort by distance (less mismatch = better = higher in list)
                    return a.distance - b.distance;
                })
            .slice(0, maxResults);
        
        return allMatches.map(m => m.item);
    }, [debouncedSearchTerm, options, selectedItem, currentSearchType]);

    // Virtual scrolling: only render visible items
    const ITEM_HEIGHT = 32; // Approximate height of each item (reduced for smaller text)
    const VISIBLE_ITEMS = 20; // Number of items visible at once
    const BUFFER = 5; // Extra items to render for smooth scrolling
    const maxHeightValue = maxRows ? maxRows * ITEM_HEIGHT : 320; // Max height in pixels
    const maxHeight = maxRows ? `${maxHeightValue}px` : '20rem';
    // Calculate actual height based on items count
    const PADDING = 8; // py-1 = 4px top + 4px bottom
    const itemsHeight = filteredItems.length * ITEM_HEIGHT + PADDING;
    const maxHeightWithPadding = maxHeightValue + PADDING; // Max height including padding
    // When maxRows is set: always use max height (5 rows) to strictly limit visible items
    // If items <= maxRows, use items height, otherwise use max height
    const actualHeight = maxRows 
        ? (filteredItems.length <= maxRows ? itemsHeight : maxHeightWithPadding)
        : Math.min(itemsHeight, maxHeightWithPadding);
    const heightStyle = `${actualHeight}px`;
    
    // For ul element: when maxRows is set and items > maxRows, always use maxHeightWithPadding
    // This ensures strict height limit of exactly maxRows items
    const ulHeight = maxRows && filteredItems.length > maxRows 
        ? maxHeightWithPadding  // Strictly limit to maxRows height (5 rows = 160px + 8px = 168px)
        : (maxRows ? actualHeight : actualHeight);
    const ulHeightStyle = `${ulHeight}px`;
    
    // Debug: Log height values when maxRows is set
    // ('maxRows:', maxRows, 'filteredItems.length:', filteredItems.length, 'ulHeightStyle:', ulHeightStyle);
    
    const virtualItems = useMemo(() => {
        // When maxRows is set, limit visible items to maxRows only (strict limit)
        const maxVisibleItems = maxRows ? maxRows : VISIBLE_ITEMS;
        const bufferSize = maxRows ? 0 : BUFFER; // No buffer when maxRows is set to strictly limit to maxRows
        const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - bufferSize);
        const endIndex = Math.min(
            filteredItems.length,
            startIndex + maxVisibleItems
        );
        
        return {
            startIndex,
            endIndex,
            totalHeight: filteredItems.length * ITEM_HEIGHT,
            visibleItems: filteredItems.slice(startIndex, endIndex),
        };
    }, [scrollTop, filteredItems, maxRows]);

    // Reset highlighted index if it's out of bounds
    useEffect(() => {
        if (highlightedIndex >= filteredItems.length) {
            setHighlightedIndex(filteredItems.length > 0 ? 0 : -1);
        }
    }, [filteredItems.length, highlightedIndex]);

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
        setHighlightedIndex(-1); // Reset highlighted index when searching
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

    const handleSearchTypeChange = (newType: string) => {
        const searchTypeValue = newType as SearchType;
        setCurrentSearchType(searchTypeValue);
        if (onSearchTypeChange) {
            onSearchTypeChange(searchTypeValue);
        }
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* Search Type Dropdown - Only show if onSearchTypeChange is provided */}
            {onSearchTypeChange && (
                <div className="mb-2">
                    <Select value={currentSearchType} onValueChange={handleSearchTypeChange}>
                        <SelectTrigger className="h-8 text-xs w-full sm:w-[180px]">
                            <SelectValue placeholder="Search by..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="fatherName">Father Name</SelectItem>
                            <SelectItem value="address">Address</SelectItem>
                            <SelectItem value="contact">Contact</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    ref={inputRef}
                    type="text"
                    data-custom-dropdown="true"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={handleInputChange}
                    onClick={handleInputClick}
                    onFocus={handleInputClick}
                    onKeyDown={(e) => {
                        if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                            // Open dropdown on arrow key press
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(true);
                            setHighlightedIndex(0);
                            return;
                        }

                        if (!isOpen) {
                            if (e.key === "Enter" && showGoButton && onGoClick) {
                                e.preventDefault();
                                e.stopPropagation();
                                onGoClick();
                            } else if (e.key === "Enter") {
                                // If dropdown is closed and Enter is pressed
                                // If there's a search term and matches, select the first one
                                if (debouncedSearchTerm && filteredItems.length > 0) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelect(filteredItems[0]);
                                } else {
                                    // No search term or no matches - allow form to handle (move to next field)
                                    // Don't prevent default or stop propagation
                                    return;
                                }
                            }
                            return;
                        }
                        
                        // When dropdown is open, handle Enter key
                        if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                        }

                        // Handle keyboard navigation when dropdown is open
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            const nextIndex = highlightedIndex < filteredItems.length - 1 
                                ? highlightedIndex + 1 
                                : 0;
                            setHighlightedIndex(nextIndex);
                            // Scroll to highlighted item
                            if (listRef.current) {
                                const targetScrollTop = nextIndex * ITEM_HEIGHT;
                                listRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                            }
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            const prevIndex = highlightedIndex > 0 
                                ? highlightedIndex - 1 
                                : filteredItems.length - 1;
                            setHighlightedIndex(prevIndex);
                            // Scroll to highlighted item
                            if (listRef.current) {
                                const targetScrollTop = prevIndex * ITEM_HEIGHT;
                                listRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
                            }
                        } else if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation(); // Prevent form submission or other handlers
                            if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
                                handleSelect(filteredItems[highlightedIndex]);
                            } else if (filteredItems.length === 1) {
                                // If only one item matches, select it
                                handleSelect(filteredItems[0]);
                            } else if (showGoButton && onGoClick) {
                                onGoClick();
                            }
                        } else if (e.key === "Escape") {
                            e.preventDefault();
                            setIsOpen(false);
                            if (selectedItem) {
                                setSearchTerm(selectedItem.displayValue || selectedItem.label);
                            }
                        }
                    }}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    name={`custom-dropdown-${Math.random().toString(36).substring(7)}`}
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

            {isOpen && isMounted && createPortal(
                <div 
                    className="fixed bg-popover border border-border rounded-md shadow-lg z-[100]" 
                    style={{ 
                        position: 'fixed', 
                        top: `${dropdownPosition.top}px`, 
                        left: `${dropdownPosition.left}px`, 
                        width: `${dropdownPosition.width}px`,
                        maxHeight: maxHeight,
                        height: maxRows && filteredItems.length > maxRows ? ulHeightStyle : (maxRows ? heightStyle : 'auto'),
                        pointerEvents: 'auto',
                        overflow: 'hidden',
                        transform: dropdownPosition.openAbove ? 'translateY(-100%)' : 'none',
                        marginTop: dropdownPosition.openAbove ? '-4px' : '4px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {filteredItems.length > 100 && searchTerm && (
                        <div className="px-4 py-2 text-xs text-muted-foreground border-b">
                            Showing {Math.min(virtualItems.endIndex - virtualItems.startIndex, filteredItems.length)} of {filteredItems.length} results
                        </div>
                    )}
                    <ul 
                        ref={listRef}
                        className={cn("py-1 overflow-y-auto", !showScrollbar && "scrollbar-hide")}
                        onScroll={handleScroll}
                        onWheel={(e) => {
                            // Allow wheel scrolling
                            e.stopPropagation();
                        }}
                        style={{ 
                            position: 'relative', 
                            pointerEvents: 'auto',
                            height: maxRows ? ulHeightStyle : maxHeight,
                            maxHeight: maxHeight,
                            overflowY: maxRows && filteredItems.length > maxRows ? 'auto' : (maxRows ? 'visible' : 'auto'),
                            overflowX: 'hidden',
                            listStyle: 'none',
                            margin: '0',
                            padding: '0',
                            WebkitOverflowScrolling: 'touch',
                            overscrollBehavior: 'contain'
                        }}
                    >
                        {/* Always use virtual scrolling with spacers to maintain proper height */}
                        <>
                                {/* Spacer for items before visible range */}
                                {virtualItems.startIndex > 0 && (
                                    <li style={{ height: virtualItems.startIndex * ITEM_HEIGHT }} aria-hidden="true" />
                                )}
                                
                                {filteredItems.length > 0 ? (
                                    virtualItems.visibleItems.map((item, relativeIndex) => {
                                        const actualIndex = virtualItems.startIndex + relativeIndex;
                                        const isHighlighted = actualIndex === highlightedIndex;
                                        const isSelected = selectedItem?.value === item.value;
                                        return (
                                        <li
                                                key={`${item.value}-${actualIndex}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleSelect(item);
                                            }}
                                            onMouseEnter={() => setHighlightedIndex(actualIndex)}
                                            onMouseDown={(e) => {
                                                // Don't prevent default to allow scrolling
                                                e.stopPropagation();
                                            }}
                                            className={cn(
                                                    "cursor-pointer px-3 py-1.5 text-xs transition-colors",
                                                isHighlighted ? 'bg-accent' : 'hover:bg-accent',
                                                isSelected ? 'font-medium' : ''
                                            )}
                                                style={{ height: ITEM_HEIGHT, pointerEvents: 'auto' }}
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
                            </>
                        
                         {onAdd && searchTerm && filteredItems.length === 0 && !options.some(item => {
                            const normalizedSearch = searchTerm.toLowerCase().trim();
                            const normalizedLabel = item.label.toLowerCase().trim();
                            return normalizedLabel === normalizedSearch;
                         }) && (
                            <li
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddNew();
                                }}
                                onMouseDown={(e) => {
                                    // Don't prevent default to allow scrolling
                                    e.stopPropagation();
                                }}
                                className="cursor-pointer px-4 py-2 text-xs hover:bg-accent text-primary font-medium"
                            >
                                Add "{searchTerm}"
                            </li>
                        )}
                    </ul>
                </div>,
                document.body
            )}
        </div>
    );
};
