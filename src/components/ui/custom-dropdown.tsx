
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export interface CustomDropdownOption {
    value: string;
    label: string;
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

    const selectedItem = useMemo(() => options.find(option => option.value === value), [options, value]);

    useEffect(() => {
        // When a value is selected, update the search term to reflect it
        setSearchTerm(selectedItem?.label || '');
    }, [selectedItem]);
    
    const filteredItems = useMemo(() => {
        if (!searchTerm) {
            return options;
        }
        // Match only from the beginning of the string (case-insensitive)
        return options.filter(item =>
            item.label.toLowerCase().startsWith(searchTerm.toLowerCase())
        );
    }, [searchTerm, options]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // If dropdown is closed without selection, revert search term to selected item's label or clear it
                setSearchTerm(selectedItem?.label || '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectedItem]);

    const handleSelect = (item: CustomDropdownOption) => {
        onChange(item.value);
        setSearchTerm(item.label);
        setIsOpen(false);
    };
    
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation(); // Stop the click from propagating to the main button
        onChange(null);
        setSearchTerm('');
        setIsOpen(true); // Re-open the dropdown after clearing
        dropdownRef.current?.querySelector('input')?.focus(); // Focus the input
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSearchTerm = e.target.value;
        setSearchTerm(newSearchTerm);
        // If the user starts typing, we should clear the selected value
        if (value && newSearchTerm !== selectedItem?.label) {
            onChange(null);
        }
        setIsOpen(true);
    };

    const handleInputClick = () => {
        setSearchTerm(''); // Clear the search term on click to allow for a new search
        onChange(null);
        setIsOpen(true);
    };

    const handleAddNew = () => {
        if (onAdd && searchTerm && !filteredItems.some(item => item.label.toLowerCase() === searchTerm.toLowerCase())) {
            onAdd(searchTerm);
            setIsOpen(false);
        }
    }

    return (
        <div className="relative w-full" ref={dropdownRef}>
             <div className="flex items-center w-full border border-input bg-background rounded-md h-8 text-sm focus-within:border-primary/80">
                <div className="relative flex-1">
                     <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={searchTerm}
                        onChange={handleInputChange}
                        onClick={handleInputClick}
                        className="w-full pl-8 pr-10 h-auto py-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                </div>
                <div className="flex items-center space-x-1 pr-2">
                    {value && (
                        <button type="button" onClick={handleClear} className="p-1 focus:outline-none">
                            <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors cursor-pointer" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1 focus:outline-none"
                    >
                        {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground transition-transform" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                        )}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
                    <ul className="py-1 max-h-60 overflow-y-auto scrollbar-hide">
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item) => (
                                <li
                                    key={item.value}
                                    onClick={() => handleSelect(item)}
                                    className={cn(
                                        "cursor-pointer px-4 py-2 text-sm hover:bg-accent",
                                        selectedItem?.value === item.value ? 'bg-accent font-medium' : ''
                                    )}
                                >
                                    {item.label}
                                </li>
                            ))
                        ) : (
                            <li className="px-4 py-2 text-sm text-muted-foreground text-center">
                                {noItemsPlaceholder}
                            </li>
                        )}
                         {onAdd && searchTerm && !filteredItems.some(item => item.label.toLowerCase() === searchTerm.toLowerCase()) && (
                            <li
                                onClick={handleAddNew}
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
