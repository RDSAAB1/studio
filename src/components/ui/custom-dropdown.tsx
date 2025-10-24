
"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import { cn, levenshteinDistance } from '@/lib/utils';
import { Input } from './input';

export interface CustomDropdownOption {
    value: string;
    label: string;
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
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select an item...',
    searchPlaceholder = 'Search items...',
    noItemsPlaceholder = 'No item found.',
    onAdd,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedItem = useMemo(() => options.find(option => option.value === value), [options, value]);

    useEffect(() => {
        // Only update search term if a valid selection is made and user is not actively typing
        // This prevents overwriting user's typing
        if (selectedItem && !isOpen) {
            setSearchTerm(selectedItem.label);
        } else if (!value && !isOpen) {
            setSearchTerm('');
        }
    }, [value, selectedItem, isOpen]);
    
    const filteredItems = useMemo(() => {
        if (!searchTerm || (selectedItem && searchTerm === selectedItem.label)) {
            return options;
        }
        
        const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
        
        return options
            .map(item => {
                const lowercasedLabel = item.label.toLowerCase();
                
                // Check for exact matches first
                if (lowercasedLabel.includes(lowercasedSearchTerm)) {
                    return { ...item, distance: 0 };
                }
                
                // Check for partial matches in different parts of the label
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
                
                // Also check the full label for fuzzy matching
                const fullDistance = levenshteinDistance(lowercasedSearchTerm, lowercasedLabel);
                minDistance = Math.min(minDistance, fullDistance);
                
                return { ...item, distance: minDistance };
            })
            .filter(item => 
                // Keep items that include the search term OR are very similar (low distance)
                item.distance <= 3
            )
            .sort((a, b) => a.distance - b.distance); // Sort by similarity

    }, [searchTerm, options, selectedItem]);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
            // Only reset search term if we have a valid selection
            if (selectedItem) {
                setSearchTerm(selectedItem.label);
            } else if (value) {
                 const matchingOption = options.find(opt => opt.value === value || opt.label === value);
                 if (matchingOption) {
                    setSearchTerm(matchingOption.label);
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
        setSearchTerm(item.label);
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
    };
    
    const handleInputClick = () => {
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
                    className="w-full pl-8 pr-8 h-8 text-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    {value && (
                        <button type="button" onClick={handleClear} className="p-0.5 focus:outline-none rounded-full hover:bg-muted">
                            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                    )}
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
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
                    <ul className="py-1 max-h-60 overflow-y-auto scrollbar-hide">
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item, index) => (
                                <li
                                    key={`${item.value}-${index}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelect(item);
                                    }}
                                    className={cn(
                                        "cursor-pointer px-4 py-2 text-sm hover:bg-accent",
                                        selectedItem?.value === item.value ? 'bg-accent font-medium' : ''
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center space-x-2 text-sm">
                                            <span className="font-medium text-foreground">
                                                {item.data?.name ? item.data.name : 
                                                 item.label.includes(' | ') ? item.label.split(' | ')[0] : 
                                                 item.label.split(' - ')[0]}
                                            </span>
                                            {(() => {
                                                // Parse father name from label if data is not available
                                                let fatherName = item.data?.fatherName || item.data?.so;
                                                
                                                if (!fatherName && item.label.includes(' | F:')) {
                                                    // Parse from new format: "Name | F:Father Name | Address | Contact"
                                                    const parts = item.label.split(' | ');
                                                    if (parts.length > 1 && parts[1].startsWith('F:')) {
                                                        fatherName = parts[1].substring(2).trim(); // Remove "F:" prefix
                                                    }
                                                } else if (!fatherName && item.label.includes(' - ')) {
                                                    // Fallback to old format: "Name - Father Name - Address (Contact)"
                                                    const parts = item.label.split(' - ');
                                                    if (parts.length > 1) {
                                                        fatherName = parts[1].replace(/\s*\([^)]*\)$/, '').trim();
                                                    }
                                                }
                                                
                                                return fatherName && (
                                                    <span className="text-muted-foreground">
                                                        Son of {fatherName}
                                                    </span>
                                                );
                                            })()}
                                            {(() => {
                                                // Parse address from label if data is not available
                                                let address = item.data?.address;
                                                if (!address && item.label.includes(' | ')) {
                                                    // Parse from new format: "Name | F:Father Name | Address | Contact"
                                                    const parts = item.label.split(' | ');
                                                    if (parts.length > 2) {
                                                        address = parts[2].trim();
                                                    }
                                                } else if (!address && item.label.includes(' - ')) {
                                                    // Fallback to old format: "Name - Father Name - Address (Contact)"
                                                    const parts = item.label.split(' - ');
                                                    if (parts.length > 2) {
                                                        address = parts[2].replace(/\s*\([^)]*\)$/, '').trim();
                                                    }
                                                }
                                                return address && (
                                                    <span className="text-muted-foreground">
                                                        | {address}
                                                    </span>
                                                );
                                            })()}
                                            {(() => {
                                                // Parse contact from label if data is not available
                                                let contact = item.data?.contact;
                                                if (!contact && item.label.includes(' | ')) {
                                                    // Parse from new format: "Name | F:Father Name | Address | Contact"
                                                    const parts = item.label.split(' | ');
                                                    if (parts.length > 3) {
                                                        contact = parts[3].trim();
                                                    }
                                                } else if (!contact && item.label.includes('(')) {
                                                    // Fallback to old format: "Name - Father Name - Address (Contact)"
                                                    const match = item.label.match(/\(([^)]+)\)/);
                                                    if (match) {
                                                        contact = match[1].trim();
                                                    }
                                                }
                                                return contact && (
                                                    <span className="text-muted-foreground">
                                                        | {contact}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </li>
                            ))
                        ) : (
                             !onAdd && <li className="px-4 py-2 text-sm text-muted-foreground text-center">{noItemsPlaceholder}</li>
                        )}
                         {onAdd && searchTerm && !options.some(item => item.label.toLowerCase() === searchTerm.toLowerCase()) && (
                            <li
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleAddNew();
                                }}
                                className="cursor-pointer px-4 py-2 text-sm hover:bg-accent text-primary font-medium"
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
